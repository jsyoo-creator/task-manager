import { useState } from 'react';
import { X } from 'lucide-react';
import type { Task, TaskStatus, TaskType, TeamPart, TeamFormConfig, BuiltinFieldKey, Department } from '../types';
import { resolveBuiltinFields } from '../types';
import DatePicker from './DatePicker';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  projectId: string;
  parts?: TeamPart[];
  assignees?: string[];
  teamMembers?: { name: string; department?: Department }[];
  formConfig?: TeamFormConfig;
}

const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];
const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const REVISION_OPTIONS = ['없음', 'F1 단계', 'F2 단계', 'F3 단계', 'F4 단계', 'F5 단계', 'F6 단계'];

const now = new Date();
const DEFAULT_TASK_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0');
  return { value: `${now.getFullYear()}-${m}`, label: `${i + 1}월` };
});

const cls = "w-full bg-black/3 border border-black/8 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder-gray-400 transition-all";
const lbl = "block text-xs font-medium text-gray-500 mb-1";

// 의미상 짝을 이루는 필드 쌍 (폼에서 나란히 배치)
const FIELD_PAIRS: [BuiltinFieldKey, BuiltinFieldKey][] = [
  ['category', 'type'],
  ['receiver', 'assignee'],
  ['startDate', 'endDate'],
];

