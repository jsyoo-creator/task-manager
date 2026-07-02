import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Vacation } from '../types';

export function useVacations(workplaceId?: string) {
  const [vacations, setVacations] = useState<Vacation[]>([]);

  useEffect(() => {
    if (!workplaceId) {
      setVacations([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'vacations'), where('workplaceId', '==', workplaceId)),
      snap => setVacations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vacation))),
      err => console.error('vacations:', err)
    );
    return unsub;
  }, [workplaceId]);

  const addVacation = async (data: Omit<Vacation, 'id' | 'createdAt' | 'workplaceId'>) => {
    if (!workplaceId) throw new Error('워크플레이스가 지정되지 않았습니다');
    await addDoc(collection(db, 'vacations'), { ...data, workplaceId, createdAt: new Date().toISOString() });
  };

  const deleteVacation = async (id: string) => {
    await deleteDoc(doc(db, 'vacations', id));
  };

  return { vacations, addVacation, deleteVacation };
}
