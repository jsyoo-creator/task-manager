import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { FileText, Zap, CheckCircle2, Calendar, BarChart2, Users } from 'lucide-react';
import type { Task, SubTask, Project, TeamPart, TeamFormConfig, Department, BuiltinFieldKey } from '../types';
import { resolveBuiltinFields, resolveStatusConfigs, BUILTIN_FIELDS_META } from '../types';

interface Props {
  tasks: Task[];
  subtasks: SubTask[];
  project: Project | null;
  parts?: TeamPart[];
  assignees?: string[];
  formConfig?: TeamFormConfig;
  teamMembers?: { name: string; department?: Department }[];
}

// tailwind bg class → hex 변환 (파트 색상용)
const TW_TO_HEX: Record<string, string> = {
  'bg-red-500': '#ef4444', 'bg-orange-400': '#fb923c', 'bg-yellow-400': '#facc15',
  'bg-green-500': '#22c55e', 'bg-teal-500': '#14b8a6', 'bg-blue-500': '#3b82f6',
  'bg-indigo-500': '#6366f1', 'bg-purple-500': '#a855f7', 'bg-pink-500': '#ec4899',
  'bg-gray-400': '#9ca3af',
};

const PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

const CARD_ICONS = [FileText, Zap, CheckCircle2, BarChart2, Users, Calendar];

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

// 선택 가능한 집계 필드 목록 생성
// 우선순위: 상태/유형/구분(builtin) → 커스텀 name/select → receiver/assignee(builtin, 동일 레이블 커스텀 없을 때만)
function buildFieldOptions(formConfig?: TeamFormConfig, parts?: TeamPart[]) {
  const builtins = resolveBuiltinFields(formConfig);
  const result: { key: string; label: string }[] = [];
  const usedLabels = new Set<string>();

  // 1단계: 상태/유형/구분 — 항상 빌트인 우선
  const priorityKeys: BuiltinFieldKey[] = ['status', 'type', 'category'];
  for (const key of priorityKeys) {
    const fc = builtins.find(f => f.key === key);
    if (!fc || !fc.enabled) continue;
    if (key === 'category' && (!parts || parts.length === 0)) continue;
    const meta = BUILTIN_FIELDS_META.find(m => m.key === key);
    const label = fc.customLabel ?? meta?.label ?? key;
    if (usedLabels.has(label)) continue;
    usedLabels.add(label);
    result.push({ key, label });
  }

  // 2단계: 커스텀 name/select 필드 (receiver/assignee 빌트인보다 우선)
  const cfs = formConfig?.customFields?.filter(cf => cf.enabled !== false && (cf.type === 'select' || cf.type === 'name')) ?? [];
  for (const cf of cfs) {
    if (usedLabels.has(cf.label)) continue;
    usedLabels.add(cf.label);
    result.push({ key: cf.id, label: cf.label });
  }

  // 3단계: receiver/assignee — 동일 레이블의 커스텀 필드가 없을 때만 추가
  const personKeys: BuiltinFieldKey[] = ['receiver', 'assignee'];
  for (const key of personKeys) {
    const fc = builtins.find(f => f.key === key);
    if (!fc || !fc.enabled) continue;
    const meta = BUILTIN_FIELDS_META.find(m => m.key === key);
    const label = fc.customLabel ?? meta?.label ?? key;
    if (usedLabels.has(label)) continue;
    usedLabels.add(label);
    result.push({ key, label });
  }

  return result;
}

// 필드의 정의된 값 목록 (순서 포함)
function getDefinedValues(key: string, formConfig?: TeamFormConfig, parts?: TeamPart[], tasks?: Task[]): string[] {
  const builtins = resolveBuiltinFields(formConfig);
  const fc = builtins.find(f => f.key === key);
  const statusConfigs = resolveStatusConfigs(formConfig);

  if (key === 'status') {
    if (fc?.customType === 'select' && fc.options?.length) return fc.options;
    return statusConfigs.map(s => s.label);
  }
  if (key === 'type') {
    if (fc?.customType === 'select' && fc.options?.length) return fc.options;
    return ['신규', '기타', '파생', '기획'];
  }
  if (key === 'category') return parts?.map(p => p.name) ?? [];
  if (key === 'assignee') {
    const vals = [...new Set((tasks ?? []).map(t => t.assignee).filter(Boolean))];
    return vals.length ? vals : [];
  }
  if (key === 'receiver') {
    const vals = [...new Set((tasks ?? []).map(t => t.receiver).filter(Boolean))];
    return vals.length ? vals : [];
  }
  const cf = formConfig?.customFields?.find(f => f.id === key);
  if (cf?.type === 'select' && cf.options?.length) return cf.options;
  if (cf?.type === 'name') {
    const vals = [...new Set((tasks ?? []).map(t => t.customFields?.[key]).filter(Boolean) as string[])];
    return vals.length ? vals : [];
  }
  return [];
}

