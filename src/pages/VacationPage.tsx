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
const ANNUAL_TOTAL = 15;
const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    memberName: currentUserName || teamMembers[0]?.displayName || '',
    date: '',
    type: '연차' as VacationType,
    annualDays: 1,
  });

  // 내 휴가 신청 폼
  const [showMyForm, setShowMyForm] = useState(false);
  const [myForm, setMyForm] = useState({ date: '', type: '연차' as VacationType, annualDays: 1 });

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const yearPrefix = String(year);

  const monthVacations = useMemo(
    () => vacations.filter(v => v.date.startsWith(monthPrefix)).sort((a, b) => a.date.localeCompare(b.date)),
    [vacations, monthPrefix]
  );

  const vacDay = useMemo(() => {
    const map: Record<string, Vacation[]> = {};
    vacations.forEach(v => {
      const spanDays = v.type === '연차' ? Math.max(1, Math.ceil(v.days)) : 1;
      for (let i = 0; i < spanDays; i++) {
        const d = new Date(v.date + 'T00:00:00');
        d.setDate(d.getDate() + i);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (ds.startsWith(monthPrefix)) map[ds] = [...(map[ds] ?? []), v];
      }
    });
    return map;
  }, [vacations, monthPrefix]);

  const myVacationsThisYear = useMemo(
    () => vacations.filter(v => v.memberName === currentUserName && v.date.startsWith(yearPrefix)).sort((a, b) => a.date.localeCompare(b.date)),
    [vacations, currentUserName, yearPrefix]
  );
  const myUsed = useMemo(() => myVacationsThisYear.reduce((a, v) => a + v.days, 0), [myVacationsThisYear]);
  const myRemaining = Math.max(0, ANNUAL_TOTAL - myUsed);

  const memberStats = useMemo(
    () => teamMembers.filter(m => m.displayName !== currentUserName).map(m => {
      const used = vacations.filter(v => v.memberName === m.displayName && v.date.startsWith(yearPrefix)).reduce((a, v) => a + v.days, 0);
      return { user: m, used, remaining: Math.max(0, ANNUAL_TOTAL - used) };
    }),
    [teamMembers, vacations, yearPrefix]
  );

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.memberName) return;
    const member = teamMembers.find(m => m.displayName === form.memberName);
    const days = form.type === '연차' ? form.annualDays : VACATION_DAYS[form.type];
    onAddVacation({ memberId: member?.uid ?? '', memberName: form.memberName, date: form.date, type: form.type, days });
    setForm(f => ({ ...f, date: '', annualDays: 1 }));
    setShowForm(false);
  };

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
        <span className="text-xs text-gray-400 font-medium">연간 {ANNUAL_TOTAL}일 기준</span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '300px 1fr' }}>
        {/* 왼쪽: 캘린더 + 등록 폼 */}
        <div className="glass-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold text-gray-800">{year}년 {month + 1}월</span>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={15} /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-black/3">
            {WEEK_DAYS.map((d, i) => (
              <div key={d} className={`text-center py-1.5 text-[10px] font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 p-1.5 gap-0.5">
            {cells.map((day, idx) => {
              const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const dayVacs = day ? (vacDay[dateStr] ?? []) : [];
              const isTd = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isWk = idx % 7 === 0 || idx % 7 === 6;
              const holidayName = day ? (holidayMap.get(dateStr) ?? null) : null;
              const isRed = isWk || !!holidayName;
              return (
                <div key={idx} className={`aspect-square flex flex-col items-center justify-center rounded-lg ${dayVacs.length > 0 ? 'bg-blue-50' : holidayName && !isWk ? 'bg-red-50/40' : ''}`}>
                  {day && (
                    <>
                      <span title={holidayName ?? undefined} className={`text-[11px] font-medium ${isTd ? 'bg-blue-500 text-white w-5 h-5 flex items-center justify-center rounded-full' : isRed ? 'text-red-400' : 'text-gray-700'}`}>{day}</span>
                      {holidayName && !isTd && <span className="w-1 h-1 rounded-full bg-red-400 mt-0.5" />}
                      {dayVacs.length > 0 && <div className="flex gap-0.5 mt-0.5">{dayVacs.slice(0, 3).map((_, i) => <span key={i} className="w-1 h-1 rounded-full bg-blue-400" />)}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 이번 달 내역 */}
          <div className="border-t border-black/4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">{month + 1}월 휴가 내역</p>
            {monthVacations.length === 0
              ? <p className="text-xs text-gray-300 text-center py-4">등록된 휴가 없음</p>
              : <div className="divide-y divide-black/3 max-h-36 overflow-y-auto">
                  {monthVacations.map(v => (
                    <div key={v.id} className="flex items-center gap-2 px-3 py-2 hover:bg-black/2">
                      <span className="text-[11px] text-gray-400 w-10 shrink-0">{v.date.slice(5).replace('-', '/')}</span>
                      <span className="text-[11px] font-medium text-gray-700 flex-1 truncate">{v.memberName}</span>
                      <span className="text-[11px] text-blue-500 shrink-0">{v.type}</span>
                      <button onClick={() => onDeleteVacation(v.id)} className="text-gray-200 hover:text-red-400 transition-colors shrink-0"><Trash2 size={10} /></button>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* 등록 폼 */}
          <div className="p-3 border-t border-black/4">
            {showForm ? (
              <form onSubmit={handleSubmit} className="space-y-2">
                <select className="w-full glass-card !rounded-lg px-2.5 py-1.5 text-xs bg-transparent focus:outline-none text-gray-700"
                  value={form.memberName} onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))}>
                  {teamMembers.map(m => <option key={m.uid} value={m.displayName}>{m.displayName}</option>)}
                </select>
                <div className="flex gap-2">
                  <select className="flex-1 glass-card !rounded-lg px-2.5 py-1.5 text-xs bg-transparent focus:outline-none text-gray-700"
                    value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Vacation['type'], annualDays: 1 }))}>
                    {VACATION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  {form.type === '연차' && (
                    <div className="flex items-center gap-1 glass-card !rounded-lg px-2.5 py-1.5 shrink-0">
                      <button type="button" onClick={() => setForm(f => ({ ...f, annualDays: Math.max(1, f.annualDays - 1) }))}
                        className="text-gray-400 hover:text-gray-600 font-bold text-sm leading-none">−</button>
                      <span className="text-xs text-gray-700 w-6 text-center">{form.annualDays}일</span>
                      <button type="button" onClick={() => setForm(f => ({ ...f, annualDays: f.annualDays + 1 }))}
                        className="text-gray-400 hover:text-gray-600 font-bold text-sm leading-none">+</button>
                    </div>
                  )}
                </div>
                <DatePicker value={form.date} onChange={d => setForm(f => ({ ...f, date: d }))} />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-500 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-blue-600">등록</button>
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-1.5 text-xs hover:bg-gray-50">취소</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => { setForm(f => ({ ...f, memberName: currentUserName || teamMembers[0]?.displayName || '' })); setShowForm(true); }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100">
                <Plus size={12} /> 휴가 등록
              </button>
            )}
          </div>
        </div>

        {/* 오른쪽: 내 현황 + 팀 전체 현황 */}
        <div className="space-y-3">
          {/* 내 휴가현황 */}
          <div className="glass-card p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">내 휴가현황 — {year}년</p>
            <div className="flex items-center gap-4">
              <Avatar photoURL={mePhotoURL} name={currentUserName} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 mb-1.5 truncate">{currentUserName || '—'}</p>
                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div className="h-2 rounded-full bg-blue-400 transition-all" style={{ width: `${Math.min(100, Math.round((myUsed / ANNUAL_TOTAL) * 100))}%` }} />
                </div>
              </div>
              <div className="flex gap-5 text-center shrink-0">
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">총 연차</p>
                  <p className="text-base font-bold text-gray-700">{ANNUAL_TOTAL}<span className="text-xs font-normal text-gray-400">일</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">사용</p>
                  <p className="text-base font-bold text-amber-500">{myUsed}<span className="text-xs font-normal text-gray-400">일</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">잔여</p>
                  <p className={`text-base font-bold ${myRemaining <= 3 ? 'text-red-500' : 'text-green-500'}`}>{myRemaining}<span className="text-xs font-normal text-gray-400">일</span></p>
                </div>
              </div>
            </div>
            {myVacationsThisYear.length > 0 && (
              <div className="mt-3 pt-3 border-t border-black/5 flex flex-wrap gap-1.5">
                {myVacationsThisYear.map(v => (
                  <div key={v.id} className="flex items-center gap-1.5 bg-black/3 rounded-lg px-2 py-1 group">
                    <span className="text-[11px] text-gray-500">{v.date.slice(5).replace('-', '/')}</span>
                    <span className={`text-[11px] font-medium ${v.type === '연차' ? 'text-blue-500' : 'text-amber-500'}`}>{v.type}</span>
                    {v.type === '연차' && v.days > 1 && <span className="text-[11px] text-gray-400">{v.days}일</span>}
                    <button onClick={() => onDeleteVacation(v.id)} className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* 내 휴가 신청 */}
            <div className="mt-3 pt-3 border-t border-black/5">
              {showMyForm ? (
                <form onSubmit={handleMySubmit} className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 glass-card !rounded-lg px-2.5 py-1.5 text-xs bg-transparent focus:outline-none text-gray-700"
                      value={myForm.type}
                      onChange={e => setMyForm(f => ({ ...f, type: e.target.value as VacationType }))}>
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
                    <button type="button" onClick={() => setShowMyForm(false)} className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-1.5 text-xs hover:bg-gray-50">취소</button>
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
            <div className="grid grid-cols-[1fr_72px_72px_100px] text-[11px] text-gray-400 font-medium bg-black/2 border-b border-black/4 px-4 py-2">
              <span>이름</span><span className="text-center">사용</span><span className="text-center">잔여</span><span className="text-center">사용률</span>
            </div>
            {memberStats.length === 0
              ? <p className="text-xs text-gray-300 text-center py-8">팀원이 없습니다</p>
              : memberStats.map(({ user, used, remaining }) => (
                <div key={user.uid} className={`grid grid-cols-[1fr_72px_72px_100px] items-center px-4 py-3 border-b border-black/3 last:border-0 hover:bg-black/2 transition-colors ${user.displayName === currentUserName ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Avatar photoURL={userPhotoMap?.get(user.displayName || '') || user.photoURL} name={user.displayName} size="sm" />
                    <span className="text-sm text-gray-700">{user.displayName || user.email || '—'}</span>
                    {user.displayName === currentUserName && <span className="text-[10px] text-blue-500 font-medium">나</span>}
                  </div>
                  <span className="text-center text-sm text-amber-600 font-medium">{used}일</span>
                  <span className={`text-center text-sm font-semibold ${remaining <= 3 ? 'text-red-500' : 'text-green-600'}`}>{remaining}일</span>
                  <div className="flex flex-col items-center gap-1 px-2">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-1.5 rounded-full ${remaining <= 3 ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, Math.round((used / ANNUAL_TOTAL) * 100))}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400">{Math.round((used / ANNUAL_TOTAL) * 100)}%</span>
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
