import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard, ClipboardList, CalendarDays, BarChart3, Umbrella,
  Grid3X3, ChevronRight, LogOut, Settings, AlertCircle, ChevronDown
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Project, TaskCategory, AppUser, Team } from '../types';

interface Props {
  children: React.ReactNode;
  project: Project | null;
  projects: Project[];
  onProjectChange: (id: string) => void;
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  user: User;
  appUser: AppUser | null;
  onSignOut: () => void;
  teams: Team[];
  teamsLoading: boolean;
  activeTeamId: string | null;
  onActiveTeamChange: (id: string) => void;
}

const NAV_ALL = [
  { to: '/', label: '대시보드', icon: LayoutDashboard },
  { to: '/tasks', label: '업무 관리', icon: ClipboardList },
  { to: '/calendar', label: '캘린더', icon: CalendarDays },
  { to: '/weekly', label: '위클리', icon: BarChart3 },
  { to: '/vacation', label: '휴가', icon: Umbrella },
  { to: '/seats', label: '자리 배치도', icon: Grid3X3 },
  { to: '/settings', label: '설정', icon: Settings },
];
const NAV_SETTINGS_ONLY = [
  { to: '/settings', label: '설정', icon: Settings },
];

function DepartmentAlert({ appUser }: { appUser: AppUser | null }) {
  const navigate = useNavigate();
  if (!appUser || appUser.department) return null;
  return (
    <div
      onClick={() => navigate('/settings')}
      className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5
        bg-orange-50 border border-orange-200 rounded-xl mb-3
        hover:bg-orange-100 transition-colors group"
    >
      <AlertCircle size={15} className="text-orange-500 flex-shrink-0" />
      <p className="text-xs text-orange-700 flex-1">
        <span className="font-semibold">직군이 설정되지 않았습니다.</span>{' '}
        기획 / 디자인 / 퍼블 중 하나를 선택해주세요.
      </p>
      <span className="text-xs text-orange-500 font-medium group-hover:underline flex-shrink-0">설정하기</span>
    </div>
  );
}

function TeamAlert({ appUser, teamsLoading, teams }: { appUser: AppUser | null; teamsLoading: boolean; teams: Team[] }) {
  const navigate = useNavigate();
  if (teamsLoading || !appUser) return null;

  if (teams.length === 0 && appUser.role !== 'user') {
    return (
      <div onClick={() => navigate('/settings')}
        className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl mb-3 hover:bg-blue-100 transition-colors group">
        <AlertCircle size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700 flex-1">
          <span className="font-semibold">생성된 팀이 없습니다.</span>{' '}설정에서 팀을 먼저 만들어주세요.
        </p>
        <span className="text-xs text-blue-500 font-medium group-hover:underline flex-shrink-0">팀 만들기</span>
      </div>
    );
  }

  if (teams.length > 0 && !appUser.selectedTeamIds?.length) {
    return (
      <div onClick={() => navigate('/settings')}
        className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl mb-3 hover:bg-blue-100 transition-colors group">
        <AlertCircle size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700 flex-1">
          <span className="font-semibold">소속 팀이 설정되지 않았습니다.</span>{' '}설정에서 팀을 선택해주세요.
        </p>
        <span className="text-xs text-blue-500 font-medium group-hover:underline flex-shrink-0">팀 선택</span>
      </div>
    );
  }

  return null;
}

