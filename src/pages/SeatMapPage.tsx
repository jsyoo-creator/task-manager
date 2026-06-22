import { useState, useMemo } from 'react';
import { Plus, Settings, X } from 'lucide-react';
import type { UserRole, Team, AppUser, SeatGroup } from '../types';
import { useSeatGroups } from '../hooks/useSeatGroups';

interface Props {
  appUserRole: UserRole;
  teams: Team[];
  allUsers: AppUser[];
}

const COLOR_PRESETS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#6366f1',
];

const DEPT_STYLE: Record<string, string> = {
  '기획': 'bg-violet-100 text-violet-700',
  '디자인': 'bg-pink-100 text-pink-700',
  '퍼블': 'bg-teal-100 text-teal-700',
};

function SeatCell({ assigned, color, photoURL, department }: { assigned: string; color: string; photoURL?: string; department?: string }) {
  return (
    <div
      className="h-20 rounded-xl border-2 flex items-center gap-2.5 px-3 transition-all"
      style={assigned
        ? { backgroundColor: color + '15', borderColor: color + '50' }
        : { backgroundColor: 'rgba(0,0,0,0.02)', borderColor: 'rgba(0,0,0,0.08)' }
      }
    >
      {assigned ? (
        <>
          {photoURL
            ? <img src={photoURL} alt={assigned} className="w-8 h-8 rounded-full object-cover ring-2 ring-white flex-shrink-0" />
            : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: color }}>{assigned.slice(0, 1)}</div>
          }
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{assigned}</p>
            {department && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none w-fit ${DEPT_STYLE[department] ?? 'bg-gray-100 text-gray-500'}`}>{department}</span>
            )}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-gray-300 w-full text-center">공석</p>
      )}
    </div>
  );
}

function EditSeatCell({ assigned, members, onAssign, color }: {
  assigned: string;
  members: AppUser[];
  onAssign: (name: string) => void;
  color: string;
}) {
  return (
    <div
      className="h-20 rounded-xl border-2 flex items-center justify-center overflow-hidden cursor-pointer"
      style={assigned
        ? { backgroundColor: color + '15', borderColor: color + '50' }
        : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }
      }
    >
      <select
        value={assigned}
        onChange={e => onAssign(e.target.value)}
        className="w-full h-full text-[11px] text-center bg-transparent border-none outline-none cursor-pointer px-1 font-medium text-gray-700"
      >
        <option value="">공석</option>
        {members.map(m => (
          <option key={m.uid} value={m.displayName}>{m.displayName}</option>
        ))}
      </select>
    </div>
  );
}

function GroupCard({ group, allUsers, teams, editMode, onUpdateGroup, onDeleteGroup }: {
  group: SeatGroup;
  allUsers: AppUser[];
  teams: Team[];
  editMode: boolean;
  onUpdateGroup: (id: string, data: Partial<Omit<SeatGroup, 'id' | 'createdAt'>>) => void;
  onDeleteGroup: (id: string) => void;
}) {
  const [localName, setLocalName] = useState(group.name);
  const [localColor, setLocalColor] = useState(group.color);
  const [localTeamId, setLocalTeamId] = useState(group.teamId);
  const [localCols, setLocalCols] = useState(group.cols);
  const [localRows, setLocalRows] = useState(group.rows);

  const userPhotoMap = useMemo(
    () => new Map(allUsers.map(u => [u.displayName, u.photoURL])),
    [allUsers]
  );
  const userDeptMap = useMemo(
    () => new Map(allUsers.map(u => [u.displayName, u.department])),
    [allUsers]
  );

  const teamMembers = useMemo(
    () => allUsers.filter(u => localTeamId && u.selectedTeamIds?.includes(localTeamId)),
    [allUsers, localTeamId]
  );

  const team = teams.find(t => t.id === group.teamId);
  const assignedNames = useMemo(
    () => new Set(Object.values(group.seats).filter(Boolean)),
    [group.seats]
  );
  const occupiedCount = assignedNames.size;

  const handleSeat = (key: string, name: string) => {
    const newSeats = { ...group.seats };
    // Remove this name from any other seat first (one person = one seat per group)
    Object.keys(newSeats).forEach(k => { if (newSeats[k] === name) delete newSeats[k]; });
    if (name) newSeats[key] = name;
    else delete newSeats[key];
    onUpdateGroup(group.id, { seats: newSeats });
  };

  const handleApply = () => {
    // Keep only seats that fit in the new grid
    const newSeats: Record<string, string> = {};
    for (let r = 0; r < localRows; r++) {
      for (let c = 0; c < localCols; c++) {
        const key = `${r}-${c}`;
        if (group.seats[key]) newSeats[key] = group.seats[key];
      }
    }
    onUpdateGroup(group.id, { name: localName, color: localColor, teamId: localTeamId, cols: localCols, rows: localRows, seats: newSeats });
  };

  const unassigned = teamMembers.filter(m => !assignedNames.has(m.displayName));

  return (
    <div className="glass-card overflow-hidden">
      {/* 그룹 헤더 */}
      <div className="px-4 py-2.5 border-b border-black/5 flex items-center gap-2.5" style={{ backgroundColor: group.color + '18' }}>
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
        <h3 className="text-sm font-semibold text-gray-700 flex-1">{group.name}</h3>
        {team && <span className="text-xs text-gray-400">{team.emoji} {team.name}</span>}
        <span className="text-xs text-gray-400">{occupiedCount}명 착석 / {group.cols * group.rows}석</span>
      </div>

      {/* 편집 설정 패널 */}
      {editMode && (
        <div className="px-4 py-3 border-b border-black/5 bg-gray-50/50 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">그룹명</label>
            <input
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-32"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">색상</label>
            <div className="flex gap-1 py-1">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setLocalColor(c)}
                  className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: localColor === c ? '#1e293b' : 'transparent' }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">팀</label>
            <select
              value={localTeamId}
              onChange={e => setLocalTeamId(e.target.value)}
              className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-36"
            >
              <option value="">팀 선택</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">열(가로)</label>
            <input
              type="number" min={1} max={12}
              value={localCols}
              onChange={e => setLocalCols(Math.max(1, Math.min(12, Number(e.target.value))))}
              className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">행(세로)</label>
            <input
              type="number" min={1} max={12}
              value={localRows}
              onChange={e => setLocalRows(Math.max(1, Math.min(12, Number(e.target.value))))}
              className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          <div className="flex gap-2 pb-0.5">
            <button
              onClick={handleApply}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
            >
              적용
            </button>
            <button
              onClick={() => { if (window.confirm(`"${group.name}" 그룹을 삭제할까요?`)) onDeleteGroup(group.id); }}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 font-medium hover:bg-red-100 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 좌석 그리드 */}
      <div className="p-3 space-y-2">
        {Array.from({ length: group.rows }, (_, r) => (
          <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${group.cols}, 1fr)` }}>
            {Array.from({ length: group.cols }, (_, c) => {
              const key = `${r}-${c}`;
              const assigned = group.seats[key] ?? '';
              if (editMode) {
                const available = teamMembers.filter(
                  m => !assignedNames.has(m.displayName) || m.displayName === assigned
                );
                return (
                  <EditSeatCell
                    key={key}
                    assigned={assigned}
                    members={available}
                    onAssign={name => handleSeat(key, name)}
                    color={group.color}
                  />
                );
              }
              return (
                <SeatCell
                  key={key}
                  assigned={assigned}
                  color={group.color}
                  photoURL={assigned ? userPhotoMap.get(assigned) : undefined}
                  department={assigned ? userDeptMap.get(assigned) : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* 미배치 인원 (편집 모드) */}
      {editMode && unassigned.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-gray-400 font-medium mb-1.5">미배치 인원</p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map(m => (
              <span key={m.uid} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{m.displayName}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SeatMapPage({ appUserRole, teams, allUsers }: Props) {
  const { groups, addGroup, updateGroup, deleteGroup } = useSeatGroups();
  const [editMode, setEditMode] = useState(false);
  const canEdit = appUserRole === 'superadmin' || appUserRole === 'manager';

  const handleAddGroup = async () => {
    const maxOrder = groups.reduce((m, g) => Math.max(m, g.order ?? 0), -1);
    await addGroup({
      name: '새 그룹',
      color: COLOR_PRESETS[groups.length % COLOR_PRESETS.length],
      teamId: teams[0]?.id ?? '',
      cols: 5,
      rows: 2,
      seats: {},
      order: maxOrder + 1,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">자리 배치도</h1>
          <p className="page-subtitle">팀별 좌석 현황</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {editMode && (
              <button
                onClick={handleAddGroup}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors shadow-sm"
              >
                <Plus size={14} />
                그룹 추가
              </button>
            )}
            <button
              onClick={() => setEditMode(e => !e)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-medium transition-colors ${
                editMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700'
                  : 'bg-white/80 text-gray-600 border border-black/10 hover:bg-gray-50'
              }`}
            >
              {editMode ? <><X size={14} /> 완료</> : <><Settings size={14} /> 편집</>}
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <div className="glass-card p-12 text-center">
          <p className="text-sm text-gray-400">
            {canEdit ? '편집 버튼을 눌러 그룹을 추가하세요.' : '배치된 좌석이 없습니다.'}
          </p>
        </div>
      )}

      {groups.map(group => (
        <GroupCard
          key={group.id}
          group={group}
          allUsers={allUsers}
          teams={teams}
          editMode={editMode}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
        />
      ))}
    </div>
  );
}
