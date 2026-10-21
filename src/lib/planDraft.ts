import type { BannerCopies } from './planTools/bannerCopy';

// 라이브 파트 '1차 기획서' 세부업무의 "1차 기획서 만들기".
// 화면에서 배너 카피·상세페이지(판촉 워싱본) 내용을 정리해 Firestore planDrafts/{폴더이름} 문서로 남기면,
// 디자이너 맥에서 도는 별도 프로그램이 'requested' 문서를 가져가 기획서 PPT를 만든 뒤 상태를 갱신한다.
// 문서 id = 폴더 이름(예: "20261027_10월 결산") — Figma 세팅 요청(figmaSetupJobs)과 같은 규칙.
// ※ 맥 프로그램이 이 모양에 맞춰 읽으므로 필드 이름·값을 바꿀 때는 그쪽과 같이 바꾼다.
export const PLAN_DRAFT_COLLECTION = 'planDrafts';
export const PLAN_HISTORY_MAX = 20;

export type PlanDraftStatus = 'requested' | 'running' | 'done' | 'failed';
// 이번 요청이 바꾸는 범위 — 화면에서는 '상세'라고 부른다 (값은 figmaSetup과 같은 'landing')
export type PlanScope = 'banner' | 'landing' | 'both';
export const PLAN_SCOPE_LABEL: Record<PlanScope, string> = { banner: '배너', landing: '상세', both: '둘 다' };
export const scopeHasBanner = (s: PlanScope) => s === 'banner' || s === 'both';
export const scopeHasLanding = (s: PlanScope) => s === 'landing' || s === 'both';

export interface PlanDraftBanner {
  kvMain: string;
  kvSub: string;
  liveDate: string;        // 'YYYY-MM-DD'
  liveTime: string;        // '오후 8시' (직접입력이면 입력한 그대로)
  product: string;
  shortName: string;
  discount: string;        // 카피에 들어가는 혜택 문구 (예: '최대 13% 할인')
  broadcastType: string;   // '라이브' | '재방송' (방송 썸네일·SNS·인사이더 2줄 앞부분)
  copies: BannerCopies;    // 사람이 고친 최종 카피 — 키별 { pc?: 줄[], mo?: 줄[] } (위→아래)
}
// Firestore는 배열 안의 배열을 못 담아서, 원본 obsCards([코드, 메인, 서브, URL][])는 객체 배열로 바꿔 저장한다
export interface PlanDraftLanding {
  raw: string;
  structured: {
    notify: { gift: string; count: string; deadline: string };
    liveItems: { benefit: string; condition: string; tag: string; detailLines: string[] }[];
    obsCards: { code: string; mainTitle: string; subTitle: string; url: string }[];
    paymentFullText: string;
    legalNotes: string;
  };
  previewText: string;
}
export interface PlanHistoryEntry { at: string; by: string; scope: PlanScope; fileName: string }

export interface PlanDraft {
  id: string;              // = folderName
  folderName: string;
  taskId: string;
  taskTitle: string;
  workplaceId: string;
  teamId: string;
  status: PlanDraftStatus;
  message: string;
  requestedBy: string;
  requestedAt: string;
  finishedAt?: string;
  scope: PlanScope;
  fileName: string;        // .pptx 없이
  version: string;         // 파일 이름에서 뽑은 버전 (예: 'v1.1', 없으면 '')
  mode: 'create' | 'update';
  baseFile?: string;       // update일 때 지난번 결과 파일 (.pptx 포함)
  outputFile?: string;     // 맥 프로그램이 완료 때 채움 (fileName + '.pptx')
  banner?: PlanDraftBanner;
  landing?: PlanDraftLanding;
  history?: PlanHistoryEntry[];
}

// ── 파일 이름 · 버전 ──
const VERSION_RE = /_v(\d+(?:\.\d+)*)/gi;

// "…_HSAD_v1.1_261021" → "v1.1" (여러 개면 마지막)
export function versionFromFileName(name: string): string {
  const all = [...(name ?? '').matchAll(VERSION_RE)];
  return all.length ? `v${all[all.length - 1][1]}` : '';
}


const yymmdd = (d: Date) => `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

// 처음 만들 때 기본 파일 이름 — "20261027_10월 결산" → "LGE.COM 라이브커머스_10월결산_HSAD_v1.0_261027"
// 끝 날짜는 업무명(폴더) 날짜를 쓴다 (2026-10-22 사용자 요청). 폴더 이름에 날짜가 없을 때만 오늘 날짜.
export function defaultPlanFileName(folderName: string, today = new Date()): string {
  const name = folderName.replace(/^\d{8}_/, '').replace(/\s+/g, '');
  const date = folderName.match(/^\d{8}/)?.[0].slice(2) ?? yymmdd(today);
  return `LGE.COM 라이브커머스_${name}_HSAD_v1.0_${date}`;
}

// 사용자가 붙인 .pptx는 떼고 앞뒤 공백 정리
export const cleanFileName = (s: string) => s.trim().replace(/\.pptx$/i, '').trim();
export const INVALID_FILE_CHARS = /[\\/:*?"<>|]/;

// 폴더 이름 "20261027_…" → 방송일 { year, text: '10/27' }
export function liveDateFromFolder(folderName: string): { year: number; text: string } | null {
  const m = folderName.match(/^(\d{4})(\d{2})(\d{2})_/);
  if (!m) return null;
  return { year: Number(m[1]), text: `${Number(m[2])}/${Number(m[3])}` };
}
