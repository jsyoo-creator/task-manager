export type UserRole = 'superadmin' | 'manager' | 'user';
export type Department = '기획' | '디자인' | '퍼블';
export const DEPARTMENTS: Department[] = ['기획', '디자인', '퍼블'];

export interface ProfileFieldDef {
  id: string;
  label: string;
  required: boolean;
  order: number;
  fieldType: 'text' | 'select' | 'text+select' | 'date';
  options?: string[];
  textFirst?: boolean; // text+select일 때 텍스트가 앞(true, 기본) vs 드롭다운이 앞(false)
  showInAccountInfo?: boolean; // 계정 정보 페이지 노출 여부 (undefined = true)
  ddayAlert?: { days: number; message: string }; // date 타입: N일 전부터 알림
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  department?: Department;
  selectedTeamIds?: string[];
  /** @deprecated defaultTeamIdByWorkplace 사용 — 근무지 구분 없는 단일 값이라 다중 근무지에서 근무지별로 다른 기본 팀을 표현할 수 없음 */
  defaultTeamId?: string;
  defaultTeamIdByWorkplace?: Record<string, string>; // 근무지 id → 그 근무지에서의 기본(접속 시 자동 선택) 팀 id
  annualLeave?: number;
  profileData?: Record<string, string>;
  createdAt: string;
  /** @deprecated workplaceIds 사용 — 과거 단일 배정 데이터 마이그레이션 용도로만 참조 */
  workplaceId?: string;
  workplaceIds?: string[]; // 배정된 근무지 목록(다중 배정 가능, 비어있으면 미배정 — 어드민이 배정할 때까지 대기)
  defaultWorkplaceId?: string; // 근무지가 여러 개일 때 로그인 시 자동으로 선택될 기본 근무지(없으면 매번 선택 화면 표시)
  isPlatformAdmin?: boolean; // PIVOT 본사 관리자 — 모든 근무지를 관리하는 최상위 권한, role과 별개
}

export interface Workplace {
  id: string;
  name: string;    // 예: 'LG전자 공덕TF'
  createdAt: string;
  menuConfig?: Record<string, boolean>; // 메뉴 id → 노출 여부 (없으면 기본 true)
}

// 근무지별로 켜고 끌 수 있는 메뉴 목록 (대시보드·설정은 항상 노출되므로 제외).
// id는 Firestore 맵 키로 쓰이므로 '/' 등 특수문자가 들어간 실제 경로(path)를 그대로 쓰지 않는다
// (Firestore 필드 이름에는 '/'를 쓸 수 없어 dot-notation 업데이트가 조용히 실패함).
export interface MenuItemMeta { id: string; path: string; label: string; }
export const TOGGLEABLE_MENU_ITEMS: MenuItemMeta[] = [
  { id: 'tasks',    path: '/tasks',    label: '업무 관리' },
  { id: 'calendar', path: '/calendar', label: '캘린더' },
  { id: 'weekly',   path: '/weekly',   label: '위클리' },
  { id: 'vacation', path: '/vacation', label: '휴가' },
  { id: 'board',    path: '/board',    label: '커뮤니티' },
  { id: 'accounts', path: '/accounts', label: '계정 정보' },
  { id: 'seats',    path: '/seats',    label: '자리 배치도' },
  { id: 'trash',    path: '/trash',    label: '휴지통' },
];

export function isMenuEnabled(menuId: string, menuConfig?: Record<string, boolean>): boolean {
  return menuConfig?.[menuId] !== false;
}

export interface UserPermissions {
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canManageUsers: boolean;          // 사용자 권한 변경 (최고관리자 전용)
  canInputTime: boolean;
  canAddVacation: boolean;
  canManageTeams: boolean;          // 팀/파트 생성·관리
  canManageMembers: boolean;        // 구성원 정보 수정·삭제
  canManageHolidays: boolean;       // 휴일 관리
  canManageProfileFields: boolean;  // 프로필 필드 관리
  canViewAccounts: boolean;         // 계정정보 페이지 접근
  canEditSeatMap: boolean;          // 자리 배치도 편집
  canSetNotice: boolean;            // 게시판 공지 설정
  canManageBoard: boolean;          // 게시판 타인 글/댓글 관리
  canManageAiTools: boolean;        // AI 툴 리스트 추가·수정·삭제
  canViewAllCalendarWeekly: boolean; // 캘린더/위클리에서 타인 업무 조회 (false면 본인 것만)
}

export interface RolePermissionConfig {
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canInputTime: boolean;
  canAddVacation: boolean;
  canManageTeams: boolean;
  canManageMembers: boolean;
  canManageHolidays: boolean;
  canManageProfileFields: boolean;
  canViewAccounts: boolean;
  canEditSeatMap: boolean;
  canSetNotice: boolean;
  canManageBoard: boolean;
  canManageAiTools: boolean;
  canViewAllCalendarWeekly: boolean;
}

export interface RolePermissions {
  manager: RolePermissionConfig;
  user: RolePermissionConfig;
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  manager: {
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canInputTime: true,
    canAddVacation: true,
    canManageTeams: true,
    canManageMembers: true,
    canManageHolidays: true,
    canManageProfileFields: true,
    canViewAccounts: true,
    canEditSeatMap: true,
    canSetNotice: true,
    canManageBoard: true,
    canManageAiTools: true,
    canViewAllCalendarWeekly: true,
  },
  user: {
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: false,
    canInputTime: true,
    canAddVacation: true,
    canManageTeams: false,
    canManageMembers: false,
    canManageHolidays: false,
    canManageProfileFields: false,
    canViewAccounts: false,
    canEditSeatMap: false,
    canSetNotice: false,
    canManageBoard: false,
    canManageAiTools: false,
    canViewAllCalendarWeekly: false,
  },
};

// 근무지마다 역할 명칭을 다르게 부를 수 있음(예: manager를 "PM" 또는 "팀장"으로) — 근무지별 커스텀 라벨
export type RoleLabels = Partial<Record<UserRole, string>>;

export const DEFAULT_ROLE_LABELS: Record<UserRole, string> = {
  superadmin: '최고 관리자',
  manager: '중간 관리자',
  user: '일반 사용자',
};

