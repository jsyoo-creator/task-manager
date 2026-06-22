import { useState, useEffect, useRef } from 'react';
import { X, Trash2, ChevronDown, ExternalLink } from 'lucide-react';
import type { Task, TaskStatus, TaskType, TeamPart, MetaField, SubTaskType, TeamFormConfig, Department, BuiltinFieldKey } from '../types';
import { DEFAULT_META_FIELDS, resolveBuiltinFields, BUILTIN_FIELDS_META, resolveStatusConfigs, resolveFieldDepts } from '../types';
import DatePicker from './DatePicker';

const PANEL_W = 540;

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];

const STATUS_STYLE: Record<TaskStatus, string> = {
  '진행 전': 'bg-blue-100 text-blue-700',
  '진행 중': 'bg-amber-100 text-amber-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-slate-200 text-slate-600',
};

const CAT_DOT: Record<string, string> = {
  '라이브': 'bg-red-500', '복지': 'bg-orange-400', '사업자': 'bg-indigo-500', '기타': 'bg-gray-400',
};

const DEPT_BADGE: Record<string, string> = {
  '기획':  'bg-violet-100 text-violet-700',
  '디자인': 'bg-pink-100 text-pink-700',
  '퍼블':  'bg-teal-100 text-teal-700',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-black/[0.08] last:border-0">
      <span className="text-xs text-gray-500 font-medium w-14 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

type SubTaskEntry = {
  status?: TaskStatus;
  assignee?: string;
  startDate?: string;
  endDate?: string;
  weeklyHours: Record<string, number>; // keys: w1d1~w5d5
  totalHours: number;
};

function getWeekDays(startDate: string, endDate?: string) {
  const DAY_NAMES = ['월', '화', '수', '목', '금'];
  if (!startDate) return [];

  const base = new Date(startDate);
  const dow = base.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);

  let weekCount = 1;
  if (endDate) {
    const end = new Date(endDate);
    const endDow = end.getDay();
    const endDiff = endDow === 0 ? -6 : 1 - endDow;
    const endMonday = new Date(end);
    endMonday.setDate(end.getDate() + endDiff);
    const diffMs = endMonday.getTime() - monday.getTime();
    weekCount = Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
  }

  return Array.from({ length: weekCount }, (_, wi) => {
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

function MiniAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  if (!name) return null;
  return photoURL
    ? <img src={photoURL} alt={name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#a5b4fc,#c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{name.slice(0, 1)}</div>;
}

export default function TaskDetailPanel({
  task, onClose, onUpdate, onDelete, assignees, parts, canManage,
  metaFields: metaFieldsProp, subTaskTypes = [], teamMembers, formConfig, userPhotoMap,
  canSeeAll = true, currentUserName = '',
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
  teamMembers?: { name: string; department?: Department }[];
  formConfig?: TeamFormConfig;
  userPhotoMap?: Map<string, string>;
  canSeeAll?: boolean;
  currentUserName?: string;
}) {
  const metaFields = metaFieldsProp ?? DEFAULT_META_FIELDS;
  const builtinFields = resolveBuiltinFields(formConfig);
  const statusConfigs = resolveStatusConfigs(formConfig);
  const typeField = builtinFields.find(f => f.key === 'type');
  const fieldLabel = (key: BuiltinFieldKey) => {
    const bf = builtinFields.find(f => f.key === key);
    return bf?.customLabel ?? BUILTIN_FIELDS_META.find(m => m.key === key)?.label ?? key;
  };
  // formConfig 순서 기준: receiver와 assignee 중 어느 쪽이 먼저인지
  const receiverIdx = builtinFields.findIndex(f => f.key === 'receiver');
  const assigneeIdx = builtinFields.findIndex(f => f.key === 'assignee');
  const receiverFirst = receiverIdx !== -1 && assigneeIdx !== -1 && receiverIdx < assigneeIdx;

  const filteredByDept = (key: 'receiver' | 'assignee') => {
    const bf = builtinFields.find(f => f.key === key);
    const depts = bf ? resolveFieldDepts(bf) : null;
    let opts: string[];
    if (depts && teamMembers?.length) {
      const filtered = teamMembers.filter(m => m.department && depts.includes(m.department)).map(m => m.name);
      opts = filtered.length > 0 ? filtered : assignees;
    } else {
      opts = assignees;
    }
    const currentVal = key === 'receiver' ? task.receiver : task.assignee;
    return currentVal && !opts.includes(currentVal) ? [currentVal, ...opts] : opts;
  };

  const [title, setTitle] = useState(task.title);
  const [localMeta, setLocalMeta] = useState<Record<string, string>>(task.customFields ?? {});
  const [localSubTaskData, setLocalSubTaskData] = useState<Record<string, SubTaskEntry>>(task.subTaskData ?? {});
  const localSubTaskDataRef = useRef(localSubTaskData);
  localSubTaskDataRef.current = localSubTaskData;
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
    const totalHours = Object.values(next).reduce((sum, e) => sum + e.totalHours, 0);
    onUpdate(task.id, { subTaskData: next, totalHours });
  };

  const handleDelete = () => {
    if (!confirm(`"${task.title}" 업무를 삭제하시겠습니까?`)) return;
    handleClose();
    setTimeout(() => onDelete(task.id), 300);
  };

  const categoryColor = parts.find(p => p.name === task.category)?.color ?? CAT_DOT[task.category] ?? 'bg-gray-400';

  return (
    // width 0→PANEL_W 확장: 왼쪽 라운드 고정, 오른쪽으로 열림 → 패딩 이동과 완벽 동기화
    <div
      style={{
        position: 'fixed',
        left: 232,
        top: 12,
        bottom: 12,
        width: visible ? PANEL_W : 0,
        transition: 'width 0.26s ease-out',
        zIndex: 30,
        borderRadius: '28px 0 0 28px',
        overflow: 'hidden',
      }}
    >
    <div
      style={{ width: PANEL_W, height: '100%', background: '#FFFFFF' }}
      className="flex flex-col border-r border-[#E5E0F5]"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-black/[0.08] flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${categoryColor}`} />
        <span className="text-xs text-gray-600 font-medium truncate flex-1">
          {task.category || '파트 없음'} · {task.type}
        </span>
        <button onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
          <X size={15} />
        </button>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto">

        {/* 제목 */}
        <div className="px-5 pt-3 pb-2">
          <textarea
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); titleRef.current?.blur(); } }}
            readOnly={!canManage}
            rows={1}
            className="w-full text-[17px] font-bold text-gray-900 bg-transparent border-none resize-none focus:outline-none leading-snug placeholder:text-gray-300"
            placeholder={fieldLabel('title')}
          />
        </div>

        {/* 속성 - 컴팩트 그리드 */}
        <div className="px-5 pb-1 border-b border-black/[0.08]">
          {/* 행 1: 월 / (유형·상태 — formConfig 순서) */}
          {(() => {
            const row1Fields = builtinFields.filter(f => f.key === 'type' || f.key === 'status');
            const renderField = (fc: typeof builtinFields[0]) => {
              const lbl = fc.customLabel ?? BUILTIN_FIELDS_META.find(m => m.key === fc.key)?.label ?? fc.key;
              if (fc.key === 'status') {
                if (fc.customType === 'select' && fc.options?.length) {
                  const firstOpt = fc.options[0] ?? '';
                  const effStatus = (task.status as string) || firstOpt;
                  const custColor = fc.optionColors?.[effStatus];
                  const fallbackSc = statusConfigs.find(s => s.key.replace(/\s/g,'') === effStatus.replace(/\s/g,'')) ?? statusConfigs[0];
                  const bg = custColor?.bg ?? fallbackSc?.bg;
                  const textColor = custColor?.text ?? fallbackSc?.text;
                  return (
                    <div key="status">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{lbl}</p>
                      {canManage ? (
                        <div className="relative block w-full">
                          <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer"
                            style={{ backgroundColor: bg, color: textColor }}>
                            <span>{effStatus}</span><ChevronDown size={9} />
                          </div>
                          <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={effStatus}
                            onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                            {fc.options.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                      ) : (
                        <span className="flex w-full px-2.5 py-0.5 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: bg, color: textColor }}>
                          {effStatus}
                        </span>
                      )}
                    </div>
                  );
                }
                const sc = statusConfigs.find(s => s.key === task.status) ?? statusConfigs[0];
                return (
                  <div key="status">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{lbl}</p>
                    {canManage ? (
                      <div className="relative block w-full">
                        <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{ backgroundColor: sc?.bg, color: sc?.text }}>
                          <span>{sc?.label ?? task.status}</span><ChevronDown size={9} />
                        </div>
                        <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={task.status}
                          onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                          {statusConfigs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="flex w-full px-2.5 py-0.5 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: sc?.bg, color: sc?.text }}>
                        {sc?.label ?? task.status}
                      </span>
                    )}
                  </div>
                );
              }
              // type
              const typeOpts = fc.customType === 'select' && fc.options?.length ? fc.options : TYPES as string[];
              const typeColor = fc.optionColors?.[task.type];
              return (
                <div key="type">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{lbl}</p>
                  {canManage ? (
                    typeColor ? (
                      <div className="relative block w-full">
                        <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                          <span>{task.type}</span><ChevronDown size={9} />
                        </div>
                        <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={task.type}
                          onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}>
                          {typeOpts.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    ) : (
                      <select className="text-sm text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5 w-full"
                        value={task.type} onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}>
                        {typeOpts.map(t => <option key={t}>{t}</option>)}
                      </select>
                    )
                  ) : <span className="text-sm text-gray-700">{task.type}</span>}
                </div>
              );
            };
            return (
              <div className="grid grid-cols-3 gap-x-3 py-2.5 border-b border-gray-100">
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">월</p>
                  {canManage ? (
                    <select className="text-sm text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5 w-full"
                      value={task.taskMonth ?? ''}
                      onChange={e => onUpdate(task.id, { taskMonth: e.target.value })}>
                      <option value="">-</option>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = String(i + 1).padStart(2, '0');
                        const year = task.taskMonth?.slice(0, 4) ?? new Date().getFullYear().toString();
                        return <option key={i} value={`${year}-${m}`}>{i + 1}월</option>;
                      })}
                    </select>
                  ) : <span className="text-sm text-gray-700">{task.taskMonth ? `${parseInt(task.taskMonth.slice(5))}월` : '-'}</span>}
                </div>
                {row1Fields.map(fc => renderField(fc))}
              </div>
            );
          })()}

          {/* 행 2: 파트 / 담당자(접수자) / 접수자(담당자) — formConfig 순서 반영 */}
          <div className={`grid ${parts.length > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-x-3 py-2.5 border-b border-gray-100`}>
            {parts.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{fieldLabel('category')}</p>
                {canManage ? (
                  <select className="text-sm text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5 w-full truncate"
                    value={task.category} onChange={e => onUpdate(task.id, { category: e.target.value })}>
                    {parts.map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                ) : <span className="text-sm text-gray-700">{task.category}</span>}
              </div>
            )}
            {/* receiverFirst면 검수자→담당자 순, 아니면 담당자→검수자 순 */}
            {receiverFirst ? (
              <>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{fieldLabel('receiver')}</p>
                  {canManage ? (
                    <div className="relative flex items-center gap-1 cursor-pointer">
                      <MiniAvatar name={task.receiver} photoURL={userPhotoMap?.get(task.receiver)} />
                      <span className="text-sm text-gray-600 truncate">{task.receiver || '-'}</span>
                      <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.receiver} onChange={e => onUpdate(task.id, { receiver: e.target.value })}>
                        <option value="">-</option>
                        {filteredByDept('receiver').map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                  ) : <span className="flex items-center gap-1"><MiniAvatar name={task.receiver} photoURL={userPhotoMap?.get(task.receiver)} /><span className="text-sm text-gray-600">{task.receiver}</span></span>}
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{fieldLabel('assignee')}</p>
                  {canManage ? (
                    <div className="relative flex items-center gap-1 cursor-pointer">
                      <MiniAvatar name={task.assignee} photoURL={userPhotoMap?.get(task.assignee)} />
                      <span className="text-sm text-gray-700 truncate">{task.assignee || '-'}</span>
                      <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.assignee} onChange={e => onUpdate(task.id, { assignee: e.target.value })}>
                        <option value="">-</option>
                        {filteredByDept('assignee').map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                  ) : <span className="flex items-center gap-1"><MiniAvatar name={task.assignee} photoURL={userPhotoMap?.get(task.assignee)} /><span className="text-sm text-gray-700">{task.assignee}</span></span>}
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{fieldLabel('assignee')}</p>
                  {canManage ? (
                    <div className="relative flex items-center gap-1 cursor-pointer">
                      <MiniAvatar name={task.assignee} photoURL={userPhotoMap?.get(task.assignee)} />
                      <span className="text-sm text-gray-700 truncate">{task.assignee || '-'}</span>
                      <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.assignee} onChange={e => onUpdate(task.id, { assignee: e.target.value })}>
                        <option value="">-</option>
                        {filteredByDept('assignee').map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                  ) : <span className="flex items-center gap-1"><MiniAvatar name={task.assignee} photoURL={userPhotoMap?.get(task.assignee)} /><span className="text-sm text-gray-700">{task.assignee}</span></span>}
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{fieldLabel('receiver')}</p>
                  {canManage ? (
                    <div className="relative flex items-center gap-1 cursor-pointer">
                      <MiniAvatar name={task.receiver} photoURL={userPhotoMap?.get(task.receiver)} />
                      <span className="text-sm text-gray-600 truncate">{task.receiver || '-'}</span>
                      <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.receiver} onChange={e => onUpdate(task.id, { receiver: e.target.value })}>
                        <option value="">-</option>
                        {filteredByDept('receiver').map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                  ) : <span className="flex items-center gap-1"><MiniAvatar name={task.receiver} photoURL={userPhotoMap?.get(task.receiver)} /><span className="text-sm text-gray-600">{task.receiver}</span></span>}
                </div>
              </>
            )}
          </div>

          {/* 행 3: 기간 */}
          <div className="py-2.5">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">기간</p>
            <div className="flex items-center gap-2">
              <DatePicker value={task.startDate ?? ''} onChange={v => onUpdate(task.id, { startDate: v })} disabled={!canManage} />
              <span className="text-gray-300 text-xs">→</span>
              <DatePicker value={task.endDate ?? ''} onChange={v => onUpdate(task.id, { endDate: v })} disabled={!canManage} />
            </div>
          </div>

          {/* 행 4: 수정단계 항목별 횟수 (활성화된 경우만) */}
          {builtinFields.find(f => f.key === 'revisionLevel')?.enabled && (
            <div className="py-2.5 border-t border-gray-100">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                {builtinFields.find(f => f.key === 'revisionLevel')?.customLabel ?? '수정단계'}
              </p>
              <div className="space-y-1.5">
                {(['KV 크리에이티브 변경', '상세페이지 레이아웃 변동, 신규 상에 추가', '특정 영역 내용·이미지 수정', 'API 제품 교재 20개 이상', 'API 제품 교재 20개 미만', '단순 텍스트·CMS 수정'] as const).map((label, i) => {
                  const key = `F${i + 1}`;
                  const count = task.revisionCounts?.[key] ?? 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white bg-blue-500 rounded px-1.5 py-0.5 flex-shrink-0 w-7 text-center">{key}</span>
                      <span className="text-xs text-gray-600 flex-1 truncate">{label}</span>
                      {canManage ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button type="button"
                            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 text-sm leading-none"
                            onClick={() => {
                              if (count <= 0) return;
                              const next = { ...(task.revisionCounts ?? {}), [key]: count - 1 };
                              if (next[key] === 0) delete next[key];
                              onUpdate(task.id, { revisionCounts: next });
                            }}>−</button>
                          <span className="text-xs font-semibold text-gray-700 w-6 text-center tabular-nums">{count}</span>
                          <button type="button"
                            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 text-sm leading-none"
                            onClick={() => {
                              const next = { ...(task.revisionCounts ?? {}), [key]: count + 1 };
                              onUpdate(task.id, { revisionCounts: next });
                            }}>+</button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-gray-700 w-6 text-center tabular-nums flex-shrink-0">{count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 세부업무 & 주차별 시간 */}
        <div className="px-5 py-3 border-t border-black/[0.08]">
          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2.5">세부업무 & 주차별 시간</p>
          {subTaskTypes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">팀 설정 → 세부 업무 탭에서 유형을 등록해주세요</p>
          ) : (
            <div className="space-y-3">
              {subTaskTypes.filter(type => {
                if (canSeeAll) return true;
                const entry = localSubTaskData[type.id];
                return entry?.assignee === currentUserName;
              }).map(type => {
                const entry: SubTaskEntry = localSubTaskData[type.id] ?? { assignee: '', weeklyHours: {}, totalHours: 0 };
                const total = Object.values(entry.weeklyHours).reduce((a, b) => a + b, 0);

                // 직군에 맞는 담당자 필터링
                const filtered = type.department && teamMembers?.length
                  ? teamMembers.filter(m => m.department === type.department).map(m => m.name)
                  : null;
                const displayAssignees = (filtered && filtered.length > 0) ? filtered : assignees;

                // 시작/종료일 기준 비활성 컬럼 계산
                const sd = entry.startDate ? new Date(entry.startDate) : null;
                const sdDow = sd ? sd.getDay() : 1;
                const startDayIdx = !sd ? 0 : (sdDow === 0 || sdDow === 6) ? 0 : sdDow - 1;
                const ed = entry.endDate ? new Date(entry.endDate) : null;
                const edDow = ed ? ed.getDay() : 0;
                const endDayIdx = !ed ? 4 : (edDow === 0 || edDow === 6) ? 4 : edDow - 1;
                const weeks = getWeekDays(entry.startDate ?? '', entry.endDate);

                return (
                  <div key={type.id} className="rounded-xl bg-gray-50 p-3">
                    {/* 헤더: 이름 + 직군 배지 + 상태 + 담당자 + 총시간 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{type.name}</span>
                      {type.department && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${DEPT_BADGE[type.department] ?? ''}`}>
                          {type.department}
                        </span>
                      )}
                      {/* 세부업무 상태 선택 */}
                      {(() => {
                        const subKey = (entry.status ?? '진행 전') as TaskStatus;
                        const subSc = statusConfigs.find(s => s.key === subKey) ?? statusConfigs[0];
                        return (
                          <div className="relative flex-shrink-0">
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium cursor-pointer"
                              style={{ backgroundColor: subSc?.bg, color: subSc?.text }}>
                              <span>{subSc?.label ?? subKey}</span>
                              <ChevronDown size={9} />
                            </div>
                            <select
                              disabled={!canManage}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full disabled:cursor-default"
                              value={subKey}
                              onChange={e => {
                                const next = { ...localSubTaskData, [type.id]: { ...entry, status: e.target.value as TaskStatus } };
                                setLocalSubTaskData(next);
                                saveSubTaskData(next);
                              }}>
                              {statusConfigs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                          </div>
                        );
                      })()}
                      <select
                        disabled={!canManage}
                        className="text-xs bg-gray-100 border-none rounded-lg px-2 py-1 focus:outline-none text-gray-600 cursor-pointer disabled:cursor-default max-w-[120px]"
                        value={entry.assignee ?? ''}
                        onChange={e => {
                          const next = { ...localSubTaskData, [type.id]: { ...entry, assignee: e.target.value } };
                          setLocalSubTaskData(next);
                          saveSubTaskData(next);
                        }}>
                        <option value="">{fieldLabel('assignee')}</option>
                        {displayAssignees.map(a => <option key={a}>{a}</option>)}
                      </select>
                      {total > 0 && (
                        <span className="text-xs font-semibold text-blue-500 flex-shrink-0">{total}h</span>
                      )}
                    </div>

                    {/* 시작일 / 종료일 */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] text-gray-500 flex-shrink-0">{fieldLabel('startDate')}</span>
                      <DatePicker
                        value={entry.startDate ?? ''}
                        onChange={v => {
                          const next = { ...localSubTaskData, [type.id]: { ...entry, startDate: v } };
                          setLocalSubTaskData(next);
                          saveSubTaskData(next);
                        }}
                        disabled={!canManage}
                      />
                      <span className="text-gray-300 flex-shrink-0">→</span>
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

                    {/* 요일 헤더 + 주차 행 */}
                    {!entry.startDate ? (
                      <p className="text-[11px] text-gray-400 text-center py-1.5">{fieldLabel('startDate')}을 설정하면 {fieldLabel('weeklyHours')}을 입력할 수 있습니다</p>
                    ) : (
                    <>
                    <div className="grid grid-cols-[36px_repeat(5,1fr)] gap-x-1 mb-0.5">
                      <span />
                      {['월', '화', '수', '목', '금'].map(d => (
                        <span key={d} className="text-center text-[10px] font-medium text-gray-500">{d}</span>
                      ))}
                    </div>

                    {weeks.map(({ weekLabel, days }, wi) => {
                      const weekNum = wi + 1;
                      const isLastWeek = wi === weeks.length - 1;
                      return (
                        <div key={wi} className="grid grid-cols-[36px_repeat(5,1fr)] gap-x-1 mb-1">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[10px] font-semibold text-gray-600 leading-none">{weekNum}주</span>
                            {weekLabel && (
                              <span className="text-[8px] text-gray-400 leading-tight mt-0.5">{weekLabel}</span>
                            )}
                          </div>
                          {days.map(({ date }, di) => {
                            const key = `w${weekNum}d${di + 1}`;
                            const rawKey = `${type.id}_${key}`;
                            const val = entry.weeklyHours[key] ?? 0;
                            const disabled = (wi === 0 && di < startDayIdx) || (isLastWeek && entry.endDate ? di > endDayIdx : false);
                            return (
                              <div key={di} className="flex flex-col items-center gap-0.5">
                                <span className={`text-[8px] leading-none ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>
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
                                        const next = {
                                          ...prev,
                                          [type.id]: { ...cur, weeklyHours: newHours, totalHours: Object.values(newHours).reduce((a, b) => a + b, 0) },
                                        };
                                        localSubTaskDataRef.current = next;
                                        return next;
                                      });
                                    }}
                                    onBlur={() => {
                                      setLocalRaw(prev => { const next = { ...prev }; delete next[rawKey]; return next; });
                                      saveSubTaskData(localSubTaskDataRef.current);
                                    }}
                                    className="w-full text-center text-[10px] bg-black/[0.08] rounded py-0.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 text-gray-800 placeholder:text-gray-400"
                                  />
                                ) : (
                                  <span className={`w-full text-center text-[10px] rounded py-0.5 ${
                                    disabled
                                      ? 'bg-black/[0.02] text-gray-300'
                                      : 'bg-black/[0.08] text-gray-600'
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
                    </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 커스텀 폼 필드 */}
        {(() => {
          const cfs = formConfig?.customFields?.filter(cf => cf.enabled !== false) ?? [];
          if (cfs.length === 0) return null;
          const cls = "flex-1 min-w-0 text-xs text-gray-800 bg-black/[0.07] rounded-lg px-2.5 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder:text-gray-400 transition-colors";
          return (
            <div className="px-5 py-3 border-t border-black/[0.08]">
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2.5">추가 정보</p>
              <div className="space-y-2">
                {cfs.map(cf => {
                  const val = (task.customFields as Record<string, string> | undefined)?.[cf.id] ?? '';
                  const handleBlur = (v: string) => {
                    onUpdate(task.id, { customFields: { ...(task.customFields ?? {}), [cf.id]: v } });
                  };
                  const cfType = cf.type as string;
                  const isNameType = cfType === 'name' || cfType === 'textarea' || cfType === '이름';
                  const cfDepts = isNameType ? resolveFieldDepts(cf) : null;
                  const opts = isNameType
                    ? (cfDepts && teamMembers?.length
                        ? teamMembers.filter(m => m.department && cfDepts.includes(m.department)).map(m => m.name)
                        : assignees)
                    : (cf.options ?? []);
                  return (
                    <div key={cf.id} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 w-[96px] flex-shrink-0 truncate">{cf.label}</span>
                      <div className="flex-1 min-w-0">
                        {cfType === 'select' && cf.optionColors?.[val] ? (
                          <div className="relative block w-full">
                            <div className="flex w-full items-center justify-between px-2.5 py-0.5 rounded-lg text-xs font-medium cursor-pointer"
                              style={{ backgroundColor: cf.optionColors[val].bg, color: cf.optionColors[val].text }}>
                              <span>{val || '-'}</span><ChevronDown size={9} />
                            </div>
                            <select disabled={!canManage} value={val} onChange={e => handleBlur(e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full disabled:cursor-default">
                              <option value="">-</option>
                              {(cf.options ?? []).map(o => <option key={o}>{o}</option>)}
                            </select>
                          </div>
                        ) : (isNameType || cfType === 'select') ? (
                          <select disabled={!canManage} value={val}
                            onChange={e => handleBlur(e.target.value)}
                            className={cls}>
                            <option value="">-</option>
                            {opts.map(o => <option key={o}>{o}</option>)}
                          </select>
                        ) : cfType === 'date' ? (
                          <input type="date" readOnly={!canManage} value={val}
                            onChange={e => handleBlur(e.target.value)}
                            className={cls} />
                        ) : cfType === 'number' ? (
                          <input type="number" readOnly={!canManage} value={val}
                            onChange={e => handleBlur(e.target.value)}
                            onBlur={e => handleBlur(e.target.value)}
                            className={cls} />
                        ) : cfType === 'link' ? (
                          <div className="flex items-center gap-px">
                            <input type="url" readOnly={!canManage} value={val}
                              onChange={e => handleBlur(e.target.value)}
                              onBlur={e => handleBlur(e.target.value)}
                              placeholder="https://"
                              className={cls} />
                            {val && <a href={val} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-blue-400 hover:text-blue-500"><ExternalLink size={13} /></a>}
                          </div>
                        ) : (
                          <input type="text" readOnly={!canManage} value={val}
                            onChange={e => handleBlur(e.target.value)}
                            onBlur={e => handleBlur(e.target.value)}
                            placeholder="-"
                            className={cls} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 업무 정보 */}
        <div className="px-5 py-3 border-t border-black/[0.08]">
          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2.5">업무 정보</p>
          <div className="space-y-2">
            {metaFields.map(({ key, label, isUrl }) => {
              const val = localMeta[key] ?? '';
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-600 w-[96px] flex-shrink-0 truncate">{label}</span>
                  <div className="flex-1 flex items-center gap-1 min-w-0">
                    <input
                      type={isUrl ? 'url' : 'text'}
                      readOnly={!canManage}
                      placeholder={canManage ? (isUrl ? 'https://' : '-') : '-'}
                      value={val}
                      onChange={e => setLocalMeta(prev => ({ ...prev, [key]: e.target.value }))}
                      onBlur={e => handleMetaBlur(key, e.target.value)}
                      className="flex-1 min-w-0 text-xs text-gray-800 bg-black/[0.07] rounded-lg px-2.5 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder:text-gray-400 transition-colors"
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
        <div className="px-5 py-3 border-t border-black/[0.08] flex justify-between items-center flex-shrink-0">
          <span className="text-[11px] text-gray-500">
            {task.updatedAt ? `수정 ${new Date(task.updatedAt).toLocaleDateString('ko-KR')}` : ''}
          </span>
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
            <Trash2 size={12} /> 업무 삭제
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
