import { useState } from 'react';
import type { Task, TaskStatus } from '../types';
import DatePicker from './DatePicker';
import { getWeekDays, getStartEndDayIdx, calcHoursInRange, calcReviewTotal } from '../lib/weeklyHours';

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const REVIEW_STATUSES = ['검수 전', '검수 중', '검수 완료'];

interface EditState {
  startDate: string;
  endDate: string;
  assignee: string;
  status: string;
  weeklyHours: Record<string, number>;
  substitute: string;
  substituteWeeklyHours: Record<string, number>;
}

interface Props {
  task: Task;
  subKey: string;
  /** PL 검수(review) 타입 세부업무에서, 체크된 개별 항목(검수 대상 업무)의 ID. 있으면 해당 항목의 날짜/상태/시간만 편집 */
  reviewItemId?: string;
  assignees: string[];
  canManage: boolean;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onClose: () => void;
}

const lbl = 'block text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wide';
const inp = 'w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#6C63FF]/40';

// 클릭한 세부업무 바로 아래에 펼쳐지는 인라인 편집 패널 (캘린더 인라인 카드와 동일한 데이터/계산식 공유)
export default function SubtaskQuickEditModal({ task, subKey, reviewItemId, assignees, canManage, onUpdateTask, onClose }: Props) {
  const entry = task.subTaskData?.[subKey] ?? { weeklyHours: {}, totalHours: 0 };
  const reviewDates = reviewItemId ? (entry.reviewDates ?? {})[reviewItemId] ?? {} : undefined;
  const reviewHours = reviewItemId ? (entry.reviewWeeklyHours ?? {})[reviewItemId] ?? {} : undefined;
  const reviewStatus = reviewItemId ? (entry.reviewStatus ?? {})[reviewItemId] ?? '검수 전' : undefined;

  const [editState, setEditState] = useState<EditState>(reviewItemId ? {
    startDate: reviewDates?.startDate ?? '',
    endDate: reviewDates?.endDate ?? '',
    assignee: '',
    status: reviewStatus ?? '검수 전',
    weeklyHours: { ...(reviewHours ?? {}) },
    substitute: '',
    substituteWeeklyHours: {},
  } : {
    startDate: entry.startDate ?? '',
    endDate: entry.endDate ?? '',
    assignee: entry.assignee ?? '',
    status: entry.status ?? '진행 전',
    weeklyHours: { ...(entry.weeklyHours ?? {}) },
    substitute: entry.substitute ?? '',
    substituteWeeklyHours: { ...(entry.substituteWeeklyHours ?? {}) },
  });
  const [hoursRaw, setHoursRaw] = useState<Record<string, string>>({});

  const handleSave = () => {
    if (!canManage) return;

    if (reviewItemId) {
      const nextReviewDates = { ...(entry.reviewDates ?? {}), [reviewItemId]: { startDate: editState.startDate || undefined, endDate: editState.endDate || undefined } };
      const nextReviewWeeklyHours = { ...(entry.reviewWeeklyHours ?? {}), [reviewItemId]: editState.weeklyHours };
      const nextReviewStatus = { ...(entry.reviewStatus ?? {}), [reviewItemId]: editState.status };
      const checkedItems = entry.checkedItems ?? [];
      const totalHours = calcReviewTotal(nextReviewWeeklyHours, nextReviewDates, checkedItems);
      onUpdateTask(task.id, {
        subTaskData: {
          ...task.subTaskData,
          [subKey]: {
            ...entry,
            reviewDates: nextReviewDates,
            reviewWeeklyHours: nextReviewWeeklyHours,
            reviewStatus: nextReviewStatus,
            totalHours,
          },
        },
      });
      onClose();
      return;
    }

    const totalHours = editState.startDate
      ? calcHoursInRange(editState.weeklyHours, editState.startDate, editState.endDate)
      : Object.values(editState.weeklyHours).reduce((a, b) => a + b, 0);
    const substituteTotalHours = editState.substitute
      ? (editState.startDate
          ? calcHoursInRange(editState.substituteWeeklyHours, editState.startDate, editState.endDate)
          : Object.values(editState.substituteWeeklyHours).reduce((a, b) => a + b, 0))
      : undefined;
    onUpdateTask(task.id, {
      subTaskData: {
        ...task.subTaskData,
        [subKey]: {
          ...task.subTaskData?.[subKey],
          startDate: editState.startDate,
          endDate: editState.endDate,
          assignee: editState.assignee,
          status: editState.status,
          weeklyHours: editState.weeklyHours,
          totalHours,
          substituteWeeklyHours: editState.substitute ? editState.substituteWeeklyHours : undefined,
          substituteTotalHours,
        },
      },
    });
    onClose();
  };

  const renderGrid = (
    hours: Record<string, number>,
    keyPrefix: string,
    editable: boolean,
    onCellChange: (key: string, n: number) => void,
    accentInput: string,
    accentText: string,
  ) => {
    const weeks = getWeekDays(editState.startDate, editState.endDate);
    const { startDayIdx, endDayIdx } = getStartEndDayIdx(editState.startDate, editState.endDate);
    return (
      <>
        <div className="grid grid-cols-[26px_repeat(5,1fr)] gap-x-1 mb-0.5">
          <span />
          {['월', '화', '수', '목', '금'].map(d => (
            <span key={d} className={`text-center text-[9px] font-medium ${accentText}`}>{d}</span>
          ))}
        </div>
        {weeks.map(({ weekLabel, days }, wi) => {
          const weekNum = wi + 1;
          const isLastWeek = wi === weeks.length - 1;
          return (
            <div key={wi} className="grid grid-cols-[26px_repeat(5,1fr)] gap-x-1 mb-0.5">
              <div className="flex flex-col items-center justify-center">
                <span className="text-[9px] font-semibold text-gray-500 leading-none">{weekNum}주</span>
                <span className="text-[8px] text-gray-400 leading-tight">{weekLabel}</span>
              </div>
              {days.map(({ date }, di) => {
                const key = `w${weekNum}d${di + 1}`;
                const rawKey = `${keyPrefix}_${key}`;
                const val = hours[key] ?? 0;
                const disabled = (wi === 0 && di < startDayIdx) || (isLastWeek && editState.endDate ? di > endDayIdx : false);
                return (
                  <div key={di} className="flex flex-col items-center gap-0.5">
                    <span className={`text-[8px] leading-none ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>{date}</span>
                    {editable && !disabled ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rawKey in hoursRaw ? hoursRaw[rawKey] : (val === 0 ? '' : String(val))}
                        placeholder="-"
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                          setHoursRaw(prev => ({ ...prev, [rawKey]: raw }));
                          onCellChange(key, Math.min(24, parseFloat(raw) || 0));
                        }}
                        className={`w-full rounded-md border px-0.5 py-1 text-[10px] text-center focus:outline-none focus:ring-1 ${accentInput}`}
                      />
                    ) : (
                      <span className={`w-full text-center text-[10px] rounded-md py-1 ${disabled ? 'bg-black/[0.02] text-gray-300' : 'bg-black/[0.05] text-gray-600'}`}>
                        {!disabled && val > 0 ? val : <span className="opacity-30">-</span>}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </>
    );
  };

  const total = editState.startDate
    ? calcHoursInRange(editState.weeklyHours, editState.startDate, editState.endDate)
    : Object.values(editState.weeklyHours).reduce((a, b) => a + b, 0);
  const subTotal = editState.startDate
    ? calcHoursInRange(editState.substituteWeeklyHours, editState.startDate, editState.endDate)
    : Object.values(editState.substituteWeeklyHours).reduce((a, b) => a + b, 0);

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="mt-1.5 mb-1 p-2.5 w-full max-w-[300px] rounded-xl border border-[#6C63FF]/15 bg-[#6C63FF]/[0.03] flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className={lbl}>시작일</label>
          <DatePicker
            value={editState.startDate}
            onChange={v => setEditState(st => ({ ...st, startDate: v }))}
            disabled={!canManage}
            btnClassName={inp}
          />
        </div>
        <div>
          <label className={lbl}>종료일</label>
          <DatePicker
            value={editState.endDate}
            onChange={v => setEditState(st => ({ ...st, endDate: v }))}
            disabled={!canManage}
            btnClassName={inp}
          />
        </div>
      </div>

      <div className={reviewItemId ? '' : 'grid grid-cols-2 gap-1.5'}>
        {!reviewItemId && (
          <div>
            <label className={lbl}>담당자</label>
            <select
              className={inp}
              value={editState.assignee}
              disabled={!canManage}
              onChange={e => setEditState(st => ({ ...st, assignee: e.target.value }))}
            >
              <option value="">선택</option>
              {assignees.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={lbl}>{reviewItemId ? '검수 상태' : '상태'}</label>
          <select
            className={inp}
            value={editState.status}
            disabled={!canManage}
            onChange={e => setEditState(st => ({ ...st, status: e.target.value }))}
          >
            {(reviewItemId ? REVIEW_STATUSES : STATUSES).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={lbl}>업무 시간 (h)</label>
        {!editState.startDate ? (
          <p className="text-[10px] text-gray-400 text-center py-1.5">시작일을 설정하면 업무시간을 입력할 수 있습니다</p>
        ) : (
          <>
            {renderGrid(
              editState.weeklyHours, subKey, canManage,
              (key, n) => setEditState(st => {
                const next = { ...st.weeklyHours };
                if (n === 0) delete next[key]; else next[key] = n;
                return { ...st, weeklyHours: next };
              }),
              'border-gray-200 bg-white text-gray-700 focus:ring-[#6C63FF]/40',
              'text-gray-400',
            )}
            <p className="text-[9px] text-gray-400 mt-0.5 text-right">합계 {total}h</p>
          </>
        )}
      </div>

      {!reviewItemId && editState.substitute && editState.startDate && (
        <div>
          <label className="block text-[10px] font-semibold text-orange-400 mb-0.5 uppercase tracking-wide">
            대무자 시간 ({editState.substitute})
          </label>
          {renderGrid(
            editState.substituteWeeklyHours, `${subKey}_sub`, canManage,
            (key, n) => setEditState(st => {
              const next = { ...st.substituteWeeklyHours };
              if (n === 0) delete next[key]; else next[key] = n;
              return { ...st, substituteWeeklyHours: next };
            }),
            'border-orange-200 bg-orange-50/70 text-orange-700 focus:ring-orange-400/40',
            'text-orange-300',
          )}
          <p className="text-[9px] text-orange-400 mt-0.5 text-right">합계 {subTotal}h</p>
        </div>
      )}

      <div className="flex gap-1.5 mt-0.5">
        <button
          onClick={onClose}
          className="flex-1 py-1.5 rounded-lg border border-black/10 text-[11px] text-gray-500 hover:bg-black/5 transition-colors"
        >{canManage ? '취소' : '닫기'}</button>
        {canManage && (
          <button
            onClick={handleSave}
            className="flex-1 py-1.5 rounded-lg bg-[#6C63FF] text-white text-[11px] font-semibold hover:bg-[#5b53e6] transition-colors"
          >저장</button>
        )}
      </div>
    </div>
  );
}