// 태스크의 필드 값 추출
function getTaskValue(task: Task, key: string): string {
  if (key === 'status') return task.status;
  if (key === 'type') return task.type;
  if (key === 'category') return task.category;
  if (key === 'assignee') return task.assignee;
  if (key === 'receiver') return task.receiver;
  return task.customFields?.[key] ?? '';
}

// 차트/카드 accent용 진한 색 (bg보다 text가 진함)
function getChartColor(key: string, value: string, idx: number, formConfig?: TeamFormConfig, parts?: TeamPart[]): string {
  const builtins = resolveBuiltinFields(formConfig);
  const fc = builtins.find(f => f.key === key);
  const statusConfigs = resolveStatusConfigs(formConfig);

  if (key === 'status') {
    if (fc?.customType === 'select' && fc.optionColors?.[value]?.text) return fc.optionColors[value].text;
    const sc = statusConfigs.find(s => s.key === value || s.label === value);
    return sc?.text ?? PALETTE[idx % PALETTE.length];
  }
  if (key === 'type') {
    if (fc?.optionColors?.[value]?.text) return fc.optionColors[value].text;
    const TYPE_DARK = ['#2563eb', '#d97706', '#059669', '#dc2626'];
    const i = ['신규', '기타', '파생', '기획'].indexOf(value);
    return i >= 0 ? TYPE_DARK[i] : PALETTE[idx % PALETTE.length];
  }
  if (key === 'category') {
    const part = parts?.find(p => p.name === value);
    return part ? (TW_TO_HEX[part.color] ?? '#94a3b8') : '#94a3b8';
  }
  const cf = formConfig?.customFields?.find(f => f.id === key);
  if (cf?.optionColors?.[value]?.text) return cf.optionColors[value].text;
  return PALETTE[idx % PALETTE.length];
}

/* ─── Section label ─── */
function SectionLabel({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-0.5 mb-2.5">
      <h2 className="text-[13px] font-bold text-gray-600 tracking-tight">{title}</h2>
      {meta && <div className="text-[11px] text-gray-400">{meta}</div>}
    </div>
  );
}

/* ─── Individual stat card ─── */
function StatCard({ label, value, sub, subAccent = false, icon, accentColor }: {
  label: string; value: number; sub: string; subAccent?: boolean;
  icon: ReactNode; accentColor: string;
}) {
  return (
    <div className="glass-card p-5 relative">
      <div className="absolute top-0 left-4 right-4 h-[2.5px] rounded-b-full opacity-55"
        style={{ backgroundColor: accentColor }} />
      <div className="flex items-start justify-between mb-4">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">{label}</span>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0"
          style={{ backgroundColor: accentColor }}>
          {icon}
        </span>
      </div>
      <div className="text-[32px] font-bold leading-none text-gray-900 tabular-nums mb-1.5">{value}</div>
      <div className={`text-xs font-medium ${subAccent ? 'text-blue-500' : 'text-gray-500'}`}>
        {sub}
      </div>
    </div>
  );
}

