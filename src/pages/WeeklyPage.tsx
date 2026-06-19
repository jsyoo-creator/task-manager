import { useMemo } from 'react';
import type { Task, SubTask, TaskCategory, Member, TeamPart } from '../types';
import CategoryTabs from '../components/CategoryTabs';

interface Props {
  tasks: Task[];
  subtasks: SubTask[];
  members: Member[];
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  parts?: TeamPart[];
}

const CAT_PILL: Record<string, string> = {
  '라이브': 'bg-red-100 text-red-700 border-red-200',
  '복지': 'bg-orange-100 text-orange-700 border-orange-200',
  '사업자': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  '기타': 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_CLS: Record<string, string> = {
  '진행 전': 'text-blue-500',
  '진행 중': 'text-amber-500',
  '완료': 'text-green-500',
  '보류': 'text-slate-400',
};

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
  return { start: mon, end: sun, weekNum, now };
}

function toDate(str: string) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function WeeklyPage({ tasks, subtasks, members, activeCategory, onCategoryChange, parts }: Props) {
  const { start, end, weekNum, now } = useMemo(getWeekBounds, []);
  const weekKey = `week${weekNum}`;
  const weekLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${weekNum}주차`;

  const filtered = useMemo(() =>
    tasks.filter(t => activeCategory === 'all' || t.category === activeCategory),
    [tasks, activeCategory]
  );

  const memberStats = useMemo(() => members.map(member => {
    const inRange = (sd: string, ed?: string) => {
      if (!sd) return false;
      const s = toDate(sd);
      const e = ed ? toDate(ed) : s;
      return s <= end && e >= start;
    };
    const myTasks = filtered.filter(t => t.assignee === member.name && inRange(t.startDate, t.endDate));
    const mySubs = subtasks.filter(s => s.assignee === member.name && inRange(s.startDate, s.endDate));
    const weekHours =
      myTasks.reduce((a, t) => a + (t.weeklyHours?.[weekKey] ?? 0), 0) +
      mySubs.reduce((a, s) => a + (s.weeklyHours?.[weekKey] ?? 0), 0);
    return { member, myTasks, mySubs, weekHours };
  }), [members, filtered, subtasks, start, end, weekKey]);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title">위클리</h1>
          <p className="page-subtitle">{weekLabel} · {start.getMonth() + 1}/{start.getDate()} – {end.getMonth() + 1}/{end.getDate()}</p>
        </div>
        <CategoryTabs active={activeCategory} onChange={onCategoryChange} parts={parts} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {memberStats.map(({ member, myTasks, mySubs, weekHours }) => {
          const target = member.weeklyTarget ?? 40;
          const pct = Math.min(100, Math.round((weekHours / target) * 100));
          const isShort = weekHours < target;
          const isPL = member.role === 'PL';

          return (
            <div key={member.name} className="glass-card">
              {/* Member header */}
              <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${
                    isPL ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-blue-400 to-blue-500'
                  }`}>
                    {member.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{member.name}</p>
                    <p className="text-[10px] text-gray-400">{member.seatId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-sm font-bold text-gray-800">{weekHours}h</span>
                    <span className="text-xs text-gray-400">/ {target}h</span>
                    {isShort && (
                      <span className="text-[9px] font-semibold bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full border border-red-200">부족</span>
                    )}
                  </div>
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 ml-auto">
                    <div className={`h-1.5 rounded-full transition-all ${isShort ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>

              {/* Task list */}
              <div className="p-3 space-y-1.5 max-h-52 overflow-y-auto">
                {myTasks.length === 0 && mySubs.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-4">이번 주 업무 없음</p>
                ) : (
                  <>
                    {myTasks.map(t => (
                      <div key={t.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border text-xs ${CAT_PILL[t.category] ?? CAT_PILL['기타']}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{t.title}</p>
                          <p className={`text-[10px] mt-0.5 ${STATUS_CLS[t.status]}`}>{t.status}</p>
                        </div>
                        {(t.weeklyHours?.[weekKey] ?? 0) > 0 && (
                          <span className="text-[10px] font-semibold opacity-70 flex-shrink-0">{t.weeklyHours?.[weekKey]}h</span>
                        )}
                      </div>
                    ))}
                    {mySubs.map(s => (
                      <div key={s.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border text-xs opacity-80 ${CAT_PILL[s.category] ?? CAT_PILL['기타']}`}>
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{s.title}</p>
                          <p className={`text-[10px] mt-0.5 ${STATUS_CLS[s.status]}`}>{s.status}</p>
                        </div>
                        {(s.weeklyHours?.[weekKey] ?? 0) > 0 && (
                          <span className="text-[10px] font-semibold opacity-70 flex-shrink-0">{s.weeklyHours?.[weekKey]}h</span>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
