import { useState, useEffect } from 'react';
import {
  doc, getDoc, setDoc, collection, getDocs, updateDoc, onSnapshot, query, where, writeBatch, deleteField, deleteDoc,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from 'firebase/auth';
import type { AppUser, UserRole, Department } from '../types';

function migrateAppUser(raw: Record<string, unknown>): AppUser {
  const data = { ...raw } as AppUser & { selectedTeamId?: string };
  if (!data.selectedTeamIds && data.selectedTeamId) {
    data.selectedTeamIds = [data.selectedTeamId];
  }
  // 과거 단일 workplaceId 데이터를 다중 배정 배열로 런타임 보정 (Firestore 백필은 App.tsx 마이그레이션이 담당)
  if (!data.workplaceIds && data.workplaceId) {
    data.workplaceIds = [data.workplaceId];
  }
  return data as AppUser;
}

export function useUserRole(firebaseUser: User | null) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) { setAppUser(null); setLoading(false); return; }

    const ref = doc(db, 'users', firebaseUser.uid);
    let unsub: (() => void) | undefined;

    const init = async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        // 근무지 도입 이후: 신규 사용자는 미배정 상태(workplaceId 없음)로 생성되고
        // 플랫폼 관리자가 어드민 페이지에서 근무지·역할을 배정할 때까지 대기한다.
        const data: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? '',
          photoURL: firebaseUser.photoURL ?? '',
          role: 'user',
          createdAt: new Date().toISOString(),
        };
        await setDoc(ref, data);
      } else {
        const existing = snap.data() as AppUser;
        if (firebaseUser.photoURL && existing.photoURL !== firebaseUser.photoURL) {
          await updateDoc(ref, { photoURL: firebaseUser.photoURL });
        }
      }

      unsub = onSnapshot(
        ref,
        s => {
          if (s.exists()) setAppUser(migrateAppUser(s.data() as Record<string, unknown>));
          setLoading(false);
        },
        err => {
          console.error('useUserRole onSnapshot error:', err);
          setLoading(false);
        }
      );
    };

    init().catch(err => {
      console.error('useUserRole init error:', err);
      setLoading(false);
    });

    return () => unsub?.();
  }, [firebaseUser?.uid]);

  const updateDisplayName = async (name: string) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), { displayName: name });
  };

  const updateDepartment = async (department: Department) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), { department });
  };

  const updateSelectedTeams = async (teamIds: string[]) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      selectedTeamIds: teamIds,
      selectedTeamId: deleteField(),
    });
  };

  const updateDefaultTeam = async (teamId: string | null) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      defaultTeamId: teamId ?? deleteField(),
    });
  };

  // 근무지가 여러 개 배정된 사용자가 로그인 시 자동으로 들어갈 기본 근무지 설정
  const updateDefaultWorkplace = async (workplaceId: string | null) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      defaultWorkplaceId: workplaceId ?? deleteField(),
    });
  };

  return { appUser, loading, updateDisplayName, updateDepartment, updateSelectedTeams, updateDefaultTeam, updateDefaultWorkplace };
}

