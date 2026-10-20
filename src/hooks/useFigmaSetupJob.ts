import { useState, useEffect } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_COLLECTION, type FigmaSetupJob, type FigmaSetupScope } from '../lib/figmaSetup';

// 업무 하나(폴더 하나)의 Figma 세팅 요청 상태를 실시간으로 본다. 문서 하나만 구독한다.
export function useFigmaSetupJob(folderName: string | null) {
  const [job, setJob] = useState<FigmaSetupJob | null>(null);
  const [loading, setLoading] = useState(!!folderName);

  useEffect(() => {
    if (!folderName) { setJob(null); setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(doc(db, FIGMA_SETUP_COLLECTION, folderName), snap => {
      setJob(snap.exists() ? ({ id: snap.id, ...snap.data() } as FigmaSetupJob) : null);
      setLoading(false);
    });
    return unsub;
  }, [folderName]);

  // 이미 요청됐거나 처리 중인 폴더면 다시 쓰지 않는다 (두 사람이 동시에 눌러도 한 번만 요청됨).
  // 폴더 없음/실패일 때, 그리고 세팅완료 뒤 '다시 요청'(again)일 때만 다시 요청할 수 있다.
  const requestSetup = async (data: Pick<FigmaSetupJob, 'folderName' | 'taskId' | 'taskTitle' | 'requestedBy' | 'workplaceId' | 'teamId'>, again = false, scope: FigmaSetupScope = 'both') => {
    const ref = doc(db, FIGMA_SETUP_COLLECTION, data.folderName);
    await runTransaction(db, async tx => {
      const cur = await tx.get(ref);
      const status = cur.exists() ? (cur.data().status as string) : null;
      if (status && status !== 'no_folder' && status !== 'failed' && !(again && status === 'done')) return;
      // 다시 요청은 merge — 이번에 안 하는 쪽(예: 상세페이지만 하면 배너)의 결과 링크는 남긴다
      tx.set(ref, {
        ...data,
        workplaceId: data.workplaceId ?? '',
        teamId: data.teamId ?? '',
        status: 'requested',
        scope,
        message: '',
        requestedAt: new Date().toISOString(),
      }, { merge: again });
    });
  };

  return { job, loading, requestSetup };
}
