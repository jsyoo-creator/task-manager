import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, ChevronDown, Check } from 'lucide-react';
import type { Task, SubTask, TaskStatus, TaskType, TeamPart } from '../types';
import { useSubTasks } from '../hooks/useTasks';

const PANEL_W = 380;

// 시작일 기준 5주 × 5일(월~금) 날짜 계산
function getWeekDays(startDate: string): { weekLabel: string; days: { name: string; date: string }[] }[] {
  const DAY_NAMES = ['월', '화', '수', '목', '금'];
  if (!startDate) return Array.from({ length: 5 }, (_, i) => ({
    weekLabel: `${i + 1}주`,
    days: DAY_NAMES.map(name => ({ name, date: '' })),
  }));

  const start = new Date(startDate);
  const dow = start.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(start);
  monday.setDate(start.getDate() + diffToMon);

  return Array.from({ length: 5 }, (_, i) => {
    const mon = new Date(monday);
    mon.setDate(monday.getDate() + i * 7);
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    const m1 = mon.getMonth() + 1, d1 = mon.getDate();
    const m2 = fri.getMonth() + 1, d2 = fri.getDate();
    const weekLabel = m1 === m2 ? `${m1}/${d1}~${d2}` : `${m1}/${d1}~${m2}/${d2}`;
    const days = DAY_NAMES.map((name, j) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + j);
      return { name, date: `${d.getMonth() + 1}/${d.getDate()}` };
    });
    return { weekLabel, days };
  });
}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-black/5 dark:border-white/6 last:border-0">
      <span className="text-xs text-gray-400 dark:text-white/35 font-medium w-14 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function TaskDetailPanel({
  task, onClose, onUpdate, onDelete, assignees, parts, canManage,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  assignees: string[];
  parts: TeamPart[];
  canManage: boolean;
}) {
  const { subtasks, addSubTask, deleteSubTask } = useSubTasks(task.id);
  const [title, setTitle] = useState(task.title);
  const [memo, setMemo] = useState(task.memo ?? '');
  const [localHours, setLocalHours] = useState<Record<string, number>>(task.weeklyHours ?? {});
  const [localRaw, setLocalRaw] = useState<Record<string, string>>({});
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSub, setNewSub] = useState({ title: '', assignee: task.assignee });
  const [visible, setVisible] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // 마운트: 슬라이드인 + 메인 콘텐츠 밀어내기
  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible(true);
      document.documentElement.style.setProperty('--detail-panel-w', `${PANEL_W}px`);
    });
    return () => {
      document.documentElement.style.setProperty('--detail-panel-w', '0px');
    };
  }, []);

  // task 바뀌면 로컬 상태 동기화
  useEffect(() => {
    setTitle(task.title);
    setMemo(task.memo ?? '');
    setLocalHours(task.weeklyHours ?? {});
    setNewSub(s => ({ ...s, assignee: task.assignee }));
  }, [task.id]);

  // ESC 닫기
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

  const handleMemoBlur = () => {
    if (memo !== (task.memo ?? '')) onUpdate(task.id, { memo: memo || undefined });
  };

  const handleAddSubtask = async () => {
    if (!newSub.title.trim()) return;
    await addSubTask({
      taskId: task.id, projectId: task.projectId,
      title: newSub.title.trim(), category: task.category, type: task.type,
      status: '진행 전', receiver: task.receiver, assignee: newSub.assignee,
      startDate: task.startDate, endDate: task.endDate, weeklyHours: {}, totalHours: 0, revisionLevel: 0,
    });
    setNewSub({ title: '', assignee: task.assignee });
    setAddingSubtask(false);
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
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-black/6 dark:border-white/8 flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${categoryColor}`} />
        <span className="text-xs text-gray-400 dark:text-white/35 font-medium truncate flex-1">
          {task.category || '파트 없음'} · {task.type}
        </span>
        <button onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/75 hover:bg-black/5 dark:hover:bg-white/8 transition-colors flex-shrink-0">
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
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-white/55">
              {canManage ? (
                <>
                  <input type="date" value={task.startDate ?? ''} onChange={e => onUpdate(task.id, { startDate: e.target.value })}
                    className="bg-transparent border-none focus:outline-none cursor-pointer text-sm text-gray-600 dark:text-white/55" />
                  <span className="text-gray-300 dark:text-white/20">→</span>
                  <input type="date" value={task.endDate ?? ''} onChange={e => onUpdate(task.id, { endDate: e.target.value })}
                    className="bg-transparent border-none focus:outline-none cursor-pointer text-sm text-gray-600 dark:text-white/55" />
                </>
              ) : (
                <span>{task.startDate ?? '-'} → {task.endDate ?? '-'}</span>
              )}
            </div>
          </Field>
        </div>

        {/* 주차별 시간 — 5주 × 5일 */}
        <div className="px-5 py-3 border-t border-black/5 dark:border-white/6">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">주차별 시간</p>
            {(() => {
              const total = Object.values(localHours).reduce((a, b) => a + b, 0);
              return total > 0
                ? <span className="text-xs text-gray-500 dark:text-white/40">합계 <span className="font-semibold text-gray-700 dark:text-white/65">{total}h</span></span>
                : null;
            })()}
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-[30px_repeat(5,1fr)] gap-x-1 mb-0.5">
            <span />
            {['월', '화', '수', '목', '금'].map(d => (
              <span key={d} className="text-center text-[10px] font-medium text-gray-500 dark:text-white/30">{d}</span>
            ))}
          </div>

          {/* 주차 행 */}
          {(() => {
            const sd = task.startDate ? new Date(task.startDate) : null;
            const dow = sd ? sd.getDay() : 1;
            const startDayIdx = (dow === 0 || dow === 6) ? 0 : dow - 1;

            return getWeekDays(task.startDate).map(({ weekLabel, days }, wi) => {
              const weekNum = wi + 1;
              return (
                <div key={weekNum} className="grid grid-cols-[30px_repeat(5,1fr)] gap-x-1 mb-1">
                  {/* 주차 레이블 */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[10px] font-semibold text-gray-600 dark:text-white/45">{weekNum}주</span>
                    {weekLabel && <span className="text-[8px] text-gray-400 dark:text-white/20 leading-tight text-center">{weekLabel}</span>}
                  </div>

                  {/* 일별 입력 */}
                  {days.map(({ date }, di) => {
                    const key = `w${weekNum}d${di + 1}`;
                    const val = localHours[key] ?? 0;
                    const disabled = wi === 0 && di < startDayIdx;
                    return (
                      <div key={di} className="flex flex-col items-center gap-0.5">
                        <span className={`text-[9px] ${disabled ? 'text-gray-300 dark:text-white/12' : 'text-gray-400 dark:text-white/25'}`}>{date}</span>
                        {canManage && !disabled ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={key in localRaw ? localRaw[key] : (val === 0 ? '' : String(val))}
                            placeholder="-"
                            onChange={e => {
                              const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                              setLocalRaw(prev => ({ ...prev, [key]: raw }));
                              const n = Math.min(24, parseFloat(raw) || 0);
                              setLocalHours(prev => ({ ...prev, [key]: n }));
                            }}
                            onBlur={() => {
                              setLocalRaw(prev => { const next = { ...prev }; delete next[key]; return next; });
                              const total = Object.values(localHours).reduce((a, b) => a + b, 0);
                              onUpdate(task.id, { weeklyHours: localHours, totalHours: total });
                            }}
                            className="w-full text-center text-[11px] bg-black/[0.07] dark:bg-white/8 rounded py-1 border-none focus:outline-none focus:ring-1 focus:ring-blue-400/50 text-gray-700 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/20"
                          />
                        ) : (
                          <span className={`w-full text-center text-[11px] rounded py-1 ${disabled ? 'bg-black/[0.02] dark:bg-white/[0.02] text-gray-300 dark:text-white/10' : 'bg-black/[0.07] dark:bg-white/8 text-gray-600 dark:text-white/55'}`}>
                            {!disabled && val > 0 ? val : <span className="opacity-40">-</span>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {/* 메모 */}
        <div className="px-5 py-3 border-t border-black/5 dark:border-white/6">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide mb-2">메모</p>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            onBlur={handleMemoBlur}
            readOnly={!canManage}
            placeholder={canManage ? '업무 관련 메모를 입력하세요...' : '메모 없음'}
            rows={4}
            className="w-full text-sm text-gray-700 dark:text-white/70 bg-black/3 dark:bg-white/5 rounded-xl border border-black/6 dark:border-white/8 px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/40 placeholder:text-gray-300 dark:placeholder:text-white/20 leading-relaxed transition-colors"
          />
        </div>

        {/* 세부업무 */}
        <div className="px-5 py-3 border-t border-black/5 dark:border-white/6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">
              세부업무 <span className="text-gray-300 dark:text-white/20 font-normal normal-case ml-1">{subtasks.length}건</span>
            </p>
            {canManage && (
              <button onClick={() => setAddingSubtask(true)}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                <Plus size={12} /> 추가
              </button>
            )}
          </div>

          <div className="space-y-1">
            {subtasks.map(sub => (
              <SubtaskItem key={sub.id} sub={sub} onDelete={() => deleteSubTask(sub.id)} canManage={canManage} />
            ))}
          </div>

          {addingSubtask && (
            <div className="mt-2 flex items-center gap-2 bg-black/3 dark:bg-white/5 rounded-xl px-3 py-2.5 border border-black/6 dark:border-white/8">
              <input autoFocus type="text" placeholder="세부업무명..."
                className="flex-1 text-sm bg-transparent border-none focus:outline-none text-gray-800 dark:text-white/80 placeholder:text-gray-300 dark:placeholder:text-white/25"
                value={newSub.title}
                onChange={e => setNewSub(s => ({ ...s, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') setAddingSubtask(false); }} />
              {assignees.length > 0 && (
                <select className="text-xs bg-transparent border-none focus:outline-none text-gray-500 dark:text-white/50 cursor-pointer"
                  value={newSub.assignee} onChange={e => setNewSub(s => ({ ...s, assignee: e.target.value }))}>
                  {assignees.map(a => <option key={a}>{a}</option>)}
                </select>
              )}
              <button onClick={handleAddSubtask} className="w-5 h-5 flex items-center justify-center rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors flex-shrink-0">
                <Check size={11} />
              </button>
              <button onClick={() => setAddingSubtask(false)} className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors flex-shrink-0">
                <X size={11} />
              </button>
            </div>
          )}

          {subtasks.length === 0 && !addingSubtask && (
            <p className="text-xs text-gray-300 dark:text-white/20 text-center py-3">세부업무가 없습니다</p>
          )}
        </div>

        <div className="h-6" />
      </div>

      {/* 하단 액션 */}
      {canManage && (
        <div className="px-5 py-3 border-t border-black/6 dark:border-white/8 flex justify-between items-center flex-shrink-0">
          <span className="text-[11px] text-gray-300 dark:text-white/20">
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

function SubtaskItem({ sub, onDelete, canManage }: { sub: SubTask; onDelete: () => void; canManage: boolean }) {
  const STATUS_DOT: Record<string, string> = {
    '진행 전': 'bg-blue-400', '진행 중': 'bg-amber-400', '완료': 'bg-green-400', '보류': 'bg-slate-400',
  };
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/3 dark:hover:bg-white/5 group transition-colors">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[sub.status] ?? 'bg-gray-300'}`} />
      <span className="flex-1 text-sm text-gray-700 dark:text-white/65 truncate">{sub.title}</span>
      <span className="text-xs text-gray-400 dark:text-white/30 flex-shrink-0">{sub.assignee}</span>
      <span className="text-[11px] text-gray-400 dark:text-white/30 flex-shrink-0">{sub.status}</span>
      {canManage && (
        <button onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-300 dark:text-white/25 hover:text-red-400 transition-all flex-shrink-0">
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}
