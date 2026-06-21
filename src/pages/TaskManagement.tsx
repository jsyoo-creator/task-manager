import { useState, useRef } from 'react';
import { ChevronDown, Plus, Trash2, GripVertical, Copy, Info, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Task, SubTask, TaskStatus, TaskCategory, TaskType, TeamPart, BuiltinFieldConfig, TeamFormConfig, Department, StatusConfig, MetaField, ExcelFieldConfig } from '../types';
import { TABLE_FIELD_KEYS, resolveBuiltinFields, BUILTIN_FIELDS_META, resolveStatusConfigs, DEFAULT_META_FIELDS, resolveFieldDepts } from '../types';
import NewTaskModal from '../components/NewTaskModal';
import CategoryTabs from '../components/CategoryTabs';
import DatePicker from '../components/DatePicker';
import ConfirmDialog from '../components/ConfirmDialog';

interface Props {
  tasks: Task[];
  onAddTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onOpenDetail: (id: string) => void;
  projectId: string;
  activeCategory: TaskCategory | 'all';
  onCategoryChange: (cat: TaskCategory | 'all') => void;
  canManage: boolean;
  parts?: TeamPart[];
  assignees?: string[];
  teamMembers?: { name: string; department?: Department }[];
  formConfig?: TeamFormConfig;
  builtinFields?: BuiltinFieldConfig[];
  metaFields?: MetaField[];
  currentUserName?: string;
  canSeeAll?: boolean;
  userPhotoMap?: Map<string, string>;
  excelConfig?: ExcelFieldConfig[];
  allMetaFields?: MetaField[];
}

const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];

const CAT_DOT: Record<string, string> = {
  '라이브': 'bg-red-500', '복지': 'bg-orange-400', '사업자': 'bg-indigo-500', '기타': 'bg-gray-400',
};
const STATUS_BG: Record<TaskStatus, string> = {
  '진행 전': 'bg-blue-100',
  '진행 중': 'bg-amber-100',
  '완료': 'bg-green-100',
  '보류': 'bg-slate-200',
};
const STATUS_TEXT: Record<TaskStatus, string> = {
  '진행 전': 'text-blue-600',
  '진행 중': 'text-amber-600',
  '완료': 'text-green-600',
  '보류': 'text-slate-600',
};

const now = new Date();
const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function buildCols(tableFields: BuiltinFieldConfig[]): string {
  const cols: string[] = ['18px']; // drag handle
  for (const fc of tableFields) {
    if (fc.key === 'title') {
      cols.push('minmax(120px, 1fr)');
    } else if (fc.key === 'weeklyHours') {
      cols.push('52px');
    } else {
      cols.push(`${fc.width}px`);
    }
  }
  cols.push('110px'); // expand + copy + delete
  return cols.join(' ');
}

function buildMinWidth(tableFields: BuiltinFieldConfig[]): number {
  let w = 18; // drag handle
  let colCount = 1;
  for (const fc of tableFields) {
    if (fc.key === 'title') { w += 120; colCount++; }
    else if (fc.key === 'weeklyHours') { w += 52; colCount++; }
    else { w += fc.width; colCount++; }
  }
  w += 110; colCount++; // expand + copy + delete
  w += (colCount - 1) * 12; // gap-x-3
  w += 24; // px-3 양쪽
  return w;
}

const HEADER_LABEL: Partial<Record<string, string>> = {
  taskMonth: '월', title: '업무', category: '파트', type: '유형', status: '상태', receiver: '접수자', assignee: '담당자', startDate: '시작', endDate: '종료',
};

