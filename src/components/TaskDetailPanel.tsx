import { useState, useEffect, useRef } from 'react';
import { X, Trash2, ChevronDown, ExternalLink, Copy } from 'lucide-react';
import type { Task, TaskStatus, TaskType, TeamPart, MetaField, SubTaskType, TeamFormConfig, Department, BuiltinFieldKey, Vacation, RevisionStep } from '../types';
import { DEFAULT_META_FIELDS, resolveBuiltinFields, BUILTIN_FIELDS_META, resolveStatusConfigs, resolveFieldDepts, partBadgeCls, DEFAULT_REVISION_STEPS } from '../types';
import DatePicker from './DatePicker';
import ConfirmDialog from './ConfirmDialog';

const PANEL_W = 540;

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

function getWeekDays(startDate: string, endDate?: string) {
  const DAY_NAMES = ['월', '화', '수', '목', '금'];
  if (!startDate) return [];

  const base = new Date(startDate);
  const dow = base.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);

  let weekCount = 1;
  if (endDate) {
    const end = new Date(endDate);
    const endDow = end.getDay();
    const endDiff = endDow === 0 ? -6 : 1 - endDow;
    const endMonday = new Date(end);
    endMonday.setDate(end.getDate() + endDiff);
    const diffMs = endMonday.getTime() - monday.getTime();
    weekCount = Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
  }

  return Array.from({ length: weekCount }, (_, wi) => {
    const weekMon = new Date(monday);
    weekMon.setDate(monday.getDate() + wi * 7);
    const weekLabel = `${weekMon.getMonth() + 1}/${weekMon.getDate()}`;
    const days = Array.from({ length: 5 }, (__, di) => {
      const d = new Date(weekMon);
      d.setDate(weekMon.getDate() + di);
      return { name: DAY_NAMES[di], date: `${d.getMonth() + 1}/${d.getDate()}` };
    });
    return { weekLabel, days };
  });
}

