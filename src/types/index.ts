export type UserRole = 'superadmin' | 'manager' | 'user';
export type Department = '기획' | '디자인' | '퍼블';
export const DEPARTMENTS: Department[] = ['기획', '디자인', '퍼블'];

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  department?: Department;
  selectedTeamIds?: string[];
  defaultTeamId?: string;
  annualLeave?: number; // 개인 연간 휴가 일수 (미설정 시 기본값 15)
  createdAt: string;
}

export interface UserPermissions {
  canManageTasks: boolean;   // 업무 등록/수정/삭제
  canManageUsers: boolean;   // 사용자 권한 관리 (최고관리자만)
  canInputTime: boolean;     // 세부업무 시간/날짜 입력
  canAddVacation: boolean;   // 휴가 등록
}

export function getPermissions(role: UserRole): UserPermissions {
  return {
    canManageTasks: true,
    canManageUsers: role === 'superadmin',
    canInputTime: true,
    canAddVacation: true,
  };
}

export type TaskStatus = '진행 전' | '진행 중' | '완료' | '보류';
export type TaskCategory = string;
export type TaskType = '신규' | '기타' | '파생' | '기획';

export const DEFAULT_CATEGORIES = ['라이브', '복지', '사업자', '기타'];

export interface TeamPart {
  id: string;
  name: string;
  color: string; // tailwind bg class e.g. 'bg-red-500'
  formConfig?: TeamFormConfig; // 파트별 별도 폼 설정 (없으면 팀 기본 상속)
  metaFields?: MetaField[]; // 파트별 업무 정보 필드 (없으면 팀 기본 상속)
  subTaskTypes?: SubTaskType[]; // 파트별 세부 업무 목록 (없으면 팀 기본 상속)
  excelConfig?: ExcelFieldConfig[]; // 파트별 엑셀 필드 설정 (없으면 팀 기본 상속)
}

// ── 폼 빌더 ──────────────────────────────────────
export type FormFieldType = 'text' | 'select' | 'date' | 'number' | 'name' | 'link' | 'textarea';

export interface CustomFormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  enabled?: boolean; // undefined = true (하위 호환)
  options?: string[]; // select 타입일 때 선택지
  optionColors?: Record<string, { bg: string; text: string }>; // 옵션별 뱃지 색상
  department?: Department; // name 타입: 해당 직군 사람만 표시 (구버전 호환)
  departments?: Department[]; // 복수 직군 선택 (신버전)
}

export type BuiltinFieldKey =
  | 'taskMonth' | 'title' | 'status' | 'category' | 'type'
  | 'receiver' | 'assignee'
  | 'startDate' | 'endDate'
  | 'revisionLevel' | 'weeklyHours';

export interface BuiltinFieldConfig {
  key: BuiltinFieldKey;
  enabled: boolean;
  width: number; // 0 = 1fr (title), weeklyHours는 주당 너비
  customLabel?: string; // 사용자 정의 표시 이름
  customType?: FormFieldType; // 폼 렌더링 속성 오버라이드
  required?: boolean; // 새업무 등록 폼에서 필수 입력 여부
  department?: Department; // 이름 타입: 해당 직군 사람만 표시 (구버전 호환)
  departments?: Department[]; // 복수 직군 선택 (신버전)
  options?: string[]; // select 타입: 선택지
  optionColors?: Record<string, { bg: string; text: string }>; // 옵션별 뱃지 색상
}

export const BUILTIN_FIELDS_META: { key: BuiltinFieldKey; label: string }[] = [
  { key: 'taskMonth',     label: '월' },
  { key: 'title',         label: '업무명' },
  { key: 'status',        label: '상태' },
  { key: 'category',      label: '파트/구분' },
  { key: 'type',          label: '유형' },
  { key: 'receiver',      label: '접수자' },
  { key: 'assignee',      label: '담당자' },
  { key: 'startDate',     label: '시작일' },
  { key: 'endDate',       label: '종료일' },
  { key: 'weeklyHours',   label: '주차별 시간' },
  { key: 'revisionLevel', label: '수정단계' },
];

// 테이블 컬럼이 있는 필드 (revisionLevel 제외)
export const TABLE_FIELD_KEYS: BuiltinFieldKey[] = [
  'taskMonth', 'title', 'category', 'type', 'status', 'receiver', 'assignee', 'startDate', 'endDate', 'weeklyHours',
];

