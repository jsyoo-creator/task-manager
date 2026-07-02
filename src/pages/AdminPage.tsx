import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Building2, Plus, UserCog, Shield, LogOut } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useWorkplaces } from '../hooks/useWorkplaces';
import { useAllUsers } from '../hooks/useUserRole';
import type { Team, AppUser, UserRole, Workplace } from '../types';

const ROLE_OPTIONS: UserRole[] = ['user', 'manager', 'superadmin'];
const ROLE_LABEL: Record<UserRole, string> = { user: '일반 사용자', manager: '매니저', superadmin: '최고 관리자' };

interface Props {
  onSignOut: () => void;
  hasWorkspaceAccess: boolean; // 배정된 근무지가 있어 일반 업무관리 화면도 겸용 가능한 경우 "돌아가기" 링크 표시
}

// 플랫폼 관리자(PIVOT 본사 관리자) 전용 — 일반 업무관리 화면과 완전히 분리된 독립 페이지.
// 근무지(클라이언트 TF) 생성 및 사용자 배정을 담당.
export default function AdminPage({ onSignOut, hasWorkspaceAccess }: Props) {
  const { workplaces, loading: wpLoading, createWorkplace } = useWorkplaces();
  const { users, assignUserToWorkplace, setPlatformAdmin } = useAllUsers();
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'teams'), snap => {
      setAllTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });
    return unsub;
  }, []);

  const teamCountByWorkplace = (wpId: string) => allTeams.filter(t => t.workplaceId === wpId).length;
  const userCountByWorkplace = (wpId: string) => users.filter(u => u.workplaceId === wpId).length;
  const workplaceName = (id?: string) => workplaces.find(w => w.id === id)?.name ?? '미배정';
  const pendingUsers = users.filter(u => !u.workplaceId && !u.isPlatformAdmin);
  const assignedUsers = users.filter(u => u.workplaceId);
  const platformAdmins = users.filter(u => u.isPlatformAdmin);

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
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200">
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

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="page-title">근무지 관리</h1>
          <p className="page-subtitle">클라이언트 TF(근무지) 단위로 팀·업무·사용자가 서로 완전히 분리됩니다</p>
        </div>

        {/* 근무지 목록 + 새 근무지 추가 */}
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

      {/* 미배정 사용자 배정 */}
      <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <UserCog size={15} className="text-orange-500" />
          <span className="text-sm font-semibold text-gray-800">미배정 사용자</span>
          <span className="text-xs text-gray-400">{pendingUsers.length}명 · 근무지 배정 전까지 앱을 이용할 수 없습니다</span>
        </div>
        {pendingUsers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">배정 대기 중인 사용자가 없습니다</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {pendingUsers.map(u => (
              <div key={u.uid} className="flex items-center justify-between px-5 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <AssignRow
                  workplaces={workplaces}
                  defaultWorkplaceId=""
                  defaultRole="user"
                  buttonLabel="배정"
                  buttonClass="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors"
                  onSubmit={(wpId, role) => assignUserToWorkplace(u.uid, wpId, role)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 이미 배정된 사용자 → 다른 근무지로 이동 */}
      <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <UserCog size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">사용자 근무지 이동</span>
          <span className="text-xs text-gray-400">{assignedUsers.length}명 · 근무지를 바꾸면 다음 로그인부터 새 근무지의 팀·업무만 보입니다</span>
        </div>
        {assignedUsers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">배정된 사용자가 없습니다</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {assignedUsers.map(u => (
              <div key={u.uid} className="flex items-center justify-between px-5 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email} · 현재 {workplaceName(u.workplaceId)} · {ROLE_LABEL[u.role]}</p>
                </div>
                <AssignRow
                  workplaces={workplaces}
                  defaultWorkplaceId={u.workplaceId ?? ''}
                  defaultRole={u.role}
                  buttonLabel="이동"
                  buttonClass="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
                  onSubmit={(wpId, role) => assignUserToWorkplace(u.uid, wpId, role)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 플랫폼 관리자 지정 */}
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
      </div>
    </div>
  );
}

function AssignRow({ workplaces, defaultWorkplaceId, defaultRole, buttonLabel, buttonClass, onSubmit }: {
  workplaces: Workplace[];
  defaultWorkplaceId: string;
  defaultRole: UserRole;
  buttonLabel: string;
  buttonClass: string;
  onSubmit: (workplaceId: string, role: UserRole) => void;
}) {
  const [workplaceId, setWorkplaceId] = useState(defaultWorkplaceId);
  const [role, setRole] = useState<UserRole>(defaultRole);
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <select
        className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none"
        value={workplaceId}
        onChange={e => setWorkplaceId(e.target.value)}
      >
        <option value="">근무지 선택</option>
        {workplaces.map(wp => <option key={wp.id} value={wp.id}>{wp.name}</option>)}
      </select>
      <select
        className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none"
        value={role}
        onChange={e => setRole(e.target.value as UserRole)}
      >
        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      <button
        disabled={!workplaceId}
        onClick={() => onSubmit(workplaceId, role)}
        className={buttonClass}>
        {buttonLabel}
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
