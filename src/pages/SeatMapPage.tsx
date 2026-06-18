import type { Member } from '../types';

interface Props {
  members: Member[];
}

const ROLE_STYLE: Record<string, { card: string; badge: string; avatar: string }> = {
  PL: {
    card: 'bg-purple-50/80 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/25',
    badge: 'bg-purple-500 text-white',
    avatar: 'from-purple-500 to-purple-600',
  },
  님: {
    card: 'bg-blue-50/80 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/25',
    badge: 'bg-blue-400 text-white',
    avatar: 'from-blue-400 to-blue-500',
  },
};

const F_ROWS: string[][] = [
  ['F1', 'F2', 'F3', 'F4', 'F5'],
  ['F6', 'F7', 'F8', 'F9', ''],
];
const K_ROWS: string[][] = [
  ['K1', 'K2', 'K3', 'K4', 'K5'],
  ['K6', 'K7', 'K8', 'K9', 'K10'],
];
const L_ROWS: string[][] = [
  ['L1', 'L2', 'L3', 'L4', 'L5'],
];

function SeatCell({ seatId, member }: { seatId: string; member?: Member }) {
  if (!seatId) return <div className="h-20" />;
  const style = member ? (ROLE_STYLE[member.role] ?? ROLE_STYLE['님']) : null;

  return (
    <div className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center text-center px-1.5 transition-all ${
      style ? style.card : 'bg-black/3 dark:bg-white/3 border-black/8 dark:border-white/8 hover:border-black/12 dark:hover:border-white/12'
    }`}>
      <span className={`text-[9px] font-bold mb-1.5 ${style ? 'text-gray-500 dark:text-white/40' : 'text-gray-300 dark:text-white/20'}`}>
        {seatId}
      </span>
      {member ? (
        <>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style!.badge}`}>{member.role}</span>
          <p className={`text-[9px] font-medium mt-1 leading-tight ${style!.card.includes('purple') ? 'text-purple-700 dark:text-purple-400' : 'text-blue-700 dark:text-blue-400'}`}>
            {member.name.replace(' PL', '').replace(' 님', '')}
          </p>
        </>
      ) : (
        <p className="text-[9px] text-gray-300 dark:text-white/20">공석</p>
      )}
    </div>
  );
}

function ZoneSection({ zoneId, rows, seatMap }: { zoneId: string; rows: string[][]; seatMap: Record<string, Member> }) {
  const zoneColor = { F: 'from-purple-500 to-purple-600', K: 'from-teal-500 to-teal-600', L: 'from-orange-400 to-orange-500' };
  const occupants = rows.flat().filter(Boolean).filter(id => seatMap[id]).length;

  return (
    <div className="glass-card">
      <div className="px-4 py-2.5 border-b border-black/5 dark:border-white/8 flex items-center gap-2.5">
        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${zoneColor[zoneId as keyof typeof zoneColor] ?? 'from-gray-400 to-gray-500'} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
          {zoneId}
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70">{zoneId} Zone</h3>
        <span className="text-xs text-gray-400 dark:text-white/30">{occupants}명 착석</span>
      </div>
      <div className="p-3 space-y-2">
        {rows.map((row, ri) => (
          <div key={ri} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
            {row.map((id, ci) => <SeatCell key={id || `${ri}-${ci}`} seatId={id} member={seatMap[id]} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SeatMapPage({ members }: Props) {
  const seatMap: Record<string, Member> = {};
  members.forEach(m => { if (m.seatId) seatMap[m.seatId] = m; });

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">자리 배치도</h1>
          <p className="page-subtitle">F · K · L 존 좌석 현황</p>
        </div>
        <span className="text-xs text-black/30 dark:text-white/25 font-medium">{members.length}명</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        {Object.entries(ROLE_STYLE).map(([role, s]) => (
          <div key={role} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-white/50">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.badge}`}>{role}</span>
            <span>{role === 'PL' ? '프로젝트 리드' : '팀원'}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30">
          <span className="w-4 h-4 rounded bg-black/5 dark:bg-white/8 border border-black/8 dark:border-white/10 inline-block" />
          <span>공석</span>
        </div>
      </div>

      <ZoneSection zoneId="F" rows={F_ROWS} seatMap={seatMap} />
      <ZoneSection zoneId="K" rows={K_ROWS} seatMap={seatMap} />
      <ZoneSection zoneId="L" rows={L_ROWS} seatMap={seatMap} />

      {/* Team roster */}
      <div className="glass-card">
        <div className="px-4 py-2.5 border-b border-black/5 dark:border-white/8">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white/70">팀원 현황</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-3">
          {members.map(m => {
            const s = ROLE_STYLE[m.role] ?? ROLE_STYLE['님'];
            return (
              <div key={m.name} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${s.card}`}>
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${s.avatar} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}>
                  {m.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-white/70 truncate">{m.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-white/30">{m.seatId} · {m.area}존</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
