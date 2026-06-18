import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Zap, CheckCircle2, Calendar, Clock } from 'lucide-react';
import type { Task, SubTask, Project } from '../types';

interface Props {
  tasks: Task[];
  subtasks: SubTask[];
  project: Project | null;
}

const STATUS_COLORS = { '진행 전': '#3b82f6', '진행 중': '#f59e0b', '완료': '#10b981' };
const CATEGORY_COLORS = { 라이브: '#ef4444', 복지: '#f97316', 사업자: '#6366f1' };
const WEEK_COLS = ['1주', '2주', '3주', '4주', '5주'];
const ASSIGNEES = ['청소티 PL', '로봇팅 님', '표재성 PL', '한우진 님', '탁새한 님', '고마희 님', '김철수'];
const REVISIONS = [
  { label: 'F1', title: 'KV 크리에이티브 변경' },
  { label: 'F2', title: '상세페이지 레이아웃 변동, 신규 상에 추가' },
  { label: 'F3', title: '특정 앱의 내용 이미지 수정' },
  { label: 'F4', title: 'API 제품 교재 20개 이상' },
  { label: 'F5', title: 'API 제품 교재 20개 미만' },
  { label: 'F6', title: '단순 텍스트·CMS 수정' },
];

const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export default function Dashboard({ tasks, subtasks, project }: Props) {
  const [assigneeView, setAssigneeView] = useState<'count' | 'hours' | 'period'>('count');

  const stats = useMemo(() => {
    const total = tasks.length;
    const before = tasks.filter(t => t.status === '진행 전').length;
    const inProgress = tasks.filter(t => t.status === '진행 중').length;
    const done = tasks.filter(t => t.status === '완료').length;
    const thisMonthCount = tasks.filter(t => t.startDate?.startsWith(thisMonth)).length;
    const totalSubtasks = subtasks.length;
    const totalHours = subtasks.reduce((acc, s) => acc + Object.values(s.weeklyHours ?? {}).reduce((a, b) => a + b, 0), 0);
    return { total, before, inProgress, done, thisMonthCount, totalSubtasks, totalHours };
  }, [tasks, subtasks]);

  const mainDonutData = [
    { name: '진행 전', value: stats.before || 0 },
    { name: '진행 중', value: stats.inProgress || 0 },
    { name: '완료', value: stats.done || 0 },
  ].filter(d => d.value > 0);

  const subDonutData = [
    { name: '진행 전', value: subtasks.filter(s => s.status === '진행 전').length },
    { name: '진행 중', value: subtasks.filter(s => s.status === '진행 중').length },
    { name: '완료', value: subtasks.filter(s => s.status === '완료').length },
  ].filter(d => d.value > 0);

  const categories = project?.categories ?? ['라이브', '복지', '사업자'];

  const categoryStats = useMemo(() => {
    return categories.map(cat => {
      const catTasks = subtasks.filter(s => {
        const parent = tasks.find(t => t.id === s.taskId);
        return parent?.category === cat || cat === parent?.category;
      });
      const total = catTasks.length;
      const done = catTasks.filter(s => s.status === '완료').length;
      const inProg = catTasks.filter(s => s.status === '진행 중').length;
      const before = catTasks.filter(s => s.status === '진행 전').length;
      const rate = total > 0 ? Math.round((done / total) * 100) : 0;
      return { cat, total, done, inProg, before, rate };
    });
  }, [tasks, subtasks, categories]);

  const assigneeStats = useMemo(() => {
    return ASSIGNEES.map(name => {
      const mySubs = subtasks.filter(s => s.assignee === name);
      const weekCounts: Record<string, number> = {};
      WEEK_COLS.forEach((_, i) => {
        const key = `week${i + 1}`;
        weekCounts[key] = mySubs.filter(s => s.weeklyHours?.[key] > 0).length;
      });
      const totalHours = mySubs.reduce((acc, s) => acc + Object.values(s.weeklyHours ?? {}).reduce((a, b) => a + b, 0), 0);
      return { name, count: mySubs.length, weekCounts, totalHours };
    }).filter(a => a.count > 0 || tasks.some(t => t.assignee === a.name));
  }, [subtasks, tasks]);

  const totalForBar = stats.total || 1;
  const progressSegments = [
    { label: '진행 전', count: stats.before, color: '#3b82f6' },
    { label: '진행 중', count: stats.inProgress, color: '#f59e0b' },
    { label: '완료', count: stats.done, color: '#10b981' },
    { label: '보류', count: 0, color: '#94a3b8' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard
          label="전체 업무"
          value={stats.total}
          sub={`세부업무 ${stats.totalSubtasks}개`}
          icon={<FileText size={16} />}
          iconBg="bg-blue-50 text-blue-500"
        />
        <StatCard
          label="진행 전"
          value={stats.before}
          sub={`전체의 ${stats.total > 0 ? Math.round((stats.before / stats.total) * 100) : 0}%`}
          icon={<FileText size={16} />}
          iconBg="bg-slate-50 text-slate-500"
        />
        <StatCard
          label="진행 중"
          value={stats.inProgress}
          sub={`전체의 ${stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%`}
          icon={<Zap size={16} />}
          iconBg="bg-amber-50 text-amber-500"
        />
        <StatCard
          label="완료"
          value={stats.done}
          sub={`완료율 ${stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%`}
          icon={<CheckCircle2 size={16} />}
          iconBg="bg-green-50 text-green-500"
        />
        <StatCard
          label="월별 건수"
          value={stats.thisMonthCount}
          sub={`${now.getFullYear()}년 ${now.getMonth() + 1}월 ▼`}
          icon={<Calendar size={16} />}
          iconBg="bg-red-50 text-red-400"
        />
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">전체 진행 현황</h3>
          <div className="flex items-center gap-3">
            {progressSegments.map(s => (
              <span key={s.label} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                {s.label} {s.count}
              </span>
            ))}
            <span className="text-xs text-gray-400">보류 0%</span>
          </div>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
          {progressSegments.map(s => (
            <div
              key={s.label}
              style={{ width: `${(s.count / totalForBar) * 100}%`, backgroundColor: s.color }}
              className="transition-all duration-500"
            />
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Main Task Donut */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">메인 업무 상태</h3>
          {mainDonutData.length > 0 ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={mainDonutData} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0}>
                    {mainDonutData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1">
                {['진행 전', '진행 중', '완료'].map(s => {
                  const count = tasks.filter(t => t.status === s).length;
                  return count > 0 ? (
                    <div key={s} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s as keyof typeof STATUS_COLORS] }} />
                      <span className="text-gray-500">{s}</span>
                      <span className="font-semibold text-gray-800">{count}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-xs text-gray-400">없음</div>
          )}
        </div>

        {/* Sub Task Donut */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">세부 업무 상태</h3>
          {subDonutData.length > 0 ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={subDonutData} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0}>
                    {subDonutData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1">
                {['진행 전', '진행 중', '완료'].map(s => {
                  const count = subtasks.filter(t => t.status === s).length;
                  return (
                    <div key={s} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s as keyof typeof STATUS_COLORS] }} />
                      <span className="text-gray-500">{s}</span>
                      <span className="font-semibold text-gray-800">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-xs text-gray-400">없음</div>
          )}
        </div>

        {/* Category Completion */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">분류별 완료율</h3>
            <span className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">전체 기간</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {categoryStats.map(({ cat, total, done, inProg, before, rate }) => (
              <div key={cat} className="text-center">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] ?? '#6b7280' }}>
                    ● {cat}
                  </span>
                  <span className="text-xs font-bold text-gray-700">{rate}%</span>
                </div>
                <div className="grid grid-cols-3 gap-0.5 text-center">
                  {[['출', total, '#374151'], ['완료', done, '#10b981'], ['진행', inProg, '#f59e0b']].map(([label, val, color]) => (
                    <div key={label as string}>
                      <div className="text-xs font-bold" style={{ color: color as string }}>{val as number}</div>
                      <div className="text-[10px] text-gray-400">{label as string}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Revision List */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">수정 횟수</h3>
            <span className="text-xs text-red-400 border border-red-100 rounded px-1.5 py-0.5 flex items-center gap-1">
              ❤ 전체 기간
            </span>
          </div>
          <div className="space-y-2">
            {REVISIONS.map((r, i) => {
              const count = subtasks.filter(s => s.revisionCount >= i + 1).length;
              const rate = subtasks.length > 0 ? Math.round((count / subtasks.length) * 100) : 0;
              return (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="w-6 h-5 bg-blue-500 text-white text-[10px] font-bold rounded flex items-center justify-center flex-shrink-0">
                    {r.label}
                  </span>
                  <span className="text-xs text-gray-600 flex-1 truncate">{r.title}</span>
                  <span className="text-xs text-gray-400 w-8 text-right">{rate}%</span>
                  <span className="text-xs text-gray-500 w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Assignee Table */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">담당자별 세부업무 현황</h3>
            <div className="flex gap-1">
              {(['count', 'hours', 'period'] as const).map((v, i) => (
                <button
                  key={v}
                  onClick={() => setAssigneeView(v)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${assigneeView === v ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {['업무 건수', '업무 시간', '전체 기간'][i]}
                </button>
              ))}
            </div>
          </div>
          {assigneeStats.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[100px_repeat(5,1fr)_40px] text-[10px] text-gray-400 px-1">
                <span>담당자</span>
                {WEEK_COLS.map(w => <span key={w} className="text-center">{w}</span>)}
                <span className="text-center">합계</span>
              </div>
              {assigneeStats.map(({ name, count, weekCounts, totalHours }) => (
                <div key={name} className="grid grid-cols-[100px_repeat(5,1fr)_40px] items-center text-xs px-1 py-1 rounded hover:bg-gray-50">
                  <span className="text-gray-700 font-medium truncate">{name}</span>
                  {WEEK_COLS.map((_, i) => {
                    const key = `week${i + 1}`;
                    const val = weekCounts[key] ?? 0;
                    return (
                      <div key={key} className="flex justify-center">
                        {val > 0 ? (
                          <span className="bg-blue-100 text-blue-600 rounded px-1.5 py-0.5 text-[11px] font-medium">{val}건</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </div>
                    );
                  })}
                  <div className="text-center font-semibold text-gray-700">
                    {assigneeView === 'hours' ? `${totalHours}h` : count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-xs text-gray-400">등록된 세부업무 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, iconBg }: {
  label: string; value: number; sub: string; icon: React.ReactNode; iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}