export default function TaskManagement({ tasks, onAddTask, onUpdateTask, onDeleteTask, onOpenDetail, projectId, activeCategory, onCategoryChange, canManage, parts, assignees = [], teamMembers, formConfig, builtinFields: propBuiltinFields, metaFields: teamMetaFields, currentUserName = '', canSeeAll = false, userPhotoMap, excelConfig, allMetaFields }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState(now.getFullYear());
  const [monthFilter, setMonthFilter] = useState(now.getMonth() + 1);
  const [assigneeFilter, setAssigneeFilter] = useState('전체');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{ rows: Partial<Task>[]; dupes: number[] } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const builtinFields = propBuiltinFields ?? resolveBuiltinFields(formConfig);

  // 엑셀 컬럼 매핑 (label → key)
  const excelFields = excelConfig?.filter(f => f.enabled).sort((a, b) => a.order - b.order) ?? [];
  const labelToKey = Object.fromEntries(excelFields.map(f => [f.label, f.key]));

  // customLabel 반영 — 폼설정에서 명칭 변경 시 엑셀 컬럼도 동기화
  const bLabel = (key: string, fallback: string) =>
    builtinFields.find(f => f.key === key)?.customLabel ?? fallback;

  const builtinLabels: Record<string, string> = {
    taskMonth: bLabel('taskMonth', '월'),
    title:     bLabel('title', '업무명'),
    category:  bLabel('category', '파트'),
    type:      bLabel('type', '유형'),
    status:    bLabel('status', '상태'),
    receiver:  bLabel('receiver', '접수자'),
    assignee:  bLabel('assignee', '담당자'),
    startDate: bLabel('startDate', '시작일'),
    endDate:   bLabel('endDate', '종료일'),
  };

  const getExcelHeaders = () =>
    excelFields.length > 0
      ? excelFields.map(f => f.label)
      : Object.values(builtinLabels);

  const taskToRow = (t: Task): Record<string, string> => {
    if (excelFields.length > 0) {
      const row: Record<string, string> = {};
      excelFields.forEach(f => {
        const bLabel = builtinLabels[f.key];
        if (bLabel !== undefined) {
          const val: Record<string, string | undefined> = {
            taskMonth: t.taskMonth, title: t.title, category: t.category,
            type: t.type, status: t.status, receiver: t.receiver,
            assignee: t.assignee, startDate: t.startDate, endDate: t.endDate,
          };
          row[f.label] = val[f.key] ?? '';
        } else {
          row[f.label] = t.customFields?.[f.key] ?? '';
        }
      });
      return row;
    }
    return Object.fromEntries(
      Object.entries(builtinLabels).map(([key, label]) => {
        const val: Record<string, string | undefined> = {
          taskMonth: t.taskMonth, title: t.title, category: t.category,
          type: t.type, status: t.status, receiver: t.receiver,
          assignee: t.assignee, startDate: t.startDate, endDate: t.endDate,
        };
        return [label, val[key] ?? ''];
      })
    );
  };

  const handleExcelExport = () => {
    const rows = filtered.map(taskToRow);
    const ws = XLSX.utils.json_to_sheet(rows, { header: getExcelHeaders() });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '업무목록');
    XLSX.writeFile(wb, `업무목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const parsed: Partial<Task>[] = rows.map(row => {
        const get = (label: string) => {
          // excelConfig label 우선, 없으면 builtinLabels 역방향 매핑
          if (labelToKey[label] !== undefined) return row[label] ?? '';
          return row[label] ?? '';
        };
        const keyMap = excelFields.length > 0
          ? Object.fromEntries(excelFields.map(f => [f.key, row[f.label] ?? '']))
          : Object.fromEntries(Object.entries(builtinLabels).map(([key, label]) => [key, row[label] ?? '']));

        const customFields: Record<string, string> = {};
        if (excelFields.length > 0) {
          excelFields.forEach(f => {
            if (!builtinLabels[f.key]) customFields[f.key] = row[f.label] ?? '';
          });
        }

        return {
          title: String(keyMap.title ?? get('업무명') ?? '').trim(),
          taskMonth: String(keyMap.taskMonth ?? get('월') ?? '').trim(),
          category: String(keyMap.category ?? get('파트') ?? '').trim() as TaskCategory,
          type: String(keyMap.type ?? get('유형') ?? '신규').trim() as TaskType,
          status: String(keyMap.status ?? get('상태') ?? '진행 전').trim() as TaskStatus,
          receiver: String(keyMap.receiver ?? get('접수자') ?? '').trim(),
          assignee: String(keyMap.assignee ?? get('담당자') ?? '').trim(),
          startDate: String(keyMap.startDate ?? get('시작일') ?? '').trim(),
          endDate: String(keyMap.endDate ?? get('종료일') ?? '').trim(),
          ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
        };
      }).filter(r => r.title);

      const existingTitles = new Set(tasks.map(t => t.title.trim()));
      const dupes = parsed.map((r, i) => existingTitles.has(r.title ?? '') ? i : -1).filter(i => i >= 0);
      setImportPreview({ rows: parsed, dupes: new Set(dupes) as unknown as number[] });
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    const dupeSet = new Set(importPreview.dupes);
    const toAdd = importPreview.rows.filter((_, i) => !dupeSet.has(i));
    const bottom = tasks.reduce((max, t) => Math.max(max, t.sortOrder ?? -1), -1);
    for (let i = 0; i < toAdd.length; i++) {
      const r = toAdd[i];
      await onAddTask({
        projectId, teamId: '',
        title: r.title ?? '', taskMonth: r.taskMonth ?? '',
        category: (r.category as TaskCategory) || (parts?.[0]?.name as TaskCategory) || '' as TaskCategory,
        type: (r.type as TaskType) || '신규',
        status: (r.status as TaskStatus) || '진행 전',
        receiver: r.receiver ?? '', assignee: r.assignee ?? '',
        startDate: r.startDate ?? '', endDate: r.endDate ?? '',
        weeklyHours: {}, totalHours: 0, revisionLevel: 0,
        sortOrder: bottom + 1 + i,
        ...(r.customFields ? { customFields: r.customFields } : {}),
      });
    }
    setImportPreview(null);
  };

  const tableFields = builtinFields.filter(fc => fc.enabled && TABLE_FIELD_KEYS.includes(fc.key));
  const statusConfigs = resolveStatusConfigs(formConfig);
  const colTemplate = buildCols(tableFields);
  const colMinWidth = buildMinWidth(tableFields);

  const handleDrop = (dropOnId: string) => {
    if (!dragId || dragId === dropOnId) { setDragId(null); setDragOverId(null); return; }
    const ids = filtered.map(t => t.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(dropOnId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newIds = [...ids];
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, dragId);
    newIds.forEach((id, idx) => onUpdateTask(id, { sortOrder: idx }));
    setDragId(null);
    setDragOverId(null);
  };

  const bottomSortOrder = () =>
    tasks.reduce((max, t) => Math.max(max, t.sortOrder ?? -1), -1) + 1;

  const handleCopyTask = (task: Task) => {
    const idx = tasks.findIndex(t => t.id === task.id);
    tasks.forEach((t, i) => { if (t.sortOrder !== i) onUpdateTask(t.id, { sortOrder: i }); });
    onAddTask({
      projectId: task.projectId,
      teamId: task.teamId,
      taskMonth: task.taskMonth,
      category: task.category,
      title: task.title,
      type: '신규',
      status: '진행 전',
      receiver: task.receiver,
      assignee: task.assignee,
      startDate: '',
      endDate: '',
      weeklyHours: {},
      totalHours: 0,
      revisionLevel: 0,
      sortOrder: idx + 0.5,
    });
  };

  const handleAddTask = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    onAddTask({ ...data, sortOrder: bottomSortOrder() }).catch((e: unknown) => {
      alert(`업무 등록 실패: ${e instanceof Error ? e.message : String(e)}`);
    });
  };

  const filtered = tasks.filter((t: Task) => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (!canSeeAll && t.assignee !== currentUserName) return false;
    if (canSeeAll && assigneeFilter !== '전체' && t.assignee !== assigneeFilter) return false;
    if (monthFilter > 0) {
      const prefix = `${yearFilter}-${String(monthFilter).padStart(2, '0')}`;
      if (t.taskMonth) return t.taskMonth === prefix;
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
        <div className="flex items-center gap-2">
          <CategoryTabs active={activeCategory} onChange={onCategoryChange} parts={parts} />
          <button onClick={handleExcelExport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={13} /> 엑셀 내보내기
          </button>
          {canManage && (
            <>
              <button onClick={() => importRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                <Upload size={13} /> 엑셀 업무 등록
              </button>
              <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
              <button onClick={() => setModalOpen(true)}
                className="btn-shiny-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold">
                <Plus size={14} /> 새 업무
              </button>
            </>
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
        {canSeeAll && (
          <FilterSelect label="담당자" value={assigneeFilter} onChange={v => setAssigneeFilter(v)}>
            <option>전체</option>
            {assignees.map(a => <option key={a}>{a}</option>)}
          </FilterSelect>
        )}
        <div className="flex-1" />
        <span className="text-xs text-gray-400">총 {filtered.length}건</span>
      </div>

      <div className="glass-card-noclip overflow-x-auto">
        {/* 헤더 */}
        <div className="grid gap-x-3 text-[11px] text-gray-500 font-semibold bg-black/3 border-b border-black/5 px-3 py-2.5"
          style={{ gridTemplateColumns: colTemplate, minWidth: colMinWidth }}>
          <span key="drag-h" />
          {tableFields.flatMap(fc => {
            const hLabel = fc.customLabel ?? BUILTIN_FIELDS_META.find(m => m.key === fc.key)?.label ?? HEADER_LABEL[fc.key];
            if (fc.key === 'title') return [
              <span key="title" className="pl-3.5 text-gray-500">{hLabel}</span>,
            ];
            if (fc.key === 'weeklyHours') {
              return [<span key="h-total" className="text-center">합계</span>];
            }
            return [
              <div key={fc.key} className="flex items-center select-none pl-2">
                <span>{hLabel}</span>
              </div>,
            ];
          })}
          <span />
        </div>

        {filtered.length === 0 && (
          <div className="py-14 text-center text-sm text-gray-400">등록된 업무가 없습니다</div>
        )}

        {filtered.map(task => {
          const taskPart = parts?.find(p => p.name === task.category);
          const resolvedMetaFields = taskPart?.metaFields ?? teamMetaFields ?? DEFAULT_META_FIELDS;
          return (
            <TaskRow
              key={task.id}
              task={task}
              onUpdate={onUpdateTask}
              onDelete={onDeleteTask}
              onDeleteRequest={(id, title) => setPendingDelete({ id, title })}
              onOpenDetail={() => onOpenDetail(task.id)}
              onCopy={() => handleCopyTask(task)}
              canManage={canManage}
              assignees={assignees}
              teamMembers={teamMembers}
              tableFields={tableFields}
              statusConfigs={statusConfigs}
              colTemplate={colTemplate}
              colMinWidth={colMinWidth}
              metaFields={resolvedMetaFields}
              isDragging={dragId === task.id}
              isDragOver={dragOverId === task.id}
              expanded={expandedId === task.id}
              onToggleExpand={() => setExpandedId(prev => prev === task.id ? null : task.id)}
              onDragStart={() => setDragId(task.id)}
              onDragOver={() => setDragOverId(task.id)}
              onDrop={() => handleDrop(task.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              userPhotoMap={userPhotoMap}
            />
          );
        })}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        taskTitle={pendingDelete?.title ?? ''}
        onConfirm={() => { onDeleteTask(pendingDelete!.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />

      <NewTaskModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleAddTask}
        projectId={projectId} parts={parts} assignees={assignees} teamMembers={teamMembers} formConfig={formConfig} />

      {/* 엑셀 가져오기 미리보기 모달 */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-800">엑셀 업무 등록 미리보기</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  총 {importPreview.rows.length}건 · 중복 {importPreview.dupes.length}건 제외 · <span className="text-green-600 font-medium">{importPreview.rows.length - importPreview.dupes.length}건 등록 예정</span>
                </p>
              </div>
              <button onClick={() => setImportPreview(null)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-3 space-y-1.5">
              {importPreview.rows.map((row, i) => {
                const isDupe = (importPreview.dupes as unknown as Set<number>).has(i);
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${isDupe ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDupe ? 'bg-red-400' : 'bg-green-400'}`} />
                    <span className="font-medium flex-1 truncate">{row.title}</span>
                    {row.assignee && <span className="text-gray-400">{row.assignee}</span>}
                    {isDupe && <span className="text-red-400 text-[10px] font-semibold">중복</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setImportPreview(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button onClick={handleImportConfirm}
                disabled={importPreview.rows.length - importPreview.dupes.length === 0}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-colors">
                {importPreview.rows.length - importPreview.dupes.length}건 등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: {
  label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 glass-card !rounded-lg !overflow-visible px-2.5 py-1.5 text-xs">
      <span className="text-gray-500 font-medium">{label}</span>
      <select className="bg-transparent border-none focus:outline-none text-gray-800 font-semibold cursor-pointer text-xs"
        value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

function MiniAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  if (!name) return null;
  return photoURL
    ? <img src={photoURL} alt={name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
    : <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-300 to-purple-400 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">{name.slice(0, 1)}</div>;
}

function TaskRow({ task, onUpdate, onDelete, onDeleteRequest, onOpenDetail, onCopy, canManage, assignees, teamMembers, tableFields, statusConfigs, colTemplate, colMinWidth, metaFields, isDragging, isDragOver, expanded, onToggleExpand, onDragStart, onDragOver, onDrop, onDragEnd, userPhotoMap }: {
  task: Task;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onDeleteRequest: (id: string, title: string) => void;
  onOpenDetail: () => void;
  onCopy: () => void;
  canManage: boolean;
  assignees: string[];
  teamMembers?: { name: string; department?: Department }[];
  tableFields: BuiltinFieldConfig[];
  statusConfigs: StatusConfig[];
  colTemplate: string;
  colMinWidth: number;
  metaFields?: MetaField[];
  isDragging: boolean;
  isDragOver: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  userPhotoMap?: Map<string, string>;
}) {
  const filledMeta = (metaFields ?? []).filter(f => task.customFields?.[f.key]);

  const totalH = (() => {
    if (task.subTaskData && Object.keys(task.subTaskData).length > 0) {
      return Object.values(task.subTaskData).reduce((sum, e) => {
        const h = e.totalHours > 0
          ? e.totalHours
          : Object.values(e.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
        return sum + h;
      }, 0);
    }
    return task.totalHours > 0
      ? task.totalHours
      : Object.values(task.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
  })();
  const sel = "bg-transparent border-none focus:outline-none cursor-pointer text-xs w-full pl-0";

  return (
    <div
      className={`border-b border-black/4 last:border-0 transition-all ${isDragOver ? 'border-t-2 border-[#6C63FF]' : ''}`}
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(); }}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
    >
      <div className={`grid gap-x-3 items-center px-3 py-3.5 hover:bg-gray-50 text-sm transition-colors ${isDragging ? 'opacity-40' : ''}`}
        style={{ gridTemplateColumns: colTemplate, minWidth: colMinWidth }}>

        {/* 드래그 핸들 */}
        <div className="flex items-center justify-center text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing">
          <GripVertical size={13} />
        </div>

        {tableFields.flatMap(fc => {
          if (fc.key === 'title') return [
            <button key="title" onClick={onOpenDetail}
              className="flex items-center gap-1.5 min-w-0 pr-2 group/title text-left w-full">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CAT_DOT[task.category] ?? 'bg-gray-400'}`} />
              <span className="text-xs font-semibold text-gray-800 truncate group-hover/title:text-blue-600 transition-colors">{task.title}</span>
            </button>,
          ];
          if (fc.key === 'category') return [
            <span key="category" className="text-xs truncate">
              <span className={`inline-flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_DOT[task.category] ?? 'bg-gray-400'}`} />
                <span className="text-gray-700 truncate">{task.category}</span>
              </span>
            </span>
          ];
          if (fc.key === 'type') {
            const typeOpts = (fc.customType === 'select' && fc.options?.length) ? fc.options : TYPES as string[];
            const typeColor = fc.optionColors?.[task.type];
            if (typeColor) return [
              <div key="type" onClick={e => e.stopPropagation()}
                className="relative flex items-center justify-between w-full rounded-full pl-2 pr-1.5 py-0.5 cursor-pointer"
                style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                <span className="text-xs font-medium whitespace-nowrap">{task.type}</span>
                <ChevronDown size={10} />
                <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  value={task.type} onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })}>
                  {typeOpts.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            ];
            return [
              <select key="type" className={`${sel} text-gray-700`} value={task.type}
                onChange={e => onUpdate(task.id, { type: e.target.value as TaskType })} onClick={e => e.stopPropagation()}>
                {typeOpts.map(t => <option key={t}>{t}</option>)}
              </select>
            ];
          }
          if (fc.key === 'status') {
            // 커스텀 드롭다운 옵션이 있으면 우선 사용
            if (fc.customType === 'select' && fc.options?.length) {
              const custColor = fc.optionColors?.[task.status];
              if (custColor) return [
                <div key="status" onClick={e => e.stopPropagation()}
                  className="relative flex items-center justify-between w-full rounded-full pl-2 pr-1.5 py-0.5 cursor-pointer"
                  style={{ backgroundColor: custColor.bg, color: custColor.text }}>
                  <span className="text-xs font-medium whitespace-nowrap">{task.status}</span>
                  <ChevronDown size={10} />
                  <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={task.status} onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                    {fc.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ];
              return [
                <select key="status" className={`${sel} text-gray-700`} value={task.status}
                  onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })} onClick={e => e.stopPropagation()}>
                  {fc.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ];
            }
            const sc = statusConfigs.find(s => s.key === task.status) ?? statusConfigs[0];
            const scLabel = sc?.label ?? task.status;
            return [
              <div key="status" onClick={e => e.stopPropagation()}
                className="relative flex items-center justify-between w-full rounded-full pl-2 pr-2 py-0.5 cursor-pointer"
                style={{ backgroundColor: sc?.bg, color: sc?.text }}>
                <span className="text-xs font-medium whitespace-nowrap">{scLabel}</span>
                <ChevronDown size={10} />
                <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  value={task.status} onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}>
                  {statusConfigs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            ];
          }
          if (fc.key === 'receiver') {
            const rdepts = resolveFieldDepts(fc);
            const base = rdepts && teamMembers?.length
              ? (teamMembers.filter(m => m.department && rdepts.includes(m.department)).map(m => m.name) || assignees)
              : assignees;
            const ropts = base.includes(task.receiver) ? base : (task.receiver ? [task.receiver, ...base] : base);
            return [
              <div key="receiver" className="relative flex items-center gap-1 min-w-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                <MiniAvatar name={task.receiver} photoURL={userPhotoMap?.get(task.receiver)} />
                <span className="text-xs text-gray-600 truncate">{task.receiver || '-'}</span>
                <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={task.receiver}
                  onChange={e => onUpdate(task.id, { receiver: e.target.value })}>
                  <option value="">-</option>
                  {ropts.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            ];
          }
          if (fc.key === 'assignee') {
            const adepts = resolveFieldDepts(fc);
            const base = adepts && teamMembers?.length
              ? (teamMembers.filter(m => m.department && adepts.includes(m.department)).map(m => m.name) || assignees)
              : assignees;
            const aopts = base.includes(task.assignee) ? base : (task.assignee ? [task.assignee, ...base] : base);
            return [
              <div key="assignee" className="relative flex items-center gap-1 min-w-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                <MiniAvatar name={task.assignee} photoURL={userPhotoMap?.get(task.assignee)} />
                <span className="text-xs text-gray-700 truncate">{task.assignee || '-'}</span>
                <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={task.assignee}
                  onChange={e => onUpdate(task.id, { assignee: e.target.value })}>
                  <option value="">-</option>
                  {aopts.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            ];
          }
          if (fc.key === 'taskMonth') return [
            <div key="taskMonth" onClick={e => e.stopPropagation()}>
              {canManage ? (
                <select className="bg-transparent border-none focus:outline-none cursor-pointer text-xs text-gray-600 w-full"
                  value={task.taskMonth ?? ''}
                  onChange={e => onUpdate(task.id, { taskMonth: e.target.value })}>
                  <option value="">-</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    const year = task.taskMonth?.slice(0, 4) ?? new Date().getFullYear().toString();
                    return <option key={i} value={`${year}-${m}`}>{i + 1}월</option>;
                  })}
                </select>
              ) : (
                <span className="text-xs text-gray-600">
                  {task.taskMonth ? `${parseInt(task.taskMonth.slice(5))}월` : '-'}
                </span>
              )}
            </div>
          ];
          if (fc.key === 'startDate') return [
            <div key="startDate" onClick={e => e.stopPropagation()}>
              <DatePicker compact value={task.startDate ?? ''} onChange={v => onUpdate(task.id, { startDate: v })} disabled={!canManage} />
            </div>
          ];
          if (fc.key === 'endDate') return [
            <div key="endDate" onClick={e => e.stopPropagation()}>
              <DatePicker compact value={task.endDate ?? ''} onChange={v => onUpdate(task.id, { endDate: v })} disabled={!canManage} />
            </div>
          ];
          if (fc.key === 'weeklyHours') return [
            <span key="total" className="text-center text-xs font-semibold text-gray-700">{totalH > 0 ? `${totalH}h` : '-'}</span>
          ];
          return [];
        })}

        <div className="flex items-center justify-end gap-2 border-l border-gray-100 pl-3">
          <button onClick={e => { e.stopPropagation(); onToggleExpand(); }}
            title="업무 정보"
            className={`flex items-center justify-center px-2 py-1 rounded-md transition-all border ${
              expanded
                ? 'bg-[#6C63FF]/10 text-[#6C63FF] border-[#6C63FF]/30'
                : 'bg-white text-gray-400 border-gray-200 hover:border-[#6C63FF]/40 hover:text-[#6C63FF]'
            }`}>
            <Info size={11} />
          </button>
          {canManage && <>
            <button onClick={e => { e.stopPropagation(); onCopy(); }}
              title="복사"
              className="flex items-center justify-center px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-[#6C63FF] hover:border-[#6C63FF]/30 transition-all">
              <Copy size={11} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDeleteRequest(task.id, task.title); }}
              title="삭제"
              className="flex items-center justify-center px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-red-400 hover:border-red-200 transition-all">
              <Trash2 size={11} />
            </button>
          </>}
        </div>
      </div>

      {expanded && (
        <div className="border-l-2 border-[#6C63FF]/25 bg-[#6C63FF]/[0.03] border-b border-black/5" style={{ minWidth: colMinWidth }}>
          {filledMeta.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex divide-x divide-gray-100 min-w-max pl-8">
                {filledMeta.map(f => {
                  const val = task.customFields![f.key];
                  return (
                    <div key={f.key} className="flex flex-col px-5 py-3 shrink-0">
                      <span className="text-[10px] text-gray-400 font-medium mb-1">{f.label}</span>
                      {f.isUrl ? (
                        <a href={val} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700 max-w-[220px] truncate">
                          {val}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-800 font-medium max-w-[180px] truncate">{val}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="px-8 py-3">
              <span className="text-xs text-gray-400">업무 정보 없음</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubTaskRow({ sub, onDelete, tableFields, colTemplate, userPhotoMap }: {
  sub: SubTask; onDelete: () => void;
  tableFields: BuiltinFieldConfig[];
  colTemplate: string;
  userPhotoMap?: Map<string, string>;
}) {
  const totalH = Object.values(sub.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
  const SUB_STATUS: Record<string, string> = {
    '진행 전': 'text-blue-600 bg-blue-100',
    '진행 중': 'text-amber-600 bg-amber-100',
    '완료': 'text-green-600 bg-green-100',
    '보류': 'text-slate-600 bg-slate-200',
  };
  return (
    <div className="grid gap-x-3 items-center pl-6 pr-3 py-2 border-b border-black/3 last:border-0 min-w-max"
      style={{ gridTemplateColumns: colTemplate }}>
      {tableFields.flatMap(fc => {
        if (fc.key === 'title') return [
          <span key="title" className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="text-gray-300 text-[10px] mr-0.5">└</span>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_DOT[sub.category] ?? 'bg-gray-300'}`} />
            <span className="text-xs text-gray-700 truncate">{sub.title}</span>
          </span>
        ];
        if (fc.key === 'category')  return [
          <span key="category" className="text-xs truncate">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_DOT[sub.category] ?? 'bg-gray-300'}`} />
              <span className="text-gray-500 truncate">{sub.category}</span>
            </span>
          </span>
        ];
        if (fc.key === 'type')      return [<span key="type" className="text-xs text-gray-400">{sub.type}</span>];
        if (fc.key === 'status')    return [<span key="status" className={`text-xs font-medium px-1.5 py-0.5 rounded-full w-fit whitespace-nowrap ${SUB_STATUS[sub.status]}`}>{sub.status}</span>];
        if (fc.key === 'receiver')  return [<span key="receiver" className="flex items-center gap-px"><MiniAvatar name={sub.receiver} photoURL={userPhotoMap?.get(sub.receiver)} /><span className="text-xs text-gray-400 truncate">{sub.receiver}</span></span>];
        if (fc.key === 'assignee')  return [<span key="assignee" className="flex items-center gap-px"><MiniAvatar name={sub.assignee} photoURL={userPhotoMap?.get(sub.assignee)} /><span className="text-xs text-gray-600 truncate">{sub.assignee}</span></span>];
        if (fc.key === 'startDate') return [<span key="startDate" className="text-xs text-gray-400">{sub.startDate?.slice(5).replace('-', '.') ?? '-'}</span>];
        if (fc.key === 'endDate')   return [<span key="endDate" className="text-xs text-gray-400">{sub.endDate?.slice(5).replace('-', '.') ?? '-'}</span>];
        if (fc.key === 'weeklyHours') return [
          ...[1,2,3,4,5].map(w => {
            const h = sub.weeklyHours?.[`week${w}`] ?? 0;
            return (
              <div key={`w${w}`} className="flex justify-center">
                {h > 0
                  ? <span className="text-xs text-green-500">{h}h</span>
                  : <span className="text-xs text-gray-400">-</span>}
              </div>
            );
          }),
          <span key="total" className="text-center text-xs text-gray-500">{totalH > 0 ? `${totalH}h` : '-'}</span>
        ];
        return [];
      })}
      <span />
      <button onClick={onDelete} className="flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors">
        <Trash2 size={11} />
      </button>
    </div>
  );
}
