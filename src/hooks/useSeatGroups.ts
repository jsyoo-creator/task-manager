import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SeatGroup } from '../types';

export function useSeatGroups(workplaceId?: string) {
  const [groups, setGroups] = useState<SeatGroup[]>([]);

  useEffect(() => {
    if (!workplaceId) {
      setGroups([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'seatGroups'), where('workplaceId', '==', workplaceId)),
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as SeatGroup));
        data.sort((a, b) => a.order - b.order);
        setGroups(data);
      },
      err => console.error('seatGroups:', err)
    );
    return unsub;
  }, [workplaceId]);

  const addGroup = async (data: Omit<SeatGroup, 'id' | 'createdAt' | 'workplaceId'>) => {
    if (!workplaceId) throw new Error('워크플레이스가 지정되지 않았습니다');
    await addDoc(collection(db, 'seatGroups'), { ...data, workplaceId, createdAt: new Date().toISOString() });
  };

  const updateGroup = async (id: string, data: Partial<Omit<SeatGroup, 'id' | 'createdAt'>>) => {
    await updateDoc(doc(db, 'seatGroups', id), data);
  };

  const deleteGroup = async (id: string) => {
    await deleteDoc(doc(db, 'seatGroups', id));
  };

  return { groups, addGroup, updateGroup, deleteGroup };
}
