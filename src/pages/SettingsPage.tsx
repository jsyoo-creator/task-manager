import { useState, useRef, useEffect } from 'react';
import { Shield, User, Users, Check, ChevronDown, Pencil, X, Plus, Trash2, Layers, GripVertical, RotateCcw, Star, CalendarDays } from 'lucide-react';
import type { AppUser, UserRole, Department, Team, TeamPart, TeamFormConfig, CustomFormField, FormFieldType, BuiltinFieldKey, BuiltinFieldConfig, MetaField, SubTaskType, TaskStatus, CustomHoliday, ExcelFieldConfig } from '../types';
import { usePublicHolidays } from '../hooks/usePublicHolidays';
import { DEPARTMENTS, BUILTIN_FIELDS_META, TABLE_FIELD_KEYS, resolveBuiltinFields, DEFAULT_META_FIELDS, STATUS_COLOR_PRESETS, DEFAULT_STATUS_CONFIGS } from '../types';
import { useAllUsers } from '../hooks/useUserRole';
import { collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DatePicker from '../components/DatePicker';

interface Props {
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
  onUpdatePartFormConfig: (teamId: string, partId: string, config: TeamFormConfig) => Promise<void>;
  onClearPartFormConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdateMetaFields: (teamId: string, fields: MetaField[]) => Promise<void>;
  onUpdatePartMetaFields: (teamId: string, partId: string, fields: MetaField[]) => Promise<void>;
  onClearPartMetaFields: (teamId: string, partId: string) => Promise<void>;
  onUpdateSubTaskTypes: (teamId: string, types: SubTaskType[]) => Promise<void>;
  onUpdatePartSubTaskTypes: (teamId: string, partId: string, types: SubTaskType[]) => Promise<void>;
  onClearPartSubTaskTypes: (teamId: string, partId: string) => Promise<void>;
  onUpdateExcelConfig: (teamId: string, config: ExcelFieldConfig[]) => Promise<void>;
  customHolidays: CustomHoliday[];
  onUpdateHolidays: (holidays: CustomHoliday[]) => Promise<void>;
  orphanTaskCount: number;
  onCleanupOrphanTasks: () => Promise<number>;
}

// ──────────────────────────────────────────
// 상수
// ──────────────────────────────────────────
const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: '최고 관리자',
  manager: '중간 관리자',
  user: '일반 사용자',
};
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
];

