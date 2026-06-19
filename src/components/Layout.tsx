import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard, ClipboardList, CalendarDays, BarChart3, Umbrella,
  Grid3X3, Sun, Moon, ChevronRight, LogOut, Settings, AlertCircle, ChevronDown
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
  isDark: boolean;
  onToggleDark: () => void;
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
        bg-orange-500/10 border border-orange-400/30 rounded-xl mb-3
        hover:bg-orange-500/15 transition-colors group"
    >
      <AlertCircle size={15} className="text-orange-500 flex-shrink-0" />
      <p className="text-xs text-orange-600 dark:text-orange-400 flex-1">
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

  // 팀이 없음 → 관리자에게 생성 요청
  if (teams.length === 0 && appUser.role !== 'user') {
    return (
      <div onClick={() => navigate('/settings')}
        className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5 bg-blue-500/10 border border-blue-400/30 rounded-xl mb-3 hover:bg-blue-500/15 transition-colors group">
        <AlertCircle size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-600 dark:text-blue-400 flex-1">
          <span className="font-semibold">생성된 팀이 없습니다.</span>{' '}설정에서 팀을 먼저 만들어주세요.
        </p>
        <span className="text-xs text-blue-500 font-medium group-hover:underline flex-shrink-0">팀 만들기</span>
      </div>
    );
  }

  // 팀은 있는데 선택 안 함 → 모든 사용자에게 알림
  if (teams.length > 0 && !appUser.selectedTeamIds?.length) {
    return (
      <div onClick={() => navigate('/settings')}
        className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5 bg-blue-500/10 border border-blue-400/30 rounded-xl mb-3 hover:bg-blue-500/15 transition-colors group">
        <AlertCircle size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-600 dark:text-blue-400 flex-1">
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (userTeams.length <= 1) {
    return (
      <>
        <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center flex-shrink-0
          shadow-[0_2px_6px_rgba(37,99,235,0.5),0_0_0_1px_rgba(255,255,255,0.2)_inset]
          relative before:absolute before:inset-0 before:rounded-[9px] before:bg-gradient-to-b before:from-white/25 before:to-transparent">
          {activeTeam
            ? <span className="text-base leading-none relative z-10">{activeTeam.emoji}</span>
            : <span className="text-white font-bold text-xs relative z-10 opacity-60">무</span>}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] text-black/25 dark:text-white/25 font-semibold tracking-[0.12em] uppercase">PIVOT</p>
          <p className="text-xs font-semibold text-black/80 dark:text-white/80 truncate leading-tight">
            {activeTeam?.name ?? <span className="italic text-black/35 dark:text-white/30 font-normal">무소속</span>}
          </p>
        </div>
      </>
    );
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2.5 min-w-0 flex-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 min-w-0 flex-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/6 px-0.5 py-0.5 -mx-0.5 transition-colors group"
      >
        <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center flex-shrink-0
          shadow-[0_2px_6px_rgba(37,99,235,0.5),0_0_0_1px_rgba(255,255,255,0.2)_inset]
          relative before:absolute before:inset-0 before:rounded-[9px] before:bg-gradient-to-b before:from-white/25 before:to-transparent">
          <span className="text-base leading-none relative z-10">{activeTeam?.emoji}</span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[9px] text-black/25 dark:text-white/25 font-semibold tracking-[0.12em] uppercase">PIVOT</p>
          <p className="text-xs font-semibold text-black/80 dark:text-white/80 truncate leading-tight">{activeTeam?.name}</p>
        </div>
        <ChevronDown size={11} className={`flex-shrink-0 text-black/30 dark:text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-48 z-50
          bg-white/95 dark:bg-[#1a2235]/95 backdrop-blur-xl
          border border-black/10 dark:border-white/10
          rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
          {userTeams.map(t => (
            <button
              key={t.id}
              onClick={() => { onActiveTeamChange(t.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                t.id === activeTeamId
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/6'
              }`}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              <span className="text-[13px] font-medium truncate flex-1">{t.name}</span>
              {t.id === activeTeamId && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({
  children, isDark, onToggleDark, user, appUser, onSignOut, teams, teamsLoading,
  activeTeamId, onActiveTeamChange,
}: Props) {
  const userSelectedTeams = teams.filter(t => appUser?.selectedTeamIds?.includes(t.id));
  const hasTeamSelected = userSelectedTeams.length > 0;
  const NAV = hasTeamSelected ? NAV_ALL : NAV_SETTINGS_ONLY;

  return (
    <div className="flex min-h-screen bg-[#e8eaf6] dark:bg-[#080c18]">

      {/* Decorative background blobs */}
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

        {/* Logo + Team */}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2.5 mb-3">
            {teamsLoading ? (
              <>
                <div className="w-8 h-8 rounded-[9px] bg-black/10 dark:bg-white/10 animate-pulse flex-shrink-0" />
                <p className="text-xs text-black/40 dark:text-white/40">로딩 중...</p>
              </>
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

        {/* Dark mode toggle */}
        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
        <div className="p-3 pb-1">
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

        {/* User profile + sign out */}
        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
        <div className="p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-black/10 dark:ring-white/15" />
              : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                  {user.displayName?.slice(0, 1) ?? '?'}
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-black/70 dark:text-white/65 truncate leading-tight">
                {appUser?.displayName ?? user.displayName ?? user.email}
              </p>
              <p className="text-[9px] text-black/35 dark:text-white/30 truncate">
                {appUser?.role === 'superadmin' ? '최고 관리자' : appUser?.role === 'manager' ? '중간 관리자' : '일반 사용자'}
                {appUser?.department && ` · ${appUser.department}`}
              </p>
            </div>
            <button
              onClick={onSignOut}
              title="로그아웃"
              className="w-6 h-6 rounded-md flex items-center justify-center text-black/30 dark:text-white/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex-shrink-0"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-[220px] flex-1 min-w-0 relative z-10">
        <div className="p-5">
          <DepartmentAlert appUser={appUser} />
          <TeamAlert appUser={appUser} teamsLoading={teamsLoading} teams={teams} />
          {children}
        </div>
      </div>
    </div>
  );
}
