import { NavLink, useLocation } from 'react-router';
import {
  LayoutDashboard, ClipboardList, CalendarDays, BarChart3, Umbrella,
  Grid3X3, Sun, Moon, ChevronRight
} from 'lucide-react';
import type { Project, TaskCategory } from '../types';

interface Props {
  children: React.ReactNode;
  project: Project | null;
  projects: Project[];
  onProjectChange: (id: string) => void;
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  isDark: boolean;
  onToggleDark: () => void;
}

const NAV = [
  { to: '/', label: '대시보드', icon: LayoutDashboard },
  { to: '/tasks', label: '업무 관리', icon: ClipboardList },
  { to: '/calendar', label: '캘린더', icon: CalendarDays },
  { to: '/weekly', label: '위클리', icon: BarChart3 },
  { to: '/vacation', label: '휴가', icon: Umbrella },
  { to: '/seats', label: '자리 배치도', icon: Grid3X3 },
];

const CAT_DOT: Record<string, string> = {
  '라이브': 'bg-red-500',
  '복지': 'bg-orange-400',
  '사업자': 'bg-indigo-500',
  '기타': 'bg-gray-400',
};

const SUBCAT_PAGES = ['/tasks', '/calendar', '/weekly'];

export default function Layout({
  children, project, projects, onProjectChange,
  activeCategory, onCategoryChange, isDark, onToggleDark,
}: Props) {
  const location = useLocation();
  const showSubCat = SUBCAT_PAGES.includes(location.pathname);
  const cats = project?.categories ?? ['라이브', '복지', '사업자'];

  return (
    <div className="flex min-h-screen bg-[#e8eaf6] dark:bg-[#080c18]">

      {/* Decorative background blobs — Figma-style mesh gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full
          bg-[#b8c8ff] opacity-50 dark:bg-[#1e40af] dark:opacity-15 blur-[90px]" />
        <div className="absolute top-[15%] right-[-80px] w-[520px] h-[520px] rounded-full
          bg-[#d4b8ff] opacity-40 dark:bg-[#6d28d9] dark:opacity-12 blur-[90px]" />
        <div className="absolute bottom-0 left-[20%] w-[480px] h-[480px] rounded-full
          bg-[#ffb8d4] opacity-35 dark:bg-[#9d174d] dark:opacity-10 blur-[90px]" />
        <div className="absolute top-[45%] left-[35%] w-[380px] h-[380px] rounded-full
          bg-[#b8e8ff] opacity-30 dark:bg-[#0369a1] dark:opacity-10 blur-[110px]" />
      </div>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40
        bg-gradient-to-b from-white/90 to-white/70 dark:from-[#141c2e]/95 dark:to-[#080c18]/90
        backdrop-blur-[40px] border-r border-white/90 dark:border-white/8
        shadow-[1px_0_0_rgba(0,0,0,0.04),2px_0_12px_rgba(0,0,0,0.04)]">

        {/* Logo + Project */}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="relative w-8 h-8 rounded-[9px] bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center text-white font-bold text-sm flex-shrink-0
              shadow-[0_2px_6px_rgba(37,99,235,0.5),0_0_0_1px_rgba(255,255,255,0.2)_inset]
              before:absolute before:inset-0 before:rounded-[9px] before:bg-gradient-to-b before:from-white/25 before:to-transparent">
              T
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-black/25 dark:text-white/25 font-semibold tracking-[0.12em] uppercase">PIVOT</p>
              <p className="text-xs font-semibold text-black/80 dark:text-white/80 truncate leading-tight">{project?.name ?? '업무 관리'}</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />

        {/* Navigation */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-all group ${
                  isActive
                    ? 'text-[#2670e9] bg-gradient-to-r from-[#2670e9]/12 to-transparent'
                    : 'text-black/65 dark:text-white/62 hover:text-black/85 dark:hover:text-white/85 hover:bg-black/5 dark:hover:bg-white/6'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <>
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[60%] bg-[#2670e9] rounded-r-full" />
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[60%] bg-[#2670e9] rounded-r-full blur-[3px] opacity-70" />
                    </>
                  )}
                  <Icon size={15} className="flex-shrink-0" />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={11} className="ml-auto opacity-40" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Category filter (tasks / calendar / weekly) */}
        {showSubCat && (
          <>
            <div className="mx-3 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
            <div className="p-2.5 pb-1">
              <p className="text-[9px] text-black/30 dark:text-white/25 font-semibold uppercase tracking-widest mb-1.5 px-1">카테고리</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => onCategoryChange('all')}
                  className={`w-full text-left px-3 py-2 rounded-[8px] text-[12px] transition-all ${
                    activeCategory === 'all'
                      ? 'bg-black/8 dark:bg-white/10 text-black/85 dark:text-white/85 font-semibold'
                      : 'text-black/60 dark:text-white/55 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  전체
                </button>
                {cats.map(cat => (
                  <button
                    key={cat}
                    onClick={() => onCategoryChange(cat as TaskCategory)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-[8px] text-[12px] transition-all ${
                      activeCategory === cat
                        ? 'bg-black/8 dark:bg-white/10 text-black/85 dark:text-white/85 font-semibold'
                        : 'text-black/60 dark:text-white/55 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${CAT_DOT[cat] ?? 'bg-gray-400'}`} />
                    {cat === '복지' ? '복지물' : cat === '사업자' ? '사업자물' : cat}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Dark mode toggle */}
        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
        <div className="p-3">
          <button
            onClick={onToggleDark}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] bg-black/5 dark:bg-white/5 hover:bg-black/8 dark:hover:bg-white/8 transition-all text-[12px] text-black/50 dark:text-white/50"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            <span className="flex-1 text-left">{isDark ? '라이트 모드' : '다크 모드'}</span>
            <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${isDark ? 'bg-blue-500' : 'bg-black/15'}`}>
              <div className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </div>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-[220px] flex-1 min-w-0 relative z-10">
        <div className="p-5 max-w-[1280px] mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
