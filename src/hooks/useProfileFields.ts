import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ProfileFieldDef } from '../types';

export function useProfileFields() {
  const [profileFields, setProfileFields] = useState<ProfileFieldDef[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'profileFields'),
      snap => setProfileFields(snap.data()?.fields ?? []),
      err => console.error('profileFields:', err)
    );
    return unsub;
  }, []);

  const updateProfileFields = async (fields: ProfileFieldDef[]) => {
    await setDoc(doc(db, 'settings', 'profileFields'), { fields });
  };

  return { profileFields, updateProfileFields };
}
