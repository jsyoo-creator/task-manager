import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import type { Task } from '../types';

// 업무를 '등록 월(taskMonth)' 기준으로 나눠 읽는다 — 2026-10-26 사용자: 업무는 월별로 등록하니
// 지난달 이전 업무는 처음에 안 읽고, 그 달로 페이지를 넘길 때 읽게. (운영 DB 무료 읽기 한도 절약)
// - 처음엔 '지난달 ~ 앞으로 2년'만 읽는다. 첫 화면 대시보드가 지난달·이번달을 비교하고, 위클리·캘린더도
//   지난달에 등록해 이번 달까지 이어지는 업무가 있어서 지난달까지는 기본으로 둔다.
// - 그보다 오래된 달은 페이지가 useNeedTaskMonths(['2026-08'])로 요청할 때 그 달만 따로 읽는다.
// - 휴지통·연도 전체 보기·엑셀 내보내기처럼 전 기간이 필요하면 'all'을 요청 → 예전처럼 전체 읽기.
// - 월 값이 '신규'·'파생'처럼 잘못 들어간 업무(엑셀 가져오기 흔적)도 기본 목록에 함께 넣는다.

export const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  return ymOf(new Date(y, m - 1 + n, 1));
};

const START = ymOf(new Date());
export const BASE_FROM = addMonths(START, -1);   // 기본으로 읽는 첫 달 (지난달)
const BASE_MONTHS = [...Array.from({ length: 24 }, (_, i) => addMonths(BASE_FROM, i)), '신규', '파생'];   // Firestore 'in'은 30개까지

export type TaskMonthNeed = string[] | 'all';
export const DEFAULT_TASK_SCOPE: TaskMonthScope = { all: false, months: [] };
export interface TaskMonthScope { all: boolean; months: string[] }   // months: 기본 범위보다 오래된 달만

/** 기본 범위 밖(지난달보다 이전)의 달만 골라낸다 */
export const olderMonths = (months: string[]) => months.filter(m => /^\d{4}-\d{2}$/.test(m) && m < BASE_FROM);

export const TaskMonthsContext = createContext<(need: TaskMonthNeed) => void>(() => {});

/** 이 화면이 보려는 달(또는 전체)을 알린다 — 아직 안 읽은 달이면 그때 읽는다 */
export function useNeedTaskMonths(need: TaskMonthNeed | null) {
  const request = useContext(TaskMonthsContext);
  const key = need === 'all' ? 'all' : (need ?? []).join(',');
  useEffect(() => { if (need && key) request(need); }, [key, request]);   // eslint-disable-line react-hooks/exhaustive-deps
}

/** App에서 쓰는 요청 모음 — 한 번 요청한 달은 계속 읽는다(왔다 갔다 할 때 다시 읽지 않게) */
export function useTaskMonthScope(): [TaskMonthScope, (need: TaskMonthNeed) => void] {
  const [scope, setScope] = useState<TaskMonthScope>({ all: false, months: [] });
  const request = useRef((need: TaskMonthNeed) => {
    setScope(prev => {
      if (prev.all) return prev;
      if (need === 'all') return { all: true, months: [] };
      const add = olderMonths(need).filter(m => !prev.months.includes(m));
      return add.length ? { all: false, months: [...prev.months, ...add].sort() } : prev;
    });
  }).current;
  return [scope, request];
}

/** field == value 인 업무를 scope에 맞춰 여러 구독으로 나눠 읽고 합친다 */
export function useScopedTasks(field: 'teamId' | 'projectId', value: string, scope: TaskMonthScope, label: string) {
  const [tasks, setTasks] = useState<Task[] | null>(null);   // null = 첫 결과 전
  const parts = useRef(new Map<string, Map<string, Task>>());
  const subs = useRef(new Map<string, Unsubscribe>());

  // 바뀌는 건 값(팀·프로젝트)과 '전체 읽기' 여부 — 그때는 구독을 모두 새로 연다
  useEffect(() => {
    parts.current = new Map(); subs.current = new Map();
    setTasks(null);
    if (!value) { setTasks([]); return; }
    const emit = () => {
      const merged = new Map<string, Task>();
      parts.current.forEach(p => p.forEach((t, id) => merged.set(id, t)));
      setTasks([...merged.values()]);
    };
    const open = (key: string, extra: ReturnType<typeof where> | null) => {
      const q = extra ? query(collection(db, 'tasks'), where(field, '==', value), extra) : query(collection(db, 'tasks'), where(field, '==', value));
      subs.current.set(key, onSnapshot(q,
        snap => {
          parts.current.set(key, new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Task])));
          if (key === 'base' || key === 'all') emit(); else if (parts.current.has('base')) emit();
        },
        err => console.error(`${label}:`, err)));
    };
    if (scope.all) open('all', null);
    else open('base', where('taskMonth', 'in', BASE_MONTHS));
    const cur = subs.current;
    return () => { cur.forEach(u => u()); cur.clear(); };
  }, [field, value, scope.all, label]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 오래된 달은 요청이 올 때마다 그 달만 하나씩 더 연다 (이미 연 달은 그대로)
  useEffect(() => {
    if (!value || scope.all) return;
    scope.months.forEach(m => {
      if (subs.current.has(m)) return;
      subs.current.set(m, onSnapshot(query(collection(db, 'tasks'), where(field, '==', value), where('taskMonth', '==', m)),
        snap => {
          parts.current.set(m, new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Task])));
          if (parts.current.has('base')) {
            const merged = new Map<string, Task>();
            parts.current.forEach(p => p.forEach((t, id) => merged.set(id, t)));
            setTasks([...merged.values()]);
          }
        },
        err => console.error(`${label} ${m}:`, err)));
    });
  }, [field, value, scope.all, scope.months, label]);

  return tasks;
}
