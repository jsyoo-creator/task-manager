import { useState } from 'react';
import { Shield, User, Users, Check, ChevronDown } from 'lucide-react';
import type { AppUser, UserRole } from '../types';
import { useAllUsers } from '../hooks/useUserRole';

interface Props {
  appUser: AppUser;
  onUpdateName: (name: string) => Promise<void>;
}

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: '최고 관리자',
  manager: '중간 관리자',
  user: '일반 사용자',
};

const ROLE_COLOR: Record<UserRole, string> = {
  superadmin: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/15',
  manager: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
  user: 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-white/8',
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function UserRoleRow({ u, onChangeRole, isSelf }: {
  u: AppUser;
  onChangeRole: (uid: string, role: UserRole) => void;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const changeableRoles: UserRole[] = ['manager', 'user'];

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
        {u.displayName?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {u.displayName}
          {isSelf && <span className="ml-1.5 text-xs text-gray-400">(나)</span>}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
      </div>
      {isSelf || u.role === 'superadmin' ? (
        <RoleBadge role={u.role} />
      ) : (
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <span className={ROLE_COLOR[u.role].split(' ')[0]}>{ROLE_LABEL[u.role]}</span>
            <ChevronDown size={12} className="text-gray-400" />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-36 glass-card z-50 py-1 shadow-lg">
              {changeableRoles.map(r => (
                <button
                  key={r}
                  onClick={() => { onChangeRole(u.uid, r); setOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <span>{ROLE_LABEL[r]}</span>
                  {u.role === r && <Check size={12} className="text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage({ appUser, onUpdateName }: Props) {
  const [nameInput, setNameInput] = useState(appUser.displayName);
  const [nameSaved, setNameSaved] = useState(false);
  const { users, updateUserRole } = useAllUsers();

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    await onUpdateName(nameInput.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">설정</h1>
        <p className="page-subtitle">계정 및 권한 관리</p>
      </div>

      {/* 내 프로필 */}
      <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <User size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-white">내 프로필</span>
          <RoleBadge role={appUser.role} />
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">이메일</label>
            <p className="text-sm text-gray-700 dark:text-gray-300">{appUser.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">표시 이름</label>
            <div className="flex gap-2">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10
                  bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                onClick={handleSaveName}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  nameSaved
                    ? 'bg-green-500 text-white'
                    : 'btn-shiny-primary'
                }`}
              >
                {nameSaved ? '저장됨' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 사용자 관리 — 최고 관리자만 */}
      {appUser.role === 'superadmin' && (
        <section className="glass-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <Users size={15} className="text-purple-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-white">사용자 관리</span>
            <span className="text-xs text-gray-400">{users.length}명</span>
          </div>
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {users.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">등록된 사용자 없음</p>
            ) : (
              users
                .sort((a, b) => {
                  const order = { superadmin: 0, manager: 1, user: 2 };
                  return order[a.role] - order[b.role];
                })
                .map(u => (
                  <UserRoleRow
                    key={u.uid}
                    u={u}
                    onChangeRole={updateUserRole}
                    isSelf={u.uid === appUser.uid}
                  />
                ))
            )}
          </div>
        </section>
      )}

      {/* 권한 안내 */}
      <section className="glass-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <Shield size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-white">권한 안내</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3 text-xs">
            {(['superadmin', 'manager', 'user'] as UserRole[]).map(r => (
              <div key={r} className="space-y-2">
                <RoleBadge role={r} />
                <ul className="space-y-1 text-gray-500 dark:text-gray-400">
                  {r !== 'user' && <li>· 업무 등록/수정/삭제</li>}
                  {r === 'superadmin' && <li>· 사용자 권한 관리</li>}
                  <li>· 휴가 등록</li>
                  <li>· 세부업무 시간 입력</li>
                  <li>· 시작일/종료일 변경</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
