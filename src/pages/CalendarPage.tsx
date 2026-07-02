import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Send } from 'lucide-react';
import type { Task, SubTask, TaskCategory, TeamPart, TaskStatus, SubTaskMemo, CustomHoliday, Vacation, VacationType } from '../types';
import CategoryTabs from '../components/CategoryTabs';
import DatePicker from '../components/DatePicker';
import { useHolidayMap } from '../contexts/HolidaysContext';

interface Props {
  tasks: Task[];
  subtasks?: SubTask[];
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  parts?: TeamPart[];
  userPhotoMap?: Map<string, string>;
  onUpdateTask?: (id: string, data: Partial<Task>) => void;
  assignees?: string[];
  assigneesPerSubTaskType?: Map<string, string[]>;
  currentUserName?: string;
  canSeeAll?: boolean;
  customHolidays?: CustomHoliday[];
  vacations?: Vacation[];
  subTaskColorMap?: Map<string, string>; // subtask.id -> 세부업무 유형 지정 캘린더 색상 (hex)
  teamColor?: string; // 팀 기본 색상 (hex)
  subTaskOrderMap?: Map<string, number>; // subtask.id -> 세부업무 유형 정렬 순서 (그룹핑용)
  groupBySubtaskType?: boolean; // true면 하루 셀 안에서 메인업무순 대신 세부업무 유형별로 묶어서 정렬
  mainTaskEndDateShow?: boolean; // 메인업무 종료일 표시 여부 팀 기본값 (undefined = false)
  mainTaskEndDateLabel?: string; // 메인업무 종료일 캘린더 표시 명칭 팀 기본값 (예: '방송일', 비어있으면 '종료일' 사용)
  plShowInCalendar?: boolean; // PL업무를 캘린더에 표시할지 팀 기본값 (undefined = true)
  mainTaskEndDateColor?: string; // 메인업무 종료일 배지 색상 팀 기본값 (hex, 없으면 파트색 자동 사용)
}

function truncateText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function vacTypeColor(type: VacationType): string {
  switch (type) {
    case '연차':      return 'bg-blue-100 text-blue-700';
    case '오전반차':   return 'bg-emerald-100 text-emerald-700';
    case '오전반반차': return 'bg-teal-100 text-teal-700';
    case '오후반차':   return 'bg-amber-100 text-amber-700';
    case '오후반반차': return 'bg-orange-100 text-orange-700';
    default:          return 'bg-gray-100 text-gray-600';
  }
}

const TW_TO_CAT: Record<string, { card: string; title: string; dot: string; hover: string }> = {
  'bg-red-500':    { card: 'bg-red-50',    title: 'text-red-600',    dot: 'bg-red-400',    hover: 'hover:bg-red-100' },
  'bg-orange-400': { card: 'bg-orange-50', title: 'text-orange-600', dot: 'bg-orange-400', hover: 'hover:bg-orange-100' },
  'bg-yellow-400': { card: 'bg-yellow-50', title: 'text-yellow-600', dot: 'bg-yellow-400', hover: 'hover:bg-yellow-100' },
  'bg-green-500':  { card: 'bg-green-50',  title: 'text-green-600',  dot: 'bg-green-500',  hover: 'hover:bg-green-100' },
  'bg-teal-500':   { card: 'bg-teal-50',   title: 'text-teal-600',   dot: 'bg-teal-500',   hover: 'hover:bg-teal-100' },
  'bg-blue-500':   { card: 'bg-blue-50',   title: 'text-blue-600',   dot: 'bg-blue-500',   hover: 'hover:bg-blue-100' },
  'bg-indigo-500': { card: 'bg-indigo-50', title: 'text-indigo-600', dot: 'bg-indigo-500', hover: 'hover:bg-indigo-100' },
  'bg-purple-500': { card: 'bg-purple-50', title: 'text-purple-600', dot: 'bg-purple-500', hover: 'hover:bg-purple-100' },
  'bg-pink-500':   { card: 'bg-pink-50',   title: 'text-pink-600',   dot: 'bg-pink-500',   hover: 'hover:bg-pink-100' },
  'bg-gray-400':   { card: 'bg-gray-50',   title: 'text-gray-600',   dot: 'bg-gray-400',   hover: 'hover:bg-gray-100' },
};
const CAT_DEFAULT = { card: 'bg-gray-50', title: 'text-gray-600', dot: 'bg-gray-400', hover: 'hover:bg-gray-100' };

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];