function calcHoursInRange(hours: Record<string, number>, startDate: string, endDate?: string): number {
  const weeks = getWeekDays(startDate, endDate);
  if (weeks.length === 0) return 0;
  const sd = new Date(startDate);
  const sdDow = sd.getDay();
  const startDayIdx = (sdDow === 0 || sdDow === 6) ? 0 : sdDow - 1;
  const endDayIdx = (() => {
    if (!endDate) return 4;
    const ed = new Date(endDate);
    const edDow = ed.getDay();
    return (edDow === 0 || edDow === 6) ? 4 : edDow - 1;
  })();
  const validKeys = new Set<string>();
  weeks.forEach((_, wi) => {
    const fromDay = wi === 0 ? startDayIdx : 0;
    const toDay = wi === weeks.length - 1 ? endDayIdx : 4;
    for (let di = fromDay; di <= toDay; di++) validKeys.add(`w${wi + 1}d${di + 1}`);
  });
  return Object.entries(hours).filter(([k]) => validKeys.has(k)).reduce((s, [, v]) => s + v, 0);
}

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
  canSeeAll = true, currentUserName = '', vacations = [], reviewTasks,
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
  teamMembers?: { name: string; department?: Department }[];
  formConfig?: TeamFormConfig;
  teamFormConfig?: TeamFormConfig;
  userPhotoMap?: Map<string, string>;
  canSeeAll?: boolean;
  currentUserName?: string;
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
    return !fc || fc.showIn !== 'list';
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
  const [visible, setVisible] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible(true);
      document.documentElement.style.setProperty('--detail-panel-w', `${PANEL_W}px`);
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
    dirtyTypeIdsRef.current = new Set();
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

  return (
    // width 0→PANEL_W 확장: 왼쪽 라운드 고정, 오른쪽으로 열림 → 패딩 이동과 완벽 동기화
    <div
      style={{
        position: 'fixed',
        left: 232,
        top: 12,
        bottom: 12,
        width: visible ? PANEL_W : 0,
        transition: 'width 0.26s ease-out',
        zIndex: 30,
        borderRadius: '28px 0 0 28px',
        overflow: 'hidden',
      }}
    >
    <div
      style={{ width: PANEL_W, height: '100%', background: '#FFFFFF' }}
      className="flex flex-col border-r border-[#E5E0F5]"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-black/[0.08] flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${categoryColor}`} />
        <span className="text-xs text-gray-600 font-medium truncate flex-1">
          {task.category || '파트 없음'} · {task.type}
        </span>
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
            const row1Count = (showTaskMonth ? 1 : 0) + row1Fields.length;
            if (row1Count === 0) return null;
            const row1Cols = row1Count === 1 ? 'grid-cols-1' : row1Count === 2 ? 'grid-cols-2' : 'grid-cols-3';
            return (
              <div className={`grid ${row1Cols} gap-x-3 py-2.5 border-b border-gray-100`}>
                {showTaskMonth && (
                  <div>
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
                )}
                {row1Fields.map(fc => renderField(fc))}
              </div>
            );
          })()}

          {/* 행 2: 파트 / 담당자(접수자) / 접수자(담당자) — formConfig 순서 반영 */}
          {(() => {
            const categoryFc = builtinFields.find(f => f.key === 'category');
            const isCustomCategory = categoryFc?.customType === 'select' && !!categoryFc.options?.length && parts.length === 0;
            const showCategory = (parts.length > 0 || isCustomCategory) && bfVisible('category');
            const showReceiverCol = bfVisible('receiver');
            const showAssigneeCol = bfVisible('assignee');
            const row2Count = (showCategory ? 1 : 0) + (showReceiverCol ? 1 : 0) + (showAssigneeCol ? 1 : 0);
            if (row2Count === 0) return null;
            const row2Cols = row2Count === 1 ? 'grid-cols-1' : row2Count === 2 ? 'grid-cols-2' : 'grid-cols-3';
            return (
          <div className={`grid ${row2Cols} gap-x-3 py-2.5 border-b border-gray-100`}>
            {showCategory && (
              <div>
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
            )}
            {/* receiverFirst면 검수자→담당자 순, 아니면 담당자→검수자 순 */}
            {receiverFirst ? (
              <>
                {showReceiverCol && (
                  <div>
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
                )}
                {showAssigneeCol && (
                  <div>
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
                )}
              </>
            ) : (
              <>
                {showAssigneeCol && (
                  <div>
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
                )}
                {showReceiverCol && (
                  <div>
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
                )}
              </>
            )}
          </div>
            );
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
              {subTaskTypes.filter(type => {
                if (deletedSubTaskIds.has(type.id)) return false;
                if (type.showInDetail === false) return false;
                if ((task.hiddenSubTaskTypeIds ?? []).includes(type.id)) return false;
                if (canSeeAll) return true;
                const filterEntry = { ...(task.subTaskData?.[type.id] ?? {}), ...(localSubTaskData[type.id] ?? {}) };
                return filterEntry.assignee === currentUserName || filterEntry.substitute === currentUserName;
              }).map(type => {
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

                  const calcReviewTotal = (
                    wh: Record<string, Record<string, number>>,
                    dates: Record<string, { startDate?: string; endDate?: string }>,
                    ids: string[]
                  ) => ids.reduce((sum, id) => {
                    const d = dates[id];
                    const h = wh[id] ?? {};
                    if (!d?.startDate) return sum + Object.values(h).reduce((a, b) => a + b, 0);
                    return sum + calcHoursInRange(h, d.startDate, d.endDate);
                  }, 0);

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
                          <input type="date" readOnly={!canManage} value={val}
                            onChange={e => handleBlur(e.target.value)}
                            className={cls} />
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

    <ConfirmDialog
      open={pendingDeleteTask}
      taskTitle={task.title}
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
      onConfirm={() => {
        if (!pendingDeleteSubTask) return;
        // localSubTaskData가 비어있는 경우 대비해 task.subTaskData를 병합
        const base = { ...(task.subTaskData ?? {}), ...localSubTaskData };
        delete base[pendingDeleteSubTask.id];
        setLocalSubTaskData(base);
        saveSubTaskData(base, true);
        const hiddenIds = [...(task.hiddenSubTaskTypeIds ?? []), pendingDeleteSubTask.id];
        onUpdate(task.id, { hiddenSubTaskTypeIds: hiddenIds });
        setDeletedSubTaskIds(prev => new Set([...prev, pendingDeleteSubTask.id]));
        setPendingDeleteSubTask(null);
      }}
      onCancel={() => setPendingDeleteSubTask(null)}
    />
    </div>
  );
}
