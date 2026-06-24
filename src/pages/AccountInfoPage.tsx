import { useState } from 'react';
import type { AppUser, Team, ProfileFieldDef } from '../types';

interface Props {
  allUsers: AppUser[];
  teams: Team[];
  profileFields: ProfileFieldDef[];
}

function getUserTeamId(user: AppUser): string | null {
  if (user.defaultTeamId) return user.defaultTeamId;
  if (user.selectedTeamIds?.length === 1) return user.selectedTeamIds[0];
  if (user.selectedTeamIds?.length) return user.selectedTeamIds[0];
  return null;
}

function getCellValue(user: AppUser, field: ProfileFieldDef): string {
  if (field.fieldType === 'text+select') {
    const text = user.profileData?.[field.id] ?? '';
    const sel = user.profileData?.[`${field.id}__sel`] ?? '';
    if (text && sel) return `${text} / ${sel}`;
    return text || sel || '—';
  }
  return user.profileData?.[field.id] || '—';
}

export default function AccountInfoPage({ allUsers, teams, profileFields }: Props) {
  const [activeTeamId, setActiveTeamId] = useState<string>(teams[0]?.id ?? '');

  const activeTeam = teams.find(t => t.id === activeTeamId);

  const teamUsers = allUsers.filter(u => {
    const tid = getUserTeamId(u);
    return tid === activeTeamId;
  });

  const DEPT_ORDER: Record<string, number> = { 기획: 0, 디자인: 1, 퍼블: 2 };
  const sorted = [...teamUsers].sort((a, b) => {
    const da = DEPT_ORDER[a.department ?? ''] ?? 99;
    const db = DEPT_ORDER[b.department ?? ''] ?? 99;
    if (da !== db) return da - db;
    return (a.displayName ?? '').localeCompare(b.displayName ?? '', 'ko');
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">계정 정보</h1>
        <p className="text-sm text-gray-400 mt-0.5">팀원의 프로필 추가 정보를 팀별로 확인합니다.</p>
      </div>

      {/* Team tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {teams.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTeamId(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
              t.id === activeTeamId
                ? 'bg-[#6C63FF] text-white shadow shadow-[#6C63FF]/30'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-[#6C63FF]/40 hover:text-[#6C63FF]'
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {activeTeam && (
        <div className="glass-card overflow-hidden">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              이 팀에 소속된 팀원이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 whitespace-nowrap">이름</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 whitespace-nowrap">직군</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 whitespace-nowrap">권한</th>
                    {profileFields.map(f => (
                      <th key={f.id} className="text-left px-4 py-3 font-semibold text-xs text-gray-500 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((u, i) => (
                    <tr
                      key={u.uid}
                      className={`border-b border-gray-50 transition-colors hover:bg-[#F0EEFF]/40 ${
                        i % 2 === 0 ? '' : 'bg-gray-50/30'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.photoURL
                            ? <img src={u.photoURL} alt="" className="w-6 h-6 rounded-full flex-shrink-0 ring-1 ring-gray-100" />
                            : <div className="w-6 h-6 rounded-full bg-[#6C63FF]/15 flex items-center justify-center text-[#6C63FF] text-[10px] font-bold flex-shrink-0">
                                {u.displayName?.slice(0, 1) ?? '?'}
                              </div>
                          }
                          <span className="font-medium text-gray-800 whitespace-nowrap">{u.displayName || u.email}</span>
                          {u.defaultTeamId === activeTeamId && (
                            <span className="text-yellow-400 text-[10px]" title="기본 팀">★</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{u.department ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          u.role === 'superadmin' ? 'bg-violet-100 text-violet-600'
                          : u.role === 'manager' ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-500'
                        }`}>
                          {u.role === 'superadmin' ? '최고관리자' : u.role === 'manager' ? '중간관리자' : '일반'}
                        </span>
                      </td>
                      {profileFields.map(f => (
                        <td key={f.id} className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {getCellValue(u, f)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {teams.length === 0 && (
        <div className="glass-card flex items-center justify-center py-20 text-gray-400 text-sm">
          생성된 팀이 없습니다.
        </div>
      )}
    </div>
  );
}
