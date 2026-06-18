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

/* ─── Section label ─── */
function SectionLabel({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-0.5 mb-2.5">
      <h2 className="text-[13px] font-bold text-gray-600 dark:text-white/55 tracking-tight">{title}</h2>
      {meta && <div className="text-[11px] text-gray-400 dark:text-white/32">{meta}</div>}
    </div>
  );
}

/* ─── Individual stat card ─── */
function StatCard({ label, value, sub, subAccent = false, icon, accentColor }: {
  label: string; value: number; sub: string; subAccent?: boolean;
  icon: React.ReactNode; accentColor: string;
}) {
  return (
    <div className="glass-card p-5 relative">
      <div className="absolute top-0 left-4 right-4 h-[2.5px] rounded-b-full opacity-55"
        style={{ backgroundColor: accentColor }} />
      <div className="flex items-start justify-between mb-4">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-white/48 uppercase tracking-wide">{label}</span>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm"
          style={{ backgroundColor: accentColor }}>
          {icon}
        </span>
      </div>
      <div className="text-[32px] font-bold leading-none text-gray-900 dark:text-white tabular-nums mb-1.5">{value}</div>
      <div className={`text-xs font-medium ${subAccent ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-white/40'}`}>
        {sub}
      </div>
    </div>
  );
}

