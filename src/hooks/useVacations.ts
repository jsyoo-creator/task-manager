import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Vacation } from '../types';

export function useVacations() {
  const [vacations, setVacations] = useState<Vacation[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'vacations')),
      snap => setVacations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vacation))),
      err => console.error('vacations:', err)
    );
    return unsub;
  }, []);

  const addVacation = async (data: Omit<Vacation, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'vacations'), { ...data, createdAt: new Date().toISOString() });
  };

  const deleteVacation = async (id: string) => {
    await deleteDoc(doc(db, 'vacations', id));
  };

  return { vacations, addVacation, deleteVacation };
}
