import { useState, type ReactNode } from 'react';
import { Loader2, Clock, Check, AlertCircle, Folder, FolderX, FolderSearch, RotateCcw, X } from 'lucide-react';
import type { Task } from '../types';
import { folderNameFromTask, FIGMA_SETUP_SCOPE_LABEL, type FigmaSetupScope } from '../lib/figmaSetup';
import { useFigmaSetupJob } from '../hooks/useFigmaSetupJob';
import { useDriveFolders } from '../hooks/useDriveFolders';

// 라이브 파트 '1차 기획서' 세부업무 카드 안의 Figma 세팅 줄 — 오른쪽에 [폴더 상태] [버튼] 두 가지만 표시.
// 버튼 상태: 세팅요청 → 요청대기(맥이 아직 안 가져감) → 반영중 → 세팅완료 (+ 세팅실패 · 다시 요청)
// 자세한 내용(폴더 이름, 실패 이유, 결과 링크)은 마우스를 올리면 보이거나 세팅완료 버튼으로 연다.
export default function FigmaSetupButton({ task, canManage, currentUserName, workplaceId, teamId }: {
  task: Task;
  canManage: boolean;
  currentUserName: string;
  workplaceId?: string;
  teamId?: string;
}) {
  const folderName = folderNameFromTask(task);
  const { job, loading, requestSetup } = useFigmaSetupJob(folderName);
  const { folders } = useDriveFolders(!!folderName);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [confirmAgain, setConfirmAgain] = useState(false);

  const chip = 'flex-shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-colors';

  // ── 폴더 상태 ──
  const folderKnown = folders !== null;
  const folderExists = !!folderName && !!folders?.has(folderName.normalize('NFC'));
  const noFolder = job?.status === 'no_folder' || (folderKnown && !!folderName && !folderExists && job?.status !== 'done');
  let folderBadge: ReactNode;
  if (!folderName) {
    folderBadge = (
      <span className={`${chip} text-gray-400 border-gray-200 bg-white`} title={'업무명이 "10/6 냉장고&세탁기" 형식이어야 드라이브 폴더를 찾을 수 있어요'}>
        <FolderX size={11} />업무명 형식 확인
      </span>
    );
  } else if (folderExists || job?.status === 'done' || job?.status === 'running') {
    folderBadge = <span className={`${chip} text-green-600 border-green-200 bg-green-50`} title={`드라이브 폴더: ${folderName}`}><Folder size={11} />폴더 있음</span>;
  } else if (noFolder) {
    folderBadge = <span className={`${chip} text-red-500 border-red-200 bg-red-50`} title={`드라이브에 "${folderName}" 폴더가 없어요`}><FolderX size={11} />폴더 없음</span>;
  } else {
    folderBadge = <span className={`${chip} text-gray-400 border-gray-200 bg-white`} title={`드라이브 폴더 "${folderName}" — 디자이너 맥이 켜지면 확인돼요`}><FolderSearch size={11} />폴더 확인 전</span>;
  }

  // ── 버튼 ──
  const request = async (again = false, scope: FigmaSetupScope = 'both') => {
    if (!folderName) return;
    setSending(true); setError('');
    try {
      await requestSetup({ folderName, taskId: task.id, taskTitle: task.title, requestedBy: currentUserName, workplaceId, teamId }, again, scope);
    } catch (e) {
      setError('요청을 저장하지 못했어요. 잠시 후 다시 눌러 주세요.');
      console.error('[figmaSetup] request failed', e);
    } finally {
      setSending(false);
    }
  };

  const status = job?.status;
  const canRequest = canManage && !!folderName && !(folderKnown && !folderExists);
  const requestTitle = !canManage ? '업무 편집 권한이 있어야 요청할 수 있어요'
    : !folderName ? '업무명 형식을 먼저 확인해 주세요'
    : folderKnown && !folderExists ? `드라이브에 "${folderName}" 폴더를 만든 뒤 요청할 수 있어요`
    : 'Figma에 배너(카피)와 랜딩을 세팅해 달라고 요청합니다';
  let button: ReactNode;

  if (loading) {
    button = <span className={`${chip} text-gray-300 border-gray-200`}><Loader2 size={11} className="animate-spin" />확인 중</span>;
  } else if (!status || status === 'no_folder' || status === 'failed') {
    const retry = status === 'failed';
    button = (
      <button type="button" disabled={!canRequest || sending} onClick={() => request()}
        title={error || (retry ? `${job?.message || '세팅 중 문제가 생겼어요'} — 다시 요청합니다` : requestTitle)}
        className={`${chip} ${retry ? 'text-red-500 border-red-200 bg-red-50 hover:bg-red-100' : 'text-indigo-600 border-indigo-200 bg-white hover:bg-indigo-50'} disabled:opacity-50 disabled:cursor-default`}>
        {sending ? <Loader2 size={11} className="animate-spin" /> : retry ? <AlertCircle size={11} /> : null}
        {retry ? '세팅실패 · 다시 요청' : '세팅요청'}
      </button>
    );
  } else if (status === 'requested') {
    button = <span className={`${chip} text-amber-600 border-amber-200 bg-amber-50`} title="디자이너 맥이 켜지면 자동으로 시작돼요"><Clock size={11} className="animate-pulse" />요청대기</span>;
  } else if (status === 'running') {
    button = <span className={`${chip} text-blue-600 border-blue-200 bg-blue-50`} title="배너(카피)와 랜딩을 Figma에 세팅하고 있어요. 보통 10~30분 걸려요"><Loader2 size={11} className="animate-spin" />반영중</span>;
  } else {
    // 세팅완료 — 누르면 배너 보드(없으면 랜딩)를 연다
    const url = job?.bannerUrl || job?.landingUrl;
    const doneTitle = [job?.bannerUrl && '배너 보드 열기', job?.message].filter(Boolean).join(' · ') || '세팅완료';
    const doneChip = url
      ? <a href={url} target="_blank" rel="noreferrer" title={doneTitle} className={`${chip} text-green-600 border-green-200 bg-green-50 hover:bg-green-100`}><Check size={11} />세팅완료</a>
      : <span className={`${chip} text-green-600 border-green-200 bg-green-50`} title={doneTitle}><Check size={11} />세팅완료</span>;
    // 세팅완료 뒤에도 다시 요청할 수 있게 (기획서가 바뀌었거나 Figma에서 지운 경우)
    button = (
      <>
        {doneChip}
        <button type="button" disabled={!canRequest || sending} onClick={() => setConfirmAgain(true)}
          title={canRequest ? '기획서 기준으로 다시 세팅요청' : requestTitle}
          className={`${chip} text-indigo-600 border-indigo-200 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-default`}>
          {sending ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}다시 세팅요청
        </button>
      </>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 mt-1 mb-2">
      {folderBadge}
      {button}
      {confirmAgain && (
        <ScopeDialog taskTitle={task.title} onCancel={() => setConfirmAgain(false)}
          onPick={scope => { setConfirmAgain(false); request(true, scope); }} />
      )}
    </div>
  );
}


// 다시 세팅요청 팝업 — 앱 확인 팝업(ConfirmDialog)과 같은 모양에 선택지 3개
function ScopeDialog({ taskTitle, onPick, onCancel }: { taskTitle: string; onPick: (scope: FigmaSetupScope) => void; onCancel: () => void }) {
  const pick = (scope: FigmaSetupScope, primary = false) => (
    <button onClick={() => onPick(scope)}
      className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${primary ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}>
      {FIGMA_SETUP_SCOPE_LABEL[scope]}
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-[380px] mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h2 className="text-sm font-semibold text-gray-900">다시 세팅요청</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={17} /></button>
        </div>
        <div className="px-5 py-6 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-50">
            <RotateCcw size={24} className="text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 truncate max-w-[280px]" title={taskTitle}>{taskTitle}</p>
            <p className="text-sm text-gray-500 mt-1">무엇을 다시 세팅할까요?</p>
            <p className="text-xs text-gray-400 mt-1.5">지금 기획서 기준으로 다시 맞춰요 · Figma에서 지웠다면 새로 만들어요</p>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-3">
          {pick('banner')}
          {pick('landing')}
          {pick('both', true)}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onCancel} className="w-full py-2 text-sm font-medium rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
        </div>
      </div>
    </div>
  );
}
