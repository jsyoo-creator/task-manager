import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_META_COLLECTION } from '../lib/figmaSetup';

// 디자이너 맥의 Claude 남은 사용량. 맥 프로그램이 figmaSetupMeta/claudeUsage 에 올린다(바뀔 때만).
// 팝업이 열려 있을 때만 구독한다.
export interface ClaudeUsage {
  sessionUsed: number;     // 이번 세션(약 5시간) 사용 %, 모르면 -1
  sessionResetAt: string;  // 세션 초기화 시각 (KST ISO)
  weekUsed: number;        // 이번 주 사용 %
  weekResetAt: string;
  checkedAt: string;       // 마지막 확인 (UTC ISO)
}

export function useClaudeUsage(enabled: boolean) {
  const [usage, setUsage] = useState<ClaudeUsage | null | undefined>(undefined); // undefined=불러오는 중, null=정보 없음
  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(doc(db, FIGMA_SETUP_META_COLLECTION, 'claudeUsage'), snap => {
      if (!snap.exists()) { setUsage(null); return; }
      const d = snap.data();
      setUsage({
        sessionUsed: Number(d.sessionUsed ?? -1), sessionResetAt: d.sessionResetAt ?? '',
        weekUsed: Number(d.weekUsed ?? -1), weekResetAt: d.weekResetAt ?? '', checkedAt: d.checkedAt ?? '',
      });
    });
    return unsub;
  }, [enabled]);
  return usage;
}
