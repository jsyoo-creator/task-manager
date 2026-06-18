import { NavLink } from 'react-router';
import { LayoutDashboard, ListTodo, Calendar, AlignJustify, ChevronDown, Play, Menu } from 'lucide-react';
import type { Project } from '../types';

interface Props {
  children: React.ReactNode;
  project: Project | null;
  projects: Project[];
  onProjectChange: (id: string) => void;
}

const NAV = [
  { to: '/', label: '대시보드', icon: LayoutDashboard },
  { to: '/tasks', label: '업무 관리', icon: ListTodo },
  { to: '/calendar', label: '캘린더', icon: Calendar },
  { to: '/weekly', label: '위클리', icon: AlignJustify },
];

export default function Layout({ children, project, projects, onProjectChange }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="px-6 pt-4 pb-2 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <LayoutDashboard size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Task Management</p>
              <h1 className="text-lg font-bold leading-tight">{project?.name ?? '프로젝트를 선택하세요'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <select
              className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-600 cursor-pointer focus:outline-none"
              value={project?.id ?? ''}
              onChange={e => onProjectChange(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 pb-3 flex items-center justify-between">
          <p className="text-xs text-slate-400 truncate max-w-lg">
            {project?.description ?? '등록된 공지사항이 없습니다.'}
          </p>
          <nav className="flex items-center bg-slate-800 rounded-full p-1 gap-0.5">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 p-6">{children}</main>

      <div className="fixed bottom-6 right-6 flex flex-col gap-2">
        <button className="w-12 h-12 bg-slate-800 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-700 transition-colors">
          <Menu size={20} />
        </button>
        <button className="w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
          <Play size={18} />
        </button>
      </div>
    </div>
  );
}