function TeamSwitcher({ userTeams, activeTeamId, onActiveTeamChange }: {
  userTeams: Team[];
  activeTeamId: string | null;
  onActiveTeamChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeTeam = userTeams.find(t => t.id === activeTeamId) ?? userTeams[0] ?? null;
  const canSwitch = userTeams.length > 1;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => canSwitch && setOpen(o => !o)}
        className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 -mx-2 transition-colors select-none ${
          canSwitch ? 'cursor-pointer hover:bg-gray-100' : ''
        }`}
      >
        <div className="w-8 h-8 rounded-[9px] bg-[#5B5BD6] flex items-center justify-center flex-shrink-0 shadow-sm">
          {activeTeam
            ? <span className="text-base leading-none">{activeTeam.emoji}</span>
            : <span className="text-white font-bold text-xs opacity-60">무</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-gray-400 font-semibold tracking-[0.12em] uppercase">PIVOT</p>
          <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
            {activeTeam?.name ?? <span className="italic text-gray-400 font-normal">무소속</span>}
          </p>
        </div>
        {canSwitch && (
          <div className="flex items-center gap-0.5 flex-shrink-0 bg-gray-100 rounded-md px-1.5 py-0.5">
            <span className="text-[9px] font-bold text-gray-400 tabular-nums">{userTeams.length}팀</span>
            <ChevronDown size={10} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </div>
        )}
      </div>

      {open && canSwitch && (
        <div className="absolute top-full left-0 mt-2 w-52 z-50
          bg-white border border-gray-200
          rounded-2xl shadow-lg shadow-black/8 overflow-hidden py-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] px-3.5 pt-2 pb-1.5">팀 전환</p>
          {userTeams.map(t => (
            <button
              key={t.id}
              onClick={() => { onActiveTeamChange(t.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                t.id === activeTeamId
                  ? 'bg-[#EEEEFF] text-[#5B5BD6]'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              <span className="text-[13px] font-medium truncate flex-1">{t.name}</span>
              {t.id === activeTeamId && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#5B5BD6] flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({
  children, user, appUser, onSignOut, teams, teamsLoading,
  activeTeamId, onActiveTeamChange,
}: Props) {
  const userSelectedTeams = teams.filter(t => appUser?.selectedTeamIds?.includes(t.id));
  const hasTeamSelected = userSelectedTeams.length > 0;
  const NAV = hasTeamSelected ? NAV_ALL : NAV_SETTINGS_ONLY;

  return (
    <div className="flex min-h-screen bg-[#F7F8FC]">

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40
        bg-white border-r border-gray-200
        shadow-[1px_0_0_rgba(0,0,0,0.02)]">

        {/* Logo + Team */}
        <div className="p-4 pb-3">
          <div className="mb-3">
            {teamsLoading ? (
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div className="w-8 h-8 rounded-[9px] bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-1.5 w-7 bg-gray-100 animate-pulse rounded-full" />
                  <div className="h-2.5 w-24 bg-gray-100 animate-pulse rounded-full" />
                </div>
              </div>
            ) : (
              <TeamSwitcher
                userTeams={userSelectedTeams}
                activeTeamId={activeTeamId}
                onActiveTeamChange={onActiveTeamChange}
              />
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-gray-100" />

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
                    ? 'text-[#5B5BD6] bg-[#EEEEFF]'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[55%] bg-[#5B5BD6] rounded-r-full" />
                  )}
                  <Icon size={15} className="flex-shrink-0" />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={11} className="ml-auto opacity-40" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile + sign out */}
        <div className="mx-3 h-px bg-gray-100" />
        <div className="p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-gray-200" />
              : <div className="w-7 h-7 rounded-full bg-[#5B5BD6] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                  {user.displayName?.slice(0, 1) ?? '?'}
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-700 truncate leading-tight">
                {appUser?.displayName ?? user.displayName ?? user.email}
              </p>
              <p className="text-[9px] text-gray-400 truncate">
                {appUser?.role === 'superadmin' ? '최고 관리자' : appUser?.role === 'manager' ? '중간 관리자' : '일반 사용자'}
                {appUser?.department && ` · ${appUser.department}`}
              </p>
            </div>
            <button
              onClick={onSignOut}
              title="로그아웃"
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 relative"
        style={{ marginLeft: 'calc(220px + var(--detail-panel-w, 0px))', transition: 'margin-left 0.26s ease-out' }}>
        <div className="p-5">
          <DepartmentAlert appUser={appUser} />
          <TeamAlert appUser={appUser} teamsLoading={teamsLoading} teams={teams} />
          {children}
        </div>
      </div>
    </div>
  );
}
