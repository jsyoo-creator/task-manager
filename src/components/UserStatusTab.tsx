import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { AppUser, Team, Workplace } from '../types';
import { deriveSubtasksForTeam } from '../types';
import { useProjects } from '../hooks/useProjects';
import { useAllTasks } from '../hooks/useTasks';
import { getDailyHoursForWeek, getWeeksInMonth, round2 } from '../lib/userStatusHours';

const DAY_NAMES = ['월', '화', '수', '목', '금'];

interface Props {
  workplaces: Workplace[];
  users: AppUser[];
  allTeams: Team[];
}

export default function UserStatusTab({ workplaces, users, allTeams }: Props) {
  const [workplaceId, setWorkplaceId] = useState<string>(workplaces[0]?.id ?? '');
  useEffect(() => {
    if (!workplaceId && workplaces.length > 0) setWorkplaceId(workplaces[0].id);
  }, [workplaces, workplaceId]);
  const now = new Date();
  const [monthCursor, setMonthCursor] = useState({ year: now.getFullYear(), month0: now.getMonth() });
  const [weekIdx, setWeekIdx] = useState(0);

  const { projects } = useProjects(workplaceId || undefined);
  const projectId = projects[0]?.id ?? '';
  const { tasks } = useAllTasks(projectId);
  const aliveTasks = useMemo(() => tasks.filter(t => !t.deletedAt), [tasks]);

  const teamsInWorkplace = useMemo(
    () => allTeams.filter(t => t.workplaceId === workplaceId),
    [allTeams, workplaceId]
  );
  const usersInWorkplace = useMemo(
    () => [...users.filter(u => u.workplaceIds?.includes(workplaceId))]
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko')),
    [users, workplaceId]
  );

  const subtasksAll = useMemo(
    () => teamsInWorkplace.flatMap(team =>
      deriveSubtasksForTeam(aliveTasks.filter(t => t.teamId === team.id), team, aliveTasks)
    ),
    [teamsInWorkplace, aliveTasks]
  );

  const taskMap = useMemo(() => new Map(aliveTasks.map(t => [t.id, t])), [aliveTasks]);

  const weeks = useMemo(() => getWeeksInMonth(monthCursor.year, monthCursor.month0), [monthCursor]);
  const safeWeekIdx = Math.min(weekIdx, weeks.length - 1);
  const currentWeek = weeks[safeWeekIdx];

  const changeMonth = (delta: number) => {
    setMonthCursor(({ year, month0 }) => {
      const d = new Date(year, month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
    setWeekIdx(0);
  };

  const rows = useMemo(() => {
    if (!currentWeek) return [];
    return usersInWorkplace.map(u => {
      const mySubs = subtasksAll.filter(s => s.assignee === u.displayName);
      const subSubs = subtasksAll.filter(s => {
        if (s.assignee === u.displayName) return false;
        const [, subKey] = s.id.split('__');
        return taskMap.get(s.taskId)?.subTaskData?.[subKey]?.substitute === u.displayName;
      });

      const dailyH = [0, 0, 0, 0, 0];
      const taskIds = new Set<string>();
      mySubs.forEach(s => {
        const h = getDailyHoursForWeek(s, currentWeek.weekMonday, false);
        if (h.some(v => v > 0)) { taskIds.add(s.taskId); h.forEach((v, i) => { dailyH[i] += v; }); }
      });
      subSubs.forEach(s => {
        const h = getDailyHoursForWeek(s, currentWeek.weekMonday, true);
        if (h.some(v => v > 0)) { taskIds.add(s.taskId); h.forEach((v, i) => { dailyH[i] += v; }); }
      });

      return {
        user: u,
        dailyH: dailyH.map(round2),
        taskCount: taskIds.size,
        totalH: round2(dailyH.reduce((a, b) => a + b, 0)),
      };
    });
  }, [usersInWorkplace, subtasksAll, taskMap, currentWeek]);

  return (
    <section className="glass-card">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Users size={15} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-800">사용자 현황</span>
          <span className="text-xs text-gray-400">근무지별 사용자의 주간 요일별 업무 시간</span>
        </div>
        <select
          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none"
          value={workplaceId}
          onChange={e => { setWorkplaceId(e.target.value); setWeekIdx(0); }}
        >
          {workplaces.map(wp => <option key={wp.id} value={wp.id}>{wp.name}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-1.5">
          <button onClick={() => changeMonth(-1)}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs font-semibold text-gray-700 whitespace-nowrap px-1">{monthCursor.year}년 {monthCursor.month0 + 1}월</span>
          <button onClick={() => changeMonth(1)}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
            <ChevronRight size={13} />
          </button>
        </div>
        <span className="text-gray-200">|</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setWeekIdx(i => Math.max(0, i - 1))} disabled={safeWeekIdx === 0}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-200 transition-colors">
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs font-semibold text-[#5B5BD6] whitespace-nowrap px-1">
            {currentWeek ? `${currentWeek.label} (${currentWeek.rangeLabel})` : ''}
          </span>
          <button onClick={() => setWeekIdx(i => Math.min(weeks.length - 1, i + 1))} disabled={safeWeekIdx >= weeks.length - 1}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-200 transition-colors">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {!workplaceId ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">등록된 근무지가 없습니다</p>
      ) : usersInWorkplace.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">이 근무지에 배정된 사용자가 없습니다</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/40">
                <th className="text-left font-medium text-xs text-gray-400 px-5 py-2.5">이름</th>
                {DAY_NAMES.map(d => (
                  <th key={d} className="text-center font-medium text-xs text-gray-400 py-2.5 w-16">{d}</th>
                ))}
                <th className="text-center font-medium text-xs text-gray-400 py-2.5 w-20">총업무</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ user, dailyH, taskCount, totalH }) => (
                <tr key={user.uid} className="hover:bg-gray-50/50">
                  <td className="px-5 py-2.5">
                    <p className="text-sm font-medium text-gray-800">{user.displayName}</p>
                  </td>
                  {dailyH.map((h, i) => {
                    const isOver = h > 8;
                    const isUnder = h > 0 && h < 8;
                    return (
                      <td key={i} className={`text-center text-xs font-semibold py-2.5 ${
                        isOver ? 'text-red-500' : isUnder ? 'text-amber-500' : h > 0 ? 'text-gray-600' : 'text-gray-300'
                      }`}>
                        {h > 0 ? `${h}h` : '-'}
                      </td>
                    );
                  })}
                  <td className="text-center py-2.5">
                    <span className="text-xs font-semibold text-indigo-600">{taskCount}개</span>
                    {totalH > 0 && <span className="text-[11px] text-gray-400 ml-1">({totalH}h)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
