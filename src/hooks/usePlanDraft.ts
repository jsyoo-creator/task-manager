import { useState, useEffect } from 'react';
import { doc, onSnapshot, runTransaction, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PLAN_DRAFT_COLLECTION, PLAN_HISTORY_MAX, planDraftDocId, versionFromFileName, scopeHasBanner, scopeHasLanding, type PlanDraft, type PlanDraftBanner, type PlanDraftLanding, type PlanDraftKind, type PlanScope, type PlanHistoryEntry } from '../lib/planDraft';

// 이미 요청 대기·작성 중이라 새 요청을 받지 않았을 때 던지는 오류
export class PlanDraftBusyError extends Error {
  constructor() { super('이미 작성 요청을 처리 중이에요'); this.name = 'PlanDraftBusyError'; }
}

export interface PlanRequest {
  folderName: string;
  taskId: string;
  taskTitle: string;
  workplaceId?: string;
  teamId?: string;
  requestedBy: string;
  scope: PlanScope;
  fileName: string;
  banner?: PlanDraftBanner;   // scope에 배너가 있을 때만 보낸다
  landing?: PlanDraftLanding; // scope에 상세가 있을 때만 보낸다
  baseFile?: string;          // 이 문서에 지난 결과가 없을 때 틀로 쓸 파일 (업데이트가 1차 기획서를 이어받을 때)
}

// 업무 하나(폴더 하나)의 기획서 작성 요청 상태를 실시간으로 본다. 문서 하나만 구독한다.
export function usePlanDraft(folderName: string | null, kind: PlanDraftKind = 'initial') {
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [loading, setLoading] = useState(!!folderName);

  useEffect(() => {
    if (!folderName) { setDraft(null); setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(doc(db, PLAN_DRAFT_COLLECTION, planDraftDocId(folderName, kind)), snap => {
      setDraft(snap.exists() ? ({ id: snap.id, ...snap.data() } as PlanDraft) : null);
      setLoading(false);
    }, err => {
      console.error('[planDraft] subscribe failed', err);
      setLoading(false);
    });
    return unsub;
  }, [folderName, kind]);

  // 요청 대기·작성 중이면 덮어쓰지 않는다 (두 사람이 동시에 눌러도 한 번만 요청됨).
  // merge로 써서 이번에 안 고친 쪽(예: 상세만 추가 작성하면 배너)의 내용은 지난번 그대로 남긴다.
  const requestPlan = async (req: PlanRequest) => {
    const ref = doc(db, PLAN_DRAFT_COLLECTION, planDraftDocId(req.folderName, kind));
    await runTransaction(db, async tx => {
      const cur = await tx.get(ref);
      const prev = cur.exists() ? (cur.data() as Partial<PlanDraft>) : null;
      if (prev?.status === 'requested' || prev?.status === 'running') throw new PlanDraftBusyError();
      const now = new Date().toISOString();
      // 한 번이라도 만들어진 파일이 있으면 그 파일을 바탕으로 고쳐 쓴다(update).
      // 업데이트 문서의 첫 요청은 1차 기획서가 만든 파일을 틀로 삼는다.
      const baseFile = prev?.outputFile || req.baseFile || '';
      const entry: PlanHistoryEntry = { at: now, by: req.requestedBy, scope: req.scope, fileName: req.fileName };
      const history = [...(Array.isArray(prev?.history) ? prev!.history! : []), entry].slice(-PLAN_HISTORY_MAX);
      const data: Record<string, unknown> = {
        folderName: req.folderName,
        taskId: req.taskId,
        taskTitle: req.taskTitle,
        workplaceId: req.workplaceId ?? '',
        teamId: req.teamId ?? '',
        status: 'requested',
        message: '',
        requestedBy: req.requestedBy,
        requestedAt: now,
        finishedAt: deleteField(),
        scope: req.scope,
        fileName: req.fileName,
        version: versionFromFileName(req.fileName),
        mode: baseFile ? 'update' : 'create',
        baseFile: baseFile || deleteField(),
        history,
      };
      // 배너·상세는 이번 범위에 든 쪽만 통째로 바꾸고, 나머지 필드(지난 결과 파일 등)는 그대로 둔다
      if (scopeHasBanner(req.scope) && req.banner) data.banner = req.banner;
      if (scopeHasLanding(req.scope) && req.landing) data.landing = req.landing;
      tx.set(ref, data, { mergeFields: Object.keys(data) });
    });
  };

  return { draft, loading, requestPlan };
}
