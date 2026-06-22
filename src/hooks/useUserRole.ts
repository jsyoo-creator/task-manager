import { useState, useEffect } from 'react';
import {
  doc, getDoc, setDoc, collection, getDocs, updateDoc, onSnapshot, query, deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from 'firebase/auth';
import type { AppUser, UserRole, Department } from '../types';

function migrateAppUser(raw: Record<string, unknown>): AppUser {
  const data = { ...raw } as AppUser & { selectedTeamId?: string };
  if (!data.selectedTeamIds && data.selectedTeamId) {
    data.selectedTeamIds = [data.selectedTeamId];
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
        let role: UserRole = 'superadmin';
        try {
          const allSnap = await getDocs(collection(db, 'users'));
          role = allSnap.empty ? 'superadmin' : 'user';
        } catch {
          role = 'superadmin'; // 첫 접근 실패 시 최고관리자로
        }
        const data: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? '',
          photoURL: firebaseUser.photoURL ?? '',
          role,
          createdAt: new Date().toISOString(),
        };
        await setDoc(ref, data);
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

  return { appUser, loading, updateDisplayName, updateDepartment, updateSelectedTeams, updateDefaultTeam };
}

export function useAllUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'users')), snap => {
      setUsers(snap.docs.map(d => d.data() as AppUser));
    });
    return unsub;
  }, []);

  const updateUserRole = async (uid: string, role: UserRole) => {
    await updateDoc(doc(db, 'users', uid), { role });
  };

  const updateUserInfo = async (uid: string, data: { displayName?: string; department?: Department; selectedTeamIds?: string[]; annualLeave?: number; defaultTeamId?: string | null }) => {
    const { defaultTeamId, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if ('defaultTeamId' in data) {
      payload.defaultTeamId = defaultTeamId ?? deleteField();
    }
    await updateDoc(doc(db, 'users', uid), payload);
  };

  return { users, updateUserRole, updateUserInfo };
}
