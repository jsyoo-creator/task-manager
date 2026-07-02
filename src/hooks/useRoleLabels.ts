import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { RoleLabels } from '../types';

export function useRoleLabels(workplaceId?: string) {
  const [roleLabels, setRoleLabels] = useState<RoleLabels>({});

  useEffect(() => {
    if (!workplaceId) {
      setRoleLabels({});
      return;
    }
    const unsub = onSnapshot(doc(db, 'settings', `roleLabels_${workplaceId}`), snap => {
      setRoleLabels(snap.exists() ? (snap.data() as RoleLabels) : {});
    });
    return unsub;
  }, [workplaceId]);

  const updateRoleLabels = async (labels: RoleLabels) => {
    if (!workplaceId) return;
    await setDoc(doc(db, 'settings', `roleLabels_${workplaceId}`), labels);
  };

  return { roleLabels, updateRoleLabels };
}
