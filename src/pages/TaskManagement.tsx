import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, GripVertical, Copy, Check, Info, Upload, Download, FileDown, User, Users, EyeOff, Send } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Task, SubTask, TaskStatus, TaskCategory, TaskType, TeamPart, BuiltinFieldConfig, TeamFormConfig, Department, StatusConfig, MetaField, ExcelFieldConfig, PLMainTaskType, CustomFormField, Team } from '../types';
import { TABLE_FIELD_KEYS, resolveBuiltinFields, BUILTIN_FIELDS_META, resolveStatusConfigs, DEFAULT_META_FIELDS, resolveFieldDepts, mergeFormConfig, partBadgeCls, resolveCopyIncludeDetails, resolveTaskListTwoLine } from '../types';
import NewTaskModal from '../components/NewTaskModal';
import CategoryTabs from '../components/CategoryTabs';
import DatePicker from '../components/DatePicker';
import ConfirmDialog from '../components/ConfirmDialog';

interface Props {
  tasks: Task[];
  onAddTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onOpenDetail: (id: string) => void;
  activeTaskId?: string | null;
  projectId: string;
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  canCreate: boolean;
  canManage: boolean;
  canDelete?: boolean;
  parts?: TeamPart[];
  assignees?: string[];
  teamMembers?: { name: string; department?: Department }[];
  formConfig?: TeamFormConfig;
  builtinFields?: BuiltinFieldConfig[];
  metaFields?: MetaField[];
  currentUserName?: string;
  canSeeAll?: boolean;
  canFilterByPerson?: boolean; // 담당자/접수자 필터·담당자별 보기 노출 여부 (중간 관리자 이상)
  userPhotoMap?: Map<string, string>;
  excelConfig?: ExcelFieldConfig[];
  allMetaFields?: MetaField[];
  plMainTaskTypes?: PLMainTaskType[];
  teams?: Team[];
  currentTeamId?: string;
  onRequestToSupportTeam?: (taskIds: string[], targetTeamId: string, targetCategory: string, targetMonth: string) => Promise<void>;
}

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];

const STATUS_SPACE_MAP: Record<string, string> = {
  '진행전': '진행 전', '진행중': '진행 중',
};
const STATUS_BG: Record<TaskStatus, string> = {
  '진행 전': 'bg-blue-100',
  '진행 중': 'bg-amber-100',
  '완료': 'bg-green-100',
  '보류': 'bg-slate-200',
};
const STATUS_TEXT: Record<TaskStatus, string> = {
  '진행 전': 'text-blue-600',
  '진행 중': 'text-amber-600',
  '완료': 'text-green-600',
  '보류': 'text-slate-600',
};

const now = new Date();
const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// 드롭다운(select) 타입 커스텀 필드의 옵션 목록 맨 끝에 붙여, 목록 대신 자유 텍스트를
// 직접 입력하는 모드로 전환할 수 있게 하는 특수 선택지
const CUSTOM_FIELD_MANUAL_OPTION = '__manual_input__';

// 다양한 날짜 형식(엑셀 직렬 숫자 포함) → YYYY-MM-DD 정규화. 엑셀 가져오기와
// 이미 잘못 저장된 데이터 일괄 복구 양쪽에서 공용으로 사용.
function parseExcelDateValue(raw: unknown, fallbackYear: number): string {
  if (raw === null || raw === undefined || raw === '') return '';
  // Excel 직렬 날짜 (숫자)
  if (typeof raw === 'number') {
    const adj = raw > 59 ? raw - 1 : raw; // Excel의 1900년 윤년 버그 보정
    const d = new Date(Date.UTC(1900, 0, 1) + (adj - 1) * 86400000);
    if (isNaN(d.getTime()) || d.getFullYear() < 1900) return '';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  if (!s) return '';
  // YYYY-MM-DD (정상)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // 순수 숫자 문자열(엑셀 직렬 날짜가 문자열로 저장된 경우)
  if (/^\d{1,6}(\.\d+)?$/.test(s)) return parseExcelDateValue(Number(s), fallbackYear);
  // YYYY.MM.DD 또는 YYYY/MM/DD
  const m1 = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (m1) return `${m1[1]}-${String(parseInt(m1[2])).padStart(2, '0')}-${String(parseInt(m1[3])).padStart(2, '0')}`;
  // DD.MM.YYYY (유럽식 점 구분자)
  const m2 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m2) return `${m2[3]}-${String(parseInt(m2[2])).padStart(2, '0')}-${String(parseInt(m2[1])).padStart(2, '0')}`;
  // DD/MM/YYYY 또는 MM/DD/YYYY (슬래시 구분자)
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) {
    const [a, b, yr] = [parseInt(m3[1]), parseInt(m3[2]), m3[3]];
    // 앞자리가 12 초과면 확실히 일(day)
    if (a > 12) return `${yr}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    return `${yr}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
  }
  // 한국어: 2024년 1월 18일 또는 1월 18일
  const m4 = s.match(/(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일/);
  if (m4) return `${m4[1] ?? fallbackYear}-${String(parseInt(m4[2])).padStart(2, '0')}-${String(parseInt(m4[3])).padStart(2, '0')}`;
  // 네이티브 Date 파싱 (ISO 등 나머지 형식 폴백)
  if (s.length >= 8) {
    const d = new Date(s);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return '';
}

// 가로 스크롤 영역(업무 카드 2/3번째 줄)을 스크롤바 없이 좌우 토글 버튼으로 조작하기
// 위한 공용 훅. 매 렌더 후 측정하되, 값이 실제로 바뀔 때만 상태를 갱신해 무한
// 리렌더 없이 내용/폭 변경 시 버튼 표시 여부가 항상 최신으로 유지됨.
function useHScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ canLeft: false, canRight: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const canLeft = el.scrollLeft > 2;
    const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
    setScroll(prev => (prev.canLeft === canLeft && prev.canRight === canRight) ? prev : { canLeft, canRight });
  };
  // useEffect(페인트 이후 실행)는 방금 마운트/노출된 행에서 실제 스크롤 가능 여부가
  // 반영되기 전까지 버튼이 아예 없거나 잘못된 방향을 가리키는 짧은 틈을 만들어,
  // 그 틈에 클릭하면 아무 반응이 없는 것처럼 보인다(우측 버튼이 처음 눌릴 때 자주
  // 겪는 위치). useLayoutEffect로 페인트 전에 동기 측정해 이 틈을 없앤다.
  useLayoutEffect(() => { update(); });
  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  return { ref, scroll, update, scrollBy };
}

// 기본필드(builtin)와 커스텀필드를 fieldOrder대로 하나의 순서로 합친 컬럼 목록.
// 목록 테이블은 헤더/행/너비 계산이 모두 이 순서를 따라야 "폼 설정"에서 기본필드
// 사이로 옮긴 커스텀필드가 실제로도 그 위치에 표시됨.
type TableCol = { kind: 'builtin'; key: string; fc: BuiltinFieldConfig } | { kind: 'custom'; key: string; cf: CustomFormField };

function buildTableCols(tableFields: BuiltinFieldConfig[], tableCfs: CustomFormField[], fieldOrder?: string[]): TableCol[] {
  if (!fieldOrder?.length) {
    return [
      ...tableFields.map(fc => ({ kind: 'builtin' as const, key: fc.key, fc })),
      ...tableCfs.map(cf => ({ kind: 'custom' as const, key: cf.id, cf })),
    ];
  }
  const bMap = new Map<string, BuiltinFieldConfig>(tableFields.map(fc => [fc.key, fc]));
  const cMap = new Map<string, CustomFormField>(tableCfs.map(cf => [cf.id, cf]));
  const result: TableCol[] = [];
  for (const k of fieldOrder) {
    if (bMap.has(k)) { result.push({ kind: 'builtin', key: k, fc: bMap.get(k)! }); bMap.delete(k); }
    else if (cMap.has(k)) { result.push({ kind: 'custom', key: k, cf: cMap.get(k)! }); cMap.delete(k); }
  }
  bMap.forEach(fc => result.push({ kind: 'builtin', key: fc.key, fc }));
  cMap.forEach(cf => result.push({ kind: 'custom', key: cf.id, cf }));
  return result;
}

// 업무명 컬럼은 커스텀필드가 많아져 다른 컬럼이 늘어나도 이 너비 밑으로는
// 줄어들지 않게 함(넓어지는 건 1fr로 자유롭게 허용)
const TITLE_MIN_WIDTH = 300;
// 날짜 컬럼(YY.MM.DD, 8자)은 팀별 설정값(fc.width)과 무관하게 항상 이 너비로
// 고정 — 실제 텍스트보다 컬럼이 넓어서 좌우 여백이 커 보이는 문제를 모든
// 팀에 공통으로 줄이기 위함 (팀 설정에 너비 편집 UI 자체가 없어 안전함)
const DATE_COL_WIDTH = 60;

function buildCols(tableCols: TableCol[]): string {
  const cols: string[] = ['28px', '18px']; // checkbox | drag handle
  for (const col of tableCols) {
    if (col.kind === 'custom') { cols.push('100px'); continue; }
    const fc = col.fc;
    if (fc.key === 'title') {
      cols.push(`minmax(${TITLE_MIN_WIDTH}px, 1fr)`);
    } else if (fc.key === 'weeklyHours') {
      cols.push('52px');
    } else if (fc.key === 'startDate' || fc.key === 'endDate') {
      cols.push(`${DATE_COL_WIDTH}px`);
    } else {
      cols.push(`${fc.width}px`);
    }
  }
  cols.push('110px'); // expand + copy + delete
  return cols.join(' ');
}

function buildMinWidth(tableCols: TableCol[]): number {
  let w = 46; // checkbox(28) + drag handle(18)
  let colCount = 2;
  for (const col of tableCols) {
    if (col.kind === 'custom') { w += 100; colCount++; continue; }
    const fc = col.fc;
    if (fc.key === 'title') { w += TITLE_MIN_WIDTH; colCount++; }
    else if (fc.key === 'weeklyHours') { w += 52; colCount++; }
    else if (fc.key === 'startDate' || fc.key === 'endDate') { w += DATE_COL_WIDTH; colCount++; }
    else { w += fc.width; colCount++; }
  }
  w += 110; colCount++; // expand + copy + delete
  w += (colCount - 1) * 12; // gap-x-3
  w += 24; // px-3 양쪽
  return w;
}

// 필드(월/업무명/유형/... /커스텀) 각 트랙의 픽셀 폭(체크박스/드래그/액션 제외)
function fieldTrackWidth(col: TableCol): number {
  if (col.kind === 'custom') return 100;
  const fc = col.fc;
  if (fc.key === 'title') return TITLE_MIN_WIDTH;
  if (fc.key === 'weeklyHours') return 52;
  if (fc.key === 'startDate' || fc.key === 'endDate') return DATE_COL_WIDTH;
  return fc.width;
}
function fieldTrackCss(col: TableCol): string {
  if (col.kind === 'custom') return '100px';
  const fc = col.fc;
  if (fc.key === 'title') return `minmax(${TITLE_MIN_WIDTH}px, 1fr)`;
  if (fc.key === 'weeklyHours') return '52px';
  if (fc.key === 'startDate' || fc.key === 'endDate') return `${DATE_COL_WIDTH}px`;
  return `${fc.width}px`;
}
function sumFieldTracks(cols: TableCol[]): number {
  if (cols.length === 0) return 0;
  return cols.reduce((s, c) => s + fieldTrackWidth(c), 0) + (cols.length - 1) * 12;
}

// 업무 행(TaskRow)/헤더: 체크박스/드래그(2줄 모드에서는 월도 함께)를 그리드 밖(좌측 레일)으로
// 빼서 2줄 전체 높이 기준으로 항상 세로 중앙에 오게 함 — 필드 영역(업무명/나머지)은 그 레일과
// 무관하게 항상 같은 x 위치에서 시작하므로 줄 사이 들여쓰기를 따로 계산할 필요가 없음
function buildRowFieldsCols(cols: TableCol[]): string {
  return cols.map(fieldTrackCss).join(' ');
}
// 행/헤더 전체(좌측 레일+필드영역+액션) 최소 폭. 2줄 모드에선 필드영역이 업무명 1개뿐이라
// (나머지는 2번째 줄에서 자체 스크롤) railWidth만 정확하면 되고, 1줄 모드에선 레일=체크박스+
// 드래그(46px)로 고정
function buildRowMinWidth(fieldsCols: TableCol[], railWidth: number): number {
  const fieldsW = sumFieldTracks(fieldsCols);
  return railWidth + 12 + fieldsW + 12 + 110 + 24; // 레일+간격+필드영역+간격+액션+좌우padding
}

const HEADER_LABEL: Partial<Record<string, string>> = {
  taskMonth: '월', title: '업무', category: '파트', type: '유형', status: '상태', receiver: '접수자', assignee: '담당자', startDate: '시작', endDate: '종료',
};

// 컬럼의 헤더 라벨 — 2줄 모드에서 2번째 줄 필드는 공용 헤더가 없으므로 각 행 안에서
// 값 위에 이 라벨을 함께 보여줌(renderHeaderCols와 동일한 라벨 규칙 재사용)
function getColLabel(col: TableCol): string {
  if (col.kind === 'custom') return col.cf.label;
  const fc = col.fc;
  return fc.customLabel ?? BUILTIN_FIELDS_META.find(m => m.key === fc.key)?.label ?? HEADER_LABEL[fc.key] ?? fc.key;
}

