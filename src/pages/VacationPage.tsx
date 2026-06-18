import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { Vacation } from '../types';
import type { Member } from '../types';

interface Props {
  vacations: Vacation[];
  members: Member[];
  onAddVacation: (data: Omit<Vacation, 'id' | 'createdAt'>) => void;
  onDeleteVacation: (id: string) => void;
}

const VACATION_TYPES: Vacation['type'][] = ['연차', '반차', '오반반차', '공온반차'];
const VACATION_DAYS: Record<Vacation['type'], number> = {
  '연차': 1,
  '반차': 0.5,
  '오반반차': 0.5,
  '공온반차': 0.5,
};
const ANNUAL_TOTAL = 15;

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function VacationPage({ vacations, members, onAddVacation, onDeleteVacation }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    memberName: members[0]?.name ?? '',
    date: '',
    type: '연차' as Vacation['type'],
  });

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const monthVacations = useMemo(() =>
    vacations.filter(v => v.date.startsWith(monthPrefix)),
    [vacations, monthPrefix]
  );

  const vacationDays = useMemo(() => {
    const map: Record<string, Vacation[]> = {};
    monthVacations.forEach(v => {
      map[v.date] = map[v.date] ?? [];
      map[v.date].push(v);
    });
    return map;
  }, [monthVacations]);

  const memberStats = useMemo(() => {
    return members.map(m => {
      const used = vacations
        .filter(v => v.memberName === m.name && v.date.startsWith(`${year}`))
        .reduce((acc, v) => acc + v.days, 0);
      return { name: m.name, used, remaining: Math.max(0, ANNUAL_TOTAL - used) };
    });
  }, [members, vacations, year]);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.memberName) return;
    const member = members.find(m => m.name === form.memberName);
    onAddVacation({
      memberId: member?.id ?? '',
      memberName: form.memberName,
      date: form.date,
      type: form.type,
      days: VACATION_DAYS[form.type],
    });
    setForm(f => ({ ...f, date: '' }));
    setShowForm(false);
  };

  return (
    <div className="grid grid-cols-[340px_1fr] gap-4 items-start">
      {/* Left: Mini Calendar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-gray-800">{year}년 {month + 1}월</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-gray-50">
          {DAYS.map((d, i) => (
            <div key={d} className={`text-center py-1.5 text-[10px] font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 p-1">
          {cells.map((day, idx) => {
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
            const dayVacs = day ? (vacationDays[dateStr] ?? []) : [];
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isWeekend = idx % 7 === 0 || idx % 7 === 6;

            return (
              <div key={idx} className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs relative ${
                !day ? '' : dayVacs.length > 0 ? 'bg-blue-50' : ''
              }`}>
                {day && (
                  <>
                    <span className={`text-[11px] font-medium ${isToday ? 'bg-blue-500 text-white w-5 h-5 flex items-center justify-center rounded-full' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                      {day}
                    </span>
                    {dayVacs.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayVacs.slice(0, 3).map((_, i) => (
                          <span key={i} className="w-1 h-1 rounded-full bg-blue-400" />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Add vacation button */}
        <div className="p-3 border-t border-gray-50">
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              <select
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                value={form.memberName}
                onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))}
              >
                {members.map(m => <option key={m.name}>{m.name}</option>)}
              </select>
              <input
                type="date"
                required
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
              <select
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as Vacation['type'] }))}
              >
                {VACATION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-500 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-blue-600">등록</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-1.5 text-xs hover:bg-gray-50">취소</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100"
            >
              <Plus size={12} /> 휴가 등록
            </button>
          )}
        </div>
      </div>

      {/* Right: Annual remaining table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">{year}년 연간 잔여 현황</h3>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_80px_80px_80px] text-xs text-gray-400 font-medium bg-gray-50 border-b border-gray-100 px-4 py-2">
          <span>이름</span>
          <span className="text-center">총 연차</span>
          <span className="text-center">사용</span>
          <span className="text-center">잔여</span>
        </div>

        {memberStats.map(({ name, used, remaining }) => (
          <div key={name} className="grid grid-cols-[1fr_80px_80px_80px] items-center px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                members.find(m => m.name === name)?.role === 'PL' ? 'bg-purple-400' : 'bg-blue-400'
              }`}>
                {name.slice(0, 1)}
              </div>
              <span className="text-sm text-gray-700">{name}</span>
            </div>
            <span className="text-center text-sm text-gray-600">{ANNUAL_TOTAL}일</span>
            <span className="text-center text-sm text-amber-600 font-medium">{used}일</span>
            <div className="flex flex-col items-center">
              <span className={`text-sm font-semibold ${remaining <= 3 ? 'text-red-500' : 'text-green-600'}`}>{remaining}일</span>
              <div className="w-12 h-1 bg-gray-100 rounded-full mt-0.5">
                <div
                  className={`h-1 rounded-full ${remaining <= 3 ? 'bg-red-400' : 'bg-green-400'}`}
                  style={{ width: `${Math.round((remaining / ANNUAL_TOTAL) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Recent vacations list */}
        <div className="border-t border-gray-100 px-4 py-3">
          <h4 className="text-xs font-medium text-gray-500 mb-2">{month + 1}월 휴가 내역</h4>
          {monthVacations.length === 0 ? (
            <p className="text-xs text-gray-300 text-center py-3">등록된 휴가 없음</p>
          ) : (
            <div className="space-y-1.5">
              {monthVacations.sort((a, b) => a.date.localeCompare(b.date)).map(v => (
                <div key={v.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{v.date.slice(5).replace('-', '/')}</span>
                  <span className="font-medium text-gray-700">{v.memberName}</span>
                  <span className="text-blue-500">{v.type}</span>
                  <span className="text-gray-400">{v.days}일</span>
                  <button onClick={() => onDeleteVacation(v.id)} className="text-gray-200 hover:text-red-400 ml-2">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
