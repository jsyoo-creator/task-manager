import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import DatePicker from '../components/DatePicker';
import { useHolidayMap } from '../contexts/HolidaysContext';
import type { Vacation, VacationType, AppUser } from '../types';

interface Props {
  vacations: Vacation[];
  teamMembers: AppUser[];
  currentUserName: string;
  userPhotoMap?: Map<string, string>;
  onAddVacation: (data: Omit<Vacation, 'id' | 'createdAt'>) => void;
  onDeleteVacation: (id: string) => void;
}

const VACATION_TYPES: VacationType[] = ['연차', '오전반반차', '오전반차', '오후반반차', '오후반차'];
const VACATION_DAYS: Record<VacationType, number> = {
  '연차': 1,
  '오전반반차': 0.25,
  '오전반차': 0.5,
  '오후반반차': 0.25,
  '오후반차': 0.5,
};
const DEFAULT_ANNUAL = 15;
const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function typeColor(type: VacationType): string {
  switch (type) {
    case '연차':      return 'bg-blue-100 text-blue-700';
    case '오전반차':   return 'bg-emerald-100 text-emerald-700';
    case '오전반반차': return 'bg-teal-100 text-teal-700';
    case '오후반차':   return 'bg-amber-100 text-amber-700';
    case '오후반반차': return 'bg-orange-100 text-orange-700';
    default:          return 'bg-gray-100 text-gray-600';
  }
}

function Avatar({ photoURL, name, size = 'sm' }: { photoURL?: string; name?: string; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'w-10 h-10 text-sm' : 'w-6 h-6 text-[10px]';
  const initial = (name || '?').slice(0, 1);
  if (photoURL) return <img src={photoURL} className={`${dim} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${dim} rounded-full flex items-center justify-center text-white font-bold shrink-0 bg-blue-400`}>
      {initial}
    </div>
  );
}