/* ─── Card with header ─── */
function Card({ title, action, children, className = '' }: {
  title: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={`glass-card ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-[12.5px] font-bold text-gray-700">{title}</span>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard({ tasks, subtasks, project, parts, assignees = [], formConfig, teamMembers }: Props) {
  const [assigneeView, setAssigneeView] = useState<'count' | 'hours'>('count');
  const [barVisible, setBarVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setBarVisible(true), 80); return () => clearTimeout(t); }, []);

  const statusConfigs = resolveStatusConfigs(formConfig);

  const cats = (parts && parts.length > 0) ? parts.map(p => p.name) : [];
  const catColor = (cat: string): string => {
    const part = parts?.find(p => p.name === cat);
    return part ? (TW_TO_HEX[part.color] ?? '#94a3b8') : '#94a3b8';
  };
  const monthKeys = getMonthKeys();

  // ── 집계 필드 선택 ──────────────────────────────
  const fieldOptions = useMemo(() => buildFieldOptions(formConfig, parts), [formConfig, parts]);
  const assigneeLabel = useMemo(() => {
    const bf = resolveBuiltinFields(formConfig).find(f => f.key === 'assignee');
    return bf?.customLabel ?? '담당자';
  }, [formConfig]);
  const [statField, setStatField] = useState('status');

  // 선택 필드 값 목록
  const definedValues = useMemo(
    () => getDefinedValues(statField, formConfig, parts, tasks),
    [statField, formConfig, parts, tasks]
  );

  // 빈 status를 첫 번째 상태 옵션으로 정규화
  const firstStatusOption = useMemo(() => {
    const builtins = resolveBuiltinFields(formConfig);
    const statusFc = builtins.find(f => f.key === 'status');
    const isCustom = statusFc?.customType === 'select' && !!statusFc.options?.length;
    return isCustom ? (statusFc!.options![0] ?? '') : (statusConfigs[0]?.key ?? '');
  }, [formConfig, statusConfigs]);

  // 집계
  // 공백 유무 차이('진행 전' ↔ '진행전') 허용 비교
  const sameStatus = (a: string, b: string) =>
    a === b || a.replace(/\s/g, '') === b.replace(/\s/g, '');

  const fieldStats = useMemo(() => {
    const total = tasks.length;
    const countByVal = Object.fromEntries(definedValues.map(v => [v, 0]));
    tasks.forEach(t => {
      let v = getTaskValue(t, statField);
      if (statField === 'status') {
        if (!v) v = firstStatusOption;
        // '진행 전' → '진행전' 공백 정규화
        if (v && !(v in countByVal)) {
          const normalized = Object.keys(countByVal).find(k => sameStatus(k, v));
          if (normalized) v = normalized;
        }
      }
      if (v in countByVal) countByVal[v]++;
      else countByVal[v] = (countByVal[v] ?? 0) + 1;
    });
    const vals = definedValues.length > 0
      ? definedValues
      : [...new Set(tasks.map(t => getTaskValue(t, statField)).filter(Boolean))];
    return { total, countByVal, vals: vals.slice(0, 5) };
  }, [tasks, statField, definedValues, firstStatusOption]);

  // 진행 현황 bar: 실제 task.status 값 기준 (custom 옵션 대응)
  const statusBarData = useMemo(() => {
    const builtins = resolveBuiltinFields(formConfig);
    const statusFc = builtins.find(f => f.key === 'status');
    const effStatus = (t: { status?: string }) => (t.status as string) || firstStatusOption;
    let data;
    if (statusFc?.customType === 'select' && !!statusFc.options?.length) {
      data = statusFc!.options!.map((opt, i) => ({
        label: opt,
        count: tasks.filter(t => sameStatus(effStatus(t), opt)).length,
        color: statusFc.optionColors?.[opt]?.text ?? PALETTE[i % PALETTE.length],
      }));
    } else {
      data = statusConfigs.map(s => ({
        label: s.label,
        count: tasks.filter(t => sameStatus(effStatus(t), s.key)).length,
        color: s.text,
      }));
    }
    // 정의된 status에 매핑 안 된 업무(과거 값 등)를 회색으로 표시
    const definedTotal = data.reduce((sum, s) => sum + s.count, 0);
    const otherCount = tasks.length - definedTotal;
    if (otherCount > 0) {
      data = [...data, { label: '기타', count: otherCount, color: '#9ca3af' }];
    }
    return data;
  }, [tasks, formConfig, statusConfigs, firstStatusOption]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthCount = tasks.filter(t => t.taskMonth === currentMonth).length;
    const done = statusBarData.find(s => s.label === '완료')?.count ?? 0;
    return { total, monthCount, done, totalSubs: subtasks.length };
  }, [tasks, subtasks, statusBarData]);

  const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  // 도넛 데이터 (선택 필드 기반)
  const mainDonut = useMemo(() =>
    fieldStats.vals
      .map(v => ({ name: v, value: fieldStats.countByVal[v] ?? 0 }))
      .filter(d => d.value > 0),
    [fieldStats]
  );

  const { subDonut, subDonutColorMap } = useMemo(() => {
    const builtins = resolveBuiltinFields(formConfig);
    const statusFc = builtins.find(f => f.key === 'status');
    const isCustom = statusFc?.customType === 'select' && !!statusFc.options?.length;
    // 공백 유무 차이 ('진행 전' ↔ '진행전') 허용 비교
    const sameStatus = (a: string, b: string) =>
      a === b || a.replace(/\s/g, '') === b.replace(/\s/g, '');
    const effSt = (st: { status?: string }) => (st.status as string) || firstStatusOption;
    if (isCustom) {
      const opts = statusFc!.options!;
      const data = opts.map((opt) => ({
        name: opt,
        value: subtasks.filter(st => sameStatus(effSt(st), opt)).length,
      }));
      const colorMap = Object.fromEntries(
        opts.map((opt, i) => [opt, statusFc!.optionColors?.[opt]?.text ?? PALETTE[i % PALETTE.length]])
      );
      return { subDonut: data, subDonutColorMap: colorMap };
    }
    const data = statusConfigs.map(s => ({ name: s.label, value: subtasks.filter(st => sameStatus(effSt(st), s.key)).length }));
    const colorMap = Object.fromEntries(statusConfigs.map(s => [s.label, s.text]));
    return { subDonut: data, subDonutColorMap: colorMap };
  }, [subtasks, statusConfigs, formConfig, firstStatusOption]);

  const catStats = useMemo(() => cats.map(cat => {
    const catTasks = tasks.filter(t => t.category === cat);
    const total = catTasks.length;

    // 파트별 폼 설정 우선 사용 (statusBarData와 동일한 매칭 방식)
    const part = parts?.find(p => p.name === cat);
    const catBuiltins = resolveBuiltinFields(part?.formConfig ?? formConfig);
    const catStatusFc = catBuiltins.find(f => f.key === 'status');
    const hasCustomOpts = !!(catStatusFc?.customType === 'select' && catStatusFc.options?.length);

    const catFirstStatus = hasCustomOpts ? catStatusFc!.options![0] : (statusConfigs[0]?.key ?? '');
    const effSt = (t: { status?: string }) => (t.status as string) || catFirstStatus;
    const statusBreakdown = hasCustomOpts
      ? catStatusFc!.options!.map((opt, i) => ({
          key: opt, label: opt,
          color: catStatusFc!.optionColors?.[opt]?.text ?? PALETTE[i % PALETTE.length],
          count: catTasks.filter(t => sameStatus(effSt(t), opt)).length,
        }))
      : statusConfigs.map(s => ({
          key: s.key, label: s.label, color: s.text,
          count: catTasks.filter(t => sameStatus(effSt(t), s.key)).length,
        }));

    const done = statusBreakdown.find(s => s.key === '완료' || s.label === '완료')?.count ?? 0;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { cat, total, statusBreakdown, rate };
  }), [tasks, cats, statusConfigs, formConfig, parts]);

  const revisionStats = useMemo(() => {
    const grandTotal = tasks.reduce((sum, t) =>
      sum + Object.values(t.revisionCounts ?? {}).reduce((a, b) => a + b, 0), 0);
    return REVISION_LABELS.map((label, i) => {
      const key = `F${i + 1}`;
      const count = tasks.reduce((sum, t) => sum + (t.revisionCounts?.[key] ?? 0), 0);
      const pct = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0;
      return { label, level: i + 1, count, pct };
    });
  }, [tasks]);
  const totalRevisions = tasks.reduce((sum, t) =>
    sum + Object.values(t.revisionCounts ?? {}).reduce((a, b) => a + b, 0), 0);

  const assigneeStats = useMemo(() => {
    const buildEntry = (name: string, subs: SubTask[]) => {
      const monthCounts: Record<string, number> = {};
      monthKeys.forEach((mk, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (monthKeys.length - 1 - i), 1);
        const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[mk] = subs.filter(s => s.startDate?.startsWith(prefix)).length;
      });
      return { name, monthCounts, total: subs.length, totalH: subs.reduce((a, s) => a + (s.totalHours ?? 0), 0) };
    };
    const result = (teamMembers ?? [])
      .map(({ name }) => buildEntry(name, subtasks.filter(s => s.assignee === name)))
      .filter(a => a.total > 0);
    const unassigned = subtasks.filter(s => !s.assignee);
    if (unassigned.length > 0) result.push(buildEntry('미배정', unassigned));
    return result;
  }, [subtasks, monthKeys, teamMembers]);

  // 실제 데이터가 있는 월만 표시
  const activeMonthKeys = useMemo(
    () => monthKeys.filter(mk => assigneeStats.some(a => (a.monthCounts[mk] ?? 0) > 0)),
    [monthKeys, assigneeStats]
  );

  const legendItems = statusBarData.map(s => ({ l: s.label, v: s.count, c: s.color }));

  // 현재 선택 필드 label
  const activeFieldLabel = fieldOptions.find(f => f.key === statField)?.label ?? '상태';

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-subtitle">{project?.name ?? ''} · 전체 업무 현황</p>
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {now.getFullYear()}년 {now.getMonth() + 1}월
        </span>
      </div>

      {/* ═══════════════════════════════
          섹션 1: 업무 현황 (동적 stat cards)
      ═══════════════════════════════ */}
      <section>
        <SectionLabel
          title="업무 현황"
          meta={
            <div className="flex items-center gap-2">
              <span className="text-gray-400">집계 기준</span>
              <select
                className="text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5 focus:outline-none cursor-pointer"
                value={statField}
                onChange={e => setStatField(e.target.value)}
              >
                {fieldOptions.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
          }
        />
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${2 + Math.min(fieldStats.vals.length, 5)}, 1fr)` }}
        >
          {/* 전체 업무 — 고정 */}
          <StatCard label="전체 업무" value={stats.total} sub={`세부업무 ${stats.totalSubs}개`}
            accentColor="#3b82f6" icon={<FileText size={14} />} />

          {/* 선택 필드 기준 동적 카드 */}
          {fieldStats.vals.map((val, idx) => {
            const count = fieldStats.countByVal[val] ?? 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const color = getChartColor(statField, val, idx, formConfig, parts);
            const Icon = CARD_ICONS[idx % CARD_ICONS.length];
            return (
              <StatCard
                key={val}
                label={val}
                value={count}
                sub={`전체의 ${pct}%`}
                accentColor={color}
                icon={<Icon size={14} />}
              />
            );
          })}

          {/* 월별 건수 — 고정 */}
          <StatCard label="월별 건수" value={stats.monthCount}
            sub={`${now.getFullYear()}년 ${now.getMonth() + 1}월`}
            accentColor="#ef4444" icon={<Calendar size={14} />} subAccent />
        </div>
      </section>

      {/* ═══════════════════════════════
          섹션 2: 전체 진행 현황 (progress bar — 상태 고정)
      ═══════════════════════════════ */}
      <section>
        <div className="glass-card">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <span className="text-[12.5px] font-bold text-gray-700">전체 진행 현황</span>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              {legendItems.map(s => (
                <span key={s.l} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.c }} />
                  {s.l} {s.v}
                </span>
              ))}
              <span className="font-bold text-blue-500 pl-0.5">{completionPct}%</span>
            </div>
          </div>
          <div className="px-5 pb-4">
            {stats.total > 0 ? (
              <div className="flex gap-1 h-3">
                {legendItems.filter(s => s.v > 0).map((s, i, arr) => (
                  <div key={i}
                    className="h-full rounded-full overflow-hidden"
                    style={{ width: `${(s.v / stats.total) * 100}%`, backgroundColor: '#e9eaf0' }}>
                    <div className={`h-full rounded-full ${barVisible ? 'bar-animate' : 'scale-x-0'}`}
                      style={{ backgroundColor: s.c, transformOrigin: 'left',
                        animationDelay: `${i * 80}ms` }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-3 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-[10px] text-gray-300">업무 없음</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          섹션 3: 업무 상태 분석
      ═══════════════════════════════ */}
      <section>
        <SectionLabel title="업무 상태 분석" />
        <div className="space-y-3">

          {/* 1행: 메인 업무 + 세부 업무 */}
          <div className="grid grid-cols-2 gap-3 items-stretch">

            {/* 메인 업무 — 선택 필드 기준 */}
            <div className="glass-card flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <span className="text-[12.5px] font-bold text-gray-700">메인 업무 · {activeFieldLabel}</span>
              </div>
              <div className="flex-1 flex items-center p-5">
                <DonutChart
                  data={mainDonut}
                  colorMap={Object.fromEntries(
                    fieldStats.vals.map((v, i) => [v, getChartColor(statField, v, i, formConfig, parts)])
                  )}
                  label={activeFieldLabel}
                  visible={barVisible}
                />
              </div>
            </div>

            {/* 세부 업무 상태 */}
            <div className="glass-card flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <span className="text-[12.5px] font-bold text-gray-700">세부 업무 상태</span>
              </div>
              <div className="flex-1 flex items-center p-5">
                <DonutChart
                  data={subDonut}
                  colorMap={subDonutColorMap}
                  label="세부 상태"
                  visible={barVisible}
                />
              </div>
            </div>

          </div>

          {/* 2행: 분류별 완료율 */}
          {cats.length > 0 && (
          <div className="glass-card flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="text-[12.5px] font-bold text-gray-700">분류별 완료율</span>
              <span className="text-[11px] text-gray-400">전체 기간</span>
            </div>
            <div className="flex flex-wrap">
              {catStats.map(({ cat, total, statusBreakdown, rate }) => (
                <div key={cat} className="flex flex-col p-5 gap-3 border-r border-b border-gray-100 last:border-r-0"
                  style={{ minWidth: 160, flex: '1 1 0' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(cat) }} />
                      <span className="text-xs font-bold truncate" style={{ color: catColor(cat) }}>{cat}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: rate > 0 ? catColor(cat) : '#94a3b8' }}>
                      {rate}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e9eaf0' }}>
                    <div className={`h-full rounded-full ${barVisible ? 'bar-animate' : 'scale-x-0'}`}
                      style={{ width: rate > 0 ? `${rate}%` : '0%', backgroundColor: catColor(cat),
                        minWidth: rate > 0 ? 6 : 0, transformOrigin: 'left' }} />
                  </div>
                  <div className="grid text-center gap-y-0.5" style={{ gridTemplateColumns: `repeat(${1 + statusBreakdown.length}, 1fr)` }}>
                    <div>
                      <div className="text-sm font-bold tabular-nums leading-tight text-gray-700">{total}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5">총</div>
                    </div>
                    {statusBreakdown.map(({ key, label, color, count }) => (
                      <div key={key}>
                        <div className="text-sm font-bold tabular-nums leading-tight" style={{ color: count > 0 ? color : '#c0c4d0' }}>{count}</div>
                        <div className="text-[9px] text-gray-400 mt-0.5 truncate">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

        </div>
      </section>

      {/* ═══════════════════════════════
          섹션 4: 상세 현황
      ═══════════════════════════════ */}
      <section>
        <SectionLabel title="상세 현황" />
        <div className="grid grid-cols-2 gap-3">

          <Card title="수정 횟수"
            action={<span className="text-xs text-gray-400">총 {totalRevisions}회</span>}>
            <div className="p-4 space-y-3">
              {revisionStats.map(r => (
                <div key={r.level} className="flex items-center gap-3">
                  <span className="w-6 h-5 bg-gradient-to-br from-blue-400 to-blue-600 text-white text-[9px] font-bold rounded flex items-center justify-center flex-shrink-0">
                    F{r.level}
                  </span>
                  <span className="text-xs text-gray-600 flex-1 truncate">{r.label}</span>
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-400 w-7 text-right tabular-nums">{r.pct}%</span>
                  <span className="text-xs font-bold text-gray-700 w-4 text-right tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title={`${assigneeLabel}별 세부업무 현황`}
            action={
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-gray-100">
                {(['count', 'hours'] as const).map((v, i) => (
                  <button key={v} onClick={() => setAssigneeView(v)}
                    className={`text-xs px-2.5 py-0.5 rounded-md transition-all ${
                      assigneeView === v
                        ? 'bg-white text-blue-600 shadow-sm font-semibold'
                        : 'text-gray-500 hover:text-gray-700'
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
                    className="grid text-[10px] font-semibold text-gray-400 pb-2 mb-1 border-b border-black/5"
                    style={{ gridTemplateColumns: `1fr repeat(${activeMonthKeys.length}, 64px) 44px` }}
                  >
                    <span>{assigneeLabel}</span>
                    {activeMonthKeys.map(k => <span key={k} className="text-center">{k}</span>)}
                    <span className="text-center">합계</span>
                  </div>
                  {assigneeStats.map(({ name, monthCounts, total, totalH }) => (
                    <div key={name}
                      className="grid items-center py-1.5 rounded-lg hover:bg-gray-50 -mx-1 px-1 transition-colors"
                      style={{ gridTemplateColumns: `1fr repeat(${activeMonthKeys.length}, 64px) 44px` }}
                    >
                      <span className="text-xs font-semibold text-gray-700 truncate">{name}</span>
                      {activeMonthKeys.map(mk => {
                        const c = monthCounts[mk] ?? 0;
                        return (
                          <div key={mk} className="flex justify-center">
                            {c > 0
                              ? <span className="bg-blue-100 text-blue-700 rounded px-1.5 text-[10px] font-bold">{c}건</span>
                              : <span className="text-gray-200 text-xs">—</span>}
                          </div>
                        );
                      })}
                      <div className="text-center text-xs font-bold text-orange-500 tabular-nums">
                        {assigneeView === 'hours' ? `${totalH}h` : `${total}건`}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="h-20 flex flex-col items-center justify-center gap-2">
                  <FileText size={18} className="text-gray-200" />
                  <span className="text-xs text-gray-400">등록된 세부업무 없음</span>
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
function DonutChart({ data, colorMap, label = '전체', visible = true }: {
  data: { name: string; value: number }[];
  colorMap: Record<string, string>;
  label?: string;
  visible?: boolean;
}) {
  const colorOf = (name: string) => colorMap[name] ?? '#e5e7eb';
  const chartData = data.filter(d => d.value > 0);
  const isEmpty = chartData.length === 0;
  const total = data.reduce((s, d) => s + d.value, 0);

  const cx = 70, cy = 70, r = 50, sw = 18;
  const circ = 2 * Math.PI * r;
  const gap = sw * 0.7; // 슬라이스 간 간격 (라운드 끝 기준)
  let offset = 0;
  const slices = chartData.map(d => {
    const len = (d.value / total) * circ;
    const drawLen = Math.max(0, len - gap);
    const slice = { name: d.name, len: drawLen, offset: offset + gap / 2 };
    offset += len;
    return slice;
  });

  return (
    <div className="flex items-center gap-5 w-full">
      {/* 도넛 SVG */}
      <div className="flex-shrink-0" style={{ width: 140, height: 140 }}>
        <svg viewBox="0 0 140 140" width="140" height="140">
          {/* 배경 트랙 */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e9eaf0" strokeWidth={sw} />
          {isEmpty ? null : slices.map((s, i) => (
            <circle key={s.name} cx={cx} cy={cy} r={r} fill="none"
              stroke={colorOf(s.name)} strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={`${visible ? s.len : 0} ${circ}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: `stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1) ${i * 90}ms` }}
            />
          ))}
          {/* 센터: 레이블 위, 숫자 아래 */}
          <text x={cx} y={cy - 7} textAnchor="middle" fontSize="10" fill="#9ca3af" fontWeight="500">{label}</text>
          <text x={cx} y={cy + 13} textAnchor="middle" fontSize="24" fontWeight="800" fill="#1f2937" letterSpacing="-0.5">{total}</text>
        </svg>
      </div>

      {/* 범례 */}
      <div className="flex-1 space-y-2.5 min-w-0">
        {data.length > 0
          ? data.map(({ name, value }) => (
              <div key={name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs min-w-0" style={{ color: value > 0 ? '#4b5563' : '#9ca3af' }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: value > 0 ? colorOf(name) : '#e5e7eb' }} />
                  <span className="truncate">{name}</span>
                </span>
                <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${value > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                  {value}
                </span>
              </div>
            ))
          : (
            <div className="space-y-2.5">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs text-gray-300 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-200" />
                    <span>-</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums flex-shrink-0 text-gray-200">0</span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
