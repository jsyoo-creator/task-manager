import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { Vacation, Member } from '../types';

interface Props {
  vacations: Vacation[];
  members: Member[];
  onAddVacation: (data: Omit<Vacation, 'id' | 'createdAt'>) => void;
  onDeleteVacation: (id: string) => void;
}

const VACATION_TYPES: Vacation['type'][] = ['연차', '반차', '오반반차', '공온반차'];
const VACATION_DAYS: Record<Vacation['type'], number> = { '연차': 1, '반차': 0.5, '오반반차': 0.5, '공온반차': 0.5 };
const ANNUAL_TOTAL = 15;
const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function VacationPage({ vacations, members, onAddVacation, onDeleteVacation }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ memberName: members[0]?.name ?? '', date: '', type: '연차' as Vacation['type'] });

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const monthVacations = useMemo(() => vacations.filter(v => v.date.startsWith(monthPrefix)), [vacations, monthPrefix]);

  const vacDay = useMemo(() => {
    const map: Record<string, Vacation[]> = {};
    monthVacations.forEach(v => { map[v.date] = [...(map[v.date] ?? []), v]; });
    return map;
  }, [monthVacations]);

  const memberStats = useMemo(() => members.map(m => {
    const used = vacations.filter(v => v.memberName === m.name && v.date.startsWith(String(year))).reduce((a, v) => a + v.days, 0);
    return { name: m.name, role: m.role, used, remaining: Math.max(0, ANNUAL_TOTAL - used) };
  }), [members, vacations, year]);

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.memberName) return;
    const member = members.find(m => m.name === form.memberName);
    onAddVacation({ memberId: member?.id ?? '', memberName: form.memberName, date: form.date, type: form.type, days: VACATION_DAYS[form.type] });
    setForm(f => ({ ...f, date: '' }));
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">휴가</h1>
          <p className="page-subtitle">{year}년 연간 휴가 관리</p>
        </div>
        <span className="text-xs text-black/30 dark:text-white/25 font-medium">연간 {15}일 기준</span>
      </div>

    <div className="grid gap-4" style={{ gridTemplateColumns: '320px 1fr' }}>
      {/* Left: Mini calendar */}
      <div className="glass-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/8">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-black/6 dark:hover:bg-white/8 text-gray-500 dark:text-white/50">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-gray-800 dark:text-white/80">{year}년 {month + 1}월</span>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-black/6 dark:hover:bg-white/8 text-gray-500 dark:text-white/50">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-black/3 dark:border-white/5">
          {WEEK_DAYS.map((d, i) => (
            <div key={d} className={`text-center py-1.5 text-[10px] font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400 dark:text-white/30'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 p-1.5 gap-0.5">
          {cells.map((day, idx) => {
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
            const dayVacs = day ? (vacDay[dateStr] ?? []) : [];
            const isTd = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isWk = idx % 7 === 0 || idx % 7 === 6;
            return (
              <div key={idx} className={`aspect-square flex flex-col items-center justify-center rounded-lg ${dayVacs.length > 0 ? 'bg-blue-50 dark:bg-blue-500/15' : ''}`}>
                {day && (
                  <>
                    <span className={`text-[11px] font-medium ${isTd ? 'bg-blue-500 text-white w-5 h-5 flex items-center justify-center rounded-full' : isWk ? 'text-gray-400 dark:text-white/25' : 'text-gray-700 dark:text-white/60'}`}>{day}</span>
                    {dayVacs.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayVacs.slice(0, 2).map((_, i) => <span key={i} className="w-1 h-1 rounded-full bg-blue-400" />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-black/4 dark:border-white/6">
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              {[
                <select key="member" className="w-full glass-card !rounded-lg !overflow-visible px-2.5 py-1.5 text-xs bg-transparent focus:outline-none text-gray-700 dark:text-white/70"
                  value={form.memberName} onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))}>
                  {members.map(m => <option key={m.name}>{m.name}</option>)}
                </select>,
                <input key="date" type="date" required className="w-full glass-card !rounded-lg !overflow-visible px-2.5 py-1.5 text-xs bg-transparent focus:outline-none text-gray-700 dark:text-white/70"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />,
                <select key="type" className="w-full glass-card !rounded-lg !overflow-visible px-2.5 py-1.5 text-xs bg-transparent focus:outline-none text-gray-700 dark:text-white/70"
                  value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Vacation['type'] }))}>
                  {VACATION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>,
              ]}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-500 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-blue-600 transition-colors">등록</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-black/10 dark:border-white/15 text-gray-500 dark:text-white/50 rounded-lg py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5">취소</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/25 transition-colors">
              <Plus size={12} /> 휴가 등록
            </button>
          )}
        </div>
      </div>

      {/* Right: Stats + list */}
      <div className="space-y-3">
        {/* Annual remaining */}
        <div className="glass-card">
          <div className="px-4 py-3 border-b border-black/5 dark:border-white/8">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/80">{year}년 연간 잔여 현황</h3>
          </div>
          <div className="grid grid-cols-[1fr_80px_80px_80px] text-[11px] text-gray-400 dark:text-white/30 font-medium bg-black/2 dark:bg-white/3 border-b border-black/4 dark:border-white/6 px-4 py-2">
            <span>이름</span><span className="text-center">총 연차</span><span className="text-center">사용</span><span className="text-center">잔여</span>
          </div>
          {memberStats.map(({ name, role, used, remaining }) => (
            <div key={name} className="grid grid-cols-[1fr_80px_80px_80px] items-center px-4 py-3 border-b border-black/3 dark:border-white/5 last:border-0 hover:bg-black/2 dark:hover:bg-white/3 transition-colors">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${role === 'PL' ? 'bg-purple-400' : 'bg-blue-400'}`}>
                  {name.slice(0, 1)}
                </div>
                <span className="text-sm text-gray-700 dark:text-white/70">{name}</span>
              </div>
              <span className="text-center text-sm text-gray-600 dark:text-white/55">{ANNUAL_TOTAL}일</span>
              <span className="text-center text-sm text-amber-600 dark:text-amber-400 font-medium">{used}일</span>
              <div className="flex flex-col items-center gap-0.5">
                <span className={`text-sm font-semibold ${remaining <= 3 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{remaining}일</span>
                <div className="w-12 h-1 bg-black/6 dark:bg-white/10 rounded-full">
                  <div className={`h-1 rounded-full ${remaining <= 3 ? 'bg-red-400' : 'bg-green-400'}`}
                    style={{ width: `${Math.round((remaining / ANNUAL_TOTAL) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Monthly list */}
        <div className="glass-card">
          <div className="px-4 py-3 border-b border-black/5 dark:border-white/8">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white/80">{month + 1}월 휴가 내역</h4>
          </div>
          {monthVacations.length === 0 ? (
            <p className="text-xs text-gray-300 dark:text-white/20 text-center py-6">등록된 휴가 없음</p>
          ) : (
            <div className="divide-y divide-black/3 dark:divide-white/5">
              {monthVacations.sort((a, b) => a.date.localeCompare(b.date)).map(v => (
                <div key={v.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-black/2 dark:hover:bg-white/3 transition-colors">
                  <span className="text-xs text-gray-500 dark:text-white/40 w-12">{v.date.slice(5).replace('-', '/')}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-white/70 flex-1 px-2">{v.memberName}</span>
                  <span className="text-xs text-blue-500 dark:text-blue-400">{v.type}</span>
                  <span className="text-xs text-gray-400 dark:text-white/30 w-8 text-center">{v.days}일</span>
                  <button onClick={() => onDeleteVacation(v.id)} className="text-gray-200 dark:text-white/15 hover:text-red-400 transition-colors ml-2">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
