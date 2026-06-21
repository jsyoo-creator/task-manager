import { useMemo } from 'react';
import type { Task, SubTask, TaskStatus, TaskCategory, Member, TeamPart, CustomHoliday } from '../types';
import CategoryTabs from '../components/CategoryTabs';
import { usePublicHolidays } from '../hooks/usePublicHolidays';

interface Props {
  tasks: Task[];
  subtasks: SubTask[];
  members: Member[];
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  parts?: TeamPart[];
  userPhotoMap?: Map<string, string>;
  customHolidays?: CustomHoliday[];
}

const TW_TO_HEX: Record<string, string> = {
  'bg-red-500': '#ef4444', 'bg-orange-400': '#fb923c', 'bg-yellow-400': '#facc15',
  'bg-green-500': '#22c55e', 'bg-teal-500': '#14b8a6', 'bg-blue-500': '#3b82f6',
  'bg-indigo-500': '#6366f1', 'bg-purple-500': '#a855f7', 'bg-pink-500': '#ec4899',
  'bg-gray-400': '#9ca3af',
};

const DEFAULT_STATUS: Record<string, { bg: string; text: string }> = {
  '진행 전': { bg: '#dbeafe', text: '#2563eb' },
  '진행 중': { bg: '#fef3c7', text: '#d97706' },
  '완료':   { bg: '#dcfce7', text: '#16a34a' },
  '보류':   { bg: '#e2e8f0', text: '#475569' },
};

function StatusPill({ status }: { status: TaskStatus | string }) {
  const s = DEFAULT_STATUS[status] ?? { bg: '#f3f4f6', text: '#6b7280' };
  return (
    <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {status}
    </span>
  );
}

const DAY_NAMES = ['월', '화', '수', '목', '금'];

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekNum = Math.ceil((now.getDate() + firstOfMonth.getDay()) / 7);
  // 월~금 날짜 배열
  const weekdays = DAY_NAMES.map((name, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return { name, date: d.getDate(), month: d.getMonth() + 1, isToday: d.toDateString() === now.toDateString() };
  });
  return { start: mon, end: sun, weekNum, now, weekdays };
}

