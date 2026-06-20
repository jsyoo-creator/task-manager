import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  taskTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, taskTitle, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}>
      <div className="w-72 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #6C63FF 0%, #4f46e5 55%, #3730a3 100%)' }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 pt-7 pb-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 mx-auto mb-4">
            <Trash2 size={22} className="text-white" />
          </div>
          <h3 className="text-white font-bold text-base text-center mb-2">업무 삭제</h3>
          <p className="text-white/70 text-[13px] text-center leading-relaxed">
            <span className="text-white font-semibold">"{taskTitle}"</span><br />
            업무를 삭제할까요?<br />
            <span className="text-white/50 text-xs">삭제 후 복구할 수 없습니다.</span>
          </p>
        </div>

        <div className="px-5 pb-6 flex gap-2.5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/15 text-white text-sm font-semibold hover:bg-white/25 transition-all">
            취소
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-white text-[#4f46e5] text-sm font-bold hover:bg-white/90 transition-all">
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
