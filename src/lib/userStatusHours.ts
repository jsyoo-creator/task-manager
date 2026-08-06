// 어드민 "사용자 현황" 탭 전용 계산 유틸.
// SubTask.weeklyHours(w{상대주차}d{1~5})를 임의의 캘린더 주(월요일 기준)에 대해
// 요일별 시간으로 환산한다. WeeklyPage.tsx와 같은 계산식이지만, 위클리는 "이번 주" 1개만
// 다루는 반면 여기서는 특정 월의 여러 주를 순회해야 해서 별도 모듈로 분리했다.
import type { SubTask } from '../types';

export function toDate(str: string) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 부동소수점 합산 오차(예: 1.3899999999999997) 제거
export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function getWeekMonday(date: Date) {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

// 세부업무 자신의 시작일 기준 상대 주차를 계산해, 주어진 캘린더 주(월요일)의 월~금 시간 배열 반환
export function getDailyHoursForWeek(sub: SubTask, weekMonday: Date, useSubstitute = false): number[] {
  if (!sub.startDate) return [0, 0, 0, 0, 0];
  const taskMonday = getWeekMonday(toDate(sub.startDate));
  const diffWeeks = Math.round((weekMonday.getTime() - taskMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks < 0) return [0, 0, 0, 0, 0];
  const relWeek = diffWeeks + 1;
  const hours = useSubstitute ? (sub.substituteWeeklyHours ?? {}) : sub.weeklyHours;
  return [1, 2, 3, 4, 5].map(d => round2(hours[`w${relWeek}d${d}`] ?? 0));
}

export interface MonthWeek {
  weekMonday: Date;
  label: string;      // "1주차"
  rangeLabel: string;  // "8/3~8/7"
}

// 해당 연/월에 걸치는 주(월요일 기준) 목록 — 1일이 속한 주를 1주차로 시작
export function getWeeksInMonth(year: number, monthIndex0: number): MonthWeek[] {
  const firstMonday = getWeekMonday(new Date(year, monthIndex0, 1));
  const lastMonday = getWeekMonday(new Date(year, monthIndex0 + 1, 0));
  const weeks: MonthWeek[] = [];
  const cursor = new Date(firstMonday);
  let idx = 1;
  while (cursor.getTime() <= lastMonday.getTime()) {
    const fri = new Date(cursor);
    fri.setDate(cursor.getDate() + 4);
    weeks.push({
      weekMonday: new Date(cursor),
      label: `${idx}주차`,
      rangeLabel: `${cursor.getMonth() + 1}/${cursor.getDate()}~${fri.getMonth() + 1}/${fri.getDate()}`,
    });
    cursor.setDate(cursor.getDate() + 7);
    idx++;
  }
  return weeks;
}
