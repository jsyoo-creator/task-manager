import { useState, useEffect, useRef } from 'react';
import { X, Trash2, ChevronDown, ExternalLink, Copy, Check } from 'lucide-react';
import type { Task, TaskStatus, TaskType, TeamPart, MetaField, SubTaskType, TeamFormConfig, Department, BuiltinFieldKey, Vacation, RevisionStep, MailFormPreset } from '../types';
import { DEFAULT_META_FIELDS, resolveBuiltinFields, BUILTIN_FIELDS_META, resolveStatusConfigs, resolveFieldDepts, partBadgeCls, DEFAULT_REVISION_STEPS } from '../types';
import DatePicker from './DatePicker';
import ConfirmDialog from './ConfirmDialog';
import { getWeekDays, calcHoursInRange, calcReviewTotal } from '../lib/weeklyHours';

const PANEL_W = 540;
const MAIL_PANEL_W = 420;

// 메일 양식 — 인사말/안내 문구는 자유 편집 텍스트, 업무 정보는 항상 업무 데이터로부터
// 다시 만들어지는(수정 불가) 표. 발송 기능은 없고 복사해서 Outlook/Gmail 등에
// 붙여넣어 쓰는 용도라, 복사 시 표가 실제 HTML 표로 붙여넣어지도록 별도 처리한다.
function buildMailGreeting(author: string): string {
  return author ? `안녕하세요, ${author} 입니다.` : '안녕하세요,';
}

// 메일 유형(탭)에서 안내 문구를 따로 설정하지 않았을 때 쓰는 기본값
const DEFAULT_MAIL_MESSAGE = '아래 업무 관련하여 안내드립니다.';

function buildMailMessage(task: Task, message: string, showTaskName: boolean): string {
  const base = message || DEFAULT_MAIL_MESSAGE;
  return showTaskName ? `${task.title} ${base}` : base;
}

// 메일 표의 기본 제공 항목 — 설정에서 이 중 어떤 걸 보여줄지 탭별로 고를 수 있음
export const MAIL_TABLE_BUILTIN_FIELDS: { key: string; label: string }[] = [
  { key: 'title', label: '업무명' },
  { key: 'category', label: '파트/구분' },
  { key: 'type', label: '유형' },
  { key: 'receiver', label: '접수자' },
  { key: 'assignee', label: '담당자' },
  { key: 'status', label: '진행상황' },
  { key: 'startDate', label: '시작일' },
  { key: 'endDate', label: '종료일' },
];

// 표 항목(행) 하나를 렌더링할 때 실제로 적용할 배경색/볼드 — 항목별 오버라이드가
// 있으면 그걸, 없으면 프리셋 공통값을, 그것도 없으면 기본값을 사용
const DEFAULT_MAIL_TABLE_STYLE = { labelBg: '#f9fafb', labelBold: true, valueBg: '#ffffff', valueBold: false };