// ──────────────────────────────────────────
// 공통 뱃지
// ──────────────────────────────────────────
function RoleBadge({ role }: { role: UserRole }) {
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[role]}`}>{ROLE_LABEL[role]}</span>;
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 26px)', gap: 3 }}>
      {EMOJIS.map(e => (
        <button key={e} type="button" onClick={() => onChange(e)}
          style={{ width: 26, height: 26 }}
          className={`rounded-md text-sm flex items-center justify-center transition-all hover:scale-110 ${
            value === e ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-gray-100'
          }`}>{e}</button>
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
        <span className={ROLE_COLOR[u.role].split(' ')[0]}>{ROLE_LABEL[u.role]}</span>
        <ChevronDown size={12} className="text-gray-400" />
      </button>
      {open && (
        <div data-role-dd style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9999 }}
          className="w-36 rounded-xl border border-gray-200 bg-white shadow-xl py-1">
          {(['manager', 'user'] as UserRole[]).map(r => (
            <button key={r} onClick={() => { onChangeRole(u.uid, r); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-100 transition-colors">
              <span className="text-gray-800">{ROLE_LABEL[r]}</span>
              {u.role === r && <Check size={12} className="text-blue-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 사용자 행
// ──────────────────────────────────────────
const DEFAULT_ANNUAL = 0;

function UserRow({ u, viewerRole, viewerTeamIds, isSelf, onChangeRole, onUpdateInfo, teams }: {
  u: AppUser; viewerRole: UserRole; viewerTeamIds: string[]; isSelf: boolean;
  onChangeRole: (uid: string, role: UserRole) => void;
  onUpdateInfo: (uid: string, data: { displayName?: string; department?: Department; selectedTeamIds?: string[]; annualLeave?: number }) => void;
  teams: Team[];
}) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(u.displayName);
  const [deptInput, setDeptInput] = useState<Department | undefined>(u.department);
  const [teamInput, setTeamInput] = useState<string[]>(u.selectedTeamIds ?? []);
  const [annualLeaveStr, setAnnualLeaveStr] = useState<string>(String(u.annualLeave ?? DEFAULT_ANNUAL));

  // 최고 관리자: 본인 포함 전체 수정 가능
  // 중간 관리자: 본인 + 같은 팀 일반 사용자 수정 가능
  const isSameTeam = viewerTeamIds.some(tid => u.selectedTeamIds?.includes(tid));
  const canEdit =
    viewerRole === 'superadmin' ||
    (viewerRole === 'manager' && (isSelf || (isSameTeam && u.role === 'user')));
  const canChangeRole = viewerRole === 'superadmin' && !isSelf && u.role !== 'superadmin';

  const handleSave = async () => {
    const parsed = parseFloat(annualLeaveStr.replace(',', '.'));
    const annualLeave = isNaN(parsed) || parsed < 0 ? DEFAULT_ANNUAL : Math.round(parsed * 10) / 10;
    await onUpdateInfo(u.uid, {
      displayName: nameInput.trim() || u.displayName,
      department: deptInput,
      selectedTeamIds: teamInput,
      annualLeave,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setNameInput(u.displayName);
    setDeptInput(u.department);
    setTeamInput(u.selectedTeamIds ?? []);
    setAnnualLeaveStr(String(u.annualLeave ?? DEFAULT_ANNUAL));
  };

  const userTeams = teams.filter(t => u.selectedTeamIds?.includes(t.id));

  return (
    <div className="px-4 py-3 hover:bg-black/[0.02] transition-colors">
      <div className="flex items-center gap-3">
        {u.photoURL ? (
          <img src={u.photoURL} alt={u.displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {u.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {u.displayName}{isSelf && <span className="ml-1.5 text-xs text-gray-400">(나)</span>}
          </p>
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
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">소속 팀 <span className="text-gray-400 font-normal">(복수 선택 가능)</span></label>
            {teams.length === 0 ? (
              <p className="text-xs text-gray-400 italic">생성된 팀 없음</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {teams.map(t => {
                  const sel = teamInput.includes(t.id);
                  return (
                    <button key={t.id} type="button"
                      onClick={() => setTeamInput(sel ? teamInput.filter(id => id !== t.id) : [...teamInput, t.id])}
                      style={sel ? { backgroundColor: t.color ?? '#3b82f6', borderColor: t.color ?? '#3b82f6' } : {}}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                        sel ? 'text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}>
                      <span>{t.emoji}</span><span>{t.name}</span>{sel && <Check size={11} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">연간 휴가 일수</label>
            <div className="flex items-center gap-2">
              <input
                type="number" step="0.1" min="0.1"
                value={annualLeaveStr}
                onChange={e => setAnnualLeaveStr(e.target.value)}
                onBlur={e => {
                  const parsed = parseFloat(e.target.value.replace(',', '.'));
                  if (!isNaN(parsed) && parsed >= 0.1) {
                    setAnnualLeaveStr(String(Math.round(parsed * 10) / 10));
                  } else {
                    setAnnualLeaveStr(String(DEFAULT_ANNUAL));
                  }
                }}
                className="w-24 text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-xs text-gray-400">일 <span className="text-gray-300">(기본 {DEFAULT_ANNUAL}일, 0.1 단위)</span></span>
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

function AddFieldForm({ onAdd }: { onAdd: (f: Omit<CustomFormField, 'id'>) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FormFieldType>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState(['', '']);
  const [optionColors, setOptionColors] = useState<Record<string, { bg: string; text: string }>>({});
  const [colorPickerIdx, setColorPickerIdx] = useState<number | null>(null);
  const [dept, setDept] = useState<Department | ''>('');

  const cls = "text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400";

  const handleAdd = () => {
    if (!label.trim()) return;
    onAdd({
      label: label.trim(), type, required,
      options: type === 'select' ? options.filter(o => o.trim()) : undefined,
      optionColors: type === 'select' && Object.keys(optionColors).length > 0 ? optionColors : undefined,
      department: type === 'name' && dept ? dept : undefined,
    });
    setLabel(''); setType('text'); setRequired(false); setOptions(['', '']); setOptionColors({}); setDept(''); setOpen(false);
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
      {type === 'select' && (
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
      <div className="flex gap-2 pt-0.5">
        <button onClick={handleAdd} disabled={!label.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
          추가
        </button>
        <button onClick={() => { setOpen(false); setLabel(''); setType('text'); setRequired(false); setOptions(['', '']); }}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
          취소
        </button>
      </div>
    </div>
  );
}

// ── 필드 설정 빌더 (드래그 앤 드롭 + 너비 조절) ──
function FieldConfigEditor({ fields: fieldsProp, customFields, onSaveFields, onSaveCustom }: {
  fields: BuiltinFieldConfig[];
  customFields: CustomFormField[];
  onSaveFields: (f: BuiltinFieldConfig[]) => void;
  onSaveCustom: (f: CustomFormField[]) => void;
}) {
  const [fields, setFields] = useState(fieldsProp);
  useEffect(() => { setFields(fieldsProp); }, [fieldsProp]);

  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const [cdragOverIdx, setCDragOverIdx] = useState<number | null>(null);
  const cdragIdxRef = useRef<number | null>(null);

  // 인라인 레이블·속성 편집 (빌트인)
  const [editingKey, setEditingKey] = useState<BuiltinFieldKey | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [typeInput, setTypeInput] = useState<FormFieldType | 'default'>('default');
  const [builtinDeptInput, setBuiltinDeptInput] = useState<Department | ''>('');

  const [builtinOptionsInput, setBuiltinOptionsInput] = useState<string[]>(['', '']);
  const [builtinOptionColors, setBuiltinOptionColors] = useState<Record<string, { bg: string; text: string }>>({});
  const [builtinColorPickerIdx, setBuiltinColorPickerIdx] = useState<number | null>(null);
  const builtinOptionColorsRef = useRef(builtinOptionColors);
  builtinOptionColorsRef.current = builtinOptionColors;

  // 인라인 편집 (커스텀 필드)
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [customTypeInput, setCustomTypeInput] = useState<FormFieldType>('text');
  const [customDeptInput, setCustomDeptInput] = useState<Department | ''>('');
  const [customOptionsInput, setCustomOptionsInput] = useState<string[]>(['', '']);
  const [customOptionColors, setCustomOptionColors] = useState<Record<string, { bg: string; text: string }>>({});
  const [customColorPickerIdx, setCustomColorPickerIdx] = useState<number | null>(null);
  const customOptionColorsRef = useRef(customOptionColors);
  customOptionColorsRef.current = customOptionColors;

  const isTableField = (key: BuiltinFieldKey) => TABLE_FIELD_KEYS.includes(key);

  const onDrop = (toIdx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...fields];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    setFields(arr);
    onSaveFields(arr);
    dragIdxRef.current = null;
    setDragOverIdx(null);
  };

  const onDropCustom = (toIdx: number) => {
    const from = cdragIdxRef.current;
    if (from === null || from === toIdx) return;
    const arr = [...customFields];
    const [item] = arr.splice(from, 1);
    arr.splice(toIdx, 0, item);
    onSaveCustom(arr);
    cdragIdxRef.current = null;
    setCDragOverIdx(null);
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
    const updated = fields.map(f =>
      f.key === key ? {
        ...f,
        customLabel: trimmed || undefined,
        customType: resolvedType,
        department: isName && builtinDeptInput ? builtinDeptInput as Department : undefined,
        options: isSelect ? validOpts : undefined,
        optionColors: isSelect && Object.keys(builtinOptionColorsRef.current).length > 0 ? builtinOptionColorsRef.current : undefined,
      } : f
    );
    setFields(updated);
    onSaveFields(updated);
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
    const updated = customFields.map(cf =>
      cf.id === id ? {
        ...cf,
        label: newLabel || cf.label,
        type: customTypeInput,
        department: customTypeInput === 'name' && customDeptInput ? customDeptInput : undefined,
        options: customTypeInput === 'select' ? validOpts : cf.options,
        optionColors: customTypeInput === 'select' && Object.keys(customOptionColorsRef.current).length > 0 ? customOptionColorsRef.current : undefined,
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
      {/* 기본 필드 */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          기본 필드
          <span className="text-gray-300 font-normal normal-case ml-1">드래그로 순서 · 이름 클릭으로 이름/속성 수정</span>
        </p>
        <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5">
          {fields.map((fc, i) => {
            const defaultLabel = BUILTIN_FIELDS_META.find(m => m.key === fc.key)?.label ?? fc.key;
            const label = fc.customLabel ?? defaultLabel;
            const isDragOver = dragOverIdx === i;
            const isTitle = fc.key === 'title';
            const isTypeFixed = fc.key === 'weeklyHours' || fc.key === 'revisionLevel';
            return (
              <div
                key={fc.key}
                draggable
                onDragStart={() => { dragIdxRef.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null); }}
                onDrop={() => onDrop(i)}
                onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                className={`${isDragOver ? 'border-t-2 border-blue-400' : ''}`}>
                {editingKey === fc.key ? (
                  /* onBlur 컨테이너: 라벨/속성 행 + 옵션 에디터를 함께 감싸 포커스 이탈 감지 */
                  <div
                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) saveLabel(fc.key); }}
                    onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button')) e.preventDefault(); }}
                  >
                    <div className="flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default">
                      <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
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
                      </div>
                      {(fc.key === 'taskMonth' || isTitle)
                        ? <span className="text-[11px] text-gray-300 italic flex-shrink-0">고정</span>
                        : <Toggle on={fc.enabled} onToggle={() => toggleBuiltin(fc.key)} />
                      }
                    </div>
                    {/* select 타입 옵션 에디터 — onBlur 컨테이너 내부 */}
                    {typeInput === 'select' && (
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
                      }}
                      className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 transition-colors truncate min-w-0">
                      {label}
                      {fc.customLabel && <span className="ml-1 text-[10px] text-blue-400 font-medium">수정됨</span>}
                      {fc.customType && <span className="ml-1 text-[10px] text-violet-400 font-medium">{FIELD_TYPE_LABELS[fc.customType]}</span>}
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
                    {(fc.key === 'taskMonth' || isTitle)
                      ? <span className="text-[11px] text-gray-300 italic flex-shrink-0">고정</span>
                      : <Toggle on={fc.enabled} onToggle={() => toggleBuiltin(fc.key)} />
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 커스텀 필드 */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">커스텀 필드</p>
        {customFields.length > 0 && (
          <div className="rounded-xl border border-black/7 overflow-hidden divide-y divide-black/5 mb-2">
            {customFields.map((cf, i) => {
              const isDragOver = cdragOverIdx === i;
              const isEditingCF = editingCustomId === cf.id;
              return (
                <div
                  key={cf.id}
                  draggable={!isEditingCF}
                  onDragStart={() => { cdragIdxRef.current = i; }}
                  onDragOver={(e) => { e.preventDefault(); setCDragOverIdx(i); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCDragOverIdx(null); }}
                  onDrop={() => onDropCustom(i)}
                  onDragEnd={() => { cdragIdxRef.current = null; setCDragOverIdx(null); }}
                  className={`flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 transition-colors cursor-default ${isDragOver ? 'border-t-2 border-blue-400' : ''}`}>
                  <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                  {isEditingCF ? (
                    <div className="flex-1 min-w-0"
                      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) saveCustomField(cf.id); }}
                      onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button')) e.preventDefault(); }}>
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
                      </div>
                      {customTypeInput === 'select' && (
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
                    </div>
                  ) : (
                    <button
                      type="button"
                      title="클릭하여 이름 · 속성 수정"
                      onClick={() => { setEditingCustomId(cf.id); setCustomLabelInput(cf.label); const t = cf.type as string; setCustomTypeInput((t === '이름' || t === 'textarea' ? 'name' : t) as FormFieldType); setCustomDeptInput(cf.department ?? ''); setCustomOptionsInput(cf.options?.length ? [...cf.options, ''] : ['', '']); setCustomOptionColors(cf.optionColors ?? {}); setCustomColorPickerIdx(null); }}
                      className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 transition-colors truncate min-w-0">
                      {cf.label}
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
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
                    <Toggle on={cf.enabled !== false} onToggle={() => toggleCustom(cf.id)} />
                    <button onClick={() => deleteCustom(cf.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"><X size={11} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <AddFieldForm onAdd={addCustomField} />
      </div>
    </div>
  );
}

function FormBuilder({ team, onUpdateFormConfig, onUpdatePartFormConfig, onClearPartFormConfig }: {
  team: Team;
  onUpdateFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onUpdatePartFormConfig: (teamId: string, partId: string, config: TeamFormConfig) => Promise<void>;
  onClearPartFormConfig: (teamId: string, partId: string) => Promise<void>;
}) {
  // 선택된 편집 대상: 'team' 또는 파트 ID
  const [selectedTarget, setSelectedTarget] = useState<'team' | string>('team');

  const currentPart = selectedTarget !== 'team'
    ? team.parts.find(p => p.id === selectedTarget)
    : undefined;

  // 현재 편집 대상의 formConfig (파트는 없으면 팀 상속)
  const rawConfig = currentPart?.formConfig ?? team.formConfig;
  const isInherited = selectedTarget !== 'team' && !currentPart?.formConfig;

  const fields = resolveBuiltinFields(rawConfig);
  const customFields = rawConfig?.customFields ?? [];

  const makeConfig = (overrides: Partial<TeamFormConfig>): TeamFormConfig => ({
    builtinFields: fields,
    customFields,
    statusConfigs: rawConfig?.statusConfigs,
    ...overrides,
  });

  const saveFields = (newFields: BuiltinFieldConfig[]) => {
    const config = makeConfig({ builtinFields: newFields });
    if (selectedTarget === 'team') onUpdateFormConfig(team.id, config);
    else onUpdatePartFormConfig(team.id, selectedTarget, config);
  };

  const saveCustom = (newCustom: CustomFormField[]) => {
    const config = makeConfig({ customFields: newCustom });
    if (selectedTarget === 'team') onUpdateFormConfig(team.id, config);
    else onUpdatePartFormConfig(team.id, selectedTarget, config);
  };

  return (
    <div className="space-y-4">
      {/* 적용 대상 선택 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">적용 대상</p>
          <div className="flex flex-wrap gap-1.5">
            {(['team', ...team.parts.map(p => p.id)] as ('team' | string)[]).map(target => {
              const isTeam = target === 'team';
              const part = isTeam ? null : team.parts.find(p => p.id === target);
              const hasOwn = !isTeam && !!part?.formConfig;
              return (
                <button
                  key={target}
                  onClick={() => setSelectedTarget(target)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedTarget === target
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {!isTeam && part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeam ? '팀 기본' : part?.name}
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
          <p className="text-xs text-amber-700">팀 기본 설정 상속 중 — 아래 필드를 수정하면 이 파트만 다르게 저장됩니다</p>
          <button
            onClick={() => onClearPartFormConfig(team.id, selectedTarget)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />초기화
          </button>
        </div>
      )}
      {!isInherited && selectedTarget !== 'team' && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">이 파트의 별도 설정이 적용 중</p>
          <button
            onClick={() => onClearPartFormConfig(team.id, selectedTarget)}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />팀 기본으로 초기화
          </button>
        </div>
      )}

      <FieldConfigEditor
        fields={fields}
        customFields={customFields}
        onSaveFields={saveFields}
        onSaveCustom={saveCustom}
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newIsUrl, setNewIsUrl] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

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

  const toggleUrl = (key: string) => save(fields.map(f => f.key === key ? { ...f, isUrl: !f.isUrl } : f));
  const deleteField = (key: string) => save(fields.filter(f => f.key !== key));
  const addField = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = label.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now();
    save([...fields, { key, label, isUrl: newIsUrl }]);
    setNewLabel(''); setNewIsUrl(false);
  };

  const iCls = "flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white/60 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

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
          <button onClick={() => { if (currentPart) { onClearPart(team.id, currentPart.id); setSelectedTarget('team'); } }}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />팀 기본으로 초기화
          </button>
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
          <button type="button" onClick={() => setNewIsUrl(v => !v)}
            className={`flex-shrink-0 text-[10px] px-2 py-1.5 rounded-md font-medium transition-colors ${newIsUrl ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
            URL
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

function SubTaskTypesEditor({ team, onSave, onSavePart, onClearPart }: {
  team: Team;
  onSave: (teamId: string, types: SubTaskType[]) => Promise<void>;
  onSavePart: (teamId: string, partId: string, types: SubTaskType[]) => Promise<void>;
  onClearPart: (teamId: string, partId: string) => Promise<void>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<'team' | string>('team');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState<Department | ''>('');
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

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
          <button onClick={() => { if (currentPart) { onClearPart(team.id, currentPart.id); setSelectedTarget('team'); } }}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />팀 기본으로 초기화
          </button>
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
            <div key={t.id} draggable
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
              <button type="button" onClick={() => deleteType(t.id)}
                className="text-gray-300 hover:text-red-400 transition-colors ml-0.5">
                <X size={11} />
              </button>
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

function ExcelFieldManager({ team, onSave }: { team: Team; onSave: (teamId: string, config: ExcelFieldConfig[]) => Promise<void> }) {
  // formConfig의 customLabel 반영 (설정에서 명칭 변경한 경우 적용)
  const resolvedBuiltins = resolveBuiltinFields(team.formConfig);
  const BUILTIN_EXCEL_KEYS = ['taskMonth', 'title', 'category', 'type', 'status', 'receiver', 'assignee', 'startDate', 'endDate'];
  const builtinExcelFields = BUILTIN_EXCEL_KEYS.map((key, i) => {
    const bf = resolvedBuiltins.find(f => f.key === key);
    const defaultLabel = BUILTIN_FIELDS_META.find(m => m.key === key)?.label ?? key;
    return { key, label: bf?.customLabel ?? defaultLabel, enabled: true, order: i };
  });
  const metaFields = team.metaFields ?? DEFAULT_META_FIELDS;

  // 기본 필드 목록 생성 (builtins + meta)
  const defaultFields: ExcelFieldConfig[] = [
    ...builtinExcelFields,
    ...metaFields.map((f, i) => ({ key: f.key, label: f.label, enabled: false, order: builtinExcelFields.length + i })),
  ];

  const saved = team.excelConfig;
  const [fields, setFields] = useState<ExcelFieldConfig[]>(() => {
    if (!saved?.length) return defaultFields;
    // saved 기준 정렬, 저장 안된 새 필드는 뒤에 추가
    const savedKeys = new Set(saved.map(f => f.key));
    const extra = defaultFields.filter(f => !savedKeys.has(f.key)).map((f, i) => ({ ...f, order: saved.length + i }));
    // saved의 label을 최신 customLabel로 동기화 (설정에서 명칭 변경 반영)
    const labelMap = Object.fromEntries(defaultFields.map(f => [f.key, f.label]));
    const synced = saved.map(f => ({ ...f, label: labelMap[f.key] ?? f.label }));
    return [...synced, ...extra].sort((a, b) => a.order - b.order);
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // team.formConfig가 바뀌면 label 동기화 (폼설정에서 명칭 변경 후 즉시 반영)
  useEffect(() => {
    const labelMap = Object.fromEntries(defaultFields.map(f => [f.key, f.label]));
    setFields(fs => fs.map(f => ({ ...f, label: labelMap[f.key] ?? f.label })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.formConfig]);

  const toggle = (key: string) => setFields(fs => fs.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  const toggleExportExclude = (key: string) => setFields(fs => fs.map(f => f.key === key ? { ...f, exportExcluded: !f.exportExcluded } : f));

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) return;
    const next = [...fields];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, moved);
    setFields(next.map((f, i) => ({ ...f, order: i })));
    setDragIdx(null); setDragOverIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(team.id, fields.map((f, i) => ({ ...f, order: i })));
    setSaving(false);
  };

  return (
    <div className="space-y-3">
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
      <button onClick={handleSave} disabled={saving}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
        {saving ? '저장 중...' : '저장'}
      </button>
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
];

function TeamSection({ teams, onCreateTeam, onUpdateTeam, onSetParts, onDeleteTeam, onUpdateFormConfig, onUpdatePartFormConfig, onClearPartFormConfig, onUpdateMetaFields, onUpdatePartMetaFields, onClearPartMetaFields, onUpdateSubTaskTypes, onUpdatePartSubTaskTypes, onClearPartSubTaskTypes, onUpdateExcelConfig }: {
  teams: Team[];
  onCreateTeam: (name: string, emoji: string) => Promise<string>;
  onUpdateTeam: (teamId: string, data: Partial<Omit<Team, 'id'>>) => Promise<void>;
  onSetParts: (teamId: string, parts: TeamPart[]) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onUpdateFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onUpdatePartFormConfig: (teamId: string, partId: string, config: TeamFormConfig) => Promise<void>;
  onClearPartFormConfig: (teamId: string, partId: string) => Promise<void>;
  onUpdateMetaFields: (teamId: string, fields: MetaField[]) => Promise<void>;
  onUpdatePartMetaFields: (teamId: string, partId: string, fields: MetaField[]) => Promise<void>;
  onClearPartMetaFields: (teamId: string, partId: string) => Promise<void>;
  onUpdateSubTaskTypes: (teamId: string, types: SubTaskType[]) => Promise<void>;
  onUpdatePartSubTaskTypes: (teamId: string, partId: string, types: SubTaskType[]) => Promise<void>;
  onClearPartSubTaskTypes: (teamId: string, partId: string) => Promise<void>;
  onUpdateExcelConfig: (teamId: string, config: ExcelFieldConfig[]) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🚀');
  const [saving, setSaving] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [teamTab, setTeamTab] = useState<Record<string, 'parts' | 'form' | 'meta' | 'subtask' | 'excel'>>({});
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [colorPickerTeamId, setColorPickerTeamId] = useState<string | null>(null);
  const [partName, setPartName] = useState('');
  const [partColor, setPartColor] = useState(PART_COLORS[0].cls);

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

  return (
    <section className="glass-card">
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
            <div key={team.id}>
              {/* 팀 헤더 */}
              <div className="px-5 py-3 hover:bg-black/[0.02] transition-colors">
                <div className="flex items-center gap-3">
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
                  <div className="mt-2 ml-11 space-y-2" style={{ width: 'fit-content' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 22px)', gap: 5 }}>
                      {TEAM_COLOR_PRESETS.map(hex => (
                        <button key={hex}
                          onClick={() => { onUpdateTeam(team.id, { color: hex }); }}
                          style={{ backgroundColor: hex, width: 22, height: 22, borderRadius: '50%', flexShrink: 0, outline: team.color === hex ? '2px solid #6b7280' : 'none', outlineOffset: 2 }}
                          className="transition-all hover:scale-110" />
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
                  <div className="flex border-b border-black/5 px-5">
                    {(['parts', 'form', 'meta', 'subtask', 'excel'] as const).map(tab => (
                      <button key={tab}
                        onClick={() => setTeamTab(t => ({ ...t, [team.id]: tab }))}
                        className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                          (teamTab[team.id] ?? 'parts') === tab
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}>
                        {tab === 'parts' ? '파트 관리' : tab === 'form' ? '폼 설정' : tab === 'meta' ? '업무 정보 필드' : tab === 'subtask' ? '세부 업무' : '엑셀 관리'}
                      </button>
                    ))}
                  </div>

                  {/* 파트 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'parts' && (
                    <div className="px-5 py-4 space-y-3">
                      {team.parts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {team.parts.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-black/8 text-xs">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                              <span className="text-gray-700 font-medium">{p.name}</span>
                              <button onClick={() => handleDeletePart(team, p.id)}
                                className="text-gray-300 hover:text-red-400 transition-colors ml-0.5">
                                <X size={10} />
                              </button>
                            </div>
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
                    </div>
                  )}

                  {/* 폼 설정 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'form' && (
                    <div className="px-5 py-4">
                      <FormBuilder
                        team={team}
                        onUpdateFormConfig={onUpdateFormConfig}
                        onUpdatePartFormConfig={onUpdatePartFormConfig}
                        onClearPartFormConfig={onClearPartFormConfig}
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

                  {/* 엑셀 관리 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'excel' && (
                    <div className="px-5 py-4">
                      <ExcelFieldManager team={team} onSave={onUpdateExcelConfig} />
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
// 메인 페이지
// ──────────────────────────────────────────
export default function SettingsPage({
  appUser, onUpdateName, onUpdateDepartment, onUpdateSelectedTeams, onUpdateDefaultTeam,
  teams, teamsLoading, onCreateTeam, onUpdateTeam, onSetParts, onDeleteTeam,
  onUpdateFormConfig, onUpdatePartFormConfig, onClearPartFormConfig, onUpdateMetaFields, onUpdatePartMetaFields, onClearPartMetaFields, onUpdateSubTaskTypes, onUpdatePartSubTaskTypes, onClearPartSubTaskTypes, onUpdateExcelConfig,
  customHolidays, onUpdateHolidays,
  orphanTaskCount, onCleanupOrphanTasks,
}: Props) {
  const [nameInput, setNameInput] = useState(appUser.displayName);
  const [nameSaved, setNameSaved] = useState(false);
  const { users, updateUserRole, updateUserInfo } = useAllUsers();

  const canManageUsers = appUser.role === 'superadmin' || appUser.role === 'manager';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">설정</h1>
        <p className="page-subtitle">계정 및 권한 관리</p>
      </div>

      {/* 내 프로필 */}
      <section className="glass-card">
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
                    const isDefault = appUser.defaultTeamId === t.id;
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
      </section>

      {/* 팀 관리 — 중간 관리자 이상 */}
      {canManageUsers && (
        <TeamSection
          teams={teams}
          onCreateTeam={onCreateTeam}
          onUpdateTeam={onUpdateTeam}
          onSetParts={onSetParts}
          onDeleteTeam={onDeleteTeam}
          onUpdateFormConfig={onUpdateFormConfig}
          onUpdatePartFormConfig={onUpdatePartFormConfig}
          onClearPartFormConfig={onClearPartFormConfig}
          onUpdateMetaFields={onUpdateMetaFields}
          onUpdatePartMetaFields={onUpdatePartMetaFields}
          onClearPartMetaFields={onClearPartMetaFields}
          onUpdateSubTaskTypes={onUpdateSubTaskTypes}
          onUpdatePartSubTaskTypes={onUpdatePartSubTaskTypes}
          onClearPartSubTaskTypes={onClearPartSubTaskTypes}
          onUpdateExcelConfig={onUpdateExcelConfig}
        />
      )}

      {/* 사용자 관리 — 중간 관리자 이상 */}
      {canManageUsers && (
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
                    ? users.filter(u => u.selectedTeamIds?.includes(team.id))
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
                                  onChangeRole={updateUserRole} onUpdateInfo={updateUserInfo} teams={teams} />
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

      {/* 권한 안내 */}
      <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Shield size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">권한 안내</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3 text-xs">
            {(['superadmin', 'manager', 'user'] as UserRole[]).map(r => (
              <div key={r} className="flex flex-col gap-3">
                <div><RoleBadge role={r} /></div>
                <ul className="space-y-1.5 text-gray-500">
                  {r !== 'user' && <li>· 팀 / 파트 생성 및 관리</li>}
                  {r === 'superadmin' && <li>· 사용자 권한 관리</li>}
                  {r !== 'user' && <li>· 구성원 이름/직군 수정</li>}
                  <li>· 업무 등록/수정/삭제</li>
                  <li>· 휴가 등록</li>
                  <li>· 세부업무 시간 입력</li>
                  <li>· 시작일/종료일 변경</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 휴일 관리 — 중간 관리자 이상 */}
      {canManageUsers && (
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
              canEdit={canManageUsers}
            />
          </div>
        </section>
      )}

      {/* 슈퍼어드민 전용: 데이터 마이그레이션 */}
      {appUser.role === 'superadmin' && (
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

      {/* 데이터 정리 — 최고 관리자 전용 */}
      {appUser.role === 'superadmin' && (
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
  );
}