export function resolveRoleLabel(role: UserRole, roleLabels?: RoleLabels): string {
  return roleLabels?.[role]?.trim() || DEFAULT_ROLE_LABELS[role];
}

export function getPermissions(role: UserRole, rolePerms: RolePermissions = DEFAULT_ROLE_PERMISSIONS): UserPermissions {
  if (role === 'superadmin') {
    return {
      canCreateTasks: true,
      canEditTasks: true,
      canDeleteTasks: true,
      canManageUsers: true,
      canInputTime: true,
      canAddVacation: true,
      canManageTeams: true,
      canManageMembers: true,
      canManageHolidays: true,
      canManageProfileFields: true,
      canViewAccounts: true,
      canEditSeatMap: true,
      canSetNotice: true,
      canManageBoard: true,
      canManageAiTools: true,
      canViewAllCalendarWeekly: true,
    };
  }
  const cfg = rolePerms[role] ?? DEFAULT_ROLE_PERMISSIONS[role];
  return { ...cfg, canManageUsers: false };
}

export type TaskStatus = '진행 전' | '진행 중' | '완료' | '보류';
export type TaskCategory = string;
export type TaskType = '신규' | '기타' | '파생' | '기획';

export const DEFAULT_CATEGORIES = ['라이브', '복지', '사업자', '기타'];

export interface RevisionStep {
  id: string;    // Task.revisionCounts의 키와 매칭되는 고정 식별자 (예: 'F1'). 생성 이후 변경되지 않음
  code: string;  // 화면에 표시되는 짧은 뱃지 텍스트 (예: 'F1'), 자유롭게 수정 가능
  label: string; // 화면에 표시되는 설명 텍스트 (수정 가능)
}

export const DEFAULT_REVISION_STEPS: RevisionStep[] = [
  { id: 'F1', code: 'F1', label: 'KV 크리에이티브 변경' },
  { id: 'F2', code: 'F2', label: '상세페이지 레이아웃 변동, 신규 상에 추가' },
  { id: 'F3', code: 'F3', label: '특정 영역 내용·이미지 수정' },
  { id: 'F4', code: 'F4', label: 'API 제품 교재 20개 이상' },
  { id: 'F5', code: 'F5', label: 'API 제품 교재 20개 미만' },
  { id: 'F6', code: 'F6', label: '단순 텍스트·CMS 수정' },
];

/** code 필드 도입 이전에 저장된 데이터 호환용 — code가 없으면 id로 채움 */
export function normalizeRevisionSteps(steps: RevisionStep[]): RevisionStep[] {
  return steps.map(s => (s.code ? s : { ...s, code: s.id }));
}

/** 파트 → 팀 → 기본값 순으로 수정단계 목록을 해석 */
export function resolveRevisionSteps(part?: { revisionSteps?: RevisionStep[] }, team?: { revisionSteps?: RevisionStep[] }): RevisionStep[] {
  return normalizeRevisionSteps(part?.revisionSteps ?? team?.revisionSteps ?? DEFAULT_REVISION_STEPS);
}

export interface TeamPart {
  id: string;
  name: string;
  color: string; // tailwind bg class e.g. 'bg-red-500'
  departments?: Department[]; // 파트에 연결된 직군 — 담당자/접수자 드롭다운 필터링용
  formConfig?: TeamFormConfig; // 파트별 별도 폼 설정 (없으면 팀 기본 상속)
  metaFields?: MetaField[]; // 파트별 업무 정보 필드 (없으면 팀 기본 상속)
  subTaskTypes?: SubTaskType[]; // 파트별 세부 업무 목록 (없으면 팀 기본 상속)
  excelConfig?: ExcelFieldConfig[]; // 파트별 엑셀 필드 설정 (없으면 팀 기본 상속)
  weeklyExportConfig?: WeeklyExportConfig; // 파트별 위클리 컬럼 설정 (없으면 팀 기본 상속)
  calendarOrder?: string[]; // 캘린더 전용 세부업무 정렬 순서 (SubTaskType.id 목록, 업무상세 순서와 별개, 없으면 팀 기본 상속)
  plShowInCalendar?: boolean; // PL업무를 캘린더에 표시할지 (없으면 팀 기본 상속)
  mainTaskEndDateShow?: boolean; // 메인업무 종료일을 캘린더에 표시할지 (없으면 팀 기본 상속)
  mainTaskEndDateLabel?: string; // 메인업무 종료일 캘린더 표시 명칭 (예: '방송일', 없으면 팀 기본 상속)
  mainTaskEndDateColor?: string; // 메인업무 종료일 배지 색상 (hex, 없으면 팀 기본 상속, 빈 값이면 파트색 자동 사용)
  revisionSteps?: RevisionStep[]; // 파트별 수정단계 목록 (없으면 팀 기본 상속)
  copyIncludeDetails?: boolean; // 업무 복사 시 세부업무/커스텀필드 등 세부사항까지 포함할지 (없으면 팀 기본 상속)
  taskListTwoLine?: boolean; // 업무관리 목록 2줄 구성 사용 여부 (없으면 팀 기본 상속)
  mailFormConfig?: MailFormPreset[]; // 파트별 메일 양식 탭 목록 (받는사람/참조 조합이 서로 다른 여러 프리셋, 없으면 미설정)
}

// 메일 양식 표에 추가로 넣는 항목 — 기본 8개 항목에 없는 값을 표시.
// sourceKey가 있으면 팀의 업무 정보 필드(metaFields)/커스텀 필드 또는(source가 'subtask'면)
// 세부 업무의 날짜 값을 그대로 가져오고, sourceKey가 없으면(사용자 입력 항목) 값이 미리
// 채워지지 않고 메일 작성할 때마다 직접 입력한다.
// type에 따라 값 서식(날짜는 YYYY-MM-DD, url은 하이퍼링크)이 다르게 적용됨
export interface MailTableCustomField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'url';
  sourceKey?: string; // source가 'field'(기본)면 task.customFields[sourceKey] 참조.
                       // source가 'subtask'면 "세부업무타입id:startDate|endDate" 형식으로
                       // task.subTaskData[세부업무타입id][startDate|endDate] 참조. 없으면 사용자 입력 항목
  source?: 'field' | 'subtask'; // 없으면 'field' (하위 호환)
  linkText?: string; // type이 'url'일 때, 실제 값(URL) 대신 하이퍼링크에 표시할 고정 텍스트 (없으면 URL 그대로 표시)
}

