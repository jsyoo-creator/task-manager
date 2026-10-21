import type { Task } from '../types';

// 라이브 파트 '1차 기획서' 세부업무의 "Figma 세팅" 요청.
// 요청은 Firestore figmaSetupJobs/{폴더이름} 문서로 남기고, 디자이너 맥에서 도는 별도 프로그램이
// 'requested' 문서를 가져가 배너(카피 선반영)와 상세페이지(Figma의 랜딩)를 세팅한 뒤 상태를 갱신한다.
// 화면에서는 '랜딩' 대신 '상세페이지'라고 부른다 (scope 값은 'landing' 그대로).
// 문서 id를 폴더 이름으로 두어, 같은 업무명(그룹 상·하위 업무)끼리 상태를 같이 보고 중복 요청을 막는다.
export const FIGMA_SETUP_COLLECTION = 'figmaSetupJobs';
// 드라이브 작업 폴더 목록. 웹은 드라이브를 볼 수 없어서, 맥 프로그램이 폴더 이름 목록을
// figmaSetupMeta/driveFolders { folders: string[], updatedAt } 문서 하나에 올려 두고(바뀔 때만 갱신) 화면은 이것만 구독한다.
export const FIGMA_SETUP_META_COLLECTION = 'figmaSetupMeta';
export const DRIVE_FOLDERS_DOC = 'driveFolders';

const TARGET_TEAM = '라이브/복지&사업자몰'; // 공백은 비교 전에 뺀다 (실제 팀 이름은 '라이브 / 복지&사업자몰')
const TARGET_PART = '라이브';
// 세부업무 이름 → 요청 종류. '1차 기획서'는 처음 세팅, '기획서 업데이트'는 바뀐 기획서 반영
// '기획 제작 소재 검수'는 검수 끝난 배너·상세페이지 이미지를 드라이브 02.디자인에 저장
// 디자인 탭 '페이지&배너&히든기획전 디자인'은 99_가이드의 배너 원본 이미지를 배너에 배치
const TARGET_SUBTASKS: Record<string, FigmaSetupKind> = { '1차기획서': 'initial', '기획서업데이트': 'update', '기획제작소재검수': 'save', '페이지&배너&히든기획전디자인': 'image' };

const squash = (s?: string) => (s ?? '').replace(/\s+/g, '');

// 세부업무 id는 재발급된 적이 있어 이름으로 찾는다
export function figmaSetupKind(teamName: string | undefined, category: string | undefined, subTaskName: string): FigmaSetupKind | null {
  if (squash(teamName) !== squash(TARGET_TEAM) || squash(category) !== squash(TARGET_PART)) return null;
  return TARGET_SUBTASKS[squash(subTaskName)] ?? null;
}

// 요청 문서 id — 처음 세팅은 폴더 이름 그대로(기존 문서와 호환), 기획서 업데이트는 따로 기록해 두 버튼 상태가 섞이지 않게 한다
export function figmaSetupDocId(folderName: string, kind: FigmaSetupKind): string {
  return kind === 'initial' ? folderName : `${folderName}__${kind}`;
}

// 종류별 화면 문구
export const FIGMA_SETUP_TEXT: Record<FigmaSetupKind, { request: string; running: string; done: string; again: string; failed: string; question: string; againQuestion: string; sub: string; againSub: string }> = {
  initial: { request: '세팅요청', running: '반영중', done: '세팅완료', again: '다시 세팅요청', failed: '세팅실패 · 다시 요청',
    question: '무엇을 세팅할까요?', againQuestion: '무엇을 다시 세팅할까요?',
    sub: '기획서 기준으로 Figma에 세팅해요', againSub: '지금 기획서 기준으로 다시 맞춰요 · Figma에서 지웠다면 새로 만들어요' },
  update: { request: '반영요청', running: '반영중', done: '반영완료', again: '다시 반영요청', failed: '반영실패 · 다시 요청',
    question: '업데이트된 기획서를 어디에 반영할까요?', againQuestion: '업데이트된 기획서를 어디에 다시 반영할까요?',
    sub: '지난번 반영한 기획서와 비교해 바뀐 글자만 Figma에 반영해요', againSub: '지난번 반영한 기획서와 비교해 바뀐 글자만 반영해요' },
  save: { request: '이미지 저장', running: '저장중', done: '저장완료', again: '다시 저장', failed: '저장실패 · 다시 요청',
    question: '어떤 이미지를 저장할까요?', againQuestion: '어떤 이미지를 다시 저장할까요?',
    sub: 'Figma에서 이미지로 내보내 드라이브 02.디자인에 저장해요', againSub: '지금 Figma 상태로 다시 저장해요 (같은 이름 파일은 덮어써요)' },
  image: { request: '배너에 이미지 반영', running: '반영중', done: '이미지 반영완료', again: '다시 이미지 반영', failed: '이미지 반영실패 · 다시 요청',
    question: '배너에 이미지를 반영할까요?', againQuestion: '배너에 이미지를 다시 반영할까요?',
    sub: '99_가이드의 banner_img로 배너 규격별 이미지 배치·텍스트 색·커버·BOX 색·상단 홍보 배경을 맞춰요', againSub: '지금 99_가이드의 이미지로 다시 맞춰요' },
};

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
// 무엇을 세팅할지 — 처음 요청은 둘 다, 다시 세팅요청 때 고를 수 있음
// draft = 시안 이미지만 (이미지 저장에서만, 드라이브 00_시안 폴더)
export type FigmaSetupScope = 'both' | 'banner' | 'landing' | 'draft';
export type FigmaSetupKind = 'initial' | 'update' | 'save' | 'image';
export const FIGMA_SETUP_SCOPE_LABEL: Record<FigmaSetupScope, string> = { both: '배너+상세페이지', banner: '배너만', landing: '상세페이지만', draft: '시안 이미지' };

export interface FigmaSetupJob {
  id: string;            // = folderName
  folderName: string;
  status: FigmaSetupStatus;
  scope?: FigmaSetupScope; // 없으면 both
  kind?: FigmaSetupKind;   // 없으면 initial
  planVersion?: string;    // 반영에 쓴 기획서 버전 (예: v2.0)
  planFile?: string;
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
