import { useState, useRef, useEffect, useContext, createContext } from 'react';
import { Shield, User, Users, Check, ChevronDown, ChevronRight, Pencil, X, Plus, Trash2, Layers, GripVertical, RotateCcw, Star, CalendarDays, FileText, ArrowUpToLine, ArrowDownToLine, Copy } from 'lucide-react';
import type { AppUser, UserRole, Department, Team, TeamPart, TeamFormConfig, CustomFormField, FormFieldType, BuiltinFieldKey, BuiltinFieldConfig, MetaField, SubTaskType, PLMainTaskType, PLSubTaskField, PLSubTaskFieldType, TaskStatus, CustomHoliday, ExcelFieldConfig, ProfileFieldDef, WeeklyColumnDef, WeeklyExportConfig, RolePermissions, RolePermissionConfig, RevisionStep, RoleLabels, MailFormPreset, MailTableCustomField, MailTableCellStyle, MailBodyCustomField, MailTableConfig, MailListGroup, MailListItem, MailMessageInsert, Task } from '../types';
import { resolvePLMainDepts, DEFAULT_REVISION_STEPS, normalizeRevisionSteps, resolveRoleLabel, DEFAULT_ROLE_LABELS, resolveCopyIncludeDetails } from '../types';
import { usePublicHolidays } from '../hooks/usePublicHolidays';
import { DEPARTMENTS, BUILTIN_FIELDS_META, TABLE_FIELD_KEYS, resolveBuiltinFields, DEFAULT_META_FIELDS, STATUS_COLOR_PRESETS, DEFAULT_STATUS_CONFIGS, mergeAllPartsConfig, mergeFormConfig, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { useAllUsers } from '../hooks/useUserRole';
import { collection, getDocs, updateDoc, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DatePicker from '../components/DatePicker';
import { MAIL_TABLE_BUILTIN_FIELDS, resolveMailTableRowOrder, buildMailGreeting, composeMessageLine, buildMainRenderableTable, buildExtraRenderableTable, buildRenderableListGroup, buildMailHtml } from '../components/TaskDetailPanel';

interface Props {
  onUpdatePartCopyIncludeDetails: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartCopyIncludeDetails: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartTaskListTwoLine: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartTaskListTwoLine: (teamId: string, partId: string) => Promise<void>;
  appUser: AppUser;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateDepartment: (dept: Department) => Promise<void>;
  onUpdateSelectedTeams: (teamIds: string[]) => Promise<void>;
  onUpdateDefaultTeam: (teamId: string | null) => Promise<void>;
  teams: Team[];
  teamsLoading: boolean;
  onCreateTeam: (name: string, emoji: string) => Promise<string>;
  onUpdateTeam: (teamId: string, data: Partial<Omit<Team, 'id'>>) => Promise<void>;
  onSetParts: (teamId: string, parts: TeamPart[]) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onUpdateFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onUpdateAllFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onClearAllFormConfig: (teamId: string) => Promise<void>;
  onUpdatePartFormConfig: (teamId: string, partId: string, config: TeamFormConfig) => Promise<void>;
  onClearPartFormConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdateMetaFields: (teamId: string, fields: MetaField[]) => Promise<void>;
  onUpdatePartMetaFields: (teamId: string, partId: string, fields: MetaField[]) => Promise<void>;
  onClearPartMetaFields: (teamId: string, partId: string) => Promise<void>;
  onUpdateSubTaskTypes: (teamId: string, types: SubTaskType[]) => Promise<void>;
  onUpdatePartSubTaskTypes: (teamId: string, partId: string, types: SubTaskType[]) => Promise<void>;
  onClearPartSubTaskTypes: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartCalendarOrder: (teamId: string, partId: string, order: string[]) => Promise<void>;
  onClearPartCalendarOrder: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartPLShowInCalendar: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartPLShowInCalendar: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateLabel: (teamId: string, partId: string, label: string) => Promise<void>;
  onClearPartMainTaskEndDateLabel: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateShow: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartMainTaskEndDateShow: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateColor: (teamId: string, partId: string, color: string) => Promise<void>;
  onClearPartMainTaskEndDateColor: (teamId: string, partId: string) => Promise<void>;
  onUpdateRevisionSteps: (teamId: string, steps: RevisionStep[]) => Promise<void>;
  onUpdatePartRevisionSteps: (teamId: string, partId: string, steps: RevisionStep[]) => Promise<void>;
  onClearPartRevisionSteps: (teamId: string, partId: string) => Promise<void>;
  onUpdatePlMainTaskTypes: (teamId: string, types: PLMainTaskType[]) => Promise<void>;
  onUpdateExcelConfig: (teamId: string, config: ExcelFieldConfig[]) => Promise<void>;
  onUpdatePartExcelConfig: (teamId: string, partId: string, config: ExcelFieldConfig[]) => Promise<void>;
  onClearPartExcelConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartWeeklyConfig: (teamId: string, partId: string, config: WeeklyExportConfig) => Promise<void>;
  onClearPartWeeklyConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMailFormConfig: (teamId: string, partId: string, config: MailFormPreset[]) => Promise<void>;
  onClearPartMailFormConfig: (teamId: string, partId: string) => Promise<void>;
  customHolidays: CustomHoliday[];
  onUpdateHolidays: (holidays: CustomHoliday[]) => Promise<void>;
  onReorderTeams: (ordered: Team[]) => Promise<void>;
  orphanTaskCount: number;
  onCleanupOrphanTasks: () => Promise<number>;
  profileFields: ProfileFieldDef[];
  onUpdateProfileFields: (fields: ProfileFieldDef[]) => Promise<void>;
  rolePermissions: RolePermissions;
  onUpdateRolePermissions: (perms: RolePermissions) => Promise<void>;
  roleLabels?: RoleLabels;
  onUpdateRoleLabels?: (labels: RoleLabels) => Promise<void>;
  workplaceId?: string;
}

// ──────────────────────────────────────────
// 상수
// ──────────────────────────────────────────
const ROLE_COLOR: Record<UserRole, string> = {
  superadmin: 'text-purple-600 bg-purple-50',
  manager: 'text-blue-600 bg-blue-50',
  user: 'text-gray-600 bg-gray-100',
};
const DEPT_COLOR: Record<Department, string> = {
  '기획': 'text-violet-600 bg-violet-50',
  '디자인': 'text-pink-600 bg-pink-50',
  '퍼블': 'text-teal-600 bg-teal-50',
};
const PART_COLORS = [
  { label: '빨강', cls: 'bg-red-500' },
  { label: '주황', cls: 'bg-orange-400' },
  { label: '노랑', cls: 'bg-yellow-400' },
  { label: '초록', cls: 'bg-green-500' },
  { label: '청록', cls: 'bg-teal-500' },
  { label: '파랑', cls: 'bg-blue-500' },
  { label: '남색', cls: 'bg-indigo-500' },
  { label: '보라', cls: 'bg-purple-500' },
  { label: '분홍', cls: 'bg-pink-500' },
  { label: '회색', cls: 'bg-gray-400' },
];
const EMOJIS = [
  '🚀','💡','⭐','🎯','🏆','🎨','💎','🔥','⚡','🌟',
  '📊','📈','💻','📱','🔑','🛡️','⚙️','🔮','🧲','💫',
  '🌊','🏔️','🌈','🌙','☀️','🍀','🌺','🌻','🌹','🌿',
  '🦁','🐯','🦊','🐝','🦋','🦅','🐬','🦄','🐺','🦖',
  '🎪','🎭','🎬','🎮','🎲','🎸','🎵','🎶','🏠','🏢',
  '🧩','🪄','🏄','🧗','🚴','🤝','👑','🪐','🧬','🎓',
];

function hexToTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#334155' : '#f8fafc';
}

// ──────────────────────────────────────────
// 권한 관리 상수
// ──────────────────────────────────────────
const PERM_ROWS: { key: keyof RolePermissionConfig; label: string; group: string }[] = [
  { key: 'canCreateTasks',         label: '업무 등록',               group: '업무' },
  { key: 'canEditTasks',           label: '업무 수정',               group: '업무' },
  { key: 'canDeleteTasks',         label: '업무 삭제',               group: '업무' },
  { key: 'canAddVacation',         label: '휴가 등록',               group: '업무' },
  { key: 'canInputTime',           label: '세부업무 시간 입력',       group: '업무' },
  { key: 'canViewAllCalendarWeekly', label: '캘린더 / 위클리 전체 조회', group: '업무' },
  { key: 'canManageTeams',         label: '팀 / 파트 관리',          group: '설정' },
  { key: 'canManageMembers',       label: '사용자 관리',              group: '설정' },
  { key: 'canManageHolidays',      label: '휴일 관리',               group: '설정' },
  { key: 'canManageProfileFields', label: '프로필 필드 관리',         group: '설정' },
  { key: 'canViewAccounts',        label: '계정정보 페이지 접근',     group: '설정' },
  { key: 'canEditSeatMap',         label: '자리 배치도 편집',         group: '설정' },
  { key: 'canSetNotice',           label: '게시판 공지 설정',         group: '게시판' },
  { key: 'canManageBoard',         label: '게시판 타인 글 / 댓글 관리', group: '게시판' },
  { key: 'canManageAiTools',       label: 'AI 툴 리스트 관리',        group: '게시판' },
];

function PermToggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-blue-500' : 'bg-gray-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

// 근무지마다 역할 표시 명칭을 다르게 설정할 수 있어(예: manager → "PM"), 이 페이지 트리 전체에서
// 공유하는 컨텍스트로 내려준다 — RoleBadge/RoleDropdown 등 곳곳에 prop으로 일일이 전달하지 않기 위함
const RoleLabelContext = createContext<RoleLabels>({});
function useRoleLabel(role: UserRole): string {
  const roleLabels = useContext(RoleLabelContext);
  return resolveRoleLabel(role, roleLabels);
}

// ──────────────────────────────────────────
// 공통 뱃지
// ──────────────────────────────────────────
function RoleBadge({ role }: { role: UserRole }) {
  const label = useRoleLabel(role);
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[role]}`}>{label}</span>;
}
function DeptBadge({ dept }: { dept: Department }) {
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DEPT_COLOR[dept]}`}>{dept}</span>;
}

