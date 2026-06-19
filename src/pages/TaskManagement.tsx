import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { Task, SubTask, TaskStatus, TaskCategory, TaskType, TeamPart, BuiltinFieldConfig, TeamFormConfig } from '../types';
import { TABLE_FIELD_KEYS, resolveBuiltinFields } from '../types';
import NewTaskModal from '../components/NewTaskModal';
import CategoryTabs from '../components/CategoryTabs';

interface Props {
  tasks: Task[];
  onAddTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onOpenDetail: (id: string) => void;
  projectId: string;
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  canManage: boolean;
  parts?: TeamPart[];
  assignees?: string[];
  formConfig?: TeamFormConfig;
  builtinFields?: BuiltinFieldConfig[];
}

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];

const CAT_DOT: Record<string, string> = {
  '라이브': 'bg-red-500', '복지': 'bg-orange-400', '사업자': 'bg-indigo-500', '기타': 'bg-gray-400',
};
const STATUS_BG: Record<TaskStatus, string> = {
  '진행 전': 'bg-blue-100 dark:bg-blue-500/15',
  '진행 중': 'bg-amber-100 dark:bg-amber-500/15',
  '완료': 'bg-green-100 dark:bg-green-500/15',
  '보류': 'bg-slate-200 dark:bg-white/8',
};
const STATUS_TEXT: Record<TaskStatus, string> = {
  '진행 전': 'text-blue-600 dark:text-blue-400',
  '진행 중': 'text-amber-600 dark:text-amber-400',
  '완료': 'text-green-600 dark:text-green-400',
  '보류': 'text-slate-600 dark:text-slate-400',
};

const now = new Date();
const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function buildCols(tableFields: BuiltinFieldConfig[]): string {
  const cols: string[] = [];
  for (const fc of tableFields) {
    if (fc.key === 'title') {
      cols.push('minmax(120px, 1fr)');
    } else if (fc.key === 'weeklyHours') {
      cols.push(...Array(5).fill(`${fc.width}px`), '52px');
    } else {
      cols.push(`${fc.width}px`);
    }
  }
  cols.push('28px');
  return cols.join(' ');
}

// 헤더와 데이터 행이 동일한 minWidth를 가져야 1fr 컬럼이 일치함
function buildMinWidth(tableFields: BuiltinFieldConfig[]): number {
  let w = 0;
  let colCount = 0;
  for (const fc of tableFields) {
    if (fc.key === 'title') { w += 120; colCount++; }
    else if (fc.key === 'weeklyHours') { w += fc.width * 5 + 52; colCount += 6; }
    else { w += fc.width; colCount++; }
  }
  w += 28; colCount++; // delete 컬럼
  w += (colCount - 1) * 12; // gap-x-3
  w += 24; // px-3 양쪽
  return w;
}

const HEADER_LABEL: Partial<Record<string, string>> = {
  title: '업무', category: '파트', type: '유형', status: '상태', receiver: '접수자', assignee: '담당자', startDate: '시작', endDate: '종료',
};

