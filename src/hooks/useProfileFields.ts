import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ProfileFieldDef } from '../types';

export function useProfileFields(workplaceId?: string) {
  const [profileFields, setProfileFields] = useState<ProfileFieldDef[]>([]);

  useEffect(() => {
    if (!workplaceId) {
      setProfileFields([]);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'settings', `profileFields_${workplaceId}`),
      snap => setProfileFields(snap.data()?.fields ?? []),
      err => console.error('profileFields:', err)
    );
    return unsub;
  }, [workplaceId]);

  const updateProfileFields = async (fields: ProfileFieldDef[]) => {
    if (!workplaceId) return;
    await setDoc(doc(db, 'settings', `profileFields_${workplaceId}`), { fields });
  };

  return { profileFields, updateProfileFields };
}
