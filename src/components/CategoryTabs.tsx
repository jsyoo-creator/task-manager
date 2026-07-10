import type { TeamPart } from '../types';

// 파트 색상 → active 텍스트 색상 매핑
function dotToText(bgClass: string): string {
  const map: Record<string, string> = {
    'bg-red-500': 'text-red-600',
    'bg-orange-400': 'text-orange-600',
    'bg-yellow-400': 'text-yellow-600',
    'bg-green-500': 'text-green-600',
    'bg-teal-500': 'text-teal-600',
    'bg-blue-500': 'text-blue-600',
    'bg-indigo-500': 'text-indigo-600',
    'bg-purple-500': 'text-purple-600',
    'bg-pink-500': 'text-pink-600',
    'bg-gray-400': 'text-gray-600',
  };
  return map[bgClass] ?? 'text-gray-800';
}

interface Props {
  active: string;
  onChange: (cat: string) => void;
  parts?: TeamPart[];
}

export default function CategoryTabs({ active, onChange, parts = [] }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-[12px] bg-gray-100 border border-black/6 backdrop-blur-sm flex-wrap flex-shrink-0">
      <button
        onClick={() => onChange('all')}
        className={`px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
          active === 'all'
            ? 'bg-white text-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)]'
            : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
        }`}
      >
        전체
      </button>
      {parts.map(part => (
        <button
          key={part.id}
          onClick={() => onChange(part.name)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
            active === part.name
              ? `bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)] ${dotToText(part.color)}`
              : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${part.color}`} />
          {part.name}
        </button>
      ))}
    </div>
  );
}
