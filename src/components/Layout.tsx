import { NavLink, useLocation } from 'react-router';
import { LayoutDashboard, ListTodo, Calendar, AlignJustify, Palmtree, Grid2X2, Menu, Play } from 'lucide-react';
import type { Project, TaskCategory } from '../types';

interface Props {
  children: React.ReactNode;
  project: Project | null;
  projects: Project[];
  onProjectChange: (id: string) => void;
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
}

const NAV = [
  { to: '/', label: '대시보드', icon: '⊞' },
  { to: '/tasks', label: '업무 관리', icon: '☰' },
  { to: '/calendar', label: '캘린더', icon: '📅' },
  { to: '/weekly', label: '위클리', icon: '📊' },
  { to: '/vacation', label: '휴가', icon: '🌴' },
  { to: '/seats', label: '자리 배치도', icon: '⊡' },
];

const CAT_COLORS: Record<string, string> = {
  '라이브': 'bg-red-500',
  '복지': 'bg-orange-400',
  '사업자': 'bg-indigo-500',
};

const SUBCAT_PAGES = ['/tasks', '/calendar', '/weekly'];

export default function Layout({ children, project, projects, onProjectChange, activeCategory, onCategoryChange }: Props) {
  const location = useLocation();
  const showSubCat = SUBCAT_PAGES.some(p => location.pathname === p);
  const cats = project?.categories ?? ['라이브', '복지', '사업자'];

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex flex-col">
      <header className="bg-[#1a1f2e] text-white">
        {/* Top bar */}
        <div className="px-6 pt-4 pb-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">T</div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">TASK MANAGEMENT</p>
              <h1 className="text-base font-bold leading-tight mt-0.5">{project?.name ?? '프로젝트를 선택하세요'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => onProjectChange(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  project?.id === p.id
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Nav bar */}
        <div className="px-6 pb-3 flex items-center justify-between">
          <p className="text-xs text-slate-400 truncate max-w-sm flex items-center gap-1">
            {project?.description ? (
              <><span>🚀</span><span>{project.description}</span><span className="ml-2 text-slate-600">✂</span></>
            ) : (
              <span>안내 문구 없음 ✂</span>
            )}
          </p>
          <nav className="flex items-center bg-slate-800/60 rounded-full p-1 gap-0.5">
            {NAV.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                  }`
                }
              >
                <span className="text-xs">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Category sub-nav (tasks, calendar, weekly pages) */}
        {showSubCat && (
          <div className="px-6 pb-3 flex items-center gap-2">
            <button
              onClick={() => onCategoryChange('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === 'all' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
              }`}
            >
              전체
            </button>
            {cats.map(cat => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat as TaskCategory)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${CAT_COLORS[cat] ?? 'bg-gray-400'}`} />
                {cat === '복지' ? '복지물' : cat === '사업자' ? '사업자물' : cat}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 p-5 max-w-[1400px] w-full mx-auto">{children}</main>

      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50">
        <button className="w-11 h-11 bg-slate-700 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-600 transition-colors text-sm">☰</button>
        <button className="w-11 h-11 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors">▶</button>
      </div>
    </div>
  );
}
