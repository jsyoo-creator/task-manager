import { useState, useRef, useEffect } from 'react';
import { Download, Check, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { AppUser, Team, ProfileFieldDef } from '../types';

interface Props {
  allUsers: AppUser[];
  teams: Team[];
  profileFields: ProfileFieldDef[];
}

function getUserTeamId(user: AppUser): string | null {
  if (user.defaultTeamId) return user.defaultTeamId;
  if (user.selectedTeamIds?.length) return user.selectedTeamIds[0];
  return null;
}

function getCellValue(user: AppUser, field: ProfileFieldDef): string {
  if (field.fieldType === 'text+select') {
    const text = user.profileData?.[field.id] ?? '';
    const sel = user.profileData?.[`${field.id}__sel`] ?? '';
    if (text && sel) return `${text} / ${sel}`;
    return text || sel || '';
  }
  return user.profileData?.[field.id] ?? '';
}


const DEPT_ORDER: Record<string, number> = { 기획: 0, 디자인: 1, 퍼블: 2 };

function sortUsers(users: AppUser[]) {
  return [...users].sort((a, b) => {
    const da = DEPT_ORDER[a.department ?? ''] ?? 99;
    const db = DEPT_ORDER[b.department ?? ''] ?? 99;
    if (da !== db) return da - db;
    return (a.displayName ?? '').localeCompare(b.displayName ?? '', 'ko');
  });
}

function buildSheet(users: AppUser[], profileFields: ProfileFieldDef[], activeTeamId: string) {
  const headers = ['이름', '이메일', '직군', ...profileFields.map(f => f.label)];
  const rows = sortUsers(users).map(u => [
    u.displayName || '',
    u.email,
    u.department ?? '',
    ...profileFields.map(f => getCellValue(u, f)),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  const colWidths = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length), 8) + 2, 40),
  }));
  ws['!cols'] = colWidths;

  return ws;
}

function downloadXlsx(teams: Team[], allUsers: AppUser[], profileFields: ProfileFieldDef[], selectedIds: Set<string>) {
  const selectedTeams = teams.filter(t => selectedIds.has(t.id));
  if (selectedTeams.length === 0) return;

  const wb = XLSX.utils.book_new();

  selectedTeams.forEach(t => {
    const users = allUsers.filter(u => getUserTeamId(u) === t.id);
    const ws = buildSheet(users, profileFields, t.id);
    // xlsx 시트명은 31자 이내, 특수문자 불가
    const sheetName = t.name.replace(/[\\/*?[\]:]/g, '').slice(0, 31) || `팀${t.id.slice(-4)}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const filename = selectedTeams.length === 1
    ? `계정정보_${selectedTeams[0].name}.xlsx`
    : `계정정보_전체.xlsx`;

  XLSX.writeFile(wb, filename);
}

function DownloadModal({ teams, allUsers, profileFields, onClose }: {
  teams: Team[];
  allUsers: AppUser[];
  profileFields: ProfileFieldDef[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(teams.map(t => t.id)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const toggleAll = () => {
    setSelected(selected.size === teams.length ? new Set() : new Set(teams.map(t => t.id)));
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleDownload = () => {
    if (selected.size === 0) return;
    downloadXlsx(teams, allUsers, profileFields, selected);
    onClose();
  };

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <p className="text-xs font-semibold text-gray-600">다운로드할 팀 선택</p>
        <p className="text-[11px] text-gray-400 mt-0.5">시트별로 분리되어 저장됩니다</p>
      </div>

      {/* 전체 선택 */}
      <div className="px-4 pt-3 pb-1">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2.5 w-full text-left group"
        >
          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
            selected.size === teams.length
              ? 'bg-[#6C63FF] border-[#6C63FF]'
              : selected.size > 0
              ? 'bg-[#6C63FF]/30 border-[#6C63FF]/50'
              : 'border-gray-300 bg-white group-hover:border-[#6C63FF]/50'
          }`}>
            {selected.size === teams.length && <Check size={10} className="text-white" strokeWidth={3} />}
            {selected.size > 0 && selected.size < teams.length && (
              <div className="w-2 h-0.5 bg-white rounded-full" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">전체 선택</span>
          <span className="ml-auto text-[11px] text-gray-400">{selected.size}/{teams.length}</span>
        </button>
      </div>

      {/* 팀 목록 */}
      <div className="px-4 py-2 space-y-1 max-h-48 overflow-y-auto">
        {teams.map(t => {
          const count = allUsers.filter(u => getUserTeamId(u) === t.id).length;
          const isChecked = selected.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className="flex items-center gap-2.5 w-full text-left py-1.5 group"
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                isChecked ? 'bg-[#6C63FF] border-[#6C63FF]' : 'border-gray-300 bg-white group-hover:border-[#6C63FF]/50'
              }`}>
                {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-sm text-gray-600">{t.emoji} {t.name}</span>
              <span className="ml-auto text-[11px] text-gray-400">{count}명</span>
            </button>
          );
        })}
      </div>

      {/* 다운로드 버튼 */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60">
        <button
          onClick={handleDownload}
          disabled={selected.size === 0}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#5a52e0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={13} />
          {selected.size > 0 ? `${selected.size}개 팀 다운로드` : '팀을 선택하세요'}
        </button>
      </div>
    </div>
  );
}

