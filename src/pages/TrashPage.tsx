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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">휴지통</h1>
        <p className="text-xs text-gray-400">삭제된 업무·세부업무는 여기서 복구하거나 영구 삭제할 수 있습니다</p>
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
              <p className="text-xs font-semibold text-gray-400 mb-2">삭제된 업무 ({trashedTasks.length})</p>
              <div className="glass-card overflow-hidden divide-y divide-gray-100">
                {trashedTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
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
              <p className="text-xs font-semibold text-gray-400 mb-2">삭제된 세부업무 ({trashedSubtasks.length})</p>
              <div className="glass-card overflow-hidden divide-y divide-gray-100">
                {trashedSubtasks.map(({ task, subKey, typeName, deletedAt, deletedBy }) => (
                  <div key={`${task.id}__${subKey}`} className="flex items-center gap-3 px-4 py-3">
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
    </div>
  );
}