// 표 밖 본문에 추가하는 텍스트/날짜 입력 항목 — sourceKey가 없으면(레거시 기본) 표의
// 사용자 입력 항목과 마찬가지로 값이 미리 채워지지 않고, 업무 상세의 메일 양식에서
// 메일 작성할 때마다 직접 입력한다. source/sourceKey가 있으면 표의 커스텀 항목처럼
// 실제 업무 정보(필드) 또는 세부 업무 시작일/종료일에서 값을 자동으로 가져온다
export interface MailBodyCustomField {
  id: string;
  title: string;
  type: 'text' | 'date' | 'url';
  source?: 'field' | 'subtask';
  sourceKey?: string; // source==='field'면 customFields의 key, source==='subtask'면 'subTaskTypeId:startDate|endDate'
  linkText?: string; // type이 'url'일 때, 실제 값(URL) 대신 하이퍼링크에 표시할 고정 텍스트 (없으면 URL 그대로 표시)
  hideTitle?: boolean; // true면 값 위에 표시되는 "[제목]" 줄을 감추고 값만 표시 (없으면 false = 표시)
}

// 번호 목록 항목 하나 — "N. 항목명" 다음 줄에 값이 오는 형태. sourceKey가 있으면 필드
// 값을 그대로 가져오고, 없으면(사용자 입력) 메일 작성할 때마다 직접 입력한다
export interface MailListItem {
  id: string;
  label: string;
  type: 'text' | 'date' | 'url';
  source?: 'field' | 'subtask'; // 없으면 'field' (하위 호환)
  sourceKey?: string;
  numberLabel?: string; // 없으면 "N."(순번) 자동 표시, 있으면 이 텍스트로 대체 (예: "A안")
  linkText?: string; // type이 'url'일 때, 실제 값(URL) 대신 하이퍼링크에 표시할 고정 텍스트 (없으면 URL 그대로 표시)
}

// 표와 별개로, "[제목]" 아래 번호가 매겨진 항목들을 나열하는 목록 —
// 예: [SNS 공유 이미지] / 1. 방송 안내 페이지 (값) / 2. 방송 페이지 (값)
export interface MailListGroup {
  id: string;
  title?: string; // "[제목]" 형태(볼드)로 표시할 제목 (없으면 표시 안 함)
  items: MailListItem[];
}

// 여러 "행"을 나열하는 표(No. | 라이브 일자 | 요일 | 시간 | 제품 | URL 생성 처럼)의 컬럼 하나.
// 값은 업무 데이터에서 가져오지 않고 메일 작성할 때마다 행을 추가해가며 직접 입력한다
export interface MailGridColumn {
  id: string;
  label: string; // 헤더에 표시할 컬럼명
  type: 'text' | 'date' | 'checkbox' | 'time' | 'select'; // checkbox는 셀에 O/- 토글, time은 24시간 기준 시:분, select는 등록해둔 옵션 중 드롭다운으로 선택
  showWeekday?: boolean; // type이 'date'일 때, 바로 뒤에 자동 계산된 "요일" 컬럼을 추가로 보여줌
  options?: string[]; // type이 'select'일 때 드롭다운에 보여줄 선택지 목록
}

// 여러 행을 가로 표로 나열하는 표 하나("메인 표"와 달리 업무 하나가 아니라, 메일 작성할
// 때마다 필요한 만큼 행을 추가/삭제하는 미니 스프레드시트 형태)
export interface MailGridTableConfig {
  id: string;
  title?: string; // 표 위에 "[제목]" 형태(볼드)로 표시할 제목 (없으면 표시 안 함)
  columns: MailGridColumn[];
  showNumberColumn?: boolean; // 맨 앞에 "No." 자동 순번 컬럼을 보여줄지 (없으면 true = 표시)
}

// 본문 인사말 다음 줄(업무명 다음, 안내 문구 앞)에 끼워 넣는 입력 항목 — 메일 작성할
// 때마다 값을 직접 입력한다. type이 'count'면 값 뒤에 자동으로 "건"이 붙음
export interface MailMessageInsert {
  id: string;
  type: 'text' | 'date' | 'count' | 'select';
  label?: string; // 작성 화면에서 입력창에 보여줄 안내 텍스트(플레이스홀더). type이 'select'면
                   // 체크박스 옆 이름이자, 체크했을 때 그대로 삽입되는 문구
  // type이 'date'일 때 "M월 D일 요일" 중 어느 것을 조합해 보여줄지 (기본: 월+요일만,
  // 기존에 저장된 항목과 동일하게 보이도록 하는 하위 호환 기본값)
  dateShowMonth?: boolean;
  dateShowDay?: boolean;
  dateShowWeekday?: boolean;
}

// 인사말과 안내 문구 사이 "수신: " 뒤에 그대로 표시할 수신인 후보 하나 — 미리 등록해두고
// 메일 작성 때마다 그중 골라 쓴다 (예: label "이지수 책임님")
export interface MailRecipientOption {
  id: string;
  label: string;
}

// 선택 문구의 후보 하나 — text는 선택 목록에도 그대로 보여주고, 고르면 그 내용이 삽입됨
export interface MailPhraseOption {
  id: string;
  text: string;
}

// 안내 문구(message) 안에 "{이름}" 형태로 표시해두는 선택 문구 자리 하나.
// name은 message 안의 "{name}" 마커와 매칭되는 키. options가 1개면 메일 작성 화면에서
// 체크박스로 켜고 끄고, 2개 이상이면 그중 하나를 고르는 선택지로 표시된다
export interface MailOptionalPhrase {
  id: string;
  name: string;
  options: MailPhraseOption[];
  defaultOptionId?: string; // 메일 작성을 새로 열었을 때 기본으로 선택되어 있을 옵션 (없으면 선택 안 함)
  // 이 문구가 선택되어 있을 때만 본문에 노출할 영역들. 'table:main'/'table:<extraTables[].id>'/
  // 'fields:body'/'list:<listGroups[].id>' 형식의 key(bodyBlockOrder와 동일). 비어있으면 이
  // 문구는 영역 노출 여부에 관여하지 않음(기존처럼 항상 그 영역 자체 설정대로 표시)
  controlsBlockKeys?: string[];
}

