import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, TaskCategory, TeamPart } from '../types';
import CategoryTabs from '../components/CategoryTabs';

interface Props {
  tasks: Task[];
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  parts?: TeamPart[];
}

const CAT_STYLE: Record<string, { pill: string; dot: string }> = {
  '라이브': { pill: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  '복지': { pill: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400', dot: 'bg-orange-400' },
  '사업자': { pill: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  '기타': { pill: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/50', dot: 'bg-gray-400' },
};

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage({ tasks, activeCategory, onCategoryChange, parts }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const filtered = useMemo(() =>
    tasks.filter(t => activeCategory === 'all' || t.category === activeCategory),
    [tasks, activeCategory]
  );

  const tasksForDay = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filtered.filter(t => !t.startDate ? false : t.startDate <= d && (t.endDate ?? t.startDate) >= d);
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
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-black/40 dark:text-white/40 hover:bg-black/6 dark:hover:bg-white/8 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-black/70 dark:text-white/70 w-14 text-center">{month + 1}월</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-black/40 dark:text-white/40 hover:bg-black/6 dark:hover:bg-white/8 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

    <div className="glass-card">
      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-black/4 dark:border-white/6">
        {DAYS.map((d, i) => (
          <div key={d} className={`text-center py-2 text-xs font-medium ${
            i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500 dark:text-white/40'
          }`}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const dayTasks = day ? tasksForDay(day) : [];
          const isWknd = idx % 7 === 0 || idx % 7 === 6;
          return (
            <div key={idx} className={`min-h-[88px] border-r border-b border-black/3 dark:border-white/5 p-1.5 ${
              !day ? 'bg-black/1 dark:bg-white/1' : ''
            } ${isWknd && day ? 'bg-black/1.5 dark:bg-white/2' : ''}`}>
              {day && (
                <>
                  <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-medium mb-1 ${
                    isToday(day)
                      ? 'bg-blue-500 text-white shadow-[0_1px_6px_rgba(38,112,233,0.4)]'
                      : isWknd ? 'text-gray-400 dark:text-white/30' : 'text-gray-700 dark:text-white/60'
                  }`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(t => {
                      const s = CAT_STYLE[t.category] ?? CAT_STYLE['기타'];
                      return (
                        <div key={t.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate ${s.pill}`}>
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${s.dot}`} />
                          <span className="truncate">{t.title}</span>
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-[9px] text-gray-400 dark:text-white/30 pl-1">+{dayTasks.length - 3}개</div>
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
