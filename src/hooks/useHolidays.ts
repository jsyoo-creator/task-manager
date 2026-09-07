import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CustomHoliday } from '../types';

export function useHolidays(workplaceId?: string) {
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [removedPublicHolidays, setRemovedPublicHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workplaceId) {
      setCustomHolidays([]);
      setRemovedPublicHolidays([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'config', `holidays_${workplaceId}`), snap => {
      setCustomHolidays(snap.data()?.customHolidays ?? []);
      setRemovedPublicHolidays(snap.data()?.removedPublicHolidays ?? []);
      setLoading(false);
    });
    return unsub;
  }, [workplaceId]);

  const updateHolidayConfig = async (updates: { customHolidays?: CustomHoliday[]; removedPublicHolidays?: string[] }) => {
    if (!workplaceId) return;
    await setDoc(doc(db, 'config', `holidays_${workplaceId}`), updates, { merge: true });
  };

  return { customHolidays, removedPublicHolidays, loading, updateHolidayConfig };
}
