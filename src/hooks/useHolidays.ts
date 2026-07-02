import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CustomHoliday } from '../types';

export function useHolidays(workplaceId?: string) {
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workplaceId) {
      setCustomHolidays([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'config', `holidays_${workplaceId}`), snap => {
      setCustomHolidays(snap.data()?.customHolidays ?? []);
      setLoading(false);
    });
    return unsub;
  }, [workplaceId]);

  const updateHolidays = async (holidays: CustomHoliday[]) => {
    if (!workplaceId) return;
    await setDoc(doc(db, 'config', `holidays_${workplaceId}`), { customHolidays: holidays });
  };

  return { customHolidays, loading, updateHolidays };
}
