export type TaskStatus = '진행 전' | '진행 중' | '완료';
export type TaskCategory = '기획' | '디자인' | '개발' | '라이브' | '복지' | '사업자' | '기타';

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  assignee: string;
  startDate: string;
  endDate: string;
  weeklyHours: Record<string, number>;
  difficulty: string;
  isFeasible: boolean;
  rejectionDate?: string;
  revisionCount: number;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  assignee: string;
  startDate: string;
  endDate: string;
  weeklyHours: Record<string, number>;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  categories: string[];
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  role: string;
}
