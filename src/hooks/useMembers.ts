import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Member } from '../types';

export const DEFAULT_MEMBERS: Member[] = [
  { id: '', name: '유재성 PL', role: 'PL', seatId: 'F9', area: 'F', color: 'purple', weeklyTarget: 40, createdAt: '' },
  { id: '', name: '윤혜림 님', role: '님', seatId: 'F7', area: 'F', color: 'purple', weeklyTarget: 40, createdAt: '' },
  { id: '', name: '탁세현 님', role: '님', seatId: 'F6', area: 'F', color: 'purple', weeklyTarget: 40, createdAt: '' },
  { id: '', name: '김도은 님', role: '님', seatId: 'F2', area: 'F', color: 'blue', weeklyTarget: 40, createdAt: '' },
  { id: '', name: '윤다영 님', role: '님', seatId: 'F4', area: 'F', color: 'blue', weeklyTarget: 40, createdAt: '' },
  { id: '', name: '정소희 PL', role: 'PL', seatId: 'F8', area: 'F', color: 'purple', weeklyTarget: 40, createdAt: '' },
  { id: '', name: '한수진 님', role: '님', seatId: 'F5', area: 'F', color: 'blue', weeklyTarget: 40, createdAt: '' },
  { id: '', name: '고아현 님', role: '님', seatId: 'F3', area: 'F', color: 'blue', weeklyTarget: 40, createdAt: '' },
  { id: '', name: '김동주 님', role: '님', seatId: 'F1', area: 'F', color: 'blue', weeklyTarget: 40, createdAt: '' },
];

export function useMembers() {
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'members')),
      snap => {
        if (snap.docs.length > 0) {
          setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
        }
      },
      err => console.error('members:', err)
    );
    return unsub;
  }, []);

  return { members };
}
