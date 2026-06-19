import type { TeamPart } from '../types';

// 파트 색상 → active 텍스트 색상 매핑
function dotToText(bgClass: string): string {
  const map: Record<string, string> = {
    'bg-red-500': 'text-red-600 dark:text-red-400',
    'bg-orange-400': 'text-orange-600 dark:text-orange-400',
    'bg-yellow-400': 'text-yellow-600 dark:text-yellow-400',
    'bg-green-500': 'text-green-600 dark:text-green-400',
    'bg-teal-500': 'text-teal-600 dark:text-teal-400',
    'bg-blue-500': 'text-blue-600 dark:text-blue-400',
    'bg-indigo-500': 'text-indigo-600 dark:text-indigo-400',
    'bg-purple-500': 'text-purple-600 dark:text-purple-400',
    'bg-pink-500': 'text-pink-600 dark:text-pink-400',
    'bg-gray-400': 'text-gray-600 dark:text-gray-400',
  };
  return map[bgClass] ?? 'text-black/80 dark:text-white/85';
}

interface Props {
  active: string;
  onChange: (cat: string) => void;
  parts?: TeamPart[];
}

export default function CategoryTabs({ active, onChange, parts = [] }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-[12px] bg-black/5 dark:bg-white/6 border border-black/6 dark:border-white/8 backdrop-blur-sm flex-wrap">
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
      {parts.map(part => (
        <button
          key={part.id}
          onClick={() => onChange(part.name)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all ${
            active === part.name
              ? `bg-white dark:bg-white/15 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] ${dotToText(part.color)}`
              : 'text-black/50 dark:text-white/45 hover:text-black/70 dark:hover:text-white/65 hover:bg-white/50 dark:hover:bg-white/8'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${part.color}`} />
          {part.name}
        </button>
      ))}
    </div>
  );
}
