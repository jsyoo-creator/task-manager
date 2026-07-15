import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where, writeBatch, deleteField
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task, SubTask, Team } from '../types';
import { BUILTIN_FIELDS_META, mergeFormConfig, resolveGroupSyncFields } from '../types';

const BUILTIN_KEY_SET = new Set(BUILTIN_FIELDS_META.map(m => m.key as string));

export function useTasks(projectId: string, teamId: string | null, team?: Team | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !teamId) { setTasks([]); setLoading(false); return; }
    const q = query(collection(db, 'tasks'), where('teamId', '==', teamId));
    const unsub = onSnapshot(q,
      snap => {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Task))
          .sort((a, b) => {
            if (a.sortOrder != null && b.sortOrder != null) {
              // sortOrder가 완전히 같은 값이면(예: 서로 다른 파트 업무가 과거 버그로 값이
              // 겹친 경우) 조회할 때마다 순서가 안정적이어야 하므로, Firestore 스냅샷의
              // 문서 순서(orderBy 없어 비결정적)에 기대지 않고 createdAt으로 한 번 더 확정
              if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
              return b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0;
            }
            if (a.sortOrder != null) return -1;
            if (b.sortOrder != null) return 1;
            return b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0;
          });
        setTasks(sorted);
        setLoading(false);
      },
      err => { console.error('tasks:', err); setLoading(false); }
    );
    return unsub;
  }, [projectId, teamId]);

  const addTask = async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const payload = Object.fromEntries(
      Object.entries({ ...data, createdAt: now, updatedAt: now }).filter(([, v]) => v !== undefined)
    );
    await addDoc(collection(db, 'tasks'), payload);
  };

  // 업무 귀속(그룹핑) 시 상위 업무와 동기화할 필드 key 목록 — 팀/파트 설정(폼설정의
  // groupSyncFields)에서 가져오고, 설정이 없으면 기존 하드코딩 동작과 같은 기본값(담당자/기간)
  const getSyncKeys = (task: Task): string[] => {
    const part = team?.parts?.find(p => p.name === task.category);
    return resolveGroupSyncFields(mergeFormConfig(part?.formConfig, team?.formConfig));
  };

  // key가 빌트인 필드면 최상위 필드로, 그 외(추가정보/업무정보 커스텀 필드 id)면
  // customFields 맵 안에 병합해 patch 객체를 만듦
  const buildSyncPatch = (keys: string[], source: Partial<Task>, targetCustomFields: Record<string, string> | undefined) => {
    const patch: Record<string, unknown> = {};
    let customPatch: Record<string, string> | null = null;
    keys.forEach(key => {
      if (BUILTIN_KEY_SET.has(key)) {
        patch[key] = (source as unknown as Record<string, unknown>)[key];
      } else {
        if (!customPatch) customPatch = { ...(targetCustomFields ?? {}) };
        customPatch[key] = source.customFields?.[key] ?? '';
      }
    });
    if (customPatch) patch.customFields = customPatch;
    return patch;
  };

  const updateTask = async (id: string, data: Partial<Task>) => {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: now });

    // 귀속(그룹) 공유 항목이 바뀌면 이 업무에 귀속된 하위 업무들에도 실시간으로 반영.
    // "무엇이 바뀌었는지"는 tasks state(지연 가능)가 아니라 방금 들어온 data 그대로 사용.
    const changedKeys = Object.keys(data).filter(k => k !== 'updatedAt' && k !== 'customFields');
    const changedCustomKeys = data.customFields ? Object.keys(data.customFields) : [];
    if (changedKeys.length === 0 && changedCustomKeys.length === 0) return;

    const children = tasks.filter(t => t.parentTaskId === id);
    if (children.length === 0) return;

    const batch = writeBatch(db);
    let any = false;
    children.forEach(child => {
      const syncKeys = new Set(getSyncKeys(child));
      const keysToApply = [
        ...changedKeys.filter(k => syncKeys.has(k)),
        ...changedCustomKeys.filter(k => syncKeys.has(k)),
      ];
      if (keysToApply.length === 0) return;
      // data 자체를 소스로 patch 구성 — customFields 변경분은 data.customFields에서 값을 가져옴
      const patch = buildSyncPatch(keysToApply, data, child.customFields);
      any = true;
      batch.update(doc(db, 'tasks', child.id), { ...patch, updatedAt: now });
    });
    if (any) await batch.commit();
  };

  const deleteTask = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id));
  };

  // 선택한 업무들(childIds)을 parentId 업무에 귀속시킴 — 귀속 즉시 각 자식의 팀/파트
  // 설정에 맞는 항목들을 상위 업무 값으로 맞춰, 다음 상위 업무 수정을 기다리지 않아도 되게 함
  const groupTasks = async (childIds: string[], parentId: string) => {
    const parent = tasks.find(t => t.id === parentId);
    if (!parent) return;
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    childIds.forEach(id => {
      const child = tasks.find(t => t.id === id);
      const syncKeys = getSyncKeys(child ?? parent);
      const patch = buildSyncPatch(syncKeys, parent, child?.customFields);
      batch.update(doc(db, 'tasks', id), { parentTaskId: parentId, ...patch, updatedAt: now });
    });
    await batch.commit();
  };

  // 귀속 해제 — parentTaskId 필드를 실제로 제거해야 하므로 deleteField() 사용
  // (undefined는 ignoreUndefinedProperties 설정 때문에 조용히 무시되어 필드가 안 지워짐)
  const removeFromGroup = async (taskIds: string[]) => {
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    taskIds.forEach(id => batch.update(doc(db, 'tasks', id), { parentTaskId: deleteField(), updatedAt: now }));
    await batch.commit();
  };

  const cleanupOrphanTasks = async (validCategories: string[]): Promise<number> => {
    // PL업무는 category(대표 파트 1개)뿐 아니라 plParts(선택한 전체 파트) 중 하나라도
    // 유효하면 살아있는 업무로 취급 — category만 보면 유효한 다른 파트가 남아있는
    // PL업무를 오삭제하게 됨
    const orphans = tasks.filter(t => {
      if (t.plTask && t.plParts?.length) {
        return !t.plParts.some(p => validCategories.includes(p));
      }
      return !validCategories.includes(t.category ?? '');
    });
    if (orphans.length === 0) return 0;
    for (let i = 0; i < orphans.length; i += 499) {
      const batch = writeBatch(db);
      orphans.slice(i, i + 499).forEach(t => batch.delete(doc(db, 'tasks', t.id)));
      await batch.commit();
    }
    return orphans.length;
  };

  return { tasks, loading, addTask, updateTask, deleteTask, cleanupOrphanTasks, groupTasks, removeFromGroup };
}

