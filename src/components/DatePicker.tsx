import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAY_LABELS = ['일','월','화','수','목','금','토'];

const cls = 'w-full rounded-xl px-3 py-2 text-sm bg-black/5 dark:bg-white/8 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all border border-transparent focus:border-blue-400/30';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** 인라인 모드: 버튼 대신 텍스트로 표시 (업무 목록용) */
  compact?: boolean;
  disabled?: boolean;
}

export default function DatePicker({ value, onChange, compact, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  // 값이 바뀌면 뷰도 맞춤
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popupRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const popH = popupRef.current.offsetHeight;
    const popW = popupRef.current.offsetWidth;
    const spaceBelow = window.innerHeight - btn.bottom - 8;
    const top = spaceBelow >= popH ? btn.bottom + 6 : Math.max(8, btn.top - popH - 6);
    const left = btn.left + popW > window.innerWidth - 8 ? Math.max(8, btn.right - popW) : btn.left;
    setPopupStyle({ position: 'fixed', top, left, zIndex: 9999, visibility: 'visible' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const select = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const displayValue = value ? `${value.slice(2,4)}.${value.slice(5,7)}.${value.slice(8,10)}` : '';

  const btnClass = compact
    ? 'flex items-center gap-1 text-xs text-gray-600 dark:text-white/55 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer'
    : `${cls} flex items-center justify-between cursor-pointer`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={btnClass}
      >
        <span className={!displayValue && !compact ? 'text-gray-400 dark:text-white/25' : ''}>
          {displayValue || (compact ? '-' : '날짜 선택')}
        </span>
        {!compact && <CalendarDays size={13} className="text-gray-400 dark:text-white/35 flex-shrink-0 ml-2" />}
      </button>

      {open && createPortal(
        <div
          ref={popupRef}
          style={{ ...popupStyle, width: 240 }}
          className="!rounded-2xl overflow-hidden shadow-2xl border border-white/10 dark:border-white/8 bg-white dark:bg-[#1e1f2e]"
        >
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <button type="button" onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/8 dark:hover:bg-white/10 text-gray-500 dark:text-white/50 transition-colors">
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-semibold text-gray-700 dark:text-white/80">
              {viewYear}년 {MONTH_LABELS[viewMonth]}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/8 dark:hover:bg-white/10 text-gray-500 dark:text-white/50 transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-7 px-2 pb-0.5">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500 dark:text-white/50'}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 px-2 pb-2.5 gap-0.5">
            {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              return (
                <button key={day} type="button" onClick={() => select(day)}
                  className={`text-[11px] py-1.5 rounded-lg font-medium transition-colors ${
                    isSelected ? 'bg-blue-500 text-white' :
                    isToday ? 'bg-blue-50 dark:bg-blue-500/25 text-blue-600 dark:text-blue-300' :
                    'text-gray-700 dark:text-white/85 hover:bg-black/8 dark:hover:bg-white/12'
                  }`}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
