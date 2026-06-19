import { useState, useEffect, useRef } from 'react';
import { X, Trash2, ChevronDown, ExternalLink } from 'lucide-react';
import type { Task, TaskStatus, TaskType, TeamPart, MetaField, SubTaskType } from '../types';
import { DEFAULT_META_FIELDS } from '../types';
import DatePicker from './DatePicker';

const PANEL_W = 540;

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];

const STATUS_STYLE: Record<TaskStatus, string> = {
  '진행 전': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  '진행 중': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  '완료':   'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  '보류':   'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/50',
};

const CAT_DOT: Record<string, string> = {
  '라이브': 'bg-red-500', '복지': 'bg-orange-400', '사업자': 'bg-indigo-500', '기타': 'bg-gray-400',
};

const DEPT_BADGE: Record<string, string> = {
  '기획':  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  '디자인': 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
  '퍼블':  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-black/[0.08] dark:border-white/6 last:border-0">
      <span className="text-xs text-gray-500 dark:text-white/35 font-medium w-14 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

type SubTaskEntry = {
  assignee?: string;
  startDate?: string;
  endDate?: string;
  weeklyHours: Record<string, number>; // keys: w1d1~w5d5
  totalHours: number;
};

function getWeekDays(startDate: string) {
  const DAY_NAMES = ['월', '화', '수', '목', '금'];
  if (!startDate) {
    return Array.from({ length: 5 }, () => ({
      weekLabel: '',
      days: DAY_NAMES.map(name => ({ name, date: '' })),
    }));
  }
  const base = new Date(startDate);
  const dow = base.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);

  return Array.from({ length: 5 }, (_, wi) => {
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

export default function TaskDetailPanel({
  task, onClose, onUpdate, onDelete, assignees, parts, canManage,
  metaFields: metaFieldsProp, subTaskTypes = [], teamMembers,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  assignees: string[];
  parts: TeamPart[];
  canManage: boolean;
  metaFields?: MetaField[];
  subTaskTypes?: SubTaskType[];
  teamMembers?: { name: string; department?: string }[];
}) {
  const metaFields = metaFieldsProp ?? DEFAULT_META_FIELDS;
  const [title, setTitle] = useState(task.title);
  const [localMeta, setLocalMeta] = useState<Record<string, string>>(task.customFields ?? {});
  const [localSubTaskData, setLocalSubTaskData] = useState<Record<string, SubTaskEntry>>(task.subTaskData ?? {});
  const [localRaw, setLocalRaw] = useState<Record<string, string>>({});
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
  }, [task.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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

  const saveSubTaskData = (next: Record<string, SubTaskEntry>) => {
    onUpdate(task.id, { subTaskData: next });
  };

  const handleDelete = () => {
    if (!confirm(`"${task.title}" 업무를 삭제하시겠습니까?`)) return;
    handleClose();
    setTimeout(() => onDelete(task.id), 300);
  };

  const categoryColor = parts.find(p => p.name === task.category)?.color ?? CAT_DOT[task.category] ?? 'bg-gray-400';

  return (
    <div
      style={{ left: 220, width: PANEL_W }}
      className={`fixed top-0 h-screen z-30 flex flex-col
        bg-[#eef2fb] dark:bg-[#182234] backdrop-blur-2xl
        shadow-[inset_2px_0_0_rgba(0,0,0,0.09),4px_0_20px_rgba(0,0,0,0.09)]
        dark:shadow-[inset_2px_0_0_rgba(255,255,255,0.09),4px_0_28px_rgba(0,0,0,0.45)]
        transition-transform duration-260 ease-out
        ${visible ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-black/[0.08] dark:border-white/8 flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${categoryColor}`} />
        <span className="text-xs text-gray-600 dark:text-white/35 font-medium truncate flex-1">
          {task.category || '파트 없음'} · {task.type}
        </span>
        <button onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/75 hover:bg-black/5 dark:hover:bg-white/8 transition-colors flex-shrink-0">
          <X size={15} />
        </button>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto">

        {/* 제목 */}
        <div className="px-5 pt-4 pb-3">
          <textarea
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); titleRef.current?.blur(); } }}
            readOnly={!canManage}
            rows={2}
            className="w-full text-xl font-bold text-gray-900 dark:text-white/90 bg-transparent border-none resize-none focus:outline-none leading-snug placeholder:text-gray-300 dark:placeholder:text-white/20"
            placeholder="업무명"
          />
        </div>

        {/* 속성 */}
        <div className="px-5 pb-2">
          <Field label="월">
            {canManage ? (
              <select className="text-sm text-gray-700 dark:text-white/70 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5"
                value={task.taskMonth ?? ''}
                onChange={e => onUpdate(task.id, { taskMonth: e.target.value })}>
                <option value="">-</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  const year = task.taskMonth?.slice(0, 4) ?? new Date().getFullYear().toString();
                  return <option key={i} value={`${year}-${m}`}>{i + 1}월</option>;
                })}
              </select>
            ) : <span className="text-sm text-gray-700 dark:text-white/70">{task.taskMonth ? `${parseInt(task.taskMonth.slice(5))}월` : '-'}</span>}
          </Field>

          <Field label="상태">
            {canManage ? (
              <div className="relative inline-flex">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer ${STATUS_STYLE[task.status]}`}>
                  {task.status}<ChevronDown size={10} />
                </div>
                <select className="absolute inset-0 opacity-0 cursor-pointer" value={task.status}
                  onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            ) : (
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[task.status]}`}>{task.status}</span>
            )}
          </Field>

          <Field label="유형">
            {canManage ? (
              <select className="text-sm text-gray-700 dark:text-white/70 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5"
                value={task.type} onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            ) : <span className="text-sm text-gray-700 dark:text-white/70">{task.type}</span>}
          </Field>

          {parts.length > 0 && (
            <Field label="파트">
              {canManage ? (
                <select className="text-sm text-gray-700 dark:text-white/70 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5"
                  value={task.category} onChange={e => onUpdate(task.id, { category: e.target.value })}>
                  {parts.map(p => <option key={p.id}>{p.name}</option>)}
                </select>
              ) : <span className="text-sm text-gray-700 dark:text-white/70">{task.category}</span>}
            </Field>
          )}

          <Field label="담당자">
            {canManage ? (
              <select className="text-sm text-gray-700 dark:text-white/70 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5"
                value={task.assignee} onChange={e => onUpdate(task.id, { assignee: e.target.value })}>
                {assignees.map(a => <option key={a}>{a}</option>)}
              </select>
            ) : <span className="text-sm text-gray-700 dark:text-white/70">{task.assignee}</span>}
          </Field>

          <Field label="접수자">
            {canManage ? (
              <select className="text-sm text-gray-600 dark:text-white/55 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5"
                value={task.receiver} onChange={e => onUpdate(task.id, { receiver: e.target.value })}>
                {assignees.map(a => <option key={a}>{a}</option>)}
              </select>
            ) : <span className="text-sm text-gray-600 dark:text-white/55">{task.receiver}</span>}
          </Field>

          <Field label="기간">
            <div className="flex items-center gap-2">
              <DatePicker value={task.startDate ?? ''} onChange={v => onUpdate(task.id, { startDate: v })} disabled={!canManage} />
              <span className="text-gray-300 dark:text-white/20 text-xs">→</span>
              <DatePicker value={task.endDate ?? ''} onChange={v => onUpdate(task.id, { endDate: v })} disabled={!canManage} />
            </div>
          </Field>
        </div>

        {/* 세부업무 & 주차별 시간 */}
        <div className="px-5 py-3 border-t border-black/[0.08] dark:border-white/6">
          <p className="text-[11px] font-semibold text-gray-600 dark:text-white/30 uppercase tracking-wide mb-2.5">세부업무 & 주차별 시간</p>
          {subTaskTypes.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-white/20 text-center py-3">팀 설정 → 세부 업무 탭에서 유형을 등록해주세요</p>
          ) : (
            <div className="space-y-3">
              {subTaskTypes.map(type => {
                const entry: SubTaskEntry = localSubTaskData[type.id] ?? { assignee: '', weeklyHours: {}, totalHours: 0 };
                const total = Object.values(entry.weeklyHours).reduce((a, b) => a + b, 0);

                // 직군에 맞는 담당자 필터링
                const filtered = type.department && teamMembers?.length
                  ? teamMembers.filter(m => m.department === type.department).map(m => m.name)
                  : null;
                const displayAssignees = (filtered && filtered.length > 0) ? filtered : assignees;

                // 시작일 기준 비활성 컬럼 계산
                const sd = entry.startDate ? new Date(entry.startDate) : null;
                const dow = sd ? sd.getDay() : 1;
                const startDayIdx = !sd ? 0 : (dow === 0 || dow === 6) ? 0 : dow - 1;
                const weeks = getWeekDays(entry.startDate ?? '');

                return (
                  <div key={type.id} className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-3">
                    {/* 헤더: 이름 + 직군 배지 + 담당자 + 총시간 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-700 dark:text-white/70 flex-1 truncate">{type.name}</span>
                      {type.department && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${DEPT_BADGE[type.department] ?? ''}`}>
                          {type.department}
                        </span>
                      )}
                      <select
                        disabled={!canManage}
                        className="text-xs bg-black/5 dark:bg-white/8 border-none rounded-lg px-2 py-1 focus:outline-none text-gray-600 dark:text-white/55 cursor-pointer disabled:cursor-default max-w-[120px]"
                        value={entry.assignee ?? ''}
                        onChange={e => {
                          const next = { ...localSubTaskData, [type.id]: { ...entry, assignee: e.target.value } };
                          setLocalSubTaskData(next);
                          saveSubTaskData(next);
                        }}>
                        <option value="">담당자</option>
                        {displayAssignees.map(a => <option key={a}>{a}</option>)}
                      </select>
                      {total > 0 && (
                        <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 flex-shrink-0">{total}h</span>
                      )}
                    </div>

                    {/* 시작일 / 종료일 */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] text-gray-500 dark:text-white/35 flex-shrink-0">시작</span>
                      <DatePicker
                        value={entry.startDate ?? ''}
                        onChange={v => {
                          const next = { ...localSubTaskData, [type.id]: { ...entry, startDate: v } };
                          setLocalSubTaskData(next);
                          saveSubTaskData(next);
                        }}
                        disabled={!canManage}
                      />
                      <span className="text-gray-300 dark:text-white/20 flex-shrink-0">→</span>
                      <DatePicker
                        value={entry.endDate ?? ''}
                        onChange={v => {
                          const next = { ...localSubTaskData, [type.id]: { ...entry, endDate: v } };
                          setLocalSubTaskData(next);
                          saveSubTaskData(next);
                        }}
                        disabled={!canManage}
                      />
                    </div>

                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-[36px_repeat(5,1fr)] gap-x-1 mb-0.5">
                      <span />
                      {['월', '화', '수', '목', '금'].map(d => (
                        <span key={d} className="text-center text-[10px] font-medium text-gray-500 dark:text-white/30">{d}</span>
                      ))}
                    </div>

                    {/* 주차별 행 */}
                    {weeks.map(({ weekLabel, days }, wi) => {
                      const weekNum = wi + 1;
                      return (
                        <div key={wi} className="grid grid-cols-[36px_repeat(5,1fr)] gap-x-1 mb-1">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[10px] font-semibold text-gray-600 dark:text-white/40 leading-none">{weekNum}주</span>
                            {weekLabel && (
                              <span className="text-[8px] text-gray-400 dark:text-white/20 leading-tight mt-0.5">{weekLabel}</span>
                            )}
                          </div>
                          {days.map(({ date }, di) => {
                            const key = `w${weekNum}d${di + 1}`;
                            const rawKey = `${type.id}_${key}`;
                            const val = entry.weeklyHours[key] ?? 0;
                            const disabled = wi === 0 && di < startDayIdx;
                            return (
                              <div key={di} className="flex flex-col items-center gap-0.5">
                                <span className={`text-[8px] leading-none ${disabled ? 'text-gray-300 dark:text-white/10' : 'text-gray-400 dark:text-white/22'}`}>
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
                                        const cur = prev[type.id] ?? entry;
                                        return {
                                          ...prev,
                                          [type.id]: { ...cur, weeklyHours: newHours, totalHours: Object.values(newHours).reduce((a, b) => a + b, 0) },
                                        };
                                      });
                                    }}
                                    onBlur={() => {
                                      setLocalRaw(prev => { const next = { ...prev }; delete next[rawKey]; return next; });
                                      saveSubTaskData(localSubTaskData);
                                    }}
                                    className="w-full text-center text-[10px] bg-black/[0.08] dark:bg-white/8 rounded py-0.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/18"
                                  />
                                ) : (
                                  <span className={`w-full text-center text-[10px] rounded py-0.5 ${
                                    disabled
                                      ? 'bg-black/[0.02] dark:bg-white/[0.02] text-gray-300 dark:text-white/10'
                                      : 'bg-black/[0.08] dark:bg-white/8 text-gray-600 dark:text-white/50'
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 업무 정보 */}
        <div className="px-5 py-3 border-t border-black/[0.08] dark:border-white/6">
          <p className="text-[11px] font-semibold text-gray-600 dark:text-white/30 uppercase tracking-wide mb-2.5">업무 정보</p>
          <div className="space-y-2">
            {metaFields.map(({ key, label, isUrl }) => {
              const val = localMeta[key] ?? '';
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-600 dark:text-white/35 w-[96px] flex-shrink-0 truncate">{label}</span>
                  <div className="flex-1 flex items-center gap-1 min-w-0">
                    <input
                      type={isUrl ? 'url' : 'text'}
                      readOnly={!canManage}
                      placeholder={canManage ? (isUrl ? 'https://' : '-') : '-'}
                      value={val}
                      onChange={e => setLocalMeta(prev => ({ ...prev, [key]: e.target.value }))}
                      onBlur={e => handleMetaBlur(key, e.target.value)}
                      className="flex-1 min-w-0 text-xs text-gray-800 dark:text-white/70 bg-black/[0.07] dark:bg-white/6 rounded-lg px-2.5 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder:text-gray-400 dark:placeholder:text-white/20 transition-colors"
                    />
                    {isUrl && val && (
                      <a href={val} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-400 hover:text-blue-500 transition-colors">
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-6" />
      </div>

      {/* 하단 액션 */}
      {canManage && (
        <div className="px-5 py-3 border-t border-black/[0.08] dark:border-white/8 flex justify-between items-center flex-shrink-0">
          <span className="text-[11px] text-gray-500 dark:text-white/20">
            {task.updatedAt ? `수정 ${new Date(task.updatedAt).toLocaleDateString('ko-KR')}` : ''}
          </span>
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 dark:text-red-400/70 dark:hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
            <Trash2 size={12} /> 업무 삭제
          </button>
        </div>
      )}
    </div>
  );
}
