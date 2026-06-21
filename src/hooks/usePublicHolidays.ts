import { useState, useEffect } from 'react';

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

const cache = new Map<number, PublicHoliday[]>();

export function usePublicHolidays(year: number) {
  const [holidays, setHolidays] = useState<PublicHoliday[]>(cache.get(year) ?? []);
  const [loading, setLoading] = useState(!cache.has(year));

  useEffect(() => {
    if (cache.has(year)) {
      setHolidays(cache.get(year)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/korean-holidays?year=${year}`)
      .then(r => r.json())
      .then(data => {
        const list: PublicHoliday[] = data.holidays ?? [];
        cache.set(year, list);
        setHolidays(list);
      })
      .catch(() => setHolidays([]))
      .finally(() => setLoading(false));
  }, [year]);

  return { holidays, loading };
}
