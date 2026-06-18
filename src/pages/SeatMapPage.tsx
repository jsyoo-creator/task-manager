import type { Member } from '../types';

interface Props {
  members: Member[];
}

const ROLE_COLOR: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  PL:  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-500 text-white' },
  님:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-400 text-white' },
};

// F zone layout — matches Figma seat arrangement
const F_LAYOUT: { id: string; label: string }[][] = [
  [
    { id: 'F1', label: 'F1' }, { id: 'F2', label: 'F2' }, { id: 'F3', label: 'F3' },
    { id: 'F4', label: 'F4' }, { id: 'F5', label: 'F5' },
  ],
  [
    { id: 'F6', label: 'F6' }, { id: 'F7', label: 'F7' }, { id: 'F8', label: 'F8' },
    { id: 'F9', label: 'F9' }, { id: '', label: '' },
  ],
];

// K zone — empty seats (no members assigned)
const K_LAYOUT: { id: string; label: string }[][] = [
  [
    { id: 'K1', label: 'K1' }, { id: 'K2', label: 'K2' }, { id: 'K3', label: 'K3' },
    { id: 'K4', label: 'K4' }, { id: 'K5', label: 'K5' },
  ],
  [
    { id: 'K6', label: 'K6' }, { id: 'K7', label: 'K7' }, { id: 'K8', label: 'K8' },
    { id: 'K9', label: 'K9' }, { id: 'K10', label: 'K10' },
  ],
];

// L zone — empty seats
const L_LAYOUT: { id: string; label: string }[][] = [
  [
    { id: 'L1', label: 'L1' }, { id: 'L2', label: 'L2' }, { id: 'L3', label: 'L3' },
    { id: 'L4', label: 'L4' }, { id: 'L5', label: 'L5' },
  ],
];

function SeatCell({ seat, member }: { seat: { id: string; label: string }; member?: Member }) {
  if (!seat.id) return <div className="h-20" />;

  const style = member ? (ROLE_COLOR[member.role] ?? ROLE_COLOR['님']) : null;

  return (
    <div className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center text-center px-1 transition-all ${
      member && style
        ? `${style.bg} ${style.border}`
        : 'bg-gray-50 border-gray-100 hover:border-gray-200'
    }`}>
      <span className={`text-[10px] font-bold mb-1 ${member && style ? style.text : 'text-gray-300'}`}>
        {seat.label}
      </span>
      {member ? (
        <>
          <div className={`text-[10px] font-bold ${style?.badge} px-1.5 py-0.5 rounded-full`}>
            {member.role}
          </div>
          <p className={`text-[10px] font-medium mt-1 ${style?.text} leading-tight`}>
            {member.name.replace(' PL', '').replace(' 님', '')}
          </p>
        </>
      ) : (
        <p className="text-[10px] text-gray-300">공석</p>
      )}
    </div>
  );
}

function ZoneGrid({ label, layout, seatMap }: {
  label: string;
  layout: { id: string; label: string }[][];
  seatMap: Record<string, Member>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
          label === 'F' ? 'bg-purple-500' : label === 'K' ? 'bg-teal-500' : 'bg-orange-400'
        }`}>
          {label}
        </div>
        <h3 className="text-sm font-semibold text-gray-700">{label} Zone</h3>
        <span className="text-xs text-gray-400">
          {Object.values(seatMap).filter(m => layout.flat().some(s => s.id === m.seatId)).length}명 착석
        </span>
      </div>
      <div className="p-3 space-y-2">
        {layout.map((row, ri) => (
          <div key={ri} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
            {row.map(seat => (
              <SeatCell key={seat.id || ri + '_empty'} seat={seat} member={seatMap[seat.id]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SeatMapPage({ members }: Props) {
  const seatMap: Record<string, Member> = {};
  members.forEach(m => { if (m.seatId) seatMap[m.seatId] = m; });

  const fMembers = members.filter(m => m.area === 'F');
  const kMembers = members.filter(m => m.area === 'K');
  const lMembers = members.filter(m => m.area === 'L');

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        {Object.entries(ROLE_COLOR).map(([role, style]) => (
          <div key={role} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.badge}`}>{role}</span>
            <span>{role === 'PL' ? '프로젝트 리드' : '팀원'}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-4 h-4 rounded bg-gray-100 border border-gray-200 inline-block" />
          <span>공석</span>
        </div>
      </div>

      <div className="space-y-4">
        <ZoneGrid label="F" layout={F_LAYOUT} seatMap={seatMap} />
        {(kMembers.length > 0 || true) && (
          <ZoneGrid label="K" layout={K_LAYOUT} seatMap={seatMap} />
        )}
        {(lMembers.length > 0 || true) && (
          <ZoneGrid label="L" layout={L_LAYOUT} seatMap={seatMap} />
        )}
      </div>

      {/* Team list */}
      <div className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">팀원 현황</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
          {members.map(m => {
            const style = ROLE_COLOR[m.role] ?? ROLE_COLOR['님'];
            return (
              <div key={m.name} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${style.bg} ${style.border}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${style.badge}`}>
                  {m.name.slice(0, 1)}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${style.text}`}>{m.name}</p>
                  <p className="text-[10px] text-gray-400">{m.seatId} · {m.area}존</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
