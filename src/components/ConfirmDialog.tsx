import { Trash2, X } from 'lucide-react';

interface Props {
  open: boolean;
  taskTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, taskTitle, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-[360px] mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h2 className="text-sm font-semibold text-gray-900">업무 삭제</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-6 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-50">
            <Trash2 size={24} className="text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 truncate max-w-[260px]" title={taskTitle}>
              {taskTitle}
            </p>
            <p className="text-sm text-gray-500 mt-1">업무를 삭제할까요?</p>
            <p className="text-xs text-gray-400 mt-1.5">삭제 후 복구할 수 없습니다</p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