// 표에 실제로 적용되는 배경색은 지정한 색을 흰색과 섞어 항상 옅게 만든다 — 어떤 색을
// 골라도(이미 저장된 진한 값 포함) 너무 진해 보이지 않게. rgba 반투명 대신 흰색과 섞은
// 불투명 hex를 직접 계산하는 이유는 Outlook 등 일부 메일 클라이언트가 반투명 배경을
// 안정적으로 지원하지 않기 때문
function lightenHex(hex: string, ratio: number): string {
  const full = hex.replace('#', '');
  const norm = full.length === 3 ? full.split('').map(c => c + c).join('') : full;
  const num = parseInt(norm, 16);
  if (norm.length !== 6 || isNaN(num)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

interface MailTableRow {
  key: string;
  label: string;
  value: string;
  labelBg: string;
  labelBold: boolean;
  valueBg: string;
  valueBold: boolean;
  hideLabel: boolean; // 이 항목만 항목명 칸을 비워 표시 (표 전체 항목명 칸 표시 여부와 별개)
  valuePrefix: string; // 내용 값 앞에 붙는 고정 텍스트 (없으면 '')
  valueSuffix: string; // 내용 값 뒤에 붙는 고정 텍스트 (없으면 '')
  // sourceKey 없는(=사용자 입력) 커스텀 항목이면 값을 표 안에서 바로 입력할 수 있어야 하므로
  // 입력 타입/필드 id를 함께 넘김 (미리보기에서만 사용, 복사되는 값은 이미 value에 반영됨)
  manualFieldId?: string;
  manualFieldType?: 'text' | 'date';
}

// 표 행 순서 — 저장된 순서(tableRowOrder)가 있으면 그 순서를 따르되, 새로 추가되었거나
// 순서를 저장하기 전부터 있던 항목(순서 목록에 없는 것)은 기본 순서 그대로 뒤에 붙인다
export function resolveMailTableRowOrder(naturalKeys: string[], savedOrder: string[] | undefined): string[] {
  if (!savedOrder?.length) return naturalKeys;
  const known = savedOrder.filter(k => naturalKeys.includes(k));
  const extra = naturalKeys.filter(k => !known.includes(k));
  return [...known, ...extra];
}

// preset의 tableFields/tableCustomFields/tableFieldStyles/tableRowOrder를 반영해
// 표에 표시할 행 목록을 만든다. tableFields가 없으면(설정 전) 기본 8개 전체를 표시.
// manualValues는 sourceKey가 없는(=사용자 입력) 커스텀 항목의 값을, 메일 작성 중 입력한 값에서 채움
function buildTaskInfoRows(task: Task, statusLabel: string, preset: MailFormPreset | undefined, manualValues?: Record<string, string>): MailTableRow[] {
  const fmt = (d?: string) => (d ? d.slice(0, 10) : '-');
  const builtinValues: Record<string, string> = {
    title: task.title,
    category: task.category || '-',
    type: task.type || '-',
    receiver: task.receiver || '-',
    assignee: task.assignee || '-',
    status: statusLabel || '-',
    startDate: fmt(task.startDate),
    endDate: fmt(task.endDate),
  };
  const resolveStyle = (key: string) => {
    const o = preset?.tableFieldStyles?.[key];
    return {
      labelBg: lightenHex(o?.labelBg || preset?.tableLabelBg || DEFAULT_MAIL_TABLE_STYLE.labelBg, 0.4),
      labelBold: o?.labelBold ?? preset?.tableLabelBold ?? DEFAULT_MAIL_TABLE_STYLE.labelBold,
      valueBg: lightenHex(o?.valueBg || preset?.tableValueBg || DEFAULT_MAIL_TABLE_STYLE.valueBg, 0.4),
      valueBold: o?.valueBold ?? preset?.tableValueBold ?? DEFAULT_MAIL_TABLE_STYLE.valueBold,
      hideRow: o?.hideRow ?? false,
      hideLabel: o?.hideLabel ?? false,
      valuePrefix: o?.valuePrefix ?? '',
      valueSuffix: o?.valueSuffix ?? '',
    };
  };
  const keys = preset?.tableFields?.length ? preset.tableFields : MAIL_TABLE_BUILTIN_FIELDS.map(f => f.key);
  const rowsByKey: Record<string, MailTableRow & { hideRow: boolean }> = {};
  keys
    .map(k => MAIL_TABLE_BUILTIN_FIELDS.find(f => f.key === k))
    .filter((f): f is { key: string; label: string } => !!f)
    .forEach(f => { rowsByKey[f.key] = { key: f.key, label: f.label, value: builtinValues[f.key], ...resolveStyle(f.key) }; });
  (preset?.tableCustomFields ?? []).forEach(cf => {
    const raw = cf.sourceKey ? (task.customFields?.[cf.sourceKey] ?? '') : (manualValues?.[cf.id] ?? '');
    rowsByKey[cf.id] = {
      key: cf.id,
      label: cf.label,
      value: cf.type === 'date' ? fmt(raw) : (raw || '-'),
      ...resolveStyle(cf.id),
      ...(cf.sourceKey ? {} : { manualFieldId: cf.id, manualFieldType: cf.type }),
    };
  });
  const naturalKeys = [...Object.keys(rowsByKey)];
  const order = resolveMailTableRowOrder(naturalKeys, preset?.tableRowOrder);
  return order.map(k => rowsByKey[k]).filter((r): r is MailTableRow & { hideRow: boolean } => !!r && !r.hideRow);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 값 앞뒤에 항목별로 지정한 고정 텍스트를 붙임 — 직접 띄어쓰기를 입력하지 않아도 값과는
// 항상 한 칸 띄어 보이도록 자동으로 공백을 넣어줌(이미 공백으로 끝나거나 시작하면 중복 추가 안 함)
const composeRowValue = (r: MailTableRow) => {
  const prefix = r.valuePrefix ? (/\s$/.test(r.valuePrefix) ? r.valuePrefix : `${r.valuePrefix} `) : '';
  const suffix = r.valueSuffix ? (/^\s/.test(r.valueSuffix) ? r.valueSuffix : ` ${r.valueSuffix}`) : '';
  return `${prefix}${r.value}${suffix}`;
};

// 클립보드용 일반 텍스트(대시 목록) — 표를 지원하지 않는 곳에 붙여넣었을 때의 대체 표현
function buildMailPlainText(greeting: string, message: string, rows: MailTableRow[], signature: string): string {
  const bulletBlock = rows.map(r => r.hideLabel ? `- ${composeRowValue(r)}` : `- ${r.label}: ${composeRowValue(r)}`).join('\n');
  return `${greeting}\n\n${message}\n\n${bulletBlock}\n\n감사합니다.${signature ? `\n\n${signature}` : ''}`;
}

// 클립보드용 HTML — 업무 정보 부분만 실제 <table>로 만들어, Outlook/Gmail 등
// 서식을 지원하는 곳에 붙여넣으면 표로 보이게 함
function buildMailHtml(greeting: string, message: string, rows: MailTableRow[], signature: string, title: string | undefined, showLabelColumn: boolean): string {
  // 붙여넣는 프로그램(Gmail 등)이 자체 기본 글자 크기를 강하게 적용해 인라인
  // font-size를 덮어쓰는 경우가 있어, !important로 명시해 확실히 이기도록 함
  const FS = 'font-size:13px!important;';
  const tableHtml = `<table style="border-collapse:collapse;${FS}line-height:1.6;width:auto;max-width:480px;border:1px solid #d1d5db;">${
    rows.map(r => {
      // 이 행만 항목명을 숨기면(hideLabel) 항목명 칸 자체를 아예 안 만들고, 내용 칸이
      // 그 자리까지 넓게 채우도록 colspan="2"를 준다 (항목명 칸이 빈 채로 남지 않게)
      const labelVisible = showLabelColumn && !r.hideLabel;
      const labelCell = labelVisible
        ? `<td style="padding:4px 12px;background:${r.labelBg};color:#555;${r.labelBold ? 'font-weight:700;' : 'font-weight:400;'}${FS}line-height:1.6;white-space:nowrap;vertical-align:top;border:1px solid #d1d5db;min-width:110px;">${escapeHtml(r.label)}</td>`
        : '';
      const valueColspan = showLabelColumn && !labelVisible ? ' colspan="2"' : '';
      return (
        `<tr>` +
        labelCell +
        `<td${valueColspan} style="padding:4px 12px;background:${r.valueBg};${r.valueBold ? 'font-weight:700;' : 'font-weight:400;'}${FS}line-height:1.6;border:1px solid #d1d5db;min-width:200px;">${escapeHtml(composeRowValue(r))}</td>` +
        `</tr>`
      );
    }).join('')
  }</table>`;
  const textBlock = (s: string) => s.split('\n').map(l => l === '' ? '<br>' : `<div style="${FS}">${escapeHtml(l)}</div>`).join('');
  const titleHtml = title ? `<div style="${FS}font-weight:700;margin-bottom:4px;">[${escapeHtml(title)}]</div>` : '';
  return (
    `<div style="${FS}">` +
    `${textBlock(greeting)}<br>` +
    `${textBlock(message)}<br>` +
    `${titleHtml}` +
    `${tableHtml}<br>` +
    `${textBlock('감사합니다.')}` +
    (signature ? `<br>${textBlock(signature)}` : '') +
    `</div>`
  );
}

// 작성자 기본값 — 업무의 접수자/담당자 중 기획 직군인 사람을 우선 사용하고,
// 없으면 팀의 기획 직군 첫 번째 사람으로 대체
function getDefaultMailAuthor(task: Task, teamMembers?: { name: string; department?: Department; email?: string }[]): string {
  if (!teamMembers?.length) return '';
  const isPlanning = (name?: string) => !!name && teamMembers.some(m => m.name === name && m.department === '기획');
  if (isPlanning(task.assignee)) return task.assignee!;
  if (isPlanning(task.receiver)) return task.receiver!;
  return teamMembers.find(m => m.department === '기획')?.name ?? '';
}

// OS에 맞게 경로 변환 (Windows ↔ Mac)
function convertPath(raw: string): string {
  if (!raw) return raw;
  const isWin = navigator.userAgent.includes('Windows');
  const isWinPath = /^[A-Za-z]:\\/.test(raw) || raw.startsWith('\\\\');
  const isMacPath = raw.startsWith('/');
  if (isWin && isMacPath) {
    // Mac → Windows
    if (raw.startsWith('/Volumes/')) {
      return '\\\\' + raw.slice('/Volumes/'.length).replace(/\//g, '\\');
    }
    return raw.replace(/\//g, '\\');
  }
  if (!isWin && isWinPath) {
    // Windows → Mac
    if (raw.startsWith('\\\\')) {
      // UNC(\\server\share\path) → smb://server/share/path (Finder 서버 연결 형식)
      return 'smb:' + raw.replace(/\\/g, '/');
    }
    // 로컬 드라이브: C:\Users\... → /Users/...
    return raw.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/');
  }
  return raw;
}

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];

const STATUS_STYLE: Record<TaskStatus, string> = {
  '진행 전': 'bg-blue-100 text-blue-700',
  '진행 중': 'bg-amber-100 text-amber-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-slate-200 text-slate-600',
};

const CAT_DOT: Record<string, string> = {
  '라이브': 'bg-red-500', '복지': 'bg-orange-400', '사업자': 'bg-indigo-500', '기타': 'bg-gray-400',
};

const DEPT_TAB_ACTIVE: Record<string, string> = {
  '기획':  'bg-violet-500 text-white shadow shadow-violet-500/25',
  '디자인': 'bg-pink-500 text-white shadow shadow-pink-500/25',
  '퍼블':  'bg-teal-500 text-white shadow shadow-teal-500/25',
};

const DEPT_BADGE: Record<string, string> = {
  '기획':  'bg-violet-100 text-violet-700',
  '디자인': 'bg-pink-100 text-pink-700',
  '퍼블':  'bg-teal-100 text-teal-700',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-black/[0.08] last:border-0">
      <span className="text-xs text-gray-500 font-medium w-14 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

type SubTaskEntry = {
  status?: TaskStatus;
  assignee?: string;
  substitute?: string;
  startDate?: string;
  endDate?: string;
  weeklyHours: Record<string, number>; // keys: w1d1~w5d5
  totalHours: number;
  substituteWeeklyHours?: Record<string, number>;
  substituteTotalHours?: number;
  // review type fields
  checkedItems?: string[];
  reviewWeeklyHours?: Record<string, Record<string, number>>;
  reviewDates?: Record<string, { startDate?: string; endDate?: string }>;
  reviewStatus?: Record<string, string>;
};

function aggregateReviewToWeekly(
  reviewWeeklyHours: Record<string, Record<string, number>>,
  reviewDates: Record<string, { startDate?: string; endDate?: string }>,
  checkedItems: string[]
): { weeklyHours: Record<string, number>; totalHours: number; startDate?: string; endDate?: string } {
  const validItems = checkedItems.filter(id => reviewDates[id]?.startDate);
  if (validItems.length === 0) return { weeklyHours: {}, totalHours: 0 };
  const dateMap: Record<string, number> = {};
  validItems.forEach(id => {
    const startDate = reviewDates[id].startDate!;
    const base = new Date(startDate);
    const dow = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() + (dow === 0 ? -6 : 1 - dow));
    const wh = reviewWeeklyHours[id] ?? {};
    Object.entries(wh).forEach(([key, h]) => {
      if (!h) return;
      const m = key.match(/^w(\d+)d(\d+)$/);
      if (!m) return;
      const wi = parseInt(m[1]) - 1;
      const di = parseInt(m[2]) - 1;
      if (di < 0 || di > 4) return;
      const d = new Date(monday);
      d.setDate(monday.getDate() + wi * 7 + di);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      dateMap[ds] = (dateMap[ds] ?? 0) + h;
    });
  });
  if (Object.keys(dateMap).length === 0) return { weeklyHours: {}, totalHours: 0 };
  const sorted = Object.keys(dateMap).sort();
  const overallStart = sorted[0];
  const overallEnd = sorted[sorted.length - 1];
  const ob = new Date(overallStart);
  const odow = ob.getDay();
  const overallMonday = new Date(ob);
  overallMonday.setDate(ob.getDate() + (odow === 0 ? -6 : 1 - odow));
  const weeklyHours: Record<string, number> = {};
  Object.entries(dateMap).forEach(([ds, h]) => {
    if (!h) return;
    const d = new Date(ds);
    const diffDays = Math.round((d.getTime() - overallMonday.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return;
    const wi = Math.floor(diffDays / 7);
    const di = diffDays % 7;
    if (di > 4) return;
    weeklyHours[`w${wi+1}d${di+1}`] = h;
  });
  const totalHours = Object.values(weeklyHours).reduce((a, b) => a + b, 0);
  return { weeklyHours, totalHours, startDate: overallStart, endDate: overallEnd };
}

const REVIEW_STATUSES = ['검수 전', '검수 중', '검수 완료'] as const;
type ReviewStatus = typeof REVIEW_STATUSES[number];
const REVIEW_STATUS_STYLE: Record<ReviewStatus, string> = {
  '검수 전': 'bg-white border border-gray-300 text-gray-500',
  '검수 중': 'bg-white border border-amber-400 text-amber-600',
  '검수 완료': 'bg-white border border-green-400 text-green-600',
};

function MiniAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  if (!name) return null;
  return photoURL
    ? <img src={photoURL} alt={name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#a5b4fc,#c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{name.slice(0, 1)}</div>;
}

export default function TaskDetailPanel({
  task, onClose, onUpdate, onDelete, assignees, parts, canManage, canDelete,
  metaFields: metaFieldsProp, subTaskTypes = [], revisionSteps = DEFAULT_REVISION_STEPS, teamMembers, formConfig, teamFormConfig, userPhotoMap,
  canSeeAll = true, currentUserName = '', currentUserDept, vacations = [], reviewTasks,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  assignees: string[];
  parts: TeamPart[];
  canManage: boolean;
  canDelete?: boolean;
  metaFields?: MetaField[];
  subTaskTypes?: SubTaskType[];
  revisionSteps?: RevisionStep[];
  teamMembers?: { name: string; department?: Department; email?: string }[];
  formConfig?: TeamFormConfig;
  teamFormConfig?: TeamFormConfig;
  userPhotoMap?: Map<string, string>;
  canSeeAll?: boolean;
  currentUserName?: string;
  currentUserDept?: Department; // 팀 소속 여부와 무관한, 로그인 사용자 본인의 직군 (세부업무 탭 우선순위용)
  vacations?: Vacation[];
  reviewTasks?: Task[];
}) {
  const metaFields = metaFieldsProp ?? DEFAULT_META_FIELDS;
  const todayD = new Date();
  const today = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;
  const isAssigneeOnVacation = (name: string | undefined): boolean => {
    if (!name || !vacations.length) return false;
    return vacations.some(v => {
      if (v.memberName !== name.trim()) return false;
      const [y, m, d] = v.date.split('-').map(Number);
      const end = new Date(y, m - 1, d + Math.max(Math.ceil(v.days) - 1, 0));
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      return today >= v.date && today <= endStr;
    });
  };
  const builtinFields = resolveBuiltinFields(formConfig);
  const bfVisible = (key: BuiltinFieldKey) => {
    const fc = builtinFields.find(f => f.key === key);
    return !fc || (fc.enabled && fc.showIn !== 'list');
  };
  const statusConfigs = resolveStatusConfigs(formConfig);
  const typeField = builtinFields.find(f => f.key === 'type');
  const teamBuiltinFields = teamFormConfig ? resolveBuiltinFields(teamFormConfig) : [];
  const fieldLabel = (key: BuiltinFieldKey) => {
    const bf = builtinFields.find(f => f.key === key);
    if (bf?.customLabel) return bf.customLabel;
    // 파트에 customLabel 없으면 팀 레벨 formConfig에서 fallback
    const tbf = teamBuiltinFields.find(f => f.key === key);
    if (tbf?.customLabel) return tbf.customLabel;
    return BUILTIN_FIELDS_META.find(m => m.key === key)?.label ?? key;
  };
  // formConfig 순서 기준: receiver와 assignee 중 어느 쪽이 먼저인지
  const receiverIdx = builtinFields.findIndex(f => f.key === 'receiver');
  const assigneeIdx = builtinFields.findIndex(f => f.key === 'assignee');
  const receiverFirst = receiverIdx !== -1 && assigneeIdx !== -1 && receiverIdx < assigneeIdx;
  const receiverFc = builtinFields.find(f => f.key === 'receiver');
  const assigneeFc = builtinFields.find(f => f.key === 'assignee');
  const isReceiverCustomSelect = receiverFc?.customType === 'select' && !!receiverFc?.options?.length;
  const isAssigneeCustomSelect = assigneeFc?.customType === 'select' && !!assigneeFc?.options?.length;

  const filteredByDept = (key: 'receiver' | 'assignee') => {
    const bf = builtinFields.find(f => f.key === key);
    const depts = bf ? resolveFieldDepts(bf) : null;
    let opts: string[];
    if (depts && teamMembers?.length) {
      const filtered = teamMembers.filter(m => m.department && depts.includes(m.department)).map(m => m.name);
      opts = filtered.length > 0 ? filtered : assignees;
    } else {
      opts = assignees;
    }
    const currentVal = key === 'receiver' ? task.receiver : task.assignee;
    return currentVal && !opts.includes(currentVal) ? [currentVal, ...opts] : opts;
  };

  const [title, setTitle] = useState(task.title);
  const [localMeta, setLocalMeta] = useState<Record<string, string>>(task.customFields ?? {});
  const [localSubTaskData, setLocalSubTaskData] = useState<Record<string, SubTaskEntry>>(task.subTaskData ?? {});
  const localSubTaskDataRef = useRef(localSubTaskData);
  localSubTaskDataRef.current = localSubTaskData;
  // 이번 패널이 열린 세션에서 직접 편집한 세부업무 타입(subTaskData 키) 추적용.
  // 이 안에 없는 키는 서버 최신값으로 자유롭게 갱신해도 안전함(내가 안 만졌으니까).
  const dirtyTypeIdsRef = useRef<Set<string>>(new Set());
  const [localRaw, setLocalRaw] = useState<Record<string, string>>({});
  const [pendingDeleteSubTask, setPendingDeleteSubTask] = useState<{ id: string; name: string } | null>(null);
  const [deletedSubTaskIds, setDeletedSubTaskIds] = useState<Set<string>>(new Set());
  const [manualSubstituteIds, setManualSubstituteIds] = useState<Set<string>>(new Set());
  const [activeDeptTab, setActiveDeptTab] = useState<Department | null>(null);
  const [visible, setVisible] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailMessage, setMailMessage] = useState('');
  const [mailAuthor, setMailAuthor] = useState('');
  const [mailPresetId, setMailPresetId] = useState('');
  // 사용자 입력(사용자가 직접 입력하는, sourceKey 없는) 표 항목의 값 — 업무 데이터가 아니라
  // 메일 작성할 때마다 새로 입력하는 값이라 커스텀 필드 id를 key로 별도 관리
  const [mailManualValues, setMailManualValues] = useState<Record<string, string>>({});
  const [mailCopied, setMailCopied] = useState(false);
  const [toCopied, setToCopied] = useState(false);
  const [ccCopied, setCcCopied] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const panelW = mailOpen ? PANEL_W + MAIL_PANEL_W : PANEL_W;

  // 메일 양식 내용을 지금 보고 있는 업무 기준으로 (다시) 채워 넣음. 인사말/업무 정보 표는
  // 항상 업무 데이터에서 계산되므로 상태로 따로 안 두고, 자유 편집이 필요한 안내
  // 문구만 상태(mailMessage)로 관리함
  const regenerateMail = (t: Task) => {
    const author = getDefaultMailAuthor(t, teamMembers);
    const taskPart = parts.find(p => p.name === t.category);
    const preset = taskPart?.mailFormConfig?.[0];
    setMailMessage(buildMailMessage(t, preset?.message ?? '', preset?.showTaskName ?? false));
    setMailAuthor(author);
    setMailPresetId(preset?.id ?? '');
    setMailManualValues({});
  };

  // 메일 양식이 열리면 본문(업무 목록 등)을 덮지 않고 옆으로 밀어내야 다른 업무를
  // 계속 클릭할 수 있음 — padding-left를 메일 양식 폭까지 포함해서 늘림.
  // (툴바가 좁아져 깨지는 문제는 패널 폭이 아니라 툴바 자체의 반응형 처리로 해결)
  useEffect(() => {
    if (!visible) return;
    document.documentElement.style.setProperty('--detail-panel-w', `${panelW}px`);
  }, [visible, panelW]);

  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible(true);
    });
    return () => {
      document.documentElement.style.setProperty('--detail-panel-w', '0px');
    };
  }, []);

  useEffect(() => {
    setTitle(task.title);
    setLocalMeta(task.customFields ?? {});
    setLocalSubTaskData(task.subTaskData ?? {});
    setDeletedSubTaskIds(new Set());
    setManualSubstituteIds(new Set());
    setActiveDeptTab(null);
    dirtyTypeIdsRef.current = new Set();
    // 메일 양식이 열려 있는 채로 다른 업무를 선택하면, 이전 업무 내용이 그대로
    // 남아있지 않도록 새 업무 기준으로 다시 채움
    if (mailOpen) regenerateMail(task);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // task.subTaskData가 외부에서 변경될 때(초기 Firestore 로드 포함) 동기화.
  // 세부업무 타입(키) 단위로 병합: 내가 이 패널에서 직접 편집한 타입(dirtyTypeIdsRef)은
  // 그대로 두고, 건드리지 않은 타입만 서버 최신값으로 갱신한다. 예전에는 "로컬이 완전히
  // 비어있을 때만" 동기화해서, 한 번이라도 아무 필드를 편집하면 그 이후로는 다른 사람이
  // 다른 세부업무 타입에 입력한 값이 영원히 반영되지 않고, 내가 저장할 때 그 값을
  // 되돌려 지워버리는 문제가 있었음.
  useEffect(() => {
    const server = task.subTaskData ?? {};
    setLocalSubTaskData(prev => {
      let changed = false;
      const next = { ...prev };
      for (const key of Object.keys(server)) {
        if (dirtyTypeIdsRef.current.has(key)) continue;
        if (next[key] !== server[key]) { next[key] = server[key]; changed = true; }
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.subTaskData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // 이전 메인 담당자 값 추적 (수동 설정한 담당자와 자동 설정한 담당자 구분용)
  const prevReceiverRef = useRef(task.receiver);
  const prevAssigneeRef = useRef(task.assignee);
  const prevTaskIdForAutoAssignRef = useRef(task.id);

  // task.id 전환 시 이전값 리셋
  useEffect(() => {
    prevReceiverRef.current = task.receiver;
    prevAssigneeRef.current = task.assignee;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // 메인 업무 담당자 변경 시 → 직군 매칭 세부업무 자동 반영
  // - 담당자가 비어있거나 이전 메인 담당자와 같으면 새 값으로 교체
  // - 수동으로 다른 사람 지정한 경우에는 유지
  useEffect(() => {
    // task.id가 바뀐 경우: localSubTaskDataRef는 아직 이전 태스크 데이터를 참조 중
    // 이 상태에서 저장하면 이전 태스크 데이터로 덮어씌워짐 → 저장 건너뜀
    const taskIdChanged = prevTaskIdForAutoAssignRef.current !== task.id;
    prevTaskIdForAutoAssignRef.current = task.id;
    if (taskIdChanged) return;

    const prevReceiver = prevReceiverRef.current;
    const prevAssignee = prevAssigneeRef.current;
    prevReceiverRef.current = task.receiver;
    prevAssigneeRef.current = task.assignee;

    if (!subTaskTypes.length) return;

    // formConfig의 receiver/assignee department 설정 (설정 없는 파트도 있음)
    const builtins = formConfig ? resolveBuiltinFields(formConfig) : [];
    const rcvrFc = builtins.find(f => f.key === 'receiver');
    const asgnFc = builtins.find(f => f.key === 'assignee');
    const rcvrDepts = rcvrFc ? resolveFieldDepts(rcvrFc) : null;
    const asgnDepts = asgnFc ? resolveFieldDepts(asgnFc) : null;

    // teamMembers로 receiver/assignee 각각의 실제 직군 파악 (formConfig 설정 없을 때 fallback)
    const rcvrMember = teamMembers?.find(m => m.name === task.receiver);
    const asgnMember = teamMembers?.find(m => m.name === task.assignee);
    const prevRcvrMember = teamMembers?.find(m => m.name === prevReceiver);
    const prevAsgnMember = teamMembers?.find(m => m.name === prevAssignee);

    // task.subTaskData(Firestore)를 base로, 로컬 편집값을 위에 올려 병합
    // localSubTaskData가 비어있을 때도 Firestore 데이터가 보존됨
    const current = { ...(task.subTaskData ?? {}), ...localSubTaskDataRef.current };
    let changed = false;
    const next: Record<string, SubTaskEntry> = { ...current };

    subTaskTypes.forEach(type => {
      const typeDepts = resolveFieldDepts(type);
      if (!typeDepts) return;
      const entry = next[type.id] ?? { assignee: '', weeklyHours: {}, totalHours: 0 };

      // 이 세부업무 직군에 매칭되는 메인 담당자(신규/이전) 결정
      let newAuto = '';
      let oldAuto = '';

      // 1순위: formConfig department 설정으로 매칭
      if (rcvrDepts && typeDepts.some(d => rcvrDepts.includes(d))) {
        newAuto = task.receiver ?? '';
        oldAuto = prevReceiver ?? '';
      } else if (asgnDepts && typeDepts.some(d => asgnDepts.includes(d))) {
        newAuto = task.assignee ?? '';
        oldAuto = prevAssignee ?? '';
      }

      // 2순위: teamMembers의 실제 department로 매칭 (formConfig 설정 없는 파트 fallback)
      if (!newAuto && !oldAuto) {
        if (rcvrMember?.department && typeDepts.includes(rcvrMember.department)) {
          newAuto = task.receiver ?? '';
          oldAuto = prevReceiver ?? '';
        } else if (asgnMember?.department && typeDepts.includes(asgnMember.department)) {
          newAuto = task.assignee ?? '';
          oldAuto = prevAssignee ?? '';
        } else if (prevRcvrMember?.department && typeDepts.includes(prevRcvrMember.department)) {
          newAuto = task.receiver ?? '';
          oldAuto = prevReceiver ?? '';
        } else if (prevAsgnMember?.department && typeDepts.includes(prevAsgnMember.department)) {
          newAuto = task.assignee ?? '';
          oldAuto = prevAssignee ?? '';
        }
      }

      if (!newAuto && !oldAuto) return;

      const cur = entry.assignee ?? '';
      // 비어있거나 이전 자동값과 같을 때만 업데이트
      if ((!cur || cur === oldAuto) && newAuto !== cur) {
        next[type.id] = { ...entry, assignee: newAuto };
        changed = true;
      }
    });

    if (changed) {
      commitSubTaskData(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.receiver, task.assignee, task.id, subTaskTypes]);

  const handleClose = () => {
    setVisible(false);
    document.documentElement.style.setProperty('--detail-panel-w', '0px');
    setTimeout(onClose, 260);
  };

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) onUpdate(task.id, { title: trimmed });
    else setTitle(task.title);
  };

  const handleMetaBlur = (key: string, val: string) => {
    const prev = task.customFields?.[key] ?? '';
    if (val !== prev) {
      const next = { ...(task.customFields ?? {}), [key]: val };
      if (!val) delete next[key];
      onUpdate(task.id, { customFields: next });
    }
  };

  const saveSubTaskData = (next: Record<string, SubTaskEntry>, allowEmpty = false) => {
    // 빈 object 저장 방지 — 로딩 중 localSubTaskData가 아직 안 채워진 상태에서 실수로
    // {}를 Firestore에 덮어쓰는 사고를 막기 위한 가드. 세부업무를 의도적으로 전부
    // 삭제하는 경우(allowEmpty=true)는 예외적으로 통과시켜야 함 — 안 그러면 삭제가
    // 화면에서만 사라지고 totalHours/subTaskData는 Firestore에 유령 데이터로 남음.
    if (Object.keys(next).length === 0 && !allowEmpty) return;
    const finalNext: Record<string, SubTaskEntry> = {};
    Object.keys(next).forEach(key => {
      const e = next[key];
      if (e.checkedItems !== undefined) {
        const agg = aggregateReviewToWeekly(e.reviewWeeklyHours ?? {}, e.reviewDates ?? {}, e.checkedItems);
        const rs = e.reviewStatus ?? {};
        let autoStatus: TaskStatus = '진행 전';
        if (e.checkedItems.length > 0) {
          const statuses = e.checkedItems.map(id => rs[id] ?? '검수 전');
          if (statuses.every(s => s === '검수 완료')) autoStatus = '완료';
          else if (statuses.some(s => s !== '검수 전')) autoStatus = '진행 중';
        }
        finalNext[key] = { ...e, weeklyHours: agg.weeklyHours, totalHours: agg.totalHours, status: autoStatus, ...(agg.startDate ? { startDate: agg.startDate, endDate: agg.endDate } : {}) };
      } else {
        finalNext[key] = e;
      }
    });
    const totalHours = Object.values(finalNext).reduce((sum, e) => sum + e.totalHours, 0);
    onUpdate(task.id, { subTaskData: finalNext, totalHours });
  };

  // localSubTaskData를 갱신 + 저장하면서, 이번 호출로 실제로 바뀐 세부업무 타입(키)을
  // dirty로 표시한다. dirty 표시된 키는 이후 서버 동기화 이펙트가 건드리지 않으므로,
  // "동시에 다른 세부업무 타입을 편집 중인 다른 사람의 값을 내가 저장할 때 되돌려
  // 지우는" 문제를 막는다.
  const commitSubTaskData = (next: Record<string, SubTaskEntry>, allowEmpty = false) => {
    const prev = localSubTaskDataRef.current;
    Object.keys(next).forEach(key => {
      if (next[key] !== prev[key]) dirtyTypeIdsRef.current.add(key);
    });
    setLocalSubTaskData(next);
    saveSubTaskData(next, allowEmpty);
  };

  const [pendingDeleteTask, setPendingDeleteTask] = useState(false);

  const handleDelete = () => setPendingDeleteTask(true);

  const categoryColor = parts.find(p => p.name === task.category)?.color ?? CAT_DOT[task.category] ?? 'bg-gray-400';

  // 세부업무 & 주차별 시간: 권한/삭제/숨김 기준으로 실제 노출 대상만 추림
  const visibleSubTaskTypes = subTaskTypes.filter(type => {
    if (deletedSubTaskIds.has(type.id)) return false;
    if (type.showInDetail === false) return false;
    if ((task.hiddenSubTaskTypeIds ?? []).includes(type.id)) return false;
    if (canSeeAll) return true;
    const filterEntry = { ...(task.subTaskData?.[type.id] ?? {}), ...(localSubTaskData[type.id] ?? {}) };
    return filterEntry.assignee === currentUserName || filterEntry.substitute === currentUserName;
  });
  // 직군 지정된 세부업무가 2개 이상의 직군에 걸쳐 있을 때만 탭으로 분리.
  // 직군 미지정 세부업무(공통)는 모든 탭에 항상 표시.
  // 주의: teamMembers는 "현재 팀의 기본 소속원" 기준이라, 접속 시 기본 팀이 아닌
  // 다른 팀(내가 추가로 선택만 해둔 팀)에서는 내가 목록에 없어 department를 못 찾음.
  // 직군은 팀과 무관한 사용자 개인 속성이므로 currentUserDept를 그대로 사용한다.
  const myDept = currentUserDept ?? teamMembers?.find(m => m.name === currentUserName)?.department;
  const DEPT_TAB_ORDER: Department[] = ['기획', '디자인', '퍼블'];
  const presentDepts = DEPT_TAB_ORDER.filter(d => visibleSubTaskTypes.some(t => t.department === d));
  const orderedDepts = myDept && presentDepts.includes(myDept)
    ? [myDept, ...presentDepts.filter(d => d !== myDept)]
    : presentDepts;
  const showDeptTabs = orderedDepts.length >= 2;
  const activeDept = showDeptTabs
    ? (activeDeptTab && orderedDepts.includes(activeDeptTab) ? activeDeptTab : orderedDepts[0])
    : null;
  const displayedSubTaskTypes = showDeptTabs
    ? visibleSubTaskTypes.filter(t => !t.department || t.department === activeDept)
    : visibleSubTaskTypes;

  return (
    // width 0→PANEL_W 확장: 왼쪽 라운드 고정, 오른쪽으로 열림 → 패딩 이동과 완벽 동기화
    <div
      style={{
        position: 'fixed',
        left: 232,
        top: 12,
        bottom: 12,
        width: visible ? panelW : 0,
        transition: 'width 0.26s ease-out',
        zIndex: 30,
        borderRadius: '28px 0 0 28px',
        overflow: 'hidden',
        // 아래 본문과 확실히 구분되도록 그림자 대신 테두리 색으로 표시
        border: '1px solid rgba(108,99,255,0.28)',
      }}
    >
    <div style={{ width: panelW, height: '100%', display: 'flex', flexDirection: 'row' }}>
    <div
      style={{ width: PANEL_W, height: '100%', background: '#FFFFFF', flexShrink: 0 }}
      className="flex flex-col border-r border-[#E5E0F5]"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-black/[0.08] flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${categoryColor}`} />
        <span className="text-xs text-gray-600 font-medium truncate flex-1">
          {task.category || '파트 없음'} · {task.type}
        </span>
        <button
          onClick={() => {
            if (!mailOpen) regenerateMail(task);
            setMailOpen(o => !o);
          }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
            mailOpen ? 'bg-[#6C63FF]/10 text-[#6C63FF]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          메일 양식 설정하기
        </button>
        <button onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
          <X size={15} />
        </button>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto">

        {/* 제목 */}
        <div className="px-5 pt-3 pb-2">
          <textarea
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); titleRef.current?.blur(); } }}
            readOnly={!canManage}
            rows={1}
            className="w-full text-[17px] font-bold text-gray-900 bg-transparent border-none resize-none focus:outline-none leading-snug placeholder:text-gray-300"
            placeholder={fieldLabel('title')}
          />
        </div>

        {/* 속성 - 컴팩트 그리드 */}
        <div className="px-5 pb-1 border-b border-black/[0.08]">
          {/* 행 1: 월 / (유형·상태 — formConfig 순서) */}
          {(() => {
            const row1Fields = builtinFields.filter(f => (f.key === 'type' || f.key === 'status') && bfVisible(f.key));
            const showTaskMonth = bfVisible('taskMonth');
            const renderField = (fc: typeof builtinFields[0]) => {
              const lbl = fc.customLabel ?? BUILTIN_FIELDS_META.find(m => m.key === fc.key)?.label ?? fc.key;
              if (fc.key === 'status') {
                if (fc.customType === 'select' && fc.options?.length) {
                  const firstOpt = fc.options[0] ?? '';
                  const effStatus = (task.status as string) || firstOpt;
                  const custColor = fc.optionColors?.[effStatus];
                  const fallbackSc = statusConfigs.find(s => s.key.replace(/\s/g,'') === effStatus.replace(/\s/g,'')) ?? statusConfigs[0];
                  const bg = custColor?.bg ?? fallbackSc?.bg;
                  const textColor = custColor?.text ?? fallbackSc?.text;
                  return (
                    <div key="status">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{lbl}</p>
                      {canManage ? (
                        <div className="relative block w-full">
                          <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer"
                            style={{ backgroundColor: bg, color: textColor }}>
                            <span>{effStatus}</span><ChevronDown size={9} />
                          </div>
                          <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={effStatus}
                            onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                            {fc.options.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                      ) : (
                        <span className="flex w-full px-2.5 py-0.5 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: bg, color: textColor }}>
                          {effStatus}
                        </span>
                      )}
                    </div>
                  );
                }
                const sc = statusConfigs.find(s => s.key === task.status) ?? statusConfigs[0];
                return (
                  <div key="status">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{lbl}</p>
                    {canManage ? (
                      <div className="relative block w-full">
                        <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{ backgroundColor: sc?.bg, color: sc?.text }}>
                          <span>{sc?.label ?? task.status}</span><ChevronDown size={9} />
                        </div>
                        <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={task.status}
                          onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                          {statusConfigs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="flex w-full px-2.5 py-0.5 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: sc?.bg, color: sc?.text }}>
                        {sc?.label ?? task.status}
                      </span>
                    )}
                  </div>
                );
              }
              // type
              const typeOptsBase = fc.customType === 'select' && fc.options?.length ? fc.options : TYPES as string[];
              const typeOpts = (() => {
                if (!fc.dependsOn?.fieldId) return typeOptsBase;
                const { fieldId, valueMap } = fc.dependsOn;
                const pVal = ['taskMonth','title','category','type','status','receiver','assignee','startDate','endDate'].includes(fieldId)
                  ? String((task as Record<string, unknown>)[fieldId] ?? '')
                  : (task.customFields?.[fieldId] ?? '');
                return (pVal && valueMap[pVal]) ? valueMap[pVal] : typeOptsBase;
              })();
              const typeColor = fc.optionColors?.[task.type];
              return (
                <div key="type">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{lbl}</p>
                  {canManage ? (
                    typeColor ? (
                      <div className="relative block w-full">
                        <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                          <span>{task.type}</span><ChevronDown size={9} />
                        </div>
                        <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={task.type}
                          onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}>
                          {typeOpts.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="relative block w-full">
                        <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer bg-gray-100 text-gray-600">
                          <span>{task.type}</span><ChevronDown size={9} />
                        </div>
                        <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={task.type}
                          onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}>
                          {typeOpts.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    )
                  ) : (
                    typeColor ? (
                      <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                        {task.type}
                      </span>
                    ) : <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">{task.type}</span>
                  )}
                </div>
              );
            };
            const taskMonthItem = showTaskMonth ? (
              <div key="taskMonth">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">월</p>
                {canManage ? (
                  <select className="text-sm text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5 w-full"
                    value={task.taskMonth ?? ''}
                    onChange={e => onUpdate(task.id, { taskMonth: e.target.value })}>
                    <option value="">-</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, '0');
                      const year = task.taskMonth?.slice(0, 4) ?? new Date().getFullYear().toString();
                      return <option key={i} value={`${year}-${m}`}>{i + 1}월</option>;
                    })}
                  </select>
                ) : <span className="text-sm text-gray-700">{task.taskMonth ? `${parseInt(task.taskMonth.slice(5))}월` : '-'}</span>}
              </div>
            ) : null;

            const categoryFc = builtinFields.find(f => f.key === 'category');
            const isCustomCategory = categoryFc?.customType === 'select' && !!categoryFc.options?.length && parts.length === 0;
            const showCategoryCol = (parts.length > 0 || isCustomCategory) && bfVisible('category');
            const showReceiverCol = bfVisible('receiver');
            const showAssigneeCol = bfVisible('assignee');

            const categoryItem = showCategoryCol ? (
              <div key="category">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{fieldLabel('category')}</p>
                {isCustomCategory ? (
                  (() => {
                    const custColor = categoryFc!.optionColors?.[task.category];
                    const partDotColor = parts.find(p => p.name === task.category)?.color ?? 'bg-gray-300';
                    return canManage ? (
                      <div className="relative block w-full">
                        {custColor ? (
                          <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer"
                            style={{ backgroundColor: custColor.bg, color: custColor.text }}>
                            <span className="truncate">{task.category || '-'}</span><ChevronDown size={9} />
                          </div>
                        ) : (
                          <div className={`flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer ${partBadgeCls(partDotColor)}`}>
                            <span className="truncate">{task.category || '-'}</span>
                            <ChevronDown size={9} className="flex-shrink-0" />
                          </div>
                        )}
                        <select className="absolute inset-0 opacity-0 cursor-pointer w-full"
                          value={task.category} onChange={e => onUpdate(task.id, { category: e.target.value })}>
                          <option value="">-</option>
                          {parts.length > 0
                            ? parts.map(p => <option key={p.id}>{p.name}</option>)
                            : categoryFc!.options!.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ) : (
                      custColor ? (
                        <span className="flex w-full px-2.5 py-0.5 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: custColor.bg, color: custColor.text }}>
                          {task.category || '-'}
                        </span>
                      ) : (
                        <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium ${partBadgeCls(partDotColor)}`}>
                          {task.category || '-'}
                        </span>
                      )
                    );
                  })()
                ) : canManage ? (
                  <select className="text-sm text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5 w-full truncate"
                    value={task.category} onChange={e => onUpdate(task.id, { category: e.target.value })}>
                    {parts.map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                ) : <span className="text-sm text-gray-700">{task.category}</span>}
              </div>
            ) : null;

            const receiverItem = showReceiverCol ? (
              <div key="receiver">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{fieldLabel('receiver')}</p>
                {canManage ? (
                  isReceiverCustomSelect ? (
                    <div className="relative flex items-center gap-1 cursor-pointer">
                      <span className="text-sm text-gray-700 truncate">{task.receiver || '-'}</span>
                      <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.receiver} onChange={e => onUpdate(task.id, { receiver: e.target.value })}>
                        <option value="">-</option>
                        {receiverFc!.options!.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-1 cursor-pointer">
                      <MiniAvatar name={task.receiver} photoURL={userPhotoMap?.get(task.receiver)} />
                      <span className="text-sm text-gray-600 truncate">{task.receiver || '-'}</span>
                      <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.receiver} onChange={e => onUpdate(task.id, { receiver: e.target.value })}>
                        <option value="">-</option>
                        {filteredByDept('receiver').map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                  )
                ) : isReceiverCustomSelect
                  ? <span className="text-sm text-gray-700">{task.receiver || '-'}</span>
                  : <span className="flex items-center gap-1"><MiniAvatar name={task.receiver} photoURL={userPhotoMap?.get(task.receiver)} /><span className="text-sm text-gray-600">{task.receiver}</span></span>}
              </div>
            ) : null;

            const assigneeItem = showAssigneeCol ? (
              <div key="assignee">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{fieldLabel('assignee')}</p>
                {canManage ? (
                  isAssigneeCustomSelect ? (
                    <div className="relative flex items-center gap-1 cursor-pointer">
                      <span className="text-sm text-gray-700 truncate">{task.assignee || '-'}</span>
                      <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.assignee} onChange={e => onUpdate(task.id, { assignee: e.target.value })}>
                        <option value="">-</option>
                        {assigneeFc!.options!.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-1 cursor-pointer">
                      <MiniAvatar name={task.assignee} photoURL={userPhotoMap?.get(task.assignee)} />
                      <span className="text-sm text-gray-700 truncate">{task.assignee || '-'}</span>
                      <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.assignee} onChange={e => onUpdate(task.id, { assignee: e.target.value })}>
                        <option value="">-</option>
                        {filteredByDept('assignee').map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                  )
                ) : isAssigneeCustomSelect
                  ? <span className="text-sm text-gray-700">{task.assignee || '-'}</span>
                  : <span className="flex items-center gap-1"><MiniAvatar name={task.assignee} photoURL={userPhotoMap?.get(task.assignee)} /><span className="text-sm text-gray-700">{task.assignee}</span></span>}
              </div>
            ) : null;

            // 모든 속성 필드를 하나의 순서(월 → 유형/상태 → 파트 → 담당자/접수자)로 모아
            // 팀마다 활성화된 필드 개수가 달라도 항상 균형 있게 줄바꿈되게 함
            const items = [
              taskMonthItem,
              ...row1Fields.map(fc => renderField(fc)),
              categoryItem,
              ...(receiverFirst ? [receiverItem, assigneeItem] : [assigneeItem, receiverItem]),
            ].filter(el => el !== null);
            if (items.length === 0) return null;

            // 한 줄 최대 3개, 단 마지막 줄에 1개만 남으면(예: 4개→3+1) 앞 줄에서 하나 덜어와 2+2로 균형 맞춤
            const rows = [];
            let remaining = items;
            while (remaining.length > 0) {
              let take = Math.min(3, remaining.length);
              if (remaining.length - take === 1) take -= 1;
              rows.push(remaining.slice(0, take));
              remaining = remaining.slice(take);
            }

            return rows.map((row, i) => (
              <div key={i}
                className={`grid gap-x-3 py-2.5 border-b border-gray-100 ${row.length === 1 ? 'grid-cols-1' : row.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {row}
              </div>
            ));
          })()}

          {/* 행 3: 기간 */}
          {(bfVisible('startDate') || bfVisible('endDate')) && (
            <div className="py-2.5">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">기간</p>
              <div className="flex items-center gap-2">
                {bfVisible('startDate') && <DatePicker value={task.startDate ?? ''} onChange={v => onUpdate(task.id, { startDate: v })} disabled={!canManage} />}
                {bfVisible('startDate') && bfVisible('endDate') && <span className="text-gray-300 text-xs">→</span>}
                {bfVisible('endDate') && <DatePicker value={task.endDate ?? ''} onChange={v => onUpdate(task.id, { endDate: v })} disabled={!canManage} />}
              </div>
            </div>
          )}

          {/* 행 4: 수정단계 항목별 횟수 (활성화된 경우만, PL업무 제외) */}
          {!task.plTask && builtinFields.find(f => f.key === 'revisionLevel')?.enabled && bfVisible('revisionLevel') && (
            <div className="py-2.5 border-t border-gray-100">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                {builtinFields.find(f => f.key === 'revisionLevel')?.customLabel ?? '수정단계'}
              </p>
              <div className="space-y-1.5">
                {revisionSteps.map(step => {
                  const key = step.id;
                  const label = step.label;
                  const count = task.revisionCounts?.[key] ?? 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white bg-blue-500 rounded px-1.5 py-0.5 flex-shrink-0 min-w-7 text-center">{step.code}</span>
                      <span className="text-xs text-gray-600 flex-1 truncate">{label}</span>
                      {canManage ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button type="button"
                            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 text-sm leading-none"
                            onClick={() => {
                              if (count <= 0) return;
                              const next = { ...(task.revisionCounts ?? {}), [key]: count - 1 };
                              if (next[key] === 0) delete next[key];
                              onUpdate(task.id, { revisionCounts: next });
                            }}>−</button>
                          <span className="text-xs font-semibold text-gray-700 w-6 text-center tabular-nums">{count}</span>
                          <button type="button"
                            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 text-sm leading-none"
                            onClick={() => {
                              const next = { ...(task.revisionCounts ?? {}), [key]: count + 1 };
                              onUpdate(task.id, { revisionCounts: next });
                            }}>+</button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-gray-700 w-6 text-center tabular-nums flex-shrink-0">{count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 세부업무 & 주차별 시간 */}
        <div className="px-5 py-3 border-t border-black/[0.08]">
          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2.5">세부업무 & 주차별 시간</p>
          {subTaskTypes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">팀 설정 → 세부 업무 탭에서 유형을 등록해주세요</p>
          ) : (
            <div className="space-y-3">
              {showDeptTabs && (
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  {orderedDepts.map(d => {
                    const isActive = activeDept === d;
                    return (
                      <button key={d} type="button"
                        onClick={() => setActiveDeptTab(d)}
                        className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${
                          isActive ? (DEPT_TAB_ACTIVE[d] ?? 'bg-gray-700 text-white') : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                        }`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
              {displayedSubTaskTypes.map(type => {
                // task.subTaskData(Firestore)를 base로, localSubTaskData를 위에 올려 병합
                // localSubTaskData가 {}이어도 Firestore의 startDate/weeklyHours 등이 보존됨
                const entry: SubTaskEntry = {
                  assignee: '', weeklyHours: {}, totalHours: 0,
                  ...(task.subTaskData?.[type.id] ?? {}),
                  ...(localSubTaskData[type.id] ?? {}),
                };
                const total = entry.startDate ? calcHoursInRange(entry.weeklyHours, entry.startDate, entry.endDate) : Object.values(entry.weeklyHours).reduce((a, b) => a + b, 0);
                const subTotal = entry.startDate ? calcHoursInRange(entry.substituteWeeklyHours ?? {}, entry.startDate, entry.endDate) : Object.values(entry.substituteWeeklyHours ?? {}).reduce((a, b) => a + b, 0);
                const isVacation = isAssigneeOnVacation(entry.assignee);
                const isSubstituteUser = !!entry.substitute && entry.substitute === currentUserName;
                // 대무자 본인·전체조회 권한자뿐 아니라, 이 업무를 관리할 수 있는 사람(대무 지정자 본인)도
                // 방금 지정한 대무자의 시간을 바로 입력할 수 있어야 함
                const canEditSubstituteHours = isSubstituteUser || canSeeAll || canManage;

                // 직군에 맞는 담당자 필터링 (복수 직군 지원)
                const typeDepts = resolveFieldDepts(type);
                const filtered = typeDepts && teamMembers?.length
                  ? teamMembers.filter(m => m.department && typeDepts.includes(m.department)).map(m => m.name)
                  : null;
                const displayAssignees = (filtered && filtered.length > 0) ? filtered : assignees;

                // 시작/종료일 기준 비활성 컬럼 계산
                const sd = entry.startDate ? new Date(entry.startDate) : null;
                const sdDow = sd ? sd.getDay() : 1;
                const startDayIdx = !sd ? 0 : (sdDow === 0 || sdDow === 6) ? 0 : sdDow - 1;
                const ed = entry.endDate ? new Date(entry.endDate) : null;
                const edDow = ed ? ed.getDay() : 0;
                const endDayIdx = !ed ? 4 : (edDow === 0 || edDow === 6) ? 4 : edDow - 1;
                const weeks = getWeekDays(entry.startDate ?? '', entry.endDate);

                // review 타입: 메인업무 다중 선택 체크리스트
                if (type.plFieldType === 'review') {
                  const checked: string[] = entry.checkedItems ?? [];
                  const reviewWeeklyHours: Record<string, Record<string, number>> = entry.reviewWeeklyHours ?? {};
                  const reviewDates: Record<string, { startDate?: string; endDate?: string }> = entry.reviewDates ?? {};
                  const reviewStatus: Record<string, string> = entry.reviewStatus ?? {};

                  const reviewTotal = calcReviewTotal(reviewWeeklyHours, reviewDates, checked);

                  const toggleItem = (id: string) => {
                    const next = checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id];
                    const nextWh = { ...reviewWeeklyHours };
                    const nextDates = { ...reviewDates };
                    const nextRs = { ...reviewStatus };
                    if (!next.includes(id)) { delete nextWh[id]; delete nextDates[id]; delete nextRs[id]; }
                    const newTotal = calcReviewTotal(nextWh, nextDates, next);
                    const nextEntry = { ...entry, checkedItems: next, reviewWeeklyHours: nextWh, reviewDates: nextDates, reviewStatus: nextRs, totalHours: newTotal };
                    const nextData = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: nextEntry };
                    commitSubTaskData(nextData);
                  };

                  const setDate = (id: string, field: 'startDate' | 'endDate', val: string) => {
                    const nextDates = { ...reviewDates, [id]: { ...(reviewDates[id] ?? {}), [field]: val || undefined } };
                    const newTotal = calcReviewTotal(reviewWeeklyHours, nextDates, checked);
                    const nextEntry = { ...entry, reviewDates: nextDates, totalHours: newTotal };
                    const nextData = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: nextEntry };
                    commitSubTaskData(nextData);
                  };

                  const setItemStatus = (id: string, status: string) => {
                    const nextRs = { ...reviewStatus, [id]: status };
                    const nextEntry = { ...entry, reviewStatus: nextRs };
                    const nextData = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: nextEntry };
                    commitSubTaskData(nextData);
                  };

                  const items = reviewTasks ?? [];
                  return (
                    <div key={type.id} className="rounded-xl bg-gray-50 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{type.name}</span>
                        {resolveFieldDepts(type)?.map(d => (
                          <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${DEPT_BADGE[d] ?? ''}`}>{d}</span>
                        ))}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium flex-shrink-0">검수</span>
                        {checked.length > 0 && (
                          <span className="text-[10px] text-gray-400">{checked.length}/{items.length}</span>
                        )}
                        {reviewTotal > 0 && (
                          <span className="text-[10px] font-medium text-violet-600">{reviewTotal}h</span>
                        )}
                      </div>
                      {items.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">등록된 업무가 없습니다</p>
                      ) : (
                        <div className="space-y-1">
                          {items.map(rt => {
                            const isChecked = checked.includes(rt.id);
                            const rtDates = reviewDates[rt.id] ?? {};
                            const rtWeeklyHours = reviewWeeklyHours[rt.id] ?? {};
                            const rtTotal = rtDates.startDate
                              ? calcHoursInRange(rtWeeklyHours, rtDates.startDate, rtDates.endDate)
                              : Object.values(rtWeeklyHours).reduce((a, b) => a + b, 0);
                            const rtWeeks = rtDates.startDate ? getWeekDays(rtDates.startDate, rtDates.endDate) : [];
                            const rtSd = rtDates.startDate ? new Date(rtDates.startDate) : null;
                            const rtSdDow = rtSd ? rtSd.getDay() : 1;
                            const rtStartDayIdx = !rtSd ? 0 : (rtSdDow === 0 || rtSdDow === 6) ? 0 : rtSdDow - 1;
                            const rtEd = rtDates.endDate ? new Date(rtDates.endDate) : null;
                            const rtEdDow = rtEd ? rtEd.getDay() : 0;
                            const rtEndDayIdx = !rtEd ? 4 : (rtEdDow === 0 || rtEdDow === 6) ? 4 : rtEdDow - 1;
                            return (
                              <div key={rt.id} className={`rounded-lg text-xs transition-colors ${isChecked ? 'bg-violet-50' : 'bg-white'}`}>
                                <div className="flex items-center gap-2 px-2.5 py-1.5">
                                  <button type="button" disabled={!canManage}
                                    onClick={() => toggleItem(rt.id)}
                                    className="flex-shrink-0">
                                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                                      isChecked ? 'bg-violet-500 border-violet-500 text-white' : 'border-gray-300 hover:border-violet-400'
                                    }`}>
                                      {isChecked && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </span>
                                  </button>
                                  <span className={`flex-1 min-w-0 truncate ${isChecked ? 'text-violet-700 font-medium' : 'text-gray-600'}`}>{rt.title}</span>
                                  {rt.taskMonth && <span className="text-[10px] text-gray-400 flex-shrink-0">{rt.taskMonth}</span>}
                                  {rtTotal > 0 && (
                                    <span className="text-[10px] font-medium text-violet-500 flex-shrink-0">{rtTotal}h</span>
                                  )}
                                  {isChecked && (() => {
                                    const rs = (reviewStatus[rt.id] ?? '검수 전') as ReviewStatus;
                                    return (
                                      <div className="relative flex-shrink-0">
                                        <div className={`flex items-center gap-1 text-[10px] px-1.5 py-px rounded font-medium ${REVIEW_STATUS_STYLE[rs]}`}>
                                          <span>{rs}</span>
                                          <ChevronDown size={8} />
                                        </div>
                                        <select
                                          disabled={!canManage}
                                          value={rs}
                                          onChange={e => { e.stopPropagation(); setItemStatus(rt.id, e.target.value); }}
                                          className="absolute inset-0 opacity-0 w-full h-full disabled:cursor-default"
                                          style={{ cursor: canManage ? 'pointer' : 'default' }}>
                                          {REVIEW_STATUSES.map(s => <option key={s}>{s}</option>)}
                                        </select>
                                      </div>
                                    );
                                  })()}
                                </div>
                                {isChecked && (
                                  <div className="px-2.5 pb-2.5 space-y-2">
                                    {/* 날짜 */}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-violet-500 w-10 flex-shrink-0">날짜</span>
                                      <DatePicker
                                        value={rtDates.startDate ?? ''}
                                        onChange={v => setDate(rt.id, 'startDate', v)}
                                        disabled={!canManage}
                                        btnClassName="flex-1 text-xs px-2 py-0.5 rounded-md border border-violet-200 bg-white text-violet-700 disabled:opacity-50"
                                      />
                                      <span className="text-gray-300 text-xs flex-shrink-0">→</span>
                                      <DatePicker
                                        value={rtDates.endDate ?? ''}
                                        onChange={v => setDate(rt.id, 'endDate', v)}
                                        disabled={!canManage}
                                        btnClassName="flex-1 text-xs px-2 py-0.5 rounded-md border border-violet-200 bg-white text-violet-700 disabled:opacity-50"
                                      />
                                    </div>
                                    {/* 주/요일 시간 그리드 */}
                                    {!rtDates.startDate ? (
                                      <p className="text-[11px] text-violet-400 text-center py-1">시작일을 설정하면 시간을 입력할 수 있습니다</p>
                                    ) : (
                                      <>
                                        <div className="grid grid-cols-[28px_repeat(5,1fr)] gap-x-1">
                                          <span />
                                          {['월', '화', '수', '목', '금'].map(d => (
                                            <span key={d} className="text-center text-[10px] font-medium text-violet-400">{d}</span>
                                          ))}
                                        </div>
                                        {rtWeeks.map(({ weekLabel, days }, wi) => {
                                          const weekNum = wi + 1;
                                          const isLastRtWeek = wi === rtWeeks.length - 1;
                                          return (
                                            <div key={wi} className="grid grid-cols-[28px_repeat(5,1fr)] gap-x-1">
                                              <div className="flex flex-col items-center justify-center">
                                                <span className="text-[10px] font-semibold text-violet-500 leading-none">{weekNum}주</span>
                                                {weekLabel && <span className="text-[8px] text-violet-300 leading-tight mt-0.5">{weekLabel}</span>}
                                              </div>
                                              {days.map(({ date }, di) => {
                                                const wKey = `w${weekNum}d${di + 1}`;
                                                const rawKey = `${type.id}_rev_${rt.id}_${wKey}`;
                                                const cellVal = rtWeeklyHours[wKey] ?? 0;
                                                const disabled = (wi === 0 && di < rtStartDayIdx) || (isLastRtWeek && rtDates.endDate ? di > rtEndDayIdx : false);
                                                return (
                                                  <div key={di} className="flex flex-col items-center gap-0.5">
                                                    <span className={`text-[8px] leading-none ${disabled ? 'text-violet-200' : 'text-violet-300'}`}>
                                                      {date || ' '}
                                                    </span>
                                                    {canManage && !disabled ? (
                                                      <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={rawKey in localRaw ? localRaw[rawKey] : (cellVal === 0 ? '' : String(cellVal))}
                                                        placeholder="-"
                                                        onChange={e => {
                                                          const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                                          setLocalRaw(prev => ({ ...prev, [rawKey]: raw }));
                                                          const n = Math.min(24, parseFloat(raw) || 0);
                                                          const newRtHours = { ...rtWeeklyHours, [wKey]: n };
                                                          if (n === 0) delete newRtHours[wKey];
                                                          setLocalSubTaskData(prev => {
                                                            const base = { ...(task.subTaskData ?? {}), ...prev };
                                                            const cur = base[type.id] ?? entry;
                                                            const curWh = { ...(cur.reviewWeeklyHours ?? {}), [rt.id]: newRtHours };
                                                            const curDates = cur.reviewDates ?? {};
                                                            const newTotal = calcReviewTotal(curWh, curDates, cur.checkedItems ?? []);
                                                            const next = { ...base, [type.id]: { ...cur, reviewWeeklyHours: curWh, totalHours: newTotal } };
                                                            dirtyTypeIdsRef.current.add(type.id);
                                                            localSubTaskDataRef.current = next;
                                                            return next;
                                                          });
                                                        }}
                                                        onBlur={() => {
                                                          setLocalRaw(prev => { const next = { ...prev }; delete next[rawKey]; return next; });
                                                          saveSubTaskData(localSubTaskDataRef.current);
                                                        }}
                                                        className="w-full text-center text-[10px] bg-violet-100 rounded py-0.5 border-none focus:outline-none focus:ring-1 focus:ring-violet-400/50 text-violet-800 placeholder:text-violet-300"
                                                      />
                                                    ) : (
                                                      <span className={`w-full text-center text-[10px] rounded py-0.5 ${
                                                        disabled ? 'bg-violet-50/50 text-violet-200' : 'bg-violet-100 text-violet-600'
                                                      }`}>
                                                        {!disabled && cellVal > 0 ? cellVal : <span className="opacity-30">-</span>}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          );
                                        })}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={type.id} className="rounded-xl bg-gray-50 p-3">
                    {/* 헤더: 이름 + 직군 배지 + 상태 + 담당자 + 총시간 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{type.name}</span>
                      {resolveFieldDepts(type)?.map(d => (
                        <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${DEPT_BADGE[d] ?? ''}`}>{d}</span>
                      ))}
                      {/* 세부업무 상태 선택 */}
                      {(() => {
                        const subKey = (entry.status ?? '진행 전') as TaskStatus;
                        const subSc = statusConfigs.find(s => s.key === subKey) ?? statusConfigs[0];
                        return (
                          <div className="relative flex-shrink-0">
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium cursor-pointer"
                              style={{ backgroundColor: subSc?.bg, color: subSc?.text }}>
                              <span>{subSc?.label ?? subKey}</span>
                              <ChevronDown size={9} />
                            </div>
                            <select
                              disabled={!canManage}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full disabled:cursor-default"
                              value={subKey}
                              onChange={e => {
                                const next = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: { ...entry, status: e.target.value as TaskStatus } };
                                commitSubTaskData(next);
                              }}>
                              {statusConfigs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                          </div>
                        );
                      })()}
                      {(() => {
                        const typeDeptLabel = '-';
                        return (
                          <div className="relative max-w-[120px]">
                            <div className="flex items-center justify-between gap-1 px-2 py-1 rounded-lg text-xs text-gray-600 bg-gray-100">
                              <span className="truncate">{entry.assignee || typeDeptLabel}</span>
                              {isVacation && (
                                <span className="text-[9px] px-1 rounded font-medium bg-orange-100 text-orange-500 flex-shrink-0">휴가</span>
                              )}
                              <ChevronDown size={10} className="flex-shrink-0 text-gray-400" />
                            </div>
                            <select
                              disabled={!canManage}
                              className="absolute inset-0 opacity-0 w-full h-full disabled:cursor-default"
                              style={{ cursor: canManage ? 'pointer' : 'default' }}
                              value={entry.assignee ?? ''}
                              onChange={e => {
                                const next = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: { ...entry, assignee: e.target.value } };
                                commitSubTaskData(next);
                              }}>
                              <option value="">{typeDeptLabel}</option>
                              {displayAssignees.map(a => <option key={a}>{a}</option>)}
                            </select>
                          </div>
                        );
                      })()}
                      {total > 0 && (
                        <span className="text-xs font-semibold text-blue-500 flex-shrink-0">{total}h</span>
                      )}
                      {subTotal > 0 && (
                        <span className="text-xs font-semibold text-orange-400 flex-shrink-0">대무 {subTotal}h</span>
                      )}
                      {canManage && !isVacation && !entry.substitute && !manualSubstituteIds.has(type.id) && (
                        <button
                          type="button"
                          title="대무자 지정"
                          className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded text-orange-400 border border-orange-200 hover:bg-orange-50 transition-colors"
                          onClick={() => setManualSubstituteIds(prev => new Set(prev).add(type.id))}
                        >
                          + 대무
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          title="세부업무 삭제"
                          className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                          onClick={() => setPendingDeleteSubTask({ id: type.id, name: type.name })}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* 대무자 (담당자가 휴가이거나 대무자가 지정된 경우, 또는 수동으로 지정을 연 경우) */}
                    {(isVacation || entry.substitute || manualSubstituteIds.has(type.id)) && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-medium text-orange-500 flex-shrink-0">대무자</span>
                        <div className="relative max-w-[120px]">
                          <div className="flex items-center justify-between gap-1 px-2 py-1 rounded-lg text-xs text-gray-600 bg-orange-50 border border-orange-200">
                            <span className="truncate">{entry.substitute || '미지정'}</span>
                            <ChevronDown size={10} className="flex-shrink-0 text-orange-300" />
                          </div>
                          <select
                            disabled={!canManage}
                            className="absolute inset-0 opacity-0 w-full h-full disabled:cursor-default"
                            style={{ cursor: canManage ? 'pointer' : 'default' }}
                            value={entry.substitute ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              const next = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: { ...entry, substitute: val || undefined } };
                              commitSubTaskData(next);
                            }}>
                            <option value="">미지정</option>
                            {displayAssignees.filter(a => a !== entry.assignee).map(a => <option key={a}>{a}</option>)}
                          </select>
                        </div>
                        {canManage && !isVacation && (
                          <button
                            type="button"
                            title="대무자 지정 취소"
                            className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                            onClick={() => {
                              if (entry.substitute) {
                                const { substitute, substituteWeeklyHours, substituteTotalHours, ...rest } = entry;
                                const next = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: rest };
                                commitSubTaskData(next);
                              }
                              setManualSubstituteIds(prev => {
                                const next = new Set(prev);
                                next.delete(type.id);
                                return next;
                              });
                            }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* 시작일 / 종료일 */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] text-gray-500 flex-shrink-0">{fieldLabel('startDate')}</span>
                      <DatePicker
                        value={entry.startDate ?? ''}
                        onChange={v => {
                          const newStart = v;
                          const newEnd = entry.endDate;
                          const newTotal = newStart ? calcHoursInRange(entry.weeklyHours ?? {}, newStart, newEnd) : 0;
                          const newSubTotal = newStart ? calcHoursInRange(entry.substituteWeeklyHours ?? {}, newStart, newEnd) : 0;
                          const next = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: { ...entry, startDate: newStart, totalHours: newTotal, substituteTotalHours: newSubTotal || undefined } };
                          commitSubTaskData(next);
                        }}
                        disabled={!canManage}
                      />
                      <span className="text-gray-300 flex-shrink-0">→</span>
                      <DatePicker
                        value={entry.endDate ?? ''}
                        onChange={v => {
                          const newStart = entry.startDate ?? '';
                          const newEnd = v;
                          const newTotal = newStart ? calcHoursInRange(entry.weeklyHours ?? {}, newStart, newEnd) : 0;
                          const newSubTotal = newStart ? calcHoursInRange(entry.substituteWeeklyHours ?? {}, newStart, newEnd) : 0;
                          const next = { ...(task.subTaskData ?? {}), ...localSubTaskData, [type.id]: { ...entry, endDate: newEnd, totalHours: newTotal, substituteTotalHours: newSubTotal || undefined } };
                          commitSubTaskData(next);
                        }}
                        disabled={!canManage}
                      />
                    </div>

                    {/* 요일 헤더 + 주차 행 */}
                    {!entry.startDate ? (
                      <p className="text-[11px] text-gray-400 text-center py-1.5">{fieldLabel('startDate')}을 설정하면 {fieldLabel('weeklyHours')}을 입력할 수 있습니다</p>
                    ) : (
                    <>
                    {entry.substitute && (
                      <p className="text-[10px] font-semibold text-gray-500 mb-1">담당자 시간</p>
                    )}
                    <div className="grid grid-cols-[36px_repeat(5,1fr)] gap-x-1 mb-0.5">
                      <span />
                      {['월', '화', '수', '목', '금'].map(d => (
                        <span key={d} className="text-center text-[10px] font-medium text-gray-500">{d}</span>
                      ))}
                    </div>

                    {weeks.map(({ weekLabel, days }, wi) => {
                      const weekNum = wi + 1;
                      const isLastWeek = wi === weeks.length - 1;
                      return (
                        <div key={wi} className="grid grid-cols-[36px_repeat(5,1fr)] gap-x-1 mb-1">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[10px] font-semibold text-gray-600 leading-none">{weekNum}주</span>
                            {weekLabel && (
                              <span className="text-[8px] text-gray-400 leading-tight mt-0.5">{weekLabel}</span>
                            )}
                          </div>
                          {days.map(({ date }, di) => {
                            const key = `w${weekNum}d${di + 1}`;
                            const rawKey = `${type.id}_${key}`;
                            const val = entry.weeklyHours[key] ?? 0;
                            const disabled = (wi === 0 && di < startDayIdx) || (isLastWeek && entry.endDate ? di > endDayIdx : false);
                            return (
                              <div key={di} className="flex flex-col items-center gap-0.5">
                                <span className={`text-[8px] leading-none ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>
                                  {date || ' '}
                                </span>
                                {canManage && !disabled ? (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={rawKey in localRaw ? localRaw[rawKey] : (val === 0 ? '' : String(val))}
                                    placeholder="-"
                                    onChange={e => {
                                      const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                      setLocalRaw(prev => ({ ...prev, [rawKey]: raw }));
                                      const n = Math.min(24, parseFloat(raw) || 0);
                                      const newHours = { ...entry.weeklyHours, [key]: n };
                                      if (n === 0) delete newHours[key];
                                      setLocalSubTaskData(prev => {
                                        const base = { ...(task.subTaskData ?? {}), ...prev };
                                        const cur = base[type.id] ?? entry;
                                        const next = {
                                          ...base,
                                          [type.id]: { ...cur, weeklyHours: newHours, totalHours: cur.startDate ? calcHoursInRange(newHours, cur.startDate, cur.endDate) : Object.values(newHours).reduce((a, b) => a + b, 0) },
                                        };
                                        dirtyTypeIdsRef.current.add(type.id);
                                        localSubTaskDataRef.current = next;
                                        return next;
                                      });
                                    }}
                                    onBlur={() => {
                                      setLocalRaw(prev => { const next = { ...prev }; delete next[rawKey]; return next; });
                                      saveSubTaskData(localSubTaskDataRef.current);
                                    }}
                                    className="w-full text-center text-[10px] bg-black/[0.08] rounded py-0.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 text-gray-800 placeholder:text-gray-400"
                                  />
                                ) : (
                                  <span className={`w-full text-center text-[10px] rounded py-0.5 ${
                                    disabled
                                      ? 'bg-black/[0.02] text-gray-300'
                                      : 'bg-black/[0.08] text-gray-600'
                                  }`}>
                                    {!disabled && val > 0 ? val : <span className="opacity-30">-</span>}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* 대무자 시간 그리드 */}
                    {entry.substitute && (
                      <>
                        <div className="flex items-center gap-1.5 mt-2 mb-1">
                          <p className="text-[10px] font-semibold text-orange-500">대무자 시간</p>
                          <span className="text-[10px] text-orange-400">({entry.substitute})</span>
                        </div>
                        <div className="grid grid-cols-[36px_repeat(5,1fr)] gap-x-1 mb-0.5">
                          <span />
                          {['월', '화', '수', '목', '금'].map(d => (
                            <span key={d} className="text-center text-[10px] font-medium text-orange-300">{d}</span>
                          ))}
                        </div>
                        {weeks.map(({ weekLabel, days }, wi) => {
                          const weekNum = wi + 1;
                          const isLastWeek = wi === weeks.length - 1;
                          return (
                            <div key={wi} className="grid grid-cols-[36px_repeat(5,1fr)] gap-x-1 mb-1">
                              <div className="flex flex-col items-center justify-center">
                                <span className="text-[10px] font-semibold text-orange-300 leading-none">{weekNum}주</span>
                                {weekLabel && (
                                  <span className="text-[8px] text-orange-200 leading-tight mt-0.5">{weekLabel}</span>
                                )}
                              </div>
                              {days.map(({ date }, di) => {
                                const key = `w${weekNum}d${di + 1}`;
                                const rawKey = `${type.id}_sub_${key}`;
                                const val = (entry.substituteWeeklyHours ?? {})[key] ?? 0;
                                const disabled = (wi === 0 && di < startDayIdx) || (isLastWeek && entry.endDate ? di > endDayIdx : false);
                                return (
                                  <div key={di} className="flex flex-col items-center gap-0.5">
                                    <span className={`text-[8px] leading-none ${disabled ? 'text-orange-100' : 'text-orange-300'}`}>
                                      {date || ' '}
                                    </span>
                                    {canEditSubstituteHours && !disabled ? (
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={rawKey in localRaw ? localRaw[rawKey] : (val === 0 ? '' : String(val))}
                                        placeholder="-"
                                        onChange={e => {
                                          const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                          setLocalRaw(prev => ({ ...prev, [rawKey]: raw }));
                                          const n = Math.min(24, parseFloat(raw) || 0);
                                          const newHours = { ...(entry.substituteWeeklyHours ?? {}), [key]: n };
                                          if (n === 0) delete newHours[key];
                                          setLocalSubTaskData(prev => {
                                            const base = { ...(task.subTaskData ?? {}), ...prev };
                                            const cur = base[type.id] ?? entry;
                                            const next = {
                                              ...base,
                                              [type.id]: { ...cur, substituteWeeklyHours: newHours, substituteTotalHours: cur.startDate ? calcHoursInRange(newHours, cur.startDate, cur.endDate) : Object.values(newHours).reduce((a, b) => a + b, 0) },
                                            };
                                            dirtyTypeIdsRef.current.add(type.id);
                                            localSubTaskDataRef.current = next;
                                            return next;
                                          });
                                        }}
                                        onBlur={() => {
                                          setLocalRaw(prev => { const next = { ...prev }; delete next[rawKey]; return next; });
                                          saveSubTaskData(localSubTaskDataRef.current);
                                        }}
                                        className="w-full text-center text-[10px] bg-orange-50 rounded py-0.5 border border-orange-200 focus:outline-none focus:ring-1 focus:ring-orange-300 text-orange-700 placeholder:text-orange-200"
                                      />
                                    ) : (
                                      <span className={`w-full text-center text-[10px] rounded py-0.5 ${
                                        disabled
                                          ? 'bg-orange-50/30 text-orange-200'
                                          : 'bg-orange-50 text-orange-500'
                                      }`}>
                                        {!disabled && val > 0 ? val : <span className="opacity-30">-</span>}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </>
                    )}
                    </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 커스텀 폼 필드 */}
        {(() => {
          const enabledCfs = formConfig?.customFields?.filter(cf => cf.enabled !== false && cf.showIn !== 'list') ?? [];
          const fo = formConfig?.fieldOrder;
          const cfs = fo?.length
            ? [...enabledCfs].sort((a, b) => {
                const ai = fo.indexOf(a.id);
                const bi = fo.indexOf(b.id);
                const aIdx = ai === -1 ? Infinity : ai;
                const bIdx = bi === -1 ? Infinity : bi;
                return aIdx - bIdx;
              })
            : enabledCfs;
          if (cfs.length === 0) return null;
          const cls = "w-full text-xs text-gray-800 bg-black/[0.07] rounded-lg px-2.5 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder:text-gray-400 transition-colors";
          const linkInputCls = "flex-1 min-w-0 text-xs text-gray-800 bg-black/[0.07] rounded-lg px-2.5 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder:text-gray-400 transition-colors";
          return (
            <div className="px-5 py-3 border-t border-black/[0.08]">
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2.5">추가 정보</p>
              <div className="space-y-2">
                {cfs.map(cf => {
                  const val = (task.customFields as Record<string, string> | undefined)?.[cf.id] ?? '';
                  const handleBlur = (v: string) => {
                    onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: v } });
                  };
                  const cfType = cf.type as string;
                  const isNameType = cfType === 'name' || cfType === 'textarea' || cfType === '이름';
                  const cfDepts = isNameType ? resolveFieldDepts(cf) : null;
                  let opts = isNameType
                    ? (cfDepts && teamMembers?.length
                        ? teamMembers.filter(m => m.department && cfDepts.includes(m.department)).map(m => m.name)
                        : assignees)
                    : (cf.options ?? []);
                  if (cf.dependsOn && cfType === 'select') {
                    const builtinKeys = ['taskMonth', 'title', 'category', 'type', 'status', 'receiver', 'assignee', 'startDate', 'endDate'];
                    const pid = cf.dependsOn.fieldId;
                    const pVal = builtinKeys.includes(pid)
                      ? String((task as Record<string, unknown>)[pid] ?? '')
                      : (task.customFields?.[pid] ?? '');
                    const mapped = pVal ? cf.dependsOn.valueMap[pVal] : undefined;
                    if (mapped !== undefined) opts = mapped;
                  }
                  return (
                    <div key={cf.id} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 w-[96px] flex-shrink-0 truncate">{cf.label}</span>
                      <div className="flex-1 min-w-0">
                        {(isNameType || cfType === 'select') ? (
                          <div className="relative w-full">
                            {cfType === 'select' && cf.optionColors?.[val] ? (
                              <div className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium"
                                style={{ backgroundColor: cf.optionColors[val].bg, color: cf.optionColors[val].text }}>
                                <span className="truncate">{val || '-'}</span>
                                <ChevronDown size={11} className="flex-shrink-0 ml-1.5 opacity-60" />
                              </div>
                            ) : (
                              <div className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-gray-800 bg-black/[0.07]">
                                <span className="truncate">{val || '-'}</span>
                                <ChevronDown size={11} className="flex-shrink-0 ml-1.5 text-gray-400" />
                              </div>
                            )}
                            <select disabled={!canManage} value={val}
                              onChange={e => handleBlur(e.target.value)}
                              className="absolute inset-0 opacity-0 w-full h-full disabled:cursor-default" style={{ cursor: canManage ? 'pointer' : 'default' }}>
                              <option value="">-</option>
                              {opts.map(o => <option key={o}>{o}</option>)}
                            </select>
                          </div>
                        ) : cfType === 'date' ? (
                          <DatePicker value={val} onChange={handleBlur} disabled={!canManage} btnClassName={cls} />
                        ) : cfType === 'number' ? (
                          <input type="number" readOnly={!canManage} value={val}
                            onChange={e => handleBlur(e.target.value)}
                            onBlur={e => handleBlur(e.target.value)}
                            className={cls} />
                        ) : cfType === 'link' ? (
                          <div className="flex items-center gap-px">
                            <input type="url" readOnly={!canManage} value={val}
                              onChange={e => handleBlur(e.target.value)}
                              onBlur={e => handleBlur(e.target.value)}
                              placeholder="https://"
                              className={linkInputCls} />
                            {val && <a href={val} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-blue-400 hover:text-blue-500"><ExternalLink size={13} /></a>}
                          </div>
                        ) : (
                          <input type="text" readOnly={!canManage} value={val}
                            onChange={e => handleBlur(e.target.value)}
                            onBlur={e => handleBlur(e.target.value)}
                            placeholder="-"
                            className={cls} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 업무 정보 (PL업무 제외) */}
        {!task.plTask && <div className="px-5 py-3 border-t border-black/[0.08]">
          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2.5">업무 정보</p>
          <div className="space-y-2">
            {metaFields.map(({ key, label, isUrl, isPath }) => {
              const val = localMeta[key] ?? '';
              const displayVal = isPath ? convertPath(val) : val;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-600 w-[96px] flex-shrink-0 truncate">{label}</span>
                  <div className="flex-1 flex items-center gap-1 min-w-0">
                    <input
                      type={isUrl ? 'url' : 'text'}
                      readOnly={!canManage}
                      placeholder={canManage ? (isUrl ? 'https://' : isPath ? '경로 입력' : '-') : '-'}
                      value={isPath ? displayVal : val}
                      onChange={e => {
                        const raw = isPath ? e.target.value : e.target.value;
                        setLocalMeta(prev => ({ ...prev, [key]: raw }));
                      }}
                      onBlur={e => handleMetaBlur(key, isPath ? val : e.target.value)}
                      className="flex-1 min-w-0 text-xs text-gray-800 bg-black/[0.07] rounded-lg px-2.5 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder:text-gray-400 transition-colors font-mono"
                    />
                    {isUrl && val && (
                      <a href={val} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-400 hover:text-blue-500 transition-colors">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {isPath && displayVal && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(displayVal)}
                        title="경로 복사"
                        className="flex-shrink-0 text-gray-400 hover:text-orange-500 transition-colors">
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>}

        <div className="h-6" />
      </div>

      {/* 하단 액션 */}
      {(canManage || canDelete) && (
        <div className="px-5 py-3 border-t border-black/[0.08] flex justify-between items-center flex-shrink-0">
          <span className="text-[11px] text-gray-500">
            {task.updatedAt ? `수정 ${new Date(task.updatedAt).toLocaleDateString('ko-KR')}` : ''}
          </span>
          {(canDelete ?? canManage) && (
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
              <Trash2 size={12} /> 업무 삭제
            </button>
          )}
        </div>
      )}

    </div>

    {mailOpen && (
      <div style={{ width: MAIL_PANEL_W, height: '100%', flexShrink: 0, background: '#F4F0FE', borderLeft: '1px solid rgba(108,99,255,0.18)' }} className="flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/[0.08] flex-shrink-0">
          <span className="text-xs font-semibold text-gray-700">메일 양식</span>
          <button onClick={() => setMailOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">작성자</label>
            <div className="relative">
              <select
                value={mailAuthor}
                onChange={e => setMailAuthor(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 appearance-none"
              >
                <option value="">-</option>
                {(() => {
                  const planningMembers = (teamMembers ?? []).filter(m => m.department === '기획');
                  const names = (planningMembers.length > 0 ? planningMembers : (teamMembers ?? [])).map(m => m.name);
                  return names.map(n => <option key={n} value={n}>{n}</option>);
                })()}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {(() => {
            const currentPart = parts.find(p => p.name === task.category);
            const presets = currentPart?.mailFormConfig ?? [];
            const currentPreset = presets.find(p => p.id === mailPresetId) ?? presets[0];
            // 팀원 이름이면 등록된 이메일로 치환, 아니면(팀원이 아닌 이름이거나 처음부터
            // 외부 이메일 주소로 직접 입력된 값이면) 값 자체를 이메일로 간주
            const emailOf = (nameOrEmail: string) => {
              const member = teamMembers?.find(m => m.name === nameOrEmail);
              if (member?.email) return member.email;
              return nameOrEmail.includes('@') ? nameOrEmail : undefined;
            };

            return (
              <>
                {presets.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 mb-1 block">메일 유형 선택</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {presets.map(p => (
                        <button key={p.id} onClick={() => { setMailPresetId(p.id); setMailMessage(buildMailMessage(task, p.message ?? '', p.showTaskName ?? false)); setMailManualValues({}); }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            currentPreset?.id === p.id ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                          style={currentPreset?.id === p.id ? { background: p.color } : undefined}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {presets.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2 rounded-lg border border-dashed border-gray-200">
                    이 파트에는 메일 양식 탭이 없습니다. 설정 &gt; 팀 관리 &gt; 메일 양식에서 만들 수 있습니다.
                  </p>
                ) : (['to', 'cc'] as const).map(key => {
                  const label = key === 'to' ? '받는사람' : '참조';
                  const copied = key === 'to' ? toCopied : ccCopied;
                  const setCopied = key === 'to' ? setToCopied : setCcCopied;
                  const names = currentPreset?.[key] ?? [];
                  const emails = names.map(emailOf).filter((e): e is string => !!e);
                  return (
                    <div key={key}>
                      <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label}</label>
                      {names.length === 0 ? (
                        <p className="text-xs text-gray-400 px-3 py-2 rounded-lg border border-dashed border-gray-200">
                          이 탭에 설정된 인원이 없습니다.
                        </p>
                      ) : (() => {
                        // 목록을 다 펼쳐 보일 필요 없이 복사만 되면 되므로, 한 줄 분량만
                        // 보여주고 나머지는 "외 N명"으로 축약. 복사 버튼은 이메일과 같은
                        // 줄 우측 끝에 위치
                        const first = names[0];
                        const hasEmail = !!emailOf(first);
                        const restCount = names.length - 1;
                        return (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${hasEmail ? 'bg-white border border-gray-200 text-gray-700' : 'bg-red-50 border border-red-100 text-red-400'}`}>
                                {first}{!hasEmail && ' (이메일 없음)'}
                              </span>
                              {restCount > 0 && (
                                <span className="text-xs text-gray-400 flex-shrink-0">외 {restCount}명</span>
                              )}
                            </div>
                            {emails.length > 0 && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(emails.join(', '));
                                  setCopied(true);
                                  setTimeout(() => setCopied(false), 1500);
                                }}
                                className="flex-shrink-0 text-[11px] text-[#6C63FF] hover:text-[#5a52e0] font-medium flex items-center gap-1 px-2 py-1 rounded-md bg-[#6C63FF]/10 hover:bg-[#6C63FF]/15 border border-[#6C63FF]/20 transition-colors"
                              >
                                {copied ? <><Check size={10} /> 복사됨</> : <><Copy size={10} /> 이메일 복사</>}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </>
            );
          })()}
          <div className="flex-1 flex flex-col min-h-0">
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">본문</label>
            {/* 인사말/업무 정보 표/맺음말은 항상 업무 데이터로 다시 생성되는 미리보기(수정 불가),
                안내 문구만 자유 편집 가능한 textarea로 그 사이에 끼워 넣음 */}
            <div className="flex-1 min-h-[240px] overflow-y-auto text-[13px] px-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-800 leading-relaxed">
              <p>{buildMailGreeting(mailAuthor)}</p>
              <textarea
                value={mailMessage}
                onChange={e => setMailMessage(e.target.value)}
                rows={2}
                // 줄바꿈 문자 수가 아니라 실제 줄바꿈되어 보이는 만큼만 딱 맞게 높이가
                // 늘어나도록(불필요한 빈 줄 없이) field-sizing 사용, 미지원 브라우저는 rows=2로 대체
                style={{ fieldSizing: 'content' } as any}
                className="w-full mt-2 text-[13px] text-gray-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#6C63FF]/30 rounded resize-none leading-relaxed overflow-hidden"
              />
              {(() => {
                const currentPart = parts.find(p => p.name === task.category);
                const presets = currentPart?.mailFormConfig ?? [];
                const currentPreset = presets.find(p => p.id === mailPresetId) ?? presets[0];
                const statusLabel = statusConfigs.find(s => s.key === task.status)?.label ?? task.status ?? '';
                const rows = buildTaskInfoRows(task, statusLabel, currentPreset, mailManualValues);
                const showLabelColumn = currentPreset?.tableShowLabelColumn ?? true;
                return (
                  <div className="mt-3">
                    {currentPreset?.tableTitle && <p className="font-bold mb-1">[{currentPreset.tableTitle}]</p>}
                    <div className="overflow-x-auto">
                      <table className="text-[13px] leading-relaxed border-collapse w-full border border-gray-300">
                        <tbody>
                          {rows.map(r => {
                            // 이 행만 항목명을 숨기면(hideLabel) 항목명 칸을 아예 만들지 않고,
                            // 내용 칸이 그 자리까지 colspan으로 넓게 채우게 함
                            const labelVisible = showLabelColumn && !r.hideLabel;
                            return (
                              <tr key={r.key}>
                                {labelVisible && (
                                  <td className={`py-1 px-3 text-gray-600 ${r.labelBold ? 'font-bold' : 'font-normal'} whitespace-nowrap align-top border border-gray-300`} style={{ background: r.labelBg }}>{r.label}</td>
                                )}
                                <td colSpan={showLabelColumn && !labelVisible ? 2 : 1} className={`py-1 px-3 text-gray-800 ${r.valueBold ? 'font-bold' : 'font-normal'} border border-gray-300`} style={{ background: r.valueBg }}>
                                  {r.manualFieldId ? (
                                    <span className="inline-flex items-center gap-1 w-full">
                                      {r.valuePrefix && <span className="flex-shrink-0">{r.valuePrefix}</span>}
                                      {r.manualFieldType === 'date' ? (
                                        <DatePicker
                                          compact
                                          value={mailManualValues[r.manualFieldId] ?? ''}
                                          onChange={v => setMailManualValues(prev => ({ ...prev, [r.manualFieldId!]: v }))}
                                        />
                                      ) : (
                                        <input
                                          value={mailManualValues[r.manualFieldId] ?? ''}
                                          onChange={e => setMailManualValues(prev => ({ ...prev, [r.manualFieldId!]: e.target.value }))}
                                          placeholder="입력"
                                          className="flex-1 min-w-0 bg-transparent text-[13px] text-gray-800 focus:outline-none"
                                        />
                                      )}
                                      {r.valueSuffix && <span className="flex-shrink-0">{r.valueSuffix}</span>}
                                    </span>
                                  ) : composeRowValue(r)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
              <p className="mt-3">감사합니다.</p>
              {mailAuthor && <p className="mt-1">{mailAuthor} 드림</p>}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-black/[0.08] flex-shrink-0">
          <button
            onClick={async () => {
              const greeting = buildMailGreeting(mailAuthor);
              const statusLabel = statusConfigs.find(s => s.key === task.status)?.label ?? task.status ?? '';
              const currentPart = parts.find(p => p.name === task.category);
              const presets = currentPart?.mailFormConfig ?? [];
              const currentPreset = presets.find(p => p.id === mailPresetId) ?? presets[0];
              const rows = buildTaskInfoRows(task, statusLabel, currentPreset, mailManualValues);
              const showLabelColumn = currentPreset?.tableShowLabelColumn ?? true;
              const signature = mailAuthor ? `${mailAuthor} 드림` : '';
              const plainText = buildMailPlainText(greeting, mailMessage, rows, signature);
              try {
                const html = buildMailHtml(greeting, mailMessage, rows, signature, currentPreset?.tableTitle, showLabelColumn);
                await navigator.clipboard.write([
                  new ClipboardItem({
                    'text/plain': new Blob([plainText], { type: 'text/plain' }),
                    'text/html': new Blob([html], { type: 'text/html' }),
                  }),
                ]);
              } catch {
                // 구형 브라우저 등 ClipboardItem 미지원 시 일반 텍스트로 대체
                await navigator.clipboard.writeText(plainText);
              }
              setMailCopied(true);
              setTimeout(() => setMailCopied(false), 1500);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-sm font-semibold transition-colors"
          >
            {mailCopied ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 메일 내용 복사</>}
          </button>
        </div>
      </div>
    )}
    </div>

    <ConfirmDialog
      open={pendingDeleteTask}
      taskTitle={task.title}
      message="업무를 휴지통으로 이동할까요?"
      subMessage="휴지통 페이지에서 다시 복구할 수 있습니다"
      onConfirm={() => {
        setPendingDeleteTask(false);
        handleClose();
        setTimeout(() => onDelete(task.id), 300);
      }}
      onCancel={() => setPendingDeleteTask(false)}
    />

    <ConfirmDialog
      open={!!pendingDeleteSubTask}
      title="세부업무 삭제"
      taskTitle={pendingDeleteSubTask?.name ?? ''}
      message="세부업무를 휴지통으로 이동할까요?"
      subMessage="휴지통 페이지에서 다시 복구할 수 있습니다"
      onConfirm={() => {
        if (!pendingDeleteSubTask) return;
        // localSubTaskData가 비어있는 경우 대비해 task.subTaskData를 병합
        const base = { ...(task.subTaskData ?? {}), ...localSubTaskData };
        const deletedEntry = base[pendingDeleteSubTask.id];
        delete base[pendingDeleteSubTask.id];
        setLocalSubTaskData(base);
        saveSubTaskData(base, true);
        const hiddenIds = [...(task.hiddenSubTaskTypeIds ?? []), pendingDeleteSubTask.id];
        // 휴지통 복구용 스냅샷 보관 — 세부업무 타입이 나중에 이름 변경/삭제돼도 typeName으로 표시 가능
        const nextDeletedSubTasks = deletedEntry ? {
          ...(task.deletedSubTasks ?? {}),
          [pendingDeleteSubTask.id]: {
            entry: deletedEntry,
            typeName: pendingDeleteSubTask.name,
            deletedAt: new Date().toISOString(),
            deletedBy: currentUserName,
          },
        } : task.deletedSubTasks;
        onUpdate(task.id, { hiddenSubTaskTypeIds: hiddenIds, deletedSubTasks: nextDeletedSubTasks });
        setDeletedSubTaskIds(prev => new Set([...prev, pendingDeleteSubTask.id]));
        setPendingDeleteSubTask(null);
      }}
      onCancel={() => setPendingDeleteSubTask(null)}
    />
    </div>
  );
}