// 공백 없이 붙여 쓴 "{이름}" 마커 여러 개(예: "{KV}{페이지}{배너}")가 전부 선택됐을 때,
// 각 이름을 "·"로 이어붙이는 대신 쓸 대체 문구(예: "전소재"). names는 메시지에 등장하는 순서 그대로
export interface MailPhraseGroupOverride {
  names: string[];
  text: string;
}

// 표의 개별 항목(행) 하나에 대한 배경색/볼드/숨김 오버라이드 — 지정 안 하면 프리셋의
// tableLabelBg/tableValueBg 등 공통 기본값을 사용
export interface MailTableCellStyle {
  labelBg?: string;
  labelBold?: boolean;
  valueBg?: string;
  valueBold?: boolean;
  hideRow?: boolean; // true면 이 항목을 표에서 완전히 숨김(항목명+내용 모두)
  hideLabel?: boolean; // true면 이 항목의 항목명 칸만 숨기고 내용은 그대로 표시
  valuePrefix?: string; // 내용 값 앞에 붙는 고정 텍스트
  valueSuffix?: string; // 내용 값 뒤에 붙는 고정 텍스트
}

// 기존(첫 번째) 표와 별도로 추가하는 독립된 표 — 업무의 기본 8개 항목과 무관하게
// 항목을 직접 구성(필드에서 가져오거나 사용자 입력)하는, 완전히 분리된 표 구성
export interface MailTableConfig {
  id: string;
  title?: string; // 표 위에 "[제목]" 형태(볼드)로 표시할 제목 (없으면 표시 안 함)
  customFields?: MailTableCustomField[]; // 이 표에 표시할 항목
  rowOrder?: string[]; // 항목 순서, 드래그로 재정렬 (없으면 추가한 순서)
  showLabelColumn?: boolean; // 표 항목명 칸 자체를 표시할지 (없으면 true = 표시)
  showValueColumn?: boolean; // 표 내용 칸 자체를 표시할지 (없으면 true = 표시)
  labelBg?: string; // 표 항목명 칸 공통 배경색 (hex, 없으면 기본값)
  labelBold?: boolean; // 표 항목명 칸 공통 볼드 여부 (없으면 true)
  valueBg?: string; // 표 내용 칸 공통 배경색 (hex, 없으면 기본값)
  valueBold?: boolean; // 표 내용 칸 공통 볼드 여부 (없으면 false)
  fieldStyles?: Record<string, MailTableCellStyle>; // 항목별 배경색/볼드/숨김/접두·접미 개별 오버라이드
  hidden?: boolean; // true면 이 표 전체(제목 포함)를 표시하지 않음
}

// 업무 상세 "메일 양식"의 받는사람/참조 프리셋 하나 — 받는사람/참조 조합이 매번 다를 수 있어
// 파트별로 이름/색이 다른 탭을 여러 개 만들어두고 상황에 맞게 골라 쓸 수 있게 함
export interface MailFormPreset {
  id: string;
  name: string;
  color: string; // hex
  to: string[];
  cc: string[];
  message?: string; // 본문 인사말 다음에 들어가는 안내 문구(탭별로 다르게 설정 가능, 없으면 기본 문구 사용)
  // message 안에 "{이름}" 형태로 표시해둔 자리마다, 실제 메일 작성 시 체크 여부에 따라
  // 아래 문구 중 이름이 일치하는 항목의 text가 삽입되거나(체크) 빠짐(체크 해제)
  optionalPhrases?: MailOptionalPhrase[];
  // 공백 없이 붙여 쓴 "{이름}" 마커 그룹이 전부 선택됐을 때 대신 쓸 문구들 (예: KV+페이지+배너 → "전소재")
  phraseGroupOverrides?: MailPhraseGroupOverride[];
  // 삽입 항목/선택 문구가 여러 개 체크(선택)됐을 때 "·"로 구분해 이어붙일지 (없으면 true = 사용)
  joinMultipleWithDot?: boolean;
  showTaskName?: boolean; // 안내 문구 앞에 업무명을 노출할지 (탭별 설정, 기본값 false)
  messageInserts?: MailMessageInsert[]; // 업무명과 안내 문구 사이에 끼워 넣는 입력 항목들(텍스트/날짜/건수)
  // 인사말과 안내 문구 사이에 별도 줄로 "수신: 이름" 형태로 넣을 수 있는, 미리 등록해둔
  // 수신인 후보 목록 — 메일 작성 화면에서 이 중 하나를 골라 넣거나 선택 안 함으로 둠
  recipients?: MailRecipientOption[];
  recipientLineBold?: boolean; // "수신: 이름" 줄을 볼드로 표시할지 (없으면 false)
  tableHidden?: boolean; // true면 표 영역 전체(제목 포함)를 아예 표시하지 않음 (없으면 false = 표시)
  tableTitle?: string; // 표 위에 "[제목]" 형태(볼드)로 표시할 제목 (없으면 표시 안 함)
  tableFields?: string[]; // 표에 표시할 기본 항목 key 목록, 순서대로 (없으면 8개 전체 기본값)
  tableCustomFields?: MailTableCustomField[]; // 표에 추가로 표시할 항목
  tableRowOrder?: string[]; // 표에 표시되는 행(빌트인 key + 커스텀 필드 id)의 전체 순서, 드래그로 재정렬 (없으면 기본/추가 항목 순서)
  tableShowLabelColumn?: boolean; // 표 항목명 칸 자체를 표시할지 (없으면 true = 표시)
  tableShowValueColumn?: boolean; // 표 내용 칸 자체를 표시할지 (없으면 true = 표시)
  tableLabelBg?: string; // 표 항목명 칸 공통 배경색 (hex, 없으면 기본값)
  tableLabelBold?: boolean; // 표 항목명 칸 공통 볼드 여부 (없으면 true)
  tableValueBg?: string; // 표 내용 칸 공통 배경색 (hex, 없으면 기본값)
  tableValueBold?: boolean; // 표 내용 칸 공통 볼드 여부 (없으면 false)
  tableFieldStyles?: Record<string, MailTableCellStyle>; // 항목(빌트인 key 또는 커스텀 필드 id)별 배경색/볼드 개별 오버라이드
  extraTables?: MailTableConfig[]; // 기존 표에 합치지 않고 별도로 구성하는 추가 표 목록
  bodyCustomFields?: MailBodyCustomField[]; // 표 밖 본문에 추가하는 텍스트/날짜 입력 항목
  listGroups?: MailListGroup[]; // 제목 아래 번호 매긴 항목을 나열하는 목록들
  gridTables?: MailGridTableConfig[]; // 여러 행을 가로 표로 나열하는(메일 작성 때마다 행을 추가하는) 표들
  // 본문에서 표/본문추가항목/목록/행표 "영역" 단위의 전체 순서. 각 항목은 'table:main',
  // 'table:<extraTables[].id>', 'fields:body', 'list:<listGroups[].id>', 'grid:<gridTables[].id>'
  // 형식의 key. 없으면 기본 순서(메인 표 → 추가 표들 → 본문 추가 항목 → 목록들 → 행표들) 사용
  bodyBlockOrder?: string[];
}