export const DEFAULT_ENABLED_BUILTINS: BuiltinFieldKey[] = [
  'taskMonth', 'title', 'status', 'category', 'type', 'receiver', 'assignee', 'startDate', 'endDate', 'weeklyHours',
];

export const DEFAULT_BUILTIN_FIELD_CONFIGS: BuiltinFieldConfig[] = [
  { key: 'taskMonth',     enabled: true,  width: 52 },
  { key: 'title',         enabled: true,  width: 0 },
  { key: 'type',          enabled: true,  width: 68 },
  { key: 'status',        enabled: true,  width: 90 },
  { key: 'category',      enabled: true,  width: 72 },
  { key: 'receiver',      enabled: true,  width: 90 },
  { key: 'assignee',      enabled: true,  width: 90 },
  { key: 'startDate',     enabled: true,  width: 72 },
  { key: 'endDate',       enabled: true,  width: 72 },
  { key: 'weeklyHours',   enabled: true,  width: 46 },
  { key: 'revisionLevel', enabled: false, width: 90 },
];

export interface StatusConfig {
  key: TaskStatus;
  label: string;
  bg: string;   // hex background
  text: string; // hex text color
}

export const STATUS_COLOR_PRESETS: { bg: string; text: string; label: string }[] = [
  { label: '파랑',  bg: '#dbeafe', text: '#2563eb' },
  { label: '하늘',  bg: '#e0f2fe', text: '#0284c7' },
  { label: '초록',  bg: '#dcfce7', text: '#16a34a' },
  { label: '청록',  bg: '#ccfbf1', text: '#0d9488' },
  { label: '노랑',  bg: '#fef9c3', text: '#a16207' },
  { label: '주황',  bg: '#ffedd5', text: '#ea580c' },
  { label: '빨강',  bg: '#fee2e2', text: '#dc2626' },
  { label: '분홍',  bg: '#fce7f3', text: '#db2777' },
  { label: '보라',  bg: '#f3e8ff', text: '#7c3aed' },
  { label: '회색',  bg: '#e2e8f0', text: '#475569' },
];

export const DEFAULT_STATUS_CONFIGS: StatusConfig[] = [
  { key: '진행 전', label: '진행 전', bg: '#dbeafe', text: '#2563eb' },
  { key: '진행 중', label: '진행 중', bg: '#fef3c7', text: '#d97706' },
  { key: '완료',   label: '완료',   bg: '#dcfce7', text: '#16a34a' },
  { key: '보류',   label: '보류',   bg: '#e2e8f0', text: '#475569' },
];

export interface TeamFormConfig {
  builtinFields?: BuiltinFieldConfig[]; // 새 포맷 (순서 + 너비 포함)
  enabledBuiltins?: BuiltinFieldKey[];  // 구버전 호환용
  customFields: CustomFormField[];
  statusConfigs?: StatusConfig[];
  fieldOrder?: string[]; // 기본+커스텀 통합 순서 (builtin key 또는 custom field id)
}

export function resolveStatusConfigs(config?: TeamFormConfig): StatusConfig[] {
  if (!config?.statusConfigs?.length) return DEFAULT_STATUS_CONFIGS;
  return DEFAULT_STATUS_CONFIGS.map(d => config.statusConfigs!.find(s => s.key === d.key) ?? d);
}

export function resolveBuiltinFields(config?: TeamFormConfig): BuiltinFieldConfig[] {
  let fields: BuiltinFieldConfig[];
  if (!config) {
    fields = DEFAULT_BUILTIN_FIELD_CONFIGS.map(f => ({ ...f }));
  } else if (config.builtinFields?.length) {
    fields = [...config.builtinFields];
    if (!fields.some(f => f.key === 'title')) {
      fields.unshift({ key: 'title', enabled: true, width: 0 });
    }
  } else {
    const legacy = config.enabledBuiltins ?? DEFAULT_ENABLED_BUILTINS;
    fields = DEFAULT_BUILTIN_FIELD_CONFIGS.map(f => ({ ...f, enabled: legacy.includes(f.key) }));
  }
  // taskMonth는 항상 맨 앞 고정 (없으면 추가)
  const monthIdx = fields.findIndex(f => f.key === 'taskMonth');
  if (monthIdx === -1) {
    fields.unshift({ key: 'taskMonth', enabled: true, width: 52 });
  } else if (monthIdx > 0) {
    const [m] = fields.splice(monthIdx, 1);
    fields.unshift(m);
  }
  return fields;
}

