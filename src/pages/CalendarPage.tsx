import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, TaskCategory } from '../types';

interface Props {
  tasks: Task[];
  activeCategory: TaskCategory | 'all';
}

const CAT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  '라이브': { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  '복지': { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  '사업자': { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  '기타': { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage({ tasks, activeCategory }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const filtered = useMemo(() => tasks.filter(t =>
    activeCategory === 'all' || t.category === activeCategory
  ), [tasks, activeCategory]);

  const tasksForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filtered.filter(t => {
      if (!t.startDate || !t.endDate) return t.startDate === dateStr;
      return t.startDate <= dateStr && t.endDate >= dateStr;
    });
  };

  const isToday = (day: number) =>
    year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-gray-800">
          {year}년 {month + 1}월
        </h2>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAYS.map((d, i) => (
          <div key={d} className={`text-center py-2 text-xs font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const dayTasks = day ? tasksForDay(day) : [];
          const isWeekend = idx % 7 === 0 || idx % 7 === 6;
          return (
            <div
              key={idx}
              className={`min-h-[90px] border-r border-b border-gray-50 p-1.5 ${!day ? 'bg-gray-50/30' : ''} ${isWeekend && day ? 'bg-gray-50/40' : ''}`}
            >
              {day && (
                <>
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${
                    isToday(day)
                      ? 'bg-blue-500 text-white'
                      : isWeekend
                      ? 'text-gray-400'
                      : 'text-gray-700'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(t => {
                      const c = CAT_COLORS[t.category] ?? CAT_COLORS['기타'];
                      return (
                        <div key={t.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${c.bg} ${c.text}`}>
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${c.dot}`} />
                          <span className="truncate">{t.title}</span>
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-[9px] text-gray-400 pl-1">+{dayTasks.length - 3}개 더보기</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