// ── 폼 빌더 ──────────────────────────────────────
export type FormFieldType = 'text' | 'select' | 'date' | 'number' | 'name' | 'link' | 'textarea';

export interface CustomFormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  enabled?: boolean; // undefined = true (하위 호환)
  showIn?: 'both' | 'list' | 'detail'; // undefined = 'both' (하위 호환)
  options?: string[]; // select 타입일 때 선택지
  optionColors?: Record<string, { bg: string; text: string }>; // 옵션별 뱃지 색상
  department?: Department; // name 타입: 해당 직군 사람만 표시 (구버전 호환)
  departments?: Department[]; // 복수 직군 선택 (신버전)
  dependsOn?: {
    fieldId: string;                    // 부모 필드 ID (커스텀) 또는 builtin key
    valueMap: Record<string, string[]>; // 부모 선택값 → 이 필드의 표시 옵션
  };
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
  showIn?: 'both' | 'list' | 'detail'; // 표시 위치: 목록/상세/둘다
  dependsOn?: { fieldId: string; valueMap: Record<string, string[]> }; // 연결 필드
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
  { label: '파랑',    bg: '#dbeafe', text: '#2563eb' },
  { label: '하늘',    bg: '#e0f2fe', text: '#0284c7' },
  { label: '초록',    bg: '#dcfce7', text: '#16a34a' },
  { label: '청록',    bg: '#ccfbf1', text: '#0d9488' },
  { label: '노랑',    bg: '#fef9c3', text: '#a16207' },
  { label: '주황',    bg: '#ffedd5', text: '#ea580c' },
  { label: '빨강',    bg: '#fee2e2', text: '#dc2626' },
  { label: '분홍',    bg: '#fce7f3', text: '#db2777' },
  { label: '보라',    bg: '#f3e8ff', text: '#7c3aed' },
  { label: '흰회색',  bg: '#f8fafc', text: '#94a3b8' },
  { label: '연회색',  bg: '#f1f5f9', text: '#64748b' },
  { label: '회색',    bg: '#e2e8f0', text: '#475569' },
  { label: '진회색',  bg: '#cbd5e1', text: '#334155' },
  { label: '검정',    bg: '#334155', text: '#f1f5f9' },
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
  // taskMonth가 없을 때만 맨 앞에 추가 (있으면 저장된 위치 그대로 유지)
  if (!fields.some(f => f.key === 'taskMonth')) {
    fields.unshift({ key: 'taskMonth', enabled: true, width: 52 });
  }
  // fieldOrder가 있으면 builtin 필드를 fieldOrder 순서로 재정렬 (fieldOrder가 정식 순서 기준)
  if (config?.fieldOrder?.length) {
    const fo = config.fieldOrder;
    const keyIdx: Record<string, number> = {};
    fo.forEach((k, i) => { keyIdx[k] = i; });
    fields.sort((a, b) => {
      const ai = keyIdx[a.key] ?? Infinity;
      const bi = keyIdx[b.key] ?? Infinity;
      return ai - bi;
    });
  }
  return fields;
}

/** 파트 formConfig와 팀 formConfig를 병합. 파트 설정이 우선, 없는 필드는 팀에서 상속. */
export function mergeFormConfig(partConfig: TeamFormConfig | undefined, teamConfig: TeamFormConfig | undefined): TeamFormConfig | undefined {
  if (!partConfig) return teamConfig;
  if (!teamConfig?.builtinFields?.length) return partConfig;
  const partFields = resolveBuiltinFields(partConfig);
  const teamFields = resolveBuiltinFields(teamConfig);
  const merged = partFields.map(pf => {
    const tf = teamFields.find(f => f.key === pf.key);
    if (!tf) return pf;
    return {
      ...pf,
      customLabel: pf.customLabel ?? tf.customLabel,
      customType: pf.customType ?? tf.customType,
      options: pf.options ?? tf.options,
      optionColors: pf.optionColors ?? tf.optionColors,
      ...(resolveFieldDepts(pf) ? {} : { departments: tf.departments, department: tf.department }),
    };
  });
  const teamCfs = teamConfig.customFields ?? [];
  const partCfs = partConfig.customFields ?? [];
  const mergedCfs = [
    ...teamCfs.map(tcf => partCfs.find(pcf => pcf.id === tcf.id) ?? tcf),
    ...partCfs.filter(pcf => !teamCfs.some(tcf => tcf.id === pcf.id)),
  ];
  // 파트에 fieldOrder가 없으면 팀 기본 fieldOrder 상속
  const fieldOrder = partConfig.fieldOrder ?? teamConfig.fieldOrder;
  return { ...partConfig, builtinFields: merged, customFields: mergedCfs, ...(fieldOrder ? { fieldOrder } : {}) };
}

