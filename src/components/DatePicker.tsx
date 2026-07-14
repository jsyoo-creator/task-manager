import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useHolidayMap } from '../contexts/HolidaysContext';

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAY_LABELS = ['일','월','화','수','목','금','토'];

const cls = 'w-full rounded-xl px-3 py-2 text-sm bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all border border-transparent focus:border-blue-400/30';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** 인라인 모드: 버튼 대신 텍스트로 표시 (업무 목록용) */
  compact?: boolean;
  disabled?: boolean;
  /** 버튼 className 오버라이드 */
  btnClassName?: string;
  /** 버튼에 표시할 텍스트를 기본 "YY.MM.DD" 대신 직접 지정 (예: 메일 표의 "M/D(요일)") */
  displayLabel?: string;
}

export default function DatePicker({ value, onChange, compact, disabled, btnClassName, displayLabel }: Props) {
  const holidayMap = useHolidayMap();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  // 잘못된 날짜 문자열에서 NaN이 되지 않도록 안전하게 파싱
  const safeParseDate = (v: string): Date => {
    if (!v) return new Date();
    const d = new Date(v + 'T00:00:00');
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const parsed = safeParseDate(value ?? '');
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  // 값이 바뀌면 뷰도 맞춤
  useEffect(() => {
    if (value) {
      const d = safeParseDate(value);
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
  // YYYY-MM-DD 형식이면 YY.MM.DD 로 표시, 아니면 원본 값 그대로 표시
  const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
  const displayValue = displayLabel ?? (value
    ? isValidFormat
      ? `${value.slice(2,4)}.${value.slice(5,7)}.${value.slice(8,10)}`
      : value
    : '');

  const btnClass = compact
    ? 'w-full h-full flex items-center justify-center gap-1 text-xs text-gray-600 hover:text-blue-500 transition-colors cursor-pointer'
    : btnClassName
      ? `${btnClassName} flex items-center justify-between cursor-pointer`
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
        <span className={!displayValue && !compact ? 'text-gray-400' : ''}>
          {displayValue || (compact ? '-' : '날짜 선택')}
        </span>
        {!compact && <CalendarDays size={13} className="text-gray-400 flex-shrink-0 ml-2" />}
      </button>

      {open && createPortal(
        <div
          ref={popupRef}
          style={{ ...popupStyle, width: 240 }}
          className="!rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-white"
        >
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <button type="button" onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-semibold text-gray-700">
              {viewYear}년 {MONTH_LABELS[viewMonth]}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-7 px-2 pb-0.5">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
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
              const holidayName = holidayMap.get(dateStr);
              return (
                <button key={day} type="button" onClick={() => select(day)}
                  title={holidayName}
                  className={`relative text-[11px] py-1.5 rounded-lg font-medium transition-colors ${
                    isSelected ? 'bg-blue-500 text-white' :
                    isToday ? 'bg-blue-50 text-blue-600' :
                    holidayName ? 'text-red-500 hover:bg-red-50' :
                    'text-gray-700 hover:bg-gray-100'
                  }`}>
                  {day}
                  {holidayName && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                  )}
                </button>
              );
            })}
          </div>

          {value && (
            <div className="px-2 pb-2 pt-0.5 border-t border-gray-100">
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <X size={11} /> 날짜 지우기
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