/* ─── Card with header ─── */
function Card({ title, action, children, className = '' }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`glass-card ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.07]">
        <span className="text-[12.5px] font-bold text-gray-700 dark:text-white/70">{title}</span>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard({ tasks, subtasks, project }: Props) {
  const [assigneeView, setAssigneeView] = useState<'count' | 'hours'>('count');
  const cats = project?.categories ?? ['라이브', '복지', '사업자'];
  const monthKeys = getMonthKeys();

  const stats = useMemo(() => {
    const total = tasks.length;
    const before = tasks.filter(t => t.status === '진행 전').length;
    const inProgress = tasks.filter(t => t.status === '진행 중').length;
    const done = tasks.filter(t => t.status === '완료').length;
    const hold = tasks.filter(t => t.status === '보류').length;
    const monthCount = tasks.filter(t =>
      t.startDate?.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    ).length;
    return { total, before, inProgress, done, hold, monthCount, totalSubs: subtasks.length };
  }, [tasks, subtasks]);

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
    const subs = subtasks.filter(s => tasks.find(t => t.id === s.taskId)?.category === cat);
    const total = subs.length;
    const done = subs.filter(s => s.status === '완료').length;
    const inProg = subs.filter(s => s.status === '진행 중').length;
    const hold = subs.filter(s => s.status === '보류').length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { cat, total, done, inProg, hold, rate };
  }), [tasks, subtasks, cats]);

  const revisionStats = useMemo(() =>
    REVISION_LABELS.map((label, i) => {
      const count = subtasks.filter(s => s.revisionLevel === i + 1).length;
      const pct = subtasks.length > 0 ? Math.round((count / subtasks.length) * 100) : 0;
      return { label, level: i + 1, count, pct };
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
    return { name, monthCounts, total: mySubs.length, totalH: mySubs.reduce((a, s) => a + (s.totalHours ?? 0), 0) };
  }).filter(a => a.total > 0), [subtasks, monthKeys]);

  /* ─── Legend row (progress bar 위) ─── */
  const legendItems = [
    { l: '진행 전', v: stats.before, c: STATUS_COLORS['진행 전'] },
    { l: '진행 중', v: stats.inProgress, c: STATUS_COLORS['진행 중'] },
    { l: '완료', v: stats.done, c: STATUS_COLORS['완료'] },
    { l: '보류', v: stats.hold, c: STATUS_COLORS['보류'] },
  ];

  return (
    <div className="space-y-6">

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

      {/* ═══════════════════════════════
          섹션 1: 업무 현황 (5 stat cards)
      ═══════════════════════════════ */}
      <section>
        <SectionLabel title="업무 현황" meta={`세부업무 ${stats.totalSubs}개 포함`} />
        <div className="grid grid-cols-5 gap-3">
          <StatCard label="전체 업무" value={stats.total} sub={`세부업무 ${stats.totalSubs}개`}
            accentColor="#3b82f6" icon={<FileText size={14} />} />
          <StatCard label="진행 전" value={stats.before}
            sub={`전체의 ${stats.total > 0 ? Math.round((stats.before / stats.total) * 100) : 0}%`}
            accentColor="#94a3b8" icon={<FileText size={14} />} />
          <StatCard label="진행 중" value={stats.inProgress}
            sub={`전체의 ${stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%`}
            accentColor="#f59e0b" icon={<Zap size={14} />} />
          <StatCard label="완료" value={stats.done} sub={`완료율 ${completionPct}%`}
            accentColor="#10b981" icon={<CheckCircle2 size={14} />} />
          <StatCard label="월별 건수" value={stats.monthCount}
            sub={`${now.getFullYear()}년 ${now.getMonth() + 1}월`}
            accentColor="#ef4444" icon={<Calendar size={14} />} subAccent />
        </div>
      </section>

      {/* ═══════════════════════════════
          섹션 2: 전체 진행 현황 (progress bar)
      ═══════════════════════════════ */}
      <section>
        <div className="glass-card">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <span className="text-[12.5px] font-bold text-gray-700 dark:text-white/70">전체 진행 현황</span>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-white/42">
              {legendItems.map(s => (
                <span key={s.l} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.c }} />
                  {s.l} {s.v}
                </span>
              ))}
              <span className="font-bold text-blue-500 dark:text-blue-400 pl-0.5">{completionPct}%</span>
            </div>
          </div>
          <div className="px-5 pb-4">
            <div className="flex h-3 rounded-full overflow-hidden bg-black/6 dark:bg-white/10">
              {stats.total > 0
                ? legendItems.map((s, i) => (
                    <div key={i} style={{ width: `${(s.v / stats.total) * 100}%`, backgroundColor: s.c }} />
                  ))
                : <div className="flex-1 flex items-center justify-center">
                    <span className="text-[10px] text-black/20 dark:text-white/15">업무 없음</span>
                  </div>
              }
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          섹션 3: 업무 상태 분석
          grid-cols-4: 도넛 1칸씩 + 분류별 2칸
      ═══════════════════════════════ */}
      <section>
        <SectionLabel title="업무 상태 분석" />
        <div className="grid grid-cols-4 gap-3">
          <Card title="메인 업무 상태">
            <div className="p-5">
              <DonutChart data={mainDonut} items={tasks} />
            </div>
          </Card>

          <Card title="세부 업무 상태">
            <div className="p-5">
              <DonutChart data={subDonut} items={subtasks} />
            </div>
          </Card>

          {/* 분류별 완료율 — 2칸 너비, 카테고리 가로 3열 */}
          <div className="glass-card col-span-2">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.07]">
              <span className="text-[12.5px] font-bold text-gray-700 dark:text-white/70">분류별 완료율</span>
              <span className="text-[11px] text-gray-400 dark:text-white/32 flex items-center gap-1">
                🗓️ 전체 기간
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-black/[0.05] dark:divide-white/[0.07] p-0">
              {catStats.map(({ cat, total, done, inProg, hold, rate }) => (
                <div key={cat} className="p-4">
                  {/* 카테고리명 + 완료율 */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[cat] }} />
                      <span style={{ color: CAT_COLORS[cat] }}>{CAT_LABELS[cat] ?? cat}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: rate > 0 ? CAT_COLORS[cat] : '#94a3b8' }}>
                      {rate}%
                    </span>
                  </div>
                  {/* 진행 바 */}
                  <div className="h-1.5 rounded-full bg-black/6 dark:bg-white/10 mb-4 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: CAT_COLORS[cat] }} />
                  </div>
                  {/* 4개 수치 */}
                  <div className="grid grid-cols-4 text-center">
                    {[
                      { l: '총', v: total, c: 'text-gray-700 dark:text-white/65' },
                      { l: '완료', v: done, c: 'text-emerald-500' },
                      { l: '진행', v: inProg, c: 'text-blue-500' },
                      { l: '대기', v: hold, c: 'text-slate-400' },
                    ].map(({ l, v, c }) => (
                      <div key={l}>
                        <div className={`text-base font-bold tabular-nums leading-tight ${c}`}>{v}</div>
                        <div className="text-[9px] text-gray-400 dark:text-white/28 mt-0.5">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          섹션 4: 상세 현황 (2 detail cards)
      ═══════════════════════════════ */}
      <section>
        <SectionLabel title="상세 현황" />
        <div className="grid grid-cols-2 gap-3">

          <Card title="수정 횟수"
            action={<span className="text-xs text-gray-400 dark:text-white/35">총 {totalRevisions}회</span>}>
            <div className="p-4 space-y-3">
              {revisionStats.map(r => (
                <div key={r.level} className="flex items-center gap-3">
                  <span className="w-6 h-5 bg-gradient-to-br from-blue-400 to-blue-600 text-white text-[9px] font-bold rounded flex items-center justify-center flex-shrink-0">
                    F{r.level}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-white/60 flex-1 truncate">{r.label}</span>
                  <div className="w-24 h-1.5 bg-black/6 dark:bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-white/32 w-7 text-right tabular-nums">{r.pct}%</span>
                  <span className="text-xs font-bold text-gray-700 dark:text-white/62 w-4 text-right tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="담당자별 세부업무 현황"
            action={
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-black/5 dark:bg-white/8">
                {(['count', 'hours'] as const).map((v, i) => (
                  <button key={v} onClick={() => setAssigneeView(v)}
                    className={`text-xs px-2.5 py-0.5 rounded-md transition-all ${
                      assigneeView === v
                        ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                        : 'text-gray-500 dark:text-white/35 hover:text-gray-700'
                    }`}>
                    {['업무 건수', '업무 시간'][i]}
                  </button>
                ))}
              </div>
            }
          >
            <div className="p-4">
              {assigneeStats.length > 0 ? (
                <>
                  <div
                    className="grid text-[10px] font-semibold text-gray-400 dark:text-white/35 pb-2 mb-1 border-b border-black/5 dark:border-white/7"
                    style={{ gridTemplateColumns: `1fr repeat(${monthKeys.length}, 64px) 44px` }}
                  >
                    <span>담당자</span>
                    {monthKeys.map(k => <span key={k} className="text-center">{k}</span>)}
                    <span className="text-center">합계</span>
                  </div>
                  {assigneeStats.map(({ name, monthCounts, total, totalH }) => (
                    <div key={name}
                      className="grid items-center py-1.5 rounded-lg hover:bg-black/2.5 dark:hover:bg-white/3.5 -mx-1 px-1 transition-colors"
                      style={{ gridTemplateColumns: `1fr repeat(${monthKeys.length}, 64px) 44px` }}
                    >
                      <span className="text-xs font-semibold text-gray-700 dark:text-white/68 truncate">{name}</span>
                      {monthKeys.map(mk => {
                        const c = monthCounts[mk] ?? 0;
                        return (
                          <div key={mk} className="flex justify-center">
                            {c > 0
                              ? <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded px-1.5 text-[10px] font-bold">{c}건</span>
                              : <span className="text-gray-200 dark:text-white/15 text-xs">—</span>}
                          </div>
                        );
                      })}
                      <div className="text-center text-xs font-bold text-orange-500 dark:text-orange-400 tabular-nums">
                        {assigneeView === 'hours' ? `${totalH}h` : `${total}건`}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="h-20 flex flex-col items-center justify-center gap-2">
                  <FileText size={18} className="text-gray-200 dark:text-white/15" />
                  <span className="text-xs text-gray-400 dark:text-white/28">등록된 세부업무 없음</span>
                </div>
              )}
            </div>
          </Card>

        </div>
      </section>
    </div>
  );
}

/* ─── DonutChart ─── */
function DonutChart({ data, items }: { data: { name: string; value: number }[]; items: { status: string }[] }) {
  const isEmpty = data.length === 0;
  return (
    <div className="flex items-center gap-5">
      <div className="w-28 h-28 flex-shrink-0 relative flex items-center justify-center">
        {isEmpty ? (
          <>
            <div className="empty-ring absolute inset-0 rounded-full"
              style={{ boxShadow: 'inset 0 0 0 14px rgba(0,0,0,0.07)' }} />
            <style>{`.dark .empty-ring{box-shadow:inset 0 0 0 14px rgba(255,255,255,0.10)!important}`}</style>
            <span className="text-[10px] text-gray-400 dark:text-white/28 text-center leading-tight z-10">데이터<br/>없음</span>
          </>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                {data.map(e => <Cell key={e.name} fill={STATUS_COLORS[e.name as keyof typeof STATUS_COLORS] ?? '#e5e7eb'} />)}
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
              <span className="flex items-center gap-2 text-xs text-gray-600 dark:text-white/55">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                {s}
              </span>
              <span className={`text-sm font-bold tabular-nums ${count > 0 ? 'text-gray-800 dark:text-white/80' : 'text-gray-200 dark:text-white/18'}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
