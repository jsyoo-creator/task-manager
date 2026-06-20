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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(120, 100, 180, 0.15)', backdropFilter: 'blur(16px)' }}
      onClick={onCancel}
    >
      <div
        className="w-[300px] rounded-[2rem] flex flex-col"
        style={{
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1.5px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 24px 60px rgba(108, 99, 255, 0.18), 0 4px 16px rgba(0,0,0,0.06)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 아이콘 영역 */}
        <div className="flex flex-col items-center pt-8 pb-5 px-7">
          <div
            className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center mb-5"
            style={{
              background: 'linear-gradient(135deg, #f0eeff 0%, #e4dfff 100%)',
              boxShadow: '0 4px 16px rgba(108, 99, 255, 0.2)',
            }}
          >
            <Trash2 size={26} style={{ color: '#7c6ff7' }} />
          </div>

          <h3 className="font-bold text-[17px] text-gray-800 mb-2 tracking-tight">업무 삭제</h3>

          <p className="text-[13px] text-gray-500 text-center leading-relaxed">
            <span
              className="font-semibold block mb-0.5 truncate max-w-[220px] text-gray-700"
              title={taskTitle}
            >
              {taskTitle}
            </span>
            업무를 삭제할까요?
          </p>
          <p className="text-[11px] mt-1.5" style={{ color: '#b0a8d8' }}>
            삭제 후 복구할 수 없습니다
          </p>
        </div>

        {/* 구분선 */}
        <div style={{ height: '1px', background: 'rgba(108, 99, 255, 0.08)', margin: '0 16px' }} />

        {/* 버튼 영역 */}
        <div className="flex gap-2.5 px-5 py-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold rounded-2xl transition-all"
            style={{
              background: 'rgba(108, 99, 255, 0.07)',
              color: '#7c6ff7',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108, 99, 255, 0.13)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(108, 99, 255, 0.07)')}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-bold rounded-2xl transition-all"
            style={{
              background: 'linear-gradient(135deg, #ff7f7f 0%, #ff5c5c 100%)',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(255, 92, 92, 0.35)',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
