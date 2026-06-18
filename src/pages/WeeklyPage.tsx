import { useMemo } from 'react';
import type { Task, SubTask, TaskCategory } from '../types';
import type { Member } from '../types';

interface Props {
  tasks: Task[];
  subtasks: SubTask[];
  members: Member[];
  activeCategory: TaskCategory | 'all';
}

const CAT_COLORS: Record<string, string> = {
  '라이브': 'bg-red-100 text-red-700 border-red-200',
  '복지': 'bg-orange-100 text-orange-700 border-orange-200',
  '사업자': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  '기타': 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_COLOR: Record<string, string> = {
  '진행 전': 'text-blue-500',
  '진행 중': 'text-amber-500',
  '완료': 'text-green-500',
  '보류': 'text-slate-400',
};

function getWeekBounds(): { start: Date; end: Date; weekNum: number } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekNum = Math.ceil((now.getDate() + firstOfMonth.getDay()) / 7);

  return { start: monday, end: sunday, weekNum };
}

function toDate(str: string) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function WeeklyPage({ tasks, subtasks, members, activeCategory }: Props) {
  const { start, end, weekNum } = useMemo(getWeekBounds, []);

  const now = new Date();
  const weekLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${weekNum}주차`;
  const weekKey = `week${weekNum}` as keyof SubTask['weeklyHours'];

  const filtered = useMemo(() => tasks.filter(t =>
    activeCategory === 'all' || t.category === activeCategory
  ), [tasks, activeCategory]);

  const memberStats = useMemo(() => {
    return members.map(member => {
      const mySubtasks = subtasks.filter(s => {
        if (s.assignee !== member.name) return false;
        if (!s.startDate) return false;
        const sd = toDate(s.startDate);
        const ed = s.endDate ? toDate(s.endDate) : sd;
        return sd <= end && ed >= start;
      });

      const myTasks = filtered.filter(t => {
        if (t.assignee !== member.name) return false;
        if (!t.startDate) return false;
        const sd = toDate(t.startDate);
        const ed = t.endDate ? toDate(t.endDate) : sd;
        return sd <= end && ed >= start;
      });

      const weekHours = mySubtasks.reduce((acc, s) => {
        return acc + (s.weeklyHours?.[weekKey] ?? 0);
      }, 0) + myTasks.reduce((acc, t) => {
        return acc + (t.weeklyHours?.[weekKey] ?? 0);
      }, 0);

      return { member, myTasks, mySubtasks, weekHours };
    }).filter(m => m.myTasks.length > 0 || m.mySubtasks.length > 0 || true);
  }, [members, tasks, subtasks, filtered, start, end, weekKey]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{weekLabel}</h2>
        <div className="text-xs text-gray-400">
          {start.getMonth() + 1}/{start.getDate()} - {end.getMonth() + 1}/{end.getDate()}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {memberStats.map(({ member, myTasks, mySubtasks, weekHours }) => {
          const target = member.weeklyTarget ?? 40;
          const pct = Math.min(100, Math.round((weekHours / target) * 100));
          const isShort = weekHours < target;

          return (
            <div key={member.id || member.name} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Member Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    member.role === 'PL' ? 'bg-purple-500' : 'bg-blue-400'
                  }`}>
                    {member.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{member.name}</p>
                    <p className="text-[10px] text-gray-400">{member.seatId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-800">{weekHours}h</span>
                    <span className="text-xs text-gray-400">/ {target}h</span>
                    {isShort && weekHours < target && (
                      <span className="text-[9px] font-semibold bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full border border-red-200">부족</span>
                    )}
                  </div>
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 ml-auto">
                    <div
                      className={`h-1.5 rounded-full transition-all ${isShort ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="p-3 space-y-1.5 max-h-52 overflow-y-auto">
                {myTasks.length === 0 && mySubtasks.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-4">이번 주 업무 없음</p>
                ) : (
                  <>
                    {myTasks.map(t => {
                      const catCls = CAT_COLORS[t.category] ?? CAT_COLORS['기타'];
                      return (
                        <div key={t.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border text-xs ${catCls}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{t.title}</p>
                            <p className={`text-[10px] mt-0.5 ${STATUS_COLOR[t.status]}`}>{t.status}</p>
                          </div>
                          {(t.weeklyHours?.[weekKey] ?? 0) > 0 && (
                            <span className="text-[10px] font-semibold opacity-80 flex-shrink-0">
                              {t.weeklyHours?.[weekKey]}h
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {mySubtasks.map(s => {
                      const catCls = CAT_COLORS[s.category] ?? CAT_COLORS['기타'];
                      return (
                        <div key={s.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border text-xs ${catCls} opacity-80`}>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{s.title}</p>
                            <p className={`text-[10px] mt-0.5 ${STATUS_COLOR[s.status]}`}>{s.status}</p>
                          </div>
                          {(s.weeklyHours?.[weekKey] ?? 0) > 0 && (
                            <span className="text-[10px] font-semibold opacity-80 flex-shrink-0">
                              {s.weeklyHours?.[weekKey]}h
                            </span>
                          )}
                        </div>
                      );
                    })}
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
