import { useState, type ReactNode } from 'react';
import { Loader2, Clock, Check, AlertCircle, X, FilePlus2, FilePen, Image as ImageIcon, LayoutList, Layers } from 'lucide-react';
import { UsagePanel } from './UsagePanel';
import type { Task } from '../types';
import { folderNameFromTask } from '../lib/figmaSetup';
import { PLAN_SCOPE_LABEL, type PlanScope, type PlanDraftKind } from '../lib/planDraft';
import { usePlanDraft } from '../hooks/usePlanDraft';
import PlanBuilderModal from './PlanBuilderModal';

// 세부업무 카드 안 Figma 줄의 [폴더 상태]와 [세팅요청] 사이에 들어가는 [기획서 상태] [버튼].
// kind=initial('1차 기획서'): 1차 기획서 만들기 → 요청대기 → 기획서 생성중 → v1.0 생성됨 + 추가 작성하기. 같은 파일을 고쳐 쓴다.
// kind=update('기획서 업데이트'): 1차에 입력한 값을 가져와 고치고, 저장할 때마다 버전을 올린 새 파일을 만든다.
//   버튼명은 기획서 업데이트 → 2차 업데이트 → 3차 업데이트… (지금까지 요청한 횟수로 센다)
// 누르면 범위(배너/상세/둘 다)를 고르고, 편집 화면에서 내용을 정리해 planDrafts 문서에 요청을 남긴다.
export default function PlanBuilderButton({ task, kind = 'initial', canManage, currentUserName, workplaceId, teamId }: {
  task: Task;
  kind?: PlanDraftKind;
  canManage: boolean;
  currentUserName: string;
  workplaceId?: string;
  teamId?: string;
}) {
  const folderName = folderNameFromTask(task);
  const isUpdate = kind === 'update';
  const { draft, loading, requestPlan } = usePlanDraft(folderName, kind);
  // 업데이트는 1차 기획서에 입력한 값을 가져와 시작한다 (아직 이 카드에서 저장한 적이 없을 때)
  const { draft: initialDraft } = usePlanDraft(isUpdate ? folderName : null, 'initial');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [editorScope, setEditorScope] = useState<PlanScope | null>(null);
  const [account, setAccount] = useState('');   // 팝업에서 고른 Claude 계정 ('' = 자동)

  const chip = 'flex-shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-colors';
  const status = draft?.status;
  const madeOnce = !!draft?.outputFile;   // 한 번이라도 기획서 파일이 만들어졌으면 '추가 작성하기'
  const again = madeOnce || status === 'done';
  const seed = isUpdate ? ((draft?.banner || draft?.landing) ? draft : initialDraft) : draft;
  const baseFile = draft?.outputFile || (isUpdate ? initialDraft?.outputFile : '') || '';
  const hasSeed = !!(seed?.banner || seed?.landing);
  const times = draft?.history?.length ?? 0;   // 지금까지 요청한 횟수 → 다음 버튼 이름
  const label = isUpdate
    ? (times === 0 ? '기획서 업데이트' : `${times + 1}차 업데이트`)
    : (again ? '추가 작성하기' : '1차 기획서 만들기');
  const canRequest = canManage && !!folderName && (!isUpdate || hasSeed);
  const disabledTitle = !canManage ? '업무 편집 권한이 있어야 만들 수 있어요'
    : !folderName ? '업무명이 "10/27 10월 결산" 형식이어야 기획서를 만들 수 있어요'
    : (isUpdate && !hasSeed) ? '1차 기획서를 먼저 만들어 주세요 — 그때 입력한 내용을 가져와 수정합니다' : '';

  let content: ReactNode;
  if (loading) {
    content = <span className={`${chip} text-gray-300 border-gray-200`}><Loader2 size={11} className="animate-spin" />확인 중</span>;
  } else if (status === 'requested') {
    content = <span className={`${chip} text-amber-600 border-amber-200 bg-amber-50`} title={`${draft?.fileName ?? ''} — 디자이너 맥이 켜지면 자동으로 시작돼요`}><Clock size={11} className="animate-pulse" />요청대기</span>;
  } else if (status === 'running') {
    content = <span className={`${chip} text-blue-600 border-blue-200 bg-blue-50`} title={`${draft?.fileName ?? ''} — 기획서(PPT)를 ${isUpdate ? '고치고' : '만들고'} 있어요`}><Loader2 size={11} className="animate-spin" />{isUpdate ? '기획서 수정중' : '기획서 생성중'}</span>;
  } else if (status === 'failed') {
    content = (
      <button type="button" disabled={!canRequest} onClick={() => setScopeOpen(true)}
        title={disabledTitle || `${draft?.message || `기획서를 ${isUpdate ? '고치는' : '만드는'} 중 문제가 생겼어요`} — 지난 내용으로 다시 요청합니다`}
        className={`${chip} text-red-500 border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-default`}>
        <AlertCircle size={11} />{isUpdate ? '업데이트 실패' : '기획서 생성실패'} · 다시 요청
      </button>
    );
  } else {
    const doneTitle = [draft?.outputFile, draft?.message].filter(Boolean).join(' · ');
    content = (
      <>
        {status === 'done' && (
          <span className={`${chip} text-green-600 border-green-200 bg-green-50`} title={doneTitle || '기획서 생성됨'}>
            <Check size={11} />{draft?.version || '기획서'} {isUpdate ? '업데이트됨' : '생성됨'}
          </span>
        )}
        <button type="button" disabled={!canRequest} onClick={() => setScopeOpen(true)}
          title={disabledTitle || (isUpdate ? '1차 기획서에 입력한 내용을 가져와 고치고, 버전을 올린 새 파일로 저장해요'
            : again ? '지난번 내용에 이어서 배너·상세를 추가 작성해요' : '배너 카피·상세페이지 내용을 정리해 1차 기획서(PPT)를 만들어 달라고 요청합니다')}
          className={`${chip} text-indigo-600 border-indigo-200 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-default`}>
          {(again || isUpdate) ? <FilePen size={11} /> : <FilePlus2 size={11} />}{label}
        </button>
      </>
    );
  }

  return (
    <>
      {content}
      {scopeOpen && (
        <PlanScopeDialog taskTitle={task.title} again={again} title={label} isUpdate={isUpdate} onCancel={() => setScopeOpen(false)}
          onPick={(scope, acc) => { setScopeOpen(false); setAccount(acc); setEditorScope(scope); }} />
      )}
      {editorScope && folderName && (
        <PlanBuilderModal task={task} folderName={folderName} scope={editorScope} draft={draft} seed={seed ?? null}
          again={again} kind={kind} title={label} baseFile={baseFile} account={account}
          currentUserName={currentUserName} workplaceId={workplaceId} teamId={teamId}
          requestPlan={requestPlan} onClose={() => setEditorScope(null)} />
      )}
    </>
  );
}


