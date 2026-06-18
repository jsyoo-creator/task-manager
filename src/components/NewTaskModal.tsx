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
    onSubmit({
      ...form,
      projectId,
      weeklyHours: {},
      totalHours: 0,
    });
    setForm({ title: '', category: '라이브', type: '신규', status: '진행 전', receiver: ASSIGNEES[0], assignee: ASSIGNEES[0], startDate: '', endDate: '', revisionLevel: 0 });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">새 업무 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">업무명 *</label>
            <input
              required
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="업무명을 입력하세요"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">구분</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as TaskCategory }))}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">유형</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as TaskType }))}
              >
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">접수자</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.receiver}
                onChange={e => setForm(f => ({ ...f, receiver: e.target.value }))}
              >
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">담당자</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.assignee}
                onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
              >
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">상태</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" className="flex-1 bg-blue-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-600">
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
