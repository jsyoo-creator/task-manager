import { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { Task, SubTask, TaskStatus, TaskCategory, TaskType } from '../types';
import NewTaskModal from '../components/NewTaskModal';
import CategoryTabs from '../components/CategoryTabs';
import { useSubTasks } from '../hooks/useTasks';

interface Props {
  tasks: Task[];
  onAddTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  projectId: string;
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
}

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];
const ASSIGNEES = ['유재성 PL', '윤혜림 님', '탁세현 님', '김도은 님', '윤다영 님', '정소희 PL', '한수진 님', '고아현 님', '김동주 님'];

const CAT_DOT: Record<string, string> = {
  '라이브': 'bg-red-500', '복지': 'bg-orange-400', '사업자': 'bg-indigo-500', '기타': 'bg-gray-400',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  '진행 전': 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/15',
  '진행 중': 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/15',
  '완료': 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/15',
  '보류': 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-white/8',
};

const now = new Date();
const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const COL = '28px 8px 1fr 68px 90px 90px 90px 72px 72px 46px 46px 46px 46px 46px 52px 28px 28px';

export default function TaskManagement({ tasks, onAddTask, onUpdateTask, onDeleteTask, projectId, activeCategory, onCategoryChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState(now.getFullYear());
  const [monthFilter, setMonthFilter] = useState(0);
  const [assigneeFilter, setAssigneeFilter] = useState('전체');

  const filtered = tasks.filter(t => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (assigneeFilter !== '전체' && t.assignee !== assigneeFilter) return false;
    if (monthFilter > 0) {
      const prefix = `${yearFilter}-${String(monthFilter).padStart(2, '0')}`;
      return t.startDate?.startsWith(prefix) || t.endDate?.startsWith(prefix);
    }
    return true;
  });

  const toggleExpand = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selCls = "bg-transparent border-none focus:outline-none cursor-pointer text-xs";

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title">업무 관리</h1>
          <p className="page-subtitle">업무 목록 · {filtered.length}건</p>
        </div>
        <div className="flex items-center gap-3">
          <CategoryTabs active={activeCategory} onChange={onCategoryChange} />
          <button
            onClick={() => setModalOpen(true)}
            className="btn-shiny-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
          >
            <Plus size={14} /> 새 업무
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <FilterSelect label="연도" value={yearFilter} onChange={v => setYearFilter(Number(v))}>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </FilterSelect>
        <FilterSelect label="월" value={monthFilter} onChange={v => setMonthFilter(Number(v))}>
          <option value={0}>전체</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
        </FilterSelect>
        <FilterSelect label="담당자" value={assigneeFilter} onChange={v => setAssigneeFilter(v)}>
          <option>전체</option>
          {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
        </FilterSelect>
        <div className="flex-1" />
        <span className="text-xs text-gray-400 dark:text-white/30">총 {filtered.length}건</span>
      </div>

      <div className="glass-card-noclip overflow-x-auto">
        {/* Header */}
        <div className="grid text-[11px] text-gray-500 dark:text-white/50 font-semibold bg-black/3 dark:bg-white/5 border-b border-black/5 dark:border-white/8 px-3 py-2.5 min-w-max"
          style={{ gridTemplateColumns: COL }}>
          <span />
          <span />
          <span>업무</span>
          <span>유형</span>
          <span>상태</span>
          <span>접수자</span>
          <span>담당자</span>
          <span>시작</span>
          <span>종료</span>
          {['1주', '2주', '3주', '4주', '5주'].map(w => <span key={w} className="text-center">{w}</span>)}
          <span className="text-center">합계</span>
          <span />
          <span />
        </div>

        {filtered.length === 0 && (
          <div className="py-14 text-center text-sm text-gray-400 dark:text-white/30">등록된 업무가 없습니다</div>
        )}

        {filtered.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            expanded={expanded.includes(task.id)}
            onToggle={() => toggleExpand(task.id)}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
          />
        ))}
      </div>

      <NewTaskModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={onAddTask} projectId={projectId} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: {
  label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 glass-card !rounded-lg !overflow-visible px-2.5 py-1.5 text-xs">
      <span className="text-gray-500 dark:text-white/50 font-medium">{label}</span>
      <select
        className="bg-transparent border-none focus:outline-none text-gray-800 dark:text-white/78 font-semibold cursor-pointer text-xs"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function TaskRow({ task, expanded, onToggle, onUpdate, onDelete }: {
  task: Task; expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const { subtasks, addSubTask, deleteSubTask } = useSubTasks(task.id);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSub, setNewSub] = useState({ title: '', assignee: task.assignee });

  const totalH = Object.values(task.weeklyHours ?? {}).reduce((a, b) => a + b, 0);

  const handleAddSubtask = async () => {
    if (!newSub.title.trim()) return;
    await addSubTask({
      taskId: task.id, title: newSub.title.trim(), category: task.category, type: task.type,
      status: '진행 전', receiver: task.receiver, assignee: newSub.assignee,
      startDate: task.startDate, endDate: task.endDate, weeklyHours: {}, totalHours: 0, revisionLevel: 0,
    });
    setNewSub({ title: '', assignee: task.assignee });
    setAddingSubtask(false);
  };

  const sel = "bg-transparent border-none focus:outline-none cursor-pointer text-xs w-full";

  return (
    <div className="border-b border-black/4 dark:border-white/6 last:border-0 min-w-max">
      <div
        className="grid items-center px-3 py-2.5 hover:bg-black/3 dark:hover:bg-white/4 text-sm transition-colors"
        style={{ gridTemplateColumns: COL }}
      >
        <button onClick={onToggle} className="text-gray-400 dark:text-white/45 hover:text-gray-600 dark:hover:text-white/70 flex items-center justify-center">
          <ChevronRight size={13} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <span className={`w-2 h-2 rounded-full ${CAT_DOT[task.category] ?? 'bg-gray-400'}`} />
        <span className="font-semibold text-gray-800 dark:text-white/85 truncate pr-2">{task.title}</span>
        <select className={`${sel} text-gray-700 dark:text-white/65`} value={task.type}
          onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })} onClick={e => e.stopPropagation()}>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <div onClick={e => e.stopPropagation()}>
          <select className={`${sel} font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLE[task.status]}`}
            value={task.status} onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <select className={`${sel} text-gray-600 dark:text-white/58`} value={task.receiver}
          onChange={e => onUpdate(task.id, { receiver: e.target.value })} onClick={e => e.stopPropagation()}>
          {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
        </select>
        <select className={`${sel} text-gray-700 dark:text-white/72`} value={task.assignee}
          onChange={e => onUpdate(task.id, { assignee: e.target.value })} onClick={e => e.stopPropagation()}>
          {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
        </select>
        <span className="text-xs text-gray-600 dark:text-white/55">{task.startDate?.slice(5).replace('-', '.') ?? '-'}</span>
        <span className="text-xs text-gray-600 dark:text-white/55">{task.endDate?.slice(5).replace('-', '.') ?? '-'}</span>
        {[1, 2, 3, 4, 5].map(w => {
          const h = task.weeklyHours?.[`week${w}`] ?? 0;
          return (
            <div key={w} className="flex justify-center">
              {h > 0 ? <span className="text-xs text-green-600 dark:text-green-400 font-medium">{h}h</span>
                : <span className="text-xs text-gray-200 dark:text-white/15">-</span>}
            </div>
          );
        })}
        <span className="text-center text-xs font-semibold text-gray-700 dark:text-white/60">{totalH > 0 ? `${totalH}h` : '-'}</span>
        <button onClick={() => setAddingSubtask(true)}
          className="flex items-center justify-center text-gray-300 dark:text-white/20 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
          <Plus size={13} />
        </button>
        <button onClick={() => onDelete(task.id)}
          className="flex items-center justify-center text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="bg-black/2 dark:bg-white/2 border-t border-black/4 dark:border-white/6">
          {subtasks.map(sub => (
            <SubTaskRow key={sub.id} sub={sub} onDelete={() => deleteSubTask(sub.id)} />
          ))}
          {addingSubtask ? (
            <div className="px-3 py-2 flex items-center gap-2">
              <span className="w-7" />
              <span className="w-2.5" />
              <input autoFocus type="text" placeholder="세부업무명..."
                className="flex-1 text-xs border border-blue-300 dark:border-blue-500/50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-white/8 text-gray-800 dark:text-white/80 mr-2"
                value={newSub.title} onChange={e => setNewSub(s => ({ ...s, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') setAddingSubtask(false); }} />
              <select className="text-xs border border-black/10 dark:border-white/15 rounded-lg px-2 py-1 focus:outline-none bg-white dark:bg-white/8 text-gray-700 dark:text-white/70 mr-2"
                value={newSub.assignee} onChange={e => setNewSub(s => ({ ...s, assignee: e.target.value }))}>
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
              <button onClick={handleAddSubtask} className="text-xs bg-blue-500 text-white px-2.5 py-1 rounded-lg hover:bg-blue-600">추가</button>
              <button onClick={() => setAddingSubtask(false)} className="text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 px-1">취소</button>
            </div>
          ) : (
            <button onClick={() => setAddingSubtask(true)}
              className="flex items-center gap-1 px-10 py-1.5 text-xs text-blue-400 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 w-full transition-colors">
              <Plus size={11} /> 세부업무 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SubTaskRow({ sub, onDelete }: { sub: SubTask; onDelete: () => void }) {
  const totalH = Object.values(sub.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
  return (
    <div className="grid items-center px-3 py-2 border-b border-black/3 dark:border-white/5 last:border-0 min-w-max"
      style={{ gridTemplateColumns: COL }}>
      <span className="text-gray-300 dark:text-white/20 text-[10px] flex justify-center">└</span>
      <span className={`w-1.5 h-1.5 rounded-full ${CAT_DOT[sub.category] ?? 'bg-gray-300'}`} />
      <span className="text-xs text-gray-700 dark:text-white/65 truncate pr-2">{sub.title}</span>
      <span className="text-xs text-gray-400 dark:text-white/35">{sub.type}</span>
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full w-fit whitespace-nowrap ${{
        '진행 전': 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/15',
        '진행 중': 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/15',
        '완료': 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/15',
        '보류': 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-white/8',
      }[sub.status]}`}>{sub.status}</span>
      <span className="text-xs text-gray-400 dark:text-white/35">{sub.receiver}</span>
      <span className="text-xs text-gray-600 dark:text-white/55">{sub.assignee}</span>
      <span className="text-xs text-gray-400 dark:text-white/35">{sub.startDate?.slice(5).replace('-', '.') ?? '-'}</span>
      <span className="text-xs text-gray-400 dark:text-white/35">{sub.endDate?.slice(5).replace('-', '.') ?? '-'}</span>
      {[1, 2, 3, 4, 5].map(w => {
        const h = sub.weeklyHours?.[`week${w}`] ?? 0;
        return (
          <div key={w} className="flex justify-center">
            {h > 0 ? <span className="text-xs text-green-500 dark:text-green-400">{h}h</span>
              : <span className="text-xs text-gray-200 dark:text-white/12">-</span>}
          </div>
        );
      })}
      <span className="text-center text-xs text-gray-500 dark:text-white/40">{totalH > 0 ? `${totalH}h` : '-'}</span>
      <span />
      <button onClick={onDelete} className="flex items-center justify-center text-gray-200 dark:text-white/15 hover:text-red-400 transition-colors">
        <Trash2 size={11} />
      </button>
    </div>
  );
}
