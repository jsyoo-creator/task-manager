import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_META_COLLECTION } from '../lib/figmaSetup';

// 맥 프로그램이 올려 두는 작업 순서 — 지금 처리 중인 요청과 기다리는 요청 (figmaSetupMeta/queue 문서 하나).
// 여러 명이 한꺼번에 누르지 않게 요청 팝업·요청대기 칩에서 '지금 누구 요청 진행 중, 대기 N번째'를 보여 준다.
// 운영은 맥이 2분마다 조회하므로 방금 누른 요청은 최대 2분 늦게 목록에 잡힌다.
export interface QueueItem {
  collection: string;   // figmaSetupJobs | planDrafts
  id: string;           // 요청 문서 id
  taskTitle: string;
  requestedBy: string;
  kind: string;         // 세팅 · 반영 · 이미지 반영 · 이미지 저장 · 기획서 작성
  requestedAt: string;
  startedAt?: string;
}
export interface JobQueue {
  running: (QueueItem & { other?: boolean }) | null;   // other: 다른 환경(개발기 테스트 등) 작업이라 누구 건지 숨김
  waiting: QueueItem[];
  otherWaiting?: number;
  updatedAt?: string;
}

export function useJobQueue(enabled: boolean) {
  const [queue, setQueue] = useState<JobQueue | null | undefined>(undefined);   // undefined = 읽는 중, null = 아직 없음
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      doc(db, FIGMA_SETUP_META_COLLECTION, 'queue'),
      snap => setQueue(snap.exists() ? (snap.data() as JobQueue) : null),
      () => setQueue(null),
    );
  }, [enabled]);
  return queue;
}

// 진행 중 요청을 사람이 읽는 문구로 ("유재성 PL '11/2 냉장고&쿠킹' 세팅")
export const runningLabel = (run: JobQueue['running']) =>
  !run ? '' : run.other ? '다른 요청' : `${run.requestedBy || '누군가'} '${run.taskTitle}' ${run.kind}`;

// 내 요청이 대기열 몇 번째인지 (진행 중 1건 포함). 목록에 없으면 null — 아직 맥이 못 가져갔거나 이미 시작됨.
export function queuePosition(q: JobQueue | null | undefined, collection: string, id: string): number | null {
  if (!q) return null;
  const i = (q.waiting ?? []).findIndex(w => w.collection === collection && w.id === id);
  return i < 0 ? null : (q.running ? 1 : 0) + i + 1;
}