/**
 * 여러 파트의 formConfig를 합집합(union)으로 병합.
 * 어느 한 파트라도 활성화한 필드는 전체 뷰에서도 표시.
 * 파트별 설정이 없는 파트는 teamConfig를 fallback으로 사용.
 */
export function mergeAllPartsConfig(parts: { formConfig?: TeamFormConfig }[], teamConfig: TeamFormConfig | undefined): TeamFormConfig | undefined {
  if (parts.length === 0) return teamConfig;
  // 각 파트의 실효 config (파트 설정 없으면 팀 기본)
  const resolved = parts.map(p => mergeFormConfig(p.formConfig, teamConfig) ?? teamConfig);
  const base = resolveBuiltinFields(teamConfig);
  // 어느 파트에서든 enabled=true면 전체에서도 enabled
  const mergedBuiltins = base.map(bf => {
    const enabledInAny = resolved.some(cfg => {
      const f = resolveBuiltinFields(cfg).find(f => f.key === bf.key);
      return f?.enabled ?? false;
    });
    // label, customType 등은 첫 번째로 활성화한 파트의 값 사용
    const firstActive = resolved.find(cfg => resolveBuiltinFields(cfg).find(f => f.key === bf.key)?.enabled);
    const overrideField = firstActive ? resolveBuiltinFields(firstActive).find(f => f.key === bf.key) : undefined;
    return { ...(overrideField ?? bf), enabled: enabledInAny };
  });
  // 커스텀 필드: 각 파트에서 나타나는 모든 필드 합집합 (id 기준 중복 제거, 첫 등장 파트 설정 우선)
  const seenCfIds = new Set<string>();
  const mergedCustoms: CustomFormField[] = [];
  for (const cfg of resolved) {
    for (const cf of (cfg?.customFields ?? [])) {
      if (!seenCfIds.has(cf.id)) { seenCfIds.add(cf.id); mergedCustoms.push(cf); }
    }
  }
  // teamConfig의 fieldOrder를 우선. 없으면 모든 파트의 fieldOrder가 동일할 때만 사용.
  // 파트마다 fieldOrder가 다르면 undefined → DEFAULT_BUILTIN_FIELD_CONFIGS 순서로 재정렬.
  let fieldOrder: string[] | undefined = teamConfig?.fieldOrder;
  if (!fieldOrder) {
    const allOrders = parts
      .filter(p => p.formConfig?.fieldOrder?.length)
      .map(p => p.formConfig!.fieldOrder!);
    if (allOrders.length > 0) {
      const first = JSON.stringify(allOrders[0]);
      fieldOrder = allOrders.every(o => JSON.stringify(o) === first) ? allOrders[0] : undefined;
    }
  }
  // fieldOrder가 없으면 builtinFields를 DEFAULT 순서로 재정렬 (팀/파트마다 순서가 달라지는 문제 방지)
  if (!fieldOrder) {
    const defaultIdx: Record<string, number> = {};
    DEFAULT_BUILTIN_FIELD_CONFIGS.forEach((f, i) => { defaultIdx[f.key] = i; });
    mergedBuiltins.sort((a, b) => (defaultIdx[a.key] ?? Infinity) - (defaultIdx[b.key] ?? Infinity));
  }
  return { builtinFields: mergedBuiltins, customFields: mergedCustoms, ...(fieldOrder ? { fieldOrder } : {}) };
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
  isPath?: boolean;
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
  showInDetail?: boolean;   // undefined = true, 업무 상세 화면에 노출할지 여부
  plFieldType?: PLSubTaskFieldType; // PL세부업무 필드 타입 (text|review)
}

export type PLSubTaskFieldType = 'text' | 'review'; // 텍스트, 검수

export interface PLSubTaskField {
  id: string;
  name: string;
  fieldType: PLSubTaskFieldType;
  department?: Department;    // 구버전 호환
  departments?: Department[]; // 복수 직군 선택 (신버전)
}

export interface PLMainTaskType {
  id: string;
  name: string;
  department?: Department;      // 구버전 호환
  departments?: Department[];   // 복수 직군 선택 (신버전)
  subFields?: PLSubTaskField[]; // 이 메인업무의 세부업무 필드 목록
}

/** PLMainTaskType의 직군 목록 반환. 구버전 department 단일값도 처리. */
export function resolvePLMainDepts(t: { department?: Department; departments?: Department[] }): Department[] {
  if (t.departments?.length) return t.departments;
  if (t.department) return [t.department];
  return [];
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
  workplaceId?: string;
}

export interface ExcelFieldConfig {
  key: string;       // builtin key 또는 metaField key
  label: string;     // 컬럼 헤더
  enabled: boolean;
  order: number;
  exportExcluded?: boolean; // true면 내보내기에서 제외 (가져오기는 유지)
}

export type WeeklyColumnType = 'new' | 'derived' | 'other' | 'hours' | 'desc' | 'empty' | 'meta';

export interface WeeklyColumnDef {
  id: string;
  type: WeeklyColumnType;
  enabled: boolean;
  metaKey?: string; // type === 'meta'일 때 MetaField.key
}

export interface WeeklyExportConfig {
  columns: WeeklyColumnDef[];
  substituteColumns?: WeeklyColumnDef[]; // 대무 항목 전용 컬럼 구성 (없으면 columns 상속)
}