export default function TaskManagement({ tasks, onAddTask, onUpdateTask, onDeleteTask, onOpenDetail, projectId, activeCategory, onCategoryChange, canManage, parts, assignees = [], formConfig, builtinFields: propBuiltinFields }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState(now.getFullYear());
  const [monthFilter, setMonthFilter] = useState(now.getMonth() + 1);
  const [assigneeFilter, setAssigneeFilter] = useState('전체');

  const builtinFields = propBuiltinFields ?? resolveBuiltinFields(formConfig);
  const tableFields = builtinFields.filter(fc => fc.enabled && TABLE_FIELD_KEYS.includes(fc.key));
  const colTemplate = buildCols(tableFields);
  const colMinWidth = buildMinWidth(tableFields);

  const filtered = tasks.filter((t: Task) => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (assigneeFilter !== '전체' && t.assignee !== assigneeFilter) return false;
    if (monthFilter > 0) {
      const prefix = `${yearFilter}-${String(monthFilter).padStart(2, '0')}`;
      return t.startDate?.startsWith(prefix) || t.endDate?.startsWith(prefix);
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title">업무 관리</h1>
          <p className="page-subtitle">업무 목록 · {filtered.length}건</p>
        </div>
        <div className="flex items-center gap-3">
          <CategoryTabs active={activeCategory} onChange={onCategoryChange} parts={parts} />
          {canManage && (
            <button onClick={() => setModalOpen(true)}
              className="btn-shiny-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold">
              <Plus size={14} /> 새 업무
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <FilterSelect label="연도" value={yearFilter} onChange={v => setYearFilter(Number(v))}>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </FilterSelect>
        <FilterSelect label="월" value={monthFilter} onChange={v => setMonthFilter(Number(v))}>
          <option value={0}>전체</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}월{m === now.getMonth() + 1 ? ' ●' : ''}</option>)}
        </FilterSelect>
        <FilterSelect label="담당자" value={assigneeFilter} onChange={v => setAssigneeFilter(v)}>
          <option>전체</option>
          {assignees.map(a => <option key={a}>{a}</option>)}
        </FilterSelect>
        <div className="flex-1" />
        <span className="text-xs text-gray-400 dark:text-white/30">총 {filtered.length}건</span>
      </div>

      <div className="glass-card-noclip overflow-x-auto">
        {/* 헤더 */}
        <div className="grid gap-x-3 text-[11px] text-gray-500 dark:text-white/50 font-semibold bg-black/3 dark:bg-white/5 border-b border-black/5 dark:border-white/8 px-3 py-2.5"
          style={{ gridTemplateColumns: colTemplate, minWidth: colMinWidth }}>
          {tableFields.flatMap(fc => {
            if (fc.key === 'title') return [
              <span key="title" className="pl-3.5 text-gray-500 dark:text-white/50">
                {fc.customLabel ?? HEADER_LABEL.title}
              </span>,
            ];
            if (fc.key === 'weeklyHours') {
              return [
                ...['1주','2주','3주','4주','5주'].map(w => <span key={`h-${w}`} className="text-center">{w}</span>),
                <span key="h-total" className="text-center">합계</span>,
              ];
            }
            return [
              <div key={fc.key} className="flex items-center select-none pl-2">
                <span>{fc.customLabel ?? HEADER_LABEL[fc.key]}</span>
              </div>,
            ];
          })}
          <span />
        </div>

        {filtered.length === 0 && (
          <div className="py-14 text-center text-sm text-gray-400 dark:text-white/30">등록된 업무가 없습니다</div>
        )}

        {filtered.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
            onOpenDetail={() => onOpenDetail(task.id)}
            canManage={canManage}
            assignees={assignees}
            tableFields={tableFields}
            colTemplate={colTemplate}
            colMinWidth={colMinWidth}
          />
        ))}
      </div>

      <NewTaskModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={onAddTask}
        projectId={projectId} parts={parts} assignees={assignees} formConfig={formConfig} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: {
  label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 glass-card !rounded-lg !overflow-visible px-2.5 py-1.5 text-xs">
      <span className="text-gray-500 dark:text-white/50 font-medium">{label}</span>
      <select className="bg-transparent border-none focus:outline-none text-gray-800 dark:text-white/78 font-semibold cursor-pointer text-xs"
        value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

function TaskRow({ task, onUpdate, onDelete, onOpenDetail, canManage, assignees, tableFields, colTemplate, colMinWidth }: {
  task: Task;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onOpenDetail: () => void;
  canManage: boolean;
  assignees: string[];
  tableFields: BuiltinFieldConfig[];
  colTemplate: string;
  colMinWidth: number;
}) {

  const totalH = Object.values(task.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
  const sel = "bg-transparent border-none focus:outline-none cursor-pointer text-xs w-full";

  return (
    <div className="border-b border-black/4 dark:border-white/6 last:border-0">
      <div className="grid gap-x-3 items-center px-3 py-3.5 hover:bg-black/3 dark:hover:bg-white/4 text-sm transition-colors"
        style={{ gridTemplateColumns: colTemplate, minWidth: colMinWidth }}>

        {tableFields.flatMap(fc => {
          if (fc.key === 'title') return [
            <button key="title" onClick={onOpenDetail}
              className="flex items-center gap-1.5 min-w-0 pr-2 group/title text-left w-full">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CAT_DOT[task.category] ?? 'bg-gray-400'}`} />
              <span className="font-semibold text-gray-800 dark:text-white/85 truncate group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 transition-colors">{task.title}</span>
            </button>,
          ];
          if (fc.key === 'category') return [
            <span key="category" className="text-xs truncate">
              <span className={`inline-flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_DOT[task.category] ?? 'bg-gray-400'}`} />
                <span className="text-gray-700 dark:text-white/65 truncate">{task.category}</span>
              </span>
            </span>
          ];
          if (fc.key === 'type') return [
            <select key="type" className={`${sel} text-gray-700 dark:text-white/65`} value={task.type}
              onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })} onClick={e => e.stopPropagation()}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          ];
          if (fc.key === 'status') return [
            <div key="status" onClick={e => e.stopPropagation()}
              className={`relative flex items-center justify-between w-full rounded-full pl-2 pr-2 py-0.5 cursor-pointer ${STATUS_BG[task.status]}`}>
              <span className={`text-xs font-medium whitespace-nowrap ${STATUS_TEXT[task.status]}`}>{task.status}</span>
              <ChevronDown size={10} className={STATUS_TEXT[task.status]} />
              <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={task.status} onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          ];
          if (fc.key === 'receiver') return [
            <select key="receiver" className={`${sel} text-gray-600 dark:text-white/58`} value={task.receiver}
              onChange={e => onUpdate(task.id, { receiver: e.target.value })} onClick={e => e.stopPropagation()}>
              {assignees.map(a => <option key={a}>{a}</option>)}
            </select>
          ];
          if (fc.key === 'assignee') return [
            <select key="assignee" className={`${sel} text-gray-700 dark:text-white/72`} value={task.assignee}
              onChange={e => onUpdate(task.id, { assignee: e.target.value })} onClick={e => e.stopPropagation()}>
              {assignees.map(a => <option key={a}>{a}</option>)}
            </select>
          ];
          if (fc.key === 'startDate') return [<span key="startDate" className="text-xs text-gray-600 dark:text-white/55">{task.startDate?.slice(5).replace('-', '.') ?? '-'}</span>];
          if (fc.key === 'endDate')   return [<span key="endDate" className="text-xs text-gray-600 dark:text-white/55">{task.endDate?.slice(5).replace('-', '.') ?? '-'}</span>];
          if (fc.key === 'weeklyHours') return [
            ...[1,2,3,4,5].map(w => {
              const h = task.weeklyHours?.[`week${w}`] ?? 0;
              return (
                <div key={`w${w}`} className="flex justify-center">
                  {h > 0
                    ? <span className="text-xs text-green-600 dark:text-green-400 font-medium">{h}h</span>
                    : <span className="text-xs text-gray-400 dark:text-white/15">-</span>}
                </div>
              );
            }),
            <span key="total" className="text-center text-xs font-semibold text-gray-700 dark:text-white/60">{totalH > 0 ? `${totalH}h` : '-'}</span>
          ];
          return [];
        })}

        {canManage
          ? <button onClick={() => onDelete(task.id)} className="flex items-center justify-center text-gray-400 dark:text-white/25 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
          : <span />}
      </div>
    </div>
  );
}

function SubTaskRow({ sub, onDelete, tableFields, colTemplate }: {
  sub: SubTask; onDelete: () => void;
  tableFields: BuiltinFieldConfig[];
  colTemplate: string;
}) {
  const totalH = Object.values(sub.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
  const SUB_STATUS: Record<string, string> = {
    '진행 전': 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/15',
    '진행 중': 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/15',
    '완료': 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-500/15',
    '보류': 'text-slate-600 bg-slate-200 dark:text-slate-400 dark:bg-white/8',
  };
  return (
    <div className="grid gap-x-3 items-center pl-6 pr-3 py-2 border-b border-black/3 dark:border-white/5 last:border-0 min-w-max"
      style={{ gridTemplateColumns: colTemplate }}>
      {tableFields.flatMap(fc => {
        if (fc.key === 'title') return [
          <span key="title" className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="text-gray-300 dark:text-white/20 text-[10px] mr-0.5">└</span>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_DOT[sub.category] ?? 'bg-gray-300'}`} />
            <span className="text-xs text-gray-700 dark:text-white/65 truncate">{sub.title}</span>
          </span>
        ];
        if (fc.key === 'category')  return [
          <span key="category" className="text-xs truncate">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_DOT[sub.category] ?? 'bg-gray-300'}`} />
              <span className="text-gray-500 dark:text-white/40 truncate">{sub.category}</span>
            </span>
          </span>
        ];
        if (fc.key === 'type')      return [<span key="type" className="text-xs text-gray-400 dark:text-white/35">{sub.type}</span>];
        if (fc.key === 'status')    return [<span key="status" className={`text-xs font-medium px-1.5 py-0.5 rounded-full w-fit whitespace-nowrap ${SUB_STATUS[sub.status]}`}>{sub.status}</span>];
        if (fc.key === 'receiver')  return [<span key="receiver" className="text-xs text-gray-400 dark:text-white/35">{sub.receiver}</span>];
        if (fc.key === 'assignee')  return [<span key="assignee" className="text-xs text-gray-600 dark:text-white/55">{sub.assignee}</span>];
        if (fc.key === 'startDate') return [<span key="startDate" className="text-xs text-gray-400 dark:text-white/35">{sub.startDate?.slice(5).replace('-', '.') ?? '-'}</span>];
        if (fc.key === 'endDate')   return [<span key="endDate" className="text-xs text-gray-400 dark:text-white/35">{sub.endDate?.slice(5).replace('-', '.') ?? '-'}</span>];
        if (fc.key === 'weeklyHours') return [
          ...[1,2,3,4,5].map(w => {
            const h = sub.weeklyHours?.[`week${w}`] ?? 0;
            return (
              <div key={`w${w}`} className="flex justify-center">
                {h > 0
                  ? <span className="text-xs text-green-500 dark:text-green-400">{h}h</span>
                  : <span className="text-xs text-gray-400 dark:text-white/20">-</span>}
              </div>
            );
          }),
          <span key="total" className="text-center text-xs text-gray-500 dark:text-white/40">{totalH > 0 ? `${totalH}h` : '-'}</span>
        ];
        return [];
      })}
      <span />
      <button onClick={onDelete} className="flex items-center justify-center text-gray-400 dark:text-white/25 hover:text-red-400 transition-colors">
        <Trash2 size={11} />
      </button>
    </div>
  );
}
