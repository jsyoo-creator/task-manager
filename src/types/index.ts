export type UserRole = 'superadmin' | 'manager' | 'user';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  createdAt: string;
}

export interface UserPermissions {
  canManageTasks: boolean;   // 업무 등록/수정/삭제
  canManageUsers: boolean;   // 사용자 권한 관리 (최고관리자만)
  canInputTime: boolean;     // 세부업무 시간/날짜 입력
  canAddVacation: boolean;   // 휴가 등록
}

export function getPermissions(role: UserRole): UserPermissions {
  return {
    canManageTasks: role === 'superadmin' || role === 'manager',
    canManageUsers: role === 'superadmin',
    canInputTime: true,
    canAddVacation: true,
  };
}

export type TaskStatus = '진행 전' | '진행 중' | '완료' | '보류';
export type TaskCategory = '라이브' | '복지' | '사업자' | '기타';
export type TaskType = '신규' | '기타' | '파생' | '기획';

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  category: TaskCategory;
  type: TaskType;
  status: TaskStatus;
  receiver: string;  // 접수자
  assignee: string;  // 담당자
  startDate: string;
  endDate: string;
  weeklyHours: Record<string, number>; // week1~week5
  totalHours: number;
  revisionLevel: number; // 0~6 (F1~F6)
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  category: TaskCategory;
  type: TaskType;
  status: TaskStatus;
  receiver: string;
  assignee: string;
  startDate: string;
  endDate: string;
  weeklyHours: Record<string, number>;
  totalHours: number;
  revisionLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  categories: TaskCategory[];
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  seatId: string;
  area: 'F' | 'K' | 'L';
  color: 'blue' | 'purple' | 'green' | 'yellow' | 'pink';
  weeklyTarget: number; // default 40
  createdAt: string;
}

export interface Vacation {
  id: string;
  memberId: string;
  memberName: string;
  date: string; // YYYY-MM-DD
  type: '연차' | '반차' | '오반반차' | '공온반차';
  days: number; // 1 or 0.5
  createdAt: string;
}
