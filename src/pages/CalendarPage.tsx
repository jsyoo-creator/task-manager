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
  userPhotoMap?: Map<string, string>;
}

const CAT_STYLE: Record<string, { card: string; title: string; dot: string }> = {
  '라이브': { card: 'bg-red-50',    title: 'text-red-600',    dot: 'bg-red-400' },
  '복지':   { card: 'bg-orange-50', title: 'text-orange-600', dot: 'bg-orange-400' },
  '사업자': { card: 'bg-indigo-50', title: 'text-indigo-600', dot: 'bg-indigo-400' },
  '기타':   { card: 'bg-gray-50',   title: 'text-gray-600',   dot: 'bg-gray-400' },
};

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function Avatar({ name, photoURL }: { name: string; photoURL?: string }) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        title={name}
        className="w-6 h-6 rounded-full object-cover ring-2 ring-white flex-shrink-0"
      />
    );
  }
  return (
    <div
      title={name}
      className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-semibold text-gray-500 ring-2 ring-white flex-shrink-0"
    >
      {name.slice(0, 1)}
    </div>
  );
}

export default function CalendarPage({ tasks, subtasks = [], activeCategory, onCategoryChange, parts, userPhotoMap }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

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
                        return (
                          <div key={item.id} className={`rounded-xl p-3 mb-1.5 flex flex-col gap-2 ${s.card}`}>
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
    </div>
  );
}