// 지원팀 위클리에서 "다른 팀 업무에 기록된 지원팀 인원의 시간"을 찾아오려면
// 근무지당 1개인 프로젝트 전체(모든 팀)의 tasks가 필요함 — teamId 필터 없이 projectId로만 조회.
// 지원팀 화면일 때만 조건부로 구독(projectId를 빈 문자열로 넘기면 비활성화)해 평소엔 비용이 없게 함.
export function useAllTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!projectId) { setTasks([]); return; }
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q,
      snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))),
      err => console.error('allTasks:', err)
    );
    return unsub;
  }, [projectId]);

  return { tasks };
}

export function useSubTasks(taskId: string) {
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);

  useEffect(() => {
    if (!taskId) return;
    const q = query(collection(db, 'subtasks'), where('taskId', '==', taskId));
    const unsub = onSnapshot(q,
      snap => {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as SubTask))
          .sort((a, b) => a.createdAt?.localeCompare(b.createdAt ?? '') ?? 0);
        setSubtasks(sorted);
      },
      err => console.error('subtasks:', err)
    );
    return unsub;
  }, [taskId]);

  const addSubTask = async (data: Omit<SubTask, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'subtasks'), { ...data, createdAt: new Date().toISOString() });
  };

  const updateSubTask = async (id: string, data: Partial<SubTask>) => {
    await updateDoc(doc(db, 'subtasks', id), data);
  };

  const deleteSubTask = async (id: string) => {
    await deleteDoc(doc(db, 'subtasks', id));
  };

  return { subtasks, addSubTask, updateSubTask, deleteSubTask };
}

export function useAllSubTasks(projectId: string) {
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'subtasks'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q,
      snap => setSubtasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubTask))),
      err => console.error('allSubtasks:', err)
    );
    return unsub;
  }, [projectId]);

  return { subtasks };
}
