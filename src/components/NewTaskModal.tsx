import { useState } from 'react';
import { X } from 'lucide-react';
import type { Task, TaskCategory, TaskStatus, TaskType } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  projectId: string;
}

const CATEGORIES: TaskCategory[] = ['라이브', '복지', '사업자', '기타'];
const TYPES: TaskType[] = ['신규', '기타', '파생', '기획'];
const STATUSES: TaskStatus[] = ['진행 전', '진행 중', '완료', '보류'];
const ASSIGNEES = ['유재성 PL', '윤혜림 님', '탁세현 님', '김도은 님', '윤다영 님', '정소희 PL', '한수진 님', '고아현 님', '김동주 님'];

const inputCls = "w-full bg-black/4 dark:bg-white/8 border border-black/8 dark:border-white/12 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder-gray-400 dark:placeholder-white/25 transition-all";
const labelCls = "block text-xs font-medium text-gray-500 dark:text-white/40 mb-1";

export default function NewTaskModal({ open, onClose, onSubmit, projectId }: Props) {
  const [form, setForm] = useState({
    title: '',
    category: '라이브' as TaskCategory,
    type: '신규' as TaskType,
    status: '진행 전' as TaskStatus,
    receiver: ASSIGNEES[0],
    assignee: ASSIGNEES[0],
    startDate: '',
    endDate: '',
    revisionLevel: 0,
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, projectId, weeklyHours: {}, totalHours: 0 });
    setForm({ title: '', category: '라이브', type: '신규', status: '진행 전', receiver: ASSIGNEES[0], assignee: ASSIGNEES[0], startDate: '', endDate: '', revisionLevel: 0 });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card !rounded-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white/85">새 업무 등록</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60 transition-colors">
            <X size={17} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className={labelCls}>업무명 *</label>
            <input required type="text" className={inputCls} placeholder="업무명을 입력하세요"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>구분</label>
              <select className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as TaskCategory }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>유형</label>
              <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as TaskType }))}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>접수자</label>
              <select className={inputCls} value={form.receiver} onChange={e => setForm(f => ({ ...f, receiver: e.target.value }))}>
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>담당자</label>
              <select className={inputCls} value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}>
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>상태</label>
            <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>시작일</label>
              <input type="date" className={inputCls} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>종료일</label>
              <input type="date" className={inputCls} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-black/10 dark:border-white/12 rounded-xl py-2.5 text-sm font-medium text-gray-600 dark:text-white/50 hover:bg-black/4 dark:hover:bg-white/5 transition-colors">
              취소
            </button>
            <button type="submit"
              className="btn-shiny-primary flex-1 py-2.5 text-sm font-semibold">
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