export default function TaskManagement({ tasks, onAddTask, onUpdateTask, onDeleteTask, onOpenDetail, activeTaskId, projectId, activeCategory, onCategoryChange, canCreate, canManage, canDelete = canManage, parts, assignees = [], teamMembers, formConfig, builtinFields: propBuiltinFields, metaFields: teamMetaFields, currentUserName = '', canSeeAll = false, canFilterByPerson = false, userPhotoMap, excelConfig, allMetaFields, plMainTaskTypes, teams = [], currentTeamId, onRequestToSupportTeam }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState(() => {
    const saved = localStorage.getItem('tm_yearFilter');
    return saved ? Number(saved) : now.getFullYear();
  });
  const [monthFilter, setMonthFilter] = useState(() => {
    const saved = localStorage.getItem('tm_monthFilter');
    return saved ? Number(saved) : now.getMonth() + 1;
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTargetTeamId, setRequestTargetTeamId] = useState('');
  const [requestTargetPart, setRequestTargetPart] = useState('');
  const [requestTargetMonth, setRequestTargetMonth] = useState('');
  const [requestSending, setRequestSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{ rows: Partial<Task>[] } | null>(null);
  const [previewCats, setPreviewCats] = useState<Record<number, string>>({});
  const [previewSkipped, setPreviewSkipped] = useState<Set<number>>(new Set());
  const [previewUpdateSet, setPreviewUpdateSet] = useState<Set<number>>(new Set());
  const importRef = useRef<HTMLInputElement>(null);
  const exportDropRef = useRef<HTMLDivElement>(null);
  const [exportDropOpen, setExportDropOpen] = useState(false);
  const templateDropRef = useRef<HTMLDivElement>(null);
  const [templateDropOpen, setTemplateDropOpen] = useState(false);
  const [exportParts, setExportParts] = useState<Set<string>>(new Set());
  const [exportMonths, setExportMonths] = useState<Set<number>>(new Set());
  const importDropRef = useRef<HTMLDivElement>(null);
  const [importDropOpen, setImportDropOpen] = useState(false);
  const [importParts, setImportParts] = useState<Set<string>>(new Set());

  const eligibleSupportTeams = useMemo(
    () => teams.filter(t => t.isSupportTeam && (t.supportSourceTeamIds ?? []).includes(currentTeamId ?? '')),
    [teams, currentTeamId]
  );
  const requestTargetTeam = eligibleSupportTeams.find(t => t.id === requestTargetTeamId);

  const monthsWithData = useMemo(() => {
    const set = new Set<number>();
    const yr = String(yearFilter);
    tasks.forEach(t => {
      if (t.taskMonth?.startsWith(yr)) set.add(parseInt(t.taskMonth.split('-')[1]));
      else if (t.startDate?.startsWith(yr)) set.add(parseInt(t.startDate.split('-')[1]));
      else if (t.endDate?.startsWith(yr)) set.add(parseInt(t.endDate.split('-')[1]));
    });
    return set;
  }, [tasks, yearFilter]);

  // 현재 팀에서 유효한 엑셀 키 목록 (builtin + metaFields + customFields)
  const validExcelKeys = useMemo(() => {
    const builtinKeys = ['taskMonth', 'title', 'category', 'type', 'status', 'receiver', 'assignee', 'startDate', 'endDate'];
    const metaKeys = (teamMetaFields ?? DEFAULT_META_FIELDS).map(f => f.key);
    const customKeys = (formConfig?.customFields ?? []).map(f => f.id);
    return new Set([...builtinKeys, ...metaKeys, ...customKeys]);
  }, [teamMetaFields, formConfig?.customFields]);

  // 파트별 유효 헤더 계산 (customLabel 반영)
  const getPartHeaders = (part: TeamPart): string[] => {
    const pFields = resolveBuiltinFields(part.formConfig ?? formConfig);
    const pBLabel = (key: string, fb: string) => pFields.find(f => f.key === key)?.customLabel ?? fb;
    const pLabels: Record<string, string> = {
      taskMonth: pBLabel('taskMonth', '월'),
      title:     pBLabel('title', '업무명'),
      category:  pBLabel('category', '파트'),
      type:      pBLabel('type', '유형'),
      status:    pBLabel('status', '상태'),
      receiver:  pBLabel('receiver', '접수자'),
      assignee:  pBLabel('assignee', '담당자'),
      startDate: pBLabel('startDate', '시작일'),
      endDate:   pBLabel('endDate', '종료일'),
    };
    const ec = (part.excelConfig ?? excelConfig)?.filter(f => f.enabled && validExcelKeys.has(f.key)).sort((a, b) => a.order - b.order) ?? [];
    if (ec.length > 0) return ec.map(f => pLabels[f.key] ?? f.label);
    return Object.values(pLabels);
  };

  const exportCompatible = useMemo(() => {
    if (!parts || exportParts.size <= 1) return true;
    const selected = parts.filter(p => exportParts.has(p.name));
    if (selected.length <= 1) return true;
    const signatures = selected.map(p => getPartHeaders(p).join('\0'));
    return new Set(signatures).size === 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportParts, parts, formConfig, excelConfig]);

  const importCompatible = useMemo(() => {
    if (!parts || importParts.size <= 1) return true;
    const selected = parts.filter(p => importParts.has(p.name));
    if (selected.length <= 1) return true;
    const signatures = selected.map(p => getPartHeaders(p).join('\0'));
    return new Set(signatures).size === 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importParts, parts, formConfig, excelConfig]);

  useEffect(() => {
    localStorage.setItem('tm_yearFilter', String(yearFilter));
    localStorage.setItem('tm_monthFilter', String(monthFilter));
  }, [yearFilter, monthFilter]);

  useEffect(() => {
    if (!exportDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportDropRef.current && !exportDropRef.current.contains(e.target as Node)) {
        setExportDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportDropOpen]);

  useEffect(() => {
    if (!importDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (importDropRef.current && !importDropRef.current.contains(e.target as Node)) {
        setImportDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [importDropOpen]);

  useEffect(() => {
    if (!templateDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (templateDropRef.current && !templateDropRef.current.contains(e.target as Node)) {
        setTemplateDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [templateDropOpen]);

  const partColor = (cat: string) => parts?.find(p => p.name === cat)?.color ?? 'bg-gray-400';

  const builtinFields = propBuiltinFields ?? resolveBuiltinFields(formConfig);

  // customLabel 반영 — 폼설정 명칭 변경 시 엑셀 컬럼도 동기화
  const bLabel = (key: string, fallback: string) =>
    builtinFields.find(f => f.key === key)?.customLabel ?? fallback;

  const builtinLabels: Record<string, string> = {
    taskMonth: bLabel('taskMonth', '월'),
    title:     bLabel('title', '업무명'),
    category:  bLabel('category', '파트'),
    type:      bLabel('type', '유형'),
    status:    bLabel('status', '상태'),
    receiver:  bLabel('receiver', '접수자'),
    assignee:  bLabel('assignee', '담당자'),
    startDate: bLabel('startDate', '시작일'),
    endDate:   bLabel('endDate', '종료일'),
  };

  // 가져오기용 필드 — 선택된 파트에 별도 excelConfig 있으면 우선 사용
  const effectiveImportConfig = (() => {
    const selected = parts?.filter(p => importParts.has(p.name)) ?? [];
    return selected.find(p => p.excelConfig)?.excelConfig ?? excelConfig;
  })();
  // 선택된 파트의 formConfig customLabel 반영 — 파트별 템플릿 헤더와 일치하도록
  const importBuiltinLabels = (() => {
    const selected = parts?.filter(p => importParts.has(p.name)) ?? [];
    const partWithConfig = selected.find(p => p.formConfig);
    const pFields = partWithConfig?.formConfig
      ? resolveBuiltinFields(mergeFormConfig(partWithConfig.formConfig, formConfig))
      : builtinFields;
    const pb = (key: string, fb: string) => pFields.find(f => f.key === key)?.customLabel ?? fb;
    return {
      taskMonth: pb('taskMonth', '월'),
      title:     pb('title', '업무명'),
      category:  pb('category', '파트'),
      type:      pb('type', '유형'),
      status:    pb('status', '상태'),
      receiver:  pb('receiver', '접수자'),
      assignee:  pb('assignee', '담당자'),
      startDate: pb('startDate', '시작일'),
      endDate:   pb('endDate', '종료일'),
    };
  })();
  const importFields = (effectiveImportConfig?.filter(f => f.enabled && validExcelKeys.has(f.key)).sort((a, b) => a.order - b.order) ?? [])
    .map(f => ({ ...f, label: importBuiltinLabels[f.key] ?? f.label }));
  // 선택된 파트의 커스텀 필드 중 'date' 타입인 필드 id 집합 — 엑셀 가져오기 시 날짜 정규화 대상 판별용
  const importDateFieldIds = (() => {
    const selected = parts?.filter(p => importParts.has(p.name)) ?? [];
    const partWithConfig = selected.find(p => p.formConfig);
    const merged = partWithConfig?.formConfig ? mergeFormConfig(partWithConfig.formConfig, formConfig) : formConfig;
    return new Set((merged?.customFields ?? []).filter(cf => cf.type === 'date').map(cf => cf.id));
  })();
  // 내보내기용 필드 (enabled + exportExcluded 제외)
  const excelFields = importFields.filter(f => !f.exportExcluded);
  const labelToKey = Object.fromEntries(importFields.map(f => [f.label, f.key]));

  // 파트별 'date' 타입 커스텀 필드 id 집합 — 과거 엑셀 가져오기로 잘못 저장된
  // 날짜(시리얼 숫자 등) 값을 찾아 일괄 복구하는 데 사용
  const partDateFieldIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (parts ?? []).forEach(part => {
      const merged = part.formConfig ? mergeFormConfig(part.formConfig, formConfig) : formConfig;
      map.set(part.name, new Set((merged?.customFields ?? []).filter(cf => cf.type === 'date').map(cf => cf.id)));
    });
    return map;
  }, [parts, formConfig]);

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  // '-' 같은 미입력 표시나 파싱 불가능한 값은 대상에서 제외 — 실제로 변환 가능한
  // (엑셀 시리얼 숫자 등) 값만 "고장난" 것으로 취급해야 버튼이 0건이 될 때까지 사라진다.
  const isFixableDateValue = (v: string) => {
    if (!v || ISO_DATE_RE.test(v)) return false;
    const converted = parseExcelDateValue(v, yearFilter);
    return !!converted && converted !== v;
  };
  const brokenDateTasks = useMemo(() => {
    return tasks.filter(t => {
      const ids = partDateFieldIds.get(t.category ?? '');
      if (!ids || ids.size === 0 || !t.customFields) return false;
      return Object.entries(t.customFields).some(([k, v]) => ids.has(k) && isFixableDateValue(String(v ?? '')));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, partDateFieldIds, yearFilter]);

  const [fixingDateFields, setFixingDateFields] = useState(false);
  const [dateFixMsg, setDateFixMsg] = useState('');

  const runDateFieldFix = async () => {
    if (brokenDateTasks.length === 0 || fixingDateFields) return;
    if (!window.confirm(`날짜 값이 잘못 저장된 업무 ${brokenDateTasks.length}건을 복구합니다. 계속할까요?`)) return;
    setFixingDateFields(true);
    setDateFixMsg('');
    let fixed = 0;
    try {
      for (const t of brokenDateTasks) {
        const ids = partDateFieldIds.get(t.category ?? '');
        if (!ids || !t.customFields) continue;
        const patch: Record<string, string> = {};
        Object.entries(t.customFields).forEach(([k, v]) => {
          if (ids.has(k) && isFixableDateValue(String(v ?? ''))) {
            patch[k] = parseExcelDateValue(v, yearFilter);
          }
        });
        if (Object.keys(patch).length > 0) {
          await onUpdateTask(t.id, { customFields: { ...t.customFields, ...patch } });
          fixed++;
        }
      }
      setDateFixMsg(`✅ ${fixed}건 복구 완료`);
    } catch (e) {
      setDateFixMsg(`❌ 오류: ${String(e)}`);
    } finally {
      setFixingDateFields(false);
    }
  };

  const getExcelHeaders = () =>
    excelFields.length > 0
      ? excelFields.map(f => f.label)
      : Object.values(builtinLabels);

  // 2026-06 → 6월 변환
  const fmtMonth = (v?: string) => {
    if (!v) return '';
    const m = v.match(/^\d{4}-(\d{2})$/);
    return m ? `${parseInt(m[1])}월` : v;
  };

  const taskVal = (t: Task, key: string): string => {
    if (key === 'taskMonth') return fmtMonth(t.taskMonth);
    const map: Record<string, string | undefined> = {
      title: t.title, category: t.category, type: t.type,
      status: t.status, receiver: t.receiver, assignee: t.assignee,
      startDate: t.startDate, endDate: t.endDate,
    };
    return map[key] ?? t.customFields?.[key] ?? '';
  };

  const taskToRow = (t: Task): Record<string, string> => {
    if (excelFields.length > 0) {
      const row: Record<string, string> = {};
      excelFields.forEach(f => { row[f.label] = taskVal(t, f.key); });
      return row;
    }
    return Object.fromEntries(
      Object.entries(builtinLabels).map(([key, label]) => [label, taskVal(t, key)])
    );
  };

  const handleExcelExport = (selectedParts?: Set<string>, selectedMonths?: Set<number>) => {
    const yr = String(yearFilter);
    const base = tasks.filter((t: Task) => {
      const taskYear = t.taskMonth?.substring(0, 4) ?? t.startDate?.substring(0, 4) ?? t.endDate?.substring(0, 4) ?? '';
      if (taskYear && taskYear !== yr) return false;
      if (selectedMonths && selectedMonths.size > 0) {
        const m = t.taskMonth
          ? parseInt(t.taskMonth.split('-')[1])
          : t.startDate?.startsWith(yr)
            ? parseInt(t.startDate.split('-')[1])
            : t.endDate?.startsWith(yr)
              ? parseInt(t.endDate.split('-')[1])
              : 0;
        if (!m || !selectedMonths.has(m)) return false;
      }
      return true;
    });
    const toExport = selectedParts && selectedParts.size > 0
      ? base.filter(t => selectedParts.has(t.category))
      : base;

    // 선택된 파트 중 별도 excelConfig 있으면 우선 사용, 없으면 팀 기본
    const selectedPartObjects = parts?.filter(p => selectedParts?.has(p.name)) ?? [];
    const effectiveConfig = selectedPartObjects.find(p => p.excelConfig)?.excelConfig ?? excelConfig;
    const effectiveImportFields = (effectiveConfig?.filter(f => f.enabled).sort((a, b) => a.order - b.order) ?? [])
      .map(f => ({ ...f, label: builtinLabels[f.key] ?? f.label }));
    const effectiveExcelFields = effectiveImportFields.filter(f => !f.exportExcluded);
    const headers = effectiveExcelFields.length > 0
      ? effectiveExcelFields.map(f => f.label)
      : Object.values(builtinLabels);
    const rows = toExport.map(t => {
      if (effectiveExcelFields.length > 0) {
        const row: Record<string, string> = {};
        effectiveExcelFields.forEach(f => { row[f.label] = taskVal(t, f.key); });
        return row;
      }
      return Object.fromEntries(Object.entries(builtinLabels).map(([key, label]) => [label, taskVal(t, key)]));
    });

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '업무목록');
    XLSX.writeFile(wb, `업무목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExportDropOpen(false);
  };

  const downloadTemplate = (part?: TeamPart) => {
    const headers = part ? getPartHeaders(part) : getExcelHeaders();
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '업무등록템플릿');
    XLSX.writeFile(wb, part ? `업무등록_템플릿_${part.name}.xlsx` : '업무등록_템플릿.xlsx');
    setTemplateDropOpen(false);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportDropOpen(false);
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const parsed: Partial<Task>[] = rows.map(row => {
        const get = (label: string) => {
          // excelConfig label 우선, 없으면 builtinLabels 역방향 매핑
          if (labelToKey[label] !== undefined) return row[label] ?? '';
          return row[label] ?? '';
        };
        const keyMap = importFields.length > 0
          ? Object.fromEntries(importFields.map(f => [f.key, row[f.label] ?? '']))
          : Object.fromEntries(Object.entries(builtinLabels).map(([key, label]) => [key, row[label] ?? '']));

        const parseMonth = (raw: string): string => {
          const s = raw.trim();
          if (!s) return '';
          if (/^\d{4}-\d{2}$/.test(s)) return s;
          const m1 = s.match(/^(\d{1,2})월$/);
          if (m1) return `${yearFilter}-${String(parseInt(m1[1])).padStart(2, '0')}`;
          const m2 = s.match(/^(\d{4})[-/.](\d{1,2})$/);
          if (m2) return `${m2[1]}-${String(parseInt(m2[2])).padStart(2, '0')}`;
          return s;
        };

        // 다양한 날짜 형식 → YYYY-MM-DD 정규화
        const parseDate = (raw: unknown): string => parseExcelDateValue(raw, yearFilter);

        const customFields: Record<string, string> = {};
        if (importFields.length > 0) {
          importFields.forEach(f => {
            if (!builtinLabels[f.key]) {
              const raw = row[f.label] ?? '';
              customFields[f.key] = importDateFieldIds.has(f.key) ? parseDate(raw) : raw;
            }
          });
        }

        const statusFc = builtinFields.find(f => f.key === 'status');
        const availableStatuses: string[] = (statusFc?.customType === 'select' && statusFc.options?.length)
          ? statusFc.options
          : statusConfigs.map(s => s.key);
        const parseStatus = (raw: string): string => {
          const s = raw.trim();
          if (!s) return '';
          if (availableStatuses.includes(s)) return s;
          const normalized = STATUS_SPACE_MAP[s] ?? s;
          if (availableStatuses.includes(normalized)) return normalized;
          return '';
        };

        return {
          title: String(keyMap.title ?? get('업무명') ?? '').trim(),
          taskMonth: parseMonth(String(keyMap.taskMonth ?? '')),
          category: String(keyMap.category ?? get('파트') ?? '').trim() as TaskCategory,
          type: String(keyMap.type ?? get('유형') ?? '신규').trim() as TaskType,
          status: parseStatus(String(keyMap.status ?? get('상태') ?? '')) as TaskStatus,
          receiver: String(keyMap.receiver ?? get(importBuiltinLabels.receiver) ?? '').trim(),
          assignee: String(keyMap.assignee ?? get(importBuiltinLabels.assignee) ?? '').trim(),
          startDate: parseDate(keyMap.startDate ?? get('시작일') ?? ''),
          endDate: parseDate(keyMap.endDate ?? get('종료일') ?? ''),
          ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
        };
      }).filter(r => r.title);

      const currentMonth = `${yearFilter}-${String(monthFilter).padStart(2, '0')}`;
      const existingKeysInit = new Set(tasks.map(t => `${t.title.trim()}||${t.category}||${t.taskMonth}`));
      const existingTaskMapInit = new Map(tasks.map(t => [`${t.title.trim()}||${t.category}||${t.taskMonth}`, t]));

      // 파트 1개 선택 시 category 없는 행에 자동 지정
      const partNameSet = new Set(parts?.map(p => p.name) ?? []);
      const autoCats: Record<number, string> = {};
      if (importParts.size === 1) {
        const singlePart = [...importParts][0];
        if (partNameSet.has(singlePart)) {
          parsed.forEach((row, i) => {
            if (!row.category || !partNameSet.has(row.category as string)) {
              autoCats[i] = singlePart;
            }
          });
        }
      }

      // 중복 자동 분류: 변경 항목 있으면 업데이트, 없으면 건너뜀
      const initSkips = new Set<number>();
      const initAutoUpdates = new Set<number>();
      const fieldsToCheck: (keyof Task)[] = ['type', 'status', 'receiver', 'assignee', 'startDate', 'endDate'];
      parsed.forEach((r, i) => {
        const cat = autoCats[i] ?? (r.category ?? '');
        const month = r.taskMonth || currentMonth;
        const key = `${(r.title ?? '').trim()}||${cat}||${month}`;
        if (!existingKeysInit.has(key)) return;
        const existing = existingTaskMapInit.get(key);
        if (!existing) { initSkips.add(i); return; }
        const hasChange = fieldsToCheck.some(f => {
          const nv = String((r as Record<string, unknown>)[f] ?? '');
          const ov = String(existing[f] ?? '');
          return nv !== '' && nv !== ov;
        });
        const customChanged = r.customFields
          ? Object.entries(r.customFields).some(([k, v]) => v !== '' && v !== (existing.customFields?.[k] ?? ''))
          : false;
        if (hasChange || customChanged) {
          initAutoUpdates.add(i);
        } else {
          initSkips.add(i);
        }
      });

      setPreviewCats(autoCats);
      setPreviewSkipped(initSkips);
      setPreviewUpdateSet(initAutoUpdates);
      setImportPreview({ rows: parsed });
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    const validPartNames = new Set(parts?.map(p => p.name) ?? []);
    const currentMonth = monthFilter > 0
      ? `${yearFilter}-${String(monthFilter).padStart(2, '0')}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const existingTaskMap = new Map(tasks.map(t => [`${t.title.trim()}||${t.category}||${t.taskMonth}`, t]));
    const bottom = tasks.reduce((max, t) => Math.max(max, t.sortOrder ?? -1), -1);
    let addIdx = 0;

    for (let i = 0; i < importPreview.rows.length; i++) {
      if (previewSkipped.has(i)) continue;
      const r = importPreview.rows[i];
      const rawCat = r.category ?? '';
      const resolvedCategory = (previewCats[i]) ||
        (validPartNames.size === 0 || validPartNames.has(rawCat) ? rawCat : '') ||
        (parts?.[0]?.name ?? '');
      const resolvedMonth = r.taskMonth || currentMonth;

      if (previewUpdateSet.has(i)) {
        const key = `${(r.title ?? '').trim()}||${resolvedCategory}||${resolvedMonth}`;
        const existing = existingTaskMap.get(key);
        if (existing) {
          const { title: _t, category: _c, taskMonth: _m, ...updateFields } = r;
          onUpdateTask(existing.id, {
            ...updateFields,
            ...(r.customFields ? { customFields: { ...(existing.customFields ?? {}), ...r.customFields } } : {}),
          });
        }
      } else {
        await onAddTask({
          projectId, teamId: '',
          title: r.title ?? '',
          taskMonth: resolvedMonth,
          category: resolvedCategory as TaskCategory,
          type: (r.type as TaskType) || '신규',
          status: (r.status as TaskStatus) || '',
          receiver: r.receiver ?? '', assignee: r.assignee ?? '',
          startDate: r.startDate ?? '', endDate: r.endDate ?? '',
          weeklyHours: {}, totalHours: 0, revisionLevel: 0,
          sortOrder: bottom + 1 + addIdx,
          ...(r.customFields ? { customFields: r.customFields } : {}),
        });
        addIdx++;
      }
    }
    setImportPreview(null);
    setPreviewSkipped(new Set());
    setPreviewUpdateSet(new Set());
  };

  const tableFields = builtinFields.filter(fc => fc.enabled && TABLE_FIELD_KEYS.includes(fc.key) && fc.showIn !== 'detail');
  const tableCfs = (formConfig?.customFields ?? []).filter(cf => cf.enabled !== false && cf.showIn !== 'detail');
  const tableCols = buildTableCols(tableFields, tableCfs, formConfig?.fieldOrder);
  const statusConfigs = resolveStatusConfigs(formConfig);

  const currentTeam = teams.find(t => t.id === currentTeamId);
  // 2줄 구성(업무명만 1번째 줄 / 나머지 필드 2번째 줄) 사용 여부 — 파트 탭이면 그 파트 오버라이드,
  // "전체" 탭이면 팀 기본값만 (팀 설정 > 폼 설정에서 팀/파트별로 개별 설정 가능)
  const activePartForLayout = activeCategory !== 'all' ? parts?.find(p => p.name === activeCategory) : undefined;
  const twoLineMode = resolveTaskListTwoLine(currentTeam, activePartForLayout);
  // 2줄 모드: 체크박스/드래그와 함께 월도 좌측 레일로 빼서 항상 세로 중앙에 오게 하고,
  // 업무명만 1번째 줄, 나머지 전부 2번째 줄(가로 스크롤은 이 줄에만 걸림)에 배치
  const monthCol = twoLineMode ? tableCols.find(c => c.kind === 'builtin' && c.fc.key === 'taskMonth') : undefined;
  const monthColWidth = monthCol ? fieldTrackWidth(monthCol) : 0;
  const railWidth = 28 + 12 + 18 + (monthCol ? 12 + monthColWidth : 0); // 체크박스+간격+드래그(+간격+월)
  const line1Cols = twoLineMode ? tableCols.filter(c => c.kind === 'builtin' && c.fc.key === 'title') : tableCols;
  const line2Cols = twoLineMode ? tableCols.filter(c => !(c.kind === 'builtin' && (c.fc.key === 'taskMonth' || c.fc.key === 'title'))) : [];
  const colTemplate = buildCols(tableCols);
  const colMinWidth = buildMinWidth(tableCols);
  // 행(TaskRow)/헤더 공용 — 체크박스/드래그(+월)를 그리드 밖으로 뺀 필드 영역 템플릿
  const rowFieldsTemplate1 = buildRowFieldsCols(line1Cols);
  const rowFieldsTemplate2 = buildRowFieldsCols(line2Cols);
  const rowMinWidth = buildRowMinWidth(twoLineMode ? line1Cols : tableCols, twoLineMode ? railWidth : 46);

  const bottomSortOrder = () =>
    tasks.reduce((max, t) => Math.max(max, t.sortOrder ?? -1), -1) + 1;

  // 업무 복사 시 세부업무/커스텀필드 등 세부사항까지 포함할지 — 파트 오버라이드 → 팀 기본값
  // (팀 설정 > 파트 관리에서 팀/파트별로 개별 설정 가능). 기본은 false(기존 동작: 기본 정보만 복사)
  const buildCopyPayload = (task: Task, sortOrder: number): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> => {
    const taskPart = parts?.find(p => p.name === task.category);
    const includeDetails = resolveCopyIncludeDetails(currentTeam, taskPart);
    if (includeDetails) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = task;
      return { ...rest, sortOrder };
    }
    return {
      projectId: task.projectId,
      teamId: task.teamId,
      taskMonth: task.taskMonth,
      category: task.category,
      title: task.title,
      type: '신규',
      status: '진행 전',
      receiver: task.receiver,
      assignee: task.assignee,
      startDate: '',
      endDate: '',
      weeklyHours: {},
      totalHours: 0,
      revisionLevel: 0,
      sortOrder,
    };
  };

  const handleCopyTask = (task: Task) => {
    const idx = tasks.findIndex(t => t.id === task.id);
    tasks.forEach((t, i) => { if (t.sortOrder !== i) onUpdateTask(t.id, { sortOrder: i }); });
    onAddTask(buildCopyPayload(task, idx + 0.5));
  };

  const handleAddTask = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const base = bottomSortOrder();
    onAddTask({ ...data, sortOrder: base + (data.sortOrder ?? 0) }).catch((e: unknown) => {
      alert(`업무 등록 실패: ${e instanceof Error ? e.message : String(e)}`);
    });
  };

  const [myTasksOnly, setMyTasksOnly] = useState(() => localStorage.getItem('tm_myTasksOnly') === 'true');
  const [hideCompleted, setHideCompleted] = useState(() => localStorage.getItem('tm_hideCompleted') === 'true');
  const [assigneeFilter, setAssigneeFilter] = useState(() => localStorage.getItem('tm_assigneeFilter') ?? '');
  const [receiverFilter, setReceiverFilter] = useState(() => localStorage.getItem('tm_receiverFilter') ?? '');
  const [groupByField, setGroupByField] = useState<'assignee' | 'receiver' | null>(() => {
    const v = localStorage.getItem('tm_groupByField');
    return v === 'assignee' || v === 'receiver' ? v : null;
  });
  useEffect(() => { localStorage.setItem('tm_myTasksOnly', String(myTasksOnly)); }, [myTasksOnly]);
  useEffect(() => { localStorage.setItem('tm_hideCompleted', String(hideCompleted)); }, [hideCompleted]);
  useEffect(() => { localStorage.setItem('tm_assigneeFilter', assigneeFilter); }, [assigneeFilter]);
  useEffect(() => { localStorage.setItem('tm_receiverFilter', receiverFilter); }, [receiverFilter]);
  useEffect(() => { localStorage.setItem('tm_groupByField', groupByField ?? ''); }, [groupByField]);

  const isMyTask = (t: Task): boolean => {
    if (!currentUserName) return false;
    if (t.assignee === currentUserName) return true;
    if (t.receiver === currentUserName) return true;
    return !!t.subTaskData && Object.values(t.subTaskData).some(
      e => e.assignee === currentUserName || e.substitute === currentUserName
    );
  };

  // '담당자'/'접수자' 필드는 팀/파트 formConfig에서 명칭이 바뀌고(customLabel), 직군이
  // 지정돼 있으면 해당 직군 팀원만 후보가 되며, 실제 인물이 아닌 커스텀 선택형 값으로
  // 쓰이기도 한다. 그래서 team assignees 전체를 그냥 보여주면 안 되고, 현재 보이는
  // 파트(전체 탭이면 모든 파트)의 필드 설정을 반영해 후보를 좁혀야 한다.
  const relevantParts = activeCategory !== 'all'
    ? (parts?.filter(p => p.name === activeCategory) ?? [])
    : (parts ?? []);
  const personFieldOptions = (fieldKey: 'assignee' | 'receiver', getField: (t: Task) => string | undefined) => {
    const deptPool = new Set<string>();
    if (relevantParts.length === 0) {
      assignees.forEach(a => deptPool.add(a));
    } else {
      relevantParts.forEach(part => {
        // part.formConfig ?? formConfig 식으로 고르면, 파트가 다른 목적(라벨 등)으로
        // formConfig를 하나라도 갖는 순간 그 파트의 직군 설정이 팀 기본값으로 상속되지
        // 않고 통째로 날아가 버림 — mergeFormConfig로 필드 단위 상속을 반영해야 함
        const pFields = resolveBuiltinFields(part.formConfig ? mergeFormConfig(part.formConfig, formConfig) : formConfig);
        const fc = pFields.find(f => f.key === fieldKey);
        if (fc?.customType === 'select' && fc.options?.length) {
          fc.options.forEach(o => deptPool.add(o));
          return;
        }
        // TeamPart.departments(파트에 연결된 직군)는 이 필드의 직군 설정과 무관한 별개 용도로
        //쓰이는 값이라 여기 fallback으로 쓰면 안 됨 — 필드 자체에 직군이 없으면(='전체') 그
        // 파트에선 정말 제한이 없다는 뜻이므로 그대로 무제한(assignees)으로 둬야 함
        const depts = fc ? resolveFieldDepts(fc) : null;
        const names = depts && teamMembers?.length
          ? teamMembers.filter(m => m.department && depts.includes(m.department)).map(m => m.name)
          : assignees;
        names.forEach(n => deptPool.add(n));
      });
    }
    // 실데이터에 등장했지만 현재 필드 설정으로는 후보에 없는 값(설정 변경 이전 데이터 등)도 필터링은
    // 가능해야 함 — 단, tasks prop은 파트 구분 없이 팀 전체 업무가 다 들어있으므로 activeCategory가
    // 특정 파트면 그 파트 업무만 봐야 함. 안 그러면 다른 파트의 실제 담당자 이름이 이 파트 드롭다운에
    // 그대로 새어 들어옴(예: 라이브 업무의 담당자가 복지몰 담당자 드롭다운에 나타남)
    const relevantTasks = activeCategory !== 'all' ? tasks.filter(t => t.category === activeCategory) : tasks;
    const extra = new Set<string>();
    relevantTasks.forEach(t => { const v = getField(t); if (v && !deptPool.has(v)) extra.add(v); });
    const ordered = assignees.filter(a => deptPool.has(a));
    const deptOnly = [...deptPool].filter(v => !assignees.includes(v)).sort((a, b) => a.localeCompare(b));
    const extraSorted = [...extra].sort((a, b) => a.localeCompare(b));
    return [...ordered, ...deptOnly, ...extraSorted];
  };
  const assigneeFieldLabel = builtinLabels.assignee;
  const assigneeOptions = personFieldOptions('assignee', t => t.assignee);
  const receiverFieldLabel = builtinLabels.receiver;
  const receiverOptions = personFieldOptions('receiver', t => t.receiver);

  // 필터 바의 담당자/접수자 노출 순서를 테이블 컬럼 순서(builtinFields, 파트별 fieldOrder 반영)와
  // 맞춤 — 이전엔 항상 접수자 먼저 코드 순서로 고정돼 있어서, 파트에서 담당자 쪽 컬럼을 앞으로
  // 옮겨놔도(예: 복지몰이 '기획'을 뒤로, '디자인'을 앞으로) 필터 바만 반대 순서로 나왔음
  const receiverColIdx = builtinFields.findIndex(f => f.key === 'receiver');
  const assigneeColIdx = builtinFields.findIndex(f => f.key === 'assignee');
  const receiverFilterFirst = receiverColIdx === -1 || assigneeColIdx === -1 || receiverColIdx < assigneeColIdx;
  const personFilterOrder: ('receiver' | 'assignee')[] = receiverFilterFirst ? ['receiver', 'assignee'] : ['assignee', 'receiver'];

  useEffect(() => {
    if (assigneeFilter && !assigneeOptions.includes(assigneeFilter)) setAssigneeFilter('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigneeOptions.join(',')]);
  useEffect(() => {
    if (receiverFilter && !receiverOptions.includes(receiverFilter)) setReceiverFilter('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiverOptions.join(',')]);
  // '전체' 탭은 담당자/접수자 필터 UI 자체를 숨기므로, 다른 파트 탭에서 걸어둔 필터가
  // 안 보이는 채로 계속 적용되는 걸 방지하기 위해 '전체'로 돌아오면 초기화한다
  useEffect(() => {
    if (activeCategory === 'all') {
      setAssigneeFilter('');
      setReceiverFilter('');
      setGroupByField(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const filtered = tasks.filter((t: Task) => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (myTasksOnly && !isMyTask(t)) return false;
    if (canFilterByPerson && assigneeFilter && t.assignee !== assigneeFilter) return false;
    if (canFilterByPerson && receiverFilter && t.receiver !== receiverFilter) return false;
    if (hideCompleted && (t.status?.replace(/\s/g, '') === '완료')) return false;
    if (monthFilter > 0) {
      const prefix = `${yearFilter}-${String(monthFilter).padStart(2, '0')}`;
      if (t.taskMonth) return t.taskMonth === prefix;
      return t.startDate?.startsWith(prefix) || t.endDate?.startsWith(prefix);
    }
    return true;
  });

  type GroupBlock = { key: string; label: string; tasks: Task[]; part?: TeamPart | null; isPerson?: boolean };

  // 담당자/접수자별로 묶기 (필터와 별개로, 목록 전체를 사람 단위 섹션으로 재구성. 둘 중 하나만 활성화 가능)
  const personGroupedView = (): GroupBlock[] | null => {
    if (!canFilterByPerson || !groupByField) return null;
    const getField = groupByField === 'assignee' ? (t: Task) => t.assignee : (t: Task) => t.receiver;
    const options = groupByField === 'assignee' ? assigneeOptions : receiverOptions;
    const orderIdx = new Map(options.map((a, i) => [a, i]));
    const groups = new Map<string, Task[]>();
    filtered.forEach(t => {
      const key = getField(t) || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    });
    const names = [...groups.keys()].filter(k => k !== '').sort((a, b) => {
      const ai = orderIdx.has(a) ? orderIdx.get(a)! : Infinity;
      const bi = orderIdx.has(b) ? orderIdx.get(b)! : Infinity;
      return ai !== bi ? ai - bi : a.localeCompare(b);
    });
    const result: GroupBlock[] = names.map(name => ({ key: name, label: name, tasks: groups.get(name)!, isPerson: true }));
    if (groups.has('')) result.push({ key: '__unassigned', label: '미배정', tasks: groups.get('')! });
    return result;
  };

  // 전체 보기 시 파트 순서대로 그룹핑
  const partGroupedView = (): GroupBlock[] | null => {
    if (activeCategory !== 'all' || !parts || parts.length === 0) return null;
    const partNameOrder = new Map(parts.map((p, i) => [p.name, i]));
    const groups = new Map<string, Task[]>();
    const ungrouped: Task[] = [];
    filtered.forEach(t => {
      if (partNameOrder.has(t.category)) {
        if (!groups.has(t.category)) groups.set(t.category, []);
        groups.get(t.category)!.push(t);
      } else {
        ungrouped.push(t);
      }
    });
    const result: GroupBlock[] = [];
    parts.forEach(part => {
      const grp = groups.get(part.name);
      if (grp && grp.length > 0) result.push({ key: part.id, label: part.name, part, tasks: grp });
    });
    if (ungrouped.length > 0) result.push({ key: '__ungrouped', label: '미분류', part: null, tasks: ungrouped });
    return result;
  };

  const groupedView = personGroupedView() ?? partGroupedView();

  const displayFlat = groupedView ? groupedView.flatMap(g => g.tasks) : filtered;

  const handleDrop = (dropOnId: string) => {
    if (!dragId || dragId === dropOnId) { setDragId(null); setDragOverId(null); return; }
    // sortOrder는 파트 구분 없는 팀 전체 공용 값이라, 화면에 보이는(필터된) 목록만 기준으로
    // 0부터 다시 매기면 다른 파트 업무와 순서 값이 겹친다(충돌). 그러면 그 파트에서 업무를
    // 추가/삭제/재정렬할 때마다 동점(tie) 처리 기준인 Firestore 스냅샷 순서가 바뀌어, 아무것도
    // 손대지 않은 이 파트의 화면 순서까지 같이 흔들려 보이는 문제가 있었다. 항상 팀 전체
    // 업무(tasks) 기준으로 이동시켜 팀 전체에서 고유한 순서를 유지한다.
    const ids = tasks.map(t => t.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(dropOnId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newIds = [...ids];
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, dragId);
    newIds.forEach((id, idx) => {
      const t = tasks.find(x => x.id === id);
      if (t && t.sortOrder !== idx) onUpdateTask(id, { sortOrder: idx });
    });
    setDragId(null);
    setDragOverId(null);
  };

  const renderTaskRow = (task: Task) => {
    const taskPart = parts?.find(p => p.name === task.category);
    const resolvedMetaFields = taskPart?.metaFields ?? teamMetaFields ?? DEFAULT_META_FIELDS;
    const resolvedFormConfig = taskPart?.formConfig ? mergeFormConfig(taskPart.formConfig, formConfig) : formConfig;
    return (
      <TaskRow
        key={task.id}
        task={task}
        onUpdate={onUpdateTask}
        onDelete={onDeleteTask}
        onDeleteRequest={(id, title) => setPendingDelete({ id, title })}
        onOpenDetail={() => onOpenDetail(task.id)}
        onCopy={() => handleCopyTask(task)}
        canManage={canManage}
        canDelete={canDelete}
        assignees={assignees}
        teamMembers={teamMembers}
        tableFields={tableFields}
        tableCfs={tableCfs}
        tableCols={tableCols}
        statusConfigs={statusConfigs}
        twoLineMode={twoLineMode}
        rowFieldsTemplate1={rowFieldsTemplate1}
        rowFieldsTemplate2={rowFieldsTemplate2}
        line2Cols={line2Cols}
        monthColWidth={monthColWidth}
        rowMinWidth={rowMinWidth}
        metaFields={resolvedMetaFields}
        formConfig={resolvedFormConfig}
        isDragging={dragId === task.id}
        isDragOver={dragOverId === task.id}
        isActive={activeTaskId === task.id}
        expanded={expandedId === task.id}
        onToggleExpand={() => setExpandedId(prev => prev === task.id ? null : task.id)}
        onDragStart={() => setDragId(task.id)}
        onDragOver={() => setDragOverId(task.id)}
        onDrop={() => handleDrop(task.id)}
        onDragEnd={() => { setDragId(null); setDragOverId(null); }}
        userPhotoMap={userPhotoMap}
        partColor={partColor}
        parts={parts}
        selected={selectedIds.has(task.id)}
        onSelect={() => setSelectedIds(prev => {
          const next = new Set(prev);
          next.has(task.id) ? next.delete(task.id) : next.add(task.id);
          return next;
        })}
      />
    );
  };

  // 헤더 셀 렌더링 — 1줄 모드에서는 tableCols 전체, 2줄 모드에서는 line1Cols/line2Cols로 나눠 호출
  const renderHeaderCols = (cols: TableCol[]) => cols.flatMap(col => {
    if (col.kind === 'custom') {
      return [
        <div key={col.cf.id} className="flex items-center justify-center select-none">
          <span>{col.cf.label}</span>
        </div>,
      ];
    }
    const fc = col.fc;
    const hLabel = fc.customLabel ?? BUILTIN_FIELDS_META.find(m => m.key === fc.key)?.label ?? HEADER_LABEL[fc.key];
    if (fc.key === 'title') return [
      <span key="title" className="pl-3.5 text-gray-500">{hLabel}</span>,
    ];
    if (fc.key === 'weeklyHours') {
      return [<span key="h-total" className="text-center">합계</span>];
    }
    return [
      <div key={fc.key} className="flex items-center justify-center select-none">
        <span>{hLabel}</span>
      </div>,
    ];
  });

  return (
    <div>
      {/* 제목은 항상 필터탭+버튼 블록과 같은 줄(가장 왼쪽)에 고정 — 제목 자체는 절대
          줄바꿈되지 않고, 그 오른쪽 블록만 내부적으로 필요한 만큼 여러 줄로 나뉨.
          블록 안에서는 컨테이너 폭(@container) 기준으로 넓을 때 필터탭+버튼이 한 줄에
          같이 표시되고, 좁아지면(주로 메일 양식까지 열렸을 때) 그 사이만 줄바꿈됨 */}
      <div className="@container mb-4">
        <div className="flex items-center justify-between gap-y-2">
          <div className="flex-shrink-0 whitespace-nowrap">
            <h1 className="page-title whitespace-nowrap">업무 관리</h1>
            <p className="page-subtitle whitespace-nowrap">업무 목록 · {filtered.length}건</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end flex-1 min-w-0">
            <CategoryTabs active={activeCategory} onChange={onCategoryChange} parts={parts} />
            <div className="hidden @max-[700px]:block basis-full h-0" />
          {canManage && brokenDateTasks.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={runDateFieldFix}
                disabled={fixingDateFields}
                title="엑셀 가져오기로 날짜 필드에 시리얼 숫자 등 잘못된 값이 들어간 업무를 정상 날짜로 복구합니다."
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)', boxShadow: '0 4px 14px rgba(217,119,6,0.3)' }}>
                <Info size={14} /> {fixingDateFields ? '복구 중...' : `날짜 필드 복구 (${brokenDateTasks.length})`}
              </button>
              {dateFixMsg && <span className="text-xs text-gray-500">{dateFixMsg}</span>}
            </div>
          )}
          {parts && parts.length > 0 ? (
            <div className="relative flex-shrink-0" ref={templateDropRef}>
              <button
                onClick={() => setTemplateDropOpen(o => !o)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all flex-shrink-0 whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg,#94a3b8 0%,#64748b 100%)', boxShadow: '0 4px 14px rgba(100,116,139,0.25)' }}>
                <FileDown size={14} /> 템플릿
              </button>
              {templateDropOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-black/6 p-2 min-w-[160px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 pt-1 pb-2">파트 선택</p>
                  {parts.map(p => (
                    <button key={p.id} onClick={() => downloadTemplate(p)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                      <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                      {p.excelConfig && <span className="text-[10px] text-blue-500 font-medium ml-auto">별도</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => downloadTemplate()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all flex-shrink-0 whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg,#94a3b8 0%,#64748b 100%)', boxShadow: '0 4px 14px rgba(100,116,139,0.25)' }}>
              <FileDown size={14} /> 템플릿
            </button>
          )}
          <div className="relative flex-shrink-0" ref={exportDropRef}>
            <button
              onClick={() => {
                if (!exportDropOpen) {
                  setExportParts(parts && parts.length > 0 ? new Set(parts.map(p => p.name)) : new Set());
                  setExportMonths(new Set(monthsWithData));
                }
                setExportDropOpen(o => !o);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg,#64748b 0%,#475569 100%)', boxShadow: '0 4px 14px rgba(100,116,139,0.35)' }}>
              <Download size={14} /> 내보내기
            </button>
            {exportDropOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-black/6 p-4 w-[260px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>

                {/* 파트 선택 */}
                {parts && parts.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">파트 선택</p>
                    <button
                      onClick={() => setExportParts(exportParts.size === parts.length ? new Set() : new Set(parts.map(p => p.name)))}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1 transition-colors text-left ${exportParts.size === parts.length ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${exportParts.size === parts.length ? 'bg-white border-white' : 'border-gray-400 bg-white'}`}>
                        {exportParts.size === parts.length && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {exportParts.size > 0 && exportParts.size < parts.length && <div className="w-2 h-0.5 bg-gray-400 rounded" />}
                      </div>
                      <span className="text-xs font-semibold">전체 선택</span>
                    </button>
                    <div className="space-y-0.5 mb-3">
                      {parts.map(p => {
                        const checked = exportParts.has(p.name);
                        return (
                          <button key={p.id} onClick={() => { const next = new Set(exportParts); checked ? next.delete(p.name) : next.add(p.name); setExportParts(next); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all text-left ${checked ? 'bg-slate-50 ring-1 ring-slate-200' : 'hover:bg-gray-50'}`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${checked ? 'bg-slate-600 border-slate-600' : 'border-gray-300 bg-white'}`}>
                              {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${p.color}`} />
                            <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-full h-px bg-black/5 mb-3" />
                  </>
                )}

                {/* 월 선택 */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{yearFilter}년 월 선택</p>
                  <button
                    onClick={() => setExportMonths(exportMonths.size === monthsWithData.size ? new Set() : new Set(monthsWithData))}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-700"
                  >{exportMonths.size === monthsWithData.size ? '전체 해제' : '전체 선택'}</button>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const hasData = monthsWithData.has(m);
                    const selected = exportMonths.has(m);
                    return (
                      <button
                        key={m}
                        disabled={!hasData}
                        onClick={() => { const next = new Set(exportMonths); selected ? next.delete(m) : next.add(m); setExportMonths(next); }}
                        className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                          !hasData
                            ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                            : selected
                              ? 'bg-slate-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >{m}월</button>
                    );
                  })}
                </div>

                {/* 호환성 경고 */}
                {!exportCompatible && exportParts.size > 1 && (
                  <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1.5L12.5 11H1.5L7 1.5Z" stroke="#d97706" strokeWidth="1.3" strokeLinejoin="round"/>
                      <path d="M7 5.5V8" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round"/>
                      <circle cx="7" cy="9.5" r="0.6" fill="#d97706"/>
                    </svg>
                    <p className="text-[11px] text-amber-700 leading-snug font-medium">파트 간 항목 명칭 또는 순서가 달라 함께 내보낼 수 없습니다</p>
                  </div>
                )}

                <button
                  onClick={() => handleExcelExport(exportParts.size > 0 ? exportParts : undefined, exportMonths.size > 0 ? exportMonths : undefined)}
                  disabled={exportMonths.size === 0 || !exportCompatible}
                  className="w-full py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: (exportMonths.size > 0 && exportCompatible) ? 'linear-gradient(135deg,#64748b 0%,#475569 100%)' : undefined, boxShadow: (exportMonths.size > 0 && exportCompatible) ? '0 4px 12px rgba(100,116,139,0.35)' : undefined }}>
                  내보내기
                  {exportMonths.size > 0 && <span className="opacity-75 text-xs ml-1">({exportMonths.size}개월{(parts && parts.length > 0 && exportParts.size > 0) ? ` · ${exportParts.size}개 파트` : ''})</span>}
                </button>
              </div>
            )}
          </div>
          {canCreate && (
            <>
              {parts && parts.length > 0 ? (
                <div className="relative flex-shrink-0" ref={importDropRef}>
                  <button
                    onClick={() => {
                      if (!importDropOpen) setImportParts(new Set(parts.map(p => p.name)));
                      setImportDropOpen(o => !o);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
                    <Upload size={14} /> 엑셀 등록
                  </button>
                  {importDropOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-black/6 p-4 w-[260px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">파트 선택</p>
                      <button
                        onClick={() => setImportParts(importParts.size === parts.length ? new Set() : new Set(parts.map(p => p.name)))}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1 transition-colors text-left ${importParts.size === parts.length ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${importParts.size === parts.length ? 'bg-white border-white' : 'border-gray-400 bg-white'}`}>
                          {importParts.size === parts.length && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          {importParts.size > 0 && importParts.size < parts.length && <div className="w-2 h-0.5 bg-gray-400 rounded" />}
                        </div>
                        <span className="text-xs font-semibold">전체 선택</span>
                      </button>
                      <div className="space-y-0.5 mb-3">
                        {parts.map(p => {
                          const checked = importParts.has(p.name);
                          return (
                            <button key={p.id}
                              onClick={() => { const next = new Set(importParts); checked ? next.delete(p.name) : next.add(p.name); setImportParts(next); }}
                              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all text-left ${checked ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-gray-50'}`}>
                              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${checked ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'}`}>
                                {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${p.color}`} />
                              <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {!importCompatible && importParts.size > 1 && (
                        <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                          <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 1.5L12.5 11H1.5L7 1.5Z" stroke="#d97706" strokeWidth="1.3" strokeLinejoin="round"/>
                            <path d="M7 5.5V8" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round"/>
                            <circle cx="7" cy="9.5" r="0.6" fill="#d97706"/>
                          </svg>
                          <p className="text-[11px] text-amber-700 leading-snug font-medium">파트 간 항목 명칭 또는 순서가 달라 함께 등록할 수 없습니다</p>
                        </div>
                      )}
                      <button
                        onClick={() => importRef.current?.click()}
                        disabled={importParts.size === 0 || !importCompatible}
                        className="w-full py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ background: (importParts.size > 0 && importCompatible) ? 'linear-gradient(135deg,#10b981 0%,#059669 100%)' : undefined, boxShadow: (importParts.size > 0 && importCompatible) ? '0 4px 14px rgba(16,185,129,0.35)' : undefined }}>
                        파일 선택
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => importRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all flex-shrink-0 whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
                  <Upload size={14} /> 엑셀 등록
                </button>
              )}
              <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
              <button onClick={() => setModalOpen(true)}
                className="btn-shiny-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold flex-shrink-0 whitespace-nowrap">
                <Plus size={14} /> 새 업무
              </button>
            </>
          )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <FilterSelect label="연도" value={yearFilter} onChange={v => setYearFilter(Number(v))}>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </FilterSelect>
        <FilterSelect label="월" value={monthFilter} onChange={v => setMonthFilter(Number(v))}>
          <option value={0}>전체</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}월{m === now.getMonth() + 1 ? ' ●' : ''}</option>)}
        </FilterSelect>
        <button
          onClick={() => setMyTasksOnly(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            myTasksOnly
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'glass-card !rounded-lg !overflow-visible text-gray-600 hover:text-indigo-600'
          }`}
        >
          <User size={11} />
          내 업무만
        </button>
        {/* 담당자/접수자 필터·그룹보기는 파트마다 라벨/직군이 달라 '전체' 탭에서 하나로 합칠 수
            없으므로, 파트가 특정된 탭에서만 노출한다. 노출 순서는 personFilterOrder(테이블
            컬럼 순서와 동일)를 따른다 — 예전엔 항상 접수자를 먼저 렌더링해서, 파트에서 담당자
            컬럼을 앞으로 옮겨도 필터 바만 반대 순서로 나왔음 */}
        {activeCategory !== 'all' && canFilterByPerson && personFilterOrder.map(key => {
          if (key === 'receiver' && receiverFieldLabel === assigneeFieldLabel) return null;
          // 폼 설정에서 꺼둔(enabled=false) 필드는 목록에 컬럼 자체가 없으므로 필터도 숨김 —
          // 안 그러면 실제 데이터에 남은 옛 값 때문에 컬럼 없는 필터만 남는 경우가 생김
          if (!tableFields.some(f => f.key === key)) return null;
          const label = key === 'receiver' ? receiverFieldLabel : assigneeFieldLabel;
          const options = key === 'receiver' ? receiverOptions : assigneeOptions;
          const value = key === 'receiver' ? receiverFilter : assigneeFilter;
          const onChange = key === 'receiver' ? setReceiverFilter : setAssigneeFilter;
          if (options.length === 0) return null;
          return (
            <FilterSelect key={key} label={label} value={value} onChange={onChange}>
              <option value="">전체</option>
              {options.map(a => <option key={a} value={a}>{a}</option>)}
            </FilterSelect>
          );
        })}
        {activeCategory !== 'all' && canFilterByPerson && personFilterOrder.map(key => {
          if (key === 'receiver' && receiverFieldLabel === assigneeFieldLabel) return null;
          if (!tableFields.some(f => f.key === key)) return null;
          const label = key === 'receiver' ? receiverFieldLabel : assigneeFieldLabel;
          const options = key === 'receiver' ? receiverOptions : assigneeOptions;
          if (options.length === 0) return null;
          return (
            <button key={key}
              onClick={() => setGroupByField(f => f === key ? null : key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                groupByField === key
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-200'
                  : 'glass-card !rounded-lg !overflow-visible text-gray-600 hover:text-violet-600'
              }`}
            >
              <Users size={11} />
              {label}별로 보기
            </button>
          );
        })}
        <button
          onClick={() => setHideCompleted(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            hideCompleted
              ? 'bg-green-600 text-white shadow-sm shadow-green-200'
              : 'glass-card !rounded-lg !overflow-visible text-gray-600 hover:text-green-600'
          }`}
        >
          <EyeOff size={11} />
          완료 숨기기
        </button>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">총 {filtered.length}건</span>
      </div>

      <div className="glass-card-noclip overflow-x-auto">
        {/* 헤더 */}
        <div className="text-[11px] text-gray-500 font-semibold bg-black/3 border-b border-black/5">
          {(() => {
            const selectAllCheckbox = (
              <div className="flex items-center justify-center cursor-pointer"
                onClick={() => {
                  if (selectedIds.size > 0) setSelectedIds(new Set());
                  else setSelectedIds(new Set(filtered.map(t => t.id)));
                }}>
                <div className={`w-[15px] h-[15px] rounded border-2 flex items-center justify-center transition-all ${
                  selectedIds.size > 0 && selectedIds.size >= filtered.length
                    ? 'bg-indigo-600 border-indigo-600'
                    : selectedIds.size > 0
                      ? 'border-indigo-400 bg-white'
                      : 'border-gray-300 bg-white hover:border-indigo-400'
                }`}>
                  {selectedIds.size > 0 && selectedIds.size >= filtered.length && (
                    <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {selectedIds.size > 0 && selectedIds.size < filtered.length && (
                    <div className="w-2 h-0.5 bg-indigo-500 rounded" />
                  )}
                </div>
              </div>
            );
            if (!twoLineMode) return (
              <div className="grid gap-x-3 px-3 py-2.5" style={{ gridTemplateColumns: colTemplate, minWidth: colMinWidth }}>
                {selectAllCheckbox}
                {/* 드래그핸들 열 헤더 */}
                <span />
                {renderHeaderCols(line1Cols)}
                <span />
              </div>
            );
            // 2줄 모드: 헤더는 항상 1줄(체크박스/드래그/월 레일 + 업무명)만 표시 — 2번째 줄
            // 필드들의 이름은 헤더에 두지 않고 각 업무 행 안에서 값과 함께 라벨로 보여줌
            // (헤더 자체는 2줄/가로 스크롤이 필요 없게 함)
            // 업무 카드가 목록 바깥쪽에 p-2(8px) 만큼 들여써져 있으므로, 카드 자체의 px-3(12px)과
            // 합쳐 카드 내용은 컨테이너 좌우 끝에서 20px(px-5)만큼 안쪽에서 시작함 — 헤더도 동일하게
            // px-5를 줘서 체크박스/월/업무명 칼럼이 카드 내용과 정확히 세로로 맞도록 함
            return (
              <div className="flex items-center gap-3 px-5 py-2.5">
                <div className="flex items-center gap-3 flex-shrink-0">
                  {selectAllCheckbox}
                  <span style={{ width: 18 }} />
                  {monthCol && (
                    <div className="flex items-center justify-center select-none" style={{ width: monthColWidth }}>
                      <span>{HEADER_LABEL.taskMonth}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 grid gap-x-3 items-center" style={{ gridTemplateColumns: rowFieldsTemplate1 }}>
                  {renderHeaderCols(line1Cols)}
                </div>
                <span className="flex-shrink-0" style={{ width: 110 }} />
              </div>
            );
          })()}
        </div>

        {/* 아래쪽만 카드 자체의 mb-2가 이미 여백을 만들어주므로 컨테이너의 pb는 생략 —
            그렇지 않으면 목록 맨 아래(마지막 카드 밑)만 위쪽(첫 카드 위)보다 여백이
            두 배로 넓어짐 */}
        <div className={twoLineMode ? 'px-2 pt-2' : ''}>
          {displayFlat.length === 0 && (
            <div className="py-14 text-center text-sm text-gray-400">등록된 업무가 없습니다</div>
          )}

          {groupedView ? groupedView.map(({ key, label, part, tasks: grpTasks, isPerson }) => (
            <div key={key}>
              <div
                className={`flex items-center gap-2 px-3 py-2 bg-gray-50/70 ${twoLineMode ? 'rounded-lg mb-2' : 'border-b border-black/5'}`}
                style={{ minWidth: rowMinWidth }}
              >
                {isPerson ? (
                  <>
                    <MiniAvatar name={label} photoURL={userPhotoMap?.get(label)} />
                    <span className="text-[11px] font-bold text-gray-700">{label}</span>
                  </>
                ) : part ? (
                  <>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />
                    <span className="text-[11px] font-bold text-gray-700">{part.name}</span>
                  </>
                ) : (
                  <span className="text-[11px] font-bold text-gray-500">{label}</span>
                )}
                <span className="text-[11px] text-gray-400 ml-0.5">{grpTasks.length}건</span>
              </div>
              {grpTasks.map(renderTaskRow)}
            </div>
          )) : filtered.map(renderTaskRow)}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        taskTitle={pendingDelete?.title ?? ''}
        message="업무를 휴지통으로 이동할까요?"
        subMessage="휴지통 페이지에서 다시 복구할 수 있습니다"
        onConfirm={() => { onDeleteTask(pendingDelete!.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingBulkDelete}
        taskTitle={`선택한 ${selectedIds.size}개의 업무`}
        message="업무를 휴지통으로 이동할까요?"
        subMessage="휴지통 페이지에서 다시 복구할 수 있습니다"
        onConfirm={() => {
          selectedIds.forEach(id => onDeleteTask(id));
          setSelectedIds(new Set());
          setPendingBulkDelete(false);
        }}
        onCancel={() => setPendingBulkDelete(false)}
      />

      {/* 다중 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-sm font-semibold text-white">{selectedIds.size}개 선택됨</span>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={() => {
              tasks.forEach((t, i) => { if (t.sortOrder !== i) onUpdateTask(t.id, { sortOrder: i }); });
              filtered
                .filter(t => selectedIds.has(t.id))
                .forEach((t, i) => {
                  const idx = tasks.findIndex(x => x.id === t.id);
                  onAddTask(buildCopyPayload(t, idx + 0.5 + i * 0.01));
                });
              setSelectedIds(new Set());
            }}
            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors">
            <Copy size={13} /> 복사
          </button>
          {canCreate && eligibleSupportTeams.length > 0 && <>
            <div className="w-px h-4 bg-white/20" />
            <button
              onClick={() => {
                setRequestTargetTeamId(''); setRequestTargetPart('');
                setRequestTargetMonth(monthFilter > 0 ? `${yearFilter}-${String(monthFilter).padStart(2, '0')}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
                setShowRequestModal(true);
              }}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors">
              <Send size={13} /> 지원 요청
            </button>
          </>}
          {canDelete && <>
            <div className="w-px h-4 bg-white/20" />
            <button
              onClick={() => setPendingBulkDelete(true)}
              className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm font-semibold transition-colors">
              <Trash2 size={13} /> 삭제
            </button>
          </>}
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-400 hover:text-white text-sm transition-colors">
            선택 해제
          </button>
        </div>
      )}

      <NewTaskModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleAddTask}
        projectId={projectId} parts={parts} assignees={assignees} teamMembers={teamMembers} formConfig={formConfig} currentUserName={currentUserName} plMainTaskTypes={canSeeAll ? plMainTaskTypes : undefined} />

      {/* 지원팀 업무 요청 모달 */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-800">지원팀에 업무 요청</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                선택한 {selectedIds.size}개 업무의 메인 업무 정보만 복사되어 등록됩니다 (세부업무·시간 데이터는 제외)
              </p>
            </div>
            <div className="px-6 py-4 space-y-3.5">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">지원팀 선택</p>
                <div className="flex flex-col gap-1.5">
                  {eligibleSupportTeams.map(t => (
                    <button key={t.id}
                      onClick={() => { setRequestTargetTeamId(t.id); setRequestTargetPart(''); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left border transition-colors ${
                        requestTargetTeamId === t.id ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      <span>{t.emoji}</span>{t.name}
                    </button>
                  ))}
                </div>
              </div>
              {requestTargetTeam && requestTargetTeam.parts.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">등록할 파트</p>
                  <select
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    value={requestTargetPart}
                    onChange={e => setRequestTargetPart(e.target.value)}
                  >
                    <option value="">선택</option>
                    {requestTargetTeam.parts.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {requestTargetTeam && requestTargetTeam.parts.length === 0 && (
                <p className="text-xs text-gray-400">이 지원팀은 파트가 없어 파트 구분 없이 바로 등록됩니다</p>
              )}
              {requestTargetTeam && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">등록될 월</p>
                  <div className="flex gap-1.5">
                    <select
                      className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      value={requestTargetMonth.slice(0, 4)}
                      onChange={e => setRequestTargetMonth(`${e.target.value}-${requestTargetMonth.slice(5) || '01'}`)}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                        <option key={y} value={y}>{y}년</option>
                      ))}
                    </select>
                    <select
                      className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      value={requestTargetMonth.slice(5)}
                      onChange={e => setRequestTargetMonth(`${requestTargetMonth.slice(0, 4)}-${e.target.value}`)}
                    >
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                        <option key={m} value={m}>{parseInt(m)}월</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button
                disabled={!requestTargetTeamId || (requestTargetTeam ? requestTargetTeam.parts.length > 0 && !requestTargetPart : true) || requestSending}
                onClick={async () => {
                  if (!onRequestToSupportTeam) return;
                  setRequestSending(true);
                  try {
                    await onRequestToSupportTeam([...selectedIds], requestTargetTeamId, requestTargetPart, requestTargetMonth);
                    setShowRequestModal(false);
                    setSelectedIds(new Set());
                  } finally {
                    setRequestSending(false);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 transition-colors">
                {requestSending ? '보내는 중…' : '보내기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 가져오기 미리보기 모달 */}
      {importPreview && (() => {
        const currentMonthStr = `${yearFilter}-${String(monthFilter).padStart(2, '0')}`;
        const existingKeys = new Set(tasks.map(t => `${t.title.trim()}||${t.category}||${t.taskMonth}`));
        // 중복으로 감지된 인덱스 집합 (같은 월+파트+제목)
        const dupeSet = new Set(importPreview.rows.map((r, i) => {
          const cat = previewCats[i] ?? r.category ?? '';
          const month = r.taskMonth || currentMonthStr;
          return existingKeys.has(`${(r.title ?? '').trim()}||${cat}||${month}`) ? i : -1;
        }).filter(i => i >= 0));
        const registerCount = importPreview.rows.length - previewSkipped.size;
        const updateCount = [...previewUpdateSet].filter(i => dupeSet.has(i)).length;
        const addCount = registerCount - updateCount;
        const close = () => { setImportPreview(null); setPreviewCats({}); setPreviewSkipped(new Set()); setPreviewUpdateSet(new Set()); };
        const cycleDupeMode = (i: number) => {
          const isSkipped = previewSkipped.has(i);
          const isUpdate = previewUpdateSet.has(i);
          if (isSkipped) {
            // 건너뜀 → 업데이트
            setPreviewSkipped(prev => { const s = new Set(prev); s.delete(i); return s; });
            setPreviewUpdateSet(prev => { const s = new Set(prev); s.add(i); return s; });
          } else if (isUpdate) {
            // 업데이트 → 새로추가
            setPreviewUpdateSet(prev => { const s = new Set(prev); s.delete(i); return s; });
          } else {
            // 새로추가 → 건너뜀
            setPreviewSkipped(prev => { const s = new Set(prev); s.add(i); return s; });
          }
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">엑셀 업무 등록 미리보기</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    총 {importPreview.rows.length}건 · 중복 {dupeSet.size}건 ·{' '}
                    {addCount > 0 && <span className="text-green-600 font-medium">{addCount}건 등록</span>}
                    {addCount > 0 && updateCount > 0 && <span> · </span>}
                    {updateCount > 0 && <span className="text-blue-600 font-medium">{updateCount}건 업데이트</span>}
                    {registerCount === 0 && <span className="text-gray-400">처리 없음</span>}
                    {dupeSet.size > 0 && <span className="text-gray-400"> (중복 항목 클릭으로 모드 변경)</span>}
                  </p>
                </div>
                <button onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-3 space-y-1.5">
                {importPreview.rows.map((row, i) => {
                  const isDupe = dupeSet.has(i);
                  const isSkipped = previewSkipped.has(i);
                  const isUpdate = previewUpdateSet.has(i);
                  const catVal = previewCats[i] ?? row.category ?? '';
                  const partNameSet = new Set(parts?.map(p => p.name) ?? []);
                  const needsCat = parts && parts.length > 0 && (!catVal || !partNameSet.has(catVal));
                  const dupeModeColor = isSkipped
                    ? 'bg-red-50 text-red-400 cursor-pointer hover:bg-red-100'
                    : isUpdate
                    ? 'bg-blue-50 text-blue-700 cursor-pointer hover:bg-blue-100'
                    : isDupe
                    ? 'bg-green-50 text-green-700 cursor-pointer hover:bg-green-100'
                    : 'bg-gray-50 text-gray-700';
                  return (
                    <div key={i}
                      onClick={isDupe ? () => cycleDupeMode(i) : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${dupeModeColor}`}>
                      {isDupe ? (
                        <span className={`w-4 h-4 rounded flex-shrink-0 border text-[9px] flex items-center justify-center font-bold ${
                          isSkipped ? 'border-red-300 text-red-400' :
                          isUpdate ? 'border-blue-400 bg-blue-400 text-white' :
                          'border-green-400 bg-green-400 text-white'
                        }`}>
                          {isSkipped ? '✕' : isUpdate ? '↑' : '✓'}
                        </span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-400" />
                      )}
                      <span className={`font-medium flex-1 truncate ${isSkipped ? 'line-through opacity-60' : ''}`}>{row.title}</span>
                      {needsCat ? (
                        <select
                          className="text-xs border border-orange-300 rounded-lg px-2 py-0.5 bg-orange-50 text-orange-700 focus:outline-none cursor-pointer"
                          value={previewCats[i] ?? ''}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setPreviewCats(prev => ({ ...prev, [i]: e.target.value }))}>
                          <option value="">파트 선택</option>
                          {parts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      ) : (
                        catVal && <span className="text-[11px] opacity-60">{catVal}</span>
                      )}
                      {isDupe && (
                        <span className={`text-[10px] font-semibold ${isSkipped ? 'text-red-400' : isUpdate ? 'text-blue-600' : 'text-green-600'}`}>
                          {isSkipped ? '건너뜀' : isUpdate ? '업데이트' : '새로추가'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
                <button onClick={close}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button onClick={handleImportConfirm} disabled={registerCount === 0}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-colors">
                  {addCount > 0 && updateCount > 0
                    ? `${addCount}건 등록 · ${updateCount}건 업데이트`
                    : updateCount > 0
                    ? `${updateCount}건 업데이트`
                    : `${addCount}건 등록`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: {
  label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 glass-card !rounded-lg !overflow-visible px-2.5 py-1.5 text-xs">
      <span className="text-gray-500 font-medium">{label}</span>
      <select className="bg-transparent border-none focus:outline-none text-gray-800 font-semibold cursor-pointer text-xs"
        value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

function MiniAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  if (!name) return null;
  return photoURL
    ? <img src={photoURL} alt={name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
    : <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-300 to-purple-400 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">{name.slice(0, 1)}</div>;
}

function TaskRow({ task, onUpdate, onDelete, onDeleteRequest, onOpenDetail, onCopy, canManage, canDelete, parts, assignees, teamMembers, tableFields, tableCfs, tableCols, statusConfigs, twoLineMode, rowFieldsTemplate1, rowFieldsTemplate2, line2Cols, monthColWidth, rowMinWidth, metaFields, formConfig, isDragging, isDragOver, isActive, expanded, onToggleExpand, onDragStart, onDragOver, onDrop, onDragEnd, userPhotoMap, partColor, selected, onSelect }: {
  task: Task;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onDeleteRequest: (id: string, title: string) => void;
  onOpenDetail: () => void;
  onCopy: () => void;
  canManage: boolean;
  canDelete?: boolean;
  parts?: TeamPart[];
  assignees: string[];
  teamMembers?: { name: string; department?: Department }[];
  tableFields: BuiltinFieldConfig[];
  tableCfs: CustomFormField[];
  tableCols: TableCol[];
  statusConfigs: StatusConfig[];
  twoLineMode: boolean;
  rowFieldsTemplate1: string;
  rowFieldsTemplate2: string;
  line2Cols: TableCol[];
  monthColWidth: number;
  rowMinWidth: number;
  metaFields?: MetaField[];
  formConfig?: TeamFormConfig;
  isDragging: boolean;
  isDragOver: boolean;
  isActive: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  userPhotoMap?: Map<string, string>;
  partColor: (cat: string) => string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const [metaCopied, setMetaCopied] = useState(false);
  const [copiedUrlKey, setCopiedUrlKey] = useState<string | null>(null);
  // 드롭다운(select) 타입 커스텀 필드 중 "직접 입력"으로 전환한 필드 id 모음 — 목록 대신
  // 자유 텍스트로 입력하다가 다시 목록 선택으로 되돌릴 수 있게 함
  const [manualCustomFields, setManualCustomFields] = useState<Set<string>>(new Set());
  // 직접 입력 중인 값은 매 키 입력마다 바로 저장(onUpdate)하면 한글 조합 중인 입력이 끊겨
  // 자모가 분리되어 보이므로, 로컬 draft로만 편집하고 blur 시에만 실제로 저장
  const [manualFieldDrafts, setManualFieldDrafts] = useState<Record<string, string>>({});
  const copyUrl = (key: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrlKey(key);
    setTimeout(() => setCopiedUrlKey(null), 1500);
  };
  // 2번째 줄(필드 영역)과 3번째 줄(업무 정보 확장)의 가로 스크롤을 각각 스크롤바 없이
  // 좌우 토글 버튼으로 조작할 수 있게 함
  const line2H = useHScroll();
  const line3H = useHScroll();
  const filledMeta = (metaFields ?? []).filter(f => task.customFields?.[f.key]);
  const tableCfIds = new Set(tableCfs.map(cf => cf.id));
  // task.category 파트의 receiver/assignee 순서가 전체 탭(tableFields)과 반대이면 swap
  const { taskPartFields, swapReceiverAssignee } = useMemo(() => {
    const taskPart = parts?.find(p => p.name === task.category);
    const partFields = taskPart?.formConfig ? resolveBuiltinFields(taskPart.formConfig) : null;
    const partFO = taskPart?.formConfig?.fieldOrder;
    const globalRIdx = tableFields.findIndex(f => f.key === 'receiver');
    const globalAIdx = tableFields.findIndex(f => f.key === 'assignee');
    const partRIdx = partFO ? partFO.indexOf('receiver') : -1;
    const partAIdx = partFO ? partFO.indexOf('assignee') : -1;
    const swap =
      partFO != null &&
      globalRIdx !== -1 && globalAIdx !== -1 &&
      partRIdx !== -1 && partAIdx !== -1 &&
      (partAIdx < partRIdx) !== (globalAIdx < globalRIdx);
    return { taskPartFields: partFields, swapReceiverAssignee: swap };
  }, [parts, task.category, tableFields]);
  const enabledCfs = (formConfig?.customFields ?? []).filter(cf => cf.enabled !== false && cf.showIn !== 'detail' && !tableCfIds.has(cf.id));

  const copyMetaFields = async () => {
    const entries: { label: string; value: string; isUrl: boolean }[] = [];
    filledMeta.forEach(f => entries.push({ label: f.label, value: task.customFields![f.key], isUrl: f.isUrl ?? false }));
    enabledCfs.forEach(cf => {
      const val = (task.customFields as Record<string, string> | undefined)?.[cf.id] ?? '';
      if (val) entries.push({ label: cf.label, value: val, isUrl: cf.type === 'link' });
    });

    const plain = [`업무명: ${task.title}`, ...entries.map(e => `${e.label}: ${e.value}`)].join('\n');

    const titleRow = `<tr>
        <td style="padding:6px 14px;border:1px solid #e0e0e0;background:#f7f7f7;font-weight:600;font-size:13px;white-space:nowrap;color:#444;">업무명</td>
        <td style="padding:6px 14px;border:1px solid #e0e0e0;font-size:13px;font-weight:600;color:#222;">${task.title}</td>
      </tr>`;
    const htmlRows = entries.map(e => {
      const valCell = e.isUrl
        ? `<a href="${e.value.startsWith('http') ? e.value : `https://${e.value}`}" style="color:#0078d4;">${e.value}</a>`
        : e.value;
      return `<tr>
        <td style="padding:6px 14px;border:1px solid #e0e0e0;background:#f7f7f7;font-weight:600;font-size:13px;white-space:nowrap;color:#444;">${e.label}</td>
        <td style="padding:6px 14px;border:1px solid #e0e0e0;font-size:13px;color:#222;">${valCell}</td>
      </tr>`;
    }).join('');
    const html = `<table style="border-collapse:collapse;font-family:sans-serif;">${titleRow}${htmlRows}</table>`;

    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })]);
    } catch {
      navigator.clipboard.writeText(plain);
    }
    setMetaCopied(true);
    setTimeout(() => setMetaCopied(false), 2000);
  };

  const totalH = (() => {
    if (task.subTaskData && Object.keys(task.subTaskData).length > 0) {
      return Object.values(task.subTaskData).reduce((sum, e) => {
        const h = e.totalHours > 0
          ? e.totalHours
          : Object.values(e.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
        return sum + h;
      }, 0);
    }
    return task.totalHours > 0
      ? task.totalHours
      : Object.values(task.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
  })();
  const sel = "bg-transparent border-none focus:outline-none cursor-pointer text-xs w-full pl-0";

  return (
    <div
      className={twoLineMode
        ? `rounded-xl border overflow-hidden bg-white mb-2 transition-all ${isActive ? 'border-[#6C63FF]/50' : 'border-black/8'} ${isDragOver ? 'border-t-2 border-t-[#6C63FF]' : ''}`
        : `border-b border-black/4 last:border-0 transition-all ${isDragOver ? 'border-t-2 border-[#6C63FF]' : ''} ${isActive ? 'border-l-2 border-l-[#6C63FF]' : ''}`
      }
      style={twoLineMode ? { minWidth: rowMinWidth } : undefined}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(); }}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
    >
      {(() => {
        const checkboxCell = (
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28 }}>
            <div
              onClick={e => { e.stopPropagation(); onSelect?.(); }}
              className={`w-[15px] h-[15px] rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                selected
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'border-gray-300 bg-white hover:border-indigo-400'
              }`}
            >
              {selected && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
        );
        const dragHandleCell = (
          <div
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
            className="flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing"
            style={{ width: 18 }}
          >
            <GripVertical size={13} />
          </div>
        );
        const actionButtonsCell = (
          <div className="flex items-center justify-end gap-2 border-l border-gray-100 pl-3 flex-shrink-0" style={{ width: 110 }}>
            {!task.plTask && (
              <button onClick={e => { e.stopPropagation(); onToggleExpand(); }}
                title="업무 정보"
                className={`flex items-center justify-center px-2 py-1 rounded-md transition-all border ${
                  expanded
                    ? 'bg-[#6C63FF]/10 text-[#6C63FF] border-[#6C63FF]/30'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-[#6C63FF]/40 hover:text-[#6C63FF]'
                }`}>
                <Info size={11} />
              </button>
            )}
            {canManage && (
              <button onClick={e => { e.stopPropagation(); onCopy(); }}
                title="복사"
                className="flex items-center justify-center px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-[#6C63FF] hover:border-[#6C63FF]/30 transition-all">
                <Copy size={11} />
              </button>
            )}
            {canDelete && (
              <button onClick={e => { e.stopPropagation(); onDeleteRequest(task.id, task.title); }}
                title="삭제"
                className="flex items-center justify-center px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-red-400 hover:border-red-200 transition-all">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        );

        const allFieldElements = tableCols.flatMap(col => {
          if (col.kind === 'custom') {
            const cf = col.cf;
            const val = (task.customFields as Record<string, string> | undefined)?.[cf.id] ?? '';
            const cfType = cf.type as string;
            const opts = (() => {
              if (cfType === 'name' || cfType === '이름') return assignees;
              const base = cf.options ?? [];
              if (!cf.dependsOn || cfType !== 'select') return base;
              const { fieldId, valueMap } = cf.dependsOn;
              const pVal = ['taskMonth','title','category','type','status','receiver','assignee','startDate','endDate'].includes(fieldId)
                ? String((task as Record<string, unknown>)[fieldId] ?? '')
                : (task.customFields?.[fieldId] ?? '');
              return (pVal && valueMap[pVal]) ? valueMap[pVal] : base;
            })();
            const isSelectable = cfType === 'select' || cfType === 'name' || cfType === '이름';
            return [
              <div key={cf.id} className="min-w-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                {cfType === 'select' && (manualCustomFields.has(cf.id) || (!!val && !opts.includes(val))) ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={manualFieldDrafts[cf.id] ?? val}
                      onChange={e => setManualFieldDrafts(prev => ({ ...prev, [cf.id]: e.target.value }))}
                      onBlur={e => {
                        onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: e.target.value } });
                        setManualFieldDrafts(prev => { const next = { ...prev }; delete next[cf.id]; return next; });
                      }}
                      placeholder="직접 입력"
                      readOnly={!canManage}
                      className="min-w-0 flex-1 text-xs text-gray-700 bg-gray-100 rounded-full px-2.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                    />
                    {canManage && (
                      <button type="button" title="목록에서 선택"
                        onClick={() => {
                          setManualCustomFields(prev => { const next = new Set(prev); next.delete(cf.id); return next; });
                          setManualFieldDrafts(prev => { const next = { ...prev }; delete next[cf.id]; return next; });
                          onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: '' } });
                        }}
                        className="flex-shrink-0 text-gray-300 hover:text-blue-400 transition-colors">
                        <ChevronDown size={12} />
                      </button>
                    )}
                  </div>
                ) : cfType === 'select' ? (() => {
                  const custColor = cf.optionColors?.[val];
                  return (
                    <div className={`relative flex items-center justify-between w-full rounded-full pl-2.5 pr-1.5 py-0.5 cursor-pointer ${custColor ? '' : 'bg-gray-100'}`}
                      style={custColor ? { backgroundColor: custColor.bg, color: custColor.text } : undefined}>
                      <span className={`text-xs font-medium truncate ${custColor ? '' : 'text-gray-600'}`}>{val || '-'}</span>
                      {canManage && <ChevronDown size={10} className={`flex-shrink-0 ${custColor ? 'opacity-70' : 'text-gray-400'}`} />}
                      {canManage && (
                        <select value={val}
                          onChange={e => {
                            if (e.target.value === CUSTOM_FIELD_MANUAL_OPTION) {
                              setManualCustomFields(prev => new Set(prev).add(cf.id));
                              onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: '' } });
                              return;
                            }
                            onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: e.target.value } });
                          }}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer">
                          <option value="">-</option>
                          {opts.map(o => <option key={o}>{o}</option>)}
                          <option value={CUSTOM_FIELD_MANUAL_OPTION}>+ 직접 입력</option>
                        </select>
                      )}
                    </div>
                  );
                })() : isSelectable ? (
                  <div className="relative">
                    <span className="text-xs text-gray-700 truncate block text-center">{val || '-'}</span>
                    {canManage && (
                      <select value={val}
                        onChange={e => onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: e.target.value } })}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer">
                        <option value="">-</option>
                        {opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    )}
                  </div>
                ) : cfType === 'link' ? (
                  val
                    ? <a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-blue-500 hover:text-blue-700 truncate block text-center">{val}</a>
                    : <span className="text-xs text-gray-400 block text-center">-</span>
                ) : cfType === 'date' ? (
                  <DatePicker compact value={val}
                    onChange={v => onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: v } })}
                    disabled={!canManage} />
                ) : (
                  <span className="text-xs text-gray-700 truncate block text-center">{val || '-'}</span>
                )}
              </div>
            ];
          }
          const fc = col.fc;
          if (fc.key === 'title') return [
            <button key="title" onClick={onOpenDetail}
              className="flex items-center gap-1.5 min-w-0 pr-2 group/title text-left w-full">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${partColor(task.category)}`} />
              <span className="text-xs font-semibold text-gray-800 truncate group-hover/title:text-blue-600 transition-colors">{task.title}</span>
            </button>,
          ];
          if (fc.key === 'category') {
            if (fc.customType === 'select' && fc.options?.length && !(parts && parts.length > 0)) {
              const custColor = fc.optionColors?.[task.category];
              return [
                <div key="category" className="relative flex items-center gap-1 min-w-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                  {custColor ? (
                    <div className="flex w-full items-center justify-between px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: custColor.bg, color: custColor.text }}>
                      <span className="truncate">{task.category || '-'}</span>
                      <ChevronDown size={10} className="flex-shrink-0 ml-1" />
                    </div>
                  ) : (
                    <div className={`flex w-full items-center justify-between pl-2.5 pr-2 py-0.5 rounded-full text-xs font-medium ${partBadgeCls(partColor(task.category))}`}>
                      <span className="truncate">{task.category || '-'}</span>
                      <ChevronDown size={10} className="flex-shrink-0 ml-1" />
                    </div>
                  )}
                  {canManage && (
                    <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={task.category}
                      onChange={e => onUpdate(task.id, { category: e.target.value })}>
                      <option value="">-</option>
                      {parts && parts.length > 0
                        ? parts.map(p => <option key={p.id}>{p.name}</option>)
                        : fc.options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              ];
            }
            return [
              <div key="category" className="relative flex items-center min-w-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                <div className={`flex w-full items-center justify-between px-2 py-0.5 rounded-full text-xs font-medium ${partBadgeCls(partColor(task.category))}`}>
                  <span className="truncate">{task.category}</span>
                  {canManage && <ChevronDown size={10} className="flex-shrink-0 ml-1" />}
                </div>
                {canManage && (
                  <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={task.category}
                    onChange={e => onUpdate(task.id, { category: e.target.value })}>
                    <option value="">-</option>
                    {parts?.map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
            ];
          }
          if (fc.key === 'type') {
            const typeOptsBase = (fc.customType === 'select' && fc.options?.length) ? fc.options : TYPES as string[];
            const typeOpts = (() => {
              if (!fc.dependsOn?.fieldId) return typeOptsBase;
              const { fieldId, valueMap } = fc.dependsOn;
              const pVal = ['taskMonth','title','category','type','status','receiver','assignee','startDate','endDate'].includes(fieldId)
                ? String((task as Record<string, unknown>)[fieldId] ?? '')
                : (task.customFields?.[fieldId] ?? '');
              return (pVal && valueMap[pVal]) ? valueMap[pVal] : typeOptsBase;
            })();
            const typeColor = fc.optionColors?.[task.type];
            if (typeColor) return [
              <div key="type" onClick={e => e.stopPropagation()}
                className="relative flex items-center justify-between w-full rounded-full pl-2.5 pr-1.5 py-0.5 cursor-pointer"
                style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                <span className="text-xs font-medium whitespace-nowrap">{task.type}</span>
                {canManage && <ChevronDown size={10} />}
                {canManage && (
                  <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={task.type} onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}>
                    {typeOpts.map(t => <option key={t}>{t}</option>)}
                  </select>
                )}
              </div>
            ];
            return [
              <div key="type" onClick={e => e.stopPropagation()}
                className="relative flex items-center justify-between w-full rounded-full pl-2.5 pr-1.5 py-0.5 cursor-pointer bg-gray-100">
                <span className="text-xs font-medium text-gray-600 whitespace-nowrap">{task.type || '-'}</span>
                {canManage && <ChevronDown size={10} className="text-gray-400 flex-shrink-0" />}
                {canManage && (
                  <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={task.type} onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}>
                    {typeOpts.map(t => <option key={t}>{t}</option>)}
                  </select>
                )}
              </div>
            ];
          }
          if (fc.key === 'status') {
            const isCustom = fc.customType === 'select' && !!fc.options?.length;
            const firstStatus = isCustom ? (fc.options![0] ?? '') : (statusConfigs[0]?.key ?? '');
            const rawStatus = (task.status as string) || firstStatus;
            // '진행 전' ↔ '진행전' 공백 차이 정규화 — 커스텀 옵션과 매핑
            const effectiveStatus = isCustom
              ? (fc.options!.find(o => o === rawStatus || o.replace(/\s/g,'') === rawStatus.replace(/\s/g,'')) ?? rawStatus)
              : rawStatus;
            const custColor = isCustom ? fc.optionColors?.[effectiveStatus] : undefined;
            const sc = statusConfigs.find(s => s.key === effectiveStatus) ?? statusConfigs[0];
            const bg = custColor?.bg ?? sc?.bg;
            const text = custColor?.text ?? sc?.text;
            return [
              <div key="status" onClick={e => e.stopPropagation()}
                className="relative flex items-center justify-between w-full rounded-full pl-2.5 pr-2 py-0.5 cursor-pointer"
                style={{ backgroundColor: bg, color: text }}>
                <span className="text-xs font-medium whitespace-nowrap">{effectiveStatus}</span>
                {canManage && <ChevronDown size={10} />}
                {canManage && (
                  <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={effectiveStatus} onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                    {isCustom
                      ? fc.options!.map(o => <option key={o}>{o}</option>)
                      : statusConfigs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)
                    }
                  </select>
                )}
              </div>
            ];
          }
          if (fc.key === 'receiver') {
            if (fc.customType === 'select' && fc.options?.length) {
              return [
                <div key="receiver" className="relative flex items-center justify-center gap-1 min-w-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-gray-700 truncate">{task.receiver || '-'}</span>
                  {canManage && <ChevronDown size={10} className="flex-shrink-0 text-gray-400" />}
                  {canManage && (
                    <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={task.receiver}
                      onChange={e => onUpdate(task.id, { receiver: e.target.value })}>
                      <option value="">-</option>
                      {fc.options.map(a => <option key={a}>{a}</option>)}
                    </select>
                  )}
                </div>
              ];
            }
            // swapReceiverAssignee: 파트 fieldOrder가 전체 탭과 반대일 때 값·키를 교환
            const rcvrKey = swapReceiverAssignee ? 'assignee' : 'receiver';
            const rcvrVal = swapReceiverAssignee ? task.assignee : task.receiver;
            const rcvrFc = taskPartFields?.find(f => f.key === rcvrKey) ?? fc;
            const rdepts = resolveFieldDepts(rcvrFc);
            const rbase = rdepts && teamMembers?.length
              ? (teamMembers.filter(m => m.department && rdepts.includes(m.department)).map(m => m.name) || assignees)
              : assignees;
            const ropts = rbase.includes(rcvrVal) ? rbase : (rcvrVal ? [rcvrVal, ...rbase] : rbase);
            return [
              <div key="receiver" className="relative flex items-center justify-center gap-1 min-w-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                <MiniAvatar name={rcvrVal} photoURL={userPhotoMap?.get(rcvrVal)} />
                <span className="text-xs text-gray-600 truncate">{rcvrVal || '-'}</span>
                {canManage && (
                  <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={rcvrVal}
                    onChange={e => onUpdate(task.id, { [rcvrKey]: e.target.value })}>
                    <option value="">-</option>
                    {ropts.map(a => <option key={a}>{a}</option>)}
                  </select>
                )}
              </div>
            ];
          }
          if (fc.key === 'assignee') {
            if (fc.customType === 'select' && fc.options?.length) {
              return [
                <div key="assignee" className="relative flex items-center justify-center gap-1 min-w-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-gray-700 truncate">{task.assignee || '-'}</span>
                  {canManage && <ChevronDown size={10} className="flex-shrink-0 text-gray-400" />}
                  {canManage && (
                    <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={task.assignee}
                      onChange={e => onUpdate(task.id, { assignee: e.target.value })}>
                      <option value="">-</option>
                      {fc.options.map(a => <option key={a}>{a}</option>)}
                    </select>
                  )}
                </div>
              ];
            }
            const asgnKey = swapReceiverAssignee ? 'receiver' : 'assignee';
            const asgnVal = swapReceiverAssignee ? task.receiver : task.assignee;
            const asgnFc = taskPartFields?.find(f => f.key === asgnKey) ?? fc;
            const adepts = resolveFieldDepts(asgnFc);
            const abase = adepts && teamMembers?.length
              ? (teamMembers.filter(m => m.department && adepts.includes(m.department)).map(m => m.name) || assignees)
              : assignees;
            const aopts = abase.includes(asgnVal) ? abase : (asgnVal ? [asgnVal, ...abase] : abase);
            return [
              <div key="assignee" className="relative flex items-center justify-center gap-1 min-w-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                <MiniAvatar name={asgnVal} photoURL={userPhotoMap?.get(asgnVal)} />
                <span className="text-xs text-gray-700 truncate">{asgnVal || '-'}</span>
                {canManage && (
                  <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={asgnVal}
                    onChange={e => onUpdate(task.id, { [asgnKey]: e.target.value })}>
                    <option value="">-</option>
                    {aopts.map(a => <option key={a}>{a}</option>)}
                  </select>
                )}
              </div>
            ];
          }
          if (fc.key === 'taskMonth') return [
            <div key="taskMonth" onClick={e => e.stopPropagation()}>
              {canManage ? (
                <select className="bg-transparent border-none focus:outline-none cursor-pointer text-xs text-gray-600 w-full text-center"
                  value={task.taskMonth ?? ''}
                  onChange={e => onUpdate(task.id, { taskMonth: e.target.value })}>
                  <option value="">-</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    const year = task.taskMonth?.slice(0, 4) ?? new Date().getFullYear().toString();
                    return <option key={i} value={`${year}-${m}`}>{i + 1}월</option>;
                  })}
                </select>
              ) : (
                <span className="text-xs text-gray-600 block text-center">
                  {task.taskMonth ? `${parseInt(task.taskMonth.slice(5))}월` : '-'}
                </span>
              )}
            </div>
          ];
          if (fc.key === 'startDate') return [
            <div key="startDate" onClick={e => e.stopPropagation()}>
              <DatePicker compact value={task.startDate ?? ''} onChange={v => onUpdate(task.id, { startDate: v })} disabled={!canManage} />
            </div>
          ];
          if (fc.key === 'endDate') return [
            <div key="endDate" onClick={e => e.stopPropagation()}>
              <DatePicker compact value={task.endDate ?? ''} onChange={v => onUpdate(task.id, { endDate: v })} disabled={!canManage} />
            </div>
          ];
          if (fc.key === 'weeklyHours') return [
            <span key="total" className="text-center text-xs font-semibold text-gray-700">{totalH > 0 ? `${totalH}h` : '-'}</span>
          ];
          return [];
        });

        const monthElement = twoLineMode ? allFieldElements.find(el => el.key === 'taskMonth') : undefined;
        const titleElements = twoLineMode ? allFieldElements.filter(el => el.key === 'title') : allFieldElements;
        const restElements = twoLineMode ? allFieldElements.filter(el => el.key !== 'taskMonth' && el.key !== 'title') : [];
        // 헤더에는 2번째 줄 필드용 공용 라벨이 없으므로, 각 값 위에 그 필드 이름을 함께 보여줌
        const line2LabelByKey = new Map<string, string>(
          line2Cols.map(col => [col.kind === 'custom' ? col.cf.id : col.fc.key, getColLabel(col)])
        );
        const restElementsWithLabels = restElements.map(el => (
          <div key={el.key} className="flex flex-col items-center gap-0.5 min-w-0">
            <span className="text-[9px] text-gray-400 leading-none truncate max-w-full">
              {el.key === 'total' ? '합계' : line2LabelByKey.get(String(el.key)) ?? ''}
            </span>
            <div className="w-full text-center">{el}</div>
          </div>
        ));

        // 체크박스/드래그/월/액션버튼은 1번째 줄(업무명)과 같은 줄에 둬서 그 줄 높이만큼만
        // 차지하게 하고, 2번째 줄은 완전히 별도 줄로 내려서 그만큼 생기는 세로 공간을
        // 2번째 줄이 자유롭게 쓰게 함. 2번째 줄 시작은 체크박스와 같은 좌측 끝에서 시작
        // (들여쓰기 없음)하고, 옅은 배경색으로 1번째 줄과 구분되게 함.
        // 1번째 줄과 2번째 줄 사이는 간격(gap) 없이 붙여서 "2번째 줄이 1번째 줄에 속한
        // 하위 영역"이라는 느낌을 주고, 업무 좌측의 세로선(spine)이 1~2번째 줄을 관통해
        // 확장된 3번째 줄(업무 정보)까지 이어지다 그 지점에서 보라색으로 짙어지게 해
        // "3번째 줄은 2번째 줄에 속한 더 깊은 영역"이라는 위계를 표현함.
        const hasLine2Bg = twoLineMode && restElements.length > 0;
        return (
          <div className={`flex flex-col ${twoLineMode ? (hasLine2Bg ? 'gap-0' : 'gap-2.5') : 'pt-3.5'} ${hasLine2Bg ? '' : 'pb-3.5'} transition-colors ${isDragging ? 'opacity-40' : ''} ${
              isActive ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'hover:bg-gray-50'
            }`}
            style={twoLineMode ? undefined : { minWidth: rowMinWidth }}>
            <div className={`flex items-center gap-3 px-3 text-sm ${twoLineMode ? `py-2.5 bg-[#6C63FF]/[0.035] ${hasLine2Bg ? 'rounded-t-xl' : 'rounded-xl'}` : ''}`}>
              <div className="flex items-center gap-3 flex-shrink-0">
                {checkboxCell}
                {dragHandleCell}
                {monthElement && (
                  <div style={{ width: monthColWidth }}>{monthElement}</div>
                )}
              </div>
              <div className="group/row flex-1 min-w-0 grid gap-x-3 items-center" style={{ gridTemplateColumns: rowFieldsTemplate1 }}>
                {titleElements}
              </div>
              {actionButtonsCell}
            </div>
            {hasLine2Bg && (
              <div className="px-3 pb-2 pt-2 text-sm">
                <div className="flex relative">
                  {/* 드래그핸들 시작 위치와 맞춤(체크박스 폭+간격만큼 들여쓰기) */}
                  <div className="flex-shrink-0" style={{ width: 28 + 12 }} />
                  {/* 스크롤바 대신 좌우 화살표 버튼으로 가로 스크롤 — 스크롤바 자체는 숨김 */}
                  <div
                    ref={line2H.ref}
                    onScroll={line2H.update}
                    className="flex-1 min-w-0 overflow-x-auto pr-6 [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    <div className="grid gap-x-3 items-start" style={{ gridTemplateColumns: rowFieldsTemplate2, minWidth: 'max-content' }}>
                      {restElementsWithLabels}
                    </div>
                  </div>
                  {/* 좌/우 버튼을 한 자리(우측 끝)에만 두고, 더 스크롤할 방향에 따라
                      화살표 방향만 바뀜 — 버튼 위치가 매번 달라지면 계속 마우스를
                      옮겨야 해서 불편하다는 피드백 반영 */}
                  {(line2H.scroll.canRight || line2H.scroll.canLeft) && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); line2H.scrollBy(line2H.scroll.canRight ? 1 : -1); }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:text-[#6C63FF] hover:border-[#6C63FF]/30 transition-colors"
                    >
                      {line2H.scroll.canRight ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {expanded && (
        <div className="bg-[#6C63FF]/[0.03] border-t border-black/5" style={{ minWidth: rowMinWidth }}>
          {(filledMeta.length > 0 || enabledCfs.length > 0) ? (
            <div className="relative">
              <button
                onClick={copyMetaFields}
                className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 bg-white border border-gray-200 hover:text-gray-700 hover:border-gray-300 shadow-sm transition-colors z-10 ${
                  (line3H.scroll.canRight || line3H.scroll.canLeft) ? 'right-10' : 'right-3'
                }`}
              >
                {metaCopied ? <><Check size={11} className="text-green-500" /><span className="text-green-500">복사됨</span></> : <><Copy size={11} /><span>복사</span></>}
              </button>
              {/* 2번째 줄과 동일하게 스크롤바 대신 좌우 토글 버튼으로 가로 스크롤 조작.
                  맨 우측에 두고 복사 버튼은 그 왼쪽에 배치 */}
              {(line3H.scroll.canRight || line3H.scroll.canLeft) && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); line3H.scrollBy(line3H.scroll.canRight ? 1 : -1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:text-[#6C63FF] hover:border-[#6C63FF]/30 transition-colors"
                >
                  {line3H.scroll.canRight ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                </button>
              )}
              <div
                ref={line3H.ref}
                onScroll={line3H.update}
                className="overflow-x-auto pr-8 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none' }}
              >
              <div className="flex divide-x divide-gray-100 min-w-max pl-8">
                {filledMeta.map(f => {
                  const val = task.customFields![f.key];
                  return (
                    <div key={f.key} className="flex flex-col px-5 py-3 shrink-0">
                      <span className="text-[10px] text-gray-400 font-medium mb-1">{f.label}</span>
                      {f.isUrl ? (
                        <div className="flex items-center gap-1">
                          <a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-blue-500 hover:text-blue-700 max-w-[200px] truncate">
                            {val}
                          </a>
                          <button onClick={() => copyUrl(f.key, val)} className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
                            {copiedUrlKey === f.key ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-800 font-medium max-w-[180px] truncate">{val}</span>
                      )}
                    </div>
                  );
                })}
                {enabledCfs.map(cf => {
                  const val = (task.customFields as Record<string, string> | undefined)?.[cf.id] ?? '';
                  const cfType = cf.type as string;
                  const opts = (() => {
                    if (cfType === 'name' || cfType === '이름') return assignees;
                    const base = cf.options ?? [];
                    if (!cf.dependsOn || cfType !== 'select') return base;
                    const { fieldId, valueMap } = cf.dependsOn;
                    const pVal = ['taskMonth','title','category','type','status','receiver','assignee','startDate','endDate'].includes(fieldId)
                      ? String((task as Record<string, unknown>)[fieldId] ?? '')
                      : (task.customFields?.[fieldId] ?? '');
                    return (pVal && valueMap[pVal]) ? valueMap[pVal] : base;
                  })();
                  const isSelectable = cfType === 'select' || cfType === 'name' || cfType === '이름';
                  return (
                    <div key={cf.id} className="flex flex-col px-5 py-3 shrink-0">
                      <span className="text-[10px] text-gray-400 font-medium mb-1">{cf.label}</span>
                      {cfType === 'select' && (manualCustomFields.has(cf.id) || (!!val && !opts.includes(val))) ? (
                        <div className="flex items-center gap-1 max-w-[180px]">
                          <input
                            value={manualFieldDrafts[cf.id] ?? val}
                            onChange={e => setManualFieldDrafts(prev => ({ ...prev, [cf.id]: e.target.value }))}
                            onBlur={e => {
                              onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: e.target.value } });
                              setManualFieldDrafts(prev => { const next = { ...prev }; delete next[cf.id]; return next; });
                            }}
                            placeholder="직접 입력"
                            readOnly={!canManage}
                            className="min-w-0 flex-1 text-xs text-gray-800 font-medium bg-black/[0.07] rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                          />
                          {canManage && (
                            <button type="button" title="목록에서 선택"
                              onClick={() => {
                                setManualCustomFields(prev => { const next = new Set(prev); next.delete(cf.id); return next; });
                                setManualFieldDrafts(prev => { const next = { ...prev }; delete next[cf.id]; return next; });
                                onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: '' } });
                              }}
                              className="flex-shrink-0 text-gray-300 hover:text-blue-400 transition-colors">
                              <ChevronDown size={12} />
                            </button>
                          )}
                        </div>
                      ) : cfType === 'select' ? (() => {
                        const custColor = cf.optionColors?.[val];
                        return (
                          <div className="relative">
                            <div className={`flex items-center justify-between max-w-[180px] px-2.5 py-1 rounded-lg text-xs font-medium ${custColor ? '' : 'bg-black/[0.07] text-gray-800'}`}
                              style={custColor ? { backgroundColor: custColor.bg, color: custColor.text } : undefined}>
                              <span className="truncate">{val || '-'}</span>
                              <ChevronDown size={11} className={`flex-shrink-0 ml-1.5 ${custColor ? 'opacity-60' : 'text-gray-400'}`} />
                            </div>
                            {canManage && (
                              <select
                                value={val}
                                onChange={e => {
                                  if (e.target.value === CUSTOM_FIELD_MANUAL_OPTION) {
                                    setManualCustomFields(prev => new Set(prev).add(cf.id));
                                    onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: '' } });
                                    return;
                                  }
                                  onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: e.target.value } });
                                }}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              >
                                <option value="">-</option>
                                {opts.map(o => <option key={o}>{o}</option>)}
                                <option value={CUSTOM_FIELD_MANUAL_OPTION}>+ 직접 입력</option>
                              </select>
                            )}
                          </div>
                        );
                      })() : isSelectable ? (
                        <div className="relative">
                          <span className="text-xs text-gray-800 font-medium max-w-[180px] truncate block pr-4">{val || '-'}</span>
                          {canManage && (
                            <select
                              value={val}
                              onChange={e => onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: e.target.value } })}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            >
                              <option value="">-</option>
                              {opts.map(o => <option key={o}>{o}</option>)}
                            </select>
                          )}
                        </div>
                      ) : cfType === 'link' ? (
                        val
                          ? <div className="flex items-center gap-1">
                              <a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:text-blue-700 max-w-[200px] truncate">{val}</a>
                              <button onClick={() => copyUrl(cf.id, val)} className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
                                {copiedUrlKey === cf.id ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                              </button>
                            </div>
                          : <span className="text-xs text-gray-400">-</span>
                      ) : cfType === 'date' ? (
                        <DatePicker compact value={val}
                          onChange={v => onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: v } })}
                          disabled={!canManage} />
                      ) : (
                        <span className="text-xs text-gray-800 font-medium max-w-[180px] truncate">{val || '-'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          ) : (
            <div className="px-8 py-3">
              <span className="text-xs text-gray-400">업무 정보 없음</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubTaskRow({ sub, onDelete, tableFields, tableCfsCount = 0, colTemplate, userPhotoMap, partColor }: {
  sub: SubTask; onDelete: () => void;
  tableFields: BuiltinFieldConfig[];
  tableCfsCount?: number;
  colTemplate: string;
  userPhotoMap?: Map<string, string>;
  partColor: (cat: string) => string;
}) {
  const totalH = Object.values(sub.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
  const SUB_STATUS: Record<string, string> = {
    '진행 전': 'text-blue-600 bg-blue-100',
    '진행 중': 'text-amber-600 bg-amber-100',
    '완료': 'text-green-600 bg-green-100',
    '보류': 'text-slate-600 bg-slate-200',
  };
  return (
    <div className="grid gap-x-3 items-center pl-6 pr-3 py-2 border-b border-black/3 last:border-0 min-w-max"
      style={{ gridTemplateColumns: colTemplate }}>
      {/* 체크박스·드래그핸들 열 자리 채우기 */}
      <span /><span />
      {tableFields.flatMap(fc => {
        if (fc.key === 'title') return [
          <span key="title" className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="text-gray-300 text-[10px] mr-0.5">└</span>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${partColor(sub.category)}`} />
            <span className="text-xs text-gray-700 truncate">{sub.title}</span>
          </span>
        ];
        if (fc.key === 'category')  return [
          <span key="category" className="text-xs truncate">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${partColor(sub.category)}`} />
              <span className="text-gray-500 truncate">{sub.category}</span>
            </span>
          </span>
        ];
        if (fc.key === 'type')      return [<span key="type" className="text-xs text-gray-400">{sub.type}</span>];
        if (fc.key === 'status')    return [<span key="status" className={`text-xs font-medium px-1.5 py-0.5 rounded-full w-fit whitespace-nowrap ${SUB_STATUS[sub.status]}`}>{sub.status}</span>];
        if (fc.key === 'receiver')  return [<span key="receiver" className="flex items-center gap-px"><MiniAvatar name={sub.receiver} photoURL={userPhotoMap?.get(sub.receiver)} /><span className="text-xs text-gray-400 truncate">{sub.receiver}</span></span>];
        if (fc.key === 'assignee')  return [<span key="assignee" className="flex items-center gap-px"><MiniAvatar name={sub.assignee} photoURL={userPhotoMap?.get(sub.assignee)} /><span className="text-xs text-gray-600 truncate">{sub.assignee}</span></span>];
        if (fc.key === 'startDate') return [<span key="startDate" className="text-xs text-gray-400">{sub.startDate?.slice(5).replace('-', '.') ?? '-'}</span>];
        if (fc.key === 'endDate')   return [<span key="endDate" className="text-xs text-gray-400">{sub.endDate?.slice(5).replace('-', '.') ?? '-'}</span>];
        if (fc.key === 'weeklyHours') return [
          ...[1,2,3,4,5].map(w => {
            const h = sub.weeklyHours?.[`week${w}`] ?? 0;
            return (
              <div key={`w${w}`} className="flex justify-center">
                {h > 0
                  ? <span className="text-xs text-green-500">{h}h</span>
                  : <span className="text-xs text-gray-400">-</span>}
              </div>
            );
          }),
          <span key="total" className="text-center text-xs text-gray-500">{totalH > 0 ? `${totalH}h` : '-'}</span>
        ];
        return [];
      })}
      {Array.from({ length: tableCfsCount }).map((_, i) => <span key={`cf-${i}`} />)}
      <span />
      <button onClick={onDelete} className="flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors">
        <Trash2 size={11} />
      </button>
    </div>
  );
}
