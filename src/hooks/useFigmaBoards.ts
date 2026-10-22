import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_META_COLLECTION, FIGMA_BOARDS_DOC } from '../lib/figmaSetup';

// 월별 Figma 판 링크 — 배너판 / 상세페이지판. 월마다 새 판을 쓰기 때문에 사람이 등록한다.
// 읽기 사용량을 아끼려고 문서 하나(figmaSetupMeta/boards)에 월별로 모아 둔다 (driveFolders와 같은 방식).
export interface FigmaBoard {
  banner?: string;
  landing?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export function useFigmaBoards(enabled: boolean) {
  const [boards, setBoards] = useState<Record<string, FigmaBoard> | null>(null);   // 아직 안 읽혔으면 null

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      doc(db, FIGMA_SETUP_META_COLLECTION, FIGMA_BOARDS_DOC),
      snap => setBoards(((snap.exists() ? snap.data()?.months : null) ?? {}) as Record<string, FigmaBoard>),
      () => setBoards({}),
    );
  }, [enabled]);

  // month: 'YYYY-MM'. 빈 문자열로 저장하면 그 달 링크를 지운 것으로 본다.
  const save = (month: string, v: { banner: string; landing: string }, who: string) =>
    setDoc(
      doc(db, FIGMA_SETUP_META_COLLECTION, FIGMA_BOARDS_DOC),
      { months: { [month]: { ...v, updatedBy: who, updatedAt: new Date().toISOString() } } },
      { merge: true },
    );

  return { boards, save };
}
