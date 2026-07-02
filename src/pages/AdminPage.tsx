import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Building2, Plus, UserCog, Shield, LogOut, X, LayoutGrid } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useWorkplaces } from '../hooks/useWorkplaces';
import { useAllUsers } from '../hooks/useUserRole';
import type { Team, AppUser, UserRole, Workplace } from '../types';
import { TOGGLEABLE_MENU_ITEMS, isMenuEnabled } from '../types';

const ROLE_OPTIONS: UserRole[] = ['user', 'manager', 'superadmin'];
const ROLE_LABEL: Record<UserRole, string> = { user: '일반 사용자', manager: '중간 관리자', superadmin: '최고 관리자' };
const UNASSIGNED_FILTER = '__unassigned__';

interface Props {
  onSignOut: () => void;
  hasWorkspaceAccess: boolean; // 배정된 근무지가 있어 일반 업무관리 화면도 겸용 가능한 경우 "돌아가기" 링크 표시
}

// 플랫폼 관리자(PIVOT 본사 관리자) 전용 — 일반 업무관리 화면과 완전히 분리된 독립 페이지.
// 근무지(클라이언트 TF) 생성 및 사용자 배정을 담당.
type AdminTab = 'workplaces' | 'users' | 'menus' | 'platform';
const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'workplaces', label: '근무지 목록', icon: <Building2 size={14} /> },
  { id: 'users',      label: '사용자 근무지 배정', icon: <UserCog size={14} /> },
  { id: 'menus',      label: '메뉴 관리', icon: <LayoutGrid size={14} /> },
  { id: 'platform',   label: '플랫폼 관리자', icon: <Shield size={14} /> },
];

