import { useState, type ReactNode } from 'react';
import { Loader2, Clock, Check, AlertCircle, Folder, FolderX, FolderSearch, RotateCcw } from 'lucide-react';
import type { Task } from '../types';
import { folderNameFromTask } from '../lib/figmaSetup';
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
  const request = async (again = false) => {
    if (!folderName) return;
    if (again && !window.confirm('Figma에 이미 세팅된 배너·랜딩을 지금 기획서 기준으로 다시 맞춰요.\n(Figma에서 지웠다면 새로 만들어요)\n\n다시 세팅요청할까요?')) return;
    setSending(true); setError('');
    try {
      await requestSetup({ folderName, taskId: task.id, taskTitle: task.title, requestedBy: currentUserName, workplaceId, teamId }, again);
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
        <button type="button" disabled={!canRequest || sending} onClick={() => request(true)}
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
    </div>
  );
}
