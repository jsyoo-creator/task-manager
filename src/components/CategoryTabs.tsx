import type { TaskCategory } from '../types';

const CAT_DOT: Record<string, string> = {
  '라이브': 'bg-red-500',
  '복지': 'bg-orange-400',
  '사업자': 'bg-indigo-500',
  '기타': 'bg-gray-400',
};
const CAT_ACTIVE: Record<string, string> = {
  '라이브': 'text-red-600 dark:text-red-400',
  '복지': 'text-orange-600 dark:text-orange-400',
  '사업자': 'text-indigo-600 dark:text-indigo-400',
  '기타': 'text-gray-600 dark:text-gray-400',
};

interface Props {
  active: TaskCategory | 'all';
  onChange: (cat: TaskCategory | 'all') => void;
  categories?: string[];
}

export default function CategoryTabs({ active, onChange, categories = ['라이브', '복지', '사업자'] }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-[12px] bg-black/5 dark:bg-white/6 border border-black/6 dark:border-white/8 backdrop-blur-sm">
      <button
        onClick={() => onChange('all')}
        className={`px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all ${
          active === 'all'
            ? 'bg-white dark:bg-white/15 text-black/80 dark:text-white/85 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)]'
            : 'text-black/50 dark:text-white/45 hover:text-black/70 dark:hover:text-white/65 hover:bg-white/50 dark:hover:bg-white/8'
        }`}
      >
        전체
      </button>
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onChange(cat as TaskCategory)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all ${
            active === cat
              ? `bg-white dark:bg-white/15 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] ${CAT_ACTIVE[cat] ?? 'text-black/80 dark:text-white/85'}`
              : 'text-black/50 dark:text-white/45 hover:text-black/70 dark:hover:text-white/65 hover:bg-white/50 dark:hover:bg-white/8'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_DOT[cat] ?? 'bg-gray-400'}`} />
          {cat === '복지' ? '복지물' : cat === '사업자' ? '사업자물' : cat}
        </button>
      ))}
    </div>
  );
}
