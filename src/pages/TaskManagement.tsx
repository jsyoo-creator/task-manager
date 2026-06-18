import { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { Task, SubTask, TaskStatus, TaskCategory, TaskType } from '../types';
import NewTaskModal from '../components/NewTaskModal';
import { useSubTasks } from '../hooks/useTasks';

interface Props {
  tasks: Task[];
  onAddTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  projectId: string;
  activeCategory: TaskCategory | 'all';
}

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];
const ASSIGNEES = ['유재성 PL', '윤혜림 님', '탁세현 님', '김도은 님', '윤다영 님', '정소희 PL', '한수진 님', '고아현 님', '김동주 님'];

const CAT_COLORS: Record<string, string> = {
  '라이브': 'bg-red-500',
  '복지': 'bg-orange-400',
  '사업자': 'bg-indigo-500',
  '기타': 'bg-gray-400',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  '진행 전': 'text-blue-600 bg-blue-50',
  '진행 중': 'text-amber-600 bg-amber-50',
  '완료': 'text-green-600 bg-green-50',
  '보류': 'text-slate-500 bg-slate-100',
};

const now = new Date();
const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const COL = '28px 6px 1fr 68px 90px 90px 90px 72px 72px 46px 46px 46px 46px 46px 52px 28px 28px';

export default function TaskManagement({ tasks, onAddTask, onUpdateTask, onDeleteTask, projectId, activeCategory }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState(now.getFullYear());
  const [monthFilter, setMonthFilter] = useState(0); // 0 = all
  const [assigneeFilter, setAssigneeFilter] = useState('전체');

  const filtered = tasks.filter(t => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (assigneeFilter !== '전체' && t.assignee !== assigneeFilter) return false;
    if (monthFilter > 0) {
      const prefix = `${yearFilter}-${String(monthFilter).padStart(2, '0')}`;
      return t.startDate?.startsWith(prefix) || t.endDate?.startsWith(prefix);
    }
    const yearStr = String(yearFilter);
    return t.startDate?.startsWith(yearStr) || t.endDate?.startsWith(yearStr) || true;
  });

  const toggleExpand = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
          <span className="text-gray-500">연도</span>
          <select className="bg-transparent focus:outline-none text-gray-700 font-medium"
            value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}>
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
          <span className="text-gray-500">월</span>
          <select className="bg-transparent focus:outline-none text-gray-700 font-medium"
            value={monthFilter} onChange={e => setMonthFilter(Number(e.target.value))}>
            <option value={0}>전체</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
          <span className="text-gray-500">담당자</span>
          <select className="bg-transparent focus:outline-none text-gray-700 font-medium"
            value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
            <option>전체</option>
            {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-blue-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-600"
        >
          <Plus size={13} /> 새 업무
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {/* Header */}
        <div className="grid text-xs text-gray-400 font-medium bg-gray-50 border-b border-gray-100 px-3 py-2.5 min-w-max"
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
          <div className="py-14 text-center text-sm text-gray-400">등록된 업무가 없습니다</div>
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

      <NewTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onAddTask}
        projectId={projectId}
      />
    </div>
  );
}