export default function AccountInfoPage({ allUsers, teams, profileFields }: Props) {
  const [activeTeamId, setActiveTeamId] = useState<string>(teams[0]?.id ?? '');
  const [showDownload, setShowDownload] = useState(false);

  const activeTeam = teams.find(t => t.id === activeTeamId);
  const sorted = sortUsers(allUsers.filter(u => getUserTeamId(u) === activeTeamId));
  // 계정 정보 페이지에 노출 설정된 필드만
  const visibleFields = profileFields.filter(f => f.showInAccountInfo !== false);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">계정 정보</h1>
          <p className="text-sm text-gray-400 mt-0.5">팀원의 프로필 추가 정보를 팀별로 확인합니다.</p>
        </div>
        {teams.length > 0 && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowDownload(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#5a52e0] transition-colors shadow shadow-[#6C63FF]/20"
            >
              <Download size={14} />
              엑셀 다운로드
              <ChevronDown size={13} className={`transition-transform ${showDownload ? 'rotate-180' : ''}`} />
            </button>
            {showDownload && (
              <DownloadModal
                teams={teams}
                allUsers={allUsers}
                profileFields={visibleFields}
                onClose={() => setShowDownload(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Team tabs */}
      {teams.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {teams.map(t => {
            const count = allUsers.filter(u => getUserTeamId(u) === t.id).length;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTeamId(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  t.id === activeTeamId
                    ? 'bg-[#6C63FF] text-white shadow shadow-[#6C63FF]/25'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-[#6C63FF]/40 hover:text-[#6C63FF]'
                }`}
              >
                <span>{t.emoji}</span>
                <span>{t.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                  t.id === activeTeamId ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      {activeTeam ? (
        sorted.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <span className="text-4xl opacity-40">{activeTeam.emoji}</span>
            <p className="text-sm">이 팀에 소속된 팀원이 없습니다.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    {['이름', '직군', ...visibleFields.map(f => f.label + (f.required ? ' *' : ''))].map(h => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80 border-b border-gray-100 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map(u => {
                    const isDefault = u.defaultTeamId === activeTeamId;
                    return (
                      <tr key={u.uid} className="hover:bg-[#F5F3FF] transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {u.photoURL
                              ? <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-gray-100 object-cover" />
                              : <div className="w-7 h-7 rounded-full bg-[#6C63FF]/12 flex items-center justify-center text-[#6C63FF] text-[11px] font-bold flex-shrink-0">
                                  {u.displayName?.slice(0, 1) ?? '?'}
                                </div>
                            }
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 leading-tight">{u.displayName || '—'}</p>
                              <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                            </div>
                            {isDefault && <span className="text-yellow-400 text-xs flex-shrink-0" title="기본 팀">★</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {u.department
                            ? <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-indigo-50 text-indigo-600">{u.department}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        {visibleFields.map(f => {
                          const val = getCellValue(u, f);
                          return (
                            <td key={f.id} className="px-5 py-3.5 whitespace-nowrap">
                              {val ? <span className="text-gray-700">{val}</span> : <span className="text-gray-300 text-xs">미입력</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <p className="text-xs text-gray-400">총 <span className="font-semibold text-gray-600">{sorted.length}명</span></p>
              <p className="text-[11px] text-gray-300">★ 기본 팀으로 설정한 팀원</p>
            </div>
          </div>
        )
      ) : (
        <div className="glass-card flex items-center justify-center py-20 text-gray-400 text-sm">
          생성된 팀이 없습니다.
        </div>
      )}
    </div>
  );
}
