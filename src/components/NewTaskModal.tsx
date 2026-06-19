import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, TaskStatus, TaskType, TeamPart, TeamFormConfig, BuiltinFieldKey } from '../types';
import { resolveBuiltinFields } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  projectId: string;
  parts?: TeamPart[];
  assignees?: string[];
  formConfig?: TeamFormConfig;
}

const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];
const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const REVISION_OPTIONS = ['없음', 'F1 단계', 'F2 단계', 'F3 단계', 'F4 단계', 'F5 단계', 'F6 단계'];

const cls = "w-full bg-black/3 dark:bg-white/8 border border-black/8 dark:border-white/12 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder-gray-400 dark:placeholder-white/25 transition-all";
const lbl = "block text-xs font-medium text-gray-500 dark:text-white/40 mb-1";

// 의미상 짝을 이루는 필드 쌍 (폼에서 나란히 배치)
const FIELD_PAIRS: [BuiltinFieldKey, BuiltinFieldKey][] = [
  ['category', 'type'],
  ['receiver', 'assignee'],
  ['startDate', 'endDate'],
];

export default function NewTaskModal({ open, onClose, onSubmit, projectId, parts, assignees = [], formConfig }: Props) {
  const partNames = parts && parts.length > 0 ? parts.map(p => p.name) : [];
  const builtinFields = resolveBuiltinFields(formConfig);
  const customFields = formConfig?.customFields ?? [];
  // 폼에 표시할 필드 순서 (weeklyHours는 폼 입력 없음)
  const formKeys = builtinFields
    .filter(fc => fc.enabled && fc.key !== 'weeklyHours')
    .map(fc => fc.key);

  const [form, setForm] = useState({
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
    setForm({ title: '', category: partNames[0] ?? '', type: '신규', status: '진행 전', receiver: assignees[0] ?? '', assignee: assignees[0] ?? '', startDate: '', endDate: '', revisionLevel: 0 });
    setCustom({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, projectId, weeklyHours: {}, totalHours: 0, customFields: Object.keys(custom).length > 0 ? custom : undefined });
    resetForm();
    onClose();
  };

  const setF = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  const DEFAULT_LABELS: Partial<Record<BuiltinFieldKey, string>> = {
    title: '업무명', category: '파트/구분', type: '유형', status: '상태',
    receiver: '접수자', assignee: '담당자', startDate: '시작일', endDate: '종료일',
    revisionLevel: '수정단계',
  };

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-lg mx-4 max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#1c1f2e] border border-black/8 dark:border-white/8 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/8 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white/85">새 업무 등록</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60 transition-colors">
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
              if (k === 'receiver') return (
                <div>
                  <label className={lbl}>{fieldLabel}</label>
                  <select className={cls} value={form.receiver} onChange={e => setF({ receiver: e.target.value })}>
                    {assignees.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              );
              if (k === 'assignee') return (
                <div>
                  <label className={lbl}>{fieldLabel}</label>
                  <select className={cls} value={form.assignee} onChange={e => setF({ assignee: e.target.value })}>
                    {assignees.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              );
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
          {customFields.filter(cf => cf.enabled !== false).map(cf => (
            <div key={cf.id}>
              <label className={lbl}>
                {cf.label}{cf.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {cf.type === 'text' && (
                <input type="text" required={cf.required} className={cls}
                  value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))} />
              )}
              {(cf.type === 'name' || cf.type === 'textarea') && (
                <select required={cf.required} className={cls}
                  value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))}>
                  <option value="">선택하세요</option>
                  {assignees.map(a => <option key={a}>{a}</option>)}
                </select>
              )}
              {cf.type === 'select' && (
                <select required={cf.required} className={cls}
                  value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))}>
                  <option value="">선택하세요</option>
                  {cf.options?.map(o => <option key={o}>{o}</option>)}
                </select>
              )}
              {cf.type === 'date' && (
                <input type="date" required={cf.required} className={cls}
                  value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))} />
              )}
              {cf.type === 'number' && (
                <input type="number" required={cf.required} className={cls}
                  value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))} />
              )}
              {cf.type === 'link' && (
                <input type="url" required={cf.required} className={cls} placeholder="https://"
                  value={custom[cf.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [cf.id]: e.target.value }))} />
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-black/10 dark:border-white/12 rounded-xl py-2.5 text-sm font-medium text-gray-600 dark:text-white/50 hover:bg-black/4 dark:hover:bg-white/5 transition-colors">
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

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAY_LABELS = ['일','월','화','수','목','금','토'];

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  // 팝업이 DOM에 마운트된 직후 실제 크기 측정 → 정확한 위치 계산
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popupRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const popH = popupRef.current.offsetHeight;
    const popW = popupRef.current.offsetWidth;
    const spaceBelow = window.innerHeight - btn.bottom - 8;
    const top = spaceBelow >= popH ? btn.bottom + 6 : Math.max(8, btn.top - popH - 6);
    const left = btn.left + popW > window.innerWidth - 8 ? Math.max(8, btn.right - popW) : btn.left;
    setPopupStyle({ position: 'fixed', top, left, zIndex: 9999, visibility: 'visible' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const select = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const displayValue = value ? `${value.slice(0,4)}.${value.slice(5,7)}.${value.slice(8,10)}` : '';

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
        className={`${cls} flex items-center justify-between cursor-pointer`}>
        <span className={displayValue ? '' : 'text-gray-400 dark:text-white/25'}>
          {displayValue || '날짜 선택'}
        </span>
        <CalendarDays size={13} className="text-gray-400 dark:text-white/35 flex-shrink-0 ml-2" />
      </button>

      {open && createPortal(
        <div
          ref={popupRef}
          style={{ ...popupStyle, width: 240 }}
          className="!rounded-2xl overflow-hidden shadow-2xl border border-white/10 dark:border-white/8 bg-white dark:bg-[#1e1f2e]">
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <button type="button" onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/8 dark:hover:bg-white/10 text-gray-500 dark:text-white/50 transition-colors">
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-semibold text-gray-700 dark:text-white/80">
              {viewYear}년 {MONTH_LABELS[viewMonth]}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/8 dark:hover:bg-white/10 text-gray-500 dark:text-white/50 transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-7 px-2 pb-0.5">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500 dark:text-white/50'}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 px-2 pb-2.5 gap-0.5">
            {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              return (
                <button key={day} type="button" onClick={() => select(day)}
                  className={`text-[11px] py-1.5 rounded-lg font-medium transition-colors ${
                    isSelected ? 'bg-blue-500 text-white' :
                    isToday ? 'bg-blue-50 dark:bg-blue-500/25 text-blue-600 dark:text-blue-300' :
                    'text-gray-700 dark:text-white/85 hover:bg-black/8 dark:hover:bg-white/12'
                  }`}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
