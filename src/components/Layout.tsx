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
    <div className="flex min-h-screen bg-[#edf0f4] dark:bg-[#0a0f1a]">

      {/* Decorative background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-[100px]" />
        <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] rounded-full bg-purple-400/15 dark:bg-purple-600/8 blur-[100px]" />
        <div className="absolute -bottom-20 left-1/3 w-[350px] h-[350px] rounded-full bg-pink-400/10 dark:bg-indigo-600/8 blur-[100px]" />
      </div>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40
        bg-gradient-to-b from-white/85 to-white/65 dark:from-[#141c2e]/90 dark:to-[#0a0f1a]/85
        backdrop-blur-2xl border-r border-white/80 dark:border-white/8">

        {/* Logo + Project */}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-[8px] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_2px_8px_rgba(38,112,233,0.4)] flex-shrink-0">
              T
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-black/30 dark:text-white/30 font-semibold tracking-widest uppercase">TASK MGMT</p>
              <p className="text-xs font-semibold text-black/80 dark:text-white/80 truncate leading-tight">{project?.name ?? '프로젝트 선택'}</p>
            </div>
          </div>

          {/* Project buttons */}
          {projects.length > 0 && (
            <div className="space-y-0.5">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => onProjectChange(p.id)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-all ${
                    project?.id === p.id
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
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
                    : 'text-black/55 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5'
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
                      ? 'bg-black/8 dark:bg-white/10 text-black/80 dark:text-white/80 font-medium'
                      : 'text-black/45 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5'
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
                        ? 'bg-black/8 dark:bg-white/10 text-black/80 dark:text-white/80 font-medium'
                        : 'text-black/45 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5'
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
