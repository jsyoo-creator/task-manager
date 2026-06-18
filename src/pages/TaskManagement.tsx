import { useState } from 'react';
import { ChevronRight, Plus, Filter, MoreHorizontal, Trash2 } from 'lucide-react';
import type { Task, SubTask, TaskStatus, TaskCategory } from '../types';
import NewTaskModal from '../components/NewTaskModal';
import { useSubTasks } from '../hooks/useTasks';

interface Props {
  tasks: Task[];
  onAddTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  projectId: string;
}

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료'];
const CATEGORIES: TaskCategory[] = ['기획', '디자인', '개발', '라이브', '복지', '사업자', '기타'];
const ASSIGNEES = ['청소티 PL', '로봇팅 님', '표재성 PL', '한우진 님', '탁새한 님', '고마희 님', '김철수'];
const WEEKS = ['1주', '2주', '3주', '4주', '5주'];

const STATUS_STYLE: Record<TaskStatus, string> = {
  '진행 전': 'text-blue-600 bg-blue-50',
  '진행 중': 'text-amber-600 bg-amber-50',
  '완료': 'text-green-600 bg-green-50',
};

export default function TaskManagement({ tasks, onAddTask, onUpdateTask, onDeleteTask, projectId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('전체');
  const [filterCategory, setFilterCategory] = useState<string>('전체');
  const [filterAssignee, setFilterAssignee] = useState<string>('전체');

  const filtered = tasks.filter(t =>
    (filterStatus === '전체' || t.status === filterStatus) &&
    (filterCategory === '전체' || t.category === filterCategory) &&
    (filterAssignee === '전체' || t.assignee === filterAssignee)
  );

  const toggleExpand = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const totalWeekHours = (t: Task) =>
    Object.values(t.weeklyHours ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">업무 관리</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterOpen(f => !f)}
            className="flex items-center gap-2 border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Filter size={14} /> 필터
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-blue-500 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-blue-600"
          >
            <Plus size={14} /> 새 업무
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 grid grid-cols-3 gap-3">
          {[
            { label: '상태', value: filterStatus, set: setFilterStatus, opts: ['전체', ...STATUSES] },
            { label: '구분', value: filterCategory, set: setFilterCategory, opts: ['전체', ...CATEGORIES] },
            { label: '담당자', value: filterAssignee, set: setFilterAssignee, opts: ['전체', ...ASSIGNEES] },
          ].map(({ label, value, set, opts }) => (
            <div key={label}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={value}
                onChange={e => set(e.target.value)}
              >
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="grid text-xs text-gray-400 font-medium bg-gray-50 border-b border-gray-100 px-4 py-2.5"
          style={{ gridTemplateColumns: '28px 1fr 80px 100px 100px 80px 80px 60px 60px 60px 60px 60px' }}>
          <span />
          <span>업무</span>
          <span>구분</span>
          <span>상태</span>
          <span>담당자</span>
          <span>시작</span>
          <span>종료</span>
          {WEEKS.map(w => <span key={w} className="text-center">{w}</span>)}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-gray-400">등록된 업무가 없습니다</div>
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
  const { subtasks, addSubTask, updateSubTask, deleteSubTask } = useSubTasks(task.id);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');

  const totalH = Object.values(task.weeklyHours ?? {}).reduce((a, b) => a + b, 0);

  const handleAddSubtask = async () => {
    if (!newSubTitle.trim()) return;
    await addSubTask({
      taskId: task.id,
      title: newSubTitle.trim(),
      status: '진행 전',
      assignee: task.assignee,
      startDate: task.startDate,
      endDate: task.endDate,
      weeklyHours: {},
      difficulty: '',
      isFeasible: true,
      revisionCount: 0,
    });
    setNewSubTitle('');
    setAddingSubtask(false);
  };

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="grid items-center px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm"
        style={{ gridTemplateColumns: '28px 1fr 80px 100px 100px 80px 80px 60px 60px 60px 60px 60px' }}
      >
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
          <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <span className="font-medium text-gray-800 truncate">{task.title}</span>
        <select
          className="text-xs text-gray-600 bg-transparent border-0 focus:outline-none cursor-pointer"
          value={task.category}
          onChange={e => onUpdate(task.id, { category: e.target.value as TaskCategory })}
          onClick={e => e.stopPropagation()}
        >
          {(['기획', '디자인', '개발', '라이브', '복지', '사업자', '기타'] as TaskCategory[]).map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div onClick={e => e.stopPropagation()}>
          <select
            className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${STATUS_STYLE[task.status]}`}
            value={task.status}
            onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}
          >
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <select
          className="text-xs text-gray-600 bg-transparent border-0 focus:outline-none cursor-pointer"
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
              {h > 0 ? <span className="text-xs text-green-600 font-semibold">{h}h</span> : <span className="text-xs text-gray-300">-</span>}
            </div>
          );
        })}
      </div>

      {expanded && (
        <div className="bg-gray-50 border-t border-gray-100">
          {subtasks.map(sub => (
            <div key={sub.id}
              className="grid items-center px-4 py-2.5 border-b border-gray-100 last:border-0 text-xs text-gray-600"
              style={{ gridTemplateColumns: '28px 1fr 80px 100px 100px 80px 80px 60px 60px 60px 60px 60px' }}>
              <span className="pl-4 text-gray-300">└</span>
              <span className="text-gray-700">{sub.title}</span>
              <span className="text-gray-400">-</span>
              <select
                className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer w-fit ${STATUS_STYLE[sub.status]}`}
                value={sub.status}
                onChange={e => updateSubTask(sub.id, { status: e.target.value as TaskStatus })}
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select
                className="text-xs text-gray-600 bg-transparent border-0 focus:outline-none cursor-pointer"
                value={sub.assignee}
                onChange={e => updateSubTask(sub.id, { assignee: e.target.value })}
              >
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
              <span>{sub.startDate?.slice(5).replace('-', '.') ?? '-'}</span>
              <span>{sub.endDate?.slice(5).replace('-', '.') ?? '-'}</span>
              {[1, 2, 3, 4, 5].map(w => {
                const h = sub.weeklyHours?.[`week${w}`] ?? 0;
                return (
                  <div key={w} className="flex justify-center">
                    {h > 0 ? <span className="text-xs text-green-600 font-semibold">{h}h</span> : <span className="text-gray-300">-</span>}
                  </div>
                );
              })}
            </div>
          ))}

          {addingSubtask ? (
            <div className="px-4 py-2 flex items-center gap-2">
              <span className="w-7 pl-4 text-gray-300">└</span>
              <input
                autoFocus
                type="text"
                placeholder="세부업무명 입력..."
                className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={newSubTitle}
                onChange={e => setNewSubTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') setAddingSubtask(false); }}
              />
              <button onClick={handleAddSubtask} className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">추가</button>
              <button onClick={() => setAddingSubtask(false)} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSubtask(true)}
              className="flex items-center gap-1.5 px-8 py-2 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 w-full"
            >
              <Plus size={12} /> 세부업무 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}