/** 필드 설정에서 직군 목록을 반환. 구버전 department 단일값도 처리. */
export function resolveFieldDepts(fc: { department?: Department; departments?: Department[] }): Department[] | null {
  if (fc.departments?.length) return fc.departments;
  if (fc.department) return [fc.department];
  return null;
}

export interface MetaField {
  key: string;
  label: string;
  isUrl?: boolean;
}

export interface SubTaskMemo {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface SubTaskType {
  id: string;
  name: string;
  department?: Department;
  showInCalendar?: boolean; // undefined = true (기본 표시)
  calendarColor?: string;   // undefined = 기본색
}

export const DEFAULT_META_FIELDS: MetaField[] = [
  { key: '제품군',              label: '제품군' },
  { key: '컨셉',                label: '컨셉' },
  { key: '셋팅',                label: '셋팅' },
  { key: '기획전명',            label: '기획전명' },
  { key: 'KV모델',              label: 'KV모델' },
  { key: '히든기획전_url_main', label: '히든기획전 URL 메인', isUrl: true },
  { key: '히든기획전_url_2',   label: '히든기획전 URL 2',    isUrl: true },
  { key: '방송안내_url',        label: '방송안내 URL',         isUrl: true },
  { key: '피그마_url',          label: '피그마 URL',           isUrl: true },
];

export interface CustomHoliday {
  id: string;
  date: string;   // YYYY-MM-DD
  name: string;
  createdAt: string;
}

export interface SeatGroup {
  id: string;
  name: string;
  color: string;     // hex e.g. '#3b82f6'
  teamId: string;
  cols: number;
  rows: number;
  seats: Record<string, string>; // "r-c" → displayName
  order: number;
  createdAt: string;
}

export interface ExcelFieldConfig {
  key: string;       // builtin key 또는 metaField key
  label: string;     // 컬럼 헤더
  enabled: boolean;
  order: number;
  exportExcluded?: boolean; // true면 내보내기에서 제외 (가져오기는 유지)
}

export interface Team {
  id: string;
  name: string;
  emoji: string;
  color?: string; // hex e.g. '#3b82f6'
  parts: TeamPart[];
  createdAt: string;
  formConfig?: TeamFormConfig;
  metaFields?: MetaField[];
  subTaskTypes?: SubTaskType[];
  holidays?: CustomHoliday[];
  excelConfig?: ExcelFieldConfig[];
}

export interface SubTask {
  id: string;
  taskId: string;
  projectId: string;
  title: string;
  category: TaskCategory;
  type: TaskType;
  status: TaskStatus;
  receiver: string;  // 접수자
  assignee: string;  // 담당자
  startDate: string;
  endDate: string;
  weeklyHours: Record<string, number>; // week1~week5
  totalHours: number;
  revisionLevel: number; // 0~6 (F1~F6)
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  teamId?: string;
  sortOrder?: number;
  taskMonth?: string; // "YYYY-MM"
  title: string;
  category: TaskCategory;
  type: TaskType;
  status: TaskStatus;
  receiver: string;
  assignee: string;
  startDate: string;
  endDate: string;
  weeklyHours: Record<string, number>;
  totalHours: number;
  revisionLevel: number; // deprecated — 하위 호환용
  revisionCounts?: Record<string, number>; // 'F1'~'F6' → 횟수
  customFields?: Record<string, string>;
  subTaskData?: Record<string, {
    status?: TaskStatus;
    assignee?: string;
    startDate?: string;
    endDate?: string;
    weeklyHours: Record<string, number>; // w1d1~w5d5 (week×day)
    totalHours: number;
    memos?: SubTaskMemo[];
  }>;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  categories: TaskCategory[];
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  seatId: string;
  area: 'F' | 'K' | 'L';
  color: 'blue' | 'purple' | 'green' | 'yellow' | 'pink';
  weeklyTarget: number; // default 40
  createdAt: string;
}

export type VacationType = '연차' | '오전반반차' | '오전반차' | '오후반반차' | '오후반차';

export interface Vacation {
  id: string;
  memberId: string;
  memberName: string;
  date: string; // YYYY-MM-DD (연차 다일 경우 시작일)
  type: VacationType;
  days: number;
  createdAt: string;
}
