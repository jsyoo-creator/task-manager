import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs,
  doc, query, where, writeBatch, deleteField
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task, SubTask, Team, SubTaskType } from '../types';
import { BUILTIN_FIELDS_META, mergeFormConfig, resolveGroupSyncFields } from '../types';

const BUILTIN_KEY_SET = new Set(BUILTIN_FIELDS_META.map(m => m.key as string));

// 세부업무-지원팀 연결 업무 생성 시 채우는 필드. 원본 업무의 해당 세부업무 항목에
// 이미 담당자/기간/상태가 입력돼 있으면 그 값을 그대로 이어받고, 없으면 원본 업무
// 자체의 값(기간)이나 빈 값(담당자/상태 기본값)으로 시작함
function buildLinkedSupportPayload(origin: Task, type: SubTaskType, now: string): Record<string, unknown> {
  const entry = origin.subTaskData?.[type.id];
  const payload: Record<string, unknown> = {
    projectId: origin.projectId,
    teamId: type.supportTeamId,
    category: type.supportPartName,
    taskMonth: origin.taskMonth,
    title: `${origin.title} - ${type.name}`,
    type: '신규',
    status: entry?.status ?? '진행 전',
    receiver: '',
    assignee: entry?.assignee ?? '',
    startDate: entry?.startDate ?? origin.startDate,
    endDate: entry?.endDate ?? origin.endDate,
    weeklyHours: {},
    totalHours: 0,
    revisionLevel: 0,
    // sortOrder를 안 넣으면 지원팀 쪽에서 생성 시각 역순으로만 섞여 원본 팀의 업무
    // 순서와 무관하게 뒤죽박죽으로 보임 — 원본 업무의 순서를 그대로 물려받아, 최소한
    // 자동 생성된 지원팀 업무들끼리는 원본과 같은 상대 순서를 유지하게 함
    sortOrder: origin.sortOrder,
    linkedFromTaskId: origin.id,
    linkedFromSubTaskTypeId: type.id,
    createdAt: now,
    updatedAt: now,
  };
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}

// 세부업무 타입에 지원팀 연결을 새로 설정(또는 변경)했을 때, 이미 등록되어 있던
// 업무들에도 즉시 적용되도록 지원팀 업무를 일괄 생성한다. 이미 이 세부업무 타입으로
// 연결된 업무는 건너뛰어 중복 생성을 막음. 설정 화면(팀 관리 > 세부 업무)에서 저장
// 시점에 호출 — 어떤 팀을 보고 있는 중이든 상관없이 동작해야 해서 useTasks 훅
// 상태에 기대지 않고 직접 조회한다
export async function backfillSupportTaskLinks(params: {
  teamId: string;
  team: Team;
  subTaskType: SubTaskType;
}): Promise<number> {
  const { teamId, team, subTaskType } = params;
  if (!subTaskType.supportTeamId || !subTaskType.supportPartName) return 0;
  const now = new Date().toISOString();

  const [taskSnap, linkedSnap] = await Promise.all([
    getDocs(query(collection(db, 'tasks'), where('teamId', '==', teamId))),
    getDocs(query(collection(db, 'tasks'), where('linkedFromSubTaskTypeId', '==', subTaskType.id))),
  ]);
  // 휴지통으로 보낸(소프트 삭제, deletedAt 있음) 지원팀 업무는 "이미 연결됨"으로 치지
  // 않음 — 안 그러면 사용자가 지원팀 업무를 삭제하고 다시 연결해도 "이미 있음"으로
  // 판단해 새로 만들어주지 않는 문제가 생김
  const alreadyLinkedOriginIds = new Set(
    linkedSnap.docs
      .map(d => d.data() as Task)
      .filter(t => !t.deletedAt)
      .map(t => t.linkedFromTaskId)
      .filter((v): v is string => !!v)
  );

  const targets = taskSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as Task))
    .filter(t => {
      if (t.linkedFromTaskId) return false; // 지원팀 연결 업무 자신은 대상 아님
      if (t.plTask) return false; // PL업무는 세부업무 목록을 쓰지 않으므로 대상 아님
      if (alreadyLinkedOriginIds.has(t.id)) return false;
      const part = team.parts?.find(p => p.name === t.category);
      const types = part?.subTaskTypes ?? team.subTaskTypes ?? [];
      return types.some(ty => ty.id === subTaskType.id);
    });
  if (targets.length === 0) return 0;

  await Promise.all(targets.map(origin => addDoc(collection(db, 'tasks'), buildLinkedSupportPayload(origin, subTaskType, now))));
  return targets.length;
}