export default function AdminPage({ onSignOut, hasWorkspaceAccess }: Props) {
  const { workplaces, loading: wpLoading, createWorkplace, setMenuEnabled } = useWorkplaces();
  const { users, updateUserRole, addUserWorkplace, removeUserWorkplace, setPlatformAdmin } = useAllUsers();
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<AdminTab>('workplaces');
  const [userFilter, setUserFilter] = useState<string>('all');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'teams'), snap => {
      setAllTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });
    return unsub;
  }, []);

  const teamCountByWorkplace = (wpId: string) => allTeams.filter(t => t.workplaceId === wpId).length;
  const userCountByWorkplace = (wpId: string) => users.filter(u => u.workplaceIds?.includes(wpId)).length;
  const platformAdmins = users.filter(u => u.isPlatformAdmin);
  const sortedUsers = [...users].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));

  const userGroups: { key: string; label: string; users: AppUser[] }[] = userFilter === 'all'
    ? [
        ...workplaces.map(wp => ({ key: wp.id, label: wp.name, users: sortedUsers.filter(u => u.workplaceIds?.includes(wp.id)) })),
        { key: UNASSIGNED_FILTER, label: '미배정', users: sortedUsers.filter(u => !u.workplaceIds?.length) },
      ].filter(g => g.users.length > 0)
    : userFilter === UNASSIGNED_FILTER
      ? [{ key: UNASSIGNED_FILTER, label: '미배정', users: sortedUsers.filter(u => !u.workplaceIds?.length) }]
      : [{ key: userFilter, label: workplaces.find(w => w.id === userFilter)?.name ?? '', users: sortedUsers.filter(u => u.workplaceIds?.includes(userFilter)) }];

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createWorkplace(name);
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-blue-500" />
          <span className="text-sm font-bold text-gray-800">PIVOT 어드민</span>
        </div>
        <div className="flex items-center gap-4">
          {hasWorkspaceAccess && (
            <Link to="/" className="text-xs text-blue-500 hover:text-blue-700 font-medium">← 업무관리로 돌아가기</Link>
          )}
          <button onClick={onSignOut} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <LogOut size={12} />로그아웃
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="page-title">근무지 관리</h1>
          <p className="page-subtitle">클라이언트 TF(근무지) 단위로 팀·업무·사용자가 서로 완전히 분리됩니다</p>
        </div>

        <div className="flex gap-1 bg-white/60 border border-gray-200 rounded-2xl p-1.5 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-blue-500 text-white shadow shadow-blue-500/25'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* 근무지 목록 + 새 근무지 추가 */}
        {tab === 'workplaces' && (
      <section className="glass-card">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Building2 size={15} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-800">근무지 목록</span>
            <span className="text-xs text-gray-400">{workplaces.length}개</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="새 근무지 이름 (예: 삼성전자 ○○팀)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors flex-shrink-0">
              <Plus size={12} />추가
            </button>
          </div>
        </div>
        {wpLoading ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">불러오는 중...</p>
        ) : workplaces.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">등록된 근무지가 없습니다</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {workplaces.map(wp => (
              <div key={wp.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{wp.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{wp.createdAt.slice(0, 10)} 생성</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
                  <span>팀 {teamCountByWorkplace(wp.id)}개</span>
                  <span>사용자 {userCountByWorkplace(wp.id)}명</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
        )}

        {/* 사용자 근무지 배정 (다중 배정 가능) */}
        {tab === 'users' && (
      <section className="glass-card">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <UserCog size={15} className="text-orange-500" />
            <span className="text-sm font-semibold text-gray-800">사용자 근무지 배정</span>
            <span className="text-xs text-gray-400">{users.length}명 · 한 사람을 여러 근무지에 동시에 배정할 수 있습니다</span>
          </div>
          <select
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none"
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
          >
            <option value="all">전체 근무지 (그룹별 보기)</option>
            {workplaces.map(wp => <option key={wp.id} value={wp.id}>{wp.name}</option>)}
            <option value={UNASSIGNED_FILTER}>미배정만 보기</option>
          </select>
        </div>
        {users.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">등록된 사용자가 없습니다</p>
        ) : userGroups.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">해당하는 사용자가 없습니다</p>
        ) : (
          userGroups.map(group => (
            <div key={group.key}>
              <div className="px-5 py-2 bg-gray-50/70 border-b border-gray-100 flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${group.key === UNASSIGNED_FILTER ? 'text-orange-500' : 'text-blue-600'}`}>
                  {group.label}
                </span>
                <span className="text-[11px] text-gray-400">{group.users.length}명</span>
              </div>
              <div className="divide-y divide-gray-50">
                {group.users.map(u => (
                  <div key={u.uid} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.displayName}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      {!!u.workplaceIds?.length && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {u.workplaceIds.map(wpId => {
                            const wp = workplaces.find(w => w.id === wpId);
                            if (!wp) return null;
                            return (
                              <span key={wpId} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium">
                                {wp.name}
                                <button onClick={() => removeUserWorkplace(u.uid, wpId)} className="hover:text-blue-800">
                                  <X size={10} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none"
                        value={u.role}
                        onChange={e => updateUserRole(u.uid, e.target.value as UserRole)}
                      >
                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                      <AddWorkplaceControl
                        workplaces={workplaces.filter(wp => !u.workplaceIds?.includes(wp.id))}
                        onAdd={wpId => addUserWorkplace(u.uid, wpId)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
        )}

        {/* 근무지별 메뉴 on/off */}
        {tab === 'menus' && (
      <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <LayoutGrid size={15} className="text-teal-500" />
          <span className="text-sm font-semibold text-gray-800">메뉴 관리</span>
          <span className="text-xs text-gray-400">근무지마다 사이드바에 노출할 메뉴를 다르게 지정할 수 있습니다 (설정 메뉴는 항상 노출)</span>
        </div>
        {workplaces.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">등록된 근무지가 없습니다</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {workplaces.map(wp => (
              <div key={wp.id} className="px-5 py-4">
                <p className="text-sm font-medium text-gray-800 mb-3">{wp.name}</p>
                <div className="grid grid-cols-4 gap-2">
                  {TOGGLEABLE_MENU_ITEMS.map(item => {
                    const enabled = isMenuEnabled(item.id, wp.menuConfig);
                    return (
                      <button
                        key={item.id}
                        onClick={() => setMenuEnabled(wp.id, item.id, !enabled)}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          enabled
                            ? 'bg-teal-50 border-teal-200 text-teal-700'
                            : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}
                      >
                        {item.label}
                        <span className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-teal-500' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
        )}

        {/* 플랫폼 관리자 지정 */}
        {tab === 'platform' && (
      <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Shield size={15} className="text-purple-500" />
          <span className="text-sm font-semibold text-gray-800">플랫폼 관리자</span>
          <span className="text-xs text-gray-400">모든 근무지를 관리할 수 있는 최상위 권한</span>
        </div>
        {platformAdmins.length > 0 && (
          <div className="divide-y divide-gray-50">
            {platformAdmins.map(u => (
              <div key={u.uid} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{u.displayName}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <button
                  onClick={() => setPlatformAdmin(u.uid, false)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium">해제</button>
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t border-gray-100">
          <PlatformAdminAdder users={users} onAdd={uid => setPlatformAdmin(uid, true)} />
        </div>
      </section>
        )}
      </div>
      </div>
    </div>
  );
}

function AddWorkplaceControl({ workplaces, onAdd }: {
  workplaces: Workplace[];
  onAdd: (workplaceId: string) => void;
}) {
  const [workplaceId, setWorkplaceId] = useState('');
  return (
    <div className="flex items-center gap-1.5">
      <select
        className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none disabled:opacity-40"
        value={workplaceId}
        disabled={workplaces.length === 0}
        onChange={e => setWorkplaceId(e.target.value)}
      >
        <option value="">{workplaces.length === 0 ? '배정 가능한 근무지 없음' : '근무지 선택'}</option>
        {workplaces.map(wp => <option key={wp.id} value={wp.id}>{wp.name}</option>)}
      </select>
      <button
        disabled={!workplaceId}
        onClick={() => { onAdd(workplaceId); setWorkplaceId(''); }}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors">
        <Plus size={11} />추가
      </button>
    </div>
  );
}

function PlatformAdminAdder({ users, onAdd }: { users: AppUser[]; onAdd: (uid: string) => void }) {
  const [uid, setUid] = useState('');
  const candidates = users.filter(u => !u.isPlatformAdmin);
  return (
    <div className="flex items-center gap-2">
      <select className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none" value={uid} onChange={e => setUid(e.target.value)}>
        <option value="">사용자 선택</option>
        {candidates.map(u => <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>)}
      </select>
      <button
        disabled={!uid}
        onClick={() => { onAdd(uid); setUid(''); }}
        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 transition-colors flex-shrink-0">
        지정
      </button>
    </div>
  );
}
