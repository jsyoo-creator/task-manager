import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_META_COLLECTION } from '../lib/figmaSetup';

// 작업 종류별로 '이 작업이 보통 세션 사용량을 몇 % 쓰는지'. 맥 프로그램이 작업 전후 사용률 차이를
// figmaSetupMeta/jobCost 에 모아 둔다(최근 10회 평균). 요청 팝업이 열릴 때만 구독한다.
export interface JobCost { sessionPct: number; n: number }

export function useJobCost(enabled: boolean) {
  const [cost, setCost] = useState<Record<string, JobCost>>({});
  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(doc(db, FIGMA_SETUP_META_COLLECTION, 'jobCost'), snap => {
      const d = snap.exists() ? snap.data() : {};
      const out: Record<string, JobCost> = {};
      for (const [k, v] of Object.entries(d ?? {})) {
        const m = v as { sessionPct?: number; n?: number };
        if (typeof m?.sessionPct === 'number') out[k] = { sessionPct: m.sessionPct, n: Number(m.n ?? 0) };
      }
      setCost(out);
    }, err => console.error('[jobCost] subscribe failed', err));
    return unsub;
  }, [enabled]);
  return cost;
}
