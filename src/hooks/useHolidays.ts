import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CustomHoliday } from '../types';

export function useHolidays() {
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'holidays'), snap => {
      setCustomHolidays(snap.data()?.customHolidays ?? []);
      setLoading(false);
    });
    return unsub;
  }, []);

  const updateHolidays = async (holidays: CustomHoliday[]) => {
    await setDoc(doc(db, 'config', 'holidays'), { customHolidays: holidays });
  };

  return { customHolidays, loading, updateHolidays };
}