function toDate(str: string) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 태스크 시작일 기준 상대 주차를 계산해 해당 주의 시간 합산
function getSubWeekHours(sub: SubTask, currentWeekMonday: Date): number {
  if (!sub.startDate) return 0;
  const taskStart = toDate(sub.startDate);
  const dow = taskStart.getDay();
  const taskMonday = new Date(taskStart);
  taskMonday.setDate(taskStart.getDate() - (dow === 0 ? 6 : dow - 1));
  taskMonday.setHours(0, 0, 0, 0);
  const diffWeeks = Math.round((currentWeekMonday.getTime() - taskMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks < 0) return 0;
  const relWeek = diffWeeks + 1;
  return [1, 2, 3, 4, 5].reduce((sum, d) => sum + (sub.weeklyHours?.[`w${relWeek}d${d}`] ?? 0), 0);
}

export default function WeeklyPage({ tasks, subtasks, activeCategory, onCategoryChange, parts, userPhotoMap, customHolidays = [] }: Props) {
  const { start, end, weekNum, now, weekdays } = useMemo(getWeekBounds, []);
  const { holidays: publicHolidays } = usePublicHolidays(now.getFullYear());
  const weekLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${weekNum}주차`;

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    publicHolidays.forEach(h => map.set(h.date, h.name));
    customHolidays.forEach(h => map.set(h.date, h.name));
    return map;
  }, [publicHolidays, customHolidays]);

  // 이번 주 평일 중 공휴일 수 → 목표시간 조정 (40h - 휴일수 × 8h)
  const weekHolidayCount = useMemo(() =>
    weekdays.filter(({ month, date }) =>
      holidayMap.has(`${now.getFullYear()}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`)
    ).length,
  [weekdays, holidayMap, now]);
  const targetH = 40 - weekHolidayCount * 8;

  const partColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    parts?.forEach(p => { map[p.name] = TW_TO_HEX[p.color] ?? '#9ca3af'; });
    return map;
  }, [parts]);

  const partColor = (cat: string) => partColorMap[cat] ?? '#9ca3af';

  const inRange = (sd: string, ed?: string) => {
    if (!sd) return false;
    const s = toDate(sd);
    const e = ed ? toDate(ed) : s;
    return s <= end && e >= start;
  };

  const filtered = useMemo(() =>
    tasks.filter(t => activeCategory === 'all' || t.category === activeCategory),
    [tasks, activeCategory]
  );

  const weekTasks = useMemo(() =>
    filtered.filter(t => inRange(t.startDate, t.endDate)),
    [filtered, start, end]
  );

  const weekSubtasks = useMemo(() => {
    const taskIdSet = new Set(weekTasks.map(t => t.id));
    return subtasks.filter(s => {
      if (!taskIdSet.has(s.taskId)) return false;
      // 세부업무에 날짜가 있으면 이번 주와 겹치는지 확인, 없으면 부모 업무 날짜 기준
      if (s.startDate) return inRange(s.startDate, s.endDate || s.startDate);
      const parent = weekTasks.find(t => t.id === s.taskId);
      return parent ? inRange(parent.startDate, parent.endDate) : false;
    });
  }, [subtasks, weekTasks, start, end]);

  const personData = useMemo(() => {
    const people = [...new Set(weekSubtasks.map(s => s.assignee).filter(Boolean))].sort();

    return people.map(person => {
      const mySubs = weekSubtasks.filter(s => s.assignee === person);
      const taskIds = [...new Set(mySubs.map(s => s.taskId))];

      const groups = taskIds
        .map(taskId => {
          const task = weekTasks.find(t => t.id === taskId);
          if (!task) return null;
          const subs = mySubs.filter(s => s.taskId === taskId);
          const taskH = subs.reduce((sum, s) => sum + getSubWeekHours(s, start), 0);
          return { task, subs, taskH };
        })
        .filter((g): g is { task: Task; subs: SubTask[]; taskH: number } => g !== null);

      const totalH = groups.reduce((sum, g) => sum + g.taskH, 0);
      return { person, groups, totalH };
    }).filter(p => p.groups.length > 0);
  }, [weekSubtasks, weekTasks, start]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="page-title">위클리</h1>
            <p className="page-subtitle">{weekLabel}</p>
          </div>
          {/* 월~금 날짜 카드 */}
          <div className="flex gap-1.5">
            {weekdays.map(({ name, date, month, isToday }) => {
              const dateStr = `${now.getFullYear()}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
              const holidayName = holidayMap.get(dateStr) ?? null;
              return (
                <div key={name} title={holidayName ?? undefined}
                  className={`flex flex-col items-center w-[46px] py-1.5 rounded-xl border text-center ${
                    isToday
                      ? 'border-[#5B5BD6] bg-[#5B5BD6]/8'
                      : holidayName
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}>
                  <span className={`text-[10px] font-medium leading-none mb-1 ${
                    isToday ? 'text-[#5B5BD6]' : holidayName ? 'text-red-400' : 'text-gray-400'
                  }`}>{name}</span>
                  <span className={`text-sm font-bold leading-none ${
                    isToday ? 'text-[#5B5BD6]' : holidayName ? 'text-red-500' : 'text-gray-700'
                  }`}>{month}/{date}</span>
                  {holidayName && (
                    <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <CategoryTabs active={activeCategory} onChange={onCategoryChange} parts={parts} />
      </div>

      {personData.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center h-36 gap-2">
          <span className="text-sm text-gray-400">이번 주 등록된 업무 없음</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {personData.map(({ person, groups, totalH }) => (
            <div key={person} className="glass-card overflow-hidden">

              {/* 담당자 헤더 */}
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                {userPhotoMap?.get(person) ? (
                  <img src={userPhotoMap.get(person)} alt={person}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {person.slice(0, 1)}
                  </div>
                )}
                <span className="text-sm font-bold text-gray-800 flex-1">{person}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{groups.length}개 업무</span>
                  {totalH > 0 && (
                    <>
                      <span className="text-gray-200">·</span>
                      <span className="text-sm font-bold text-indigo-600">{totalH}h</span>
                      <span className="text-xs text-gray-300">/ {targetH}h</span>
                      {totalH < targetH && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 border border-amber-200">미달</span>
                      )}
                      {totalH === targetH && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">정상</span>
                      )}
                      {totalH > targetH && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">초과</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 업무 그룹 — 가로 분할 */}
              <div className="grid divide-x divide-gray-100"
                style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 3)}, 1fr)` }}>
                {groups.map(({ task, subs, taskH }) => (
                  <div key={task.id} className="p-4">

                    {/* 메인업무 */}
                    <div className="flex items-start gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: partColor(task.category) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 leading-snug">
                          {task.title}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{task.category}</p>
                      </div>
                      {taskH > 0 && (
                        <span className="text-xs font-bold text-indigo-500 flex-shrink-0 mt-0.5">{taskH}h</span>
                      )}
                    </div>

                    {/* 세부업무 */}
                    <div className="space-y-2 pl-4 border-l-2 border-gray-100">
                      {subs.map(s => {
                        const h = getSubWeekHours(s, start);
                        return (
                          <div key={s.id} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 flex-1 truncate">{s.title}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {h > 0 && (
                                <span className="text-[11px] font-semibold text-gray-400">{h}h</span>
                              )}
                              <StatusPill status={s.status} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
