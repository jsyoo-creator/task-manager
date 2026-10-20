import { useState, useEffect } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_COLLECTION, type FigmaSetupJob } from '../lib/figmaSetup';

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

  // 이미 요청된 폴더면 다시 쓰지 않는다 (두 사람이 동시에 눌러도 한 번만 요청됨).
  // 폴더 없음/실패일 때만 다시 요청할 수 있다.
  const requestSetup = async (data: Pick<FigmaSetupJob, 'folderName' | 'taskId' | 'taskTitle' | 'requestedBy' | 'workplaceId' | 'teamId'>) => {
    const ref = doc(db, FIGMA_SETUP_COLLECTION, data.folderName);
    await runTransaction(db, async tx => {
      const cur = await tx.get(ref);
      const status = cur.exists() ? (cur.data().status as string) : null;
      if (status && status !== 'no_folder' && status !== 'failed') return;
      tx.set(ref, {
        ...data,
        workplaceId: data.workplaceId ?? '',
        teamId: data.teamId ?? '',
        status: 'requested',
        requestedAt: new Date().toISOString(),
      });
    });
  };

  return { job, loading, requestSetup };
}
