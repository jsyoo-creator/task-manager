import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FileText, Zap, CheckCircle2, Calendar } from 'lucide-react';
import type { Task, SubTask, Project } from '../types';

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

function getMonthKeys() {
  const keys = [];
  for (let i = 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${String(d.getFullYear()).slice(2)}/${d.getMonth() + 1}월`);
  }
  return keys;
}

/* ─── Card Header ─── */
function CardHeader({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-black/6 dark:border-white/8 bg-black/2 dark:bg-white/3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-white/85">{title}</h3>
      {right && <div>{right}</div>}
    </div>
  );
}

export default function Dashboard({ tasks, subtasks, project }: Props) {
  const [assigneeView, setAssigneeView] = useState<'count' | 'hours'>('count');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const cats = project?.categories ?? ['라이브', '복지', '사업자'];
  const monthKeys = getMonthKeys();

  const stats = useMemo(() => {
    const total = tasks.length;
    const before = tasks.filter(t => t.status === '진행 전').length;
    const inProgress = tasks.filter(t => t.status === '진행 중').length;
    const done = tasks.filter(t => t.status === '완료').length;
    const hold = tasks.filter(t => t.status === '보류').length;
    const monthCount = tasks.filter(t =>
      t.startDate?.startsWith(`${now.getFullYear()}-${String(selectedMonth).padStart(2, '0')}`)
    ).length;
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
    const catSubs = subtasks.filter(s => tasks.find(t => t.id === s.taskId)?.category === cat);
    const total = catSubs.length;
    const done = catSubs.filter(s => s.status === '완료').length;
    const inProg = catSubs.filter(s => s.status === '진행 중').length;
    const hold = catSubs.filter(s => s.status === '보류').length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { cat, total, done, inProg, hold, rate };
  }), [tasks, subtasks, cats]);

  const revisionStats = useMemo(() =>
    REVISION_LABELS.map((label, i) => {
      const level = i + 1;
      const count = subtasks.filter(s => s.revisionLevel === level).length;
      const pct = subtasks.length > 0 ? Math.round((count / subtasks.length) * 100) : 0;
      return { label, level, count, pct };
    }), [subtasks]);

  const totalRevisions = revisionStats.reduce((a, b) => a + b.count, 0);

  const ASSIGNEES = ['김도은 님', '정소희 PL', '윤다영 님', '김동주 님', '고아현 님', '한수진 님', '탁세현 님'];
  const assigneeStats = useMemo(() => ASSIGNEES.map(name => {
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
  }).filter(a => a.total > 0), [subtasks, monthKeys]);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-end justify-between pb-1">
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-subtitle">{project?.name ?? ''} · 전체 업무 현황</p>
        </div>
        <span className="text-xs text-black/30 dark:text-white/25 font-medium">{now.getFullYear()}년 {now.getMonth() + 1}월</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="전체 업무" value={stats.total} sub={`세부업무 ${stats.totalSubtasks}개`}
          icon={<FileText size={14} />} iconCls="bg-blue-500/12 text-blue-600 dark:bg-blue-500/25 dark:text-blue-400"
          accent="#3b82f6" />
        <StatCard label="진행 전" value={stats.before}
          sub={`전체의 ${stats.total > 0 ? Math.round((stats.before / stats.total) * 100) : 0}%`}
          icon={<FileText size={14} />} iconCls="bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/50"
          accent="#94a3b8" />
        <StatCard label="진행 중" value={stats.inProgress}
          sub={`전체의 ${stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%`}
          icon={<Zap size={14} />} iconCls="bg-amber-500/12 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400"
          accent="#f59e0b" />
        <StatCard label="완료" value={stats.done} sub={`완료율 ${completionPct}%`}
          icon={<CheckCircle2 size={14} />} iconCls="bg-green-500/12 text-green-600 dark:bg-green-500/25 dark:text-green-400"
          accent="#10b981" />
        <StatCard label="월별 건수" value={stats.monthCount}
          sub={`${now.getFullYear()}년 ${selectedMonth}월`}
          icon={<Calendar size={14} />} iconCls="bg-red-500/12 text-red-500 dark:bg-red-500/25 dark:text-red-400"
          accent="#ef4444" subBlue />
      </div>

      {/* Progress Bar */}
      <div className="glass-card">
        <CardHeader
          title="전체 진행 현황"
          right={
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-white/50">
              {[
                { label: '진행 전', count: stats.before, color: '#3b82f6' },
                { label: '진행 중', count: stats.inProgress, color: '#f59e0b' },
                { label: '완료', count: stats.done, color: '#10b981' },
                { label: '보류', count: stats.hold, color: '#94a3b8' },
              ].map(s => (
                <span key={s.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label} {s.count}
                </span>
              ))}
              <span className="font-bold text-gray-700 dark:text-white/75 ml-1">{completionPct}%</span>
            </div>
          }
        />
        <div className="px-4 py-3">
          <div className="flex h-3 rounded-full overflow-hidden bg-black/6 dark:bg-white/10">
            {stats.total > 0
              ? [
                  { v: stats.before, c: '#3b82f6' },
                  { v: stats.inProgress, c: '#f59e0b' },
                  { v: stats.done, c: '#10b981' },
                  { v: stats.hold, c: '#94a3b8' },
                ].map((s, i) => (
                  <div key={i} style={{ width: `${(s.v / stats.total) * 100}%`, backgroundColor: s.c }} className="transition-all" />
                ))
              : <div className="w-full h-full bg-black/4 dark:bg-white/6 flex items-center justify-center">
                  <span className="text-[10px] text-black/25 dark:text-white/20">업무 없음</span>
                </div>
            }
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Main donut */}
        <div className="glass-card">
          <CardHeader title="메인 업무 상태" />
          <div className="p-4">
            <DonutChart data={mainDonut} tasks={tasks} type="task" />
          </div>
        </div>

        {/* Sub donut */}
        <div className="glass-card">
          <CardHeader title="세부 업무 상태" />
          <div className="p-4">
            <DonutChart data={subDonut} subtasks={subtasks} type="sub" />
          </div>
        </div>

        {/* Category completion */}
        <div className="glass-card">
          <CardHeader title="분류별 완료율" />
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              {catStats.map(({ cat, total, done, inProg, hold, rate }) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: CAT_COLORS[cat] }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_COLORS[cat] }} />
                      {CAT_LABELS[cat] ?? cat}
                    </span>
                    <span className="text-sm font-bold" style={{ color: rate > 0 ? CAT_COLORS[cat] : '#9ca3af' }}>{rate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/8 dark:bg-white/12 mb-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: CAT_COLORS[cat] }} />
                  </div>
                  <div className="grid grid-cols-4 text-center">
                    {[
                      { l: '총', v: total, c: '#374151' },
                      { l: '완', v: done, c: '#10b981' },
                      { l: '진', v: inProg, c: '#f59e0b' },
                      { l: '대', v: hold, c: '#94a3b8' },
                    ].map(({ l, v, c }) => (
                      <div key={l} className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-bold" style={{ color: c }}>{v}</span>
                        <span className="text-[9px] text-gray-400 dark:text-white/35">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Revision list */}
        <div className="glass-card">
          <CardHeader
            title={<>수정 횟수 <span className="text-xs font-normal text-gray-400 dark:text-white/35 ml-1">총 {totalRevisions}회</span></>}
          />
          <div className="p-4 space-y-3">
            {revisionStats.map(r => (
              <div key={r.level} className="flex items-center gap-2.5">
                <span className="w-6 h-5 bg-gradient-to-br from-blue-400 to-blue-600 text-white text-[9px] font-bold rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  F{r.level}
                </span>
                <span className="text-xs text-gray-700 dark:text-white/65 flex-1 truncate">{r.label}</span>
                <div className="w-24 h-1.5 bg-black/6 dark:bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                  <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-xs text-gray-500 dark:text-white/40 w-8 text-right tabular-nums">{r.pct}%</span>
                <span className="text-xs font-bold text-gray-700 dark:text-white/65 w-4 text-right tabular-nums">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assignee table */}
        <div className="glass-card">
          <CardHeader
            title="담당자별 세부업무 현황"
            right={
              <div className="flex gap-1 p-0.5 rounded-lg bg-black/5 dark:bg-white/8">
                {(['count', 'hours'] as const).map((v, i) => (
                  <button key={v} onClick={() => setAssigneeView(v)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                      assigneeView === v
                        ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                        : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
                    }`}>
                    {['건수', '시간'][i]}
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-4">
            {assigneeStats.length > 0 ? (
              <div>
                <div className="grid text-[10px] font-semibold text-gray-500 dark:text-white/45 mb-2 px-1 pb-1.5 border-b border-black/5 dark:border-white/8"
                  style={{ gridTemplateColumns: `110px repeat(${monthKeys.length}, 1fr) 52px` }}>
                  <span>담당자</span>
                  {monthKeys.map(k => <span key={k} className="text-center">{k}</span>)}
                  <span className="text-center">합계</span>
                </div>
                {assigneeStats.map(({ name, monthCounts, total, totalH }) => (
                  <div key={name} className="grid items-center px-1 py-2 rounded-lg hover:bg-black/4 dark:hover:bg-white/5 transition-colors"
                    style={{ gridTemplateColumns: `110px repeat(${monthKeys.length}, 1fr) 52px` }}>
                    <span className="text-xs font-semibold text-gray-700 dark:text-white/72 truncate">{name}</span>
                    {monthKeys.map(mk => {
                      const c = monthCounts[mk] ?? 0;
                      return (
                        <div key={mk} className="flex justify-center">
                          {c > 0
                            ? <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded px-1.5 text-[10px] font-bold">{c}</span>
                            : <span className="text-gray-300 dark:text-white/18 text-xs">—</span>}
                        </div>
                      );
                    })}
                    <div className="text-center text-xs font-bold text-orange-500 dark:text-orange-400">
                      {assigneeView === 'hours' ? `${totalH}h` : `${total}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-24 flex flex-col items-center justify-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/8 flex items-center justify-center">
                  <FileText size={14} className="text-gray-300 dark:text-white/20" />
                </div>
                <span className="text-xs text-gray-400 dark:text-white/30">등록된 세부업무 없음</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DonutChart ─── */
function DonutChart({ data, tasks, subtasks, type }: {
  data: { name: string; value: number }[];
  tasks?: Task[];
  subtasks?: SubTask[];
  type: 'task' | 'sub';
}) {
  const items = tasks ?? subtasks ?? [];
  const isEmpty = data.length === 0;

  return (
    <div className="flex items-center gap-4">
      {/* Chart or empty placeholder */}
      <div className="w-24 h-24 flex-shrink-0 relative">
        {isEmpty ? (
          /* CSS ring — theme-aware, no recharts */
          <div className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: 'conic-gradient(transparent 0deg)',
              boxShadow: 'inset 0 0 0 12px var(--ring-color)',
            }}>
            <style>{`
              :root { --ring-color: rgba(0,0,0,0.07); }
              .dark { --ring-color: rgba(255,255,255,0.10); }
            `}</style>
            <span className="text-[10px] text-gray-400 dark:text-white/30 text-center leading-tight">데이터<br/>없음</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" strokeWidth={0}>
                {data.map(entry => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? '#e5e7eb'} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="space-y-2.5 flex-1">
        {(['진행 전', '진행 중', '완료'] as const).map(s => {
          const count = items.filter(t => t.status === s).length;
          return (
            <div key={s} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                <span className="text-gray-600 dark:text-white/55">{s}</span>
              </span>
              <span className={`font-bold tabular-nums ${count > 0 ? 'text-gray-800 dark:text-white/85' : 'text-gray-300 dark:text-white/20'}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── StatCard ─── */
function StatCard({ label, value, sub, icon, iconCls, accent, subBlue }: {
  label: string; value: number; sub: string;
  icon: React.ReactNode; iconCls: string; accent: string; subBlue?: boolean;
}) {
  return (
    <div className="glass-card relative overflow-hidden">
      {/* Left accent bar */}
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full opacity-70"
        style={{ backgroundColor: accent }} />
      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-gray-600 dark:text-white/55 tracking-wide uppercase">{label}</span>
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconCls}`}>{icon}</span>
        </div>
        <div className="text-[28px] font-bold text-gray-900 dark:text-white leading-none mb-2 tabular-nums">{value}</div>
        <div className={`text-xs font-medium ${subBlue ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-white/48'}`}>{sub}</div>
      </div>
    </div>
  );
}