export default function VacationPage({ vacations, teamMembers, currentUserName, userPhotoMap, onAddVacation, onDeleteVacation }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const holidayMap = useHolidayMap();

  const [showMyForm, setShowMyForm] = useState(false);
  const [myForm, setMyForm] = useState({ date: '', type: '연차' as VacationType, annualDays: 1 });

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const yearPrefix = String(year);

  // 날짜별 휴가 맵 — 다일 연차는 주말·공휴일 건너뜀
  const vacDay = useMemo(() => {
    const map: Record<string, Vacation[]> = {};
    const toDs = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    vacations.forEach(v => {
      const spanDays = v.type === '연차' ? Math.max(1, Math.ceil(v.days)) : 1;

      if (spanDays <= 1) {
        if (v.date.startsWith(monthPrefix)) map[v.date] = [...(map[v.date] ?? []), v];
        return;
      }

      // 다일 연차: 영업일(주말·공휴일 제외)만 카운트하며 스팬
      let found = 0;
      const cur = new Date(v.date + 'T00:00:00');
      let safety = 0;
      while (found < spanDays && safety++ < 365) {
        const dow = cur.getDay();
        const ds = toDs(cur);
        if (dow !== 0 && dow !== 6 && !holidayMap.has(ds)) {
          if (ds.startsWith(monthPrefix)) map[ds] = [...(map[ds] ?? []), v];
          found++;
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [vacations, monthPrefix, holidayMap]);

  const myAnnualTotal = teamMembers.find(m => m.displayName === currentUserName)?.annualLeave ?? DEFAULT_ANNUAL;

  const myVacationsThisYear = useMemo(
    () => vacations.filter(v => v.memberName === currentUserName && v.date.startsWith(yearPrefix)).sort((a, b) => a.date.localeCompare(b.date)),
    [vacations, currentUserName, yearPrefix]
  );
  const myUsed = useMemo(() => myVacationsThisYear.reduce((a, v) => a + v.days, 0), [myVacationsThisYear]);
  const myRemaining = Math.max(0, myAnnualTotal - myUsed);

  // 팀 전체 현황 — 본인 포함
  const memberStats = useMemo(
    () => teamMembers.map(m => {
      const annualTotal = m.annualLeave ?? DEFAULT_ANNUAL;
      const used = vacations.filter(v => v.memberName === m.displayName && v.date.startsWith(yearPrefix)).reduce((a, v) => a + v.days, 0);
      return { user: m, used, remaining: Math.max(0, annualTotal - used), annualTotal };
    }),
    [teamMembers, vacations, yearPrefix]
  );

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  // 이번 달 총 휴가 건수
  const monthVacCount = useMemo(() => {
    const seen = new Set<string>();
    Object.values(vacDay).flat().forEach(v => seen.add(v.id));
    return seen.size;
  }, [vacDay]);

  const handleMySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myForm.date) return;
    const me = teamMembers.find(m => m.displayName === currentUserName);
    const days = myForm.type === '연차' ? myForm.annualDays : VACATION_DAYS[myForm.type];
    onAddVacation({ memberId: me?.uid ?? '', memberName: currentUserName, date: myForm.date, type: myForm.type, days });
    setMyForm({ date: '', type: '연차', annualDays: 1 });
    setShowMyForm(false);
  };

  const mePhotoURL = userPhotoMap?.get(currentUserName) || teamMembers.find(m => m.displayName === currentUserName)?.photoURL;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">휴가</h1>
          <p className="page-subtitle">{year}년 연간 휴가 관리</p>
        </div>
        <span className="text-xs text-gray-400 font-medium">기본 {DEFAULT_ANNUAL}일 · 개인별 조정 가능</span>
      </div>

      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 340px' }}>

        {/* 왼쪽: 큰 캘린더 */}
        <div className="glass-card">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={15} /></button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{year}년 {month + 1}월</span>
              {monthVacCount > 0 && (
                <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 rounded-full px-2 py-0.5">{monthVacCount}건</span>
              )}
            </div>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={15} /></button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-black/3">
            {WEEK_DAYS.map((d, i) => (
              <div key={d} className={`text-center py-2 text-[11px] font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7 divide-x divide-y divide-black/4">
            {cells.map((day, idx) => {
              const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const dayVacs = day ? (vacDay[dateStr] ?? []) : [];
              const isTd = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isWk = idx % 7 === 0 || idx % 7 === 6;
              const holidayName = day ? (holidayMap.get(dateStr) ?? null) : null;
              const isRed = isWk || !!holidayName;
              const MAX = 3;

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] p-1.5 flex flex-col gap-1
                    ${!day ? 'bg-black/1' : ''}
                    ${isWk && day ? 'bg-black/[0.015]' : ''}
                    ${holidayName && !isWk ? 'bg-red-50/30' : ''}
                  `}
                >
                  {day && (
                    <>
                      {/* 날짜 숫자 + 공휴일명 */}
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0
                          ${isTd ? 'bg-blue-500 text-white shadow-sm' : isRed ? 'text-red-400' : 'text-gray-600'}`}>
                          {day}
                        </span>
                        {holidayName && (
                          <span className="text-[9px] text-red-400 leading-tight truncate text-right mt-0.5" title={holidayName}>
                            {holidayName}
                          </span>
                        )}
                      </div>

                      {/* 휴가자 칩 */}
                      <div className="flex flex-col gap-0.5">
                        {dayVacs.slice(0, MAX).map((v, i) => (
                          <div
                            key={i}
                            title={`${v.memberName} — ${v.type}${v.days > 1 ? ` ${v.days}일` : ''}`}
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate ${typeColor(v.type)}`}
                          >
                            <span className="truncate min-w-0 shrink">{v.memberName}</span>
                            <span className="shrink-0">{v.type}</span>
                          </div>
                        ))}
                        {dayVacs.length > MAX && (
                          <span className="text-[9px] text-gray-400 pl-1">+{dayVacs.length - MAX}명</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-black/4">
            {([
              ['연차',      'bg-blue-100 text-blue-700'],
              ['오전반차',   'bg-emerald-100 text-emerald-700'],
              ['오전반반차', 'bg-teal-100 text-teal-700'],
              ['오후반차',   'bg-amber-100 text-amber-700'],
              ['오후반반차', 'bg-orange-100 text-orange-700'],
            ] as const).map(([label, cls]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${cls}`} />
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-50 border border-red-200 inline-block" />
              <span className="text-[10px] text-gray-400">공휴일</span>
            </div>
          </div>
        </div>

        {/* 오른쪽: 내 현황 + 팀 전체 현황 */}
        <div className="space-y-3">

          {/* 내 휴가현황 */}
          <div className="glass-card p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">내 휴가현황 — {year}년</p>
            <div className="flex items-center gap-3">
              <Avatar photoURL={mePhotoURL} name={currentUserName} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 mb-1.5 truncate">{currentUserName || '—'}</p>
                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div className="h-2 rounded-full bg-blue-400 transition-all" style={{ width: `${Math.min(100, Math.round((myUsed / myAnnualTotal) * 100))}%` }} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-3 text-center">
              <div className="flex-1 bg-gray-50 rounded-xl py-2">
                <p className="text-[10px] text-gray-400 mb-0.5">총 연차</p>
                <p className="text-sm font-bold text-gray-700">{myAnnualTotal}<span className="text-[10px] font-normal text-gray-400">일</span></p>
              </div>
              <div className="flex-1 bg-amber-50 rounded-xl py-2">
                <p className="text-[10px] text-gray-400 mb-0.5">사용</p>
                <p className="text-sm font-bold text-amber-500">{myUsed}<span className="text-[10px] font-normal text-gray-400">일</span></p>
              </div>
              <div className={`flex-1 rounded-xl py-2 ${myRemaining <= 3 ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className="text-[10px] text-gray-400 mb-0.5">잔여</p>
                <p className={`text-sm font-bold ${myRemaining <= 3 ? 'text-red-500' : 'text-green-600'}`}>{myRemaining}<span className="text-[10px] font-normal text-gray-400">일</span></p>
              </div>
            </div>

            {myVacationsThisYear.length > 0 && (
              <div className="mt-3 pt-3 border-t border-black/5 flex flex-wrap gap-1.5">
                {myVacationsThisYear.map(v => (
                  <div key={v.id} className="flex items-center gap-1 bg-black/3 rounded-lg px-2 py-1 group">
                    <span className="text-[11px] text-gray-400">{v.date.slice(5).replace('-', '/')}</span>
                    <span className={`text-[11px] font-medium ${v.type === '연차' ? 'text-blue-500' : 'text-amber-500'}`}>{v.type}</span>
                    {v.type === '연차' && v.days > 1 && <span className="text-[11px] text-gray-400">{v.days}일</span>}
                    <button onClick={() => onDeleteVacation(v.id)} className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-0.5"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* 휴가 신청 — 모든 사용자 */}
            <div className="mt-3 pt-3 border-t border-black/5">
              {showMyForm ? (
                <form onSubmit={handleMySubmit} className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 glass-card !rounded-lg px-2.5 py-1.5 text-xs bg-transparent focus:outline-none text-gray-700"
                      value={myForm.type}
                      onChange={e => setMyForm(f => ({ ...f, type: e.target.value as VacationType, annualDays: 1 }))}>
                      {VACATION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    {myForm.type === '연차' && (
                      <div className="flex items-center gap-1 glass-card !rounded-lg px-2.5 py-1.5 shrink-0">
                        <button type="button" onClick={() => setMyForm(f => ({ ...f, annualDays: Math.max(1, f.annualDays - 1) }))}
                          className="text-gray-400 hover:text-gray-600 font-bold text-sm leading-none">−</button>
                        <span className="text-xs text-gray-700 w-6 text-center">{myForm.annualDays}일</span>
                        <button type="button" onClick={() => setMyForm(f => ({ ...f, annualDays: f.annualDays + 1 }))}
                          className="text-gray-400 hover:text-gray-600 font-bold text-sm leading-none">+</button>
                      </div>
                    )}
                  </div>
                  <DatePicker value={myForm.date} onChange={d => setMyForm(f => ({ ...f, date: d }))} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={!myForm.date}
                      className="flex-1 bg-blue-500 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed">신청</button>
                    <button type="button" onClick={() => setShowMyForm(false)}
                      className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-1.5 text-xs hover:bg-gray-50">취소</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowMyForm(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors">
                  <Plus size={12} /> 휴가 신청
                </button>
              )}
            </div>
          </div>

          {/* 팀 전체 현황 */}
          <div className="glass-card">
            <div className="px-4 py-3 border-b border-black/5">
              <h3 className="text-sm font-semibold text-gray-800">팀 전체 현황 — {year}년</h3>
            </div>
            <div className="grid grid-cols-[1fr_56px_56px_80px] text-[10px] text-gray-400 font-semibold uppercase bg-black/2 border-b border-black/4 px-3 py-2">
              <span>이름</span><span className="text-center">사용</span><span className="text-center">잔여</span><span className="text-center">사용률</span>
            </div>
            {memberStats.length === 0
              ? <p className="text-xs text-gray-300 text-center py-8">팀원이 없습니다</p>
              : memberStats.map(({ user, used, remaining, annualTotal }) => (
                <div key={user.uid} className={`grid grid-cols-[1fr_56px_56px_80px] items-center px-3 py-2.5 border-b border-black/3 last:border-0 hover:bg-black/2 transition-colors ${user.displayName === currentUserName ? 'bg-blue-50/40' : ''}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar photoURL={userPhotoMap?.get(user.displayName || '') || user.photoURL} name={user.displayName} size="sm" />
                    <span className="text-xs text-gray-700 truncate">{user.displayName || user.email || '—'}</span>
                    {user.displayName === currentUserName && <span className="text-[9px] text-blue-400 font-semibold shrink-0">나</span>}
                    <span className="text-[9px] text-gray-400 shrink-0">/{annualTotal}일</span>
                  </div>
                  <span className="text-center text-xs text-amber-600 font-semibold">{used}일</span>
                  <span className={`text-center text-xs font-bold ${remaining <= 3 ? 'text-red-500' : 'text-green-600'}`}>{remaining}일</span>
                  <div className="flex flex-col items-center gap-0.5 px-2">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-1.5 rounded-full ${remaining <= 3 ? 'bg-red-400' : 'bg-green-400'}`}
                        style={{ width: `${Math.min(100, Math.round((used / annualTotal) * 100))}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-400">{Math.round((used / annualTotal) * 100)}%</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
