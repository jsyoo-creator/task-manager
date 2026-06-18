import { useState, useEffect } from 'react';
import {
  doc, getDoc, setDoc, collection, getDocs, updateDoc, onSnapshot, query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from 'firebase/auth';
import type { AppUser, UserRole } from '../types';

export function useUserRole(firebaseUser: User | null) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) { setAppUser(null); setLoading(false); return; }

    const ref = doc(db, 'users', firebaseUser.uid);

    const init = async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        // 첫 사용자 → 최고 관리자
        const allSnap = await getDocs(collection(db, 'users'));
        const role: UserRole = allSnap.empty ? 'superadmin' : 'user';
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
    };

    init().catch(console.error);

    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setAppUser(snap.data() as AppUser);
      }
      setLoading(false);
    });

    return unsub;
  }, [firebaseUser?.uid]);

  const updateDisplayName = async (name: string) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), { displayName: name });
  };

  return { appUser, loading, updateDisplayName };
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

  return { users, updateUserRole };
}