function TaskRow({ task, expanded, onToggle, onUpdate, onDelete }: {
  task: Task;
  expanded: boolean;
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
      taskId: task.id,
      title: newSub.title.trim(),
      category: task.category,
      type: task.type,
      status: '진행 전',
      receiver: task.receiver,
      assignee: newSub.assignee,
      startDate: task.startDate,
      endDate: task.endDate,
      weeklyHours: {},
      totalHours: 0,
      revisionLevel: 0,
    });
    setNewSub({ title: '', assignee: task.assignee });
    setAddingSubtask(false);
  };

  return (
    <div className="border-b border-gray-100 last:border-0 min-w-max">
      <div
        className="grid items-center px-3 py-2.5 hover:bg-gray-50/80 text-sm"
        style={{ gridTemplateColumns: COL }}
      >
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 flex items-center justify-center">
          <ChevronRight size={13} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <span className={`w-1.5 h-1.5 rounded-full ${CAT_COLORS[task.category] ?? 'bg-gray-400'}`} />
        <span className="font-medium text-gray-800 truncate pr-2">{task.title}</span>
        <select
          className="text-xs text-gray-600 bg-transparent border-0 focus:outline-none cursor-pointer w-full"
          value={task.type}
          onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}
          onClick={e => e.stopPropagation()}
        >
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <div onClick={e => e.stopPropagation()}>
          <select
            className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer w-full ${STATUS_STYLE[task.status]}`}
            value={task.status}
            onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}
          >
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <select
          className="text-xs text-gray-500 bg-transparent border-0 focus:outline-none cursor-pointer w-full"
          value={task.receiver}
          onChange={e => onUpdate(task.id, { receiver: e.target.value })}
          onClick={e => e.stopPropagation()}
        >
          {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
        </select>
        <select
          className="text-xs text-gray-700 bg-transparent border-0 focus:outline-none cursor-pointer w-full"
          value={task.assignee}
          onChange={e => onUpdate(task.id, { assignee: e.target.value })}
          onClick={e => e.stopPropagation()}
        >
          {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
        </select>
        <span className="text-xs text-gray-500">{task.startDate?.slice(5).replace('-', '.') ?? '-'}</span>
        <span className="text-xs text-gray-500">{task.endDate?.slice(5).replace('-', '.') ?? '-'}</span>
        {[1, 2, 3, 4, 5].map(w => {
          const h = task.weeklyHours?.[`week${w}`] ?? 0;
          return (
            <div key={w} className="flex justify-center">
              {h > 0 ? <span className="text-xs text-green-600 font-medium">{h}h</span> : <span className="text-xs text-gray-200">-</span>}
            </div>
          );
        })}
        <span className="text-center text-xs font-semibold text-gray-700">{totalH > 0 ? `${totalH}h` : '-'}</span>
        <button
          onClick={() => setAddingSubtask(true)}
          className="flex items-center justify-center text-gray-300 hover:text-blue-500"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="flex items-center justify-center text-gray-300 hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="bg-gray-50/60 border-t border-gray-100">
          {subtasks.map(sub => (
            <SubTaskRow key={sub.id} sub={sub} onDelete={() => deleteSubTask(sub.id)} />
          ))}

          {addingSubtask ? (
            <div className="px-3 py-2 flex items-center gap-2" style={{ gridTemplateColumns: COL }}>
              <span className="w-7" />
              <span className="w-2" />
              <input
                autoFocus
                type="text"
                placeholder="세부업무명 입력..."
                className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 mr-2"
                value={newSub.title}
                onChange={e => setNewSub(s => ({ ...s, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') setAddingSubtask(false); }}
              />
              <select
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none mr-2"
                value={newSub.assignee}
                onChange={e => setNewSub(s => ({ ...s, assignee: e.target.value }))}
              >
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
              <button onClick={handleAddSubtask} className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">추가</button>
              <button onClick={() => setAddingSubtask(false)} className="text-xs text-gray-400 hover:text-gray-600 px-1">취소</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSubtask(true)}
              className="flex items-center gap-1 px-10 py-1.5 text-xs text-blue-400 hover:text-blue-600 hover:bg-blue-50/50 w-full"
            >
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
    <div
      className="grid items-center px-3 py-2 border-b border-gray-100 last:border-0 min-w-max"
      style={{ gridTemplateColumns: COL }}
    >
      <span className="text-gray-300 text-[10px] flex justify-center">└</span>
      <span className={`w-1.5 h-1.5 rounded-full ${CAT_COLORS[sub.category] ?? 'bg-gray-300'}`} />
      <span className="text-xs text-gray-700 truncate pr-2">{sub.title}</span>
      <span className="text-xs text-gray-400">{sub.type}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${STATUS_STYLE[sub.status]}`}>{sub.status}</span>
      <span className="text-xs text-gray-400">{sub.receiver}</span>
      <span className="text-xs text-gray-600">{sub.assignee}</span>
      <span className="text-xs text-gray-400">{sub.startDate?.slice(5).replace('-', '.') ?? '-'}</span>
      <span className="text-xs text-gray-400">{sub.endDate?.slice(5).replace('-', '.') ?? '-'}</span>
      {[1, 2, 3, 4, 5].map(w => {
        const h = sub.weeklyHours?.[`week${w}`] ?? 0;
        return (
          <div key={w} className="flex justify-center">
            {h > 0 ? <span className="text-xs text-green-500">{h}h</span> : <span className="text-xs text-gray-200">-</span>}
          </div>
        );
      })}
      <span className="text-center text-xs text-gray-500">{totalH > 0 ? `${totalH}h` : '-'}</span>
      <span />
      <button onClick={onDelete} className="flex items-center justify-center text-gray-200 hover:text-red-400">
        <Trash2 size={11} />
      </button>
    </div>
  );
}
