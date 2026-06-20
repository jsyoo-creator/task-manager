import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, SubTask, TaskCategory, TeamPart } from '../types';
import CategoryTabs from '../components/CategoryTabs';

interface Props {
  tasks: Task[];
  subtasks?: SubTask[];
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  parts?: TeamPart[];
}

const CAT_STYLE: Record<string, { pill: string; dot: string }> = {
  '라이브': { pill: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  '복지': { pill: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  '사업자': { pill: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  '기타': { pill: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
};

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage({ tasks, subtasks = [], activeCategory, onCategoryChange, parts }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<'main' | 'sub'>('sub');

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const filteredTasks = useMemo(() =>
    tasks.filter(t => activeCategory === 'all' || t.category === activeCategory),
    [tasks, activeCategory]
  );

  const filteredSubtasks = useMemo(() =>
    subtasks.filter(s => s.endDate && (activeCategory === 'all' || s.category === activeCategory)),
    [subtasks, activeCategory]
  );

  const itemsForDay = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (viewMode === 'main') {
      return filteredTasks
        .filter(t => t.startDate && t.startDate <= d && (t.endDate ?? t.startDate) >= d)
        .map(t => ({ id: t.id, label: t.title, subLabel: '', category: t.category }));
    }
    return filteredSubtasks
      .filter(s => s.endDate === d)
      .map(s => {
        const parent = taskMap.get(s.taskId);
        return { id: s.id, label: parent?.title ?? s.title, subLabel: s.title, category: s.category };
      });
  };

  const isToday = (d: number) =>
    year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">캘린더</h1>
          <p className="page-subtitle">{year}년 {month + 1}월 업무 일정</p>
        </div>
        <div className="flex items-center gap-3">
          <CategoryTabs active={activeCategory} onChange={onCategoryChange} parts={parts} />

          {/* 뷰 모드 토글 */}
          <div className="flex items-center rounded-lg border border-black/8 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setViewMode('main')}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'main' ? 'bg-[#6C63FF] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              메인업무
            </button>
            <button
              onClick={() => setViewMode('sub')}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'sub' ? 'bg-[#6C63FF] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              세부업무
            </button>
          </div>

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
      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-black/4">
        {DAYS.map((d, i) => (
          <div key={d} className={`text-center py-2 text-xs font-medium ${
            i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
          }`}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const dayItems = day ? itemsForDay(day) : [];
          const isWknd = idx % 7 === 0 || idx % 7 === 6;
          return (
            <div key={idx} className={`min-h-[88px] border-r border-b border-black/3 p-1.5 ${
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
                    {dayItems.slice(0, 3).map(item => {
                      const s = CAT_STYLE[item.category] ?? CAT_STYLE['기타'];
                      return (
                        <div
                          key={item.id}
                          title={item.subLabel ? `${item.label} · ${item.subLabel}` : item.label}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate ${s.pill}`}>
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${s.dot}`} />
                          <span className="truncate">{item.label}</span>
                          {item.subLabel && (
                            <span className="truncate opacity-60 flex-shrink-0">· {item.subLabel}</span>
                          )}
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <div className="text-[9px] text-gray-400 pl-1">+{dayItems.length - 3}개</div>
                    )}
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
