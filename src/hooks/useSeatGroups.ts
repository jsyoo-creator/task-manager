import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SeatGroup } from '../types';

export function useSeatGroups() {
  const [groups, setGroups] = useState<SeatGroup[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'seatGroups')),
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as SeatGroup));
        data.sort((a, b) => a.order - b.order);
        setGroups(data);
      },
      err => console.error('seatGroups:', err)
    );
    return unsub;
  }, []);

  const addGroup = async (data: Omit<SeatGroup, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'seatGroups'), { ...data, createdAt: new Date().toISOString() });
  };

  const updateGroup = async (id: string, data: Partial<Omit<SeatGroup, 'id' | 'createdAt'>>) => {
    await updateDoc(doc(db, 'seatGroups', id), data);
  };

  const deleteGroup = async (id: string) => {
    await deleteDoc(doc(db, 'seatGroups', id));
  };

  return { groups, addGroup, updateGroup, deleteGroup };
}
