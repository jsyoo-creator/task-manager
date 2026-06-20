import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Task, SubTask, TaskCategory, TeamPart, TaskStatus } from '../types';
import CategoryTabs from '../components/CategoryTabs';

interface Props {
  tasks: Task[];
  subtasks?: SubTask[];
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  parts?: TeamPart[];
  userPhotoMap?: Map<string, string>;
  onUpdateTask?: (id: string, data: Partial<Task>) => void;
  assignees?: string[];
}

const CAT_STYLE: Record<string, { card: string; title: string; dot: string; hover: string }> = {
  '라이브': { card: 'bg-red-50',    title: 'text-red-600',    dot: 'bg-red-400',    hover: 'hover:bg-red-100' },
  '복지':   { card: 'bg-orange-50', title: 'text-orange-600', dot: 'bg-orange-400', hover: 'hover:bg-orange-100' },
  '사업자': { card: 'bg-indigo-50', title: 'text-indigo-600', dot: 'bg-indigo-400', hover: 'hover:bg-indigo-100' },
  '기타':   { card: 'bg-gray-50',   title: 'text-gray-600',   dot: 'bg-gray-400',   hover: 'hover:bg-gray-100' },
};

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];

function Avatar({ name, photoURL }: { name: string; photoURL?: string }) {
  if (photoURL) {
    return <img src={photoURL} alt={name} title={name} className="w-6 h-6 rounded-full object-cover ring-2 ring-white flex-shrink-0" />;
  }
  return (
    <div title={name} className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-semibold text-gray-500 ring-2 ring-white flex-shrink-0">
      {name.slice(0, 1)}
    </div>
  );
}

function getWeekTotal(weeklyHours: Record<string, number>, weekNum: number): number {
  return [1,2,3,4,5].reduce((sum, d) => sum + (weeklyHours[`w${weekNum}d${d}`] ?? 0), 0);
}

interface PopoverProps {
  subId: string;
  subTitle: string;
  taskMap: Map<string, Task>;
  assignees: string[];
  rect: DOMRect;
  onClose: () => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  userPhotoMap?: Map<string, string>;
}

