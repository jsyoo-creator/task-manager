import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push(-1);
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push(-2);
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center justify-center gap-1 py-3 border-t border-gray-50">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}
        className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft size={13} /> 이전
      </button>
      {pages.map((p, i) =>
        p < 0
          ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-300">…</span>
          : <button key={p} onClick={() => onChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                p === page ? 'bg-[#6C63FF] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{p}</button>
      )}
      <button disabled={page === totalPages} onClick={() => onChange(page + 1)}
        className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        다음 <ChevronRight size={13} />
      </button>
    </div>
  );
}