export default function NewTaskModal({ open, onClose, onSubmit, projectId, parts, assignees = [], teamMembers, formConfig }: Props) {
  const partNames = parts && parts.length > 0 ? parts.map(p => p.name) : [];
  const builtinFields = resolveBuiltinFields(formConfig);
  const customFields = formConfig?.customFields ?? [];
  // 폼에 표시할 필드 순서 (weeklyHours는 폼 입력 없음)
  const formKeys = builtinFields
    .filter(fc => fc.enabled && fc.key !== 'weeklyHours')
    .map(fc => fc.key);

  const [form, setForm] = useState({
    taskMonth: DEFAULT_TASK_MONTH,
    title: '',
    category: partNames[0] ?? '',
    type: '신규' as TaskType,
    status: '진행 전' as TaskStatus,
    receiver: assignees[0] ?? '',
    assignee: assignees[0] ?? '',
    startDate: '',
    endDate: '',
    revisionLevel: 0,
  });
  const [custom, setCustom] = useState<Record<string, string>>({});

  if (!open) return null;

  const resetForm = () => {
    setForm({ taskMonth: DEFAULT_TASK_MONTH, title: '', category: partNames[0] ?? '', type: '신규', status: '진행 전', receiver: assignees[0] ?? '', assignee: assignees[0] ?? '', startDate: '', endDate: '', revisionLevel: 0 });
    setCustom({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.taskMonth) { alert('월을 선택해 주세요.'); return; }
    onSubmit({ ...form, projectId, weeklyHours: {}, totalHours: 0, customFields: Object.keys(custom).length > 0 ? custom : undefined });
    resetForm();
    onClose();
  };

  const setF = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  const DEFAULT_LABELS: Partial<Record<BuiltinFieldKey, string>> = {
    taskMonth: '월', title: '업무명', category: '파트/구분', type: '유형', status: '상태',
    receiver: '접수자', assignee: '담당자', startDate: '시작일', endDate: '종료일',
    revisionLevel: '수정단계',
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-lg mx-4 max-h-[90vh] flex flex-col rounded-2xl bg-white border border-black/8 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">새 업무 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto flex-1">
          {/* 동적 필드 렌더링 — builtinFields 순서 기반 */}
          {(() => {
            const renderField = (k: BuiltinFieldKey): JSX.Element | null => {
              const fc = builtinFields.find(f => f.key === k);
              const fieldLabel = fc?.customLabel ?? DEFAULT_LABELS[k] ?? k;

              // 속성(customType) 오버라이드가 있으면 해당 타입으로 렌더링
              if (fc?.customType) {
                const ct = fc.customType;
                const strVal = String(form[k as keyof typeof form] ?? '');
                const setVal = (v: string) => setForm(f => ({ ...f, [k]: v }));
                if (ct === 'name') return (
                  <div>
                    <label className={lbl}>{fieldLabel}</label>
                    <select className={cls} value={strVal} onChange={e => setVal(e.target.value)}>
                      <option value="">선택하세요</option>
                      {assignees.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                );
                if (ct === 'date') return (
                  <div>
                    <label className={lbl}>{fieldLabel}</label>
                    <DatePicker value={strVal} onChange={setVal} />
                  </div>
                );
                if (ct === 'number') return (
                  <div>
                    <label className={lbl}>{fieldLabel}</label>
                    <input type="number" className={cls} value={strVal} onChange={e => setVal(e.target.value)} />
                  </div>
                );
                if (ct === 'link') return (
                  <div>
                    <label className={lbl}>{fieldLabel}</label>
                    <input type="url" className={cls} placeholder="https://" value={strVal} onChange={e => setVal(e.target.value)} />
                  </div>
                );
                // 기본: text
                return (
                  <div>
                    <label className={lbl}>{fieldLabel}</label>
                    <input type="text" className={cls} value={strVal} onChange={e => setVal(e.target.value)} />
                  </div>
                );
              }

              if (k === 'taskMonth') return (
                <div>
                  <label className={lbl}>{fieldLabel} *</label>
                  <select required className={cls} value={form.taskMonth} onChange={e => setF({ taskMonth: e.target.value })}>
                    <option value="">월 선택</option>
                    {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              );
              if (k === 'title') return (
                <div>
                  <label className={lbl}>{fieldLabel} *</label>
                  <input required type="text" className={cls} placeholder={`${fieldLabel}을 입력하세요`}
                    value={form.title} onChange={e => setF({ title: e.target.value })} />
                </div>
              );
              if (k === 'category') {
                if (partNames.length === 0) return null;
                return (
                  <div>
                    <label className={lbl}>{fieldLabel}</label>
                    <select className={cls} value={form.category} onChange={e => setF({ category: e.target.value })}>
                      {partNames.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                );
              }
              if (k === 'type') return (
                <div>
                  <label className={lbl}>{fieldLabel}</label>
                  <select className={cls} value={form.type} onChange={e => setF({ type: e.target.value as TaskType })}>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              );
              if (k === 'receiver') {
                const rfc = builtinFields.find(f => f.key === 'receiver');
                const ropts = rfc?.department && teamMembers?.length
                  ? teamMembers.filter(m => m.department === rfc.department).map(m => m.name)
                  : assignees;
                return (
                  <div>
                    <label className={lbl}>{fieldLabel}</label>
                    <select className={cls} value={form.receiver} onChange={e => setF({ receiver: e.target.value })}>
                      {ropts.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                );
              }
              if (k === 'assignee') {
                const afc = builtinFields.find(f => f.key === 'assignee');
                const aopts = afc?.department && teamMembers?.length
                  ? teamMembers.filter(m => m.department === afc.department).map(m => m.name)
                  : assignees;
                return (
                  <div>
                    <label className={lbl}>{fieldLabel}</label>
                    <select className={cls} value={form.assignee} onChange={e => setF({ assignee: e.target.value })}>
                      {aopts.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                );
              }
              if (k === 'status') return (
                <div>
                  <label className={lbl}>{fieldLabel}</label>
                  <select className={cls} value={form.status} onChange={e => setF({ status: e.target.value as TaskStatus })}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              );
              if (k === 'startDate') return (
                <div>
                  <label className={lbl}>{fieldLabel}</label>
                  <DatePicker value={form.startDate} onChange={v => setF({ startDate: v })} />
                </div>
              );
              if (k === 'endDate') return (
                <div>
                  <label className={lbl}>{fieldLabel}</label>
                  <DatePicker value={form.endDate} onChange={v => setF({ endDate: v })} />
                </div>
              );
              if (k === 'revisionLevel') return (
                <div>
                  <label className={lbl}>{fieldLabel}</label>
                  <select className={cls} value={form.revisionLevel}
                    onChange={e => setF({ revisionLevel: Number(e.target.value) })}>
                    {REVISION_OPTIONS.map((o, idx) => <option key={idx} value={idx}>{o}</option>)}
                  </select>
                </div>
              );
              return null;
            };

            const result: JSX.Element[] = [];
            let i = 0;
            while (i < formKeys.length) {
              const key = formKeys[i];
              const nextKey = formKeys[i + 1] as BuiltinFieldKey | undefined;
              const isPair = nextKey !== undefined && FIELD_PAIRS.some(
                ([a, b]) => (a === key && b === nextKey) || (b === key && a === nextKey)
              );
              if (isPair && nextKey) {
                result.push(
                  <div key={`${key}-${nextKey}`} className="grid grid-cols-2 gap-3">
                    {renderField(key)}
                    {renderField(nextKey)}
                  </div>
                );
                i += 2;
              } else {
                const el = renderField(key);
                if (el) result.push(<div key={key}>{el}</div>);
                i += 1;
              }
            }
            return result;
          })()}

          {/* 커스텀 필드 */}
          {customFields.filter(cf => cf.enabled !== false).map(cf => {
            const cfType = cf.type as string;
            const isNameType = cfType === 'name' || cfType === 'textarea' || cfType === '이름';
            const opts = isNameType
              ? (teamMembers && cf.department
                  ? teamMembers.filter(m => m.department === cf.department).map(m => m.name)
                  : assignees)
              : [];
            return (
              <div key={cf.id}>
                <label className={lbl}>
                  {cf.label}{cf.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {isNameType && (
                  <select required={cf.required} className={cls}
                    value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))}>
                    <option value="">선택하세요</option>
                    {opts.map(a => <option key={a}>{a}</option>)}
                  </select>
                )}
                {cfType === 'text' && (
                  <input type="text" required={cf.required} className={cls}
                    value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))} />
                )}
                {cfType === 'select' && (
                  <select required={cf.required} className={cls}
                    value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))}>
                    <option value="">선택하세요</option>
                    {cf.options?.map(o => <option key={o}>{o}</option>)}
                  </select>
                )}
                {cfType === 'date' && (
                  <input type="date" required={cf.required} className={cls}
                    value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))} />
                )}
                {cfType === 'number' && (
                  <input type="number" required={cf.required} className={cls}
                    value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))} />
                )}
                {cfType === 'link' && (
                  <input type="url" required={cf.required} className={cls} placeholder="https://"
                    value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))} />
                )}
              </div>
            );
          })}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-black/4 transition-colors">
              취소
            </button>
            <button type="submit"
              className="btn-shiny-primary flex-1 py-2.5 text-sm font-semibold">
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

