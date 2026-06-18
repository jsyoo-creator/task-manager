import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Member } from '../types';

export const DEFAULT_MEMBERS: Member[] = [];

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