// sortOrder 없이 생성됐던(수정 이전) 지원팀 연결 업무들을 원본 업무 순서에 맞춰
// 일괄 복구한다. teamId 팀의 업무들을 원본으로 두고, 그 업무들을 가리키는
// linkedFromTaskId를 가진 지원팀 업무를 찾아 sortOrder를 원본과 맞춤
export async function repairLinkedSupportTaskOrder(teamId: string): Promise<number> {
  const originSnap = await getDocs(query(collection(db, 'tasks'), where('teamId', '==', teamId)));
  const origins = originSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
  if (origins.length === 0) return 0;
  const originById = new Map(origins.map(o => [o.id, o]));

  // Firestore 'in' 쿼리는 최대 30개까지만 지원 — 원본 id들을 30개씩 나눠 조회
  const originIds = origins.map(o => o.id);
  const linked: Task[] = [];
  for (let i = 0; i < originIds.length; i += 30) {
    const chunk = originIds.slice(i, i + 30);
    const snap = await getDocs(query(collection(db, 'tasks'), where('linkedFromTaskId', 'in', chunk)));
    snap.forEach(d => linked.push({ id: d.id, ...d.data() } as Task));
  }

  const toFix = linked.filter(l => {
    const origin = originById.get(l.linkedFromTaskId as string);
    return !!origin && l.sortOrder !== origin.sortOrder;
  });
  if (toFix.length === 0) return 0;

  const now = new Date().toISOString();
  for (let i = 0; i < toFix.length; i += 400) {
    const batch = writeBatch(db);
    toFix.slice(i, i + 400).forEach(l => {
      const origin = originById.get(l.linkedFromTaskId as string)!;
      batch.update(doc(db, 'tasks', l.id), { sortOrder: origin.sortOrder, updatedAt: now });
    });
    await batch.commit();
  }
  return toFix.length;
}

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

  const addTask = async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const now = new Date().toISOString();
    const payload = Object.fromEntries(
      Object.entries({ ...data, createdAt: now, updatedAt: now }).filter(([, v]) => v !== undefined)
    );
    const ref = await addDoc(collection(db, 'tasks'), payload);

    // 세부업무 타입에 지원팀이 연결되어 있으면, 새 업무가 등록되는 즉시 그 세부업무에
    // 대응하는 지원팀 업무를 자동으로 만들어준다(지원팀 연결 업무 자신과 PL업무는
    // 대상에서 제외 — PL업무는 세부업무 목록 자체를 쓰지 않는데도 소속 파트의 전체
    // 세부업무 목록 기준으로 걸려 잘못 전달되는 문제가 있었음)
    if (!data.linkedFromTaskId && !data.plTask) {
      const part = team?.parts?.find(p => p.name === data.category);
      const types = part?.subTaskTypes ?? team?.subTaskTypes ?? [];
      const linkable = types.filter(t => t.supportTeamId && t.supportPartName);
      if (linkable.length > 0) {
        const origin = { ...data, id: ref.id } as Task;
        await Promise.all(linkable.map(type => addDoc(collection(db, 'tasks'), buildLinkedSupportPayload(origin, type, now))));
      }
    }

    return ref.id;
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
    const children = (changedKeys.length > 0 || changedCustomKeys.length > 0)
      ? tasks.filter(t => t.parentTaskId === id)
      : [];

    if (children.length > 0) {
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
        // 담당자 동기화로 바뀌는 경우, 자식의 세부업무(subTaskData) 항목 중 기존
        // 담당자 값을 그대로 따라가던 항목도 같이 갱신 — 안 그러면 세부업무 안엔
        // 예전 담당자가 남아 "내 업무만" 필터(isMyTask)가 계속 그 사람 업무로 인식함.
        // 원래 비어있던(아직 배정 안 된) 항목은 건드리지 않음 — 부서 매칭 자동배정 로직이
        // 나중에 채우도록 남겨둠
        if (keysToApply.includes('assignee') && child.assignee && child.subTaskData) {
          const oldAssignee = child.assignee;
          const newAssignee = data.assignee as string;
          patch.subTaskData = Object.fromEntries(
            Object.entries(child.subTaskData).map(([key, entry]) =>
              entry.assignee === oldAssignee ? [key, { ...entry, assignee: newAssignee }] : [key, entry]
            )
          );
        }
        any = true;
        batch.update(doc(db, 'tasks', child.id), { ...patch, updatedAt: now });
      });
      if (any) await batch.commit();
    }

    await syncSupportTaskLinks(id, data, now);
  };

  // 세부업무-지원팀 연결 양방향 동기화. 로컬 tasks state는 "현재 보고 있는 팀"으로만
  // 필터돼 있어 상대편(원본 팀 또는 지원팀) 업무는 그 안에 없을 수 있으므로, 필요한
  // 경우 Firestore에 직접 질의한다.
  const syncSupportTaskLinks = async (id: string, data: Partial<Task>, now: string) => {
    const touchesAssigneeOrStatus = data.assignee !== undefined || data.status !== undefined;
    const touchesSubTaskData = data.subTaskData !== undefined;
    const touchesBaseInfo = (['title', 'taskMonth', 'startDate', 'endDate'] as const).some(k => k in data);
    // 세부업무를 삭제하면 (subTaskData 업데이트와 별개로) deletedSubTasks에 새 항목이
    // 추가되는 별도의 updateTask 호출이 한 번 더 발생함 — 그 시점에 새로 삭제된
    // 세부업무 타입 id들을 골라내, 연결된 지원팀 업무를 함께 휴지통으로 보냄
    const newlyDeletedTypeIds = (() => {
      if (data.deletedSubTasks === undefined) return [] as string[];
      const before = tasks.find(t => t.id === id)?.deletedSubTasks ?? {};
      return Object.keys(data.deletedSubTasks).filter(k => !(k in before));
    })();
    const touchesDeletedSubTasks = newlyDeletedTypeIds.length > 0;
    if (!touchesAssigneeOrStatus && !touchesSubTaskData && !touchesBaseInfo && !touchesDeletedSubTasks) return;

    // 1) 이 업무 자신이 지원팀에서 자동 생성된 연결 업무라면 → 담당자/상태를 원본
    //    업무의 해당 세부업무 항목에 반영
    if (touchesAssigneeOrStatus) {
      const self = tasks.find(t => t.id === id);
      if (self?.linkedFromTaskId && self.linkedFromSubTaskTypeId) {
        const patch: Record<string, unknown> = {};
        if (data.assignee !== undefined) patch[`subTaskData.${self.linkedFromSubTaskTypeId}.assignee`] = data.assignee;
        if (data.status !== undefined) patch[`subTaskData.${self.linkedFromSubTaskTypeId}.status`] = data.status;
        await updateDoc(doc(db, 'tasks', self.linkedFromTaskId), { ...patch, updatedAt: now });
      }
    }

    // 2) 이 업무가 원본이라면 → 연결된 지원팀 업무(들)에 기본 정보(제목/월/기간)와
    //    해당 세부업무의 담당자/상태를 반영. 세부업무 자체가 삭제됐다면 그 세부업무에
    //    대응하는 지원팀 업무는 더 이상 할 일이 없는 것이므로 함께 휴지통으로 보냄
    if (touchesSubTaskData || touchesBaseInfo || touchesDeletedSubTasks) {
      const linkedSnap = await getDocs(query(collection(db, 'tasks'), where('linkedFromTaskId', '==', id)));
      if (linkedSnap.empty) return;
      const batch = writeBatch(db);
      let any = false;
      linkedSnap.forEach(d => {
        const linked = d.data() as Task;
        if (touchesDeletedSubTasks && linked.linkedFromSubTaskTypeId && newlyDeletedTypeIds.includes(linked.linkedFromSubTaskTypeId) && !linked.deletedAt) {
          any = true;
          batch.update(d.ref, { deletedAt: now, deletedBy: '(원본 세부업무 삭제로 자동 이동)', updatedAt: now });
          return;
        }
        const patch: Record<string, unknown> = {};
        if (touchesBaseInfo) {
          (['title', 'taskMonth', 'startDate', 'endDate'] as const).forEach(k => {
            if (k in data) patch[k] = data[k];
          });
        }
        if (touchesSubTaskData && linked.linkedFromSubTaskTypeId) {
          const entry = data.subTaskData?.[linked.linkedFromSubTaskTypeId];
          if (entry) {
            if (entry.assignee !== undefined) patch.assignee = entry.assignee;
            if (entry.status !== undefined) patch.status = entry.status;
          }
        }
        if (Object.keys(patch).length > 0) { any = true; batch.update(d.ref, { ...patch, updatedAt: now }); }
      });
      if (any) await batch.commit();
    }
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