// ──────────────────────────────────────────
// 직군 선택기
// ──────────────────────────────────────────
function DeptSelector({ value, onChange }: { value?: Department; onChange: (d: Department) => void }) {
  return (
    <div className="flex gap-2">
      {DEPARTMENTS.map(d => (
        <button key={d} onClick={() => onChange(d)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            value === d
              ? `border-transparent ${DEPT_COLOR[d]} ring-2 ring-offset-1 ring-current`
              : 'border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}>{d}</button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// 이모지 피커
// ──────────────────────────────────────────
function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 28px)', gap: 3 }}>
      {EMOJIS.map(e => (
        <button key={e} type="button" onClick={() => onChange(e)}
          style={{
            width: 28, height: 28,
            borderRadius: 6,
            fontSize: 16, lineHeight: '28px',
            textAlign: 'center',
            cursor: 'pointer',
            padding: 0,
            border: value === e ? '2px solid #60a5fa' : '2px solid transparent',
            backgroundColor: value === e ? '#dbeafe' : 'transparent',
            boxSizing: 'border-box',
          }}>{e}</button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// 역할 드롭다운 (superadmin 전용)
// ──────────────────────────────────────────
function RoleDropdown({ u, onChangeRole }: { u: AppUser; onChangeRole: (uid: string, role: UserRole) => void }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const roleLabels = useContext(RoleLabelContext);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest('[data-role-dd]')) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleOpen = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(v => !v);
  };

  return (
    <div data-role-dd>
      <button ref={btnRef} onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
        <span className={ROLE_COLOR[u.role].split(' ')[0]}>{resolveRoleLabel(u.role, roleLabels)}</span>
        <ChevronDown size={12} className="text-gray-400" />
      </button>
      {open && (
        <div data-role-dd style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9999 }}
          className="w-36 rounded-xl border border-gray-200 bg-white shadow-xl py-1">
          {(['manager', 'user'] as UserRole[]).map(r => (
            <button key={r} onClick={() => { onChangeRole(u.uid, r); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-100 transition-colors">
              <span className="text-gray-800">{resolveRoleLabel(r, roleLabels)}</span>
              {u.role === r && <Check size={12} className="text-blue-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 역할 명칭 커스터마이징 (근무지별)
// ──────────────────────────────────────────
const ROLE_ORDER: UserRole[] = ['superadmin', 'manager', 'user'];
function RoleLabelEditor({ roleLabels, onSave }: { roleLabels: RoleLabels; onSave: (labels: RoleLabels) => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<UserRole, string>>({
    superadmin: roleLabels.superadmin ?? '',
    manager: roleLabels.manager ?? '',
    user: roleLabels.user ?? '',
  });
  const [savedRole, setSavedRole] = useState<UserRole | null>(null);
  const [errorRole, setErrorRole] = useState<UserRole | null>(null);

  useEffect(() => {
    setDrafts({
      superadmin: roleLabels.superadmin ?? '',
      manager: roleLabels.manager ?? '',
      user: roleLabels.user ?? '',
    });
  }, [roleLabels.superadmin, roleLabels.manager, roleLabels.user]);

  const handleBlur = async (role: UserRole) => {
    const trimmed = drafts[role].trim();
    if (trimmed === (roleLabels[role] ?? '')) return;
    try {
      await onSave({ ...roleLabels, [role]: trimmed || undefined });
      setSavedRole(role);
      setTimeout(() => setSavedRole(r => (r === role ? null : r)), 1500);
    } catch (e) {
      console.error('역할 명칭 저장 실패:', e);
      setErrorRole(role);
      setTimeout(() => setErrorRole(r => (r === role ? null : r)), 3000);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {ROLE_ORDER.map(role => (
        <div key={role}>
          <label className="text-[10px] text-gray-400 block mb-1 flex items-center gap-1.5">
            {DEFAULT_ROLE_LABELS[role]} 표시 명칭
            {savedRole === role && <span className="text-green-500 font-medium">저장됨</span>}
            {errorRole === role && <span className="text-red-500 font-medium">저장 실패 — 다시 시도해주세요</span>}
          </label>
          <input
            value={drafts[role]}
            onChange={e => setDrafts(prev => ({ ...prev, [role]: e.target.value }))}
            onBlur={() => handleBlur(role)}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder={DEFAULT_ROLE_LABELS[role]}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// 사용자 행
// ──────────────────────────────────────────
const DEFAULT_ANNUAL = 0;

function UserRow({ u, viewerRole, viewerTeamIds, isSelf, onChangeRole, onUpdateInfo, onDeleteUser, teams, profileFields, workplaceId }: {
  u: AppUser; viewerRole: UserRole; viewerTeamIds: string[]; isSelf: boolean;
  onChangeRole: (uid: string, role: UserRole) => void;
  onUpdateInfo: (uid: string, data: { displayName?: string; department?: Department; selectedTeamIds?: string[]; annualLeave?: number; defaultTeamId?: string | null; workplaceId?: string; profileData?: Record<string, string> }) => void;
  onDeleteUser: (uid: string) => Promise<void>;
  teams: Team[];
  profileFields: ProfileFieldDef[];
  workplaceId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(u.displayName);
  const [deptInput, setDeptInput] = useState<Department | undefined>(u.department);
  const [teamInput, setTeamInput] = useState<string[]>(u.selectedTeamIds ?? []);
  const [defaultTeamInput, setDefaultTeamInput] = useState<string | null>((workplaceId && u.defaultTeamIdByWorkplace?.[workplaceId]) || null);
  const [annualLeaveStr, setAnnualLeaveStr] = useState<string>(String(u.annualLeave ?? DEFAULT_ANNUAL));
  const [profileDataInput, setProfileDataInput] = useState<Record<string, string>>(u.profileData ?? {});

  // 최고 관리자: 본인 포함 전체 수정 가능
  // 중간 관리자: 본인 + 같은 팀 일반 사용자 수정 가능
  const isSameTeam = viewerTeamIds.some(tid => u.selectedTeamIds?.includes(tid));
  const canEdit =
    viewerRole === 'superadmin' ||
    (viewerRole === 'manager' && (isSelf || (isSameTeam && u.role === 'user')));
  const canChangeRole = (viewerRole === 'superadmin' || (viewerRole === 'manager' && isSameTeam)) && !isSelf && u.role !== 'superadmin';
  const canDelete = (viewerRole === 'superadmin' || (viewerRole === 'manager' && isSameTeam)) && !isSelf && u.role !== 'superadmin';

  const handleSave = async () => {
    const missingRequired = profileFields.filter(f => {
      if (!f.required) return false;
      if (f.fieldType === 'text+select') return !profileDataInput[f.id]?.trim() || !profileDataInput[`${f.id}__sel`]?.trim();
      return !profileDataInput[f.id]?.trim();
    });
    if (missingRequired.length > 0) {
      alert(`필수 항목을 입력해주세요: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }
    const parsed = parseFloat(annualLeaveStr.replace(',', '.'));
    const annualLeave = isNaN(parsed) ? DEFAULT_ANNUAL : Math.round(parsed * 100) / 100;
    const resolvedDefault = teamInput.length >= 2 && defaultTeamInput && teamInput.includes(defaultTeamInput)
      ? defaultTeamInput
      : null;
    await onUpdateInfo(u.uid, {
      displayName: nameInput.trim() || u.displayName,
      department: deptInput,
      selectedTeamIds: teamInput,
      annualLeave,
      defaultTeamId: resolvedDefault,
      workplaceId,
      profileData: profileDataInput,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setNameInput(u.displayName);
    setDeptInput(u.department);
    setTeamInput(u.selectedTeamIds ?? []);
    setDefaultTeamInput((workplaceId && u.defaultTeamIdByWorkplace?.[workplaceId]) || null);
    setAnnualLeaveStr(String(u.annualLeave ?? DEFAULT_ANNUAL));
    setProfileDataInput(u.profileData ?? {});
  };

  const userTeams = teams.filter(t => u.selectedTeamIds?.includes(t.id));

  return (
    <div className="px-4 py-3 hover:bg-black/[0.02] transition-colors">
      <div className="flex items-start gap-3">
        {u.photoURL ? (
          <img src={u.photoURL} alt={u.displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {u.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {u.displayName}{isSelf && <span className="ml-1.5 text-xs text-gray-400">(나)</span>}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium shrink-0">
                {u.annualLeave ?? DEFAULT_ANNUAL}일
              </span>
              {u.department ? <DeptBadge dept={u.department} /> : (
                <span className="text-xs text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full">미설정</span>
              )}
              {canChangeRole ? <RoleDropdown u={u} onChangeRole={onChangeRole} /> : <RoleBadge role={u.role} />}
              {canEdit && !editing && (
                <button onClick={() => setEditing(true)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                  <Pencil size={12} />
                </button>
              )}
              {editing && (
                <button onClick={handleCancel}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                  <X size={12} />
                </button>
              )}
              {canDelete && !editing && (
                <button
                  onClick={() => {
                    if (window.confirm(`${u.displayName} 사용자를 탈퇴 처리하시겠습니까?\n탈퇴 후 재로그인 시 일반 사용자로 재등록됩니다.`))
                      onDeleteUser(u.uid);
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 truncate">{u.email}</p>
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {userTeams.map(t => (
              <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                {t.emoji} {t.name}
              </span>
            ))}
            {userTeams.length === 0 && (
              <span className="text-[10px] text-gray-400 italic">무소속</span>
            )}
          </div>
        </div>
      </div>
      {editing && (
        <div className="mt-3 ml-11 space-y-2.5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">이름</label>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)}
              className="w-full max-w-xs text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">직군</label>
            <DeptSelector value={deptInput} onChange={setDeptInput} />
          </div>
          {profileFields.map(field => (
            <div key={field.id}>
              <label className="block text-xs text-gray-500 mb-1">
                {field.label}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.fieldType === 'text+select' && field.options?.length ? (
                <div className={`flex gap-1.5 max-w-xs ${field.textFirst === false ? 'flex-row-reverse' : ''}`}>
                  <input
                    value={profileDataInput[field.id] ?? ''}
                    onChange={e => setProfileDataInput(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder={field.required ? '직접 입력 (필수)' : '직접 입력'}
                    className="flex-1 min-w-0 text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <select
                    value={profileDataInput[`${field.id}__sel`] ?? ''}
                    onChange={e => setProfileDataInput(prev => ({ ...prev, [`${field.id}__sel`]: e.target.value }))}
                    className="text-sm px-2 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">{field.required ? '선택 (필수)' : '선택'}</option>
                    {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ) : field.fieldType === 'select' && field.options?.length ? (
                <select
                  value={profileDataInput[field.id] ?? ''}
                  onChange={e => setProfileDataInput(prev => ({ ...prev, [field.id]: e.target.value }))}
                  className="w-full max-w-xs text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">{field.required ? '선택 (필수)' : '선택'}</option>
                  {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.fieldType === 'date' ? (
                <DatePicker
                  value={profileDataInput[field.id] ?? ''}
                  onChange={v => setProfileDataInput(prev => ({ ...prev, [field.id]: v }))}
                  btnClassName="w-full max-w-xs text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              ) : (
                <input
                  value={profileDataInput[field.id] ?? ''}
                  onChange={e => setProfileDataInput(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={field.required ? '필수 항목' : '선택 항목'}
                  className="w-full max-w-xs text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              )}
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">소속 팀 <span className="text-gray-400 font-normal">(복수 선택 가능)</span></label>
            {teams.length === 0 ? (
              <p className="text-xs text-gray-400 italic">생성된 팀 없음</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {teams.map(t => {
                    const sel = teamInput.includes(t.id);
                    const isDefault = defaultTeamInput === t.id;
                    return (
                      <div key={t.id} className="relative">
                        <button type="button"
                          onClick={() => {
                            const next = sel ? teamInput.filter(id => id !== t.id) : [...teamInput, t.id];
                            setTeamInput(next);
                            if (sel && isDefault) setDefaultTeamInput(null);
                          }}
                          style={sel ? { backgroundColor: t.color ?? '#3b82f6', borderColor: t.color ?? '#3b82f6' } : {}}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                            sel ? `text-white ${teamInput.length >= 2 ? 'pr-7' : ''}` : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}>
                          <span>{t.emoji}</span><span>{t.name}</span>{sel && !isDefault && <Check size={11} />}
                        </button>
                        {sel && teamInput.length >= 2 && (
                          <button
                            type="button"
                            onClick={() => setDefaultTeamInput(isDefault ? null : t.id)}
                            title={isDefault ? '기본 팀 해제' : '기본 팀으로 설정'}
                            className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded transition-colors ${
                              isDefault ? 'text-yellow-300' : 'text-gray-400 hover:text-yellow-300'
                            }`}>
                            <Star size={11} fill={isDefault ? 'currentColor' : 'none'} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {teamInput.length >= 2 && (
                  <p className="mt-1 text-[11px] text-gray-400">★ 를 눌러 접속 시 기본으로 선택될 팀을 지정하세요.</p>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">연간 휴가 일수</label>
            <div className="flex items-center gap-2">
              <input
                type="number" step="0.01"
                value={annualLeaveStr}
                onChange={e => setAnnualLeaveStr(e.target.value)}
                onBlur={e => {
                  const parsed = parseFloat(e.target.value.replace(',', '.'));
                  if (!isNaN(parsed)) {
                    setAnnualLeaveStr(String(Math.round(parsed * 100) / 100));
                  } else {
                    setAnnualLeaveStr(String(DEFAULT_ANNUAL));
                  }
                }}
                className="w-24 text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-xs text-gray-400">일 <span className="text-gray-300">(0.01 단위)</span></span>
            </div>
          </div>
          <button onClick={handleSave} className="px-4 py-1.5 rounded-lg text-xs font-semibold btn-shiny-primary">저장</button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 폼 빌더
// ──────────────────────────────────────────
const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: '텍스트', select: '드롭다운', date: '날짜', number: '숫자', name: '이름', link: '링크', textarea: '이름',
};
const CUSTOM_FIELD_TYPES: FormFieldType[] = ['text', 'select', 'date', 'number', 'name', 'link'];
const BUILTIN_FIELD_TYPES: FormFieldType[] = ['text', 'select', 'date', 'number', 'name', 'link'];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`w-10 h-6 rounded-full p-0 relative transition-colors flex-shrink-0 ${on ? 'bg-blue-500' : 'bg-gray-200'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${on ? 'left-5' : 'left-1'}`} />
    </button>
  );
}

function AddFieldForm({ onAdd, parentSelectFields = [] }: {
  onAdd: (f: Omit<CustomFormField, 'id'>) => void;
  parentSelectFields?: { id: string; label: string; options: string[] }[];
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FormFieldType>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState(['', '']);
  const [optionColors, setOptionColors] = useState<Record<string, { bg: string; text: string }>>({});
  const [colorPickerIdx, setColorPickerIdx] = useState<number | null>(null);
  const [dept, setDept] = useState<Department | ''>('');
  const [dependsOnId, setDependsOnId] = useState('');
  const [valueMapInput, setValueMapInput] = useState<Record<string, string[]>>({});

  const cls = "text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400";

  const handleAdd = () => {
    if (!label.trim()) return;
    const cleanValueMap: Record<string, string[]> = {};
    Object.entries(valueMapInput).forEach(([k, v]) => { const clean = v.filter(s => s.trim()); if (clean.length) cleanValueMap[k] = clean; });
    onAdd({
      label: label.trim(), type, required,
      options: type === 'select' && !dependsOnId ? options.filter(o => o.trim()) : undefined,
      optionColors: type === 'select' && !dependsOnId && Object.keys(optionColors).length > 0 ? optionColors : undefined,
      department: type === 'name' && dept ? dept : undefined,
      dependsOn: type === 'select' && dependsOnId ? { fieldId: dependsOnId, valueMap: cleanValueMap } : undefined,
    });
    setLabel(''); setType('text'); setRequired(false); setOptions(['', '']); setOptionColors({}); setDept('');
    setDependsOnId(''); setValueMapInput({}); setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium mt-1.5 transition-colors">
      <Plus size={11} />필드 추가
    </button>
  );

  return (
    <div className="mt-2 p-3 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2.5">
      <div className="flex gap-2">
        <input className={`${cls} flex-1`} placeholder="필드명 *" value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus />
        <select className={cls} value={type} onChange={e => setType(e.target.value as FormFieldType)}>
          {CUSTOM_FIELD_TYPES.map(t => (
            <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="rounded" />
          필수
        </label>
      </div>
      {type === 'select' && !dependsOnId && (
        <div className="space-y-1">
          <p className="text-[11px] text-gray-500 font-medium">선택지 <span className="font-normal text-gray-400">· 도트 클릭으로 색상</span></p>
          {options.map((opt, i) => (
            <div key={i}>
              <div className="flex gap-1.5 items-center">
                <button type="button"
                  onClick={() => setColorPickerIdx(colorPickerIdx === i ? null : i)}
                  className={`w-4 h-4 rounded-full flex-shrink-0 hover:scale-110 transition-transform ${optionColors[opt] ? 'border border-transparent' : 'border border-dashed border-gray-400'}`}
                  style={{ backgroundColor: optionColors[opt]?.bg ?? 'white' }}
                />
                <input className={`${cls} flex-1`} placeholder={`옵션 ${i + 1}`} value={opt}
                  onChange={e => {
                    const old = options[i]; const next = e.target.value;
                    setOptions(o => o.map((v, j) => j === i ? next : v));
                    if (optionColors[old]) setOptionColors(prev => { const { [old]: c, ...rest } = prev; return next ? { ...rest, [next]: c } : rest; });
                  }} />
                {options.length > 1 && (
                  <button type="button" onClick={() => { setOptions(o => o.filter((_, j) => j !== i)); setOptionColors(prev => { const { [opt]: _, ...rest } = prev; return rest; }); }}
                    className="text-gray-300 hover:text-red-400 transition-colors"><X size={12} /></button>
                )}
              </div>
              {colorPickerIdx === i && (
                <div className="flex gap-0.5 flex-wrap mt-1 ml-5">
                  <button type="button" title="색상 없음"
                    onClick={() => { setOptionColors(prev => { const { [opt]: _, ...rest } = prev; return rest; }); setColorPickerIdx(null); }}
                    className="w-4 h-4 rounded-full bg-gray-100 border border-gray-300 text-[9px] text-gray-400 flex items-center justify-center">✕</button>
                  {STATUS_COLOR_PRESETS.map(p => (
                    <button key={p.label} type="button" title={p.label}
                      onClick={() => { setOptionColors(prev => ({ ...prev, [opt]: { bg: p.bg, text: p.text } })); setColorPickerIdx(null); }}
                      className={`w-4 h-4 rounded-full flex-shrink-0 hover:scale-110 transition-transform ${optionColors[opt]?.bg === p.bg ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ backgroundColor: p.bg, border: `1.5px solid ${p.text}` }} />
                  ))}
                  <label title="직접 선택" className="w-4 h-4 rounded-full cursor-pointer overflow-hidden flex-shrink-0 hover:scale-110 transition-transform"
                    style={{ background: 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
                    <input type="color" className="opacity-0 absolute w-0 h-0"
                      value={optionColors[opt]?.bg ?? '#ffffff'}
                      onChange={e => { const bg = e.target.value; setOptionColors(prev => ({ ...prev, [opt]: { bg, text: hexToTextColor(bg) } })); }}
                      onBlur={e => { e.stopPropagation(); setColorPickerIdx(null); }} />
                  </label>
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setOptions(o => [...o, ''])}
            className="text-xs text-blue-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors">
            <Plus size={10} />옵션 추가
          </button>
        </div>
      )}
      {type === 'name' && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-medium flex-shrink-0">직군 필터</span>
          <select className={cls} value={dept} onChange={e => setDept(e.target.value as Department | '')}>
            <option value="">전체 (직군 무관)</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
      )}
      {type === 'select' && (
        <DependsOnEditor
          dependsOnId={dependsOnId} setDependsOnId={setDependsOnId}
          valueMapInput={valueMapInput} setValueMapInput={setValueMapInput}
          parentSelectFields={parentSelectFields}
          containerClass="pt-2 border-t border-gray-100"
        />
      )}
      <div className="flex gap-2 pt-0.5">
        <button onClick={handleAdd} disabled={!label.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
          추가
        </button>
        <button onClick={() => { setOpen(false); setLabel(''); setType('text'); setRequired(false); setOptions(['', '']); setDependsOnId(''); setValueMapInput({}); }}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
          취소
        </button>
      </div>
    </div>
  );
}

// ── 연결 필드 valueMap 에디터 (공용) ──
function DependsOnEditor({ dependsOnId, setDependsOnId, valueMapInput, setValueMapInput, parentSelectFields, containerClass = '' }: {
  dependsOnId: string;
  setDependsOnId: (v: string) => void;
  valueMapInput: Record<string, string[]>;
  setValueMapInput: (v: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => void;
  parentSelectFields: { id: string; label: string; options: string[] }[];
  containerClass?: string;
}) {
  if (parentSelectFields.length === 0) return null;
  const parentOpts = parentSelectFields.find(p => p.id === dependsOnId)?.options ?? [];
  return (
    <div className={containerClass}>
      <p className="text-[10px] text-gray-500 font-medium mb-1.5">
        연결 필드 <span className="text-gray-400 font-normal">· 상위 필드 선택값에 따라 이 드롭다운 옵션 변경</span>
      </p>
      <div className="flex items-center gap-1">
        <select className="flex-1 text-[11px] px-1.5 py-0.5 rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none"
          value={dependsOnId} onChange={e => { setDependsOnId(e.target.value); setValueMapInput({}); }}>
          <option value="">연결 안 함</option>
          {parentSelectFields.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {dependsOnId && (
          <button type="button" onClick={() => { setDependsOnId(''); setValueMapInput({}); }}
            className="text-gray-300 hover:text-red-400 transition-colors"><X size={11} /></button>
        )}
      </div>
      {dependsOnId && parentOpts.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {parentOpts.map(parentVal => {
            const childOpts = valueMapInput[parentVal] ?? [''];
            return (
              <div key={parentVal} className="bg-violet-50/60 rounded-lg px-2 py-1.5">
                <p className="text-[10px] font-semibold text-gray-500 mb-1">
                  <span className="text-violet-500">"{parentVal}"</span> 선택 시 옵션
                </p>
                <div className="space-y-0.5">
                  {childOpts.map((opt, idx) => (
                    <div key={idx} className="flex gap-1 items-center">
                      <input className="flex-1 text-xs px-1.5 py-0.5 rounded border border-gray-200 bg-white focus:outline-none focus:border-violet-400"
                        placeholder={`옵션 ${idx + 1}`} value={opt}
                        onChange={e => { const v = e.target.value; setValueMapInput(prev => ({ ...prev, [parentVal]: (prev[parentVal] ?? ['']).map((o, j) => j === idx ? v : o) })); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setValueMapInput(prev => ({ ...prev, [parentVal]: [...(prev[parentVal] ?? ['']), ''] })); } }}
                      />
                      {childOpts.length > 1 && (
                        <button type="button" onClick={() => setValueMapInput(prev => ({ ...prev, [parentVal]: (prev[parentVal] ?? ['']).filter((_, j) => j !== idx) }))}
                          className="text-gray-300 hover:text-red-400 transition-colors"><X size={10} /></button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setValueMapInput(prev => ({ ...prev, [parentVal]: [...(prev[parentVal] ?? ['']), ''] }))}
                    className="text-xs text-blue-400 hover:text-blue-600 flex items-center gap-0.5 mt-0.5 transition-colors">
                    <Plus size={9} />옵션 추가
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 필드 설정 빌더 (드래그 앤 드롭 + 너비 조절) ──
function FieldConfigEditor({ fields: fieldsProp, customFields, fieldOrder, onSaveFields, onSaveCustom, onSaveOrder, onSaveDrag }: {
  fields: BuiltinFieldConfig[];
  customFields: CustomFormField[];
  fieldOrder?: string[];
  onSaveFields: (f: BuiltinFieldConfig[]) => void;
  onSaveCustom: (f: CustomFormField[]) => void;
  onSaveOrder?: (order: string[]) => void;
  onSaveDrag?: (fields: BuiltinFieldConfig[], customFields: CustomFormField[], order: string[]) => void;
}) {
  const [fields, setFields] = useState(fieldsProp);
  useEffect(() => { setFields(fieldsProp); }, [fieldsProp]);

  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  // 인라인 레이블·속성 편집 (빌트인)
  const [editingKey, setEditingKey] = useState<BuiltinFieldKey | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [typeInput, setTypeInput] = useState<FormFieldType | 'default'>('default');
  const [builtinDeptInput, setBuiltinDeptInput] = useState<Department | ''>('');

  const [builtinRequiredInput, setBuiltinRequiredInput] = useState(false);
  const [builtinOptionsInput, setBuiltinOptionsInput] = useState<string[]>(['', '']);
  const [builtinOptionColors, setBuiltinOptionColors] = useState<Record<string, { bg: string; text: string }>>({});
  const [builtinColorPickerIdx, setBuiltinColorPickerIdx] = useState<number | null>(null);
  const [builtinDependsOnId, setBuiltinDependsOnId] = useState('');
  const [builtinValueMapInput, setBuiltinValueMapInput] = useState<Record<string, string[]>>({});
  const builtinOptionColorsRef = useRef(builtinOptionColors);
  builtinOptionColorsRef.current = builtinOptionColors;

  // 인라인 편집 (커스텀 필드)
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [customTypeInput, setCustomTypeInput] = useState<FormFieldType>('text');
  const [customRequiredInput, setCustomRequiredInput] = useState(false);
  const [customDeptInput, setCustomDeptInput] = useState<Department | ''>('');
  const [customDependsOnId, setCustomDependsOnId] = useState('');
  const [customValueMapInput, setCustomValueMapInput] = useState<Record<string, string[]>>({});
  const [customOptionsInput, setCustomOptionsInput] = useState<string[]>(['', '']);
  const [customOptionColors, setCustomOptionColors] = useState<Record<string, { bg: string; text: string }>>({});
  const [customColorPickerIdx, setCustomColorPickerIdx] = useState<number | null>(null);
  const customOptionColorsRef = useRef(customOptionColors);
  customOptionColorsRef.current = customOptionColors;

  const isTableField = (key: BuiltinFieldKey) => TABLE_FIELD_KEYS.includes(key);

  // 통합 필드 리스트 (fieldOrder 적용)
  type UItem = { kind: 'builtin'; data: BuiltinFieldConfig } | { kind: 'custom'; data: CustomFormField };
  const bMap = Object.fromEntries(fields.map(f => [f.key, f]));
  const cMap = Object.fromEntries(customFields.map(f => [f.id, f]));
  const unified: UItem[] = (() => {
    const bs: UItem[] = fields.map(f => ({ kind: 'builtin', data: f }));
    const cs: UItem[] = customFields.map(f => ({ kind: 'custom', data: f }));
    if (!fieldOrder?.length) return [...bs, ...cs];
    const result: UItem[] = [];
    for (const k of fieldOrder) {
      if (k in bMap) result.push({ kind: 'builtin', data: bMap[k] });
      else if (k in cMap) result.push({ kind: 'custom', data: cMap[k] });
    }
    fields.forEach(f => { if (!fieldOrder.includes(f.key)) result.push({ kind: 'builtin', data: f }); });
    customFields.forEach(f => { if (!fieldOrder.includes(f.id)) result.push({ kind: 'custom', data: f }); });
    return result;
  })();

  const onDropUnified = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...unified];
    const [moved] = arr.splice(from, 1);
    arr.splice(toIdx, 0, moved);
    const newOrder = arr.map(u => u.kind === 'builtin' ? u.data.key : u.data.id);
    const newBuiltins = arr.filter(u => u.kind === 'builtin').map(u => (u as { kind: 'builtin'; data: BuiltinFieldConfig }).data);
    const newCustoms = arr.filter(u => u.kind === 'custom').map(u => (u as { kind: 'custom'; data: CustomFormField }).data);
    setFields(newBuiltins);
    if (onSaveDrag) {
      onSaveDrag(newBuiltins, newCustoms, newOrder);
    } else {
      onSaveFields(newBuiltins);
      onSaveCustom(newCustoms);
      onSaveOrder?.(newOrder);
    }
    dragIdxRef.current = null;
    setDragOverIdx(null);
  };

  const toggleBuiltin = (key: BuiltinFieldKey) => {
    const updated = fields.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f);
    setFields(updated);
    onSaveFields(updated);
  };

  const saveLabel = (key: BuiltinFieldKey) => {
    const trimmed = labelInput.trim();
    const resolvedType = typeInput === 'default' ? undefined : typeInput as FormFieldType;
    const isName = resolvedType === 'name' || (resolvedType as string) === 'textarea' || (resolvedType as string) === '이름';
    const isSelect = resolvedType === 'select';
    const validOpts = builtinOptionsInput.filter(o => o.trim());
    const cleanValueMap: Record<string, string[]> = {};
    Object.entries(builtinValueMapInput).forEach(([k, v]) => { const clean = v.filter(s => s.trim()); if (clean.length) cleanValueMap[k] = clean; });
    const updated = fields.map(f =>
      f.key === key ? {
        ...f,
        customLabel: trimmed || undefined,
        customType: resolvedType,
        required: builtinRequiredInput || undefined,
        department: isName && builtinDeptInput ? builtinDeptInput as Department : undefined,
        options: isSelect ? validOpts : undefined,
        optionColors: isSelect && Object.keys(builtinOptionColorsRef.current).length > 0 ? builtinOptionColorsRef.current : undefined,
        dependsOn: isSelect && builtinDependsOnId ? { fieldId: builtinDependsOnId, valueMap: cleanValueMap } : undefined,
      } : f
    );
    setFields(updated);
    onSaveFields(updated);
    setBuiltinDependsOnId('');
    setBuiltinValueMapInput({});
    setEditingKey(null);
  };

  const saveBuiltinDept = (key: BuiltinFieldKey, dept: Department | undefined) => {
    const updated = fields.map(f => {
      if (f.key !== key) return f;
      if (!dept) return { ...f, departments: undefined, department: undefined }; // 전체 = 초기화
      const cur = f.departments ?? (f.department ? [f.department] : []);
      const next = cur.includes(dept) ? cur.filter(d => d !== dept) : [...cur, dept];
      return { ...f, departments: next.length ? next : undefined, department: undefined };
    });
    setFields(updated);
    onSaveFields(updated);
  };

  const saveCustomField = (id: string) => {
    const newLabel = customLabelInput.trim();
    const validOpts = customOptionsInput.filter(o => o.trim());
    const cleanValueMap: Record<string, string[]> = {};
    Object.entries(customValueMapInput).forEach(([k, v]) => {
      const filtered = v.filter(o => o.trim());
      if (filtered.length) cleanValueMap[k] = filtered;
    });
    const updated = customFields.map(cf =>
      cf.id === id ? {
        ...cf,
        label: newLabel || cf.label,
        type: customTypeInput,
        required: customRequiredInput,
        department: customTypeInput === 'name' && customDeptInput ? customDeptInput : undefined,
        options: customTypeInput === 'select' ? validOpts : cf.options,
        optionColors: customTypeInput === 'select' && Object.keys(customOptionColorsRef.current).length > 0 ? customOptionColorsRef.current : undefined,
        dependsOn: customTypeInput === 'select' && customDependsOnId
          ? { fieldId: customDependsOnId, valueMap: cleanValueMap }
          : undefined,
      } : cf
    );
    onSaveCustom(updated);
    setEditingCustomId(null);
  };

  const toggleCustom = (id: string) => {
    onSaveCustom(customFields.map(f => f.id === id ? { ...f, enabled: f.enabled === false ? true : false } : f));
  };

  const deleteCustom = (id: string) => {
    onSaveCustom(customFields.filter(f => f.id !== id));
  };

  const addCustomField = (field: Omit<CustomFormField, 'id'>) => {
    onSaveCustom([...customFields, { ...field, id: `cf_${Date.now()}` }]);
  };

  return (
    <div className="space-y-4">
      {/* 통합 필드 목록 */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          필드
          <span className="text-gray-300 font-normal normal-case ml-1">드래그로 순서 변경 (기본·커스텀 간 이동 가능) · 이름 클릭으로 속성 수정</span>
        </p>
        <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5">
          {unified.map((item, i) => {
            const isDragOver = dragOverIdx === i;
            if (item.kind === 'builtin') {
            const fc = item.data;
            const defaultLabel = BUILTIN_FIELDS_META.find(m => m.key === fc.key)?.label ?? fc.key;
            const label = fc.customLabel ?? defaultLabel;
            const isTitle = fc.key === 'title';
            const isTypeFixed = fc.key === 'weeklyHours' || fc.key === 'revisionLevel';
            return (
              <div
                key={fc.key}
                draggable
                onDragStart={() => { dragIdxRef.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
                onDrop={() => onDropUnified(i)}
                onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                className={`${isDragOver ? 'border-t-2 border-blue-400' : ''}`}>
                {editingKey === fc.key ? (
                  /* onBlur 컨테이너: 라벨/속성 행 + 옵션 에디터를 함께 감싸 포커스 이탈 감지 */
                  <div
                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) saveLabel(fc.key); }}
                    onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button, label')) e.preventDefault(); }}
                  >
                    <div className="flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default">
                      <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                      {(() => {
                        const isFixed = fc.key === 'taskMonth' || isTitle;
                        const showIn = fc.showIn ?? (isTableField(fc.key) ? 'both' : 'detail') as 'both' | 'list' | 'detail';
                        const next = showIn === 'both' ? 'list' : showIn === 'list' ? 'detail' : 'both';
                        const label = showIn === 'list' ? '목록' : showIn === 'detail' ? '상세' : '목록+상세';
                        const color = showIn === 'list' ? 'bg-blue-50 text-blue-500 border-blue-100'
                          : showIn === 'detail' ? 'bg-violet-50 text-violet-500 border-violet-100'
                          : 'bg-sky-50 text-sky-500 border-sky-100';
                        if (isFixed) return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 border ${color}`}>{label}</span>;
                        return (
                          <button type="button" title="클릭하여 표시 위치 변경"
                            onClick={e => { e.stopPropagation(); onSaveFields(fields.map(f => f.key === fc.key ? { ...f, showIn: next } : f)); }}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 border transition-colors hover:opacity-70 ${color}`}>
                            {label}
                          </button>
                        );
                      })()}
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <input
                          autoFocus
                          className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded-md border border-blue-400 bg-white text-gray-800 focus:outline-none"
                          value={labelInput}
                          placeholder={defaultLabel}
                          onChange={e => setLabelInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveLabel(fc.key); if (e.key === 'Escape') setEditingKey(null); }}
                        />
                        {!isTypeFixed && (
                          <select
                            className="text-[11px] px-1.5 py-0.5 rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none flex-shrink-0"
                            value={typeInput}
                            onChange={e => setTypeInput(e.target.value as FormFieldType | 'default')}
                            onKeyDown={e => { if (e.key === 'Enter') saveLabel(fc.key); if (e.key === 'Escape') setEditingKey(null); }}>
                            <option value="default">기본값</option>
                            {BUILTIN_FIELD_TYPES.map(t => (
                              <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                            ))}
                          </select>
                        )}
                        {fc.key !== 'taskMonth' && !isTitle && (
                          <label className="flex items-center gap-1 flex-shrink-0 cursor-pointer select-none">
                            <input type="checkbox" checked={builtinRequiredInput} onChange={e => setBuiltinRequiredInput(e.target.checked)} className="rounded w-3 h-3 accent-red-400" />
                            <span className="text-[11px] text-gray-500">필수</span>
                          </label>
                        )}
                      </div>
                      {(fc.key === 'taskMonth' || isTitle)
                        ? <span className="text-[11px] text-gray-300 italic flex-shrink-0">고정</span>
                        : <Toggle on={fc.enabled} onToggle={() => toggleBuiltin(fc.key)} />
                      }
                    </div>
                    {/* select 타입 옵션 에디터 — onBlur 컨테이너 내부 */}
                    {typeInput === 'select' && !builtinDependsOnId && (
                      <div className="px-7 pb-2 pt-1 space-y-1 bg-blue-50/40 border-t border-blue-100/60">
                        <p className="text-[10px] text-gray-500 font-medium mb-1">선택지 <span className="font-normal text-gray-400">· 색상 도트 클릭으로 색상 설정</span></p>
                        {builtinOptionsInput.map((opt, idx) => (
                          <div key={idx}>
                            <div className="flex gap-1.5 items-center">
                              <button type="button"
                                onClick={() => setBuiltinColorPickerIdx(builtinColorPickerIdx === idx ? null : idx)}
                                className={`w-4 h-4 rounded-full flex-shrink-0 hover:scale-110 transition-transform ${builtinOptionColors[opt] ? 'border border-transparent' : 'border border-dashed border-gray-400'}`}
                                style={{ backgroundColor: builtinOptionColors[opt]?.bg ?? 'white' }}
                              />
                              <input
                                className="flex-1 text-xs px-1.5 py-0.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                                placeholder={`옵션 ${idx + 1}`}
                                value={opt}
                                onChange={e => {
                                  const old = builtinOptionsInput[idx];
                                  const next = e.target.value;
                                  setBuiltinOptionsInput(prev => prev.map((v, j) => j === idx ? next : v));
                                  if (builtinOptionColors[old]) {
                                    setBuiltinOptionColors(prev => { const { [old]: c, ...rest } = prev; return next ? { ...rest, [next]: c } : rest; });
                                  }
                                }}
                              />
                              {builtinOptionsInput.length > 1 && (
                                <button type="button" onClick={() => { setBuiltinOptionsInput(prev => prev.filter((_, j) => j !== idx)); setBuiltinOptionColors(prev => { const { [opt]: _, ...rest } = prev; return rest; }); }}
                                  className="text-gray-300 hover:text-red-400 transition-colors"><X size={11} /></button>
                              )}
                            </div>
                            {builtinColorPickerIdx === idx && (
                              <div className="flex gap-0.5 flex-wrap mt-1 ml-5">
                                <button type="button" title="색상 없음"
                                  onClick={() => { setBuiltinOptionColors(prev => { const { [opt]: _, ...rest } = prev; return rest; }); setBuiltinColorPickerIdx(null); }}
                                  className="w-4 h-4 rounded-full bg-gray-100 border border-gray-300 text-[9px] text-gray-400 flex items-center justify-center">✕</button>
                                {STATUS_COLOR_PRESETS.map(p => (
                                  <button key={p.label} type="button" title={p.label}
                                    onClick={() => { setBuiltinOptionColors(prev => ({ ...prev, [opt]: { bg: p.bg, text: p.text } })); setBuiltinColorPickerIdx(null); }}
                                    className={`w-4 h-4 rounded-full flex-shrink-0 hover:scale-110 transition-transform ${builtinOptionColors[opt]?.bg === p.bg ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                    style={{ backgroundColor: p.bg, border: `1.5px solid ${p.text}` }} />
                                ))}
                                <label title="직접 선택" className="w-4 h-4 rounded-full cursor-pointer overflow-hidden flex-shrink-0 hover:scale-110 transition-transform"
                                  style={{ background: 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
                                  <input type="color" className="opacity-0 absolute w-0 h-0"
                                    value={builtinOptionColors[opt]?.bg ?? '#ffffff'}
                                    onChange={e => { const bg = e.target.value; setBuiltinOptionColors(prev => ({ ...prev, [opt]: { bg, text: hexToTextColor(bg) } })); }}
                                    onBlur={e => { e.stopPropagation(); setBuiltinColorPickerIdx(null); }} />
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setBuiltinOptionsInput(prev => [...prev, ''])}
                          className="text-xs text-blue-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors mt-0.5">
                          <Plus size={10} />옵션 추가
                        </button>
                      </div>
                    )}
                    {typeInput === 'select' && (() => {
                      const builtinParentOpts = [
                        ...fields.filter(f => f.key !== editingKey && f.customType === 'select' && f.enabled && (f.options?.length ?? 0) > 0)
                          .map(f => ({ id: f.key, label: f.customLabel ?? (BUILTIN_FIELDS_META.find(m => m.key === f.key)?.label ?? f.key), options: f.options! })),
                        ...customFields.filter(f => f.type === 'select' && f.enabled !== false && (f.options?.length ?? 0) > 0)
                          .map(f => ({ id: f.id, label: f.label, options: f.options! })),
                      ];
                      if (builtinParentOpts.length === 0) return null;
                      return (
                        <div className="px-7 pb-2 pt-2 border-t border-blue-100/60 bg-blue-50/20">
                          <DependsOnEditor
                            dependsOnId={builtinDependsOnId} setDependsOnId={setBuiltinDependsOnId}
                            valueMapInput={builtinValueMapInput} setValueMapInput={setBuiltinValueMapInput}
                            parentSelectFields={builtinParentOpts}
                          />
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default">
                    <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                    <button
                      type="button"
                      title="클릭하여 이름 · 속성 수정"
                      onClick={() => {
                        setEditingKey(fc.key);
                        setLabelInput(fc.customLabel ?? '');
                        setBuiltinRequiredInput(fc.required ?? false);
                        setBuiltinDeptInput(fc.department ?? '');
                        setBuiltinColorPickerIdx(null);
                        // 상태 필드: 옵션 없으면 기본 4가지 상태로 자동 채움 + 드롭다운 모드 강제
                        if (fc.key === 'status' && !fc.options?.length) {
                          setTypeInput('select');
                          setBuiltinOptionsInput([...DEFAULT_STATUS_CONFIGS.map(s => s.label), '']);
                          setBuiltinOptionColors(Object.fromEntries(DEFAULT_STATUS_CONFIGS.map(s => [s.label, { bg: s.bg, text: s.text }])));
                        } else {
                          setTypeInput(fc.customType ?? 'default');
                          setBuiltinOptionsInput(fc.options?.length ? [...fc.options, ''] : ['', '']);
                          setBuiltinOptionColors(fc.optionColors ?? {});
                        }
                        setBuiltinDependsOnId(fc.dependsOn?.fieldId ?? '');
                        setBuiltinValueMapInput(fc.dependsOn?.valueMap ?? {});
                      }}
                      className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 transition-colors truncate min-w-0">
                      {label}
                      {fc.key === 'weeklyHours' && <span className="ml-1 text-[10px] text-gray-400 font-normal">(업무 목록엔 '합계'로 표시)</span>}
                      {fc.customLabel && <span className="ml-1 text-[10px] text-blue-400 font-medium">수정됨</span>}
                      {fc.customType && <span className="ml-1 text-[10px] text-violet-400 font-medium">{FIELD_TYPE_LABELS[fc.customType]}</span>}
                      {fc.required && <span className="ml-1 text-[10px] text-red-400 font-medium">필수</span>}
                      {fc.dependsOn && <span className="ml-1 text-[10px] text-violet-400 font-medium">연결됨</span>}
                    </button>
                    {/* 이름 타입 직군 pill */}
                    {(fc.customType === 'name' || (fc.customType as string) === 'textarea' || (fc.customType as string) === '이름' || fc.key === 'receiver' || fc.key === 'assignee') && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(['전체', ...DEPARTMENTS] as const).map(d => {
                          const val = d === '전체' ? undefined : d as Department;
                          const activeDepts = fc.departments ?? (fc.department ? [fc.department] : []);
                          const active = val === undefined
                            ? activeDepts.length === 0
                            : activeDepts.includes(val);
                          return (
                            <button key={d} type="button"
                              onClick={e => { e.stopPropagation(); saveBuiltinDept(fc.key, val); }}
                              className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${active ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-violet-100 hover:text-violet-600'}`}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-shrink-0 min-w-[116px] justify-end">
                      {(() => {
                        const isFixed = fc.key === 'taskMonth' || isTitle;
                        const showIn = fc.showIn ?? (isTableField(fc.key) ? 'both' : 'detail') as 'both' | 'list' | 'detail';
                        const next = showIn === 'both' ? 'list' : showIn === 'list' ? 'detail' : 'both';
                        const label = showIn === 'list' ? '목록' : showIn === 'detail' ? '상세' : '목록+상세';
                        const color = showIn === 'list' ? 'bg-blue-50 text-blue-500 border-blue-100'
                          : showIn === 'detail' ? 'bg-violet-50 text-violet-500 border-violet-100'
                          : 'bg-sky-50 text-sky-500 border-sky-100';
                        if (isFixed) return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${color}`}>{label}</span>;
                        return (
                          <button type="button" title="클릭하여 표시 위치 변경"
                            onClick={e => { e.stopPropagation(); onSaveFields(fields.map(f => f.key === fc.key ? { ...f, showIn: next } : f)); }}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border transition-colors hover:opacity-70 ${color}`}>
                            {label}
                          </button>
                        );
                      })()}
                      {(fc.key === 'taskMonth' || isTitle)
                        ? <span className="text-[11px] text-gray-300 italic">고정</span>
                        : <Toggle on={fc.enabled} onToggle={() => toggleBuiltin(fc.key)} />
                      }
                    </div>
                  </div>
                )}
              </div>
            );
            } else {
            // 커스텀 필드 행
            const cf = item.data;
            const isEditingCF = editingCustomId === cf.id;
            return (
              <div
                key={cf.id}
                draggable={!isEditingCF}
                onDragStart={() => { dragIdxRef.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
                onDrop={() => onDropUnified(i)}
                onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                className={`flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default ${isDragOver ? 'border-t-2 border-blue-400' : ''}`}>
                <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                {isEditingCF ? (
                  <div className="flex-1 min-w-0"
                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) saveCustomField(cf.id); }}
                    onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button, label')) e.preventDefault(); }}>
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded-md border border-blue-400 bg-white text-gray-800 focus:outline-none"
                        value={customLabelInput}
                        onChange={e => setCustomLabelInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCustomField(cf.id); if (e.key === 'Escape') setEditingCustomId(null); }}
                      />
                      <select
                        className="text-[11px] px-1.5 py-0.5 rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none flex-shrink-0"
                        value={customTypeInput}
                        onChange={e => setCustomTypeInput(e.target.value as FormFieldType)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCustomField(cf.id); if (e.key === 'Escape') setEditingCustomId(null); }}>
                        {CUSTOM_FIELD_TYPES.map(t => (
                          <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 flex-shrink-0 cursor-pointer select-none">
                        <input type="checkbox" checked={customRequiredInput} onChange={e => setCustomRequiredInput(e.target.checked)} className="rounded w-3 h-3 accent-red-400" />
                        <span className="text-[11px] text-gray-500">필수</span>
                      </label>
                    </div>
                    {customTypeInput === 'select' && !customDependsOnId && (
                      <div className="mt-1.5 space-y-1">
                        {customOptionsInput.map((opt, idx) => (
                          <div key={idx}>
                            <div className="flex gap-1.5 items-center">
                              <button type="button"
                                onClick={() => setCustomColorPickerIdx(customColorPickerIdx === idx ? null : idx)}
                                className={`w-4 h-4 rounded-full flex-shrink-0 hover:scale-110 transition-transform ${customOptionColors[opt] ? 'border border-transparent' : 'border border-dashed border-gray-400'}`}
                                style={{ backgroundColor: customOptionColors[opt]?.bg ?? 'white' }}
                              />
                              <input
                                className="flex-1 text-xs px-1.5 py-0.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                                placeholder={`옵션 ${idx + 1}`}
                                value={opt}
                                onChange={e => {
                                  const old = customOptionsInput[idx];
                                  const next = e.target.value;
                                  setCustomOptionsInput(prev => prev.map((v, j) => j === idx ? next : v));
                                  if (customOptionColors[old]) {
                                    setCustomOptionColors(prev => { const { [old]: c, ...rest } = prev; return next ? { ...rest, [next]: c } : rest; });
                                  }
                                }}
                              />
                              {customOptionsInput.length > 1 && (
                                <button type="button" onClick={() => { setCustomOptionsInput(prev => prev.filter((_, j) => j !== idx)); setCustomOptionColors(prev => { const { [opt]: _, ...rest } = prev; return rest; }); }}
                                  className="text-gray-300 hover:text-red-400 transition-colors"><X size={11} /></button>
                              )}
                            </div>
                            {customColorPickerIdx === idx && (
                              <div className="flex gap-0.5 flex-wrap mt-1 ml-5">
                                <button type="button" title="색상 없음"
                                  onClick={() => { setCustomOptionColors(prev => { const { [opt]: _, ...rest } = prev; return rest; }); setCustomColorPickerIdx(null); }}
                                  className="w-4 h-4 rounded-full bg-gray-100 border border-gray-300 text-[9px] text-gray-400 flex items-center justify-center">✕</button>
                                {STATUS_COLOR_PRESETS.map(p => (
                                  <button key={p.label} type="button" title={p.label}
                                    onClick={() => { setCustomOptionColors(prev => ({ ...prev, [opt]: { bg: p.bg, text: p.text } })); setCustomColorPickerIdx(null); }}
                                    className={`w-4 h-4 rounded-full flex-shrink-0 hover:scale-110 transition-transform ${customOptionColors[opt]?.bg === p.bg ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                    style={{ backgroundColor: p.bg, border: `1.5px solid ${p.text}` }} />
                                ))}
                                <label title="직접 선택" className="w-4 h-4 rounded-full cursor-pointer overflow-hidden flex-shrink-0 hover:scale-110 transition-transform"
                                  style={{ background: 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
                                  <input type="color" className="opacity-0 absolute w-0 h-0"
                                    value={customOptionColors[opt]?.bg ?? '#ffffff'}
                                    onChange={e => { const bg = e.target.value; setCustomOptionColors(prev => ({ ...prev, [opt]: { bg, text: hexToTextColor(bg) } })); }}
                                    onBlur={e => { e.stopPropagation(); setCustomColorPickerIdx(null); }} />
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setCustomOptionsInput(prev => [...prev, ''])}
                          className="text-xs text-blue-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors">
                          <Plus size={10} />옵션 추가
                        </button>
                      </div>
                    )}
                    {/* 연결 필드 설정 */}
                    {customTypeInput === 'select' && (() => {
                      const cfParentSelectFields = [
                        ...fields.filter(f => f.customType === 'select' && f.enabled && (f.options?.length ?? 0) > 0)
                          .map(f => ({ id: f.key, label: f.customLabel ?? (BUILTIN_FIELDS_META.find(m => m.key === f.key)?.label ?? f.key), options: f.options! })),
                        ...customFields.filter(f => f.type === 'select' && f.enabled !== false && f.id !== cf.id && (f.options?.length ?? 0) > 0)
                          .map(f => ({ id: f.id, label: f.label, options: f.options! })),
                      ];
                      if (cfParentSelectFields.length === 0) return null;
                      return (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <DependsOnEditor
                            dependsOnId={customDependsOnId} setDependsOnId={setCustomDependsOnId}
                            valueMapInput={customValueMapInput} setValueMapInput={setCustomValueMapInput}
                            parentSelectFields={cfParentSelectFields}
                          />
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <button
                    type="button"
                    title="클릭하여 이름 · 속성 수정"
                    onClick={() => { setEditingCustomId(cf.id); setCustomLabelInput(cf.label); const t = cf.type as string; setCustomTypeInput((t === '이름' || t === 'textarea' ? 'name' : t) as FormFieldType); setCustomRequiredInput(cf.required ?? false); setCustomDeptInput(cf.department ?? ''); setCustomDependsOnId(cf.dependsOn?.fieldId ?? ''); setCustomValueMapInput(cf.dependsOn?.valueMap ?? {}); setCustomOptionsInput(cf.options?.length ? [...cf.options, ''] : ['', '']); setCustomOptionColors(cf.optionColors ?? {}); setCustomColorPickerIdx(null); }}
                    className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 transition-colors truncate min-w-0">
                    {cf.label}
                  </button>
                )}
                <div className="flex items-center gap-1.5 flex-shrink-0 min-w-[116px] justify-end">
                  {!isEditingCF && (() => {
                    const showIn = cf.showIn ?? 'both';
                    const next = showIn === 'both' ? 'list' : showIn === 'list' ? 'detail' : 'both';
                    const label = showIn === 'list' ? '목록' : showIn === 'detail' ? '상세' : '목록+상세';
                    const color = showIn === 'list'
                      ? 'bg-blue-50 text-blue-500 border-blue-100'
                      : showIn === 'detail'
                      ? 'bg-violet-50 text-violet-500 border-violet-100'
                      : 'bg-sky-50 text-sky-500 border-sky-100';
                    return (
                      <button
                        type="button"
                        title="클릭하여 표시 위치 변경 (목록+상세 → 목록 → 상세)"
                        onClick={e => { e.stopPropagation(); onSaveCustom(customFields.map(f => f.id === cf.id ? { ...f, showIn: next } : f)); }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border transition-colors hover:opacity-70 ${color}`}>
                        {label}
                      </button>
                    );
                  })()}
                  {!isEditingCF && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{FIELD_TYPE_LABELS[cf.type as FormFieldType] ?? cf.type}</span>}
                  {((FIELD_TYPE_LABELS[cf.type as FormFieldType] ?? String(cf.type)) === '이름') && (['전체', ...DEPARTMENTS] as const).map(d => {
                    const val = d === '전체' ? undefined : d as Department;
                    const activeDeptsCF = cf.departments ?? (cf.department ? [cf.department] : []);
                    const active = val === undefined ? activeDeptsCF.length === 0 : activeDeptsCF.includes(val);
                    return (
                      <button key={d} type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onSaveCustom(customFields.map(f => {
                            if (f.id !== cf.id) return f;
                            if (!val) return { ...f, departments: undefined, department: undefined };
                            const cur = f.departments ?? (f.department ? [f.department] : []);
                            const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
                            return { ...f, departments: next.length ? next : undefined, department: undefined };
                          }));
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${active ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-violet-100 hover:text-violet-600'}`}>
                        {d}
                      </button>
                    );
                  })}
                  {cf.required && <span className="text-[10px] text-red-400 font-medium">필수</span>}
                  {cf.dependsOn && <span className="text-[10px] text-violet-400 font-medium">연결됨</span>}
                  <Toggle on={cf.enabled !== false} onToggle={() => toggleCustom(cf.id)} />
                  <button onClick={() => deleteCustom(cf.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"><X size={11} /></button>
                </div>
              </div>
            );
            }
          })}
        </div>
      </div>

      {/* 커스텀 필드 추가 */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">커스텀 필드</p>
        <AddFieldForm onAdd={addCustomField} parentSelectFields={[
          ...fields.filter(f => f.customType === 'select' && f.enabled && (f.options?.length ?? 0) > 0)
            .map(f => ({ id: f.key, label: f.customLabel ?? (BUILTIN_FIELDS_META.find(m => m.key === f.key)?.label ?? f.key), options: f.options! })),
          ...customFields.filter(f => f.type === 'select' && f.enabled !== false && (f.options?.length ?? 0) > 0)
            .map(f => ({ id: f.id, label: f.label, options: f.options! })),
        ]} />
      </div>
    </div>
  );
}

function FormBuilder({ team, onUpdateFormConfig, onUpdateAllFormConfig, onClearAllFormConfig, onUpdatePartFormConfig, onClearPartFormConfig, onUpdateTeam, onUpdatePartTaskListTwoLine, onClearPartTaskListTwoLine }: {
  team: Team;
  onUpdateFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onUpdateAllFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onClearAllFormConfig: (teamId: string) => Promise<void>;
  onUpdatePartFormConfig: (teamId: string, partId: string, config: TeamFormConfig) => Promise<void>;
  onClearPartFormConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdateTeam: (teamId: string, data: Partial<Omit<Team, 'id'>>) => Promise<void>;
  onUpdatePartTaskListTwoLine: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartTaskListTwoLine: (teamId: string, partId: string) => Promise<void>;
}) {
  // 선택된 편집 대상: 'team' | 'all' | 파트 ID
  const [selectedTarget, setSelectedTarget] = useState<'team' | 'all' | string>('team');
  const [flash, setFlash] = useState<'saved' | 'reset' | null>(null);
  const doFlash = (type: 'saved' | 'reset') => { setFlash(type); setTimeout(() => setFlash(null), 1500); };
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [pendingCopySource, setPendingCopySource] = useState<string | null>(null);

  const isAllTarget = selectedTarget === 'all';
  const currentPart = (selectedTarget !== 'team' && selectedTarget !== 'all')
    ? team.parts.find(p => p.id === selectedTarget)
    : undefined;

  // 현재 편집 대상의 formConfig
  // 전체: allFormConfig (없으면 파트 합집합 fallback), 파트: 파트 formConfig (없으면 팀 상속)
  const partsUnionConfig = team.parts.length > 0
    ? mergeAllPartsConfig(team.parts, team.formConfig)
    : team.formConfig;
  const rawConfig = isAllTarget
    ? (team.allFormConfig ?? partsUnionConfig)
    : (currentPart?.formConfig ?? team.formConfig);
  const isInherited = isAllTarget
    ? !team.allFormConfig
    : (selectedTarget !== 'team' && !currentPart?.formConfig);

  const fields = resolveBuiltinFields(rawConfig);
  const customFields = rawConfig?.customFields ?? [];

  const makeConfig = (overrides: Partial<TeamFormConfig>): TeamFormConfig => ({
    builtinFields: fields,
    customFields,
    statusConfigs: rawConfig?.statusConfigs,
    fieldOrder: rawConfig?.fieldOrder,
    ...overrides,
  });

  const saveConfig = (config: TeamFormConfig) => {
    if (selectedTarget === 'team') onUpdateFormConfig(team.id, config);
    else if (isAllTarget) onUpdateAllFormConfig(team.id, config);
    else onUpdatePartFormConfig(team.id, selectedTarget, config);
  };

  const saveFields = (newFields: BuiltinFieldConfig[]) => saveConfig(makeConfig({ builtinFields: newFields }));
  const saveCustom = (newCustom: CustomFormField[]) => saveConfig(makeConfig({ customFields: newCustom }));
  const saveOrder = (order: string[]) => saveConfig(makeConfig({ fieldOrder: order }));
  // 드래그 순서 변경 시 builtinFields + customFields + fieldOrder를 한 번에 저장 (경쟁 조건 방지)
  const saveDrag = (newFields: BuiltinFieldConfig[], newCustom: CustomFormField[], newOrder: string[]) =>
    saveConfig({ ...makeConfig({}), builtinFields: newFields, customFields: newCustom, fieldOrder: newOrder });

  const executeCopyForm = (sourceId: string) => {
    if (sourceId === 'all') {
      const srcConfig = team.allFormConfig ?? team.formConfig;
      if (srcConfig) saveConfig(srcConfig);
    } else {
      const sourcePart = sourceId !== 'team' ? team.parts.find(p => p.id === sourceId) : undefined;
      const srcConfig = sourcePart ? (sourcePart.formConfig ?? team.formConfig) : team.formConfig;
      if (srcConfig) saveConfig(srcConfig);
    }
    setPendingCopySource(null);
  };

  const handleCopyFrom = (sourceId: string) => {
    setShowCopyMenu(false);
    setPendingCopySource(sourceId);
  };

  return (
    <div className="space-y-4">
      {/* 적용 대상 선택 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">적용 대상</p>
          <div className="flex flex-wrap gap-1.5">
            {(['team', 'all', ...team.parts.map(p => p.id)] as ('team' | 'all' | string)[]).map(target => {
              const isTeam = target === 'team';
              const isAll = target === 'all';
              const part = (!isTeam && !isAll) ? team.parts.find(p => p.id === target) : null;
              const hasOwn = isAll ? !!team.allFormConfig : (!isTeam && !!part?.formConfig);
              return (
                <button
                  key={target}
                  onClick={() => setSelectedTarget(target)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedTarget === target
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeam ? '팀 기본' : isAll ? '전체' : part?.name}
                  {hasOwn && (
                    <span className={`text-[10px] px-1 rounded ${selectedTarget === target ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      별도
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 상속 안내 + 초기화 */}
      {isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">
            {isAllTarget
              ? '팀 기본 설정 상속 중 — 아래 필드를 수정하면 전체 뷰만 다르게 저장됩니다'
              : '팀 기본 설정 상속 중 — 아래 필드를 수정하면 이 파트만 다르게 저장됩니다'}
          </p>
        </div>
      )}
      {!isInherited && selectedTarget !== 'team' && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">
            {isAllTarget ? '전체 뷰 별도 설정이 적용 중' : '이 파트의 별도 설정이 적용 중'}
          </p>
          {flash ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold ml-3 flex-shrink-0">
              <Check size={11} />{flash === 'saved' ? '팀 기본 저장됨' : '초기화됨'}
            </span>
          ) : (
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              {!isAllTarget && (
                <button
                  onClick={() => { if (rawConfig) { onUpdateFormConfig(team.id, rawConfig); doFlash('saved'); } }}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                  <ArrowUpToLine size={11} />팀 기본으로 지정
                </button>
              )}
              <button
                onClick={() => {
                  if (isAllTarget) { onClearAllFormConfig(team.id); doFlash('reset'); }
                  else { onClearPartFormConfig(team.id, selectedTarget); doFlash('reset'); }
                }}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
                <RotateCcw size={11} />초기화
              </button>
            </div>
          )}
        </div>
      )}

      {/* 복사 */}
      {selectedTarget !== 'team' && (
        <div className="relative">
          <button
            onClick={() => setShowCopyMenu(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors">
            <Copy size={11} />다른 설정에서 복사
            <ChevronDown size={10} />
          </button>
          {showCopyMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCopyMenu(false)} />
              <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-20">
                <div className="px-2.5 py-1.5 text-[10px] text-gray-400 font-semibold uppercase border-b border-gray-100">복사 원본 선택</div>
                <button
                  onClick={() => handleCopyFrom('team')}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                  팀 기본
                </button>
                {selectedTarget !== 'all' && team.allFormConfig && (
                  <button
                    onClick={() => handleCopyFrom('all')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                    전체
                  </button>
                )}
                {team.parts.filter(p => p.id !== selectedTarget).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleCopyFrom(p.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 복사 확인 배너 */}
      {pendingCopySource !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200">
          <p className="text-xs text-orange-700 flex-1">
            <span className="font-semibold">
              '{pendingCopySource === 'team' ? '팀 기본' : pendingCopySource === 'all' ? '전체' : team.parts.find(p => p.id === pendingCopySource)?.name}'
            </span>의 설정을 복사하면 현재 설정이 덮어씌워집니다.
          </p>
          <button
            onClick={() => setPendingCopySource(null)}
            className="text-xs text-orange-600 hover:text-orange-800 font-medium flex-shrink-0 px-2 py-0.5">취소</button>
          <button
            onClick={() => executeCopyForm(pendingCopySource!)}
            className="text-xs bg-orange-500 text-white px-2.5 py-0.5 rounded-lg font-medium hover:bg-orange-600 flex-shrink-0">덮어쓰기</button>
        </div>
      )}

      {/* 업무관리 목록 2줄 구성 */}
      {(() => {
        const isTeamOrAll = selectedTarget === 'team' || isAllTarget;
        const twoLineInherited = !isTeamOrAll && currentPart?.taskListTwoLine === undefined;
        const twoLineEffective = isTeamOrAll
          ? (team.taskListTwoLine ?? false)
          : (currentPart?.taskListTwoLine ?? team.taskListTwoLine ?? false);
        return (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-700">업무관리 목록 2줄 구성</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                켜면 목록에서 월+업무명만 1줄, 나머지 필드(순서는 위 설정 그대로)는 2줄에 배치됩니다
                {!isTeamOrAll && (twoLineInherited ? ' — 팀 기본값 상속 중' : ' — 이 파트에 별도로 지정된 값')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isTeamOrAll && !twoLineInherited && (
                <button
                  onClick={() => currentPart && onClearPartTaskListTwoLine(team.id, currentPart.id)}
                  className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                  <RotateCcw size={10} />팀 기본으로
                </button>
              )}
              <PermToggle
                checked={twoLineEffective}
                onChange={() => {
                  if (isTeamOrAll) onUpdateTeam(team.id, { taskListTwoLine: !twoLineEffective });
                  else if (currentPart) onUpdatePartTaskListTwoLine(team.id, currentPart.id, !twoLineEffective);
                }}
              />
            </div>
          </div>
        );
      })()}

      <FieldConfigEditor
        fields={fields}
        customFields={customFields}
        fieldOrder={rawConfig?.fieldOrder}
        onSaveFields={saveFields}
        onSaveCustom={saveCustom}
        onSaveOrder={saveOrder}
        onSaveDrag={saveDrag}
      />
    </div>
  );
}

// ──────────────────────────────────────────
// 팀 관리 섹션
// ──────────────────────────────────────────
// 업무 정보 필드 편집기 (팀 탭 내)
// ──────────────────────────────────────────
function MetaFieldsEditor({ team, onSave, onSavePart, onClearPart }: {
  team: Team;
  onSave: (teamId: string, fields: MetaField[]) => Promise<void>;
  onSavePart: (teamId: string, partId: string, fields: MetaField[]) => Promise<void>;
  onClearPart: (teamId: string, partId: string) => Promise<void>;
}) {
  // selectedTarget: 'team' | partId
  const [selectedTarget, setSelectedTarget] = useState<'team' | string>('team');
  const [flash, setFlash] = useState<'saved' | 'reset' | null>(null);
  const doFlash = (type: 'saved' | 'reset') => { setFlash(type); setTimeout(() => setFlash(null), 1500); };
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newIsUrl, setNewIsUrl] = useState(false);
  const [newIsPath, setNewIsPath] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [pendingCopySource, setPendingCopySource] = useState<string | null>(null);

  useEffect(() => { setSelectedTarget('team'); setEditingKey(null); }, [team.id]);

  const isTeam = selectedTarget === 'team';
  const currentPart = !isTeam ? team.parts.find(p => p.id === selectedTarget) : undefined;
  const isInherited = !isTeam && !currentPart?.metaFields;
  const teamFields: MetaField[] = team.metaFields ?? DEFAULT_META_FIELDS;
  const fields: MetaField[] = isTeam ? teamFields : (currentPart?.metaFields ?? teamFields);

  const save = (next: MetaField[]) => {
    if (isTeam) onSave(team.id, next);
    else if (currentPart) onSavePart(team.id, currentPart.id, next);
  };

  const onDrop = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...fields];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    save(arr);
    dragIdxRef.current = null; setDragOverIdx(null);
  };

  const saveLabel = (key: string) => {
    const label = labelInput.trim();
    if (label) save(fields.map(f => f.key === key ? { ...f, label } : f));
    setEditingKey(null);
  };

  const toggleUrl = (key: string) => save(fields.map(f => f.key === key ? { ...f, isUrl: !f.isUrl, isPath: false } : f));
  const togglePath = (key: string) => save(fields.map(f => f.key === key ? { ...f, isPath: !f.isPath, isUrl: false } : f));
  const deleteField = (key: string) => save(fields.filter(f => f.key !== key));
  const addField = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = label.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now();
    save([...fields, { key, label, isUrl: newIsUrl, isPath: newIsPath }]);
    setNewLabel(''); setNewIsUrl(false); setNewIsPath(false);
  };

  const iCls = "flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  const executeCopyMeta = (sourceId: string) => {
    const sourcePart = sourceId !== 'team' ? team.parts.find(p => p.id === sourceId) : undefined;
    const srcFields = sourcePart ? (sourcePart.metaFields ?? (team.metaFields ?? DEFAULT_META_FIELDS)) : (team.metaFields ?? DEFAULT_META_FIELDS);
    if (currentPart) onSavePart(team.id, currentPart.id, srcFields);
    setPendingCopySource(null);
  };

  const handleCopyFrom = (sourceId: string) => {
    setShowCopyMenu(false);
    setPendingCopySource(sourceId);
  };

  return (
    <div className="space-y-4">
      {/* 적용 대상 — 폼 설정과 동일 구조 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">적용 대상</p>
          <div className="flex flex-wrap gap-1.5">
            {(['team', ...team.parts.map(p => p.id)] as ('team' | string)[]).map(target => {
              const isTeamBtn = target === 'team';
              const part = !isTeamBtn ? team.parts.find(p => p.id === target) : null;
              const hasOwn = !isTeamBtn && !!part?.metaFields;
              return (
                <button key={target}
                  onClick={() => { setSelectedTarget(target); setEditingKey(null); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedTarget === target
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {!isTeamBtn && part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeamBtn ? '팀 기본' : part?.name}
                  {hasOwn && (
                    <span className={`text-[10px] px-1 rounded ${selectedTarget === target ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      별도
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 상속 안내 */}
      {isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">팀 기본 설정을 상속 중</p>
          <button onClick={() => currentPart && onSavePart(team.id, currentPart.id, teamFields)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium ml-3 flex-shrink-0">
            <ArrowDownToLine size={11} />팀 기본 가져오기
          </button>
        </div>
      )}
      {!isTeam && !isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">이 파트의 별도 설정이 적용 중</p>
          {flash ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold ml-3 flex-shrink-0">
              <Check size={11} />{flash === 'saved' ? '팀 기본 저장됨' : '초기화됨'}
            </span>
          ) : (
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <button onClick={() => { onSave(team.id, fields); doFlash('saved'); }}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                <ArrowUpToLine size={11} />팀 기본으로 지정
              </button>
              <button onClick={() => { if (currentPart) { onClearPart(team.id, currentPart.id); setSelectedTarget('team'); doFlash('reset'); } }}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
                <RotateCcw size={11} />초기화
              </button>
            </div>
          )}
        </div>
      )}

      {/* 복사 */}
      {selectedTarget !== 'team' && (
        <div className="relative">
          <button
            onClick={() => setShowCopyMenu(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors">
            <Copy size={11} />다른 설정에서 복사
            <ChevronDown size={10} />
          </button>
          {showCopyMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCopyMenu(false)} />
              <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-20">
                <div className="px-2.5 py-1.5 text-[10px] text-gray-400 font-semibold uppercase border-b border-gray-100">복사 원본 선택</div>
                <button
                  onClick={() => handleCopyFrom('team')}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                  팀 기본
                </button>
                {team.parts.filter(p => p.id !== selectedTarget).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleCopyFrom(p.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 복사 확인 배너 */}
      {pendingCopySource !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200">
          <p className="text-xs text-orange-700 flex-1">
            <span className="font-semibold">
              '{pendingCopySource === 'team' ? '팀 기본' : team.parts.find(p => p.id === pendingCopySource)?.name}'
            </span>의 설정을 복사하면 현재 설정이 덮어씌워집니다.
          </p>
          <button
            onClick={() => setPendingCopySource(null)}
            className="text-xs text-orange-600 hover:text-orange-800 font-medium flex-shrink-0 px-2 py-0.5">취소</button>
          <button
            onClick={() => executeCopyMeta(pendingCopySource!)}
            className="text-xs bg-orange-500 text-white px-2.5 py-0.5 rounded-lg font-medium hover:bg-orange-600 flex-shrink-0">덮어쓰기</button>
        </div>
      )}

      {/* 필드 목록 */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          기본 필드
          <span className="text-gray-300 font-normal normal-case ml-1">드래그로 순서 · 이름 클릭으로 수정</span>
        </p>
        <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5">
          {fields.map((f, i) => (
            <div key={f.key} draggable
              onDragStart={() => { dragIdxRef.current = i; }}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
              onDrop={() => onDrop(i)}
              onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
              className={`flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default ${dragOverIdx === i ? 'border-t-2 border-blue-400' : ''}`}>
              <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
              {editingKey === f.key ? (
                <input autoFocus
                  className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded-md border border-blue-400 bg-white text-gray-800 focus:outline-none"
                  value={labelInput} onChange={e => setLabelInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveLabel(f.key); if (e.key === 'Escape') setEditingKey(null); }}
                  onBlur={() => saveLabel(f.key)} />
              ) : (
                <button type="button" title="클릭하여 이름 수정"
                  onClick={() => { setEditingKey(f.key); setLabelInput(f.label); }}
                  className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 transition-colors truncate min-w-0">
                  {f.label}
                </button>
              )}
              <button type="button" onClick={() => toggleUrl(f.key)}
                className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${f.isUrl ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                URL
              </button>
              <button type="button" onClick={() => togglePath(f.key)}
                className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${f.isPath ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                경로
              </button>
              <button type="button" onClick={() => deleteField(f.key)}
                className="text-gray-300 hover:text-red-400 transition-colors ml-0.5">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input className={iCls} placeholder="새 항목 이름" value={newLabel}
            onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addField()} />
          <button type="button" onClick={() => { setNewIsUrl(v => !v); setNewIsPath(false); }}
            className={`flex-shrink-0 text-[10px] px-2 py-1.5 rounded-md font-medium transition-colors ${newIsUrl ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
            URL
          </button>
          <button type="button" onClick={() => { setNewIsPath(v => !v); setNewIsUrl(false); }}
            className={`flex-shrink-0 text-[10px] px-2 py-1.5 rounded-md font-medium transition-colors ${newIsPath ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
            경로
          </button>
          <button onClick={addField} disabled={!newLabel.trim()}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
            <Plus size={11} />추가
          </button>
        </div>
        {isTeam && (
          <button onClick={() => save(DEFAULT_META_FIELDS)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
            <RotateCcw size={11} /> 기본값으로 초기화
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// 세부 업무 유형 편집기
// ──────────────────────────────────────────
const SUBTASK_DEPT_COLOR: Record<string, string> = {
  '기획': 'bg-violet-100 text-violet-700',
  '디자인': 'bg-pink-100 text-pink-700',
  '퍼블': 'bg-teal-100 text-teal-700',
};

const SUBTASK_CALENDAR_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#10b981',
  '#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899',
  '#f43f5e','#fb923c','#facc15','#4ade80','#34d399',
  '#22d3ee','#60a5fa','#818cf8','#a78bfa','#f472b6',
];

function SubTaskTypesEditor({ team, onSave, onSavePart, onClearPart }: {
  team: Team;
  onSave: (teamId: string, types: SubTaskType[]) => Promise<void>;
  onSavePart: (teamId: string, partId: string, types: SubTaskType[]) => Promise<void>;
  onClearPart: (teamId: string, partId: string) => Promise<void>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<'team' | string>('team');
  const [flash, setFlash] = useState<'saved' | 'reset' | null>(null);
  const doFlash = (type: 'saved' | 'reset') => { setFlash(type); setTimeout(() => setFlash(null), 1500); };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState<Department | ''>('');
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [pendingCopySource, setPendingCopySource] = useState<string | null>(null);

  useEffect(() => { setSelectedTarget('team'); setEditingId(null); }, [team.id]);

  const isTeam = selectedTarget === 'team';
  const currentPart = !isTeam ? team.parts.find(p => p.id === selectedTarget) : undefined;
  const isInherited = !isTeam && !currentPart?.subTaskTypes;
  const teamTypes: SubTaskType[] = team.subTaskTypes ?? [];
  const types: SubTaskType[] = isTeam ? teamTypes : (currentPart?.subTaskTypes ?? teamTypes);

  const save = (next: SubTaskType[]) => {
    if (isTeam) onSave(team.id, next);
    else if (currentPart) onSavePart(team.id, currentPart.id, next);
  };

  const onDrop = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...types];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    save(arr);
    dragIdxRef.current = null; setDragOverIdx(null);
  };

  const saveName = (id: string) => {
    const name = nameInput.trim();
    if (name) save(types.map(t => t.id === id ? { ...t, name } : t));
    setEditingId(null);
  };

  const toggleDept = (id: string, dept: Department) => {
    save(types.map(t => t.id === id ? { ...t, department: t.department === dept ? undefined : dept } : t));
  };

  const deleteType = (id: string) => save(types.filter(t => t.id !== id));

  const addType = () => {
    const name = newName.trim();
    if (!name) return;
    save([...types, { id: `st_${Date.now()}`, name, department: newDept || undefined }]);
    setNewName(''); setNewDept('');
  };

  const iCls = "text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  const executeCopySubTask = (sourceId: string) => {
    const sourcePart = sourceId !== 'team' ? team.parts.find(p => p.id === sourceId) : undefined;
    const srcTypes = sourcePart ? (sourcePart.subTaskTypes ?? (team.subTaskTypes ?? [])) : (team.subTaskTypes ?? []);
    if (currentPart) onSavePart(team.id, currentPart.id, srcTypes);
    setPendingCopySource(null);
  };

  const handleCopyFrom = (sourceId: string) => {
    setShowCopyMenu(false);
    setPendingCopySource(sourceId);
  };

  return (
    <div className="space-y-4">
      {/* 적용 대상 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">적용 대상</p>
          <div className="flex flex-wrap gap-1.5">
            {(['team', ...team.parts.map(p => p.id)] as ('team' | string)[]).map(target => {
              const isTeamBtn = target === 'team';
              const part = !isTeamBtn ? team.parts.find(p => p.id === target) : null;
              const hasOwn = !isTeamBtn && !!part?.subTaskTypes;
              return (
                <button key={target}
                  onClick={() => { setSelectedTarget(target); setEditingId(null); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedTarget === target
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {!isTeamBtn && part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeamBtn ? '팀 기본' : part?.name}
                  {hasOwn && (
                    <span className={`text-[10px] px-1 rounded ${selectedTarget === target ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      별도
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 상속 안내 */}
      {isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">팀 기본 설정을 상속 중 — 변경하면 이 파트만 다르게 저장됩니다</p>
          <button onClick={() => currentPart && onClearPart(team.id, currentPart.id)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />초기화
          </button>
        </div>
      )}
      {!isTeam && !isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">이 파트의 별도 설정이 적용 중</p>
          {flash ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold ml-3 flex-shrink-0">
              <Check size={11} />{flash === 'saved' ? '팀 기본 저장됨' : '초기화됨'}
            </span>
          ) : (
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <button onClick={() => { onSave(team.id, types); doFlash('saved'); }}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                <ArrowUpToLine size={11} />팀 기본으로 지정
              </button>
              <button onClick={() => { if (currentPart) { onClearPart(team.id, currentPart.id); setSelectedTarget('team'); doFlash('reset'); } }}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
                <RotateCcw size={11} />초기화
              </button>
            </div>
          )}
        </div>
      )}

      {/* 복사 */}
      {selectedTarget !== 'team' && (
        <div className="relative">
          <button
            onClick={() => setShowCopyMenu(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors">
            <Copy size={11} />다른 설정에서 복사
            <ChevronDown size={10} />
          </button>
          {showCopyMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCopyMenu(false)} />
              <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-20">
                <div className="px-2.5 py-1.5 text-[10px] text-gray-400 font-semibold uppercase border-b border-gray-100">복사 원본 선택</div>
                <button
                  onClick={() => handleCopyFrom('team')}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                  팀 기본
                </button>
                {team.parts.filter(p => p.id !== selectedTarget).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleCopyFrom(p.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 복사 확인 배너 */}
      {pendingCopySource !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200">
          <p className="text-xs text-orange-700 flex-1">
            <span className="font-semibold">
              '{pendingCopySource === 'team' ? '팀 기본' : team.parts.find(p => p.id === pendingCopySource)?.name}'
            </span>의 설정을 복사하면 현재 설정이 덮어씌워집니다.
          </p>
          <button
            onClick={() => setPendingCopySource(null)}
            className="text-xs text-orange-600 hover:text-orange-800 font-medium flex-shrink-0 px-2 py-0.5">취소</button>
          <button
            onClick={() => executeCopySubTask(pendingCopySource!)}
            className="text-xs bg-orange-500 text-white px-2.5 py-0.5 rounded-lg font-medium hover:bg-orange-600 flex-shrink-0">덮어쓰기</button>
        </div>
      )}

      <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        세부 업무 목록
        <span className="text-gray-300 font-normal normal-case ml-1">드래그로 순서 · 이름 클릭으로 수정</span>
      </p>
      {types.length > 0 ? (
        <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5">
          {types.map((t, i) => (
            <div key={t.id}>
              <div draggable
                onDragStart={() => { dragIdxRef.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
                onDrop={() => onDrop(i)}
                onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                className={`flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default ${dragOverIdx === i ? 'border-t-2 border-blue-400' : ''}`}>
                <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                {editingId === t.id ? (
                  <input autoFocus
                    className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded-md border border-blue-400 bg-white text-gray-800 focus:outline-none"
                    value={nameInput} onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(t.id); if (e.key === 'Escape') setEditingId(null); }}
                    onBlur={() => saveName(t.id)} />
                ) : (
                  <button type="button"
                    onClick={() => { setEditingId(t.id); setNameInput(t.name); }}
                    className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 transition-colors truncate min-w-0">
                    {t.name}
                  </button>
                )}
                {/* 직군 토글 버튼 */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {(['기획', '디자인', '퍼블'] as Department[]).map(d => (
                    <button key={d} type="button"
                      onClick={() => toggleDept(t.id, d)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                        t.department === d
                          ? SUBTASK_DEPT_COLOR[d]
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-100'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
                {/* 캘린더 표시 토글 */}
                <button
                  type="button"
                  title={t.showInCalendar === false ? '캘린더 미표시 (클릭하여 표시)' : '캘린더 표시 (클릭하여 숨김)'}
                  onClick={() => save(types.map(x => x.id === t.id ? { ...x, showInCalendar: x.showInCalendar === false ? true : false } : x))}
                  className={`flex items-center justify-center w-5 h-5 rounded transition-colors ml-0.5 ${
                    t.showInCalendar === false
                      ? 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-400'
                      : 'bg-blue-100 text-blue-500 hover:bg-blue-200 hover:text-blue-600'
                  }`}>
                  <CalendarDays size={11} />
                </button>
                {/* 업무 상세 노출 토글 */}
                <button
                  type="button"
                  title={t.showInDetail === false ? '업무 상세 미노출 (클릭하여 노출)' : '업무 상세 노출 (클릭하여 숨김)'}
                  onClick={() => save(types.map(x => x.id === t.id ? { ...x, showInDetail: x.showInDetail === false ? true : false } : x))}
                  className={`flex items-center justify-center w-5 h-5 rounded transition-colors ml-0.5 ${
                    t.showInDetail === false
                      ? 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-400'
                      : 'bg-emerald-100 text-emerald-500 hover:bg-emerald-200 hover:text-emerald-600'
                  }`}>
                  <FileText size={11} />
                </button>
                <button type="button" onClick={() => deleteType(t.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors ml-0.5">
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-3">등록된 세부 업무가 없습니다</p>
      )}
      {/* 추가 폼 */}
      <div className="flex items-center gap-2">
        <input className={`${iCls} flex-1 min-w-0`}
          placeholder="세부업무명 입력"
          value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addType()} />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(['기획', '디자인', '퍼블'] as Department[]).map(d => (
            <button key={d} type="button"
              onClick={() => setNewDept(prev => prev === d ? '' : d)}
              className={`text-[10px] px-1.5 py-1.5 rounded-md font-medium transition-colors ${
                newDept === d
                  ? SUBTASK_DEPT_COLOR[d]
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-100'
              }`}>
              {d}
            </button>
          ))}
        </div>
        <button onClick={addType} disabled={!newName.trim()}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
          <Plus size={11} />추가
        </button>
      </div>
      </div>
    </div>
  );
}

function RevisionStepsEditor({ team, onSave, onSavePart, onClearPart }: {
  team: Team;
  onSave: (teamId: string, steps: RevisionStep[]) => Promise<void>;
  onSavePart: (teamId: string, partId: string, steps: RevisionStep[]) => Promise<void>;
  onClearPart: (teamId: string, partId: string) => Promise<void>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<'team' | string>('team');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'code' | 'label' | null>(null);
  const [fieldInput, setFieldInput] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  useEffect(() => { setSelectedTarget('team'); setEditingId(null); setEditingField(null); }, [team.id]);

  const isTeam = selectedTarget === 'team';
  const currentPart = !isTeam ? team.parts.find(p => p.id === selectedTarget) : undefined;
  const isInherited = !isTeam && !currentPart?.revisionSteps;
  const teamSteps: RevisionStep[] = team.revisionSteps ?? DEFAULT_REVISION_STEPS;
  const steps: RevisionStep[] = normalizeRevisionSteps(isTeam ? teamSteps : (currentPart?.revisionSteps ?? teamSteps));

  const save = (next: RevisionStep[]) => {
    if (isTeam) onSave(team.id, next);
    else if (currentPart) onSavePart(team.id, currentPart.id, next);
  };

  const onDrop = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...steps];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    save(arr);
    dragIdxRef.current = null; setDragOverIdx(null);
  };

  const startEdit = (id: string, field: 'code' | 'label', value: string) => {
    setEditingId(id); setEditingField(field); setFieldInput(value);
  };

  const saveField = () => {
    if (!editingId || !editingField) return;
    const value = fieldInput.trim();
    if (value) save(steps.map(s => s.id === editingId ? { ...s, [editingField]: value } : s));
    setEditingId(null); setEditingField(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditingField(null); };

  const deleteStep = (id: string) => save(steps.filter(s => s.id !== id));

  const addStep = () => {
    const label = newLabel.trim();
    if (!label) return;
    const nums = steps.map(s => { const m = /^F(\d+)$/.exec(s.id); return m ? parseInt(m[1], 10) : 0; });
    const nextNum = Math.max(0, ...nums) + 1;
    save([...steps, { id: `F${nextNum}`, code: `F${nextNum}`, label }]);
    setNewLabel('');
  };

  return (
    <div className="space-y-4">
      {/* 적용 대상 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">적용 대상</p>
          <div className="flex flex-wrap gap-1.5">
            {(['team', ...team.parts.map(p => p.id)] as ('team' | string)[]).map(target => {
              const isTeamBtn = target === 'team';
              const part = !isTeamBtn ? team.parts.find(p => p.id === target) : null;
              const hasOwn = !isTeamBtn && !!part?.revisionSteps;
              return (
                <button key={target}
                  onClick={() => { setSelectedTarget(target); setEditingId(null); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedTarget === target
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {!isTeamBtn && part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeamBtn ? '팀 기본' : part?.name}
                  {hasOwn && (
                    <span className={`text-[10px] px-1 rounded ${selectedTarget === target ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      별도
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 상속 안내 */}
      {isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">팀 기본 설정을 상속 중 — 변경하면 이 파트만 다르게 저장됩니다</p>
          <button onClick={() => currentPart && onClearPart(team.id, currentPart.id)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />초기화
          </button>
        </div>
      )}
      {!isTeam && !isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">이 파트의 별도 설정이 적용 중</p>
          <button onClick={() => { currentPart && onClearPart(team.id, currentPart.id); }}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />팀 기본으로
          </button>
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          수정단계 목록
          <span className="text-gray-300 font-normal normal-case ml-1">드래그로 순서 · 이름 클릭으로 수정</span>
        </p>
        {steps.length > 0 ? (
          <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5">
            {steps.map((s, i) => (
              <div key={s.id}
                draggable
                onDragStart={() => { dragIdxRef.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
                onDrop={() => onDrop(i)}
                onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                className={`flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default ${dragOverIdx === i ? 'border-t-2 border-blue-400' : ''}`}>
                <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                {editingId === s.id && editingField === 'code' ? (
                  <input autoFocus
                    className="w-12 min-w-0 flex-shrink-0 text-[10px] font-bold text-center px-1 py-0.5 rounded-md border border-blue-400 bg-white text-gray-800 focus:outline-none"
                    value={fieldInput} onChange={e => setFieldInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') cancelEdit(); }}
                    onBlur={saveField} />
                ) : (
                  <button type="button"
                    onClick={() => startEdit(s.id, 'code', s.code)}
                    title="뱃지 텍스트 수정"
                    className="text-[10px] font-bold text-white bg-blue-500 hover:bg-blue-600 rounded px-1.5 py-0.5 flex-shrink-0 min-w-7 text-center transition-colors">
                    {s.code}
                  </button>
                )}
                {editingId === s.id && editingField === 'label' ? (
                  <input autoFocus
                    className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded-md border border-blue-400 bg-white text-gray-800 focus:outline-none"
                    value={fieldInput} onChange={e => setFieldInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') cancelEdit(); }}
                    onBlur={saveField} />
                ) : (
                  <button type="button"
                    onClick={() => startEdit(s.id, 'label', s.label)}
                    className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 transition-colors truncate min-w-0">
                    {s.label}
                  </button>
                )}
                <button type="button" onClick={() => deleteStep(s.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors ml-0.5">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-3">등록된 수정단계가 없습니다</p>
        )}
        {/* 추가 폼 */}
        <div className="flex items-center gap-2 mt-2">
          <input className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="수정단계 설명 입력"
            value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStep()} />
          <button onClick={addStep} disabled={!newLabel.trim()}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
            <Plus size={11} />추가
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarDisplayEditor({ team, onSaveTypes, onSavePartTypes, onUpdateTeam, onSavePartCalendarOrder, onClearPartCalendarOrder, onUpdatePartPLShowInCalendar, onClearPartPLShowInCalendar, onUpdatePartMainTaskEndDateLabel, onClearPartMainTaskEndDateLabel, onUpdatePartMainTaskEndDateShow, onClearPartMainTaskEndDateShow, onUpdatePartMainTaskEndDateColor, onClearPartMainTaskEndDateColor }: {
  team: Team;
  onSaveTypes: (teamId: string, types: SubTaskType[]) => Promise<void>;
  onSavePartTypes: (teamId: string, partId: string, types: SubTaskType[]) => Promise<void>;
  onUpdateTeam: (teamId: string, data: Partial<Omit<Team, 'id'>>) => Promise<void>;
  onSavePartCalendarOrder: (teamId: string, partId: string, order: string[]) => Promise<void>;
  onClearPartCalendarOrder: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartPLShowInCalendar: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartPLShowInCalendar: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateLabel: (teamId: string, partId: string, label: string) => Promise<void>;
  onClearPartMainTaskEndDateLabel: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateShow: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartMainTaskEndDateShow: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateColor: (teamId: string, partId: string, color: string) => Promise<void>;
  onClearPartMainTaskEndDateColor: (teamId: string, partId: string) => Promise<void>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<'team' | string>('team');
  const [colorPickingId, setColorPickingId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  useEffect(() => { setSelectedTarget('team'); setColorPickingId(null); }, [team.id]);

  const isTeam = selectedTarget === 'team';
  const currentPart = !isTeam ? team.parts.find(p => p.id === selectedTarget) : undefined;
  const teamTypes: SubTaskType[] = team.subTaskTypes ?? [];
  const allTypes: SubTaskType[] = isTeam ? teamTypes : (currentPart?.subTaskTypes ?? teamTypes);
  const visibleTypes = allTypes.filter(t => t.showInCalendar !== false);

  const isOrderInherited = !isTeam && !currentPart?.calendarOrder;
  const savedOrder: string[] | undefined = isTeam ? team.calendarOrder : (currentPart?.calendarOrder ?? team.calendarOrder);
  const orderedTypes: SubTaskType[] = (() => {
    const base = savedOrder ?? visibleTypes.map(t => t.id);
    const known = new Set(visibleTypes.map(t => t.id));
    const ordered = base.filter(id => known.has(id));
    const missing = visibleTypes.map(t => t.id).filter(id => !ordered.includes(id));
    return [...ordered, ...missing].map(id => visibleTypes.find(t => t.id === id)!).filter(Boolean);
  })();

  const saveOrder = (next: SubTaskType[]) => {
    const order = next.map(t => t.id);
    if (isTeam) onUpdateTeam(team.id, { calendarOrder: order });
    else if (currentPart) onSavePartCalendarOrder(team.id, currentPart.id, order);
  };

  const onDrop = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...orderedTypes];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    saveOrder(arr);
    dragIdxRef.current = null; setDragOverIdx(null);
  };

  const saveColor = (id: string, color: string | undefined) => {
    const next = allTypes.map(t => t.id === id ? { ...t, calendarColor: color } : t);
    if (isTeam) onSaveTypes(team.id, next);
    else if (currentPart) onSavePartTypes(team.id, currentPart.id, next);
  };

  const plInherited = !isTeam && currentPart?.plShowInCalendar === undefined;
  const plShowEffective = isTeam
    ? (team.plShowInCalendar ?? true)
    : (currentPart?.plShowInCalendar ?? team.plShowInCalendar ?? true);

  const endShowInherited = !isTeam && currentPart?.mainTaskEndDateShow === undefined;
  const endShowEffective = isTeam
    ? (team.mainTaskEndDateShow ?? false)
    : (currentPart?.mainTaskEndDateShow ?? team.mainTaskEndDateShow ?? false);

  const endLabelInherited = !isTeam && currentPart?.mainTaskEndDateLabel === undefined;
  const endLabelValue = isTeam ? (team.mainTaskEndDateLabel ?? '') : (currentPart?.mainTaskEndDateLabel ?? '');
  const saveEndLabel = (label: string) => {
    if (isTeam) onUpdateTeam(team.id, { mainTaskEndDateLabel: label });
    else if (currentPart) onUpdatePartMainTaskEndDateLabel(team.id, currentPart.id, label);
  };

  useEffect(() => { setLabelDraft(endLabelValue); }, [endLabelValue]);

  const endColorInherited = !isTeam && currentPart?.mainTaskEndDateColor === undefined;
  const endColorValue = isTeam ? (team.mainTaskEndDateColor || undefined) : (currentPart?.mainTaskEndDateColor || team.mainTaskEndDateColor || undefined);
  const saveEndColor = (color: string | undefined) => {
    if (isTeam) onUpdateTeam(team.id, { mainTaskEndDateColor: color ?? '' });
    else if (currentPart) onUpdatePartMainTaskEndDateColor(team.id, currentPart.id, color ?? '');
  };

  return (
    <div className="space-y-4">
      {/* 적용 대상 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">적용 대상</p>
          <div className="flex flex-wrap gap-1.5">
            {(['team', ...team.parts.map(p => p.id)] as ('team' | string)[]).map(target => {
              const isTeamBtn = target === 'team';
              const part = !isTeamBtn ? team.parts.find(p => p.id === target) : null;
              const hasOwn = !isTeamBtn && !!part?.calendarOrder;
              return (
                <button key={target}
                  onClick={() => { setSelectedTarget(target); setColorPickingId(null); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedTarget === target
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {!isTeamBtn && part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeamBtn ? '팀 기본' : part?.name}
                  {hasOwn && (
                    <span className={`text-[10px] px-1 rounded ${selectedTarget === target ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      별도
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 캘린더 표시 방식 (팀 전체 설정) */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
        <div>
          <p className="text-xs font-semibold text-gray-700">캘린더 표시 방식</p>
          <p className="text-[10px] text-gray-400 mt-0.5">캘린더 하루 칸 안에서 업무를 어떤 기준으로 묶어 정렬할지 팀 전체에 적용됩니다</p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5 flex-shrink-0">
          <button
            onClick={() => onUpdateTeam(team.id, { calendarGroupBy: 'task' })}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              (team.calendarGroupBy ?? 'task') === 'task' ? 'bg-[#6C63FF] text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >메인 업무순</button>
          <button
            onClick={() => onUpdateTeam(team.id, { calendarGroupBy: 'subtaskType' })}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              team.calendarGroupBy === 'subtaskType' ? 'bg-[#6C63FF] text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >세부 업무별</button>
        </div>
      </div>

      {/* PL업무 캘린더 표시 여부 */}
      {!!team.plMainTaskTypes?.length && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-700">PL업무 캘린더 표시</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {isTeam
                ? 'PL업무로 등록한 세부업무를 캘린더에 표시할지 팀 기본값을 정합니다'
                : plInherited
                  ? '팀 기본값을 상속 중 — 바꾸면 이 파트만 별도로 저장됩니다'
                  : '이 파트에 별도로 지정된 값이 적용 중입니다'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isTeam && !plInherited && (
              <button
                onClick={() => currentPart && onClearPartPLShowInCalendar(team.id, currentPart.id)}
                className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                <RotateCcw size={10} />팀 기본으로
              </button>
            )}
            <PermToggle
              checked={plShowEffective}
              onChange={() => {
                if (isTeam) onUpdateTeam(team.id, { plShowInCalendar: !plShowEffective });
                else if (currentPart) onUpdatePartPLShowInCalendar(team.id, currentPart.id, !plShowEffective);
              }}
            />
          </div>
        </div>
      )}

      {/* 메인업무 종료일 캘린더 표시 */}
      <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700">메인업무 종료일 표시</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              켜면 업무 종료일 캘린더 칸 맨 위에 '명칭 · 업무명'으로 표시됩니다 (예: 방송일)
              {!isTeam && (endShowInherited ? ' — 표시 여부는 팀 기본값 상속 중' : ' — 이 파트에 별도로 지정된 값')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isTeam && !endShowInherited && (
              <button
                onClick={() => currentPart && onClearPartMainTaskEndDateShow(team.id, currentPart.id)}
                className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                <RotateCcw size={10} />팀 기본으로
              </button>
            )}
            <PermToggle
              checked={endShowEffective}
              onChange={() => {
                if (isTeam) onUpdateTeam(team.id, { mainTaskEndDateShow: !endShowEffective });
                else if (currentPart) onUpdatePartMainTaskEndDateShow(team.id, currentPart.id, !endShowEffective);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder={isTeam ? '표시 명칭 (예: 방송일, 비우면 "종료일")' : `팀 기본값: ${team.mainTaskEndDateLabel || '종료일'} (비워두면 상속)`}
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onBlur={() => saveEndLabel(labelDraft)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <button
            type="button"
            title="배지 색상 선택"
            onClick={() => setColorPickingId(colorPickingId === '__mainEndDate__' ? null : '__mainEndDate__')}
            style={{
              width: 20, height: 20, borderRadius: '50%', padding: 0, cursor: 'pointer', flexShrink: 0,
              backgroundColor: endColorValue ?? '#e5e7eb',
              border: endColorValue ? `2px solid ${endColorValue}` : '1.5px dashed #9ca3af',
              outline: colorPickingId === '__mainEndDate__' ? '2px solid #6366f1' : 'none',
              outlineOffset: 1,
            }}
          />
          {!isTeam && !endLabelInherited && (
            <button
              onClick={() => currentPart && onClearPartMainTaskEndDateLabel(team.id, currentPart.id)}
              className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium flex-shrink-0">
              <RotateCcw size={10} />명칭 초기화
            </button>
          )}
        </div>
        {colorPickingId === '__mainEndDate__' && (
          <div className="px-3 py-2 bg-white rounded-lg border border-gray-200">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 18px)', gap: 4, alignItems: 'center' }}>
              <button
                type="button"
                title="파트 색상 자동 사용"
                onClick={() => { saveEndColor(undefined); setColorPickingId(null); }}
                style={{
                  width: 18, height: 18, borderRadius: '50%', padding: 0, cursor: 'pointer',
                  backgroundColor: '#e5e7eb', border: '1.5px dashed #9ca3af',
                  outline: !endColorValue ? '2px solid #6b7280' : 'none', outlineOffset: 1,
                }}
              />
              {SUBTASK_CALENDAR_COLORS.map(hex => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => { saveEndColor(hex); setColorPickingId(null); }}
                  style={{
                    width: 18, height: 18, borderRadius: '50%', padding: 0, cursor: 'pointer',
                    backgroundColor: hex, border: 'none',
                    outline: endColorValue === hex ? '2px solid #374151' : 'none', outlineOffset: 1,
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-gray-400">
                점선 원 = 파트 색상 자동 사용{!isTeam && (endColorInherited ? ' · 팀 기본값 상속 중' : ' · 이 파트에 별도로 지정된 색상')}
              </p>
              {!isTeam && !endColorInherited && (
                <button
                  onClick={() => { currentPart && onClearPartMainTaskEndDateColor(team.id, currentPart.id); setColorPickingId(null); }}
                  className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium flex-shrink-0">
                  <RotateCcw size={10} />팀 기본으로
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 색상 · 순서 (캘린더 표시로 설정된 세부업무만) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            캘린더 노출 항목
            <span className="text-gray-300 font-normal normal-case ml-1">드래그로 순서 · 색상 클릭으로 지정</span>
          </p>
          {!isTeam && !isOrderInherited && (
            <button
              onClick={() => currentPart && onClearPartCalendarOrder(team.id, currentPart.id)}
              className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium flex-shrink-0">
              <RotateCcw size={10} />팀 기본 순서로
            </button>
          )}
        </div>
        {isOrderInherited && (
          <p className="text-[10px] text-amber-600 mb-1.5">팀 기본 캘린더 순서를 상속 중 — 순서를 바꾸면 이 파트만 별도로 저장됩니다</p>
        )}
        {orderedTypes.length > 0 ? (
          <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5">
            {orderedTypes.map((t, i) => (
              <div key={t.id}>
                <div draggable
                  onDragStart={() => { dragIdxRef.current = i; }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
                  onDrop={() => onDrop(i)}
                  onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                  className={`flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default ${dragOverIdx === i ? 'border-t-2 border-blue-400' : ''}`}>
                  <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                  <span className="flex-1 text-xs text-gray-700 truncate min-w-0">{t.name}</span>
                  <button
                    type="button"
                    title="캘린더 표시 색상 선택"
                    onClick={() => setColorPickingId(colorPickingId === t.id ? null : t.id)}
                    style={{
                      width: 16, height: 16, borderRadius: '50%', padding: 0, cursor: 'pointer', flexShrink: 0,
                      backgroundColor: t.calendarColor ?? '#e5e7eb',
                      border: t.calendarColor ? `2px solid ${t.calendarColor}` : '1.5px dashed #9ca3af',
                      outline: colorPickingId === t.id ? '2px solid #6366f1' : 'none',
                      outlineOffset: 1,
                    }}
                  />
                </div>
                {colorPickingId === t.id && (
                  <div className="px-3 py-2 bg-gray-50 border-t border-black/5">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 18px)', gap: 4, alignItems: 'center' }}>
                      <button
                        type="button"
                        title="기본값으로 초기화"
                        onClick={() => { saveColor(t.id, undefined); setColorPickingId(null); }}
                        style={{
                          width: 18, height: 18, borderRadius: '50%', padding: 0, cursor: 'pointer',
                          backgroundColor: '#e5e7eb', border: '1.5px dashed #9ca3af',
                          outline: !t.calendarColor ? '2px solid #6b7280' : 'none', outlineOffset: 1,
                        }}
                      />
                      {SUBTASK_CALENDAR_COLORS.map(hex => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => { saveColor(t.id, hex); setColorPickingId(null); }}
                          style={{
                            width: 18, height: 18, borderRadius: '50%', padding: 0, cursor: 'pointer',
                            backgroundColor: hex, border: 'none',
                            outline: t.calendarColor === hex ? '2px solid #374151' : 'none', outlineOffset: 1,
                            boxSizing: 'border-box',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">점선 원 = 기본색으로 초기화</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-6">
            캘린더에 표시로 설정된 세부 업무가 없습니다<br />
            <span className="text-gray-300">'세부 업무' 탭에서 캘린더 표시를 켜주세요</span>
          </p>
        )}
      </div>
    </div>
  );
}

const PL_FIELD_TYPE_LABEL: Record<PLSubTaskFieldType, string> = { text: '텍스트', review: '검수' };
const PL_FIELD_TYPE_COLOR: Record<PLSubTaskFieldType, string> = {
  text: 'bg-gray-100 text-gray-600',
  review: 'bg-violet-100 text-violet-600',
};

function PLSubFieldsEditor({ fields, onChange }: { fields: PLSubTaskField[]; onChange: (f: PLSubTaskField[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [newName, setNewName] = useState('');
  const [newFieldType, setNewFieldType] = useState<PLSubTaskFieldType>('text');
  const [newDepts, setNewDepts] = useState<Department[]>([]);
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const iCls = "text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  const save = (next: PLSubTaskField[]) => onChange(next);
  const saveName = (id: string) => {
    const name = nameInput.trim();
    if (name) save(fields.map(f => f.id === id ? { ...f, name } : f));
    setEditingId(null);
  };
  const toggleFieldType = (id: string) => save(fields.map(f => f.id === id ? { ...f, fieldType: f.fieldType === 'text' ? 'review' : 'text' } : f));
  const toggleDept = (id: string, dept: Department) => {
    save(fields.map(f => {
      if (f.id !== id) return f;
      const cur = (f.departments?.length ? f.departments : f.department ? [f.department] : []);
      const next = cur.includes(dept) ? cur.filter(d => d !== dept) : [...cur, dept];
      return { ...f, departments: next.length ? next : undefined, department: undefined };
    }));
  };
  const deleteField = (id: string) => save(fields.filter(f => f.id !== id));
  const addField = () => {
    const name = newName.trim();
    if (!name) return;
    save([...fields, { id: `plf_${Date.now()}`, name, fieldType: newFieldType, departments: newDepts.length ? newDepts : undefined }]);
    setNewName(''); setNewDepts([]);
  };
  const onDrop = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...fields];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    save(arr);
    dragIdxRef.current = null; setDragOverIdx(null);
  };

  return (
    <div className="ml-5 mt-2 space-y-2 pb-2">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">세부업무 필드</p>
      {fields.length > 0 && (
        <div className="rounded-lg border border-black/7 overflow-hidden divide-y divide-black/5">
          {fields.map((f, i) => (
            <div key={f.id}
              draggable
              onDragStart={() => { dragIdxRef.current = i; }}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
              onDrop={() => onDrop(i)}
              onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
              className={`flex items-center gap-1.5 py-1.5 px-2 hover:bg-black/2 cursor-default ${dragOverIdx === i ? 'border-t-2 border-blue-400' : ''}`}>
              <GripVertical size={11} className="text-gray-300 cursor-grab flex-shrink-0" />
              {editingId === f.id ? (
                <input autoFocus className="flex-1 min-w-0 text-xs px-1 py-0.5 rounded border border-blue-400 bg-white focus:outline-none"
                  value={nameInput} onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(f.id); if (e.key === 'Escape') setEditingId(null); }}
                  onBlur={() => saveName(f.id)} />
              ) : (
                <button type="button" onClick={() => { setEditingId(f.id); setNameInput(f.name); }}
                  className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 truncate min-w-0">
                  {f.name}
                </button>
              )}
              <button type="button" onClick={() => toggleFieldType(f.id)}
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${PL_FIELD_TYPE_COLOR[f.fieldType]}`}>
                {PL_FIELD_TYPE_LABEL[f.fieldType]}
              </button>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {(['기획', '디자인', '퍼블'] as Department[]).map(d => {
                  const cur = f.departments?.length ? f.departments : f.department ? [f.department] : [];
                  return (
                    <button key={d} type="button" onClick={() => toggleDept(f.id, d)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${cur.includes(d) ? SUBTASK_DEPT_COLOR[d] : 'bg-gray-100 text-gray-400'}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => deleteField(f.id)} className="text-gray-300 hover:text-red-400 ml-0.5"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input className={`${iCls} flex-1 min-w-0`} placeholder="세부업무명"
          value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addField()} />
        <button type="button" onClick={() => setNewFieldType(t => t === 'text' ? 'review' : 'text')}
          className={`text-[10px] px-1.5 py-1 rounded-md font-medium flex-shrink-0 ${PL_FIELD_TYPE_COLOR[newFieldType]}`}>
          {PL_FIELD_TYPE_LABEL[newFieldType]}
        </button>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(['기획', '디자인', '퍼블'] as Department[]).map(d => (
            <button key={d} type="button"
              onClick={() => setNewDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
              className={`text-[10px] px-1.5 py-1 rounded-md font-medium ${newDepts.includes(d) ? SUBTASK_DEPT_COLOR[d] : 'bg-gray-100 text-gray-400'}`}>
              {d}
            </button>
          ))}
        </div>
        <button onClick={addField} disabled={!newName.trim()}
          className="flex-shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40">
          <Plus size={10} />추가
        </button>
      </div>
    </div>
  );
}

function PLMainTaskTypesEditor({ team, onSave }: {
  team: Team;
  onSave: (teamId: string, types: PLMainTaskType[]) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [newName, setNewName] = useState('');
  const [newDepts, setNewDepts] = useState<Department[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  useEffect(() => { setEditingId(null); setExpandedId(null); }, [team.id]);

  const types: PLMainTaskType[] = team.plMainTaskTypes ?? [];
  const save = (next: PLMainTaskType[]) => onSave(team.id, next);

  const onDrop = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...types];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    save(arr);
    dragIdxRef.current = null; setDragOverIdx(null);
  };

  const saveName = (id: string) => {
    const name = nameInput.trim();
    if (name) save(types.map(t => t.id === id ? { ...t, name } : t));
    setEditingId(null);
  };

  const toggleDept = (id: string, dept: Department) => {
    save(types.map(t => {
      if (t.id !== id) return t;
      const cur = resolvePLMainDepts(t);
      const next = cur.includes(dept) ? cur.filter(d => d !== dept) : [...cur, dept];
      return { ...t, departments: next.length ? next : undefined, department: undefined };
    }));
  };

  const deleteType = (id: string) => save(types.filter(t => t.id !== id));

  const updateSubFields = (id: string, subFields: PLSubTaskField[]) => {
    save(types.map(t => t.id === id ? { ...t, subFields } : t));
  };

  const addType = () => {
    const name = newName.trim();
    if (!name) return;
    const newId = `pl_${Date.now()}`;
    save([...types, { id: newId, name, departments: newDepts.length ? newDepts : undefined }]);
    setNewName(''); setNewDepts([]);
    setExpandedId(newId);
  };

  const iCls = "text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">PL업무 등록 시 선택할 수 있는 메인업무 항목과 각 항목의 세부업무 필드를 설정합니다.</p>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          메인업무 목록
          <span className="text-gray-300 font-normal normal-case ml-1">클릭으로 세부업무 펼침 · 이름 더블클릭으로 수정</span>
        </p>
        {types.length > 0 ? (
          <div className="rounded-xl border border-black/7 overflow-hidden">
            {types.map((t, i) => (
              <div key={t.id} className={`${i > 0 ? 'border-t border-black/5' : ''} ${dragOverIdx === i ? 'border-t-2 border-blue-400' : ''}`}>
                {/* 메인 행 */}
                <div draggable
                  onDragStart={() => { dragIdxRef.current = i; }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
                  onDrop={() => onDrop(i)}
                  onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                  className={`flex items-center gap-1.5 py-1 px-2 transition-colors ${expandedId === t.id ? 'bg-blue-50/60' : 'hover:bg-black/2'}`}>
                  <GripVertical size={12} className="text-gray-300 cursor-grab flex-shrink-0" />
                  {/* 펼침 토글 — 아이콘 + 업무명 묶어서 클릭 */}
                  <button type="button"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className={`flex items-center gap-1 flex-1 min-w-0 text-left transition-colors ${expandedId === t.id ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>
                    {expandedId === t.id
                      ? <ChevronDown size={12} className="flex-shrink-0" />
                      : <ChevronRight size={12} className="flex-shrink-0" />}
                    {editingId === t.id ? (
                      <input autoFocus
                        className="flex-1 min-w-0 text-xs px-1 py-0 rounded border border-blue-400 bg-white text-gray-800 focus:outline-none"
                        value={nameInput} onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveName(t.id); if (e.key === 'Escape') setEditingId(null); }}
                        onBlur={() => saveName(t.id)}
                        onClick={e => e.stopPropagation()} />
                    ) : (
                      <span
                        onDoubleClick={e => { e.stopPropagation(); setEditingId(t.id); setNameInput(t.name); }}
                        className="text-xs font-medium text-gray-700 truncate min-w-0 select-none">
                        {t.name}
                      </span>
                    )}
                  </button>
                  {t.subFields && t.subFields.length > 0 && (
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-100 text-blue-500 font-medium flex-shrink-0 tabular-nums">
                      {t.subFields.length}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {(['기획', '디자인', '퍼블'] as Department[]).map(d => (
                      <button key={d} type="button" onClick={() => toggleDept(t.id, d)}
                        className={`text-[10px] px-1.5 py-px rounded font-medium transition-colors ${
                          resolvePLMainDepts(t).includes(d) ? SUBTASK_DEPT_COLOR[d] : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => deleteType(t.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5 flex-shrink-0">
                    <X size={11} />
                  </button>
                </div>
                {/* 세부업무 편집 패널 */}
                {expandedId === t.id && (
                  <div className="bg-blue-50/30 border-t border-blue-100">
                    <PLSubFieldsEditor
                      fields={t.subFields ?? []}
                      onChange={subFields => updateSubFields(t.id, subFields)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-3">등록된 메인업무 항목이 없습니다</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <input className={`${iCls} flex-1 min-w-0`}
            placeholder="메인업무명 입력"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addType()} />
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {(['기획', '디자인', '퍼블'] as Department[]).map(d => (
              <button key={d} type="button"
                onClick={() => setNewDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                className={`text-[10px] px-1.5 py-1.5 rounded-md font-medium transition-colors ${
                  newDepts.includes(d) ? SUBTASK_DEPT_COLOR[d] : 'bg-gray-100 text-gray-400 hover:bg-gray-100'
                }`}>
                {d}
              </button>
            ))}
          </div>
          <button onClick={addType} disabled={!newName.trim()}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
            <Plus size={11} />추가
          </button>
        </div>
      </div>
    </div>
  );
}

function HolidayEditor({ customHolidays, onSave, canEdit }: {
  customHolidays: CustomHoliday[];
  onSave: (holidays: CustomHoliday[]) => Promise<void>;
  canEdit: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const { holidays: publicHolidays, loading } = usePublicHolidays(currentYear);
  const [dateInput, setDateInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const addHoliday = () => {
    const date = dateInput.trim();
    const name = nameInput.trim();
    if (!date || !name) return;
    const newH: CustomHoliday = { id: `h_${Date.now()}`, date, name, createdAt: new Date().toISOString() };
    onSave([...customHolidays, newH]);
    setDateInput(''); setNameInput('');
  };

  const deleteHoliday = (id: string) => onSave(customHolidays.filter(h => h.id !== id));

  const allHolidays = [
    ...publicHolidays.map(h => ({ date: h.date, name: h.name, isCustom: false, id: '' })),
    ...customHolidays.map(h => ({ date: h.date, name: h.name, isCustom: true, id: h.id })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const iCls = "text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          {currentYear}년 휴일 목록
          {loading && <span className="text-gray-300 font-normal ml-1">불러오는 중…</span>}
        </p>
        {allHolidays.length > 0 ? (
          <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5 max-h-60 overflow-y-auto">
            {allHolidays.map((h, i) => (
              <div key={h.isCustom ? h.id : `pub_${i}`}
                className="flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors">
                <span className="text-xs text-gray-500 font-mono w-24 flex-shrink-0">{h.date}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">{h.name}</span>
                {h.isCustom ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium flex-shrink-0">추가</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-400 font-medium flex-shrink-0">공휴일</span>
                )}
                {h.isCustom && canEdit && (
                  <button type="button" onClick={() => deleteHoliday(h.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors ml-0.5">
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          !loading && <p className="text-xs text-gray-400 text-center py-3">공휴일 정보를 불러올 수 없습니다</p>
        )}
      </div>

      {canEdit && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">추가 휴일 등록</p>
          <div className="flex items-center gap-2">
            <DatePicker value={dateInput} onChange={setDateInput}
              btnClassName="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-32" />
            <input className={`${iCls} flex-1 min-w-0`}
              placeholder="휴일명 입력"
              value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHoliday()} />
            <button onClick={addHoliday} disabled={!dateInput || !nameInput.trim()}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
              <Plus size={11} />추가
            </button>
          </div>
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-gray-400 text-center py-1">추가 휴일 등록은 중간 관리자 이상만 가능합니다</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 위클리 내보내기 컬럼 관리
// ──────────────────────────────────────────
const WEEKLY_COL_LABELS: Record<string, string> = {
  new: '신규 (0/1)',
  derived: '파생 (0/1)',
  other: '기타 (0/1)',
  hours: '업무시간',
  desc: '업무설명',
  empty: '빈칸',
};

const DEFAULT_WEEKLY_EXPORT_COLS: WeeklyColumnDef[] = [
  { id: 'new', type: 'new', enabled: true },
  { id: 'derived', type: 'derived', enabled: true },
  { id: 'other', type: 'other', enabled: true },
  { id: 'hours', type: 'hours', enabled: true },
  { id: 'empty_1', type: 'empty', enabled: true },
  { id: 'empty_2', type: 'empty', enabled: true },
  { id: 'desc', type: 'desc', enabled: true },
];

function WeeklyExportManager({ team, onSave, onSavePart, onClearPart }: {
  team: Team;
  onSave: (cfg: WeeklyExportConfig) => Promise<void>;
  onSavePart: (teamId: string, partId: string, cfg: WeeklyExportConfig) => Promise<void>;
  onClearPart: (teamId: string, partId: string) => Promise<void>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<'team' | string>('team');
  const [colMode, setColMode] = useState<'normal' | 'substitute'>('normal');
  const isTeamTarget = selectedTarget === 'team';
  const currentPart = !isTeamTarget ? team.parts.find(p => p.id === selectedTarget) : undefined;
  const isInherited = !isTeamTarget && !currentPart?.weeklyExportConfig;

  const allMetaFields = currentPart?.metaFields ?? team.metaFields ?? DEFAULT_META_FIELDS;

  const getEffectiveConfigObj = (): WeeklyExportConfig | undefined =>
    isTeamTarget ? team.weeklyExportConfig : currentPart?.weeklyExportConfig;

  const getEffectiveNormalCols = () => {
    if (isTeamTarget) return team.weeklyExportConfig?.columns ?? DEFAULT_WEEKLY_EXPORT_COLS;
    return currentPart?.weeklyExportConfig?.columns ?? team.weeklyExportConfig?.columns ?? DEFAULT_WEEKLY_EXPORT_COLS;
  };

  // 대무 항목 전용 설정이 없으면 (해당 팀/파트의) 일반 항목 설정을 그대로 상속
  const getEffectiveSubstituteCols = () => getEffectiveConfigObj()?.substituteColumns ?? getEffectiveNormalCols();

  const hasOwnSubstituteConfig = !!getEffectiveConfigObj()?.substituteColumns;

  const getEffectiveCols = () => colMode === 'normal' ? getEffectiveNormalCols() : getEffectiveSubstituteCols();

  const [cols, setCols] = useState<WeeklyColumnDef[]>(getEffectiveCols);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<'saved' | 'reset' | null>(null);

  useEffect(() => {
    setCols(getEffectiveCols());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTarget, colMode, team.id, team.weeklyExportConfig, currentPart?.weeklyExportConfig]);

  useEffect(() => { setSelectedTarget('team'); setColMode('normal'); }, [team.id]);

  const doSave = async (next: WeeklyColumnDef[]) => {
    setSaving(true);
    const base = getEffectiveConfigObj();
    const newConfig: WeeklyExportConfig = colMode === 'normal'
      ? (base?.substituteColumns ? { columns: next, substituteColumns: base.substituteColumns } : { columns: next })
      : { columns: base?.columns ?? getEffectiveNormalCols(), substituteColumns: next };
    if (isTeamTarget) await onSave(newConfig);
    else if (currentPart) await onSavePart(team.id, currentPart.id, newConfig);
    setSaving(false);
    setFlash('saved');
    setTimeout(() => setFlash(null), 1500);
  };

  const clearSubstituteOverride = async () => {
    setSaving(true);
    const base = getEffectiveConfigObj();
    const newConfig: WeeklyExportConfig = { columns: base?.columns ?? getEffectiveNormalCols() };
    if (isTeamTarget) await onSave(newConfig);
    else if (currentPart) await onSavePart(team.id, currentPart.id, newConfig);
    setCols(getEffectiveNormalCols());
    setSaving(false);
    setFlash('reset');
    setTimeout(() => setFlash(null), 1500);
  };

  const toggle = (id: string) => {
    const next = cols.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c);
    setCols(next);
    doSave(next);
  };

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) return;
    const next = [...cols];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, moved);
    setCols(next);
    setDragIdx(null); setDragOverIdx(null);
    doSave(next);
  };

  // 빈칸 행의 타입을 인라인으로 변경
  const handleChangeColType = (colId: string, value: string) => {
    let next: WeeklyColumnDef[];
    if (value === '__empty__') {
      next = cols.map(c => c.id === colId ? { ...c, type: 'empty' as const, metaKey: undefined } : c);
    } else {
      const field = allMetaFields.find(f => f.key === value);
      if (!field) return;
      if (cols.some(c => c.id !== colId && c.type === 'meta' && c.metaKey === value)) return;
      next = cols.map(c => c.id === colId ? { ...c, type: 'meta' as const, metaKey: field.key } : c);
    }
    setCols(next);
    doSave(next);
  };

  const handleAddEmpty = () => {
    const existingIds = cols.map(c => c.id);
    let n = 1;
    while (existingIds.includes(`empty_${n}`)) n++;
    const next = [...cols, { id: `empty_${n}`, type: 'empty' as const, enabled: true }];
    setCols(next);
    doSave(next);
  };

  const removeCol = (id: string) => {
    const next = cols.filter(c => c.id !== id);
    setCols(next);
    doSave(next);
  };

  const resetToDefault = () => {
    if (colMode === 'substitute') { clearSubstituteOverride(); return; }
    const next = DEFAULT_WEEKLY_EXPORT_COLS;
    setCols(next);
    doSave(next);
    setFlash('reset');
    setTimeout(() => setFlash(null), 1500);
  };

  const getColLabel = (col: WeeklyColumnDef) => {
    if (col.type === 'meta' && col.metaKey) {
      const field = allMetaFields.find(f => f.key === col.metaKey);
      if (field) return field.isUrl ? `${field.label} (링크)` : field.label;
      return col.metaKey;
    }
    return WEEKLY_COL_LABELS[col.type] ?? col.type;
  };

  const addedMetaKeys = new Set(cols.filter(c => c.type === 'meta').map(c => c.metaKey));

  return (
    <div className="space-y-3">
      {/* 파트별 적용 대상 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">적용 대상</p>
          <div className="flex flex-wrap gap-1.5">
            {(['team', ...team.parts.map(p => p.id)] as ('team' | string)[]).map(target => {
              const isTeamBtn = target === 'team';
              const part = !isTeamBtn ? team.parts.find(p => p.id === target) : null;
              const hasOwn = !isTeamBtn && !!part?.weeklyExportConfig;
              return (
                <button key={target}
                  onClick={() => setSelectedTarget(target)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedTarget === target
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {!isTeamBtn && part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeamBtn ? '팀 기본' : part?.name}
                  {hasOwn && (
                    <span className={`text-[10px] px-1 rounded ${selectedTarget === target ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>별도</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 상속/별도 안내 */}
      {isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">팀 기본 설정을 상속 중</p>
          <button onClick={() => doSave(cols)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium ml-3 flex-shrink-0">
            <ArrowDownToLine size={11} />팀 기본 가져오기
          </button>
        </div>
      )}
      {!isTeamTarget && !isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">이 파트의 별도 설정이 적용 중</p>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <button onClick={() => { if (currentPart) { onClearPart(team.id, currentPart.id); setSelectedTarget('team'); } }}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
              <RotateCcw size={11} />초기화
            </button>
          </div>
        </div>
      )}

      {/* 일반/대무 항목 유형 선택 */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">항목 유형</p>
        <div className="flex flex-wrap gap-1.5">
          {(['normal', 'substitute'] as const).map(mode => (
            <button key={mode}
              onClick={() => setColMode(mode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                colMode === mode
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}>
              {mode === 'normal' ? '일반 항목' : '대무 항목'}
              {mode === 'substitute' && hasOwnSubstituteConfig && (
                <span className={`text-[10px] px-1 rounded ${colMode === mode ? 'bg-white/20' : 'bg-orange-100 text-orange-600'}`}>별도</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 대무 항목 상속/별도 안내 */}
      {colMode === 'substitute' && !hasOwnSubstituteConfig && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">대무 항목은 일반 항목 설정을 그대로 사용 중</p>
          <button onClick={() => doSave(cols)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium ml-3 flex-shrink-0">
            <ArrowDownToLine size={11} />별도 설정 시작
          </button>
        </div>
      )}
      {colMode === 'substitute' && hasOwnSubstituteConfig && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">대무 항목에 별도 설정이 적용 중</p>
          <button onClick={clearSubstituteOverride}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />초기화 (일반 설정 따르기)
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">드래그로 순서 변경 · 토글로 포함/제외 · 빈칸 클릭으로 내용 변경</p>
        <div className="flex items-center gap-2">
          {flash && (
            <span className={`text-[10px] font-medium ${flash === 'saved' ? 'text-green-500' : 'text-blue-500'}`}>
              {flash === 'saved' ? '저장됨' : '초기화됨'}
            </span>
          )}
          {saving && <span className="text-[10px] text-gray-400">저장 중...</span>}
          <button onClick={resetToDefault}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
            <RotateCcw size={10} />초기화
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {cols.map((col, idx) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
              dragOverIdx === idx ? 'border-blue-300 bg-blue-50' : 'border-black/8 bg-white'
            } ${!col.enabled ? 'opacity-40' : ''}`}
          >
            <GripVertical size={13} className="text-gray-300 flex-shrink-0" />
            {/* 빈칸/메타 행: 인라인 select로 변경 가능 */}
            {(col.type === 'empty' || col.type === 'meta') ? (
              <div className="relative flex-1">
                <select
                  value={col.type === 'meta' ? (col.metaKey ?? '') : '__empty__'}
                  onChange={e => handleChangeColType(col.id, e.target.value)}
                  className="w-full text-xs bg-transparent focus:outline-none cursor-pointer text-gray-700 appearance-none pr-4"
                >
                  <option value="__empty__">빈칸</option>
                  {allMetaFields.map(f => (
                    <option
                      key={f.key}
                      value={f.key}
                      disabled={col.metaKey !== f.key && addedMetaKeys.has(f.key)}
                    >
                      {f.label}{f.isUrl ? ' (링크)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              </div>
            ) : (
              <span className="text-xs flex-1 text-gray-700">{getColLabel(col)}</span>
            )}
            {(col.type === 'empty' || col.type === 'meta') && (
              <button onClick={() => removeCol(col.id)}
                className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                <X size={12} />
              </button>
            )}
            <button
              onClick={() => toggle(col.id)}
              className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${col.enabled ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${col.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* 빈칸 추가 */}
      <button
        onClick={handleAddEmpty}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        <Plus size={11} />빈칸 추가
      </button>

      <div className="pt-0.5">
        <p className="text-[10px] text-gray-400">
          미리보기: {cols.filter(c => c.enabled).map(c => getColLabel(c)).join(' | ')}
        </p>
      </div>
    </div>
  );
}

function ExcelFieldManager({ team, onSave, onSavePart, onClearPart }: {
  team: Team;
  onSave: (teamId: string, config: ExcelFieldConfig[]) => Promise<void>;
  onSavePart: (teamId: string, partId: string, config: ExcelFieldConfig[]) => Promise<void>;
  onClearPart: (teamId: string, partId: string) => Promise<void>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<'team' | string>('team');

  const isTeam = selectedTarget === 'team';
  const currentPart = !isTeam ? team.parts.find(p => p.id === selectedTarget) : undefined;
  const isInherited = !isTeam && !currentPart?.excelConfig;

  // formConfig의 customLabel 반영 (설정에서 명칭 변경한 경우 적용)
  const resolvedBuiltins = resolveBuiltinFields(team.formConfig);
  const BUILTIN_EXCEL_KEYS = ['taskMonth', 'title', 'category', 'type', 'status', 'receiver', 'assignee', 'startDate', 'endDate'];
  const builtinExcelFields = BUILTIN_EXCEL_KEYS.map((key, i) => {
    const bf = resolvedBuiltins.find(f => f.key === key);
    const defaultLabel = BUILTIN_FIELDS_META.find(m => m.key === key)?.label ?? key;
    return { key, label: bf?.customLabel ?? defaultLabel, enabled: true, order: i };
  });
  const metaFields = team.metaFields ?? DEFAULT_META_FIELDS;
  const customFormFields = (team.formConfig?.customFields ?? []).filter(f => f.enabled !== false);

  const defaultFields: ExcelFieldConfig[] = [
    ...builtinExcelFields,
    ...metaFields.map((f, i) => ({ key: f.key, label: f.label, enabled: false, order: builtinExcelFields.length + i })),
    ...customFormFields.map((f, i) => ({ key: f.id, label: f.label, enabled: false, order: builtinExcelFields.length + metaFields.length + i })),
  ];

  const buildFields = (saved: ExcelFieldConfig[] | undefined): ExcelFieldConfig[] => {
    if (!saved?.length) return defaultFields;
    const validKeys = new Set(defaultFields.map(f => f.key));
    const savedKeys = new Set(saved.map(f => f.key));
    const extra = defaultFields.filter(f => !savedKeys.has(f.key)).map((f, i) => ({ ...f, order: saved.length + i }));
    const labelMap = Object.fromEntries(defaultFields.map(f => [f.key, f.label]));
    const synced = saved.filter(f => validKeys.has(f.key)).map(f => ({ ...f, label: labelMap[f.key] ?? f.label }));
    return [...synced, ...extra].sort((a, b) => a.order - b.order);
  };

  const savedConfig = isTeam ? team.excelConfig : (currentPart?.excelConfig ?? team.excelConfig);
  const [fields, setFields] = useState<ExcelFieldConfig[]>(() => buildFields(savedConfig));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<'saved' | 'reset' | null>(null);
  const doFlash = (type: 'saved' | 'reset') => { setFlash(type); setTimeout(() => setFlash(null), 1500); };

  useEffect(() => {
    setFields(buildFields(isTeam ? team.excelConfig : (currentPart?.excelConfig ?? team.excelConfig)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTarget, team.id, team.excelConfig, currentPart?.excelConfig]);

  useEffect(() => {
    setFields(buildFields(isTeam ? team.excelConfig : (currentPart?.excelConfig ?? team.excelConfig)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.formConfig, team.metaFields]);

  const toggle = (key: string) => {
    if (isInherited) return;
    const next = fields.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f);
    setFields(next);
    save(next);
  };
  const toggleExportExclude = (key: string) => {
    if (isInherited) return;
    const next = fields.map(f => f.key === key ? { ...f, exportExcluded: !f.exportExcluded } : f);
    setFields(next);
    save(next);
  };

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) return;
    const next = [...fields];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, moved);
    const reordered = next.map((f, i) => ({ ...f, order: i }));
    setFields(reordered);
    setDragIdx(null); setDragOverIdx(null);
    if (!isInherited) save(reordered);
  };

  const save = async (updated: ExcelFieldConfig[]) => {
    const config = updated.map((f, i) => ({ ...f, order: i }));
    if (isTeam) await onSave(team.id, config);
    else if (currentPart) await onSavePart(team.id, currentPart.id, config);
  };

  const handleSaveAsTeamDefault = async () => {
    setSaving(true);
    const config = fields.map((f, i) => ({ ...f, order: i }));
    await onSave(team.id, config);
    setSaving(false);
  };

  useEffect(() => { setSelectedTarget('team'); }, [team.id]);

  return (
    <div className="space-y-3">
      {/* 적용 대상 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">적용 대상</p>
          <div className="flex flex-wrap gap-1.5">
            {(['team', ...team.parts.map(p => p.id)] as ('team' | string)[]).map(target => {
              const isTeamBtn = target === 'team';
              const part = !isTeamBtn ? team.parts.find(p => p.id === target) : null;
              const hasOwn = !isTeamBtn && !!part?.excelConfig;
              return (
                <button key={target}
                  onClick={() => setSelectedTarget(target)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedTarget === target
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {!isTeamBtn && part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeamBtn ? '팀 기본' : part?.name}
                  {hasOwn && (
                    <span className={`text-[10px] px-1 rounded ${selectedTarget === target ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>별도</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 상속/별도 안내 */}
      {isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">팀 기본 설정을 상속 중</p>
          <button onClick={() => save(fields)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium ml-3 flex-shrink-0">
            <ArrowDownToLine size={11} />팀 기본 가져오기
          </button>
        </div>
      )}
      {!isTeam && !isInherited && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">이 파트의 별도 설정이 적용 중</p>
          {flash ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold ml-3 flex-shrink-0">
              <Check size={11} />{flash === 'saved' ? '팀 기본 저장됨' : '초기화됨'}
            </span>
          ) : (
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <button onClick={() => { handleSaveAsTeamDefault(); doFlash('saved'); }} disabled={saving}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50">
                <ArrowUpToLine size={11} />팀 기본으로 지정
              </button>
              <button onClick={() => { if (currentPart) { onClearPart(team.id, currentPart.id); setSelectedTarget('team'); doFlash('reset'); } }}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
                <RotateCcw size={11} />초기화
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        {fields.map((f, idx) => (
          <div key={f.key}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-white transition-all ${
              dragOverIdx === idx ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100'
            } ${dragIdx === idx ? 'opacity-40' : ''}`}>
            <GripVertical size={13} className="text-gray-300 cursor-grab flex-shrink-0" />
            <span className={`text-xs font-medium flex-1 ${f.enabled ? 'text-gray-700' : 'text-gray-400'}`}>{f.label}</span>
            <button
              onClick={() => toggle(f.key)}
              className={`w-[92px] py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                f.enabled
                  ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                  : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
              }`}>
              {f.enabled ? '가져오기 포함' : '가져오기 제외'}
            </button>
            <button
              onClick={() => { if (f.enabled) toggleExportExclude(f.key); }}
              className={`w-[92px] py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                !f.enabled
                  ? 'bg-gray-50 text-gray-200 border-gray-100 cursor-not-allowed'
                  : !f.exportExcluded
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
              }`}>
              {!f.enabled ? '—' : f.exportExcluded ? '내보내기 제외' : '내보내기 포함'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const TEAM_COLOR_PRESETS = [
  // 레드·핑크
  '#ef4444','#f97316','#f43f5e','#ec4899','#db2777',
  // 퍼플·인디고
  '#a855f7','#8b5cf6','#6366f1','#4f46e5','#7c3aed',
  // 블루·스카이
  '#3b82f6','#2563eb','#0ea5e9','#0284c7','#06b6d4',
  // 그린·틸
  '#10b981','#059669','#14b8a6','#0d9488','#22c55e',
  // 라임·옐로
  '#84cc16','#65a30d','#eab308','#ca8a04','#f59e0b',
  // 브라운·슬레이트
  '#78716c','#57534e','#64748b','#475569','#374151',
  // 추가 10색
  '#fda4af','#fdba74','#fcd34d','#86efac','#67e8f9',
  '#a5b4fc','#f9a8d4','#d9f99d','#99f6e4','#e2e8f0',
];

// 메일 유형(탭)에서 안내 문구를 따로 설정하지 않았을 때 쓰는 기본값
// (TaskDetailPanel.tsx의 동일 상수와 문구를 맞춰야 함)
const DEFAULT_MAIL_MESSAGE = '아래 업무 관련하여 안내드립니다.';

// 받는사람/참조 입력 — 체크박스 목록 대신 칩 입력창 하나로: "@"로 시작하면
// (근무지 전체) 팀원 검색 드롭다운이 뜨고 이름을 치면 좁혀짐, 쉼표(,)를 누르면
// 현재 입력을 칩으로 추가. "@"로 시작하지 않은 텍스트(외부 이메일 주소 등)는
// 그대로 칩으로 추가되어 팀원이 아닌 이메일도 자유롭게 넣을 수 있음
function RecipientChipInput({ label, value, onChange, members }: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  members: { name: string; department?: Department }[];
}) {
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const isMention = draft.startsWith('@');
  const query = isMention ? draft.slice(1).trim().toLowerCase() : '';
  const suggestions = isMention
    ? members
        .filter(m => !value.includes(m.name))
        .filter(m => !query || m.name.toLowerCase().includes(query))
        .slice(0, 30)
    : [];

  const resolveItem = (raw: string): string => {
    const item = raw.trim();
    if (!item.startsWith('@')) return item;
    const q = item.slice(1).trim();
    if (!q) return '';
    const match = members.find(m => m.name === q) ?? members.find(m => m.name.toLowerCase().includes(q.toLowerCase()));
    return match?.name ?? q;
  };

  const addChip = (raw: string) => {
    const item = resolveItem(raw);
    if (item && !value.includes(item)) onChange([...value, item]);
  };

  // 쉼표가 여러 개 포함된 텍스트를 한 번에 붙여넣은 경우("a@b.com, c@d.com, ...") 처리.
  // 각 조각마다 onChange를 따로 호출하면 매번 같은(오래된) value를 기준으로 계산돼
  // 마지막 조각만 반영되므로, 하나의 배열로 누적한 뒤 한 번만 onChange 호출
  const addMany = (raws: string[]) => {
    let next = value;
    raws.forEach(raw => {
      const item = resolveItem(raw);
      if (item && !next.includes(item)) next = [...next, item];
    });
    if (next !== value) onChange(next);
  };

  const selectMember = (name: string) => {
    if (!value.includes(name)) onChange([...value, name]);
    setDraft('');
  };

  const removeChip = (item: string) => onChange(value.filter(v => v !== item));

  const handleCopy = () => {
    const emails = value.map(item => members.find(m => m.name === item)?.email ?? (item.includes('@') ? item : null)).filter((e): e is string => !!e);
    if (emails.length === 0) return;
    navigator.clipboard.writeText(emails.join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        {value.length > 0 && (
          <button onClick={handleCopy} className="text-[11px] text-[#6C63FF] hover:text-[#5a52e0] font-medium flex items-center gap-1 px-2 py-1 rounded-md bg-[#6C63FF]/10 hover:bg-[#6C63FF]/15 border border-[#6C63FF]/20 transition-colors">
            <Copy size={10} /> {copied ? '복사됨' : '이메일 복사'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-lg border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500/30 min-h-[38px]">
        {value.map(item => {
          const member = members.find(m => m.name === item);
          return (
            <span key={item} className={`flex items-center gap-1 text-xs pl-2 pr-1 py-1 rounded-full ${member ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
              {item}
              <button onClick={() => removeChip(item)} className="w-3.5 h-3.5 flex items-center justify-center rounded-full opacity-50 hover:opacity-100 hover:bg-black/10">×</button>
            </span>
          );
        })}
        <input
          value={draft}
          onChange={e => {
            const val = e.target.value;
            if (val.includes(',')) {
              const parts = val.split(',');
              const last = parts.pop() ?? '';
              addMany(parts);
              setDraft(last);
            } else {
              setDraft(val);
            }
          }}
          onBlur={() => {
            if (draft.trim()) { addChip(draft); setDraft(''); }
          }}
          onKeyDown={e => {
            if (e.key === ',') {
              e.preventDefault();
              addChip(draft);
              setDraft('');
            } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (isMention && suggestions.length > 0) selectMember(suggestions[0].name);
              else { addChip(draft); setDraft(''); }
            }
          }}
          placeholder={value.length === 0 ? '@이름 검색 또는 이메일 입력, 쉼표(,)로 추가' : ''}
          className="flex-1 min-w-[140px] text-sm outline-none bg-transparent py-0.5"
        />
      </div>
      {isMention && suggestions.length > 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(m => (
            <button key={m.name} onClick={() => selectMember(m.name)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 text-sm text-gray-700">
              {m.name}
              {m.department && <span className="text-[10px] text-gray-400 ml-auto">{m.department}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 파트별 메일 양식 받는사람/참조 기본 인원 설정 — 업무 상세의 "메일 양식" 패널에서
// 사용. 팀 레벨 상속 없이 파트별로만 설정(요청사항). 받는사람/참조 조합이 매번
// 다를 수 있어, 파트마다 이름/색이 다른 "메일 양식 탭"을 여러 개 만들어두고
// 업무 상세에서 상황에 맞는 탭을 골라 쓸 수 있게 함
// 표 배경색 프리셋 — 너무 진하지 않게 연한 파스텔 톤(Tailwind 50 계열)만 사용
const MAIL_TABLE_BG_PRESETS = ['#ffffff', '#f9fafb', '#f3f4f6', '#eef2ff', '#fffbeb', '#fef2f2', '#f0fdf4', '#f0f9ff', '#fdf2f8', '#f5f3ff'];

// 한 줄짜리 텍스트 입력을 blur 시에만 커밋 — onChange마다 바로 저장하면 한글 조합 중
// 리렌더로 자모가 분리되는 문제가 있어, 로컬 draft로 편집하고 값이 바뀔 때만 동기화
function InlineTextField({ value, onCommit, placeholder, className }: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder={placeholder}
      className={className}
    />
  );
}

// 기존(첫 번째) 표에 합치지 않고 별도로 구성하는 추가 표 하나를 편집. 기본 8개
// 업무 항목 개념이 없고, 필드에서 가져오거나 사용자가 직접 입력하는 항목만으로 구성
function ExtraTableEditor({ table, candidateFields, onSave, onRemove }: {
  table: MailTableConfig;
  candidateFields: { key: string; label: string; type: 'text' | 'date' | 'url'; source: 'field' | 'subtask' }[];
  onSave: (next: MailTableConfig) => void;
  onRemove: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(table.title ?? '');
  const [customSourceKey, setCustomSourceKey] = useState('');
  const [customType, setCustomType] = useState<'text' | 'date' | 'url'>('text');
  const [addMode, setAddMode] = useState<'field' | 'manual'>('field');
  const [manualLabelDraft, setManualLabelDraft] = useState('');
  const rowDragIdxRef = useRef<number | null>(null);
  const [rowDragOverIdx, setRowDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    setTitleDraft(table.title ?? '');
    setCustomSourceKey('');
    setManualLabelDraft('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id]);

  const patch = (p: Partial<MailTableConfig>) => onSave({ ...table, ...p });

  const handleAddField = () => {
    if (!customSourceKey) return;
    const source = candidateFields.find(f => f.key === customSourceKey);
    if (!source) return;
    const field: MailTableCustomField = {
      id: `mtc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: source.label,
      type: source.type,
      sourceKey: source.key,
      ...(source.source === 'subtask' ? { source: 'subtask' as const } : {}),
    };
    patch({ customFields: [...(table.customFields ?? []), field] });
    setCustomSourceKey('');
  };

  const handleAddManual = () => {
    if (!manualLabelDraft.trim()) return;
    const field: MailTableCustomField = { id: `mtc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: manualLabelDraft.trim(), type: customType };
    patch({ customFields: [...(table.customFields ?? []), field] });
    setManualLabelDraft('');
  };

  const handleRemoveField = (id: string) => patch({ customFields: (table.customFields ?? []).filter(f => f.id !== id) });

  const handleSetFieldLinkText = (id: string, linkText: string) => patch({ customFields: (table.customFields ?? []).map(f => f.id === id ? { ...f, linkText } : f) });

  const handleSetFieldLabel = (id: string, label: string) => {
    if (!label.trim()) return;
    patch({ customFields: (table.customFields ?? []).map(f => f.id === id ? { ...f, label: label.trim() } : f) });
  };

  // 링크(URL) 속성이 생기기 전에 "텍스트"로 추가해둔 필드를 링크로 전환
  const handleFixFieldToUrl = (id: string) => patch({ customFields: (table.customFields ?? []).map(f => f.id === id ? { ...f, type: 'url' } : f) });

  // 이미 추가해둔 "사용자 입력" 항목을 세부 업무의 시작일/종료일과 연결(이름은 그대로 유지)
  const handleConnectSubTask = (id: string, subTaskKey: string) => {
    if (!subTaskKey) return;
    patch({ customFields: (table.customFields ?? []).map(f => f.id === id ? { ...f, sourceKey: subTaskKey, source: 'subtask' as const } : f) });
  };

  // 연결을 해제해 다시 "사용자 입력" 항목으로 되돌림
  const handleDisconnectField = (id: string) => {
    patch({ customFields: (table.customFields ?? []).map(f => f.id === id ? { ...f, sourceKey: undefined, source: undefined } : f) });
  };

  const rows = resolveMailTableRowOrder((table.customFields ?? []).map(f => f.id), table.rowOrder)
    .map(id => (table.customFields ?? []).find(f => f.id === id))
    .filter((f): f is MailTableCustomField => !!f);

  const handleReorderRow = (toIdx: number) => {
    const from = rowDragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...rows];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    patch({ rowOrder: arr.map(f => f.id) });
    rowDragIdxRef.current = null;
    setRowDragOverIdx(null);
  };

  const setFieldStyleOverride = (key: string, p: Partial<MailTableCellStyle>) => {
    const cur = table.fieldStyles ?? {};
    const next = { ...cur[key], ...p };
    const isEmpty = !next.labelBg && next.labelBold === undefined && !next.valueBg && next.valueBold === undefined && !next.hideRow && !next.hideLabel && !next.valuePrefix && !next.valueSuffix;
    const nextStyles = { ...cur };
    if (isEmpty) delete nextStyles[key]; else nextStyles[key] = next;
    patch({ fieldStyles: nextStyles });
  };
  const clearFieldStyleOverride = (key: string) => {
    const nextStyles = { ...(table.fieldStyles ?? {}) };
    delete nextStyles[key];
    patch({ fieldStyles: nextStyles });
  };

  const showLabelColumn = table.showLabelColumn ?? true;
  const showValueColumn = table.showValueColumn ?? true;

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <input
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== (table.title ?? '')) patch({ title: titleDraft.trim() }); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="표 제목 (선택, 예: 예상 일정표)"
          className="flex-1 text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button onClick={onRemove} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
          표 삭제
        </button>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${table.hidden ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
          {table.hidden && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        <input type="checkbox" checked={!!table.hidden} onChange={() => patch({ hidden: !table.hidden })} className="hidden" />
        <span className="text-[11px] text-gray-600">표 전체 숨김</span>
      </label>

      <div className={table.hidden ? 'opacity-40 pointer-events-none space-y-3' : 'space-y-3'}>
        <div>
          <p className="text-[11px] text-gray-500 mb-1.5">표시할 항목</p>
          {(table.customFields ?? []).length > 0 && (
            <div className="space-y-1 mb-2">
              {table.customFields!.map(f => {
                const sourceIsUrl = f.sourceKey && candidateFields.find(cf => cf.key === f.sourceKey)?.type === 'url';
                const needsFix = sourceIsUrl && f.type !== 'url';
                return (
                  <div key={f.id} className="flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600">
                    <InlineTextField
                      value={f.label}
                      onCommit={v => handleSetFieldLabel(f.id, v)}
                      className="flex-1 min-w-0 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 -mx-1"
                    />
                    <span className="text-gray-400 flex-shrink-0">({f.type === 'date' ? '날짜' : f.type === 'url' ? '링크' : '텍스트'}{!f.sourceKey ? ' · 사용자 입력' : ''})</span>
                    {needsFix && (
                      <button onClick={() => handleFixFieldToUrl(f.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 flex-shrink-0">
                        🔗 링크로 전환
                      </button>
                    )}
                    {!f.sourceKey && f.type === 'date' && candidateFields.some(cf => cf.source === 'subtask') && (
                      <select value="" onChange={e => handleConnectSubTask(f.id, e.target.value)}
                        className="text-[10px] px-1.5 py-1 rounded-md border border-gray-200 focus:outline-none flex-shrink-0 max-w-[140px]">
                        <option value="">세부 업무 연결</option>
                        {candidateFields.filter(cf => cf.source === 'subtask').map(cf => <option key={cf.key} value={cf.key}>{cf.label}</option>)}
                      </select>
                    )}
                    {f.source === 'subtask' && (
                      <button onClick={() => handleDisconnectField(f.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 flex-shrink-0">
                        연결 해제
                      </button>
                    )}
                    {f.type === 'url' && (
                      <InlineTextField
                        value={f.linkText ?? ''}
                        onCommit={v => handleSetFieldLinkText(f.id, v)}
                        placeholder="링크 텍스트 (예: 자세히 보기)"
                        className="w-40 text-[11px] px-1.5 py-1 rounded-md border border-gray-200 focus:outline-none flex-shrink-0"
                      />
                    )}
                    <button onClick={() => handleRemoveField(f.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">×</button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-1 mb-1.5">
            <button onClick={() => setAddMode('field')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${addMode === 'field' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              필드에서 추가
            </button>
            <button onClick={() => setAddMode('manual')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${addMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              사용자 입력 항목
            </button>
          </div>
          {addMode === 'field' ? (
            candidateFields.length === 0 ? (
              <p className="text-[11px] text-gray-400">추가할 수 있는 필드가 없습니다. 팀 관리에서 필드를 먼저 만들어주세요.</p>
            ) : (
              <div className="flex items-center gap-1.5">
                <select value={customSourceKey} onChange={e => setCustomSourceKey(e.target.value)}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none">
                  <option value="">필드 선택</option>
                  <optgroup label="필드">
                    {candidateFields.filter(f => f.source === 'field').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </optgroup>
                  {candidateFields.some(f => f.source === 'subtask') && (
                    <optgroup label="세부 업무">
                      {candidateFields.filter(f => f.source === 'subtask').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </optgroup>
                  )}
                </select>
                <button onClick={handleAddField} disabled={!customSourceKey}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                  추가
                </button>
              </div>
            )
          ) : (
            <div>
              <div className="flex items-center gap-1.5">
                <input value={manualLabelDraft} onChange={e => setManualLabelDraft(e.target.value)}
                  placeholder="항목 이름 (예: 특이사항)"
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none" />
                <select value={customType} onChange={e => setCustomType(e.target.value as 'text' | 'date' | 'url')}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none">
                  <option value="text">텍스트</option>
                  <option value="date">날짜</option>
                  <option value="url">링크(URL)</option>
                </select>
                <button onClick={handleAddManual} disabled={!manualLabelDraft.trim()}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                  추가
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">값이 미리 채워지지 않고, 업무 상세의 메일 양식에서 메일 작성할 때마다 직접 입력합니다.</p>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${showLabelColumn ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
            {showLabelColumn && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <input type="checkbox" checked={showLabelColumn} onChange={() => patch({ showLabelColumn: !showLabelColumn })} className="hidden" />
          <span className="text-[11px] text-gray-600">항목명 칸 표시 (끄면 내용 칸만 표시)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${showValueColumn ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
            {showValueColumn && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <input type="checkbox" checked={showValueColumn} onChange={() => patch({ showValueColumn: !showValueColumn })} className="hidden" />
          <span className="text-[11px] text-gray-600">내용 칸 표시 (끄면 항목명 칸만 표시)</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div className={showLabelColumn ? '' : 'opacity-40 pointer-events-none'}>
            <p className="text-[11px] text-gray-500 mb-1.5">항목명 칸 기본값</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {MAIL_TABLE_BG_PRESETS.map(c => (
                <button key={c} onClick={() => patch({ labelBg: c })}
                  className={`w-5 h-5 rounded-full flex-shrink-0 border border-gray-200 ${(table.labelBg ?? '#f9fafb') === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${(table.labelBold ?? true) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                {(table.labelBold ?? true) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <input type="checkbox" checked={table.labelBold ?? true} onChange={() => patch({ labelBold: !(table.labelBold ?? true) })} className="hidden" />
              <span className="text-[11px] text-gray-600">볼드</span>
            </label>
          </div>
          <div className={showValueColumn ? '' : 'opacity-40 pointer-events-none'}>
            <p className="text-[11px] text-gray-500 mb-1.5">내용 칸 기본값</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {MAIL_TABLE_BG_PRESETS.map(c => (
                <button key={c} onClick={() => patch({ valueBg: c })}
                  className={`w-5 h-5 rounded-full flex-shrink-0 border border-gray-200 ${(table.valueBg ?? '#ffffff') === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${(table.valueBold ?? false) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                {(table.valueBold ?? false) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <input type="checkbox" checked={table.valueBold ?? false} onChange={() => patch({ valueBold: !(table.valueBold ?? false) })} className="hidden" />
              <span className="text-[11px] text-gray-600">볼드</span>
            </label>
          </div>
        </div>

        {rows.length > 0 && (
          <div>
            <p className="text-[11px] text-gray-500 mb-1.5">
              항목별 스타일 재정의 (선택 — 지정하지 않으면 위 기본값 사용)
              <span className="text-gray-300 font-normal ml-1">드래그로 표에 표시될 순서 변경</span>
            </p>
            <div className="space-y-2">
              {rows.map((f, i) => {
                const override = table.fieldStyles?.[f.id];
                const effLabelBg = override?.labelBg || table.labelBg || '#f9fafb';
                const effLabelBold = override?.labelBold ?? table.labelBold ?? true;
                const effValueBg = override?.valueBg || table.valueBg || '#ffffff';
                const effValueBold = override?.valueBold ?? table.valueBold ?? false;
                const hasOverride = !!override && Object.keys(override).length > 0;
                const isRowHidden = override?.hideRow ?? false;
                const isLabelHidden = override?.hideLabel ?? false;
                return (
                  <div key={f.id}
                    draggable
                    onDragStart={() => { rowDragIdxRef.current = i; }}
                    onDragOver={e => { e.preventDefault(); setRowDragOverIdx(i); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRowDragOverIdx(null); }}
                    onDrop={() => handleReorderRow(i)}
                    onDragEnd={() => { rowDragIdxRef.current = null; setRowDragOverIdx(null); }}
                    className={`rounded-lg border border-gray-100 p-2.5 space-y-1.5 ${rowDragOverIdx === i ? 'border-t-2 border-t-indigo-400' : ''}`}>
                    <div className="flex items-center justify-between flex-wrap gap-y-1">
                      <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${isRowHidden ? 'text-gray-300' : 'text-gray-700'}`}>
                        <GripVertical size={12} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                        {f.label}
                        {isRowHidden && <span className="text-[10px] font-normal text-gray-400">(숨김)</span>}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${isRowHidden ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                            {isRowHidden && <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <input type="checkbox" checked={isRowHidden} onChange={() => setFieldStyleOverride(f.id, { hideRow: !isRowHidden })} className="hidden" />
                          <span className="text-[10px] text-gray-500">전체 숨김</span>
                        </label>
                        <label className={`flex items-center gap-1.5 cursor-pointer select-none ${showLabelColumn && !isRowHidden ? '' : 'opacity-40 pointer-events-none'}`}>
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${isLabelHidden ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                            {isLabelHidden && <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <input type="checkbox" checked={isLabelHidden} onChange={() => setFieldStyleOverride(f.id, { hideLabel: !isLabelHidden })} className="hidden" />
                          <span className="text-[10px] text-gray-500">항목명 숨김</span>
                        </label>
                        {hasOverride && (
                          <button onClick={() => clearFieldStyleOverride(f.id)} className="text-[10px] text-gray-400 hover:text-red-500">
                            기본값으로
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`grid grid-cols-2 gap-3 ${isRowHidden ? 'opacity-30 pointer-events-none' : ''}`}>
                      <div className={`flex items-center gap-1 flex-wrap ${showLabelColumn && !isLabelHidden ? '' : 'opacity-40 pointer-events-none'}`}>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 w-9">항목명</span>
                        {MAIL_TABLE_BG_PRESETS.map(c => (
                          <button key={c} onClick={() => setFieldStyleOverride(f.id, { labelBg: c })}
                            className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border border-gray-200 ${effLabelBg === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                            style={{ background: c }}
                          />
                        ))}
                        <button onClick={() => setFieldStyleOverride(f.id, { labelBold: !effLabelBold })}
                          className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 font-bold ${effLabelBold ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                          B
                        </button>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-gray-400 flex-shrink-0 w-9">내용</span>
                        {MAIL_TABLE_BG_PRESETS.map(c => (
                          <button key={c} onClick={() => setFieldStyleOverride(f.id, { valueBg: c })}
                            className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border border-gray-200 ${effValueBg === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                            style={{ background: c }}
                          />
                        ))}
                        <button onClick={() => setFieldStyleOverride(f.id, { valueBold: !effValueBold })}
                          className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 font-bold ${effValueBold ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                          B
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 flex-shrink-0 w-9">값 앞</span>
                        <InlineTextField
                          value={override?.valuePrefix ?? ''}
                          onCommit={v => setFieldStyleOverride(f.id, { valuePrefix: v })}
                          placeholder="예: 예정 "
                          className="flex-1 min-w-0 text-[11px] px-1.5 py-1 rounded-md border border-gray-200 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 flex-shrink-0 w-9">값 뒤</span>
                        <InlineTextField
                          value={override?.valueSuffix ?? ''}
                          onCommit={v => setFieldStyleOverride(f.id, { valueSuffix: v })}
                          placeholder="예:  완료"
                          className="flex-1 min-w-0 text-[11px] px-1.5 py-1 rounded-md border border-gray-200 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// "[제목]" 아래 번호가 매겨진 항목을 나열하는 목록 하나를 편집 — 표와 달리 배경색/볼드
// 등 스타일 없이, 항목 이름과 값(필드에서 가져오거나 사용자 입력)만으로 구성
function MailListGroupEditor({ group, candidateFields, onSave, onRemove }: {
  group: MailListGroup;
  candidateFields: { key: string; label: string; type: 'text' | 'date' }[];
  onSave: (next: MailListGroup) => void;
  onRemove: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(group.title ?? '');
  const [customSourceKey, setCustomSourceKey] = useState('');
  const [customType, setCustomType] = useState<'text' | 'date'>('text');
  const [addMode, setAddMode] = useState<'field' | 'manual'>('field');
  const [manualLabelDraft, setManualLabelDraft] = useState('');
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    setTitleDraft(group.title ?? '');
    setCustomSourceKey('');
    setManualLabelDraft('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  const patch = (p: Partial<MailListGroup>) => onSave({ ...group, ...p });

  const handleAddField = () => {
    if (!customSourceKey) return;
    const source = candidateFields.find(f => f.key === customSourceKey);
    if (!source) return;
    const item: MailListItem = { id: `mli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: source.label, type: source.type, sourceKey: source.key };
    patch({ items: [...(group.items ?? []), item] });
    setCustomSourceKey('');
  };

  const handleAddManual = () => {
    if (!manualLabelDraft.trim()) return;
    const item: MailListItem = { id: `mli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: manualLabelDraft.trim(), type: customType };
    patch({ items: [...(group.items ?? []), item] });
    setManualLabelDraft('');
  };

  const handleRemoveItem = (id: string) => patch({ items: (group.items ?? []).filter(it => it.id !== id) });

  const handleReorder = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...(group.items ?? [])];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    patch({ items: arr });
    dragIdxRef.current = null;
    setDragOverIdx(null);
  };

  const items = group.items ?? [];

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <input
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== (group.title ?? '')) patch({ title: titleDraft.trim() }); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="목록 제목 (선택, 예: SNS 공유 이미지)"
          className="flex-1 text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button onClick={onRemove} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
          목록 삭제
        </button>
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1.5">항목 (번호가 자동으로 매겨집니다)</p>
        {items.length > 0 && (
          <div className="space-y-1 mb-2">
            {items.map((it, i) => (
              <div key={it.id}
                draggable
                onDragStart={() => { dragIdxRef.current = i; }}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
                onDrop={() => handleReorder(i)}
                onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                className={`flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 ${dragOverIdx === i ? 'border-t-2 border-t-indigo-400' : ''}`}>
                <GripVertical size={12} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                <span className="flex-1">{i + 1}. {it.label} <span className="text-gray-400">({it.type === 'date' ? '날짜' : '텍스트'}{!it.sourceKey ? ' · 사용자 입력' : ''})</span></span>
                <button onClick={() => handleRemoveItem(it.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 mb-1.5">
          <button onClick={() => setAddMode('field')}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${addMode === 'field' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            필드에서 추가
          </button>
          <button onClick={() => setAddMode('manual')}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${addMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            사용자 입력 항목
          </button>
        </div>
        {addMode === 'field' ? (
          candidateFields.length === 0 ? (
            <p className="text-[11px] text-gray-400">추가할 수 있는 필드가 없습니다. 팀 관리에서 필드를 먼저 만들어주세요.</p>
          ) : (
            <div className="flex items-center gap-1.5">
              <select value={customSourceKey} onChange={e => setCustomSourceKey(e.target.value)}
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none">
                <option value="">필드 선택</option>
                {candidateFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <button onClick={handleAddField} disabled={!customSourceKey}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                추가
              </button>
            </div>
          )
        ) : (
          <div>
            <div className="flex items-center gap-1.5">
              <input value={manualLabelDraft} onChange={e => setManualLabelDraft(e.target.value)}
                placeholder="항목 이름 (예: 방송 안내 페이지)"
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none" />
              <select value={customType} onChange={e => setCustomType(e.target.value as 'text' | 'date')}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none">
                <option value="text">텍스트</option>
                <option value="date">날짜</option>
              </select>
              <button onClick={handleAddManual} disabled={!manualLabelDraft.trim()}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                추가
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">값이 미리 채워지지 않고, 업무 상세의 메일 양식에서 메일 작성할 때마다 직접 입력합니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 메일 양식 편집 중인 값(preset)을 실제 발송 로직과 동일한 함수로 렌더링해 미리보기로 보여줌.
// 실제 업무가 없으므로 샘플 값을 채운 가짜 Task로 대체한다.
function MailBodyPreview({ part, preset, members }: {
  part: TeamPart | undefined;
  preset: MailFormPreset;
  members: { name: string; department?: Department }[];
}) {
  const sampleAuthor = members.find(m => m.department === '기획')?.name ?? members[0]?.name ?? '홍길동';
  const today = new Date().toISOString().slice(0, 10);
  const sampleValue = (type: 'text' | 'date' | 'url' | 'count') =>
    type === 'date' ? today : type === 'count' ? '3' : type === 'url' ? 'https://example.com' : '샘플 텍스트';

  const dummyTask: Task = {
    id: 'preview', projectId: '', teamId: '',
    title: '샘플 업무명', category: part?.name ?? '', type: '신규', status: '진행 중',
    receiver: '홍길동', assignee: '김철수', startDate: today, endDate: today,
    weeklyHours: {}, totalHours: 0, revisionLevel: 0,
    customFields: {}, subTaskData: {},
    createdAt: today, updatedAt: today,
  };

  const manualValues: Record<string, string> = {};
  (preset.tableCustomFields ?? []).forEach(cf => { if (!cf.sourceKey) manualValues[cf.id] = sampleValue(cf.type); });
  (preset.extraTables ?? []).forEach(cfg => (cfg.customFields ?? []).forEach(cf => { if (!cf.sourceKey) manualValues[cf.id] = sampleValue(cf.type); }));
  (preset.listGroups ?? []).forEach(g => (g.items ?? []).forEach(it => { if (!it.sourceKey) manualValues[it.id] = sampleValue(it.type); }));

  const insertValues: Record<string, string> = {};
  (preset.messageInserts ?? []).forEach(ins => { insertValues[ins.id] = sampleValue(ins.type); });

  const greeting = buildMailGreeting(sampleAuthor);
  const messageLine = composeMessageLine(dummyTask, preset, preset.message || DEFAULT_MAIL_MESSAGE, insertValues);
  const mainTable = buildMainRenderableTable(dummyTask, '진행 중', preset, manualValues);
  const extraTables = (preset.extraTables ?? []).map(cfg => buildExtraRenderableTable(dummyTask, cfg, manualValues));
  const listGroups = (preset.listGroups ?? []).map(g => buildRenderableListGroup(dummyTask, g, manualValues));
  const bodyExtra = (preset.bodyCustomFields ?? []).map(f => ({ title: f.title, value: sampleValue(f.type) }));
  const signature = sampleAuthor ? `${sampleAuthor} 드림` : '';
  const html = buildMailHtml(greeting, messageLine, [mainTable, ...extraTables], signature, bodyExtra, listGroups);

  // 페이지 전체 스크롤을 따라 내려가다가 상단에서 붙는(sticky) 방식 — 편집 영역이 길어도
  // 미리보기만 화면에 남고, 미리보기 자체가 뷰포트보다 길면 내부적으로만 스크롤되게 캡을 둠
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <p className="text-xs font-semibold text-gray-700 mb-3">
        본문 미리보기 <span className="font-normal text-gray-400">(샘플 값으로 표시)</span>
      </p>
      <div className="text-[13px] text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function MailFormConfigManager({ team, members, onSavePart, onClearPart }: {
  team: Team;
  members: { name: string; department?: Department }[];
  onSavePart: (teamId: string, partId: string, config: MailFormPreset[]) => Promise<void>;
  onClearPart: (teamId: string, partId: string) => Promise<void>;
}) {
  const [selectedPartId, setSelectedPartId] = useState<string>(team.parts[0]?.id ?? '');
  const currentPart = team.parts.find(p => p.id === selectedPartId);
  const presets = currentPart?.mailFormConfig ?? [];
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const currentPreset = presets.find(p => p.id === selectedPresetId) ?? presets[0];
  const [flash, setFlash] = useState(false);
  const doFlash = () => { setFlash(true); setTimeout(() => setFlash(false), 1200); };
  // 탭 이름/안내 문구/표 제목 입력 — 매 키 입력마다 바로 저장(re-render)하면 한글 조합
  // 중인 입력이 끊겨 자모가 분리되어 보이는 문제가 있어, 로컬 draft로만 편집하고 blur 시 저장
  const [nameDraft, setNameDraft] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [tableTitleDraft, setTableTitleDraft] = useState('');
  const [customSourceKey, setCustomSourceKey] = useState('');
  const [customType, setCustomType] = useState<'text' | 'date' | 'url'>('text');
  const [addMode, setAddMode] = useState<'field' | 'manual'>('field');
  const [manualLabelDraft, setManualLabelDraft] = useState('');
  const [bodyTitleDraft, setBodyTitleDraft] = useState('');
  const [bodyTypeDraft, setBodyTypeDraft] = useState<'text' | 'date'>('text');
  const bodyDragIdxRef = useRef<number | null>(null);
  const [bodyDragOverIdx, setBodyDragOverIdx] = useState<number | null>(null);
  const rowDragIdxRef = useRef<number | null>(null);
  const [rowDragOverIdx, setRowDragOverIdx] = useState<number | null>(null);
  const [selectedExtraTableId, setSelectedExtraTableId] = useState<string>('');
  const [selectedListGroupId, setSelectedListGroupId] = useState<string>('');
  const [msgInsertLabelDraft, setMsgInsertLabelDraft] = useState('');
  const [msgInsertType, setMsgInsertType] = useState<'text' | 'date' | 'count'>('text');
  const msgInsertDragIdxRef = useRef<number | null>(null);
  const [msgInsertDragOverIdx, setMsgInsertDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    setSelectedPresetId(currentPart?.mailFormConfig?.[0]?.id ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartId]);

  useEffect(() => {
    setNameDraft(currentPreset?.name ?? '');
    setMessageDraft(currentPreset?.message ?? DEFAULT_MAIL_MESSAGE);
    setTableTitleDraft(currentPreset?.tableTitle ?? '');
    setCustomSourceKey('');
    setManualLabelDraft('');
    setBodyTitleDraft('');
    setSelectedExtraTableId('');
    setSelectedListGroupId('');
    setMsgInsertLabelDraft('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPreset?.id]);

  const savePresets = (next: MailFormPreset[]) => {
    if (!currentPart) return;
    onSavePart(team.id, currentPart.id, next);
    doFlash();
  };

  const handleAddPreset = () => {
    if (!currentPart) return;
    const preset: MailFormPreset = {
      id: `mf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `탭 ${presets.length + 1}`,
      color: TEAM_COLOR_PRESETS[presets.length % TEAM_COLOR_PRESETS.length],
      to: [], cc: [],
      message: DEFAULT_MAIL_MESSAGE,
    };
    savePresets([...presets, preset]);
    setSelectedPresetId(preset.id);
  };

  const handleRenamePreset = (name: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, name } : p));
  };

  const handleRecolorPreset = (color: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, color } : p));
  };

  const handleSetMessage = (message: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, message } : p));
  };

  const handleToggleShowTaskName = () => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, showTaskName: !p.showTaskName } : p));
  };

  // 업무명과 안내 문구 사이에 끼워 넣는 입력 항목(텍스트/날짜/건수) 관리
  const handleAddMessageInsert = () => {
    if (!currentPreset || !msgInsertLabelDraft.trim()) return;
    const insert: MailMessageInsert = {
      id: `mmi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: msgInsertType,
      label: msgInsertLabelDraft.trim(),
    };
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, messageInserts: [...(p.messageInserts ?? []), insert] } : p));
    setMsgInsertLabelDraft('');
  };

  const handleRemoveMessageInsert = (id: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, messageInserts: (p.messageInserts ?? []).filter(m => m.id !== id) } : p));
  };

  const handleReorderMessageInsert = (toIdx: number) => {
    if (!currentPreset) return;
    const from = msgInsertDragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...(currentPreset.messageInserts ?? [])];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, messageInserts: arr } : p));
    msgInsertDragIdxRef.current = null;
    setMsgInsertDragOverIdx(null);
  };

  const handleDeletePreset = () => {
    if (!currentPreset) return;
    if (!window.confirm(`"${currentPreset.name}" 탭을 삭제할까요?`)) return;
    const next = presets.filter(p => p.id !== currentPreset.id);
    savePresets(next);
    setSelectedPresetId(next[0]?.id ?? '');
  };

  const setList = (list: 'to' | 'cc', next: string[]) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, [list]: next } : p));
  };

  // tableFields가 undefined면(=한 번도 설정 안 함) 기본 8개 전체, 빈 배열이면(=전부 끔)
  // 그대로 빈 배열로 취급 — length로만 판단하면 전부 끄자마자 다시 8개 전체로 되돌아가버림
  const activeTableFields = currentPreset?.tableFields !== undefined
    ? currentPreset.tableFields
    : MAIL_TABLE_BUILTIN_FIELDS.map(f => f.key);

  const toggleTableField = (key: string) => {
    if (!currentPreset) return;
    const allKeys = MAIL_TABLE_BUILTIN_FIELDS.map(f => f.key);
    const next = activeTableFields.includes(key)
      ? activeTableFields.filter(k => k !== key)
      : allKeys.filter(k => activeTableFields.includes(k) || k === key);
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableFields: next } : p));
  };

  const handleSetTableTitle = (title: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableTitle: title } : p));
  };

  const handleToggleTableHidden = () => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableHidden: !p.tableHidden } : p));
  };

  const mergedFormConfig = mergeFormConfig(currentPart?.formConfig, team.formConfig);
  const candidateCustomFields = mergedFormConfig?.customFields ?? [];
  const partMetaFields = currentPart?.metaFields ?? team.metaFields ?? DEFAULT_META_FIELDS;
  const partSubTaskTypes = currentPart?.subTaskTypes ?? team.subTaskTypes ?? [];
  // 필드에서 추가할 때는 타입을 따로 고를 필요 없이, 원래 필드의 속성(날짜 타입이면
  // '날짜', URL 필드면 '링크', 그 외에는 '텍스트')을 그대로 이어받아 바로 추가되게 함.
  // 세부 업무는 일반 필드가 아니라 업무별 시작일/종료일을 값으로 가져오는 항목이라
  // 별도로 구분(source: 'subtask')해 관리
  const candidateFields: { key: string; label: string; type: 'text' | 'date' | 'url'; source: 'field' | 'subtask' }[] = [
    ...partMetaFields.map(f => ({ key: f.key, label: f.label, type: (f.isUrl ? 'url' : 'text') as const, source: 'field' as const })),
    ...candidateCustomFields.map(f => ({ key: f.id, label: f.label, type: (f.type === 'date' ? 'date' : f.type === 'link' ? 'url' : 'text') as const, source: 'field' as const })),
    ...partSubTaskTypes.flatMap(st => [
      { key: `${st.id}:startDate`, label: `${st.name} (시작일)`, type: 'date' as const, source: 'subtask' as const },
      { key: `${st.id}:endDate`, label: `${st.name} (종료일)`, type: 'date' as const, source: 'subtask' as const },
    ]),
  ];

  const handleAddCustomField = () => {
    if (!currentPreset || !customSourceKey) return;
    const source = candidateFields.find(f => f.key === customSourceKey);
    if (!source) return;
    const field: MailTableCustomField = {
      id: `mtc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: source.label,
      type: source.type,
      sourceKey: source.key,
      ...(source.source === 'subtask' ? { source: 'subtask' as const } : {}),
    };
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableCustomFields: [...(p.tableCustomFields ?? []), field] } : p));
    setCustomSourceKey('');
  };

  // 팀 필드와 연결되지 않은 "사용자 입력" 항목 — 값이 미리 채워지지 않고, 메일 작성할
  // 때마다 업무 상세의 메일 양식에서 직접 입력하게 됨
  const handleAddManualField = () => {
    if (!currentPreset || !manualLabelDraft.trim()) return;
    const field: MailTableCustomField = {
      id: `mtc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: manualLabelDraft.trim(),
      type: customType,
    };
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableCustomFields: [...(p.tableCustomFields ?? []), field] } : p));
    setManualLabelDraft('');
  };

  const handleRemoveCustomField = (id: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableCustomFields: (p.tableCustomFields ?? []).filter(f => f.id !== id) } : p));
  };

  // URL 타입 항목의 실제 값(링크 주소) 대신 하이퍼링크에 표시할 고정 텍스트
  const handleSetCustomFieldLinkText = (id: string, linkText: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableCustomFields: (p.tableCustomFields ?? []).map(f => f.id === id ? { ...f, linkText } : f) } : p));
  };

  // 링크(URL) 속성이 생기기 전에 "텍스트"로 추가해둔 필드를 링크로 전환
  const handleFixFieldToUrl = (id: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableCustomFields: (p.tableCustomFields ?? []).map(f => f.id === id ? { ...f, type: 'url' } : f) } : p));
  };

  const handleSetCustomFieldLabel = (id: string, label: string) => {
    if (!currentPreset || !label.trim()) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableCustomFields: (p.tableCustomFields ?? []).map(f => f.id === id ? { ...f, label: label.trim() } : f) } : p));
  };

  // 이미 추가해둔 "사용자 입력" 항목을 세부 업무의 시작일/종료일과 연결(이름은 그대로 유지)
  const handleConnectSubTask = (id: string, subTaskKey: string) => {
    if (!currentPreset || !subTaskKey) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableCustomFields: (p.tableCustomFields ?? []).map(f => f.id === id ? { ...f, sourceKey: subTaskKey, source: 'subtask' as const } : f) } : p));
  };

  // 연결을 해제해 다시 "사용자 입력" 항목으로 되돌림
  const handleDisconnectField = (id: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableCustomFields: (p.tableCustomFields ?? []).map(f => f.id === id ? { ...f, sourceKey: undefined, source: undefined } : f) } : p));
  };

  // 표 밖 본문에 추가하는 텍스트/날짜 입력 항목 — 값이 미리 채워지지 않고, 업무 상세의
  // 메일 양식에서 메일 작성할 때마다 직접 입력함
  const handleAddBodyField = () => {
    if (!currentPreset || !bodyTitleDraft.trim()) return;
    const field: MailBodyCustomField = {
      id: `mbc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: bodyTitleDraft.trim(),
      type: bodyTypeDraft,
    };
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, bodyCustomFields: [...(p.bodyCustomFields ?? []), field] } : p));
    setBodyTitleDraft('');
  };

  const handleRemoveBodyField = (id: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, bodyCustomFields: (p.bodyCustomFields ?? []).filter(f => f.id !== id) } : p));
  };

  const handleReorderBodyField = (toIdx: number) => {
    if (!currentPreset) return;
    const from = bodyDragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...(currentPreset.bodyCustomFields ?? [])];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, bodyCustomFields: arr } : p));
    bodyDragIdxRef.current = null;
    setBodyDragOverIdx(null);
  };

  // 기존 표에 합치지 않는, 별도로 구성하는 추가 표 관리
  const handleAddExtraTable = () => {
    if (!currentPreset) return;
    const table: MailTableConfig = { id: `mtb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, customFields: [] };
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, extraTables: [...(p.extraTables ?? []), table] } : p));
    setSelectedExtraTableId(table.id);
  };

  const handleRemoveExtraTable = (id: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, extraTables: (p.extraTables ?? []).filter(t => t.id !== id) } : p));
    if (selectedExtraTableId === id) setSelectedExtraTableId('');
  };

  const handleSaveExtraTable = (next: MailTableConfig) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, extraTables: (p.extraTables ?? []).map(t => t.id === next.id ? next : t) } : p));
  };

  // "[제목]" 아래 번호가 매겨진 항목을 나열하는 목록 관리
  const handleAddListGroup = () => {
    if (!currentPreset) return;
    const group: MailListGroup = { id: `mlg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, items: [] };
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, listGroups: [...(p.listGroups ?? []), group] } : p));
    setSelectedListGroupId(group.id);
  };

  const handleRemoveListGroup = (id: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, listGroups: (p.listGroups ?? []).filter(g => g.id !== id) } : p));
    if (selectedListGroupId === id) setSelectedListGroupId('');
  };

  const handleSaveListGroup = (next: MailListGroup) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, listGroups: (p.listGroups ?? []).map(g => g.id === next.id ? next : g) } : p));
  };

  const handleSetLabelBg = (bg: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableLabelBg: bg } : p));
  };

  const handleToggleLabelBold = () => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableLabelBold: !(p.tableLabelBold ?? true) } : p));
  };

  const handleSetValueBg = (bg: string) => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableValueBg: bg } : p));
  };

  const handleToggleValueBold = () => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableValueBold: !(p.tableValueBold ?? false) } : p));
  };

  const handleToggleShowLabelColumn = () => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableShowLabelColumn: !(p.tableShowLabelColumn ?? true) } : p));
  };

  const handleToggleShowValueColumn = () => {
    if (!currentPreset) return;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableShowValueColumn: !(p.tableShowValueColumn ?? true) } : p));
  };

  // 항목(행)별 배경색/볼드 오버라이드 — 값이 모두 비면 오버라이드 자체를 지워 정리
  const setFieldStyleOverride = (key: string, patch: Partial<MailTableCellStyle>) => {
    if (!currentPreset) return;
    const cur = currentPreset.tableFieldStyles ?? {};
    const next = { ...cur[key], ...patch };
    const isEmpty = !next.labelBg && next.labelBold === undefined && !next.valueBg && next.valueBold === undefined && !next.hideRow && !next.hideLabel && !next.valuePrefix && !next.valueSuffix;
    const nextStyles = { ...cur };
    if (isEmpty) delete nextStyles[key]; else nextStyles[key] = next;
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableFieldStyles: nextStyles } : p));
  };

  const clearFieldStyleOverride = (key: string) => {
    if (!currentPreset) return;
    const nextStyles = { ...(currentPreset.tableFieldStyles ?? {}) };
    delete nextStyles[key];
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableFieldStyles: nextStyles } : p));
  };

  const naturalRowLabels: Record<string, string> = {
    ...Object.fromEntries(activeTableFields
      .map(k => MAIL_TABLE_BUILTIN_FIELDS.find(f => f.key === k))
      .filter((f): f is { key: string; label: string } => !!f)
      .map(f => [f.key, f.label])),
    ...Object.fromEntries((currentPreset?.tableCustomFields ?? []).map(f => [f.id, f.label])),
  };
  const activeRows: { key: string; label: string }[] = resolveMailTableRowOrder(
    Object.keys(naturalRowLabels),
    currentPreset?.tableRowOrder
  ).map(key => ({ key, label: naturalRowLabels[key] }));

  const handleReorderRow = (toIdx: number) => {
    const from = rowDragIdxRef.current;
    if (from === null || from === toIdx || !currentPreset) return;
    const arr = [...activeRows];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    savePresets(presets.map(p => p.id === currentPreset.id ? { ...p, tableRowOrder: arr.map(r => r.key) } : p));
    rowDragIdxRef.current = null;
    setRowDragOverIdx(null);
  };

  if (team.parts.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">먼저 파트를 추가해주세요.</p>;
  }

  return (
    <div className="space-y-4">
      {/* 파트 선택 */}
      <div className="flex items-center gap-2 flex-wrap">
        {team.parts.map(p => (
          <button key={p.id} onClick={() => setSelectedPartId(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedPartId === p.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {p.name}
          </button>
        ))}
      </div>

      {/* 이 파트의 메일 양식 탭 목록 */}
      <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-100">
        {presets.map(p => (
          <button key={p.id} onClick={() => setSelectedPresetId(p.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              currentPreset?.id === p.id ? 'border-transparent text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={currentPreset?.id === p.id ? { background: p.color } : undefined}
          >
            {p.name}
          </button>
        ))}
        <button onClick={handleAddPreset}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
          + 탭 추가
        </button>
        {flash && <span className="text-[11px] text-green-500 font-medium ml-1">저장됨</span>}
      </div>

      {!currentPreset ? (
        <p className="text-xs text-gray-400 px-1">
          이 파트에는 아직 메일 양식 탭이 없습니다. "탭 추가"로 만들어보세요.
        </p>
      ) : (
        <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-3 rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <input
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={() => { if (nameDraft.trim() && nameDraft !== currentPreset.name) handleRenamePreset(nameDraft.trim()); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="flex-1 text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="탭 이름"
            />
            <button onClick={handleDeletePreset}
              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
              탭 삭제
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEAM_COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => handleRecolorPreset(c)}
                className={`w-5 h-5 rounded-full flex-shrink-0 ${currentPreset.color === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">본문 안내 문구</p>
            <input
              value={messageDraft}
              onChange={e => setMessageDraft(e.target.value)}
              onBlur={() => { if (messageDraft.trim() && messageDraft !== currentPreset.message) handleSetMessage(messageDraft.trim()); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder={DEFAULT_MAIL_MESSAGE}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              업무 상세 메일 양식 본문의 "안녕하세요, (작성자)입니다." 인사말 다음에 들어가는 문구입니다.
            </p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${currentPreset.showTaskName ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                {currentPreset.showTaskName && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <input type="checkbox" checked={!!currentPreset.showTaskName} onChange={handleToggleShowTaskName} className="hidden" />
              <span className="text-[11px] text-gray-600">안내 문구 앞에 업무명 노출</span>
            </label>

            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-700 mb-1">삽입 항목</p>
              <p className="text-[11px] text-gray-400 mb-1.5">업무명과 안내 문구 사이에 끼워 넣을 텍스트/날짜/건수 입력 항목을 추가합니다. 값이 미리 채워지지 않고, 업무 상세의 메일 양식에서 메일 작성할 때마다 직접 입력합니다.</p>
              {(currentPreset.messageInserts ?? []).length > 0 && (
                <div className="space-y-1 mb-2">
                  {currentPreset.messageInserts!.map((ins, i) => (
                    <div key={ins.id}
                      draggable
                      onDragStart={() => { msgInsertDragIdxRef.current = i; }}
                      onDragOver={e => { e.preventDefault(); setMsgInsertDragOverIdx(i); }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMsgInsertDragOverIdx(null); }}
                      onDrop={() => handleReorderMessageInsert(i)}
                      onDragEnd={() => { msgInsertDragIdxRef.current = null; setMsgInsertDragOverIdx(null); }}
                      className={`flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 ${msgInsertDragOverIdx === i ? 'border-t-2 border-t-indigo-400' : ''}`}>
                      <GripVertical size={12} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                      <span className="flex-1">{ins.label} <span className="text-gray-400">({ins.type === 'date' ? '날짜' : ins.type === 'count' ? '건수' : '텍스트'})</span></span>
                      <button onClick={() => handleRemoveMessageInsert(ins.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <input value={msgInsertLabelDraft} onChange={e => setMsgInsertLabelDraft(e.target.value)}
                  placeholder="항목 이름 (예: 이벤트 대상)"
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none" />
                <select value={msgInsertType} onChange={e => setMsgInsertType(e.target.value as 'text' | 'date' | 'count')}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none">
                  <option value="text">텍스트</option>
                  <option value="date">날짜</option>
                  <option value="count">건수</option>
                </select>
                <button onClick={handleAddMessageInsert} disabled={!msgInsertLabelDraft.trim()}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                  추가
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            아래 지정한 인원이 이 탭의 받는사람/참조로 채워집니다.
            "@"로 팀원을 검색해 선택하거나, 외부 이메일 주소를 직접 입력할 수 있습니다. 쉼표(,)로 구분해 여러 명 추가하세요.
          </p>
          <div className="space-y-3">
            <RecipientChipInput label="받는사람" value={currentPreset.to} onChange={next => setList('to', next)} members={members} />
            <RecipientChipInput label="참조" value={currentPreset.cc} onChange={next => setList('cc', next)} members={members} />
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">표 설정</p>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${currentPreset.tableHidden ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                  {currentPreset.tableHidden && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <input type="checkbox" checked={!!currentPreset.tableHidden} onChange={handleToggleTableHidden} className="hidden" />
                <span className="text-[11px] text-gray-600">표 전체 숨김</span>
              </label>
            </div>

            <div className={currentPreset.tableHidden ? 'opacity-40 pointer-events-none space-y-3' : 'space-y-3'}>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">표 제목 (선택)</label>
              <input
                value={tableTitleDraft}
                onChange={e => setTableTitleDraft(e.target.value)}
                onBlur={() => { if (tableTitleDraft !== (currentPreset.tableTitle ?? '')) handleSetTableTitle(tableTitleDraft.trim()); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="예: 업무 정보"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <p className="text-[11px] text-gray-400 mt-1">입력하면 표 위에 "[{tableTitleDraft || '제목'}]" 형태로 볼드 표시됩니다. 비워두면 표시되지 않습니다.</p>
            </div>

            <div>
              <p className="text-[11px] text-gray-500 mb-1.5">표시할 기본 항목</p>
              <div className="flex flex-wrap gap-1.5">
                {MAIL_TABLE_BUILTIN_FIELDS.map(f => {
                  const checked = activeTableFields.includes(f.key);
                  return (
                    <button key={f.key} onClick={() => toggleTableField(f.key)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] text-gray-500 mb-1.5">추가 항목</p>
              {(currentPreset.tableCustomFields ?? []).length > 0 && (
                <div className="space-y-1 mb-2">
                  {currentPreset.tableCustomFields!.map(f => {
                    const sourceIsUrl = f.sourceKey && candidateFields.find(cf => cf.key === f.sourceKey)?.type === 'url';
                    const needsFix = sourceIsUrl && f.type !== 'url';
                    return (
                      <div key={f.id} className="flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600">
                        <InlineTextField
                          value={f.label}
                          onCommit={v => handleSetCustomFieldLabel(f.id, v)}
                          className="flex-1 min-w-0 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 -mx-1"
                        />
                        <span className="text-gray-400 flex-shrink-0">({f.type === 'date' ? '날짜' : f.type === 'url' ? '링크' : '텍스트'}{!f.sourceKey ? ' · 사용자 입력' : ''})</span>
                        {needsFix && (
                          <button onClick={() => handleFixFieldToUrl(f.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 flex-shrink-0">
                            🔗 링크로 전환
                          </button>
                        )}
                        {!f.sourceKey && f.type === 'date' && candidateFields.some(cf => cf.source === 'subtask') && (
                          <select value="" onChange={e => handleConnectSubTask(f.id, e.target.value)}
                            className="text-[10px] px-1.5 py-1 rounded-md border border-gray-200 focus:outline-none flex-shrink-0 max-w-[140px]">
                            <option value="">세부 업무 연결</option>
                            {candidateFields.filter(cf => cf.source === 'subtask').map(cf => <option key={cf.key} value={cf.key}>{cf.label}</option>)}
                          </select>
                        )}
                        {f.source === 'subtask' && (
                          <button onClick={() => handleDisconnectField(f.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 flex-shrink-0">
                            연결 해제
                          </button>
                        )}
                        {f.type === 'url' && (
                          <InlineTextField
                            value={f.linkText ?? ''}
                            onCommit={v => handleSetCustomFieldLinkText(f.id, v)}
                            placeholder="링크 텍스트 (예: 자세히 보기)"
                            className="w-40 text-[11px] px-1.5 py-1 rounded-md border border-gray-200 focus:outline-none flex-shrink-0"
                          />
                        )}
                        <button onClick={() => handleRemoveCustomField(f.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-1 mb-1.5">
                <button onClick={() => setAddMode('field')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${addMode === 'field' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  필드에서 추가
                </button>
                <button onClick={() => setAddMode('manual')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${addMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  사용자 입력 항목
                </button>
              </div>
              {addMode === 'field' ? (
                candidateFields.length === 0 ? (
                  <p className="text-[11px] text-gray-400">추가할 수 있는 필드가 없습니다. 팀 관리에서 필드를 먼저 만들어주세요.</p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select value={customSourceKey} onChange={e => setCustomSourceKey(e.target.value)}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none">
                      <option value="">필드 선택</option>
                      <optgroup label="필드">
                        {candidateFields.filter(f => f.source === 'field').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </optgroup>
                      {candidateFields.some(f => f.source === 'subtask') && (
                        <optgroup label="세부 업무">
                          {candidateFields.filter(f => f.source === 'subtask').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <button onClick={handleAddCustomField} disabled={!customSourceKey}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                      추가
                    </button>
                  </div>
                )
              ) : (
                <div>
                  <div className="flex items-center gap-1.5">
                    <input value={manualLabelDraft} onChange={e => setManualLabelDraft(e.target.value)}
                      placeholder="항목 이름 (예: 특이사항)"
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none" />
                    <select value={customType} onChange={e => setCustomType(e.target.value as 'text' | 'date' | 'url')}
                      className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none">
                      <option value="text">텍스트</option>
                      <option value="date">날짜</option>
                      <option value="url">링크(URL)</option>
                    </select>
                    <button onClick={handleAddManualField} disabled={!manualLabelDraft.trim()}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                      추가
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">값이 미리 채워지지 않고, 업무 상세의 메일 양식에서 메일 작성할 때마다 직접 입력합니다.</p>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${(currentPreset.tableShowLabelColumn ?? true) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                {(currentPreset.tableShowLabelColumn ?? true) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <input type="checkbox" checked={currentPreset.tableShowLabelColumn ?? true} onChange={handleToggleShowLabelColumn} className="hidden" />
              <span className="text-[11px] text-gray-600">항목명 칸 표시 (끄면 내용 칸만 표시)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${(currentPreset.tableShowValueColumn ?? true) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                {(currentPreset.tableShowValueColumn ?? true) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <input type="checkbox" checked={currentPreset.tableShowValueColumn ?? true} onChange={handleToggleShowValueColumn} className="hidden" />
              <span className="text-[11px] text-gray-600">내용 칸 표시 (끄면 항목명 칸만 표시)</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div className={(currentPreset.tableShowLabelColumn ?? true) ? '' : 'opacity-40 pointer-events-none'}>
                <p className="text-[11px] text-gray-500 mb-1.5">항목명 칸 기본값</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {MAIL_TABLE_BG_PRESETS.map(c => (
                    <button key={c} onClick={() => handleSetLabelBg(c)}
                      className={`w-5 h-5 rounded-full flex-shrink-0 border border-gray-200 ${(currentPreset.tableLabelBg ?? '#f9fafb') === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${(currentPreset.tableLabelBold ?? true) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                    {(currentPreset.tableLabelBold ?? true) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <input type="checkbox" checked={currentPreset.tableLabelBold ?? true} onChange={handleToggleLabelBold} className="hidden" />
                  <span className="text-[11px] text-gray-600">볼드</span>
                </label>
              </div>
              <div className={(currentPreset.tableShowValueColumn ?? true) ? '' : 'opacity-40 pointer-events-none'}>
                <p className="text-[11px] text-gray-500 mb-1.5">내용 칸 기본값</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {MAIL_TABLE_BG_PRESETS.map(c => (
                    <button key={c} onClick={() => handleSetValueBg(c)}
                      className={`w-5 h-5 rounded-full flex-shrink-0 border border-gray-200 ${(currentPreset.tableValueBg ?? '#ffffff') === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${(currentPreset.tableValueBold ?? false) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                    {(currentPreset.tableValueBold ?? false) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <input type="checkbox" checked={currentPreset.tableValueBold ?? false} onChange={handleToggleValueBold} className="hidden" />
                  <span className="text-[11px] text-gray-600">볼드</span>
                </label>
              </div>
            </div>

            {activeRows.length > 0 && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1.5">
                  항목별 스타일 재정의 (선택 — 지정하지 않으면 위 기본값 사용)
                  <span className="text-gray-300 font-normal ml-1">드래그로 표에 표시될 순서 변경</span>
                </p>
                <div className="space-y-2">
                  {activeRows.map((row, i) => {
                    const override = currentPreset.tableFieldStyles?.[row.key];
                    const effLabelBg = override?.labelBg || currentPreset.tableLabelBg || '#f9fafb';
                    const effLabelBold = override?.labelBold ?? currentPreset.tableLabelBold ?? true;
                    const effValueBg = override?.valueBg || currentPreset.tableValueBg || '#ffffff';
                    const effValueBold = override?.valueBold ?? currentPreset.tableValueBold ?? false;
                    const hasOverride = !!override && Object.keys(override).length > 0;
                    const showLabelCol = currentPreset.tableShowLabelColumn ?? true;
                    const isRowHidden = override?.hideRow ?? false;
                    const isLabelHidden = override?.hideLabel ?? false;
                    return (
                      <div key={row.key}
                        draggable
                        onDragStart={() => { rowDragIdxRef.current = i; }}
                        onDragOver={e => { e.preventDefault(); setRowDragOverIdx(i); }}
                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRowDragOverIdx(null); }}
                        onDrop={() => handleReorderRow(i)}
                        onDragEnd={() => { rowDragIdxRef.current = null; setRowDragOverIdx(null); }}
                        className={`rounded-lg border border-gray-100 p-2.5 space-y-1.5 ${rowDragOverIdx === i ? 'border-t-2 border-t-indigo-400' : ''}`}>
                        <div className="flex items-center justify-between flex-wrap gap-y-1">
                          <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${isRowHidden ? 'text-gray-300' : 'text-gray-700'}`}>
                            <GripVertical size={12} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                            {row.label}
                            {isRowHidden && <span className="text-[10px] font-normal text-gray-400">(숨김)</span>}
                          </span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${isRowHidden ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                                {isRowHidden && <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              <input type="checkbox" checked={isRowHidden} onChange={() => setFieldStyleOverride(row.key, { hideRow: !isRowHidden })} className="hidden" />
                              <span className="text-[10px] text-gray-500">전체 숨김</span>
                            </label>
                            <label className={`flex items-center gap-1.5 cursor-pointer select-none ${showLabelCol && !isRowHidden ? '' : 'opacity-40 pointer-events-none'}`}>
                              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${isLabelHidden ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                                {isLabelHidden && <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              <input type="checkbox" checked={isLabelHidden} onChange={() => setFieldStyleOverride(row.key, { hideLabel: !isLabelHidden })} className="hidden" />
                              <span className="text-[10px] text-gray-500">항목명 숨김</span>
                            </label>
                            {hasOverride && (
                              <button onClick={() => clearFieldStyleOverride(row.key)} className="text-[10px] text-gray-400 hover:text-red-500">
                                기본값으로
                              </button>
                            )}
                          </div>
                        </div>
                        <div className={`grid grid-cols-2 gap-3 ${isRowHidden ? 'opacity-30 pointer-events-none' : ''}`}>
                          <div className={`flex items-center gap-1 flex-wrap ${showLabelCol && !isLabelHidden ? '' : 'opacity-40 pointer-events-none'}`}>
                            <span className="text-[10px] text-gray-400 flex-shrink-0 w-9">항목명</span>
                            {MAIL_TABLE_BG_PRESETS.map(c => (
                              <button key={c} onClick={() => setFieldStyleOverride(row.key, { labelBg: c })}
                                className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border border-gray-200 ${effLabelBg === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                style={{ background: c }}
                              />
                            ))}
                            <button onClick={() => setFieldStyleOverride(row.key, { labelBold: !effLabelBold })}
                              className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 font-bold ${effLabelBold ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                              B
                            </button>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-gray-400 flex-shrink-0 w-9">내용</span>
                            {MAIL_TABLE_BG_PRESETS.map(c => (
                              <button key={c} onClick={() => setFieldStyleOverride(row.key, { valueBg: c })}
                                className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border border-gray-200 ${effValueBg === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                style={{ background: c }}
                              />
                            ))}
                            <button onClick={() => setFieldStyleOverride(row.key, { valueBold: !effValueBold })}
                              className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 font-bold ${effValueBold ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                              B
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 flex-shrink-0 w-9">값 앞</span>
                            <InlineTextField
                              value={override?.valuePrefix ?? ''}
                              onCommit={v => setFieldStyleOverride(row.key, { valuePrefix: v })}
                              placeholder="예: 예정 "
                              className="flex-1 min-w-0 text-[11px] px-1.5 py-1 rounded-md border border-gray-200 focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 flex-shrink-0 w-9">값 뒤</span>
                            <InlineTextField
                              value={override?.valueSuffix ?? ''}
                              onCommit={v => setFieldStyleOverride(row.key, { valueSuffix: v })}
                              placeholder="예:  완료"
                              className="flex-1 min-w-0 text-[11px] px-1.5 py-1 rounded-md border border-gray-200 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-700">별도 표 추가</p>
            <p className="text-[11px] text-gray-400">위 표에 합쳐지지 않는, 완전히 독립된 표를 추가로 구성합니다. 항목은 필드에서 가져오거나 메일 작성할 때마다 직접 입력하는 것으로 만들 수 있습니다.</p>
            <div className="flex items-center gap-2 flex-wrap">
              {(currentPreset.extraTables ?? []).map((t, i) => (
                <button key={t.id} onClick={() => setSelectedExtraTableId(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedExtraTableId === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {t.title || `표 ${i + 2}`}
                </button>
              ))}
              <button onClick={handleAddExtraTable}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                + 표 추가
              </button>
            </div>
            {(() => {
              const selectedExtraTable = (currentPreset.extraTables ?? []).find(t => t.id === selectedExtraTableId);
              if (!selectedExtraTable) return null;
              return (
                <ExtraTableEditor
                  table={selectedExtraTable}
                  candidateFields={candidateFields}
                  onSave={handleSaveExtraTable}
                  onRemove={() => handleRemoveExtraTable(selectedExtraTable.id)}
                />
              );
            })()}
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-700">번호 목록 추가</p>
            <p className="text-[11px] text-gray-400">"[제목]" 아래 "1. 항목명" 형태로 번호가 매겨진 항목을 나열하는 목록을 추가합니다. 예: [SNS 공유 이미지] / 1. 방송 안내 페이지 / 2. 방송 페이지</p>
            <div className="flex items-center gap-2 flex-wrap">
              {(currentPreset.listGroups ?? []).map((g, i) => (
                <button key={g.id} onClick={() => setSelectedListGroupId(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedListGroupId === g.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {g.title || `목록 ${i + 1}`}
                </button>
              ))}
              <button onClick={handleAddListGroup}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                + 목록 추가
              </button>
            </div>
            {(() => {
              const selectedListGroup = (currentPreset.listGroups ?? []).find(g => g.id === selectedListGroupId);
              if (!selectedListGroup) return null;
              return (
                <MailListGroupEditor
                  group={selectedListGroup}
                  candidateFields={candidateFields.filter((f): f is { key: string; label: string; type: 'text' | 'date'; source: 'field' } => f.type !== 'url' && f.source !== 'subtask')}
                  onSave={handleSaveListGroup}
                  onRemove={() => handleRemoveListGroup(selectedListGroup.id)}
                />
              );
            })()}
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-700">본문 추가 항목</p>
            <p className="text-[11px] text-gray-400">표 밖 본문에 텍스트/날짜를 직접 입력하는 항목을 추가합니다. 값이 미리 채워지지 않고, 업무 상세의 메일 양식에서 메일 작성할 때마다 직접 입력합니다.</p>
            {(currentPreset.bodyCustomFields ?? []).length > 0 && (
              <div className="space-y-1">
                {currentPreset.bodyCustomFields!.map((f, i) => (
                  <div key={f.id}
                    draggable
                    onDragStart={() => { bodyDragIdxRef.current = i; }}
                    onDragOver={e => { e.preventDefault(); setBodyDragOverIdx(i); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setBodyDragOverIdx(null); }}
                    onDrop={() => handleReorderBodyField(i)}
                    onDragEnd={() => { bodyDragIdxRef.current = null; setBodyDragOverIdx(null); }}
                    className={`flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 ${bodyDragOverIdx === i ? 'border-t-2 border-t-indigo-400' : ''}`}>
                    <GripVertical size={12} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                    <span className="flex-1">{f.title} <span className="text-gray-400">({f.type === 'date' ? '날짜' : '텍스트'})</span></span>
                    <button onClick={() => handleRemoveBodyField(f.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <input value={bodyTitleDraft} onChange={e => setBodyTitleDraft(e.target.value)}
                placeholder="제목 (예: 다음 미팅 일정)"
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none" />
              <select value={bodyTypeDraft} onChange={e => setBodyTypeDraft(e.target.value as 'text' | 'date')}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none">
                <option value="text">텍스트</option>
                <option value="date">날짜</option>
              </select>
              <button onClick={handleAddBodyField} disabled={!bodyTitleDraft.trim()}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                추가
              </button>
            </div>
          </div>
        </div>
        <div className="w-[560px] flex-shrink-0">
          <MailBodyPreview part={currentPart} preset={currentPreset} members={members} />
        </div>
        </div>
      )}
    </div>
  );
}

function TeamSection({ teams, globalRolePermissions, onCreateTeam, onUpdateTeam, onSetParts, onDeleteTeam, onReorderTeams, onUpdateFormConfig, onUpdateAllFormConfig, onClearAllFormConfig, onUpdatePartFormConfig, onClearPartFormConfig, onUpdateMetaFields, onUpdatePartMetaFields, onClearPartMetaFields, onUpdateSubTaskTypes, onUpdatePartSubTaskTypes, onClearPartSubTaskTypes, onUpdatePartCalendarOrder, onClearPartCalendarOrder, onUpdatePartPLShowInCalendar, onClearPartPLShowInCalendar, onUpdatePartCopyIncludeDetails, onClearPartCopyIncludeDetails, onUpdatePartTaskListTwoLine, onClearPartTaskListTwoLine, onUpdatePartMainTaskEndDateLabel, onClearPartMainTaskEndDateLabel, onUpdatePartMainTaskEndDateShow, onClearPartMainTaskEndDateShow, onUpdatePartMainTaskEndDateColor, onClearPartMainTaskEndDateColor, onUpdateRevisionSteps, onUpdatePartRevisionSteps, onClearPartRevisionSteps, onUpdatePlMainTaskTypes, onUpdateExcelConfig, onUpdatePartExcelConfig, onClearPartExcelConfig, onUpdatePartWeeklyConfig, onClearPartWeeklyConfig, onUpdatePartMailFormConfig, onClearPartMailFormConfig, allUsers }: {
  teams: Team[];
  globalRolePermissions: RolePermissions;
  onCreateTeam: (name: string, emoji: string) => Promise<string>;
  onUpdateTeam: (teamId: string, data: Partial<Omit<Team, 'id'>>) => Promise<void>;
  onSetParts: (teamId: string, parts: TeamPart[]) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onReorderTeams: (ordered: Team[]) => Promise<void>;
  onUpdateFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onUpdateAllFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onClearAllFormConfig: (teamId: string) => Promise<void>;
  onUpdatePartFormConfig: (teamId: string, partId: string, config: TeamFormConfig) => Promise<void>;
  onClearPartFormConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdateMetaFields: (teamId: string, fields: MetaField[]) => Promise<void>;
  onUpdatePartMetaFields: (teamId: string, partId: string, fields: MetaField[]) => Promise<void>;
  onClearPartMetaFields: (teamId: string, partId: string) => Promise<void>;
  onUpdateSubTaskTypes: (teamId: string, types: SubTaskType[]) => Promise<void>;
  onUpdatePartSubTaskTypes: (teamId: string, partId: string, types: SubTaskType[]) => Promise<void>;
  onClearPartSubTaskTypes: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartCalendarOrder: (teamId: string, partId: string, order: string[]) => Promise<void>;
  onClearPartCalendarOrder: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartPLShowInCalendar: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartPLShowInCalendar: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartCopyIncludeDetails: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartCopyIncludeDetails: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartTaskListTwoLine: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartTaskListTwoLine: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateLabel: (teamId: string, partId: string, label: string) => Promise<void>;
  onClearPartMainTaskEndDateLabel: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateShow: (teamId: string, partId: string, value: boolean) => Promise<void>;
  onClearPartMainTaskEndDateShow: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMainTaskEndDateColor: (teamId: string, partId: string, color: string) => Promise<void>;
  onClearPartMainTaskEndDateColor: (teamId: string, partId: string) => Promise<void>;
  onUpdateRevisionSteps: (teamId: string, steps: RevisionStep[]) => Promise<void>;
  onUpdatePartRevisionSteps: (teamId: string, partId: string, steps: RevisionStep[]) => Promise<void>;
  onClearPartRevisionSteps: (teamId: string, partId: string) => Promise<void>;
  onUpdatePlMainTaskTypes: (teamId: string, types: PLMainTaskType[]) => Promise<void>;
  onUpdateExcelConfig: (teamId: string, config: ExcelFieldConfig[]) => Promise<void>;
  onUpdatePartExcelConfig: (teamId: string, partId: string, config: ExcelFieldConfig[]) => Promise<void>;
  onClearPartExcelConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartWeeklyConfig: (teamId: string, partId: string, config: WeeklyExportConfig) => Promise<void>;
  onClearPartWeeklyConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdatePartMailFormConfig: (teamId: string, partId: string, config: MailFormPreset[]) => Promise<void>;
  onClearPartMailFormConfig: (teamId: string, partId: string) => Promise<void>;
  allUsers: AppUser[];
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🚀');
  const [saving, setSaving] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [teamTab, setTeamTab] = useState<Record<string, 'parts' | 'form' | 'meta' | 'subtask' | 'calendar' | 'pl' | 'excel' | 'weekly' | 'mail' | 'permission' | 'support' | 'revision'>>({});
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [colorPickerTeamId, setColorPickerTeamId] = useState<string | null>(null);
  const [partName, setPartName] = useState('');
  const [partColor, setPartColor] = useState(PART_COLORS[0].cls);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingPartName, setEditingPartName] = useState('');
  const [editingPartColor, setEditingPartColor] = useState(PART_COLORS[0].cls);
  const [editingPartDepts, setEditingPartDepts] = useState<Department[]>([]);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);
  const [draggingTeamId, setDraggingTeamId] = useState<string | null>(null);
  const dragTeamIdRef = useRef<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const id = await onCreateTeam(newName.trim(), newEmoji);
    setNewName(''); setNewEmoji('🚀'); setCreating(false); setSaving(false);
    setExpandedTeam(id);
  };

  const handleAddPart = async (team: Team) => {
    if (!partName.trim()) return;
    const newPart: TeamPart = {
      id: `${Date.now()}`,
      name: partName.trim(),
      color: partColor,
    };
    await onSetParts(team.id, [...team.parts, newPart]);
    setPartName('');
  };

  const handleDeletePart = async (team: Team, partId: string) => {
    await onSetParts(team.id, team.parts.filter(p => p.id !== partId));
  };

  const handleSavePartEdit = async (team: Team) => {
    if (!editingPartId || !editingPartName.trim()) return;
    const oldName = team.parts.find(p => p.id === editingPartId)?.name;
    const newName = editingPartName.trim();
    const updated = team.parts.map(p =>
      p.id === editingPartId
        ? { ...p, name: newName, color: editingPartColor, departments: editingPartDepts.length ? editingPartDepts : undefined }
        : p
    );
    await onSetParts(team.id, updated);
    if (oldName && oldName !== newName) {
      await migratePartRenameToTasks(team.id, oldName, newName);
    }
    setEditingPartId(null);
  };

  // 파트 이름을 바꿀 때 그 이름을 참조하던 기존 업무의 category/plParts도 새 이름으로 갱신
  // (하지 않으면 업무가 어떤 파트에도 매칭되지 않는 "고아" 상태가 되어 화면에서 사라짐)
  const migratePartRenameToTasks = async (teamId: string, oldName: string, newName: string) => {
    const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('teamId', '==', teamId)));
    const toUpdate = tasksSnap.docs.filter(d => {
      const data = d.data();
      return data.category === oldName || (Array.isArray(data.plParts) && data.plParts.includes(oldName));
    });
    for (let i = 0; i < toUpdate.length; i += 499) {
      const batch = writeBatch(db);
      toUpdate.slice(i, i + 499).forEach(taskDoc => {
        const data = taskDoc.data();
        const patch: Record<string, unknown> = {};
        if (data.category === oldName) patch.category = newName;
        if (Array.isArray(data.plParts) && data.plParts.includes(oldName)) {
          patch.plParts = data.plParts.map((p: string) => p === oldName ? newName : p);
        }
        batch.update(doc(db, 'tasks', taskDoc.id), patch);
      });
      await batch.commit();
    }
  };

  return (
    // 메일 관리 탭의 본문 미리보기가 position:sticky로 붙어야 하는데, glass-card의
    // overflow:hidden이 있으면 페이지 스크롤 기준으로 sticky가 동작하지 않아 noclip 버전 사용
    <section className="glass-card-noclip">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">팀 관리</span>
          <span className="text-xs text-gray-400">{teams.length}개</span>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors">
            <Plus size={13} />팀 추가
          </button>
        )}
      </div>

      {/* 팀 생성 폼 */}
      {creating && (
        <div className="px-5 py-4 border-b border-black/[0.04] space-y-3">
          <p className="text-xs font-semibold text-gray-600">새 팀 만들기</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">이모지 선택</label>
            <div className="p-2 rounded-xl border border-black/8 bg-black/2">
              <EmojiPicker value={newEmoji} onChange={setNewEmoji} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">팀 이름</label>
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="팀 이름 입력"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xl flex-shrink-0">
              {newEmoji}
            </div>
            <div className="flex-1 flex gap-2">
              <button onClick={handleCreate} disabled={saving || !newName.trim()}
                className="px-4 py-2 rounded-lg text-xs font-semibold btn-shiny-primary disabled:opacity-50">
                {saving ? '저장 중...' : '팀 생성'}
              </button>
              <button onClick={() => { setCreating(false); setNewName(''); setNewEmoji('🚀'); }}
                className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 팀 목록 */}
      {teams.length === 0 && !creating ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">생성된 팀이 없습니다</p>
      ) : (
        <div className="divide-y divide-black/[0.04]">
          {teams.map(team => (
            <div key={team.id}
              draggable
              onDragStart={() => { dragTeamIdRef.current = team.id; setDraggingTeamId(team.id); }}
              onDragOver={e => { e.preventDefault(); if (dragTeamIdRef.current !== team.id) setDragOverTeamId(team.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTeamId(null); }}
              onDrop={() => {
                const fromId = dragTeamIdRef.current;
                if (!fromId || fromId === team.id) { dragTeamIdRef.current = null; setDragOverTeamId(null); setDraggingTeamId(null); return; }
                const next = [...teams];
                const fromIdx = next.findIndex(t => t.id === fromId);
                const toIdx = next.findIndex(t => t.id === team.id);
                if (fromIdx !== -1 && toIdx !== -1) {
                  const [moved] = next.splice(fromIdx, 1);
                  next.splice(toIdx, 0, moved);
                  onReorderTeams(next);
                }
                dragTeamIdRef.current = null; setDragOverTeamId(null); setDraggingTeamId(null);
              }}
              onDragEnd={() => { dragTeamIdRef.current = null; setDragOverTeamId(null); setDraggingTeamId(null); }}
              className={`transition-all ${dragOverTeamId === team.id ? 'border-t-2 border-blue-400' : ''}`}
              style={{ opacity: draggingTeamId === team.id ? 0.4 : 1 }}>
              {/* 팀 헤더 */}
              <div className="px-5 py-3 hover:bg-black/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  {/* 드래그 핸들 */}
                  <GripVertical size={14} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0 -ml-1" />
                  {/* 색상 + 이모지 원 (클릭 → 인라인 색상 팔레트) */}
                  <button
                    onClick={() => setColorPickerTeamId(colorPickerTeamId === team.id ? null : team.id)}
                    style={{ backgroundColor: team.color ?? '#3b82f6' }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all hover:scale-105">
                    {team.emoji}
                  </button>
                  <div className="flex-1 min-w-0">
                    {editingTeamId === team.id ? (
                      <input
                        autoFocus
                        value={editingTeamName}
                        onChange={e => setEditingTeamName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editingTeamName.trim()) {
                            onUpdateTeam(team.id, { name: editingTeamName.trim() });
                            setEditingTeamId(null);
                          }
                          if (e.key === 'Escape') setEditingTeamId(null);
                        }}
                        onBlur={() => {
                          if (editingTeamName.trim()) onUpdateTeam(team.id, { name: editingTeamName.trim() });
                          setEditingTeamId(null);
                        }}
                        className="text-sm font-semibold text-gray-900 w-full px-2 py-0.5 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                      />
                    ) : (
                      <button onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name); }}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-600 text-left w-full truncate">
                        {team.name}
                      </button>
                    )}
                    <p className="text-xs text-gray-400">{team.parts.length}개 파트</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                      className="text-xs text-blue-500 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                      {expandedTeam === team.id ? '닫기' : '팀 설정'}
                    </button>
                    <button onClick={() => { if (confirm(`"${team.name}" 팀을 삭제하시겠습니까?`)) onDeleteTeam(team.id); }}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {/* 인라인 색상 팔레트 + 이모지 피커 */}
                {colorPickerTeamId === team.id && (
                  <div className="mt-2 ml-11 space-y-2">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 22px)', gap: 4 }}>
                      {TEAM_COLOR_PRESETS.map(hex => (
                        <button key={hex}
                          onClick={() => { onUpdateTeam(team.id, { color: hex }); }}
                          style={{
                            width: 22, height: 22,
                            borderRadius: '50%',
                            backgroundColor: hex,
                            padding: 0,
                            border: 'none',
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                            outline: team.color === hex ? '2px solid #6b7280' : 'none',
                            outlineOffset: 2,
                          }} />
                      ))}
                    </div>
                    <div className="p-1.5 rounded-xl border border-black/8 bg-black/[0.02]">
                      <EmojiPicker value={team.emoji} onChange={emoji => onUpdateTeam(team.id, { emoji })} />
                    </div>
                  </div>
                )}
              </div>

              {/* 팀 설정 패널 (파트 / 폼 설정 탭) */}
              {expandedTeam === team.id && (
                <div className="bg-black/[0.015]">
                  {/* 탭 */}
                  <div className="flex border-b border-black/5 px-5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                    {(['parts', 'form', 'meta', 'subtask', 'calendar', 'revision', 'pl', 'excel', 'weekly', 'mail', 'permission', 'support'] as const).map(tab => (
                      <button key={tab}
                        onClick={() => setTeamTab(t => ({ ...t, [team.id]: tab }))}
                        className={`flex-shrink-0 px-3 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                          (teamTab[team.id] ?? 'parts') === tab
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}>
                        {tab === 'parts' ? '파트 관리' : tab === 'form' ? '폼 설정' : tab === 'meta' ? '업무 정보 필드' : tab === 'subtask' ? '세부 업무' : tab === 'calendar' ? '캘린더 관리' : tab === 'revision' ? '수정단계' : tab === 'pl' ? 'PL업무' : tab === 'excel' ? '엑셀 관리' : tab === 'weekly' ? '위클리 관리' : tab === 'mail' ? '메일 양식' : tab === 'permission' ? '권한' : '지원팀'}
                      </button>
                    ))}
                  </div>

                  {/* 파트 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'parts' && (
                    <div className="px-5 py-4 space-y-3">
                      {team.parts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {team.parts.map(p => (
                            editingPartId === p.id ? (
                              <div key={p.id} className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                                <div className="flex gap-1">
                                  {PART_COLORS.map(c => (
                                    <button key={c.cls} type="button" onClick={() => setEditingPartColor(c.cls)}
                                      className={`w-4 h-4 rounded-full transition-all ${c.cls} ${editingPartColor === c.cls ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'}`} />
                                  ))}
                                </div>
                                <input
                                  value={editingPartName} onChange={e => setEditingPartName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleSavePartEdit(team); if (e.key === 'Escape') setEditingPartId(null); }}
                                  autoFocus
                                  className="text-xs px-1.5 py-0.5 rounded border border-blue-300 bg-white focus:outline-none w-24 text-gray-900"
                                />
                                <div className="flex gap-1">
                                  {(['기획','디자인','퍼블'] as Department[]).map(d => (
                                    <button key={d} type="button"
                                      onClick={() => setEditingPartDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${editingPartDepts.includes(d) ? DEPT_COLOR[d] : 'bg-gray-100 text-gray-400'}`}>
                                      {d}
                                    </button>
                                  ))}
                                </div>
                                <button onClick={() => handleSavePartEdit(team)}
                                  className="text-blue-500 hover:text-blue-700 transition-colors">
                                  <Check size={11} />
                                </button>
                                <button onClick={() => setEditingPartId(null)}
                                  className="text-gray-300 hover:text-gray-500 transition-colors">
                                  <X size={10} />
                                </button>
                              </div>
                            ) : (
                              <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-black/8 text-xs group">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                                <span className="text-gray-700 font-medium">{p.name}</span>
                                <button onClick={() => { setEditingPartId(p.id); setEditingPartName(p.name); setEditingPartColor(p.color); setEditingPartDepts(p.departments ?? []); }}
                                  className="text-gray-300 hover:text-blue-400 transition-colors">
                                  <Pencil size={9} />
                                </button>
                                <button onClick={() => handleDeletePart(team, p.id)}
                                  className="text-gray-300 hover:text-red-400 transition-colors">
                                  <X size={10} />
                                </button>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {PART_COLORS.map(c => (
                            <button key={c.cls} type="button" onClick={() => setPartColor(c.cls)}
                              className={`w-5 h-5 rounded-full transition-all ${c.cls} ${partColor === c.cls ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'}`} />
                          ))}
                        </div>
                        <input
                          value={partName} onChange={e => setPartName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddPart(team)}
                          placeholder="파트 이름"
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <button onClick={() => handleAddPart(team)} disabled={!partName.trim()}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
                          <Plus size={11} />추가
                        </button>
                      </div>

                      {/* 업무 복사 설정 */}
                      <div className="pt-3 mt-1 border-t border-gray-100 space-y-2">
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">업무 복사 시 세부사항 포함 (팀 기본값)</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              켜면 세부업무/커스텀필드/메모 등 입력된 모든 값을 그대로 복사합니다. 끄면 기본 정보(월/파트/제목/담당자 등)만 복사하고 나머지는 초기화합니다.
                            </p>
                          </div>
                          <PermToggle
                            checked={team.copyIncludeDetails ?? false}
                            onChange={() => onUpdateTeam(team.id, { copyIncludeDetails: !(team.copyIncludeDetails ?? false) })}
                          />
                        </div>
                        {team.parts.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-400 px-0.5">파트별로 다르게 설정하려면 아래에서 개별 지정하세요 (기본은 팀 설정 상속)</p>
                            {team.parts.map(p => {
                              const inherited = p.copyIncludeDetails === undefined;
                              const effective = resolveCopyIncludeDetails(team, p);
                              return (
                                <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-50">
                                  <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.color}`} />
                                    {p.name}
                                    <span className={`text-[9px] ${inherited ? 'text-gray-400' : 'text-blue-500'}`}>
                                      {inherited ? '(팀 기본 상속)' : '(별도 설정)'}
                                    </span>
                                  </span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {!inherited && (
                                      <button
                                        onClick={() => onClearPartCopyIncludeDetails(team.id, p.id)}
                                        className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                                        <RotateCcw size={10} />팀 기본으로
                                      </button>
                                    )}
                                    <PermToggle
                                      checked={effective}
                                      onChange={() => onUpdatePartCopyIncludeDetails(team.id, p.id, !effective)}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 폼 설정 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'form' && (
                    <div className="px-5 py-4">
                      <FormBuilder
                        team={team}
                        onUpdateFormConfig={onUpdateFormConfig}
                        onUpdateAllFormConfig={onUpdateAllFormConfig}
                        onClearAllFormConfig={onClearAllFormConfig}
                        onUpdatePartFormConfig={onUpdatePartFormConfig}
                        onClearPartFormConfig={onClearPartFormConfig}
                        onUpdateTeam={onUpdateTeam}
                        onUpdatePartTaskListTwoLine={onUpdatePartTaskListTwoLine}
                        onClearPartTaskListTwoLine={onClearPartTaskListTwoLine}
                      />
                    </div>
                  )}

                  {/* 업무 정보 필드 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'meta' && (
                    <div className="px-5 py-4">
                      <MetaFieldsEditor
                        team={team}
                        onSave={onUpdateMetaFields}
                        onSavePart={onUpdatePartMetaFields}
                        onClearPart={onClearPartMetaFields}
                      />
                    </div>
                  )}

                  {/* 세부 업무 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'subtask' && (
                    <div className="px-5 py-4">
                      <SubTaskTypesEditor
                        team={team}
                        onSave={onUpdateSubTaskTypes}
                        onSavePart={onUpdatePartSubTaskTypes}
                        onClearPart={onClearPartSubTaskTypes}
                      />
                    </div>
                  )}

                  {/* 캘린더 관리 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'calendar' && (
                    <div className="px-5 py-4">
                      <CalendarDisplayEditor
                        team={team}
                        onSaveTypes={onUpdateSubTaskTypes}
                        onSavePartTypes={onUpdatePartSubTaskTypes}
                        onUpdateTeam={onUpdateTeam}
                        onSavePartCalendarOrder={onUpdatePartCalendarOrder}
                        onClearPartCalendarOrder={onClearPartCalendarOrder}
                        onUpdatePartPLShowInCalendar={onUpdatePartPLShowInCalendar}
                        onClearPartPLShowInCalendar={onClearPartPLShowInCalendar}
                        onUpdatePartMainTaskEndDateLabel={onUpdatePartMainTaskEndDateLabel}
                        onClearPartMainTaskEndDateLabel={onClearPartMainTaskEndDateLabel}
                        onUpdatePartMainTaskEndDateShow={onUpdatePartMainTaskEndDateShow}
                        onClearPartMainTaskEndDateShow={onClearPartMainTaskEndDateShow}
                        onUpdatePartMainTaskEndDateColor={onUpdatePartMainTaskEndDateColor}
                        onClearPartMainTaskEndDateColor={onClearPartMainTaskEndDateColor}
                      />
                    </div>
                  )}

                  {/* 수정단계 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'revision' && (
                    <div className="px-5 py-4">
                      <RevisionStepsEditor
                        team={team}
                        onSave={onUpdateRevisionSteps}
                        onSavePart={onUpdatePartRevisionSteps}
                        onClearPart={onClearPartRevisionSteps}
                      />
                    </div>
                  )}

                  {/* PL업무 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'pl' && (
                    <div className="px-5 py-4">
                      <PLMainTaskTypesEditor
                        team={team}
                        onSave={onUpdatePlMainTaskTypes}
                      />
                    </div>
                  )}

                  {/* 엑셀 관리 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'excel' && (
                    <div className="px-5 py-4">
                      <ExcelFieldManager team={team} onSave={onUpdateExcelConfig} onSavePart={onUpdatePartExcelConfig} onClearPart={onClearPartExcelConfig} />
                    </div>
                  )}

                  {/* 위클리 관리 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'weekly' && (
                    <div className="px-5 py-4">
                      <WeeklyExportManager
                        team={team}
                        onSave={cfg => onUpdateTeam(team.id, { weeklyExportConfig: cfg })}
                        onSavePart={onUpdatePartWeeklyConfig}
                        onClearPart={onClearPartWeeklyConfig}
                      />
                    </div>
                  )}

                  {/* 메일 양식 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'mail' && (
                    <div className="px-5 py-4">
                      <MailFormConfigManager
                        team={team}
                        members={allUsers
                          .map(u => ({ name: u.displayName, department: u.department }))
                          .sort((a, b) => a.name.localeCompare(b.name, 'ko'))}
                        onSavePart={onUpdatePartMailFormConfig}
                        onClearPart={onClearPartMailFormConfig}
                      />
                    </div>
                  )}

                  {/* 권한 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'permission' && (
                    <div className="px-5 py-4 space-y-4">
                      {/* 팀 개별 권한 활성화 토글 */}
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">팀 개별 권한 사용</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">활성화 시 전체 기본 설정을 무시하고 이 팀에만 적용되는 권한을 설정합니다</p>
                        </div>
                        <PermToggle
                          checked={!!team.rolePermissions}
                          onChange={() => {
                            if (team.rolePermissions) {
                              onUpdateTeam(team.id, { rolePermissions: null });
                            } else {
                              onUpdateTeam(team.id, { rolePermissions: globalRolePermissions });
                            }
                          }}
                        />
                      </div>

                      {/* 권한 토글 테이블 */}
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="text-left py-2.5 px-4 text-gray-400 font-medium">기능</th>
                              <th className="py-2.5 px-4 text-center w-28">
                                <span className={team.rolePermissions ? '' : 'opacity-40'}><RoleBadge role="manager" /></span>
                              </th>
                              <th className="py-2.5 px-4 text-center w-28">
                                <span className={team.rolePermissions ? '' : 'opacity-40'}><RoleBadge role="user" /></span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(['업무', '설정', '게시판'] as const).map(group => (
                              <>
                                <tr key={`g-${group}`} className="bg-gray-50/60 border-t border-gray-100">
                                  <td colSpan={3} className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 tracking-wider">{group}</td>
                                </tr>
                                {PERM_ROWS.filter(r => r.group === group).map(row => {
                                  const mgVal = team.rolePermissions ? team.rolePermissions.manager[row.key] : globalRolePermissions.manager[row.key];
                                  const usVal = team.rolePermissions ? team.rolePermissions.user[row.key] : globalRolePermissions.user[row.key];
                                  const disabled = !team.rolePermissions;
                                  return (
                                    <tr key={row.key} className="border-t border-gray-50 hover:bg-gray-50/30 transition-colors">
                                      <td className={`py-3 px-4 ${disabled ? 'text-gray-300' : 'text-gray-600'}`}>{row.label}</td>
                                      <td className="py-3 px-4 text-center">
                                        <PermToggle
                                          checked={mgVal}
                                          disabled={disabled}
                                          onChange={() => onUpdateTeam(team.id, {
                                            rolePermissions: {
                                              ...team.rolePermissions!,
                                              manager: { ...team.rolePermissions!.manager, [row.key]: !mgVal },
                                            },
                                          })}
                                        />
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        <PermToggle
                                          checked={usVal}
                                          disabled={disabled}
                                          onChange={() => onUpdateTeam(team.id, {
                                            rolePermissions: {
                                              ...team.rolePermissions!,
                                              user: { ...team.rolePermissions!.user, [row.key]: !usVal },
                                            },
                                          })}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!team.rolePermissions && (
                        <p className="text-[10px] text-gray-400">현재 전체 기본 설정이 적용 중입니다. 위 토글을 켜면 이 팀만의 권한을 별도로 설정할 수 있습니다.</p>
                      )}
                      {team.rolePermissions && (
                        <p className="text-[10px] text-gray-400">최고 관리자(superadmin) 권한은 항상 전체 접근이 허용됩니다.</p>
                      )}
                    </div>
                  )}

                  {/* 지원팀 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'support' && (
                    <div className="px-5 py-4 space-y-4">
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">이 팀은 지원팀입니다</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            직접 업무를 등록하기보다, 다른 팀의 업무관리 화면에서 "지원 요청"으로 받은 업무 위주로 운영하는 팀
                          </p>
                        </div>
                        <PermToggle
                          checked={!!team.isSupportTeam}
                          onChange={() => onUpdateTeam(team.id, { isSupportTeam: !team.isSupportTeam })}
                        />
                      </div>

                      {team.isSupportTeam && (
                        <div>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                            업무 요청을 보낼 수 있는 팀
                            <span className="text-gray-300 font-normal normal-case ml-1">체크된 팀만 업무관리 화면에서 이 지원팀으로 요청을 보낼 수 있습니다</span>
                          </p>
                          {teams.filter(t => t.id !== team.id).length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-3">다른 팀이 없습니다</p>
                          ) : (
                            <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5">
                              {teams.filter(t => t.id !== team.id).map(t => {
                                const checked = (team.supportSourceTeamIds ?? []).includes(t.id);
                                return (
                                  <label key={t.id} className="flex items-center gap-2 py-2 px-3 hover:bg-black/2 transition-colors cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const cur = team.supportSourceTeamIds ?? [];
                                        const next = checked ? cur.filter(id => id !== t.id) : [...cur, t.id];
                                        onUpdateTeam(team.id, { supportSourceTeamIds: next });
                                      }}
                                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                                    />
                                    <span>{t.emoji}</span>
                                    <span className="text-sm text-gray-700">{t.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ──────────────────────────────────────────
// 프로필 추가 필드 관리 (superadmin 전용)
// ──────────────────────────────────────────
function ProfileFieldManager({ profileFields, onUpdateProfileFields }: {
  profileFields: ProfileFieldDef[];
  onUpdateProfileFields: (fields: ProfileFieldDef[]) => Promise<void>;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [newFieldType, setNewFieldType] = useState<'text' | 'select' | 'text+select' | 'date'>('text');
  const [newOptionInput, setNewOptionInput] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [newDdayEnabled, setNewDdayEnabled] = useState(false);
  const [newDdayDays, setNewDdayDays] = useState(10);
  const [newDdayMessage, setNewDdayMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editRequired, setEditRequired] = useState(false);
  const [editFieldType, setEditFieldType] = useState<'text' | 'select' | 'text+select' | 'date'>('text');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editOptionInput, setEditOptionInput] = useState('');
  const [editTextFirst, setEditTextFirst] = useState(true);
  const [newTextFirst, setNewTextFirst] = useState(true);
  const [editDdayEnabled, setEditDdayEnabled] = useState(false);
  const [editDdayDays, setEditDdayDays] = useState(10);
  const [editDdayMessage, setEditDdayMessage] = useState('');

  // 드래그 순서 변경
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleFieldDrop = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const from = profileFields.findIndex(f => f.id === draggingId);
    const to = profileFields.findIndex(f => f.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...profileFields];
    const [item] = reordered.splice(from, 1);
    reordered.splice(to, 0, item);
    await onUpdateProfileFields(reordered.map((f, i) => ({ ...f, order: i })));
    setDraggingId(null);
    setDragOverId(null);
  };

  const startEdit = (field: ProfileFieldDef) => {
    setEditingId(field.id);
    setEditLabel(field.label);
    setEditRequired(field.required);
    setEditFieldType(field.fieldType);
    setEditOptions(field.options ?? []);
    setEditOptionInput('');
    setEditTextFirst(field.textFirst !== false);
    setEditDdayEnabled(!!field.ddayAlert);
    setEditDdayDays(field.ddayAlert?.days ?? 10);
    setEditDdayMessage(field.ddayAlert?.message ?? '');
  };

  const cycleFieldType = (t: 'text' | 'select' | 'text+select' | 'date') =>
    t === 'text' ? 'select' : t === 'select' ? 'text+select' : t === 'text+select' ? 'date' : 'text' as const;

  const fieldTypeLabel = (t: 'text' | 'select' | 'text+select' | 'date') =>
    t === 'select' ? '드롭다운' : t === 'text+select' ? '텍스트+드롭다운' : t === 'date' ? '날짜' : '텍스트';

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const needsOptions = editFieldType === 'select' || editFieldType === 'text+select';
    if (needsOptions && editOptions.length < 1) {
      alert('드롭다운 옵션을 1개 이상 추가해주세요.');
      return;
    }
    await onUpdateProfileFields(profileFields.map(f =>
      f.id === editingId
        ? {
            ...f,
            label: editLabel.trim() || f.label,
            required: editRequired,
            fieldType: editFieldType,
            options: needsOptions ? editOptions : undefined,
            textFirst: editFieldType === 'text+select' ? editTextFirst : undefined,
            ddayAlert: editFieldType === 'date' && editDdayEnabled
              ? { days: editDdayDays, message: editDdayMessage.trim() }
              : undefined,
          }
        : f
    ));
    setEditingId(null);
  };

  const handleAddOption = () => {
    const v = newOptionInput.trim();
    if (!v || newOptions.includes(v)) return;
    setNewOptions(o => [...o, v]);
    setNewOptionInput('');
  };

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const needsOptions = newFieldType === 'select' || newFieldType === 'text+select';
    if (needsOptions && newOptions.length < 1) {
      alert('드롭다운 옵션을 1개 이상 추가해주세요.');
      return;
    }
    const newField: ProfileFieldDef = {
      id: `pf_${Date.now()}`,
      label,
      required: newRequired,
      order: profileFields.length,
      fieldType: newFieldType,
      options: needsOptions ? newOptions : undefined,
      textFirst: newFieldType === 'text+select' ? newTextFirst : undefined,
      ddayAlert: newFieldType === 'date' && newDdayEnabled
        ? { days: newDdayDays, message: newDdayMessage.trim() }
        : undefined,
    };
    setSaving(true);
    await onUpdateProfileFields([...profileFields, newField]);
    setSaving(false);
    setNewLabel('');
    setNewRequired(false);
    setNewFieldType('text');
    setNewOptions([]);
    setNewOptionInput('');
    setNewDdayEnabled(false);
    setNewDdayDays(10);
    setNewDdayMessage('');
  };

  const handleDelete = async (id: string) => {
    if (editingId === id) setEditingId(null);
    await onUpdateProfileFields(profileFields.filter(f => f.id !== id));
  };

  return (
    <section className="glass-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <User size={14} className="text-indigo-400" />
        프로필 추가 필드 관리
      </h3>
      <p className="text-xs text-gray-400">추가한 필드는 모든 사용자 프로필(직군 아래)에 표시됩니다.</p>

      {profileFields.length > 0 && (
        <div className="space-y-2">
          {profileFields.map(field => (
            <div
              key={field.id}
              onDragOver={e => { e.preventDefault(); setDragOverId(field.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={() => handleFieldDrop(field.id)}
              className={`rounded-xl bg-gray-50 border overflow-hidden transition-all ${
                dragOverId === field.id && draggingId !== field.id
                  ? 'border-indigo-300 ring-1 ring-indigo-200'
                  : 'border-gray-100'
              } ${draggingId === field.id ? 'opacity-40' : ''}`}>
              {editingId === field.id ? (
                /* ── 편집 모드 ── */
                <div className="p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    />
                    <button
                      onClick={() => setEditFieldType(t => cycleFieldType(t))}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium border whitespace-nowrap transition-colors ${
                        editFieldType !== 'text' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-500 border-gray-200'
                      }`}>
                      {fieldTypeLabel(editFieldType)}
                    </button>
                    <button
                      onClick={() => setEditRequired(r => !r)}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium border whitespace-nowrap transition-colors ${
                        editRequired ? 'bg-red-50 text-red-500 border-red-200' : 'bg-white text-gray-400 border-gray-200'
                      }`}>
                      {editRequired ? '필수' : '선택'}
                    </button>
                  </div>
                  {editFieldType === 'text+select' && (
                    <button
                      onClick={() => setEditTextFirst(v => !v)}
                      className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors w-fit">
                      <span className={`font-medium ${editTextFirst ? 'text-indigo-600' : 'text-gray-400'}`}>텍스트</span>
                      <span className="text-gray-300">⇄</span>
                      <span className={`font-medium ${!editTextFirst ? 'text-indigo-600' : 'text-gray-400'}`}>드롭다운</span>
                    </button>
                  )}
                  {(editFieldType === 'select' || editFieldType === 'text+select') && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {editOptions.map(o => (
                          <span key={o} className="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                            {o}
                            <button onClick={() => setEditOptions(opts => opts.filter(x => x !== o))} className="text-gray-300 hover:text-red-400"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          value={editOptionInput}
                          onChange={e => setEditOptionInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const v = editOptionInput.trim();
                              if (v && !editOptions.includes(v)) { setEditOptions(o => [...o, v]); setEditOptionInput(''); }
                            }
                          }}
                          placeholder="옵션 입력 후 Enter"
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                        />
                        <button
                          onClick={() => {
                            const v = editOptionInput.trim();
                            if (v && !editOptions.includes(v)) { setEditOptions(o => [...o, v]); setEditOptionInput(''); }
                          }}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100">
                          추가
                        </button>
                      </div>
                    </div>
                  )}
                  {editFieldType === 'date' && (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-700 font-medium">디데이 알림</span>
                        <button
                          type="button"
                          onClick={() => setEditDdayEnabled(v => !v)}
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium border transition-colors ${
                            editDdayEnabled ? 'bg-amber-200 text-amber-700 border-amber-300' : 'bg-white text-gray-400 border-gray-200'
                          }`}
                        >{editDdayEnabled ? '켜짐' : '꺼짐'}</button>
                      </div>
                      {editDdayEnabled && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="number" min={1} max={365} value={editDdayDays}
                              onChange={e => setEditDdayDays(Math.max(1, Number(e.target.value)))}
                              className="w-14 text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/50 text-center"
                            />
                            <span className="text-xs text-gray-500">일 전부터 알림</span>
                          </div>
                          <input
                            value={editDdayMessage}
                            onChange={e => setEditDdayMessage(e.target.value)}
                            placeholder="알림 메시지 (예: 계약 만료가)"
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors">저장</button>
                    <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
                    <button onClick={() => handleDelete(field.id)} className="ml-auto text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors">삭제</button>
                  </div>
                </div>
              ) : (
                /* ── 보기 모드 ── */
                <div className="flex items-center gap-2 px-3 py-2">
                  <div
                    draggable
                    onDragStart={() => { setDraggingId(field.id); setEditingId(null); }}
                    onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                    className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0">
                    <GripVertical size={14} />
                  </div>
                  <span className="text-sm text-gray-700 flex-1">{field.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                    {field.fieldType === 'text' ? '텍스트' : field.fieldType === 'select' ? `드롭다운 ${field.options?.length ?? 0}개` : field.fieldType === 'date' ? '날짜' : `텍스트+드롭다운 ${field.options?.length ?? 0}개`}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${field.required ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                    {field.required ? '필수' : '선택'}
                  </span>
                  {field.fieldType === 'date' && field.ddayAlert && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-medium whitespace-nowrap">
                      D-{field.ddayAlert.days}일
                    </span>
                  )}
                  <button
                    title="계정 정보 페이지 노출 여부"
                    onClick={() => onUpdateProfileFields(profileFields.map(f =>
                      f.id === field.id ? { ...f, showInAccountInfo: f.showInAccountInfo === false ? true : false } : f
                    ))}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                      field.showInAccountInfo === false
                        ? 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                        : 'bg-teal-50 text-teal-500 hover:bg-teal-100'
                    }`}>
                    계정정보 {field.showInAccountInfo === false ? '숨김' : '노출'}
                  </button>
                  <button
                    onClick={() => startEdit(field)}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-indigo-400 hover:bg-indigo-50 transition-all">
                    <Pencil size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newFieldType === 'text' && handleAdd()}
            placeholder="필드 이름 (예: 포지션)"
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          />
          <button
            onClick={() => setNewFieldType(t => cycleFieldType(t))}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
              newFieldType !== 'text' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}>
            {fieldTypeLabel(newFieldType)}
          </button>
          <button
            onClick={() => setNewRequired(r => !r)}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
              newRequired ? 'bg-red-50 text-red-500 border-red-200' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
            }`}>
            {newRequired ? '필수' : '선택'}
          </button>
        </div>

        {newFieldType === 'text+select' && (
          <button
            onClick={() => setNewTextFirst(v => !v)}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors w-fit">
            <span className={`font-medium ${newTextFirst ? 'text-indigo-600' : 'text-gray-400'}`}>텍스트</span>
            <span className="text-gray-300">⇄</span>
            <span className={`font-medium ${!newTextFirst ? 'text-indigo-600' : 'text-gray-400'}`}>드롭다운</span>
          </button>
        )}

        {(newFieldType === 'select' || newFieldType === 'text+select') && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {newOptions.map(o => (
                <span key={o} className="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                  {o}
                  <button onClick={() => setNewOptions(opts => opts.filter(x => x !== o))} className="text-gray-300 hover:text-red-400">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={newOptionInput}
                onChange={e => setNewOptionInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddOption()}
                placeholder="옵션 입력 후 Enter"
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
              <button onClick={handleAddOption} className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                추가
              </button>
            </div>
          </div>
        )}

        {newFieldType === 'date' && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-700 font-medium">디데이 알림</span>
              <button
                type="button"
                onClick={() => setNewDdayEnabled(v => !v)}
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium border transition-colors ${
                  newDdayEnabled ? 'bg-amber-200 text-amber-700 border-amber-300' : 'bg-white text-gray-400 border-gray-200'
                }`}
              >{newDdayEnabled ? '켜짐' : '꺼짐'}</button>
            </div>
            {newDdayEnabled && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={365} value={newDdayDays}
                    onChange={e => setNewDdayDays(Math.max(1, Number(e.target.value)))}
                    className="w-14 text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/50 text-center"
                  />
                  <span className="text-xs text-gray-500">일 전부터 알림</span>
                </div>
                <input
                  value={newDdayMessage}
                  onChange={e => setNewDdayMessage(e.target.value)}
                  placeholder="알림 메시지 (예: 계약 만료가)"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                />
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={!newLabel.trim() || saving}
          className="flex items-center gap-1 text-sm px-4 py-1.5 rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-600 disabled:opacity-40 transition-colors">
          <Plus size={13} /> 필드 추가
        </button>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────
export default function SettingsPage({
  appUser, onUpdateName, onUpdateDepartment, onUpdateSelectedTeams, onUpdateDefaultTeam,
  teams, teamsLoading, onCreateTeam, onUpdateTeam, onSetParts, onDeleteTeam,
  onUpdateFormConfig, onUpdateAllFormConfig, onClearAllFormConfig, onUpdatePartFormConfig, onClearPartFormConfig, onUpdateMetaFields, onUpdatePartMetaFields, onClearPartMetaFields, onUpdateSubTaskTypes, onUpdatePartSubTaskTypes, onClearPartSubTaskTypes, onUpdatePartCalendarOrder, onClearPartCalendarOrder, onUpdatePartPLShowInCalendar, onClearPartPLShowInCalendar, onUpdatePartCopyIncludeDetails, onClearPartCopyIncludeDetails, onUpdatePartTaskListTwoLine, onClearPartTaskListTwoLine, onUpdatePartMainTaskEndDateLabel, onClearPartMainTaskEndDateLabel, onUpdatePartMainTaskEndDateShow, onClearPartMainTaskEndDateShow, onUpdatePartMainTaskEndDateColor, onClearPartMainTaskEndDateColor, onUpdateRevisionSteps, onUpdatePartRevisionSteps, onClearPartRevisionSteps, onUpdatePlMainTaskTypes, onUpdateExcelConfig, onUpdatePartExcelConfig, onClearPartExcelConfig, onUpdatePartWeeklyConfig, onClearPartWeeklyConfig, onUpdatePartMailFormConfig, onClearPartMailFormConfig,
  onReorderTeams,
  customHolidays, onUpdateHolidays,
  orphanTaskCount, onCleanupOrphanTasks,
  profileFields, onUpdateProfileFields,
  rolePermissions, onUpdateRolePermissions,
  roleLabels, onUpdateRoleLabels,
  workplaceId,
}: Props) {
  const [nameInput, setNameInput] = useState(appUser.displayName);
  const [nameSaved, setNameSaved] = useState(false);
  const [myProfileData, setMyProfileData] = useState<Record<string, string>>(appUser.profileData ?? {});
  const [myProfileSaved, setMyProfileSaved] = useState(false);
  const { users, updateUserRole, updateUserInfo, deleteUser } = useAllUsers(workplaceId);

  const isRoleSuperadmin = appUser.role === 'superadmin';
  const isRoleManager = appUser.role === 'manager';
  const myRolePerms = isRoleSuperadmin
    ? DEFAULT_ROLE_PERMISSIONS.manager  // superadmin은 항상 전체 권한
    : rolePermissions[appUser.role as 'manager' | 'user'] ?? DEFAULT_ROLE_PERMISSIONS[isRoleManager ? 'manager' : 'user'];
  const canManageTeams         = isRoleSuperadmin || myRolePerms.canManageTeams;
  const canManageMembers       = isRoleSuperadmin || myRolePerms.canManageMembers;
  const canManageHolidays      = isRoleSuperadmin || myRolePerms.canManageHolidays;
  const canManageProfileFields = isRoleSuperadmin || myRolePerms.canManageProfileFields;
  const canManageUsers = canManageMembers; // 하위 호환 — 사용자 탭 접근 여부

  // 권한 에디터 로컬 상태
  const [localPerms, setLocalPerms] = useState<RolePermissions>(rolePermissions);
  useEffect(() => { setLocalPerms(rolePermissions); }, [rolePermissions]);

  const handlePermToggle = (role: 'manager' | 'user', key: keyof RolePermissionConfig) => {
    const next: RolePermissions = {
      ...localPerms,
      [role]: { ...localPerms[role], [key]: !localPerms[role][key] },
    };
    setLocalPerms(next);
    onUpdateRolePermissions(next);
  };

  // 구 기본값(15일)으로 저장된 사용자를 0으로 일괄 초기화 (1회 실행)
  const annualMigratedRef = useRef(false);
  useEffect(() => {
    if (annualMigratedRef.current || users.length === 0) return;
    annualMigratedRef.current = true;
    const toReset = users.filter(u => u.annualLeave === 15);
    if (toReset.length === 0) return;
    Promise.all(toReset.map(u => updateUserInfo(u.uid, { annualLeave: 0 })));
  }, [users]);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState('');

  const runSubtaskMigration = async () => {
    setMigrating(true);
    setMigrateResult('');
    try {
      const [subtasksSnap, tasksSnap] = await Promise.all([
        getDocs(collection(db, 'subtasks')),
        getDocs(collection(db, 'tasks')),
      ]);
      const taskMap = new Map(tasksSnap.docs.map(d => [d.id, d.data().projectId as string]));
      const needsMigration = subtasksSnap.docs.filter(d => !d.data().projectId);
      if (needsMigration.length === 0) {
        setMigrateResult('✅ 이미 모든 세부업무에 projectId가 있습니다.');
        return;
      }
      let updated = 0, failed = 0;
      for (const subDoc of needsMigration) {
        const projectId = taskMap.get(subDoc.data().taskId);
        if (projectId) {
          await updateDoc(doc(db, 'subtasks', subDoc.id), { projectId });
          updated++;
        } else {
          failed++;
        }
      }
      setMigrateResult(`✅ 완료: ${updated}건 업데이트${failed > 0 ? `, ${failed}건 실패 (부모 task 없음)` : ''}`);
    } catch (e) {
      setMigrateResult(`❌ 오류: ${String(e)}`);
    } finally {
      setMigrating(false);
    }
  };

  const [migratingTeam, setMigratingTeam] = useState(false);
  const [migrateTeamResult, setMigrateTeamResult] = useState('');

  const runTaskTeamMigration = async () => {
    setMigratingTeam(true);
    setMigrateTeamResult('');
    try {
      // 파트명 → teamId 맵 구성
      const partToTeamId: Record<string, string> = {};
      for (const team of teams) {
        for (const part of team.parts) {
          partToTeamId[part.name] = team.id;
        }
      }

      // teamId 없는 업무 전체 조회
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      const needsMigration = tasksSnap.docs.filter(d => !d.data().teamId);

      if (needsMigration.length === 0) {
        setMigrateTeamResult('✅ 모든 업무에 이미 teamId가 있습니다.');
        return;
      }

      let updated = 0, skipped = 0;
      // Firestore batch 한도 500건 단위 처리
      for (let i = 0; i < needsMigration.length; i += 499) {
        const batch = writeBatch(db);
        const chunk = needsMigration.slice(i, i + 499);
        for (const taskDoc of chunk) {
          const category = taskDoc.data().category as string;
          const teamId = partToTeamId[category];
          if (teamId) {
            batch.update(doc(db, 'tasks', taskDoc.id), { teamId });
            updated++;
          } else {
            skipped++;
          }
        }
        await batch.commit();
      }

      setMigrateTeamResult(
        `✅ 완료: ${updated}건 업데이트` +
        (skipped > 0 ? `, ${skipped}건 매칭 실패 (파트 없음)` : '')
      );
    } catch (e) {
      setMigrateTeamResult(`❌ 오류: ${String(e)}`);
    } finally {
      setMigratingTeam(false);
    }
  };

  const runCleanupOrphanTasks = async () => {
    if (!window.confirm(`파트에 속하지 않는 업무 ${orphanTaskCount}건을 삭제합니다. 복구할 수 없습니다. 계속하시겠습니까?`)) return;
    setCleaning(true);
    setCleanResult('');
    try {
      const deleted = await onCleanupOrphanTasks();
      setCleanResult(`✅ ${deleted}건 삭제 완료`);
    } catch (e) {
      setCleanResult(`❌ 오류: ${String(e)}`);
    } finally {
      setCleaning(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    await onUpdateName(nameInput.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  type SettingsTab = 'profile' | 'teams' | 'users' | 'holidays' | 'fields' | 'system';
  const ALL_TABS: { id: SettingsTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'profile',   label: '내 프로필',       icon: <User size={14} />,        show: true },
    { id: 'teams',     label: '팀 관리',          icon: <Layers size={14} />,      show: canManageTeams },
    { id: 'users',     label: '사용자 관리',      icon: <Users size={14} />,       show: canManageMembers },
    { id: 'holidays',  label: '휴일 관리',        icon: <CalendarDays size={14} />,show: canManageHolidays },
    { id: 'fields',    label: '프로필 필드',      icon: <Star size={14} />,        show: canManageProfileFields },
    { id: 'system',    label: '시스템',           icon: <Shield size={14} />,      show: isRoleSuperadmin || isRoleManager },
  ];
  const visibleTabs = ALL_TABS.filter(t => t.show);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(visibleTabs[0]?.id ?? 'profile');
  const activeTab = visibleTabs.find(t => t.id === settingsTab) ? settingsTab : (visibleTabs[0]?.id ?? 'profile');

  return (
    <RoleLabelContext.Provider value={roleLabels ?? {}}>
    <div className="space-y-5">
      {/* 헤더 + 탭 */}
      <div>
        <h1 className="page-title">설정</h1>
        <p className="page-subtitle">계정 및 권한 관리</p>
      </div>
      <div className="flex gap-1 bg-white/60 border border-gray-200 rounded-2xl p-1.5 flex-wrap">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSettingsTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#6C63FF] text-white shadow shadow-[#6C63FF]/25'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 내 프로필 탭 ── */}
      {activeTab === 'profile' && <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <User size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">내 프로필</span>
          <RoleBadge role={appUser.role} />
          {appUser.department && <DeptBadge dept={appUser.department} />}
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">이메일</label>
            <p className="text-sm text-gray-700">{appUser.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">표시 이름</label>
            <div className="flex gap-2">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                className="flex-1 max-w-xs text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <button onClick={handleSaveName}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${nameSaved ? 'bg-green-500 text-white' : 'btn-shiny-primary'}`}>
                {nameSaved ? '저장됨' : '저장'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              직군 <span className="text-orange-500">*</span>
            </label>
            <DeptSelector value={appUser.department} onChange={onUpdateDepartment} />
            {!appUser.department && (
              <p className="mt-1.5 text-xs text-orange-500">직군을 선택해주세요. 모든 구성원이 필수 설정해야 합니다.</p>
            )}
          </div>
          {profileFields.length > 0 && (
            <div className="space-y-3">
              {profileFields.map(field => (
                <div key={field.id}>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.fieldType === 'text+select' && field.options?.length ? (
                    <div className={`flex gap-1.5 max-w-xs ${field.textFirst === false ? 'flex-row-reverse' : ''}`}>
                      <input
                        value={myProfileData[field.id] ?? ''}
                        onChange={e => setMyProfileData(prev => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={field.required ? '직접 입력 (필수)' : '직접 입력'}
                        className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      <select
                        value={myProfileData[`${field.id}__sel`] ?? ''}
                        onChange={e => setMyProfileData(prev => ({ ...prev, [`${field.id}__sel`]: e.target.value }))}
                        className="text-sm px-2 py-2 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                        <option value="">{field.required ? '선택 (필수)' : '선택'}</option>
                        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ) : field.fieldType === 'select' && field.options?.length ? (
                    <select
                      value={myProfileData[field.id] ?? ''}
                      onChange={e => setMyProfileData(prev => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full max-w-xs text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                      <option value="">{field.required ? '선택 (필수)' : '선택'}</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.fieldType === 'date' ? (
                    <DatePicker
                      value={myProfileData[field.id] ?? ''}
                      onChange={v => setMyProfileData(prev => ({ ...prev, [field.id]: v }))}
                      btnClassName="w-full max-w-xs text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  ) : (
                    <input
                      value={myProfileData[field.id] ?? ''}
                      onChange={e => setMyProfileData(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.required ? '필수 항목' : '선택 항목'}
                      className="w-full max-w-xs text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  )}
                </div>
              ))}
              <button
                onClick={async () => {
                  const missing = profileFields.filter(f => {
                    if (!f.required) return false;
                    if (f.fieldType === 'text+select') return !myProfileData[f.id]?.trim() || !myProfileData[`${f.id}__sel`]?.trim();
                    return !myProfileData[f.id]?.trim();
                  });
                  if (missing.length > 0) { alert(`필수 항목을 입력해주세요: ${missing.map(f => f.label).join(', ')}`); return; }
                  await updateUserInfo(appUser.uid, { profileData: myProfileData });
                  setMyProfileSaved(true);
                  setTimeout(() => setMyProfileSaved(false), 2000);
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${myProfileSaved ? 'bg-green-500 text-white' : 'btn-shiny-primary'}`}>
                {myProfileSaved ? '저장됨' : '추가 정보 저장'}
              </button>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              소속 팀 <span className="text-gray-400 font-normal">(복수 선택 가능)</span>
            </label>
            {teamsLoading ? (
              <div className="flex gap-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-9 w-20 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : teams.length === 0 ? (
              <p className="text-xs text-gray-400 italic">생성된 팀이 없습니다{appUser.role !== 'user' ? ' — 아래에서 팀을 먼저 만들어주세요' : ''}.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {teams.map(t => {
                    const isSelected = appUser.selectedTeamIds?.includes(t.id) ?? false;
                    const isDefault = (workplaceId && appUser.defaultTeamIdByWorkplace?.[workplaceId]) === t.id;
                    const selectedCount = appUser.selectedTeamIds?.length ?? 0;
                    const handleToggle = () => {
                      const current = appUser.selectedTeamIds ?? [];
                      const next = isSelected
                        ? current.filter(id => id !== t.id)
                        : [...current, t.id];
                      onUpdateSelectedTeams(next);
                      if (isSelected && isDefault) onUpdateDefaultTeam(null);
                    };
                    const handleSetDefault = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      onUpdateDefaultTeam(isDefault ? null : t.id);
                    };
                    return (
                      <div key={t.id} className="relative">
                        <button onClick={handleToggle}
                          style={isSelected ? { backgroundColor: t.color ?? '#3b82f6', borderColor: t.color ?? '#3b82f6' } : {}}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                            isSelected
                              ? 'text-white shadow-md pr-8'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}>
                          <span className="text-base">{t.emoji}</span>
                          <span>{t.name}</span>
                          {isSelected && !isDefault && <Check size={13} />}
                        </button>
                        {isSelected && selectedCount >= 2 && (
                          <button
                            onClick={handleSetDefault}
                            title={isDefault ? '기본 팀 해제' : '기본 팀으로 설정'}
                            className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded transition-colors ${
                              isDefault
                                ? 'text-yellow-300'
                                : 'text-gray-500 hover:text-yellow-300'
                            }`}>
                            <Star size={12} fill={isDefault ? 'currentColor' : 'none'} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(appUser.selectedTeamIds?.length ?? 0) >= 2 && (
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    ★ 를 눌러 접속 시 기본으로 선택될 팀을 지정하세요.
                  </p>
                )}
              </>
            )}
            {!teamsLoading && teams.length > 0 && !appUser.selectedTeamIds?.length && (
              <p className="mt-1.5 text-xs text-orange-500">소속 팀을 하나 이상 선택해주세요. 팀을 선택해야 업무 데이터를 볼 수 있습니다.</p>
            )}
          </div>
        </div>
      </section>}

      {/* ── 팀 관리 탭 ── */}
      {activeTab === 'teams' && canManageTeams && (
        <TeamSection
          teams={teams}
          globalRolePermissions={rolePermissions}
          onCreateTeam={onCreateTeam}
          onUpdateTeam={onUpdateTeam}
          onSetParts={onSetParts}
          onDeleteTeam={onDeleteTeam}
          onReorderTeams={onReorderTeams}
          onUpdateFormConfig={onUpdateFormConfig}
          onUpdateAllFormConfig={onUpdateAllFormConfig}
          onClearAllFormConfig={onClearAllFormConfig}
          onUpdatePartFormConfig={onUpdatePartFormConfig}
          onClearPartFormConfig={onClearPartFormConfig}
          onUpdateMetaFields={onUpdateMetaFields}
          onUpdatePartMetaFields={onUpdatePartMetaFields}
          onClearPartMetaFields={onClearPartMetaFields}
          onUpdateSubTaskTypes={onUpdateSubTaskTypes}
          onUpdatePartSubTaskTypes={onUpdatePartSubTaskTypes}
          onClearPartSubTaskTypes={onClearPartSubTaskTypes}
          onUpdatePartCalendarOrder={onUpdatePartCalendarOrder}
          onClearPartCalendarOrder={onClearPartCalendarOrder}
          onUpdatePartPLShowInCalendar={onUpdatePartPLShowInCalendar}
          onClearPartPLShowInCalendar={onClearPartPLShowInCalendar}
          onUpdatePartCopyIncludeDetails={onUpdatePartCopyIncludeDetails}
          onClearPartCopyIncludeDetails={onClearPartCopyIncludeDetails}
          onUpdatePartTaskListTwoLine={onUpdatePartTaskListTwoLine}
          onClearPartTaskListTwoLine={onClearPartTaskListTwoLine}
          onUpdatePartMainTaskEndDateLabel={onUpdatePartMainTaskEndDateLabel}
          onClearPartMainTaskEndDateLabel={onClearPartMainTaskEndDateLabel}
          onUpdatePartMainTaskEndDateShow={onUpdatePartMainTaskEndDateShow}
          onClearPartMainTaskEndDateShow={onClearPartMainTaskEndDateShow}
          onUpdatePartMainTaskEndDateColor={onUpdatePartMainTaskEndDateColor}
          onClearPartMainTaskEndDateColor={onClearPartMainTaskEndDateColor}
          onUpdateRevisionSteps={onUpdateRevisionSteps}
          onUpdatePartRevisionSteps={onUpdatePartRevisionSteps}
          onClearPartRevisionSteps={onClearPartRevisionSteps}
          onUpdatePlMainTaskTypes={onUpdatePlMainTaskTypes}
          onUpdateExcelConfig={onUpdateExcelConfig}
          onUpdatePartExcelConfig={onUpdatePartExcelConfig}
          onClearPartExcelConfig={onClearPartExcelConfig}
          onUpdatePartWeeklyConfig={onUpdatePartWeeklyConfig}
          onClearPartWeeklyConfig={onClearPartWeeklyConfig}
          onUpdatePartMailFormConfig={onUpdatePartMailFormConfig}
          onClearPartMailFormConfig={onClearPartMailFormConfig}
          allUsers={users}
        />
      )}

      {/* ── 사용자 관리 탭 ── */}
      {activeTab === 'users' && canManageMembers && (
        <section className="glass-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Users size={15} className="text-purple-500" />
            <span className="text-sm font-semibold text-gray-800">사용자 관리</span>
            <span className="text-xs text-gray-400">{users.length}명</span>
          </div>
          {users.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">등록된 사용자 없음</p>
          ) : (
            <div className="grid grid-cols-3 gap-4 p-4">
              {(() => {
                const DEFAULT_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f97316','#ec4899','#14b8a6'];
                return [...teams, null].map((team, teamIdx) => {
                  const teamUsers = team
                    ? users.filter(u => {
                        if (!u.selectedTeamIds?.includes(team.id)) return false;
                        // 이 근무지에서의 기본 팀이 설정돼 있으면 그 팀 그룹에서만 배타적으로 표시
                        const usersDefault = workplaceId ? u.defaultTeamIdByWorkplace?.[workplaceId] : undefined;
                        if (usersDefault) return usersDefault === team.id;
                        return true;
                      })
                    : users.filter(u => !teams.some(t => u.selectedTeamIds?.includes(t.id)));
                  if (teamUsers.length === 0) return null;

                  const deptGroups = [
                    ...DEPARTMENTS.map(dept => ({ dept, members: teamUsers.filter(u => u.department === dept) })),
                    { dept: '미설정', members: teamUsers.filter(u => !u.department) },
                  ].filter(g => g.members.length > 0);

                  const headerColor = team ? (team.color ?? DEFAULT_COLORS[teamIdx % DEFAULT_COLORS.length]) : '#9ca3af';

                  return (
                    <div key={team?.id ?? 'none'} className="rounded-xl overflow-hidden shadow-sm border border-gray-100">
                      {/* 팀 헤더 */}
                      <div className="px-4 py-3" style={{ backgroundColor: headerColor }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">
                            {team ? `${team.emoji} ${team.name}` : '무소속'}
                          </span>
                          <span className="text-[11px] text-white/70 font-medium">{teamUsers.length}명</span>
                        </div>
                      </div>
                      {deptGroups.map(({ dept, members }) => (
                        <div key={dept}>
                          {/* 직군 헤더 */}
                          <div className="px-4 py-1.5 border-b border-gray-100" style={{ backgroundColor: `${headerColor}14` }}>
                            <span className="text-[10px] font-semibold" style={{ color: headerColor }}>{dept}</span>
                          </div>
                          <div className="divide-y divide-black/[0.04] bg-white">
                            {members
                              .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'))
                              .map(u => (
                                <UserRow key={`${team?.id ?? 'none'}-${u.uid}`} u={u}
                                  viewerRole={appUser.role} viewerTeamIds={appUser.selectedTeamIds ?? []}
                                  isSelf={u.uid === appUser.uid}
                                  onChangeRole={updateUserRole} onUpdateInfo={updateUserInfo} onDeleteUser={deleteUser} teams={teams} profileFields={profileFields} workplaceId={workplaceId} />
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </section>
      )}

      {/* ── 시스템 탭: 권한 관리 (superadmin·manager 공통) ── */}
      {activeTab === 'system' && (isRoleSuperadmin || isRoleManager) && (
        <section className="glass-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Shield size={15} className="text-blue-400" />
            <span className="text-sm font-semibold text-gray-800">권한 관리</span>
            <span className="text-xs text-gray-400">
              {isRoleSuperadmin ? '중간 관리자 · 일반 사용자 권한 설정' : '일반 사용자 권한 설정'}
            </span>
          </div>
          <div className="p-5 space-y-4">
            {/* 권한 계층 안내 */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50">
                <RoleBadge role="superadmin" />
                <span className="text-[10px] text-purple-400">모든 권한 고정</span>
              </div>
              <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50">
                <RoleBadge role="manager" />
                <span className="text-[10px] text-blue-400">
                  {isRoleSuperadmin ? '아래에서 설정 가능' : '설정 권한 없음'}
                </span>
              </div>
              <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50">
                <RoleBadge role="user" />
                <span className="text-[10px] text-gray-400">아래에서 설정 가능</span>
              </div>
            </div>

            {/* 권한 토글 테이블 */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-2.5 px-4 text-gray-400 font-medium">기능</th>
                    {isRoleSuperadmin && (
                      <th className="py-2.5 px-4 text-center w-28">
                        <div className="flex flex-col items-center gap-0.5">
                          <RoleBadge role="manager" />
                        </div>
                      </th>
                    )}
                    <th className="py-2.5 px-4 text-center w-28">
                      <div className="flex flex-col items-center gap-0.5">
                        <RoleBadge role="user" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(['업무', '설정', '게시판'] as const).map(group => (
                    <>
                      <tr key={`group-${group}`} className="bg-gray-50/60 border-t border-gray-100">
                        <td colSpan={isRoleSuperadmin ? 3 : 2} className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 tracking-wider">{group}</td>
                      </tr>
                      {PERM_ROWS.filter(r => r.group === group).map(row => (
                        <tr key={row.key} className="border-t border-gray-50 hover:bg-gray-50/30 transition-colors">
                          <td className="py-3 px-4 text-gray-600">{row.label}</td>
                          {isRoleSuperadmin && (
                            <td className="py-3 px-4 text-center">
                              <PermToggle
                                checked={localPerms.manager[row.key]}
                                onChange={() => handlePermToggle('manager', row.key)}
                              />
                            </td>
                          )}
                          <td className="py-3 px-4 text-center">
                            <PermToggle
                              checked={localPerms.user[row.key]}
                              onChange={() => handlePermToggle('user', row.key)}
                            />
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400">최고 관리자(superadmin) 권한은 항상 전체 접근이 허용되며 변경할 수 없습니다.</p>
          </div>
        </section>
      )}

      {/* ── 시스템 탭: 역할 명칭 커스터마이징 ── */}
      {activeTab === 'system' && isRoleSuperadmin && onUpdateRoleLabels && (
        <section className="glass-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Shield size={15} className="text-indigo-400" />
            <span className="text-sm font-semibold text-gray-800">역할 표시 명칭</span>
            <span className="text-xs text-gray-400">이 근무지에서 역할을 부르는 이름을 다르게 지정할 수 있습니다 (예: 중간 관리자 → PM)</span>
          </div>
          <div className="p-5">
            <RoleLabelEditor roleLabels={roleLabels ?? {}} onSave={onUpdateRoleLabels} />
          </div>
        </section>
      )}

      {/* ── 휴일 관리 탭 ── */}
      {activeTab === 'holidays' && canManageHolidays && (
        <section className="glass-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <CalendarDays size={15} className="text-red-400" />
            <span className="text-sm font-semibold text-gray-800">휴일 관리</span>
            <span className="text-xs text-gray-400">캘린더·위클리 전체 반영</span>
          </div>
          <div className="px-5 py-4">
            <HolidayEditor
              customHolidays={customHolidays}
              onSave={onUpdateHolidays}
              canEdit={canManageHolidays}
            />
          </div>
        </section>
      )}

      {/* ── 프로필 필드 탭 ── */}
      {activeTab === 'fields' && canManageProfileFields && (
        <ProfileFieldManager profileFields={profileFields} onUpdateProfileFields={onUpdateProfileFields} />
      )}

      {/* ── 시스템 탭: 데이터 마이그레이션 ── */}
      {activeTab === 'system' && appUser.role === 'superadmin' && (
        <section className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Shield size={14} className="text-orange-400" />
            데이터 마이그레이션
          </h3>
          <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3 space-y-2">
            <p className="text-xs text-gray-600">
              세부업무(subtask)에 projectId 필드 일괄 추가 — 기존 데이터 마이그레이션용
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={runSubtaskMigration}
                disabled={migrating}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {migrating ? '실행 중...' : 'subtask 마이그레이션 실행'}
              </button>
              {migrateResult && (
                <span className="text-xs text-gray-600">{migrateResult}</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3 space-y-2">
            <p className="text-xs text-gray-600">
              기존 업무에 teamId 일괄 추가 — 파트명 기준으로 팀 자동 매칭
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={runTaskTeamMigration}
                disabled={migratingTeam}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {migratingTeam ? '실행 중...' : '업무 teamId 마이그레이션 실행'}
              </button>
              {migrateTeamResult && (
                <span className="text-xs text-gray-600">{migrateTeamResult}</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 시스템 탭: 데이터 정리 ── */}
      {activeTab === 'system' && appUser.role === 'superadmin' && (
        <section className="glass-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Trash2 size={15} className="text-red-400" />
            <span className="text-sm font-semibold text-gray-800">데이터 정리</span>
          </div>
          <div className="p-5 space-y-3">
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">유효하지 않은 업무 정리</p>
                  <p className="text-xs text-gray-500 mt-0.5">등록 실패 등으로 파트 분류 없이 남겨진 업무를 일괄 삭제합니다.</p>
                </div>
                <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${orphanTaskCount > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                  {orphanTaskCount}건
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={runCleanupOrphanTasks}
                  disabled={cleaning || orphanTaskCount === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {cleaning ? '삭제 중...' : '정리하기'}
                </button>
                {cleanResult && <span className="text-xs text-gray-600">{cleanResult}</span>}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
    </RoleLabelContext.Provider>
  );
}
