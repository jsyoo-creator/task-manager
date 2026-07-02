import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard, ClipboardList, CalendarDays, BarChart3, Umbrella,
  Grid3X3, MessageSquare, LogOut, Settings, AlertCircle, ChevronDown, Contact, Building2, Star
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Project, TaskCategory, AppUser, Team, ProfileFieldDef, Workplace } from '../types';

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
  unreadNoticeCount?: number;
  profileFields?: ProfileFieldDef[];
  workplaces?: Workplace[];
  activeWorkplaceId?: string | null;
  onActiveWorkplaceChange?: (id: string) => void;
  onSetDefaultWorkplace?: (id: string | null) => void;
}

const NAV_ALL = [
  { to: '/', label: '대시보드', icon: LayoutDashboard, minRole: null },
  { to: '/tasks', label: '업무 관리', icon: ClipboardList, minRole: null },
  { to: '/calendar', label: '캘린더', icon: CalendarDays, minRole: null },
  { to: '/weekly', label: '위클리', icon: BarChart3, minRole: null },
  { to: '/vacation', label: '휴가', icon: Umbrella, minRole: null },
  { to: '/board', label: '커뮤니티', icon: MessageSquare, minRole: null },
  { to: '/accounts', label: '계정 정보', icon: Contact, minRole: 'manager' as const },
  { to: '/seats', label: '자리 배치도', icon: Grid3X3, minRole: null },
  { to: '/settings', label: '설정', icon: Settings, minRole: null },
];
const NAV_SETTINGS_ONLY = [
  { to: '/settings', label: '설정', icon: Settings, minRole: null },
];

function DepartmentAlert({ appUser }: { appUser: AppUser | null }) {
  const navigate = useNavigate();
  if (!appUser || appUser.department) return null;
  return (
    <div
      onClick={() => navigate('/settings')}
      className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5
        bg-orange-50 border border-orange-200 rounded-2xl mb-3
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
        className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-2xl mb-3 hover:bg-violet-100 transition-colors group">
        <AlertCircle size={15} className="text-violet-500 flex-shrink-0" />
        <p className="text-xs text-violet-700 flex-1">
          <span className="font-semibold">생성된 팀이 없습니다.</span>{' '}설정에서 팀을 먼저 만들어주세요.
        </p>
        <span className="text-xs text-violet-500 font-medium group-hover:underline flex-shrink-0">팀 만들기</span>
      </div>
    );
  }

  if (teams.length > 0 && !appUser.selectedTeamIds?.length) {
    return (
      <div onClick={() => navigate('/settings')}
        className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-2xl mb-3 hover:bg-violet-100 transition-colors group">
        <AlertCircle size={15} className="text-violet-500 flex-shrink-0" />
        <p className="text-xs text-violet-700 flex-1">
          <span className="font-semibold">소속 팀이 설정되지 않았습니다.</span>{' '}설정에서 팀을 선택해주세요.
        </p>
        <span className="text-xs text-violet-500 font-medium group-hover:underline flex-shrink-0">팀 선택</span>
      </div>
    );
  }

  return null;
}

function ProfileDateAlert({ appUser, profileFields }: { appUser: AppUser | null; profileFields: ProfileFieldDef[] }) {
  const navigate = useNavigate();
  if (!appUser) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeAlerts: { field: ProfileFieldDef; daysLeft: number }[] = [];
  for (const field of profileFields) {
    if (field.fieldType !== 'date' || !field.ddayAlert) continue;
    const val = appUser.profileData?.[field.id];
    if (!val) continue;
    const target = new Date(val);
    target.setHours(0, 0, 0, 0);
    const diff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= field.ddayAlert.days) {
      activeAlerts.push({ field, daysLeft: diff });
    }
  }
  if (!activeAlerts.length) return null;
  return (
    <>
      {activeAlerts.map(({ field, daysLeft }) => (
        <div key={field.id}
          onClick={() => navigate('/settings')}
          className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl mb-3 hover:bg-amber-100 transition-colors group"
        >
          <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 flex-1">
            <span className="font-semibold">{field.ddayAlert!.message || field.label}</span>
            {' '}
            {daysLeft === 0 ? '오늘입니다.' : `${daysLeft}일 남았습니다.`}
          </p>
          <span className="text-xs text-amber-500 font-medium group-hover:underline flex-shrink-0">
            {daysLeft === 0 ? 'D-day' : `D-${daysLeft}`}
          </span>
        </div>
      ))}
    </>
  );
}