// 범위 고르기 팝업 — Figma 세팅요청 팝업(ScopeDialog)과 같은 모양에 선택지 3개
function PlanScopeDialog({ taskTitle, again, title, isUpdate, onPick, onCancel }: {
  taskTitle: string; again: boolean; title: string; isUpdate: boolean;
  onPick: (scope: PlanScope, account: string) => void; onCancel: () => void;
}) {
  const [account, setAccount] = useState('');   // '' = 남은 계정으로 자동
  const pick = (scope: PlanScope, icon: ReactNode, primary = false) => (
    <button onClick={() => onPick(scope, account)}
      className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${primary ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}>
      {icon}{PLAN_SCOPE_LABEL[scope]}
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-[380px] mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl flex flex-col break-keep" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={17} /></button>
        </div>
        <div className="px-5 py-6 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-50">
            {(again || isUpdate) ? <FilePen size={24} className="text-indigo-400" /> : <FilePlus2 size={24} className="text-indigo-400" />}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 truncate max-w-[280px] mx-auto" title={taskTitle}>{taskTitle}</p>
            <p className="text-sm text-gray-500 mt-1">{isUpdate ? '무엇을 수정할까요?' : again ? '무엇을 추가 작성할까요?' : '무엇을 작성할까요?'}</p>
            <p className="text-xs text-gray-400 mt-1.5">{isUpdate ? '지난번 입력이 그대로 열려요 · 고른 쪽만 고쳐 새 버전으로 저장해요'
              : again ? '고른 쪽만 고쳐서 저장하고, 나머지는 지난번 그대로 둬요' : '배너 카피와 상세페이지 내용을 정리해 기획서(PPT)로 만들어요'}</p>
          </div>
          <UsagePanel account={account} onAccount={setAccount} jobKind="plan" />
          <p className="text-[11px] text-gray-400 text-center">배너만 고르면 Claude를 쓰지 않아요 · 사용량과 상관없이 바로 만들어져요</p>
        </div>
        <div className="flex gap-2 px-5 pb-3">
          {pick('banner', <ImageIcon size={14} />)}
          {pick('landing', <LayoutList size={14} />)}
          {pick('both', <Layers size={14} />, true)}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onCancel} className="w-full py-2 text-sm font-medium rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
        </div>
      </div>
    </div>
  );
}
