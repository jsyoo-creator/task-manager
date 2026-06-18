import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FileText, Zap, CheckCircle2, Calendar, TrendingUp } from 'lucide-react';
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

/* ── Section card wrapper with labeled header ── */
function SectionCard({
  title, icon, children, action, className = '',
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card ${className}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/6 dark:border-white/8">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="w-6 h-6 rounded-md bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              {icon}
            </span>
          )}
          <h2 className="text-sm font-bold text-gray-800 dark:text-white/88">{title}</h2>
        </div>
        {action}
      </div>
      {children}
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

  /* ─────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-subtitle">{project?.name ?? ''} · 전체 업무 현황</p>
        </div>
        <span className="text-xs text-black/30 dark:text-white/25 font-medium">
          {now.getFullYear()}년 {now.getMonth() + 1}월
        </span>
      </div>

      {/* ── 존 1: 업무 요약 (stats + progress bar) ── */}
      <SectionCard title="업무 요약" icon={<TrendingUp size={13} />}>
        {/* 5 stat tiles — inside the card, divided by inner borders */}
        <div className="grid grid-cols-5 divide-x divide-black/5 dark:divide-white/8">
          {[
            {
              label: '전체 업무', value: stats.total,
              sub: `세부업무 ${stats.totalSubtasks}개`,
              icon: <FileText size={13} />, accent: '#3b82f6',
              iconBg: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
            },
            {
              label: '진행 전', value: stats.before,
              sub: `전체의 ${stats.total > 0 ? Math.round((stats.before / stats.total) * 100) : 0}%`,
              icon: <FileText size={13} />, accent: '#94a3b8',
              iconBg: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/45',
            },
            {
              label: '진행 중', value: stats.inProgress,
              sub: `전체의 ${stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%`,
              icon: <Zap size={13} />, accent: '#f59e0b',
              iconBg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
            },
            {
              label: '완료', value: stats.done,
              sub: `완료율 ${completionPct}%`,
              icon: <CheckCircle2 size={13} />, accent: '#10b981',
              iconBg: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
            },
            {
              label: '월별 건수', value: stats.monthCount,
              sub: `${now.getFullYear()}년 ${selectedMonth}월`,
              icon: <Calendar size={13} />, accent: '#ef4444',
              iconBg: 'bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400',
              subBlue: true,
            },
          ].map(({ label, value, sub, icon, accent, iconBg, subBlue }) => (
            <div key={label} className="relative px-5 py-4">
              {/* top color stripe */}
              <div className="absolute top-0 left-5 right-5 h-[2px] rounded-b-full opacity-60"
                style={{ backgroundColor: accent }} />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-white/50 tracking-wide uppercase">{label}</span>
                <span className={`w-6 h-6 rounded-md flex items-center justify-center ${iconBg}`}>{icon}</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white leading-none mb-1.5 tabular-nums">{value}</div>
              <div className={`text-xs font-medium ${subBlue ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-white/45'}`}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="px-5 py-3 border-t border-black/5 dark:border-white/8 bg-black/1.5 dark:bg-white/2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 dark:text-white/55">전체 진행 현황</span>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-white/45">
              {[
                { label: '진행 전', count: stats.before, color: '#3b82f6' },
                { label: '진행 중', count: stats.inProgress, color: '#f59e0b' },
                { label: '완료', count: stats.done, color: '#10b981' },
                { label: '보류', count: stats.hold, color: '#94a3b8' },
              ].map(s => (
                <span key={s.label} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label} {s.count}
                </span>
              ))}
              <span className="font-bold text-gray-700 dark:text-white/75 pl-1">{completionPct}%</span>
            </div>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-black/6 dark:bg-white/10">
            {stats.total > 0
              ? [
                  { v: stats.before, c: '#3b82f6' },
                  { v: stats.inProgress, c: '#f59e0b' },
                  { v: stats.done, c: '#10b981' },
                  { v: stats.hold, c: '#94a3b8' },
                ].map((s, i) => (
                  <div key={i} style={{ width: `${(s.v / stats.total) * 100}%`, backgroundColor: s.c }} className="transition-all" />
                ))
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[9px] text-black/20 dark:text-white/15">업무 없음</span>
                </div>
            }
          </div>
        </div>
      </SectionCard>

      {/* ── 존 2: 업무 상태 차트 ── */}
      <div className="grid grid-cols-3 gap-4">
        <SectionCard title="메인 업무 상태">
          <div className="p-5">
            <DonutChart data={mainDonut} tasks={tasks} type="task" />
          </div>
        </SectionCard>

        <SectionCard title="세부 업무 상태">
          <div className="p-5">
            <DonutChart data={subDonut} subtasks={subtasks} type="sub" />
          </div>
        </SectionCard>

        <SectionCard title="분류별 완료율">
          <div className="p-5 space-y-4">
            {catStats.map(({ cat, total, done, inProg, hold, rate }) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: CAT_COLORS[cat] }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_COLORS[cat] }} />
                    {CAT_LABELS[cat] ?? cat}
                  </span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: rate > 0 ? CAT_COLORS[cat] : '#9ca3af' }}>
                    {rate}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/8 dark:bg-white/12 mb-2.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: CAT_COLORS[cat] }} />
                </div>
                <div className="grid grid-cols-4 text-center">
                  {[
                    { l: '총', v: total, c: '#4b5563' },
                    { l: '완', v: done, c: '#10b981' },
                    { l: '진', v: inProg, c: '#f59e0b' },
                    { l: '대', v: hold, c: '#94a3b8' },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-bold tabular-nums" style={{ color: c }}>{v}</span>
                      <span className="text-[9px] text-gray-400 dark:text-white/30">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── 존 3: 수정 횟수 + 담당자 현황 ── */}
      <div className="grid grid-cols-2 gap-4">
        <SectionCard
          title="수정 횟수"
          action={
            <span className="text-xs text-gray-400 dark:text-white/35 font-medium">총 {totalRevisions}회</span>
          }
        >
          <div className="p-5 space-y-3">
            {revisionStats.map(r => (
              <div key={r.level} className="flex items-center gap-3">
                <span className="w-7 h-5 bg-gradient-to-br from-blue-400 to-blue-600 text-white text-[9px] font-bold rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  F{r.level}
                </span>
                <span className="text-xs text-gray-700 dark:text-white/65 flex-1 truncate min-w-0">{r.label}</span>
                <div className="w-20 h-1.5 bg-black/6 dark:bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                  <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 dark:text-white/38 w-7 text-right tabular-nums">{r.pct}%</span>
                <span className="text-xs font-bold text-gray-700 dark:text-white/65 w-4 text-right tabular-nums">{r.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="담당자별 세부업무 현황"
          action={
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-black/5 dark:bg-white/8">
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
        >
          <div className="p-5">
            {assigneeStats.length > 0 ? (
              <>
                <div
                  className="grid text-[10px] font-semibold text-gray-500 dark:text-white/45 pb-2 mb-1 border-b border-black/5 dark:border-white/8"
                  style={{ gridTemplateColumns: `1fr repeat(${monthKeys.length}, 56px) 48px` }}
                >
                  <span>담당자</span>
                  {monthKeys.map(k => <span key={k} className="text-center">{k}</span>)}
                  <span className="text-center">합계</span>
                </div>
                {assigneeStats.map(({ name, monthCounts, total, totalH }) => (
                  <div key={name}
                    className="grid items-center py-2 rounded-lg hover:bg-black/3 dark:hover:bg-white/4 transition-colors -mx-1 px-1"
                    style={{ gridTemplateColumns: `1fr repeat(${monthKeys.length}, 56px) 48px` }}
                  >
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
                    <div className="text-center text-xs font-bold text-orange-500 dark:text-orange-400 tabular-nums">
                      {assigneeView === 'hours' ? `${totalH}h` : `${total}`}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="h-24 flex flex-col items-center justify-center gap-2">
                <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/8 flex items-center justify-center">
                  <FileText size={15} className="text-gray-300 dark:text-white/20" />
                </div>
                <span className="text-xs text-gray-400 dark:text-white/30">등록된 세부업무 없음</span>
              </div>
            )}
          </div>
        </SectionCard>
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
    <div className="flex items-center gap-5">
      <div className="w-28 h-28 flex-shrink-0 relative flex items-center justify-center">
        {isEmpty ? (
          <div className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{ boxShadow: 'inset 0 0 0 14px rgba(0,0,0,0.07)' }}>
            <style>{`.dark .empty-ring{box-shadow:inset 0 0 0 14px rgba(255,255,255,0.10)!important}`}</style>
            <div className="empty-ring w-28 h-28 rounded-full absolute inset-0"
              style={{ boxShadow: 'inset 0 0 0 14px rgba(0,0,0,0.07)' }} />
            <span className="text-[10px] text-gray-400 dark:text-white/30 text-center leading-tight z-10">데이터<br/>없음</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                {data.map(entry => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? '#e5e7eb'} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="space-y-3 flex-1">
        {(['진행 전', '진행 중', '완료'] as const).map(s => {
          const count = items.filter(t => t.status === s).length;
          return (
            <div key={s} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                <span className="text-gray-600 dark:text-white/58">{s}</span>
              </span>
              <span className={`text-sm font-bold tabular-nums ${count > 0 ? 'text-gray-800 dark:text-white/85' : 'text-gray-300 dark:text-white/20'}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