function WorkplaceSwitcher({ workplaces, activeWorkplaceId, defaultWorkplaceId, onChange, onSetDefault }: {
  workplaces: Workplace[];
  activeWorkplaceId: string | null;
  defaultWorkplaceId?: string;
  onChange: (id: string) => void;
  onSetDefault?: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = workplaces.find(w => w.id === activeWorkplaceId) ?? workplaces[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (workplaces.length <= 1) return null;

  return (
    <div ref={ref} className="relative mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 transition-colors"
      >
        <Building2 size={11} className="text-white/50 flex-shrink-0" />
        <span className="text-[11px] text-white/70 font-medium truncate flex-1 text-left">{active?.name ?? '근무지 선택'}</span>
        <ChevronDown size={11} className={`text-white/50 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-56 z-50 bg-white border border-[#EDE9FA] rounded-xl shadow-xl shadow-[#6C63FF]/12 overflow-hidden py-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] px-3.5 pt-2 pb-1.5">근무지 전환</p>
          {workplaces.map(w => {
            const isDefault = defaultWorkplaceId === w.id;
            return (
              <div
                key={w.id}
                className={`flex items-center gap-1 px-2 transition-colors ${
                  w.id === activeWorkplaceId ? 'bg-[#F0EEFF]' : 'hover:bg-gray-50'
                }`}
              >
                <button
                  onClick={() => { onChange(w.id); setOpen(false); }}
                  className={`flex-1 flex items-center gap-2 py-2 text-left text-[13px] min-w-0 ${
                    w.id === activeWorkplaceId ? 'text-[#6C63FF] font-medium' : 'text-gray-700'
                  }`}
                >
                  <span className="truncate flex-1">{w.name}</span>
                  {w.id === activeWorkplaceId && <div className="w-1.5 h-1.5 rounded-full bg-[#6C63FF] flex-shrink-0" />}
                </button>
                {onSetDefault && (
                  <button
                    onClick={() => onSetDefault(isDefault ? null : w.id)}
                    title={isDefault ? '기본 근무지 해제' : '기본 근무지로 설정 (다음 로그인부터 자동 입장)'}
                    className={`flex-shrink-0 p-1 rounded transition-colors ${
                      isDefault ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                    }`}
                  >
                    <Star size={13} fill={isDefault ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
          canSwitch ? 'cursor-pointer hover:bg-white/10' : ''
        }`}
      >
        <div className="w-8 h-8 rounded-[9px] bg-white/15 flex items-center justify-center flex-shrink-0">
          {activeTeam
            ? <span className="text-base leading-none">{activeTeam.emoji}</span>
            : <span className="text-white font-bold text-xs opacity-60">무</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-white/40 font-semibold tracking-[0.12em] uppercase">PIVOT</p>
          <p className="text-xs font-semibold text-white truncate leading-tight">
            {activeTeam?.name ?? <span className="italic text-white/40 font-normal">무소속</span>}
          </p>
        </div>
        {canSwitch && (
          <div className="flex items-center gap-0.5 flex-shrink-0 bg-white/10 rounded-md px-1.5 py-0.5">
            <span className="text-[9px] font-bold text-white/50 tabular-nums">{userTeams.length}팀</span>
            <ChevronDown size={10} className={`text-white/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </div>
        )}
      </div>

      {open && canSwitch && (
        <div className="absolute top-full left-0 mt-2 w-52 z-50
          bg-white border border-[#EDE9FA]
          rounded-2xl shadow-xl shadow-[#6C63FF]/12 overflow-hidden py-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] px-3.5 pt-2 pb-1.5">팀 전환</p>
          {userTeams.map(t => (
            <button
              key={t.id}
              onClick={() => { onActiveTeamChange(t.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                t.id === activeTeamId
                  ? 'bg-[#F0EEFF] text-[#6C63FF]'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              <span className="text-[13px] font-medium truncate flex-1">{t.name}</span>
              {t.id === activeTeamId && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#6C63FF] flex-shrink-0" />
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
  activeTeamId, onActiveTeamChange, unreadNoticeCount = 0, profileFields = [],
  workplaces = [], activeWorkplaceId = null, onActiveWorkplaceChange, onSetDefaultWorkplace,
}: Props) {
  const myWorkplaces = workplaces.filter(w => appUser?.workplaceIds?.includes(w.id));
  const userSelectedTeams = teams.filter(t => appUser?.selectedTeamIds?.includes(t.id));
  const hasTeamSelected = userSelectedTeams.length > 0;
  const role = appUser?.role ?? 'user';
  const canSeeManagerMenu = role === 'superadmin' || role === 'manager';
  const NAV = (hasTeamSelected ? NAV_ALL : NAV_SETTINGS_ONLY).filter(item =>
    item.minRole === null || canSeeManagerMenu
  );
  // 플랫폼 관리자는 배정된 팀이 없어도(근무지 오버사이트 전용 계정일 수 있음) 항상 어드민 메뉴가 보여야 함
  if (appUser?.isPlatformAdmin) {
    NAV.push({ to: '/admin', label: '근무지 관리', icon: Building2, minRole: null });
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#1E2264' }}>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40"
        style={{ background: '#1E2264' }}>

        {/* Logo + Team */}
        <div className="p-4 pb-3 mt-2">
          {teamsLoading ? (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="w-8 h-8 rounded-[9px] bg-white/10 animate-pulse flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-1.5 w-7 bg-white/10 animate-pulse rounded-full" />
                <div className="h-2.5 w-24 bg-white/10 animate-pulse rounded-full" />
              </div>
            </div>
          ) : (
            <>
              <WorkplaceSwitcher
                workplaces={myWorkplaces}
                activeWorkplaceId={activeWorkplaceId}
                defaultWorkplaceId={appUser?.defaultWorkplaceId}
                onChange={onActiveWorkplaceChange ?? (() => {})}
                onSetDefault={onSetDefaultWorkplace}
              />
              <TeamSwitcher
                userTeams={userSelectedTeams}
                activeTeamId={activeTeamId}
                onActiveTeamChange={onActiveTeamChange}
              />
            </>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/8 mb-2" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-white/13 text-white'
                    : 'text-white/55 hover:text-white/85 hover:bg-white/8'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                    isActive
                      ? 'bg-[#6C63FF] text-white shadow-lg shadow-[#6C63FF]/40'
                      : 'text-white/55'
                  }`}>
                    <Icon size={14} />
                    {to === '/board' && unreadNoticeCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                        {unreadNoticeCount > 9 ? '9+' : unreadNoticeCount}
                      </span>
                    )}
                  </div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile + sign out */}
        <div className="mx-4 h-px bg-white/8" />
        <div className="p-3 pb-5">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/8 transition-colors">
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-white/20" />
              : <div className="w-7 h-7 rounded-full bg-[#6C63FF] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                  {user.displayName?.slice(0, 1) ?? '?'}
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white/80 truncate leading-tight">
                {appUser?.displayName ?? user.displayName ?? user.email}
              </p>
              <p className="text-[9px] text-white/35 truncate">
                {appUser?.role === 'superadmin' ? '최고 관리자' : appUser?.role === 'manager' ? '중간 관리자' : '일반 사용자'}
                {appUser?.department && ` · ${appUser.department}`}
              </p>
            </div>
            <button
              onClick={onSignOut}
              title="로그아웃"
              className="w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-[#FF6B9D] hover:bg-white/10 transition-all flex-shrink-0"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content — bright rounded panel over dark bg */}
      <div
        className="flex-1 min-w-0 relative"
        style={{
          marginLeft: '220px',
          padding: '12px',
          height: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="rounded-[28px] h-full overflow-hidden flex flex-col"
          style={{ background: 'linear-gradient(160deg, #FAFAFE 0%, #F0EEFF 100%)' }}
        >
          {/* paddingLeft shifts when detail panel opens — panel stays full size */}
          <div
            className="pt-6 pr-6 pb-6 flex-1 overflow-y-auto"
            style={{
              paddingLeft: 'calc(var(--detail-panel-w, 0px) + 24px)',
              transition: 'padding-left 0.26s ease-out',
            }}
          >
            <DepartmentAlert appUser={appUser} />
            <TeamAlert appUser={appUser} teamsLoading={teamsLoading} teams={teams} />
            <ProfileDateAlert appUser={appUser} profileFields={profileFields} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
