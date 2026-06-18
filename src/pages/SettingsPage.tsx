import { useState, useRef, useEffect } from 'react';
import { Shield, User, Users, Check, ChevronDown, Pencil, X, Plus, Trash2, Layers, GripVertical, RotateCcw } from 'lucide-react';
import type { AppUser, UserRole, Department, Team, TeamPart, TeamFormConfig, CustomFormField, FormFieldType, BuiltinFieldKey, BuiltinFieldConfig } from '../types';
import { DEPARTMENTS, BUILTIN_FIELDS_META, TABLE_FIELD_KEYS, resolveBuiltinFields } from '../types';
import { useAllUsers } from '../hooks/useUserRole';

interface Props {
  appUser: AppUser;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateDepartment: (dept: Department) => Promise<void>;
  onUpdateSelectedTeam: (teamId: string | null) => Promise<void>;
  teams: Team[];
  onCreateTeam: (name: string, emoji: string) => Promise<string>;
  onUpdateTeam: (teamId: string, data: Partial<Omit<Team, 'id'>>) => Promise<void>;
  onSetParts: (teamId: string, parts: TeamPart[]) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onUpdateFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onUpdatePartFormConfig: (teamId: string, partId: string, config: TeamFormConfig) => Promise<void>;
  onClearPartFormConfig: (teamId: string, partId: string) => Promise<void>;
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
  superadmin: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/15',
  manager: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
  user: 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-white/8',
};
const DEPT_COLOR: Record<Department, string> = {
  '기획': 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/15',
  '디자인': 'text-pink-600 bg-pink-50 dark:text-pink-300 dark:bg-pink-500/15',
  '퍼블': 'text-teal-600 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/15',
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
              : 'border-black/10 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
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
    <div className="grid grid-cols-10 gap-1">
      {EMOJIS.map(e => (
        <button key={e} type="button" onClick={() => onChange(e)}
          className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all hover:scale-110 ${
            value === e ? 'bg-blue-100 dark:bg-blue-500/20 ring-2 ring-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/8'
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
        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <span className={ROLE_COLOR[u.role].split(' ')[0]}>{ROLE_LABEL[u.role]}</span>
        <ChevronDown size={12} className="text-gray-400" />
      </button>
      {open && (
        <div data-role-dd style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9999 }}
          className="w-36 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a2240] shadow-xl py-1">
          {(['manager', 'user'] as UserRole[]).map(r => (
            <button key={r} onClick={() => { onChangeRole(u.uid, r); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <span className="text-gray-800 dark:text-gray-200">{ROLE_LABEL[r]}</span>
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
function UserRow({ u, viewerRole, isSelf, onChangeRole, onUpdateInfo }: {
  u: AppUser; viewerRole: UserRole; isSelf: boolean;
  onChangeRole: (uid: string, role: UserRole) => void;
  onUpdateInfo: (uid: string, data: { displayName?: string; department?: Department }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(u.displayName);
  const [deptInput, setDeptInput] = useState<Department | undefined>(u.department);

  const canEdit = !isSelf && (viewerRole === 'superadmin' || (viewerRole === 'manager' && u.role !== 'superadmin'));
  const canChangeRole = viewerRole === 'superadmin' && !isSelf && u.role !== 'superadmin';

  const handleSave = async () => {
    await onUpdateInfo(u.uid, { displayName: nameInput.trim() || u.displayName, department: deptInput });
    setEditing(false);
  };

  return (
    <div className="px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {u.displayName?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {u.displayName}{isSelf && <span className="ml-1.5 text-xs text-gray-400">(나)</span>}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {u.department ? <DeptBadge dept={u.department} /> : (
            <span className="text-xs text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-full">미설정</span>
          )}
          {canChangeRole ? <RoleDropdown u={u} onChangeRole={onChangeRole} /> : <RoleBadge role={u.role} />}
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all">
              <Pencil size={12} />
            </button>
          )}
          {editing && (
            <button onClick={() => { setEditing(false); setNameInput(u.displayName); setDeptInput(u.department); }}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-3 ml-11 space-y-2.5">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">이름</label>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)}
              className="w-full max-w-xs text-sm px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">직군</label>
            <DeptSelector value={deptInput} onChange={setDeptInput} />
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
const BUILTIN_FIELD_TYPES: FormFieldType[] = ['text', 'date', 'number', 'name', 'link'];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`w-10 h-6 rounded-full p-0 relative transition-colors flex-shrink-0 ${on ? 'bg-blue-500' : 'bg-gray-200 dark:bg-white/15'}`}>
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

  const cls = "text-xs px-2 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400";

  const handleAdd = () => {
    if (!label.trim()) return;
    onAdd({ label: label.trim(), type, required, options: type === 'select' ? options.filter(o => o.trim()) : undefined });
    setLabel(''); setType('text'); setRequired(false); setOptions(['', '']); setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium mt-1.5 transition-colors">
      <Plus size={11} />필드 추가
    </button>
  );

  return (
    <div className="mt-2 p-3 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5 space-y-2.5">
      <div className="flex gap-2">
        <input className={`${cls} flex-1`} placeholder="필드명 *" value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus />
        <select className={cls} value={type} onChange={e => setType(e.target.value as FormFieldType)}>
          {CUSTOM_FIELD_TYPES.map(t => (
            <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="rounded" />
          필수
        </label>
      </div>
      {type === 'select' && (
        <div className="space-y-1">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">선택지</p>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-1.5">
              <input className={`${cls} flex-1`} placeholder={`옵션 ${i + 1}`} value={opt}
                onChange={e => setOptions(o => o.map((v, j) => j === i ? e.target.value : v))} />
              {options.length > 1 && (
                <button type="button" onClick={() => setOptions(o => o.filter((_, j) => j !== i))}
                  className="text-gray-300 hover:text-red-400 transition-colors"><X size={12} /></button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setOptions(o => [...o, ''])}
            className="text-xs text-blue-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors">
            <Plus size={10} />옵션 추가
          </button>
        </div>
      )}
      <div className="flex gap-2 pt-0.5">
        <button onClick={handleAdd} disabled={!label.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
          추가
        </button>
        <button onClick={() => { setOpen(false); setLabel(''); setType('text'); setRequired(false); setOptions(['', '']); }}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          취소
        </button>
      </div>
    </div>
  );
}

// ── 필드 설정 빌더 (드래그 앤 드롭 + 너비 조절) ──
function FieldConfigEditor({ fields: fieldsProp, customFields, isInherited, onSaveFields, onSaveCustom }: {
  fields: BuiltinFieldConfig[];
  customFields: CustomFormField[];
  isInherited?: boolean;
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

  // 인라인 편집 (커스텀 필드)
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [customTypeInput, setCustomTypeInput] = useState<FormFieldType>('text');

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

  const updateWidth = (key: BuiltinFieldKey, w: number) => {
    const updated = fields.map(f => f.key === key ? { ...f, width: w } : f);
    setFields(updated);
    onSaveFields(updated);
  };

  const toggleBuiltin = (key: BuiltinFieldKey) => {
    const updated = fields.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f);
    setFields(updated);
    onSaveFields(updated);
  };

  const saveLabel = (key: BuiltinFieldKey) => {
    const trimmed = labelInput.trim();
    const updated = fields.map(f =>
      f.key === key ? {
        ...f,
        customLabel: trimmed || undefined,
        customType: typeInput === 'default' ? undefined : typeInput as FormFieldType,
      } : f
    );
    setFields(updated);
    onSaveFields(updated);
    setEditingKey(null);
  };

  const saveCustomField = (id: string) => {
    const newLabel = customLabelInput.trim();
    const updated = customFields.map(cf =>
      cf.id === id ? { ...cf, label: newLabel || cf.label, type: customTypeInput } : cf
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
    <div className={`space-y-4 ${isInherited ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* 기본 필드 */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wide mb-1.5">
          기본 필드
          <span className="text-gray-300 dark:text-white/20 font-normal normal-case ml-1">드래그로 순서 · 이름 클릭으로 이름/속성 수정</span>
        </p>
        <div className="rounded-xl border border-black/7 dark:border-white/7 overflow-hidden divide-y divide-black/5 dark:divide-white/5">
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
                className={`flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-default ${isDragOver ? 'border-t-2 border-blue-400' : ''}`}>
                <GripVertical size={13} className="text-gray-300 dark:text-white/20 cursor-grab active:cursor-grabbing flex-shrink-0" />
                {/* 레이블·속성 인라인 편집 */}
                {editingKey === fc.key ? (
                  <div
                    className="flex-1 flex items-center gap-1.5 min-w-0"
                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) saveLabel(fc.key); }}>
                    <input
                      autoFocus
                      className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded-md border border-blue-400 dark:border-blue-500/60 bg-white dark:bg-white/8 text-gray-800 dark:text-white/80 focus:outline-none"
                      value={labelInput}
                      placeholder={defaultLabel}
                      onChange={e => setLabelInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveLabel(fc.key); if (e.key === 'Escape') setEditingKey(null); }}
                    />
                    {!isTypeFixed && (
                      <select
                        className="text-[11px] px-1.5 py-0.5 rounded-md border border-black/10 dark:border-white/12 bg-white dark:bg-white/8 text-gray-700 dark:text-white/70 focus:outline-none flex-shrink-0"
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
                ) : (
                  <button
                    type="button"
                    title="클릭하여 이름 · 속성 수정"
                    onClick={() => { setEditingKey(fc.key); setLabelInput(fc.customLabel ?? ''); setTypeInput(fc.customType ?? 'default'); }}
                    className="flex-1 text-left text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate min-w-0">
                    {label}
                    {fc.customLabel && <span className="ml-1 text-[10px] text-blue-400 font-medium">수정됨</span>}
                    {fc.customType && <span className="ml-1 text-[10px] text-violet-400 font-medium">{FIELD_TYPE_LABELS[fc.customType]}</span>}
                  </button>
                )}
                {/* 너비 조절 (title 제외) */}
                {!isTitle && isTableField(fc.key) && fc.enabled && (
                  <div className="flex items-center gap-px flex-shrink-0">
                    <button onClick={() => updateWidth(fc.key, Math.max(50, fc.width - 10))}
                      className="w-5 h-5 flex items-center justify-center text-gray-300 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors text-sm leading-none">−</button>
                    <span className="w-10 text-center text-[11px] text-gray-400 dark:text-white/35 tabular-nums select-none">
                      {fc.key === 'weeklyHours' ? `${fc.width}×5` : `${fc.width}px`}
                    </span>
                    <button onClick={() => updateWidth(fc.key, Math.min(300, fc.width + 10))}
                      className="w-5 h-5 flex items-center justify-center text-gray-300 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors text-sm leading-none">+</button>
                  </div>
                )}
                {/* 토글 (title은 항상 활성) */}
                {isTitle
                  ? <span className="text-[11px] text-gray-300 dark:text-white/25 italic flex-shrink-0">항상</span>
                  : <Toggle on={fc.enabled} onToggle={() => toggleBuiltin(fc.key)} />
                }
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/30">
          업무 페이지에서 헤더 드래그로 너비 조절 가능 (관리자만)
        </p>
      </div>

      {/* 커스텀 필드 */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wide mb-1.5">커스텀 필드</p>
        {customFields.length > 0 && (
          <div className="rounded-xl border border-black/7 dark:border-white/7 overflow-hidden divide-y divide-black/5 dark:divide-white/5 mb-2">
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
                  className={`flex items-center gap-2 py-1.5 px-2.5 hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-default ${isDragOver ? 'border-t-2 border-blue-400' : ''}`}>
                  <GripVertical size={13} className="text-gray-300 dark:text-white/20 cursor-grab active:cursor-grabbing flex-shrink-0" />
                  {isEditingCF ? (
                    <div
                      className="flex-1 flex items-center gap-1.5 min-w-0"
                      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) saveCustomField(cf.id); }}>
                      <input
                        autoFocus
                        className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded-md border border-blue-400 dark:border-blue-500/60 bg-white dark:bg-white/8 text-gray-800 dark:text-white/80 focus:outline-none"
                        value={customLabelInput}
                        onChange={e => setCustomLabelInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCustomField(cf.id); if (e.key === 'Escape') setEditingCustomId(null); }}
                      />
                      <select
                        className="text-[11px] px-1.5 py-0.5 rounded-md border border-black/10 dark:border-white/12 bg-white dark:bg-white/8 text-gray-700 dark:text-white/70 focus:outline-none flex-shrink-0"
                        value={customTypeInput}
                        onChange={e => setCustomTypeInput(e.target.value as FormFieldType)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCustomField(cf.id); if (e.key === 'Escape') setEditingCustomId(null); }}>
                        {CUSTOM_FIELD_TYPES.map(t => (
                          <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <button
                      type="button"
                      title="클릭하여 이름 · 속성 수정"
                      onClick={() => { setEditingCustomId(cf.id); setCustomLabelInput(cf.label); setCustomTypeInput((cf.type === 'textarea' ? 'name' : cf.type) as FormFieldType); }}
                      className="flex-1 text-left text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate min-w-0">
                      {cf.label}
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isEditingCF && <span className="text-[10px] text-gray-400 bg-black/5 dark:bg-white/8 px-1.5 py-0.5 rounded-full">{FIELD_TYPE_LABELS[cf.type] ?? cf.type}</span>}
                    {cf.required && <span className="text-[10px] text-red-400 font-medium">필수</span>}
                    <Toggle on={cf.enabled !== false} onToggle={() => toggleCustom(cf.id)} />
                    <button onClick={() => deleteCustom(cf.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors ml-0.5"><X size={11} /></button>
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

  const saveFields = (newFields: BuiltinFieldConfig[]) => {
    const config: TeamFormConfig = { builtinFields: newFields, customFields };
    if (selectedTarget === 'team') {
      onUpdateFormConfig(team.id, config);
    } else {
      onUpdatePartFormConfig(team.id, selectedTarget, config);
    }
  };

  const saveCustom = (newCustom: CustomFormField[]) => {
    const config: TeamFormConfig = { builtinFields: fields, customFields: newCustom };
    if (selectedTarget === 'team') {
      onUpdateFormConfig(team.id, config);
    } else {
      onUpdatePartFormConfig(team.id, selectedTarget, config);
    }
  };

  return (
    <div className="space-y-4">
      {/* 적용 대상 선택 */}
      {team.parts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wide mb-1.5">적용 대상</p>
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
                      : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}>
                  {!isTeam && part && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${part.color}`} />}
                  {isTeam ? '팀 기본' : part?.name}
                  {hasOwn && (
                    <span className={`text-[10px] px-1 rounded ${selectedTarget === target ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300'}`}>
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
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <p className="text-xs text-amber-700 dark:text-amber-300">팀 기본 설정을 상속 중 — 변경하면 이 파트만 다르게 저장됩니다</p>
          <button
            onClick={() => onClearPartFormConfig(team.id, selectedTarget)}
            className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />초기화
          </button>
        </div>
      )}
      {!isInherited && selectedTarget !== 'team' && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
          <p className="text-xs text-blue-700 dark:text-blue-300">이 파트의 별도 설정이 적용 중</p>
          <button
            onClick={() => onClearPartFormConfig(team.id, selectedTarget)}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-medium ml-3 flex-shrink-0">
            <RotateCcw size={11} />팀 기본으로 초기화
          </button>
        </div>
      )}

      <FieldConfigEditor
        fields={fields}
        customFields={customFields}
        isInherited={isInherited}
        onSaveFields={saveFields}
        onSaveCustom={saveCustom}
      />
    </div>
  );
}

// ──────────────────────────────────────────
// 팀 관리 섹션
// ──────────────────────────────────────────
function TeamSection({ teams, onCreateTeam, onUpdateTeam, onSetParts, onDeleteTeam, onUpdateFormConfig, onUpdatePartFormConfig, onClearPartFormConfig }: {
  teams: Team[];
  onCreateTeam: (name: string, emoji: string) => Promise<string>;
  onUpdateTeam: (teamId: string, data: Partial<Omit<Team, 'id'>>) => Promise<void>;
  onSetParts: (teamId: string, parts: TeamPart[]) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onUpdateFormConfig: (teamId: string, config: TeamFormConfig) => Promise<void>;
  onUpdatePartFormConfig: (teamId: string, partId: string, config: TeamFormConfig) => Promise<void>;
  onClearPartFormConfig: (teamId: string, partId: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🚀');
  const [saving, setSaving] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [teamTab, setTeamTab] = useState<Record<string, 'parts' | 'form'>>({});
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
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-white">팀 관리</span>
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
        <div className="px-5 py-4 border-b border-black/[0.04] dark:border-white/[0.04] space-y-3">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">새 팀 만들기</p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">이모지 선택</label>
            <div className="p-2 rounded-xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/3">
              <EmojiPicker value={newEmoji} onChange={setNewEmoji} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">팀 이름</label>
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="팀 이름 입력"
              className="w-full text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
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
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {teams.map(team => (
            <div key={team.id}>
              {/* 팀 헤더 */}
              <div className="flex items-center gap-3 px-5 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-lg flex-shrink-0">
                  {team.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</p>
                  <p className="text-xs text-gray-400">{team.parts.length}개 파트</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                    className="text-xs text-blue-500 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                    {expandedTeam === team.id ? '닫기' : '팀 설정'}
                  </button>
                  <button onClick={() => { if (confirm(`"${team.name}" 팀을 삭제하시겠습니까?`)) onDeleteTeam(team.id); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* 팀 설정 패널 (파트 / 폼 설정 탭) */}
              {expandedTeam === team.id && (
                <div className="bg-black/[0.015] dark:bg-white/[0.015]">
                  {/* 탭 */}
                  <div className="flex border-b border-black/5 dark:border-white/5 px-5">
                    {(['parts', 'form'] as const).map(tab => (
                      <button key={tab}
                        onClick={() => setTeamTab(t => ({ ...t, [team.id]: tab }))}
                        className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                          (teamTab[team.id] ?? 'parts') === tab
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-white/60'
                        }`}>
                        {tab === 'parts' ? '파트 관리' : '폼 설정'}
                      </button>
                    ))}
                  </div>

                  {/* 파트 탭 */}
                  {(teamTab[team.id] ?? 'parts') === 'parts' && (
                    <div className="px-5 py-4 space-y-3">
                      {team.parts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {team.parts.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-white/8 border border-black/8 dark:border-white/8 text-xs">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{p.name}</span>
                              <button onClick={() => handleDeletePart(team, p.id)}
                                className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors ml-0.5">
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
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
  appUser, onUpdateName, onUpdateDepartment, onUpdateSelectedTeam,
  teams, onCreateTeam, onUpdateTeam, onSetParts, onDeleteTeam,
  onUpdateFormConfig, onUpdatePartFormConfig, onClearPartFormConfig,
}: Props) {
  const [nameInput, setNameInput] = useState(appUser.displayName);
  const [nameSaved, setNameSaved] = useState(false);
  const { users, updateUserRole, updateUserInfo } = useAllUsers();

  const canManageUsers = appUser.role === 'superadmin' || appUser.role === 'manager';

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
        <div className="flex items-center gap-2 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <User size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-white">내 프로필</span>
          <RoleBadge role={appUser.role} />
          {appUser.department && <DeptBadge dept={appUser.department} />}
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">이메일</label>
            <p className="text-sm text-gray-700 dark:text-gray-300">{appUser.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">표시 이름</label>
            <div className="flex gap-2">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                className="flex-1 max-w-xs text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <button onClick={handleSaveName}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${nameSaved ? 'bg-green-500 text-white' : 'btn-shiny-primary'}`}>
                {nameSaved ? '저장됨' : '저장'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              직군 <span className="text-orange-500">*</span>
            </label>
            <DeptSelector value={appUser.department} onChange={onUpdateDepartment} />
            {!appUser.department && (
              <p className="mt-1.5 text-xs text-orange-500">직군을 선택해주세요. 모든 구성원이 필수 설정해야 합니다.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              소속 팀 <span className="text-orange-500">*</span>
            </label>
            {teams.length === 0 ? (
              <p className="text-xs text-gray-400 italic">생성된 팀이 없습니다{appUser.role !== 'user' ? ' — 아래에서 팀을 먼저 만들어주세요' : ''}.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* 무소속 버튼 */}
                <button
                  onClick={() => onUpdateSelectedTeam(null)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    !appUser.selectedTeamId
                      ? 'bg-gray-500 text-white border-gray-500 shadow-md'
                      : 'border-black/10 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}>
                  <span className="text-base">🚫</span>
                  <span>무소속</span>
                  {!appUser.selectedTeamId && <Check size={13} />}
                </button>
                {teams.map(t => (
                  <button key={t.id} onClick={() => onUpdateSelectedTeam(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      appUser.selectedTeamId === t.id
                        ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                        : 'border-black/10 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}>
                    <span className="text-base">{t.emoji}</span>
                    <span>{t.name}</span>
                    {appUser.selectedTeamId === t.id && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
            {teams.length > 0 && !appUser.selectedTeamId && (
              <p className="mt-1.5 text-xs text-orange-500">소속 팀을 선택해주세요. 팀을 선택해야 업무 데이터를 볼 수 있습니다.</p>
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
        />
      )}

      {/* 사용자 관리 — 중간 관리자 이상 */}
      {canManageUsers && (
        <section className="glass-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <Users size={15} className="text-purple-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-white">사용자 관리</span>
            <span className="text-xs text-gray-400">{users.length}명</span>
          </div>
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {users.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">등록된 사용자 없음</p>
            ) : (
              users
                .sort((a, b) => ({ superadmin: 0, manager: 1, user: 2 }[a.role] - { superadmin: 0, manager: 1, user: 2 }[b.role]))
                .map(u => (
                  <UserRow key={u.uid} u={u} viewerRole={appUser.role} isSelf={u.uid === appUser.uid}
                    onChangeRole={updateUserRole} onUpdateInfo={updateUserInfo} />
                ))
            )}
          </div>
        </section>
      )}

      {/* 권한 안내 */}
      <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <Shield size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-white">권한 안내</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3 text-xs">
            {(['superadmin', 'manager', 'user'] as UserRole[]).map(r => (
              <div key={r} className="space-y-2">
                <RoleBadge role={r} />
                <ul className="space-y-1 text-gray-500 dark:text-gray-400">
                  {r !== 'user' && <li>· 팀 / 파트 생성 및 관리</li>}
                  {r !== 'user' && <li>· 업무 등록/수정/삭제</li>}
                  {r === 'superadmin' && <li>· 사용자 권한 관리</li>}
                  {r !== 'user' && <li>· 구성원 이름/직군 수정</li>}
                  <li>· 휴가 등록</li>
                  <li>· 세부업무 시간 입력</li>
                  <li>· 시작일/종료일 변경</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
