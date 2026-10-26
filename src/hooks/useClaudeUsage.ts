import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_META_COLLECTION } from '../lib/figmaSetup';
import { isQuotaError } from '../lib/dbQuota';

// 디자이너 맥의 Claude 남은 사용량. 맥 프로그램이 figmaSetupMeta/claudeUsage 에 올린다(바뀔 때만).
// 팝업이 열려 있을 때만 구독한다.
// 계정(좌석)별 남은 사용량 — 맥 프로그램이 주 계정·예비 계정을 각각 읽어 올린다
export interface ClaudeAccountUsage {
  name: string;
  sessionUsed: number;
  sessionResetAt: string;
  weekUsed: number;
  weekResetAt: string;
}
export interface ClaudeUsage {
  sessionUsed: number;     // 이번 세션(약 5시간) 사용 %, 모르면 -1
  sessionResetAt: string;  // 세션 초기화 시각 (KST ISO)
  weekUsed: number;        // 이번 주 사용 %
  weekResetAt: string;
  checkedAt: string;       // 마지막 확인 (UTC ISO)
  accounts: ClaudeAccountUsage[];  // 계정이 하나뿐이면 길이 1 (예전 문서면 빈 배열)
}

// dbBlocked: 이 문서를 읽다가 업무관리 DB 하루 읽기 한도(resource-exhausted)에 걸렸는지 — 사용량 칸에 같이 보여 준다
export function useClaudeUsage(enabled: boolean): { usage: ClaudeUsage | null | undefined; dbBlocked: boolean } {
  const [usage, setUsage] = useState<ClaudeUsage | null | undefined>(undefined); // undefined=불러오는 중, null=정보 없음
  const [dbBlocked, setDbBlocked] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(doc(db, FIGMA_SETUP_META_COLLECTION, 'claudeUsage'), snap => {
      setDbBlocked(false);
      if (!snap.exists()) { setUsage(null); return; }
      const d = snap.data();
      setUsage({
        sessionUsed: Number(d.sessionUsed ?? -1), sessionResetAt: d.sessionResetAt ?? '',
        weekUsed: Number(d.weekUsed ?? -1), weekResetAt: d.weekResetAt ?? '', checkedAt: d.checkedAt ?? '',
        accounts: (Array.isArray(d.accounts) ? d.accounts : []).map((a: Record<string, unknown>) => ({
          name: String(a.name ?? ''),
          sessionUsed: Number(a.sessionUsed ?? -1), sessionResetAt: String(a.sessionResetAt ?? ''),
          weekUsed: Number(a.weekUsed ?? -1), weekResetAt: String(a.weekResetAt ?? ''),
        })),
      });
    }, err => {
      if (isQuotaError(err)) setDbBlocked(true);
      else console.error('[claudeUsage]', err);
    });
    return unsub;
  }, [enabled]);
  return { usage, dbBlocked };
}
