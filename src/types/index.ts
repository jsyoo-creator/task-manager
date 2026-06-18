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
  selectedTeamId?: string;
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
    canManageTasks: role === 'superadmin' || role === 'manager',
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
}

// ── 폼 빌더 ──────────────────────────────────────
export type FormFieldType = 'text' | 'select' | 'date' | 'number' | 'name' | 'link' | 'textarea';

export interface CustomFormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[]; // select 타입일 때 선택지
}

export type BuiltinFieldKey =
  | 'title' | 'status' | 'category' | 'type'
  | 'receiver' | 'assignee'
  | 'startDate' | 'endDate'
  | 'revisionLevel' | 'weeklyHours';

export interface BuiltinFieldConfig {
  key: BuiltinFieldKey;
  enabled: boolean;
  width: number; // 0 = 1fr (title), weeklyHours는 주당 너비
  customLabel?: string; // 사용자 정의 표시 이름
  customType?: FormFieldType; // 폼 렌더링 속성 오버라이드
}

export const BUILTIN_FIELDS_META: { key: BuiltinFieldKey; label: string }[] = [
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
  'title', 'category', 'type', 'status', 'receiver', 'assignee', 'startDate', 'endDate', 'weeklyHours',
];

export const DEFAULT_ENABLED_BUILTINS: BuiltinFieldKey[] = [
  'title', 'status', 'category', 'type', 'receiver', 'assignee', 'startDate', 'endDate', 'weeklyHours',
];

export const DEFAULT_BUILTIN_FIELD_CONFIGS: BuiltinFieldConfig[] = [
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

export interface TeamFormConfig {
  builtinFields?: BuiltinFieldConfig[]; // 새 포맷 (순서 + 너비 포함)
  enabledBuiltins?: BuiltinFieldKey[];  // 구버전 호환용
  customFields: CustomFormField[];
}

export function resolveBuiltinFields(config?: TeamFormConfig): BuiltinFieldConfig[] {
  if (!config) return DEFAULT_BUILTIN_FIELD_CONFIGS.map(f => ({ ...f }));
  if (config.builtinFields?.length) {
    // 구버전 데이터에 title이 없으면 맨 앞에 추가
    const hasTitle = config.builtinFields.some(f => f.key === 'title');
    if (!hasTitle) {
      return [{ key: 'title', enabled: true, width: 0 }, ...config.builtinFields];
    }
    return config.builtinFields;
  }
  // 구버전 enabledBuiltins → 마이그레이션
  const legacy = config.enabledBuiltins ?? DEFAULT_ENABLED_BUILTINS;
  return DEFAULT_BUILTIN_FIELD_CONFIGS.map(f => ({ ...f, enabled: legacy.includes(f.key) }));
}

export interface Team {
  id: string;
  name: string;
  emoji: string;
  parts: TeamPart[];
  createdAt: string;
  formConfig?: TeamFormConfig;
}

export interface SubTask {
  id: string;
  taskId: string;
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
  revisionLevel: number;
  customFields?: Record<string, string>;
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

export interface Vacation {
  id: string;
  memberId: string;
  memberName: string;
  date: string; // YYYY-MM-DD
  type: '연차' | '반차' | '오반반차' | '공온반차';
  days: number; // 1 or 0.5
  createdAt: string;
}