function SubTaskPopover({ subId, subTitle, taskMap, assignees, rect, onClose, onUpdateTask, userPhotoMap }: PopoverProps) {
  const [taskId, subKey] = subId.split('__');
  const task = taskMap.get(taskId);
  const entry = task?.subTaskData?.[subKey] ?? {};

  const [startDate, setStartDate] = useState(entry.startDate ?? '');
  const [endDate, setEndDate] = useState(entry.endDate ?? '');
  const [assignee, setAssignee] = useState(entry.assignee ?? '');
  const [status, setStatus] = useState<string>(entry.status ?? '진행 전');
  const [weekHours, setWeekHours] = useState<number[]>(
    [1,2,3,4,5].map(w => getWeekTotal(entry.weeklyHours ?? {}, w))
  );

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSave = () => {
    if (!task) return;
    const newWeeklyHours: Record<string, number> = {};
    weekHours.forEach((total, wi) => {
      [1,2,3,4,5].forEach(d => { newWeeklyHours[`w${wi+1}d${d}`] = d === 1 ? total : 0; });
    });
    const totalHours = weekHours.reduce((a, b) => a + b, 0);
    onUpdateTask(taskId, {
      subTaskData: {
        ...task.subTaskData,
        [subKey]: { ...entry, startDate, endDate, assignee, status, weeklyHours: newWeeklyHours, totalHours },
      },
    });
    onClose();
  };

  const inp = "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30";
  const lbl = "block text-[10px] font-semibold text-gray-400 mb-1";

  const W = 320;
  const H_EST = 520;
  const GAP = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.left;
  let top = rect.bottom + GAP;
  if (left + W > vw - GAP) left = vw - W - GAP;
  if (left < GAP) left = GAP;
  if (top + H_EST > vh - GAP) top = Math.max(GAP, rect.top - H_EST - GAP);

  return createPortal(
    <div className="fixed inset-0 z-[200]" onClick={onClose}>
    <div
      ref={ref}
      className="absolute rounded-2xl bg-white border border-black/8 shadow-2xl p-4 flex flex-col gap-3"
      style={{ left, top, width: W }}
      onClick={e => e.stopPropagation()}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] text-gray-400 truncate">{task?.title ?? ''}</p>
          <p className="text-sm font-bold text-gray-800">{subTitle}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
          <X size={14} />
        </button>
      </div>

      {/* 날짜 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>시작일</label>
          <input type="date" className={inp} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>종료일</label>
          <input type="date" className={inp} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* 담당자 */}
      <div>
        <label className={lbl}>담당자</label>
        <select className={inp} value={assignee} onChange={e => setAssignee(e.target.value)}>
          <option value="">선택</option>
          {assignees.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* 상태 */}
      <div>
        <label className={lbl}>상태</label>
        <select className={inp} value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* 주차별 업무시간 */}
      <div>
        <label className={lbl}>주차별 업무시간 (h)</label>
        <div className="grid grid-cols-5 gap-1">
          {weekHours.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-gray-400">{i+1}주</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-md border border-black/10 bg-white px-1 py-1 text-xs text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30"
                value={h || ''}
                placeholder="0"
                onChange={e => {
                  const next = [...weekHours];
                  next[i] = Number(e.target.value) || 0;
                  setWeekHours(next);
                }}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-right">
          합계 {weekHours.reduce((a, b) => a + b, 0)}h
        </p>
      </div>

      {/* 담당자 아바타 미리보기 */}
      {assignee && userPhotoMap && (
        <div className="flex items-center gap-1.5">
          <Avatar name={assignee} photoURL={userPhotoMap.get(assignee)} />
          <span className="text-xs text-gray-500">{assignee}</span>
        </div>
      )}

      {/* 저장 */}
      <button
        onClick={handleSave}
        className="w-full py-2 rounded-xl bg-[#6C63FF] text-white text-xs font-semibold hover:bg-[#5b53e6] transition-colors"
      >
        저장
      </button>
    </div>
    </div>,
    document.body
  );
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage({ tasks, subtasks = [], activeCategory, onCategoryChange, parts, userPhotoMap, onUpdateTask, assignees = [] }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedRect, setExpandedRect] = useState<DOMRect | null>(null);
  const [expandedSubTitle, setExpandedSubTitle] = useState('');

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const filteredSubtasks = useMemo(() =>
    subtasks.filter(s => s.endDate && (activeCategory === 'all' || s.category === activeCategory)),
    [subtasks, activeCategory]
  );

  const itemsForDay = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredSubtasks
      .filter(s => s.endDate === d)
      .map(s => {
        const parent = taskMap.get(s.taskId);
        const people = [s.receiver, s.assignee].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
        return { id: s.id, mainTitle: parent?.title ?? '', subTitle: s.title, people, category: s.category };
      });
  };

  const isToday = (d: number) =>
    year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>, id: string, subTitle: string) => {
    e.stopPropagation();
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedRect(e.currentTarget.getBoundingClientRect());
    setExpandedSubTitle(subTitle);
    setExpandedId(id);
  };

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
            return (
              <div key={idx} className={`min-h-[96px] border-r border-b border-black/3 p-1.5 ${
                !day ? 'bg-black/1' : ''
              } ${isWknd && day ? 'bg-black/1.5' : ''}`}>
                {day && (
                  <>
                    <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-medium mb-1 ${
                      isToday(day)
                        ? 'bg-blue-500 text-white shadow-[0_1px_6px_rgba(38,112,233,0.4)]'
                        : isWknd ? 'text-gray-400' : 'text-gray-700'
                    }`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayItems.map(item => {
                        const s = CAT_STYLE[item.category] ?? CAT_STYLE['기타'];
                        const isActive = expandedId === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={e => handleCardClick(e, item.id, item.subTitle)}
                            className={`rounded-xl p-3 mb-1.5 flex flex-col gap-2 cursor-pointer transition-all duration-150 select-none
                              ${s.card} ${s.hover}
                              ${isActive ? 'ring-2 ring-[#6C63FF]/40 shadow-md scale-[1.02]' : 'hover:shadow-md hover:scale-[1.01]'}
                            `}
                          >
                            <div className="text-[10px] text-gray-400 font-medium leading-tight truncate">{item.mainTitle}</div>
                            <div className={`text-[12px] font-bold leading-snug ${s.title}`}>{item.subTitle}</div>
                            {item.people.length > 0 && (
                              <div className="flex items-center -space-x-1.5 mt-0.5">
                                {item.people.map(name => (
                                  <Avatar key={name} name={name} photoURL={userPhotoMap?.get(name)} />
                                ))}
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

      {/* 팝오버 */}
      {expandedId && expandedRect && onUpdateTask && (
        <SubTaskPopover
          subId={expandedId}
          subTitle={expandedSubTitle}
          taskMap={taskMap}
          assignees={assignees}
          rect={expandedRect}
          onClose={() => setExpandedId(null)}
          onUpdateTask={onUpdateTask}
          userPhotoMap={userPhotoMap}
        />
      )}
    </div>
  );
}
