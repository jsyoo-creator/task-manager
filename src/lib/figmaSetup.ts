import type { Task } from '../types';

// 라이브 파트 '1차 기획서' 세부업무의 "Figma 세팅" 요청.
// 요청은 Firestore figmaSetupJobs/{폴더이름} 문서로 남기고, 디자이너 맥에서 도는 별도 프로그램이
// 'requested' 문서를 가져가 배너(카피 선반영)와 랜딩을 Figma에 세팅한 뒤 상태를 갱신한다.
// 문서 id를 폴더 이름으로 두어, 같은 업무명(그룹 상·하위 업무)끼리 상태를 같이 보고 중복 요청을 막는다.
export const FIGMA_SETUP_COLLECTION = 'figmaSetupJobs';

const TARGET_TEAM = '라이브/복지&사업자몰'; // 공백은 비교 전에 뺀다 (실제 팀 이름은 '라이브 / 복지&사업자몰')
const TARGET_PART = '라이브';
const TARGET_SUBTASK = '1차 기획서';

const squash = (s?: string) => (s ?? '').replace(/\s+/g, '');

// 세부업무 id는 재발급된 적이 있어 이름으로 찾는다
export function isFigmaSetupTarget(teamName: string | undefined, category: string | undefined, subTaskName: string): boolean {
  return squash(teamName) === squash(TARGET_TEAM) && squash(category) === squash(TARGET_PART) && squash(subTaskName) === squash(TARGET_SUBTASK);
}

// 업무명 "10/6 냉장고&세탁기" → 드라이브 폴더 "20261006_냉장고&세탁기".
// 연도는 방송일(endDate) → 월(taskMonth) → 시작일 순으로 정하고, 12월↔1월처럼 해가 넘어가면 보정한다.
export function folderNameFromTask(task: Pick<Task, 'title' | 'endDate' | 'taskMonth' | 'startDate'>): string | null {
  const m = (task.title ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const name = m[3].trim();
  if (month < 1 || month > 12 || day < 1 || day > 31 || !name || name.includes('/')) return null;
  const ref = [task.endDate, task.taskMonth, task.startDate].find(v => /^\d{4}-\d{2}/.test(v ?? ''));
  let year = ref ? Number(ref.slice(0, 4)) : new Date().getFullYear();
  if (ref) {
    const refMonth = Number(ref.slice(5, 7));
    if (refMonth - month > 6) year += 1;
    if (month - refMonth > 6) year -= 1;
  }
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}_${name}`;
}

export type FigmaSetupStatus = 'requested' | 'running' | 'done' | 'no_folder' | 'failed';

export interface FigmaSetupJob {
  id: string;            // = folderName
  folderName: string;
  status: FigmaSetupStatus;
  workplaceId?: string;
  teamId?: string;
  taskId: string;
  taskTitle: string;
  requestedBy: string;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  bannerUrl?: string;
  landingUrl?: string;
  message?: string;      // 실패 이유, 확인 필요 항목 요약
}