function Avatar({ name, photoURL, isSubstitute = false }: { name: string; photoURL?: string; isSubstitute?: boolean }) {
  if (photoURL) {
    return <img src={photoURL} alt={name} title={isSubstitute ? `대무자: ${name}` : name} className={`w-6 h-6 rounded-full object-cover ring-2 flex-shrink-0 ${isSubstitute ? 'ring-orange-400' : 'ring-white'}`} />;
  }
  return (
    <div title={isSubstitute ? `대무자: ${name}` : name} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold ring-2 flex-shrink-0 ${isSubstitute ? 'bg-orange-100 text-orange-500 ring-orange-400' : 'bg-gray-200 text-gray-500 ring-white'}`}>
      {name.slice(0, 1)}
    </div>
  );
}

function getWeekTotal(weeklyHours: Record<string, number>, weekNum: number): number {
  return [1, 2, 3, 4, 5].reduce((sum, d) => sum + (weeklyHours[`w${weekNum}d${d}`] ?? 0), 0);
}

interface EditState {
  startDate: string;
  endDate: string;
  assignee: string;
  status: string;
  weekHours: number[];
  weekHoursRaw: string[];
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage({ tasks, subtasks = [], activeCategory, onCategoryChange, parts, userPhotoMap, onUpdateTask, assignees = [], assigneesPerSubTaskType, currentUserName = '', canSeeAll = false, customHolidays = [], vacations = [], subTaskColorMap, teamColor, subTaskOrderMap, groupBySubtaskType = false, mainTaskEndDateShow, mainTaskEndDateLabel, mainTaskEndDateColor, plShowInCalendar }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const holidayMap = useHolidayMap();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSubKey, setExpandedSubKey] = useState('');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [newMemoText, setNewMemoText] = useState('');

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const partStyleMap = useMemo(() => {
    const map = new Map<string, { card: string; title: string; dot: string; hover: string }>();
    parts?.forEach(p => { map.set(p.name, TW_TO_CAT[p.color] ?? CAT_DEFAULT); });
    return map;
  }, [parts]);

  const partMap = useMemo(() => new Map((parts ?? []).map(p => [p.name, p])), [parts]);

  const resolvePLShowInCalendar = (category: string): boolean => {
    const part = partMap.get(category);
    return part?.plShowInCalendar !== undefined ? part.plShowInCalendar : (plShowInCalendar ?? true);
  };

  // 메인업무 종료일 표시 여부/명칭을 파트별 재정의 → 팀 기본값 순으로 해석. 꺼져 있으면 null.
  const resolveEndDateLabel = (category: string): string | null => {
    const part = partMap.get(category);
    const show = part?.mainTaskEndDateShow !== undefined ? part.mainTaskEndDateShow : (mainTaskEndDateShow ?? false);
    if (!show) return null;
    const label = part?.mainTaskEndDateLabel !== undefined ? part.mainTaskEndDateLabel : (mainTaskEndDateLabel ?? '');
    return label || '종료일';
  };

  const resolveEndDateColor = (category: string): string | undefined => {
    const part = partMap.get(category);
    const color = part?.mainTaskEndDateColor !== undefined ? part.mainTaskEndDateColor : (mainTaskEndDateColor ?? '');
    return color || undefined;
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const filteredSubtasks = useMemo(() =>
    subtasks.filter(s => {
      if (!s.endDate) return false;
      if (activeCategory !== 'all' && s.category !== activeCategory) return false;
      if (canSeeAll) return true;
      if (s.assignee === currentUserName) return true;
      const [, subKey] = s.id.split('__');
      const substitute = taskMap.get(s.taskId)?.subTaskData?.[subKey]?.substitute;
      return substitute === currentUserName;
    }),
    [subtasks, activeCategory, canSeeAll, currentUserName, taskMap]
  );

  const itemsForDay = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const items = filteredSubtasks
      .filter(s => s.endDate === d)
      .map(s => {
        const parent = taskMap.get(s.taskId);
        const [, subKey] = s.id.split('__');
        const people = [s.receiver, s.assignee].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
        const memoCount = parent?.subTaskData?.[subKey]?.memos?.length ?? 0;
        const substitute = parent?.subTaskData?.[subKey]?.substitute || undefined;
        return { id: s.id, mainTitle: parent?.title ?? '', subTitle: s.title, people, substitute, category: s.category, status: s.status, memoCount };
      });
    if (!groupBySubtaskType || !subTaskOrderMap) return items;
    // 세부업무 유형 순서대로 묶어서 정렬 (동일 유형 내에서는 원래(메인업무) 순서 유지 - stable sort)
    return [...items].sort((a, b) => (subTaskOrderMap.get(a.id) ?? 999) - (subTaskOrderMap.get(b.id) ?? 999));
  };

  const isToday = (d: number) =>
    year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  const getHolidayName = (d: number): string | null => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return holidayMap.get(key) ?? null;
  };

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const vacDay = useMemo(() => {
    const map: Record<string, Vacation[]> = {};
    const toDs = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    vacations.forEach(v => {
      const spanDays = v.type === '연차' ? Math.max(1, Math.ceil(v.days)) : 1;
      if (spanDays <= 1) {
        if (v.date.startsWith(monthPrefix)) map[v.date] = [...(map[v.date] ?? []), v];
        return;
      }
      let found = 0;
      const cur = new Date(v.date + 'T00:00:00');
      let safety = 0;
      while (found < spanDays && safety++ < 365) {
        const dow = cur.getDay();
        const ds = toDs(cur);
        if (dow !== 0 && dow !== 6 && !holidayMap.has(ds)) {
          if (ds.startsWith(monthPrefix)) map[ds] = [...(map[ds] ?? []), v];
          found++;
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [vacations, monthPrefix, holidayMap]);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleCardClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (itemId.split('__').length > 2) return; // review 개별 항목은 캘린더에서 편집 불가
    if (expandedId === itemId) {
      setExpandedId(null);
      setExpandedSubKey('');
      setEditState(null);
      return;
    }
    const [taskId, subKey] = itemId.split('__');
    const task = taskMap.get(taskId);
    const entry = task?.subTaskData?.[subKey] ?? {};
    const wh = [1, 2, 3, 4, 5].map(w => getWeekTotal(entry.weeklyHours ?? {}, w));
    setEditState({
      startDate: entry.startDate ?? '',
      endDate: entry.endDate ?? '',
      assignee: entry.assignee ?? '',
      status: entry.status ?? '진행 전',
      weekHours: wh,
      weekHoursRaw: wh.map(v => v === 0 ? '' : String(v)),
    });
    setExpandedSubKey(subKey);
    setExpandedId(itemId);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expandedId || !editState || !onUpdateTask) return;
    const [taskId, subKey] = expandedId.split('__');
    const task = taskMap.get(taskId);
    if (!task) return;
    const newWeeklyHours: Record<string, number> = {};
    editState.weekHours.forEach((total, wi) => {
      [1, 2, 3, 4, 5].forEach(d => { newWeeklyHours[`w${wi + 1}d${d}`] = d === 1 ? total : 0; });
    });
    onUpdateTask(taskId, {
      subTaskData: {
        ...task.subTaskData,
        [subKey]: {
          ...task.subTaskData?.[subKey],
          startDate: editState.startDate,
          endDate: editState.endDate,
          assignee: editState.assignee,
          status: editState.status,
          weeklyHours: newWeeklyHours,
          totalHours: editState.weekHours.reduce((a, b) => a + b, 0),
        },
      },
    });
    setExpandedId(null);
    setExpandedSubKey('');
    setEditState(null);
  };

  const handleAddMemo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newMemoText.trim() || !expandedId || !onUpdateTask) return;
    const [taskId, subKey] = expandedId.split('__');
    const task = taskMap.get(taskId);
    if (!task) return;
    const prevMemos: SubTaskMemo[] = task.subTaskData?.[subKey]?.memos ?? [];
    const newMemo: SubTaskMemo = {
      id: `m_${Date.now()}`,
      text: newMemoText.trim(),
      author: currentUserName,
      createdAt: new Date().toISOString(),
    };
    const entry = task.subTaskData?.[subKey] ?? { weeklyHours: {}, totalHours: 0 };
    onUpdateTask(taskId, {
      subTaskData: { ...task.subTaskData, [subKey]: { ...entry, memos: [...prevMemos, newMemo] } },
    });
    setNewMemoText('');
  };

  const handleDeleteMemo = (memoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expandedId || !onUpdateTask) return;
    const [taskId, subKey] = expandedId.split('__');
    const task = taskMap.get(taskId);
    if (!task) return;
    const entry = task.subTaskData?.[subKey] ?? { weeklyHours: {}, totalHours: 0 };
    const filtered = (entry.memos ?? []).filter(m => m.id !== memoId);
    onUpdateTask(taskId, {
      subTaskData: { ...task.subTaskData, [subKey]: { ...entry, memos: filtered } },
    });
  };

  const inp = 'w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1 text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#6C63FF]/40';
  const lbl = 'block text-[9px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wide';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">캘린더</h1>
          <p className="page-subtitle">{year}년 {month + 1}월 업무 일정</p>
        </div>
        <div className="flex items-center gap-3">
          <CategoryTabs active={activeCategory} onChange={onCategoryChange} parts={parts} />
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-gray-700 w-14 text-center">{month + 1}월</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="grid border-b border-black/4" style={{ gridTemplateColumns: '0.5fr 1fr 1fr 1fr 1fr 1fr 0.5fr' }}>
          {DAYS.map((d, i) => (
            <div key={d} className={`text-center py-2 text-xs font-medium ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
            }`}>{d}</div>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: '0.5fr 1fr 1fr 1fr 1fr 1fr 0.5fr' }}>
          {cells.map((day, idx) => {
            const dayItems = day ? itemsForDay(day) : [];
            const isWknd = idx % 7 === 0 || idx % 7 === 6;
            const flipMemo = idx % 7 >= 5; // 금/토요일은 메모 패널을 왼쪽으로
            const holidayName = day ? getHolidayName(day) : null;
            return (
              <div key={idx} className={`min-h-[96px] border-r border-b border-black/3 p-1.5 ${
                !day ? 'bg-black/1' : ''
              } ${isWknd && day ? 'bg-black/1.5' : ''} ${holidayName && !isWknd ? 'bg-red-50/40' : ''}`}>
                {day && (
                  <>
                    <div className="mb-1">
                      <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-medium ${
                        isToday(day)
                          ? 'bg-blue-500 text-white shadow-[0_1px_6px_rgba(38,112,233,0.4)]'
                          : holidayName ? 'text-red-500 font-semibold' : isWknd ? 'text-gray-400' : 'text-gray-700'
                      }`}>{day}</div>
                      {holidayName && (
                        <p className="text-[9px] leading-tight text-red-400 truncate mt-0.5" title={holidayName}>{holidayName}</p>
                      )}
                    </div>
                    {(() => {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayVacs = vacDay[dateStr] ?? [];
                      if (dayVacs.length === 0) return null;
                      return (
                        <div className="flex flex-col gap-0.5 mb-1">
                          {dayVacs.map(v => (
                            <div key={v.id} className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate ${vacTypeColor(v.type)}`}>
                              <span className="truncate">{v.memberName} {v.type}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {(() => {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const badges = tasks
                        .filter(t => t.endDate === dateStr)
                        .filter(t => activeCategory === 'all' || t.category === activeCategory)
                        .filter(t => canSeeAll || t.assignee === currentUserName || t.receiver === currentUserName)
                        .filter(t => !t.plTask || resolvePLShowInCalendar(t.category))
                        .map(t => {
                          const label = resolveEndDateLabel(t.category);
                          if (!label) return null;
                          const s = partStyleMap.get(t.category) ?? CAT_DEFAULT;
                          const color = resolveEndDateColor(t.category);
                          return { id: t.id, title: t.title, label, s, color };
                        })
                        .filter((b): b is { id: string; title: string; label: string; s: typeof CAT_DEFAULT; color?: string } => !!b);
                      if (badges.length === 0) return null;
                      return (
                        <div className="flex flex-col gap-0.5 mb-1">
                          {badges.map(b => {
                            const badgeStyle = b.color ? { backgroundColor: hexToRgba(b.color, 0.14) } : undefined;
                            const textStyle = b.color ? { color: b.color } : undefined;
                            return (
                              <div key={b.id} title={`${b.title}: ${b.label}`} style={badgeStyle}
                                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight truncate ${b.color ? '' : `${b.s.card} ${b.s.title}`}`}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${b.color ? '' : b.s.dot}`} style={b.color ? { backgroundColor: b.color } : undefined} />
                                <span className="truncate" style={textStyle}>{truncateText(b.title, 14)}</span>
                                <span className="truncate font-normal opacity-60" style={textStyle}>· {b.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div className="space-y-1.5">
                      {dayItems.map(item => {
                        const hasPartStyle = partStyleMap.has(item.category);
                        const s = partStyleMap.get(item.category) ?? CAT_DEFAULT;
                        const calColor = subTaskColorMap?.get(item.id);
                        const customBg = calColor ?? (!hasPartStyle ? teamColor : undefined);
                        const cardStyle = customBg ? { backgroundColor: hexToRgba(customBg, 0.14) } : undefined;
                        const isActive = expandedId === item.id;
                        const isDone = item.status === '완료';
                        const activeMemos = isActive
                          ? (() => { const [tid, sk] = item.id.split('__'); return taskMap.get(tid)?.subTaskData?.[sk]?.memos ?? []; })()
                          : [];
                        return (
                          <div
                            key={item.id}
                            className={`relative transition-all duration-200 ${isActive ? 'z-20' : 'rounded-xl z-0'}`}
                          >
                          {/* 카드 + 메모 패널 전체를 감싸는 ring 오버레이 */}
                          {isActive && (
                            <div
                              className={`absolute pointer-events-none ring-2 ring-[#6C63FF]/40 ${flipMemo ? 'rounded-l-2xl rounded-r-xl' : 'rounded-l-xl rounded-r-2xl'}`}
                              style={flipMemo
                                ? { top: 0, bottom: 0, left: '-176px', right: 0, zIndex: 30 }
                                : { top: 0, bottom: 0, left: 0, right: '-176px', zIndex: 30 }}
                            />
                          )}
                          <div
                            onClick={e => handleCardClick(e, item.id)}
                            style={cardStyle}
                            className={`p-2.5 flex flex-col gap-1 cursor-pointer select-none relative
                              ${customBg ? '' : s.card}
                              ${isDone && !isActive ? 'opacity-40' : ''}
                              ${isActive
                                ? 'rounded-xl shadow-lg z-10'
                                : `rounded-xl ${customBg ? '' : s.hover} hover:shadow-md hover:scale-[1.01]`}
                            `}
                          >
                            {/* 요약 */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <div className="text-[10px] text-gray-400 font-medium leading-tight truncate" title={item.mainTitle}>{truncateText(item.mainTitle, 19)}</div>
                                <div className={`text-[11px] font-bold leading-snug flex items-center gap-1 ${s.title}`}>
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} title={item.category} />
                                  <span className="truncate" title={item.subTitle}>{truncateText(item.subTitle, 17)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                                {item.memoCount > 0 && !isActive && (
                                  <div className="flex items-center gap-0.5 bg-[#6C63FF] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                                    <MessageCircle size={8} />
                                    <span>{item.memoCount}</span>
                                  </div>
                                )}
                                {(item.people.length > 0 || item.substitute) && (
                                  <div className="flex flex-row -space-x-1.5">
                                    {item.people.map(name => (
                                      <Avatar key={name} name={name} photoURL={userPhotoMap?.get(name)} />
                                    ))}
                                    {item.substitute && (
                                      <Avatar name={item.substitute} photoURL={userPhotoMap?.get(item.substitute)} isSubstitute />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 인라인 편집 폼 */}
                            {isActive && editState && (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="mt-2 pt-2.5 border-t border-black/8 flex flex-col gap-2"
                              >
                                {/* 날짜 */}
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className={lbl}>시작일</label>
                                    <DatePicker
                                      value={editState.startDate}
                                      onChange={v => setEditState(st => st && ({ ...st, startDate: v }))}
                                      btnClassName={inp}
                                    />
                                  </div>
                                  <div>
                                    <label className={lbl}>종료일</label>
                                    <DatePicker
                                      value={editState.endDate}
                                      onChange={v => setEditState(st => st && ({ ...st, endDate: v }))}
                                      btnClassName={inp}
                                    />
                                  </div>
                                </div>

                                {/* 담당자 */}
                                <div>
                                  <label className={lbl}>담당자</label>
                                  <select
                                    className={inp}
                                    value={editState.assignee}
                                    onChange={e => setEditState(st => st && ({ ...st, assignee: e.target.value }))}
                                  >
                                    <option value="">선택</option>
                                    {(assigneesPerSubTaskType?.get(expandedSubKey) ?? assignees).map(a => <option key={a}>{a}</option>)}
                                  </select>
                                </div>

                                {/* 상태 */}
                                <div>
                                  <label className={lbl}>상태</label>
                                  <select
                                    className={inp}
                                    value={editState.status}
                                    onChange={e => setEditState(st => st && ({ ...st, status: e.target.value }))}
                                  >
                                    {STATUSES.map(st => <option key={st}>{st}</option>)}
                                  </select>
                                </div>

                                {/* 주차별 업무시간 */}
                                <div>
                                  <label className={lbl}>주차별 업무시간 (h)</label>
                                  <div className="grid grid-cols-5 gap-1">
                                    {editState.weekHoursRaw.map((raw, i) => (
                                      <div key={i} className="flex flex-col items-center gap-0.5">
                                        <span className="text-[9px] text-gray-400">{i + 1}주</span>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          className="w-full rounded-md border border-black/10 bg-white/80 px-1 py-1 text-[11px] text-center text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#6C63FF]/40"
                                          value={raw}
                                          placeholder="0"
                                          onChange={e => {
                                            const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                            const newRaw = [...editState.weekHoursRaw];
                                            newRaw[i] = v;
                                            const newNums = [...editState.weekHours];
                                            newNums[i] = parseFloat(v) || 0;
                                            setEditState(st => st && ({ ...st, weekHoursRaw: newRaw, weekHours: newNums }));
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[9px] text-gray-400 mt-0.5 text-right">
                                    합계 {editState.weekHours.reduce((a, b) => a + b, 0)}h
                                  </p>
                                </div>

                                {/* 저장 / 취소 */}
                                <div className="flex gap-1.5 mt-1">
                                  <button
                                    onClick={e => { e.stopPropagation(); setExpandedId(null); setExpandedSubKey(''); setEditState(null); }}
                                    className="flex-1 py-1.5 rounded-lg border border-black/10 text-[11px] text-gray-500 hover:bg-black/5 transition-colors"
                                  >취소</button>
                                  <button
                                    onClick={handleSave}
                                    className="flex-1 py-1.5 rounded-lg bg-[#6C63FF] text-white text-[11px] font-semibold hover:bg-[#5b53e6] transition-colors"
                                  >저장</button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 우측 메모 패널 */}
                          {isActive && (
                            <div
                              onClick={e => e.stopPropagation()}
                              className={`absolute top-0 bg-gray-900 shadow-lg z-0 flex flex-col ${flipMemo ? 'rounded-l-2xl' : 'rounded-r-2xl'}`}
                              style={flipMemo
                                ? { right: 'calc(100% - 10px)', paddingRight: '10px', minHeight: '100%', width: '186px' }
                                : { left: 'calc(100% - 10px)', paddingLeft: '10px', minHeight: '100%', width: '186px' }}
                            >
                              <div className="px-3 pt-3 pb-2 border-b border-white/8">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                  <MessageCircle size={10} />코멘트
                                  {activeMemos.length > 0 && (
                                    <span className="ml-auto bg-white/10 text-gray-300 rounded-full px-1.5 text-[9px]">{activeMemos.length}</span>
                                  )}
                                </p>
                              </div>

                              <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2 max-h-64">
                                {activeMemos.length === 0 ? (
                                  <p className="text-[10px] text-gray-600 text-center py-4">코멘트가 없습니다</p>
                                ) : (
                                  activeMemos.map(memo => (
                                    <div key={memo.id} className="group bg-white/6 rounded-xl p-2">
                                      <p className="text-[11px] text-gray-200 leading-snug whitespace-pre-wrap">{memo.text}</p>
                                      <div className="flex items-center justify-between mt-1.5">
                                        <p className="text-[9px] text-gray-500">{memo.author} · {memo.createdAt.slice(0,10)}</p>
                                        <button
                                          onClick={e => handleDeleteMemo(memo.id, e)}
                                          className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-[9px]"
                                        >삭제</button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="px-2.5 py-2.5 border-t border-white/8">
                                <div className="flex items-center gap-1.5">
                                  <textarea
                                    rows={1}
                                    value={newMemoText}
                                    onChange={e => setNewMemoText(e.target.value)}
                                    placeholder="코멘트 입력..."
                                    className="flex-1 resize-none rounded-xl bg-white/8 text-white text-[11px] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20 placeholder-gray-600 leading-snug"
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddMemo(e as unknown as React.MouseEvent); } }}
                                  />
                                  <button
                                    onClick={handleAddMemo}
                                    disabled={!newMemoText.trim()}
                                    className="w-7 h-7 flex items-center justify-center rounded-xl bg-[#6C63FF] text-white disabled:opacity-30 hover:bg-[#5b53e6] transition-colors flex-shrink-0"
                                  >
                                    <Send size={11} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