export interface Team {
  id: string;
  workplaceId: string; // 소속 근무지 (클라이언트 TF 단위)
  name: string;
  emoji: string;
  color?: string; // hex e.g. '#3b82f6'
  sortOrder?: number;
  parts: TeamPart[];
  createdAt: string;
  formConfig?: TeamFormConfig;
  allFormConfig?: TeamFormConfig;  // 전체 뷰(파트 필터 없음) 전용 설정
  metaFields?: MetaField[];
  subTaskTypes?: SubTaskType[];
  plMainTaskTypes?: PLMainTaskType[]; // PL업무 메인 업무 항목 목록
  holidays?: CustomHoliday[];
  excelConfig?: ExcelFieldConfig[];
  weeklyExportConfig?: WeeklyExportConfig;
  rolePermissions?: RolePermissions | null; // 팀별 권한 오버라이드 (null = 전체 기본 설정 사용)
  calendarGroupBy?: 'task' | 'subtaskType'; // 캘린더 하루 셀 내 정렬 기준 (undefined = 'task', 메인업무순)
  calendarOrder?: string[]; // 캘린더 전용 세부업무 정렬 순서 (SubTaskType.id 목록, 팀 기본값, 업무상세 순서와 별개)
  plShowInCalendar?: boolean; // PL업무를 캘린더에 표시할지 팀 기본값 (undefined = true)
  mainTaskEndDateShow?: boolean; // 메인업무 종료일을 캘린더에 표시할지 팀 기본값 (undefined = false)
  mainTaskEndDateLabel?: string; // 메인업무 종료일 캘린더 표시 명칭 팀 기본값 (예: '방송일', 비어있으면 '종료일' 사용)
  mainTaskEndDateColor?: string; // 메인업무 종료일 배지 색상 팀 기본값 (hex, 빈 값이면 파트색 자동 사용)
  isSupportTeam?: boolean; // 지원팀 여부 — 직접 업무를 등록하기보다 다른 팀에서 업무 요청을 받는 팀
  supportSourceTeamIds?: string[]; // 지원팀일 때, 이 팀들만 업무 요청을 보낼 수 있음 (화이트리스트)
  revisionSteps?: RevisionStep[]; // 수정단계 목록 팀 기본값 (없으면 DEFAULT_REVISION_STEPS)
  copyIncludeDetails?: boolean; // 업무 복사 시 세부업무/커스텀필드 등 세부사항까지 포함할지 팀 기본값 (undefined = false, 기존 동작)
  taskListTwoLine?: boolean; // 업무관리 목록에서 월+업무명은 1줄, 나머지 필드는 2줄에 배치할지 팀 기본값 (undefined = false, 기존 동작)
}

// 업무 복사 시 세부사항(세부업무/커스텀필드/메모 등) 포함 여부 — 파트 오버라이드 → 팀 기본값 순
export function resolveCopyIncludeDetails(team?: Team | null, part?: TeamPart | null): boolean {
  return part?.copyIncludeDetails ?? team?.copyIncludeDetails ?? false;
}

// 업무관리 목록 2줄 구성(월+업무명 1줄 / 나머지 필드 2줄) 사용 여부 — 파트 오버라이드 → 팀 기본값 순
export function resolveTaskListTwoLine(team?: Team | null, part?: TeamPart | null): boolean {
  return part?.taskListTwoLine ?? team?.taskListTwoLine ?? false;
}

// 커뮤니티 > AI 툴 리스트 — 팀 구분 없이 전체 공용으로 노출되는 추천 리스트
export interface AiTool {
  id: string;
  name: string;          // 메인 제목, 예: '클로드(Claude)'
  subtitle?: string;     // 서브 제목 — 목록에서 메인 제목 옆에 한 줄로 표시
  description: string;   // 상세 설명 (길게 작성 가능, 줄바꿈 유지)
  category: string;      // 강조 배지 텍스트, 예: 'AI · LLM'
  tags: string[];        // 추가 태그 목록, 예: ['대화형 AI', '글쓰기']
  siteUrl?: string;      // 공식 사이트 링크 (있으면 클릭 시 새 탭으로 이동)
  iconUrl?: string;      // 아이콘 이미지 URL (없으면 기본 아이콘 표시)
  relatedToolIds?: string[]; // 상세보기 하단 '같이 보면 좋은 도구'에 표시할 다른 AiTool id 목록
  recommendedBy: string[]; // 추천한 사용자 uid 목록 — 순위(추천순)는 이 길이로 계산
  authorUid: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
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
  substituteWeeklyHours?: Record<string, number>;
  substituteTotalHours?: number;
  revisionLevel: number; // 0~6 (F1~F6)
  createdAt: string;
}

export interface SubTaskDataEntry {
  status?: TaskStatus;
  assignee?: string;
  substitute?: string; // 대무자 (담당자 휴가 시)
  startDate?: string;
  endDate?: string;
  weeklyHours: Record<string, number>; // w1d1~w5d5 (week×day)
  totalHours: number;
  substituteWeeklyHours?: Record<string, number>; // 대무자 주차별 시간
  substituteTotalHours?: number;
  memos?: SubTaskMemo[];
  checkedItems?: string[]; // review 타입 필드: 선택된 업무 ID 목록
  reviewWeeklyHours?: Record<string, Record<string, number>>; // review 타입 필드: taskId → { w1d1... }
  reviewDates?: Record<string, { startDate?: string; endDate?: string }>; // review 타입 필드: taskId → 날짜
  reviewStatus?: Record<string, string>; // review 타입 필드: taskId → 검수 상태
}

// 휴지통: 개별 삭제된 세부업무의 스냅샷 (typeName은 삭제 시점 이름 — 이후 세부업무 타입이 이름 변경/삭제돼도 표시 가능하도록 보존)
export interface DeletedSubTaskEntry {
  entry: SubTaskDataEntry;
  typeName: string;
  deletedAt: string;
  deletedBy: string;
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
  subTaskData?: Record<string, SubTaskDataEntry>;
  memo?: string;
  hiddenSubTaskTypeIds?: string[]; // 이 업무에서 숨긴 세부업무 타입 ID 목록
  plTask?: boolean;          // PL업무 여부
  plParts?: string[];        // PL업무 소속 파트 목록
  plSelectedTypes?: string[]; // PL업무에서 선택된 메인업무 타입 ID 목록
  requestedFromTeamId?: string; // 지원팀 요청으로 생성된 경우, 원본 업무의 팀 ID (참고용, 동기화 없음)
  requestedFromTaskId?: string; // 지원팀 요청으로 생성된 경우, 원본 업무의 ID (참고용, 동기화 없음)
  deletedAt?: string;   // 휴지통: 메인업무 소프트 삭제 시각 (있으면 휴지통에 있는 상태)
  deletedBy?: string;
  deletedSubTasks?: Record<string, DeletedSubTaskEntry>; // 휴지통: 업무는 살아있지만 개별 삭제된 세부업무들
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workplaceId: string; // 소속 근무지
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
  workplaceId?: string;
}

