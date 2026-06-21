import { createContext, useContext } from 'react';

// date(YYYY-MM-DD) → name
export const HolidaysContext = createContext<Map<string, string>>(new Map());

export function useHolidayMap() {
  return useContext(HolidaysContext);
}