// workplaceId를 넘기면 그 근무지에 배정된(다중 배정 포함) 사용자만, 생략하면(플랫폼 관리자 전용) 전체 사용자를 가져온다.
export function useAllUsers(workplaceId?: string) {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const q = workplaceId
      ? query(collection(db, 'users'), where('workplaceIds', 'array-contains', workplaceId))
      : query(collection(db, 'users'));
    const unsub = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => migrateAppUser(d.data() as Record<string, unknown>)));
    });
    return unsub;
  }, [workplaceId]);

  const updateUserRole = async (uid: string, role: UserRole) => {
    await updateDoc(doc(db, 'users', uid), { role });
  };

  // 사용자를 근무지에 추가 배정 (다중 배정 가능, 플랫폼 관리자 전용)
  const addUserWorkplace = async (uid: string, workplaceId: string) => {
    await updateDoc(doc(db, 'users', uid), { workplaceIds: arrayUnion(workplaceId) });
  };

  // 사용자를 특정 근무지 배정에서 제외 (플랫폼 관리자 전용)
  const removeUserWorkplace = async (uid: string, workplaceId: string) => {
    await updateDoc(doc(db, 'users', uid), { workplaceIds: arrayRemove(workplaceId) });
  };

  // 플랫폼 관리자 지정/해제
  const setPlatformAdmin = async (uid: string, value: boolean) => {
    await updateDoc(doc(db, 'users', uid), { isPlatformAdmin: value });
  };

  const updateUserInfo = async (uid: string, data: { displayName?: string; department?: Department; selectedTeamIds?: string[]; annualLeave?: number; defaultTeamId?: string | null; profileData?: Record<string, string> }) => {
    const { defaultTeamId, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if ('defaultTeamId' in data) {
      payload.defaultTeamId = defaultTeamId ?? deleteField();
    }

    // 이름 변경 전에 oldName을 미리 읽어둠
    const oldName = data.displayName ? users.find(u => u.uid === uid)?.displayName : undefined;
    const newName = data.displayName;

    // users 컬렉션 업데이트를 먼저 실행 (이후 배치 실패와 무관하게 저장)
    await updateDoc(doc(db, 'users', uid), payload);

    // 비정규화된 이름 일괄 동기화
    if (oldName && newName && oldName !== newName) {
      try {
        const [vacSnap, postSnap, commentSnap, seatSnap, allTasksSnap] = await Promise.all([
          getDocs(query(collection(db, 'vacations'), where('memberName', '==', oldName))),
          getDocs(query(collection(db, 'posts'), where('authorName', '==', oldName))),
          getDocs(query(collection(db, 'comments'), where('authorName', '==', oldName))),
          getDocs(collection(db, 'seatGroups')),
          getDocs(collection(db, 'tasks')),
        ]);

        type Update = { ref: ReturnType<typeof doc>; data: Record<string, unknown> };
        const updates: Update[] = [
          ...vacSnap.docs.map(d => ({ ref: d.ref, data: { memberName: newName } })),
          ...postSnap.docs.map(d => ({ ref: d.ref, data: { authorName: newName } })),
          ...commentSnap.docs.map(d => ({ ref: d.ref, data: { authorName: newName } })),
        ];

        // seatGroups: seats는 { "r-c": displayName } 형태
        seatSnap.docs.forEach(d => {
          const seats = (d.data().seats ?? {}) as Record<string, string>;
          if (!Object.values(seats).includes(oldName)) return;
          const newSeats = Object.fromEntries(
            Object.entries(seats).map(([k, v]) => [k, v === oldName ? newName : v])
          );
          updates.push({ ref: d.ref, data: { seats: newSeats } });
        });

        // tasks: assignee / receiver / subTaskData 내 assignee·substitute
        allTasksSnap.docs.forEach(d => {
          const t = d.data() as {
            assignee?: string;
            receiver?: string;
            subTaskData?: Record<string, { assignee?: string; substitute?: string; [k: string]: unknown }>;
          };
          const fields: Record<string, unknown> = {};
          if (t.assignee === oldName) fields.assignee = newName;
          if (t.receiver === oldName) fields.receiver = newName;

          const subData = t.subTaskData ?? {};
          let subChanged = false;
          const newSubData = Object.fromEntries(
            Object.entries(subData).map(([key, entry]) => {
              const e = { ...entry };
              if (e.assignee === oldName) { e.assignee = newName; subChanged = true; }
              if (e.substitute === oldName) { e.substitute = newName; subChanged = true; }
              return [key, e];
            })
          );
          if (subChanged) fields.subTaskData = newSubData;

          if (Object.keys(fields).length > 0) updates.push({ ref: d.ref, data: fields });
        });

        const CHUNK = 450;
        for (let i = 0; i < updates.length; i += CHUNK) {
          const b = writeBatch(db);
          updates.slice(i, i + CHUNK).forEach(({ ref, data: u }) => b.update(ref, u));
          await b.commit();
        }
      } catch (e) {
        console.error('이름 동기화 실패:', e);
      }
    }
  };

  const deleteUser = async (uid: string) => {
    await deleteDoc(doc(db, 'users', uid));
  };

  return { users, updateUserRole, updateUserInfo, deleteUser, addUserWorkplace, removeUserWorkplace, setPlatformAdmin };
}