const PART_BADGE_MAP: Record<string, string> = {
  'bg-red-500':    'bg-red-100 text-red-700',
  'bg-orange-400': 'bg-orange-100 text-orange-700',
  'bg-yellow-400': 'bg-yellow-100 text-yellow-700',
  'bg-green-500':  'bg-green-100 text-green-700',
  'bg-teal-500':   'bg-teal-100 text-teal-700',
  'bg-blue-500':   'bg-blue-100 text-blue-700',
  'bg-indigo-500': 'bg-indigo-100 text-indigo-700',
  'bg-purple-500': 'bg-purple-100 text-purple-700',
  'bg-pink-500':   'bg-pink-100 text-pink-700',
  'bg-gray-400':   'bg-gray-100 text-gray-600',
};
export const partBadgeCls = (colorCls: string): string =>
  PART_BADGE_MAP[colorCls] ?? 'bg-gray-100 text-gray-700';

// task.subTaskData(맵) → SubTask[] 파생. 원래 App.tsx에 selectedTeam 전용으로 인라인돼 있던 로직을
// 팀을 매개변수로 받게 추출함 — 지원팀 위클리에서 "다른 팀 업무에 기록된 지원팀 인원의 시간"을
// 그 원본 팀의 세부업무 타입 이름으로 올바르게 표시하려면 임의의 팀 기준으로 재사용해야 하기 때문.
export function deriveSubtasksForTeam(
  tasksForTeam: Task[],
  team: Team | null | undefined,
  allProjectTasks: Task[],
  titlePrefix?: string
): SubTask[] {
  const activeParts = team?.parts ?? [];
  const subTaskTypeOrder = new Map<string, number>();
  let orderIdx = 0;
  team?.subTaskTypes?.forEach(t => subTaskTypeOrder.set(t.id, orderIdx++));
  activeParts.forEach(p => p.subTaskTypes?.forEach(t => { if (!subTaskTypeOrder.has(t.id)) subTaskTypeOrder.set(t.id, orderIdx++); }));

  const reviewStatusToTaskStatus = (rs: string): SubTask['status'] => {
    if (rs === '검수 완료') return '완료';
    if (rs === '검수 중') return '진행 중';
    return '진행 전';
  };

  return tasksForTeam.flatMap(task => {
    const taskPartObj = activeParts.find(p => p.name === task.category);
    const plMainType = task.plTask
      ? (team?.plMainTaskTypes ?? []).find(m => task.plSelectedTypes?.includes(m.id))
      : undefined;
    let validTypes: SubTaskType[] | PLSubTaskField[] | null | undefined;
    if (task.plTask) {
      validTypes = plMainType?.subFields ?? [];
    } else {
      validTypes = taskPartObj?.subTaskTypes ?? team?.subTaskTypes;
    }
    const validTypeIds = validTypes ? new Set(validTypes.map(t => t.id)) : null;

    const taskNameMap = new Map<string, string>();
    if (task.plTask) {
      plMainType?.subFields?.forEach(f => taskNameMap.set(f.id, f.name));
    } else {
      team?.subTaskTypes?.forEach(t => taskNameMap.set(t.id, t.name));
      taskPartObj?.subTaskTypes?.forEach(t => taskNameMap.set(t.id, t.name));
    }
    const withPrefix = (name: string) => titlePrefix ? `${titlePrefix} ${name}` : name;

    return Object.entries(task.subTaskData ?? {})
      .filter(([key]) => !validTypeIds || validTypeIds.has(key))
      .sort(([a], [b]) => (subTaskTypeOrder.get(a) ?? 999) - (subTaskTypeOrder.get(b) ?? 999))
      .flatMap(([key, entry]): SubTask[] => {
        // PL review 타입: 체크된 항목별로 개별 SubTask 생성
        const subField = plMainType?.subFields?.find(f => f.id === key);
        if (subField?.fieldType === 'review') {
          const checkedItems = (entry.checkedItems ?? []).filter(id =>
            (entry.reviewDates ?? {})[id]?.startDate
          );
          return checkedItems.map(itemId => {
            const reviewTask = allProjectTasks.find(t => t.id === itemId);
            const itemDates = (entry.reviewDates ?? {})[itemId] ?? {};
            const itemWeeklyHours = (entry.reviewWeeklyHours ?? {})[itemId] ?? {};
            const itemTotalHours = Object.values(itemWeeklyHours).reduce((a: number, b: number) => a + b, 0);
            const rs = (entry.reviewStatus ?? {})[itemId] ?? '검수 전';
            return {
              id: `${task.id}__${key}__${itemId}`,
              taskId: task.id,
              projectId: task.projectId ?? '',
              title: withPrefix(reviewTask?.title ?? itemId),
              category: task.category,
              type: task.type,
              status: reviewStatusToTaskStatus(rs),
              assignee: task.assignee ?? task.receiver ?? '',
              receiver: '',
              startDate: itemDates.startDate ?? '',
              endDate: itemDates.endDate ?? '',
              weeklyHours: itemWeeklyHours,
              totalHours: itemTotalHours,
              substituteWeeklyHours: undefined,
              substituteTotalHours: undefined,
              revisionLevel: 0,
              createdAt: task.createdAt,
            };
          });
        }

        // 일반 엔트리
        return [{
          id: `${task.id}__${key}`,
          taskId: task.id,
          projectId: task.projectId ?? '',
          title: withPrefix(taskNameMap.get(key) ?? key),
          category: task.category,
          type: task.type,
          status: (entry.status || '진행 전') as SubTask['status'],
          assignee:  entry.assignee ?? '',
          receiver:  '',
          startDate: entry.startDate ?? '',
          endDate:   entry.endDate   ?? '',
          weeklyHours: entry.weeklyHours,
          totalHours:  entry.totalHours,
          substituteWeeklyHours: entry.substituteWeeklyHours,
          substituteTotalHours:  entry.substituteTotalHours,
          revisionLevel: 0,
          createdAt: task.createdAt,
        }];
      });
  });
}
