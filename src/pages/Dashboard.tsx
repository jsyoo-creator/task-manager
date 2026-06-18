import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FileText, Zap, CheckCircle2, Calendar } from 'lucide-react';
import type { Task, SubTask, Project, TaskCategory } from '../types';

interface Props {
  tasks: Task[];
  subtasks: SubTask[];
  project: Project | null;
}

const STATUS_COLORS = { '진행 전': '#3b82f6', '진행 중': '#f59e0b', '완료': '#10b981', '보류': '#94a3b8' };
const CAT_COLORS: Record<string, string> = { '라이브': '#ef4444', '복지': '#f97316', '사업자': '#6366f1' };
const CAT_LABELS: Record<string, string> = { '라이브': '라이브', '복지': '복지물', '사업자': '사업자물' };
const REVISION_LABELS = [
  'KV 크리에이티브 변경',
  '상세페이지 레이아웃 변동, 신규 상에 추가',
  '특정 영역 내용·이미지 수정',
  'API 제품 교재 20개 이상',
  'API 제품 교재 20개 미만',
  '단순 텍스트·CMS 수정',
];

const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// Generate month keys for past 2 months
function getMonthKeys() {
  const keys = [];
  for (let i = 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${String(d.getFullYear()).slice(2)}/${d.getMonth() + 1}월`);
  }
  return keys;
}

export default function Dashboard({ tasks, subtasks, project }: Props) {
  const [assigneeView, setAssigneeView] = useState<'count' | 'hours' | 'period'>('count');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const cats = project?.categories ?? ['라이브', '복지', '사업자'];
  const monthKeys = getMonthKeys();

  const stats = useMemo(() => {
    const total = tasks.length;
    const before = tasks.filter(t => t.status === '진행 전').length;
    const inProgress = tasks.filter(t => t.status === '진행 중').length;
    const done = tasks.filter(t => t.status === '완료').length;
    const hold = tasks.filter(t => t.status === '보류').length;
    const monthCount = tasks.filter(t => t.startDate?.startsWith(`${now.getFullYear()}-${String(selectedMonth).padStart(2, '0')}`)).length;
    const totalSubtasks = subtasks.length;
    return { total, before, inProgress, done, hold, monthCount, totalSubtasks };
  }, [tasks, subtasks, selectedMonth]);

  const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const mainDonut = [
    { name: '진행 전', value: stats.before },
    { name: '진행 중', value: stats.inProgress },
    { name: '완료', value: stats.done },
  ].filter(d => d.value > 0);

  const subDonut = useMemo(() => [
    { name: '진행 전', value: subtasks.filter(s => s.status === '진행 전').length },
    { name: '진행 중', value: subtasks.filter(s => s.status === '진행 중').length },
    { name: '완료', value: subtasks.filter(s => s.status === '완료').length },
  ].filter(d => d.value > 0), [subtasks]);

  const catStats = useMemo(() => cats.map(cat => {
    const catSubs = subtasks.filter(s => {
      const parent = tasks.find(t => t.id === s.taskId);
      return parent?.category === cat;
    });
    const total = catSubs.length;
    const done = catSubs.filter(s => s.status === '완료').length;
    const inProg = catSubs.filter(s => s.status === '진행 중').length;
    const hold = catSubs.filter(s => s.status === '보류').length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { cat, total, done, inProg, hold, rate };
  }), [tasks, subtasks, cats]);

  const revisionStats = useMemo(() => {
    return REVISION_LABELS.map((label, i) => {
      const level = i + 1;
      const count = subtasks.filter(s => s.revisionLevel === level).length;
      const pct = subtasks.length > 0 ? Math.round((count / subtasks.length) * 100) : 0;
      return { label, level, count, pct };
    });
  }, [subtasks]);

  const totalRevisions = revisionStats.reduce((a, b) => a + b.count, 0);

  const ASSIGNEES = ['김도은 님', '정소희 PL', '윤다영 님', '김동주 님', '고아현 님', '한수진 님', '탁세현 님'];
  const assigneeStats = useMemo(() => {
    return ASSIGNEES.map(name => {
      const mySubs = subtasks.filter(s => s.assignee === name);
      const monthCounts: Record<string, number> = {};
      monthKeys.forEach((mk, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (monthKeys.length - 1 - i), 1);
        const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[mk] = mySubs.filter(s => s.startDate?.startsWith(prefix)).length;
      });
      const total = mySubs.length;
      const totalH = mySubs.reduce((acc, s) => acc + (s.totalHours ?? 0), 0);
      return { name, monthCounts, total, totalH };
    }).filter(a => a.total > 0);
  }, [subtasks, monthKeys]);

  const totalPct = stats.total > 0
    ? Math.round(((stats.before + stats.inProgress + stats.done) / stats.total) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="전체 업무" value={stats.total} sub={`세부업무 ${stats.totalSubtasks}개`}
          icon={<FileText size={15} />} iconBg="bg-blue-50 text-blue-500" />
        <StatCard label="진행 전" value={stats.before}
          sub={`전체의 ${stats.total > 0 ? Math.round((stats.before / stats.total) * 100) : 0}%`}
          icon={<FileText size={15} />} iconBg="bg-slate-50 text-slate-400" />
        <StatCard label="진행 중" value={stats.inProgress}
          sub={`전체의 ${stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%`}
          icon={<Zap size={15} />} iconBg="bg-amber-50 text-amber-500" />
        <StatCard label="완료" value={stats.done}
          sub={`완료율 ${completionPct}%`}
          icon={<CheckCircle2 size={15} />} iconBg="bg-green-50 text-green-500" />
        <StatCard label="월별 건수" value={stats.monthCount}
          sub={`${now.getFullYear()}년 ${selectedMonth}월 ▼`}
          icon={<Calendar size={15} />} iconBg="bg-red-50 text-red-400" subBlue />
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">전체 진행 현황</h3>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />진행 전 {stats.before}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />진행 중 {stats.inProgress}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />완료 {stats.done}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />보류 {stats.hold}</span>
            <span className="font-semibold text-gray-600">{completionPct}%</span>
          </div>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
          {(stats.total > 0 ? [
            { v: stats.before, c: '#3b82f6' },
            { v: stats.inProgress, c: '#f59e0b' },
            { v: stats.done, c: '#10b981' },
            { v: stats.hold, c: '#94a3b8' },
          ] : []).map((s, i) => (
            <div key={i} style={{ width: `${(s.v / stats.total) * 100}%`, backgroundColor: s.c }} className="transition-all" />
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Main donut */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">메인 업무 상태</h3>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mainDonut.length ? mainDonut : [{ name: '없음', value: 1 }]}
                    cx="50%" cy="50%" innerRadius={30} outerRadius={44} dataKey="value" strokeWidth={0}>
                    {(mainDonut.length ? mainDonut : [{ name: '없음', value: 1 }]).map((entry) => (
                      <Cell key={entry.name} fill={mainDonut.length ? (STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? '#e5e7eb') : '#e5e7eb'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {(['진행 전', '진행 중', '완료'] as const).map(s => (
                <div key={s} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                    <span className="text-gray-500">{s}</span>
                  </span>
                  <span className="font-bold text-gray-800">{tasks.filter(t => t.status === s).length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sub donut */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">세부 업무 상태</h3>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subDonut.length ? subDonut : [{ name: '없음', value: 1 }]}
                    cx="50%" cy="50%" innerRadius={30} outerRadius={44} dataKey="value" strokeWidth={0}>
                    {(subDonut.length ? subDonut : [{ name: '없음', value: 1 }]).map((entry) => (
                      <Cell key={entry.name} fill={subDonut.length ? (STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? '#e5e7eb') : '#e5e7eb'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {(['진행 전', '진행 중', '완료'] as const).map(s => (
                <div key={s} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                    <span className="text-gray-500">{s}</span>
                  </span>
                  <span className="font-bold text-gray-800">{subtasks.filter(t => t.status === s).length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category completion */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">분류별 완료율</h3>
            <span className="text-xs border border-gray-200 rounded px-2 py-0.5 text-gray-500">❤ 전체 기간</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {catStats.map(({ cat, total, done, inProg, hold, rate }) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold flex items-center gap-1" style={{ color: CAT_COLORS[cat] }}>
                    ● {CAT_LABELS[cat] ?? cat}
                  </span>
                  <span className="text-sm font-bold" style={{ color: rate > 0 ? CAT_COLORS[cat] : '#9ca3af' }}>{rate}%</span>
                </div>
                {rate > 0 && (
                  <div className="h-1 rounded-full bg-gray-100 mb-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: CAT_COLORS[cat] }} />
                  </div>
                )}
                <div className="grid grid-cols-4 text-center gap-1">
                  {[['출', total, '#374151'], ['완료', done, '#10b981'], ['진행', inProg, '#f59e0b'], ['대기', hold, '#94a3b8']].map(([l, v, c]) => (
                    <div key={l as string}>
                      <div className="text-xs font-bold" style={{ color: c as string }}>{v as number}</div>
                      <div className="text-[10px] text-gray-400">{l as string}</div>
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
        {/* Revision list */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">수정 횟수 <span className="text-xs font-normal text-gray-400 ml-1">총 {totalRevisions}회</span></h3>
            <span className="text-xs border border-red-100 text-red-400 rounded px-2 py-0.5">❤ 전체 기간</span>
          </div>
          <div className="space-y-2.5">
            {revisionStats.map((r, i) => (
              <div key={r.level} className="flex items-center gap-2">
                <span className="w-6 h-5 bg-blue-500 text-white text-[10px] font-bold rounded flex items-center justify-center flex-shrink-0">
                  F{r.level}
                </span>
                <span className="text-xs text-gray-600 flex-1 truncate">{r.label}</span>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-300 rounded-full" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{r.pct}%</span>
                <span className="text-xs font-semibold text-gray-600 w-4 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assignee table */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">담당자별 세부업무 현황</h3>
            <div className="flex gap-1">
              {(['count', 'hours', 'period'] as const).map((v, i) => (
                <button key={v} onClick={() => setAssigneeView(v)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${assigneeView === v ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {['업무 건수', '업무 시간', '전체 기간'][i]}
                </button>
              ))}
            </div>
          </div>
          {assigneeStats.length > 0 ? (
            <div>
              <div className="grid gap-1 text-[10px] text-gray-400 mb-1 px-1"
                style={{ gridTemplateColumns: `120px repeat(${monthKeys.length}, 1fr) 50px` }}>
                <span>담당자</span>
                {monthKeys.map(k => <span key={k} className="text-center">{k}</span>)}
                <span className="text-center">합계</span>
              </div>
              {assigneeStats.map(({ name, monthCounts, total, totalH }) => (
                <div key={name} className="grid items-center px-1 py-1 rounded hover:bg-gray-50 text-xs"
                  style={{ gridTemplateColumns: `120px repeat(${monthKeys.length}, 1fr) 50px` }}>
                  <span className="text-gray-700 font-medium truncate">{name}</span>
                  {monthKeys.map(mk => {
                    const c = monthCounts[mk] ?? 0;
                    return (
                      <div key={mk} className="flex justify-center">
                        {c > 0
                          ? <span className="bg-blue-100 text-blue-600 rounded px-1.5 text-[11px] font-medium">{c}건</span>
                          : <span className="text-gray-200">-</span>}
                      </div>
                    );
                  })}
                  <div className="text-center font-bold" style={{ color: total > 0 ? '#f97316' : '#9ca3af' }}>
                    {assigneeView === 'hours' ? `${totalH}h` : `${total}건`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-xs text-gray-400">등록된 세부업무 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, iconBg, subBlue }: {
  label: string; value: number; sub: string; icon: React.ReactNode; iconBg: string; subBlue?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${iconBg}`}>{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className={`text-xs ${subBlue ? 'text-blue-500' : 'text-gray-400'}`}>{sub}</div>
    </div>
  );
}
