import { useState, useMemo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import type { Task, TeamPart } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

interface Props {
  tasks: Task[]; // 현재 팀의 전체 업무 (파트 필터 적용 전 원본 — 휴지통은 파트 상태와 무관하게 보여야 함)
  parts?: TeamPart[];
  canManage: boolean; // 복구/영구삭제 가능 여부 (canDeleteTasks)
  onRestoreTask: (id: string) => void;
  onPermanentDeleteTask: (id: string) => void;
  onRestoreSubtask: (taskId: string, subKey: string) => void;
  onPermanentDeleteSubtask: (taskId: string, subKey: string) => void;
}

function fmtDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TrashPage({ tasks, parts, canManage, onRestoreTask, onPermanentDeleteTask, onRestoreSubtask, onPermanentDeleteSubtask }: Props) {
  const partColorMap = useMemo(() => new Map((parts ?? []).map(p => [p.name, p.color])), [parts]);

  const [pendingPurgeTask, setPendingPurgeTask] = useState<{ id: string; title: string } | null>(null);
  const [pendingPurgeSubtask, setPendingPurgeSubtask] = useState<{ taskId: string; subKey: string; title: string } | null>(null);
  // 다중 선택 삭제 — 업무/세부업무 섹션을 독립적으로 선택·삭제할 수 있게 Set을 분리
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedSubtaskKeys, setSelectedSubtaskKeys] = useState<Set<string>>(new Set());
  const [pendingBulkPurge, setPendingBulkPurge] = useState<'tasks' | 'subtasks' | 'all' | null>(null);

  const trashedTasks = useMemo(() =>
    tasks
      .filter(t => !!t.deletedAt)
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')),
    [tasks]
  );

  const trashedSubtasks = useMemo(() =>
    tasks
      .flatMap(t => Object.entries(t.deletedSubTasks ?? {}).map(([subKey, d]) => ({ task: t, subKey, ...d })))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    [tasks]
  );

  const isEmpty = trashedTasks.length === 0 && trashedSubtasks.length === 0;

  const toggleTaskSelected = (id: string) => setSelectedTaskIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSubtaskSelected = (key: string) => setSelectedSubtaskKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const subtaskKey = (taskId: string, subKey: string) => `${taskId}__${subKey}`;

  const runBulkPurge = (type: 'tasks' | 'subtasks' | 'all') => {
    if (type === 'tasks' || type === 'all') {
      const ids = type === 'all' ? trashedTasks.map(t => t.id) : [...selectedTaskIds];
      ids.forEach(id => onPermanentDeleteTask(id));
      setSelectedTaskIds(new Set());
    }
    if (type === 'subtasks' || type === 'all') {
      const keys = type === 'all' ? trashedSubtasks.map(s => ({ taskId: s.task.id, subKey: s.subKey })) : [...selectedSubtaskKeys].map(k => {
        const [taskId, subKey] = k.split('__');
        return { taskId, subKey };
      });
      keys.forEach(({ taskId, subKey }) => onPermanentDeleteSubtask(taskId, subKey));
      setSelectedSubtaskKeys(new Set());
    }
    setPendingBulkPurge(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title">휴지통</h1>
          <p className="text-xs text-gray-400">삭제된 업무·세부업무는 여기서 복구하거나 영구 삭제할 수 있습니다</p>
        </div>
        {canManage && !isEmpty && (
          <button
            onClick={() => setPendingBulkPurge('all')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-200 hover:bg-red-50 transition-colors flex-shrink-0">
            <Trash2 size={12} />휴지통 전체 비우기
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="glass-card flex flex-col items-center justify-center h-36 gap-2">
          <Trash2 size={22} className="text-gray-300" />
          <span className="text-sm text-gray-400">휴지통이 비어 있습니다</span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {trashedTasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400">삭제된 업무 ({trashedTasks.length})</p>
                {canManage && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedTaskIds(selectedTaskIds.size === trashedTasks.length ? new Set() : new Set(trashedTasks.map(t => t.id)))}
                      className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                      {selectedTaskIds.size === trashedTasks.length ? '선택 해제' : '전체 선택'}
                    </button>
                    {selectedTaskIds.size > 0 && (
                      <button
                        onClick={() => setPendingBulkPurge('tasks')}
                        className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={11} />선택 삭제 ({selectedTaskIds.size})
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="glass-card overflow-hidden divide-y divide-gray-100">
                {trashedTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    {canManage && (
                      <input type="checkbox" checked={selectedTaskIds.has(t.id)} onChange={() => toggleTaskSelected(t.id)}
                        className="w-3.5 h-3.5 flex-shrink-0 rounded accent-red-400 cursor-pointer" />
                    )}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${partColorMap.get(t.category) ?? 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {t.category} · {fmtDateTime(t.deletedAt ?? '')} 삭제{t.deletedBy ? ` · ${t.deletedBy}` : ''}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => onRestoreTask(t.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-500 hover:bg-blue-50 transition-colors">
                          <RotateCcw size={12} />복구
                        </button>
                        <button
                          onClick={() => setPendingPurgeTask({ id: t.id, title: t.title })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-50 transition-colors">
                          <Trash2 size={12} />영구삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {trashedSubtasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400">삭제된 세부업무 ({trashedSubtasks.length})</p>
                {canManage && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedSubtaskKeys(selectedSubtaskKeys.size === trashedSubtasks.length
                        ? new Set()
                        : new Set(trashedSubtasks.map(s => subtaskKey(s.task.id, s.subKey))))}
                      className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                      {selectedSubtaskKeys.size === trashedSubtasks.length ? '선택 해제' : '전체 선택'}
                    </button>
                    {selectedSubtaskKeys.size > 0 && (
                      <button
                        onClick={() => setPendingBulkPurge('subtasks')}
                        className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={11} />선택 삭제 ({selectedSubtaskKeys.size})
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="glass-card overflow-hidden divide-y divide-gray-100">
                {trashedSubtasks.map(({ task, subKey, typeName, deletedAt, deletedBy }) => (
                  <div key={subtaskKey(task.id, subKey)} className="flex items-center gap-3 px-4 py-3">
                    {canManage && (
                      <input type="checkbox" checked={selectedSubtaskKeys.has(subtaskKey(task.id, subKey))}
                        onChange={() => toggleSubtaskSelected(subtaskKey(task.id, subKey))}
                        className="w-3.5 h-3.5 flex-shrink-0 rounded accent-red-400 cursor-pointer" />
                    )}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${partColorMap.get(task.category) ?? 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{typeName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {task.title} · {fmtDateTime(deletedAt)} 삭제{deletedBy ? ` · ${deletedBy}` : ''}
                        {task.deletedAt && <span className="ml-1 text-amber-500">(상위 업무도 삭제됨)</span>}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => onRestoreSubtask(task.id, subKey)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-500 hover:bg-blue-50 transition-colors">
                          <RotateCcw size={12} />복구
                        </button>
                        <button
                          onClick={() => setPendingPurgeSubtask({ taskId: task.id, subKey, title: typeName })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-50 transition-colors">
                          <Trash2 size={12} />영구삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingPurgeTask}
        title="업무 영구 삭제"
        taskTitle={pendingPurgeTask?.title ?? ''}
        onConfirm={() => { if (pendingPurgeTask) onPermanentDeleteTask(pendingPurgeTask.id); setPendingPurgeTask(null); }}
        onCancel={() => setPendingPurgeTask(null)}
      />
      <ConfirmDialog
        open={!!pendingPurgeSubtask}
        title="세부업무 영구 삭제"
        taskTitle={pendingPurgeSubtask?.title ?? ''}
        onConfirm={() => { if (pendingPurgeSubtask) onPermanentDeleteSubtask(pendingPurgeSubtask.taskId, pendingPurgeSubtask.subKey); setPendingPurgeSubtask(null); }}
        onCancel={() => setPendingPurgeSubtask(null)}
      />
      <ConfirmDialog
        open={pendingBulkPurge === 'tasks'}
        title="선택한 업무 영구 삭제"
        taskTitle={`업무 ${selectedTaskIds.size}건`}
        message="복구할 수 없습니다. 정말 영구 삭제할까요?"
        onConfirm={() => runBulkPurge('tasks')}
        onCancel={() => setPendingBulkPurge(null)}
      />
      <ConfirmDialog
        open={pendingBulkPurge === 'subtasks'}
        title="선택한 세부업무 영구 삭제"
        taskTitle={`세부업무 ${selectedSubtaskKeys.size}건`}
        message="복구할 수 없습니다. 정말 영구 삭제할까요?"
        onConfirm={() => runBulkPurge('subtasks')}
        onCancel={() => setPendingBulkPurge(null)}
      />
      <ConfirmDialog
        open={pendingBulkPurge === 'all'}
        title="휴지통 전체 비우기"
        taskTitle={`업무 ${trashedTasks.length}건 · 세부업무 ${trashedSubtasks.length}건`}
        message="휴지통에 있는 모든 항목을 영구 삭제합니다. 복구할 수 없습니다."
        onConfirm={() => runBulkPurge('all')}
        onCancel={() => setPendingBulkPurge(null)}
      />
    </div>
  );
}
