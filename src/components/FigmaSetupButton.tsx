import { useState, type ReactNode } from 'react';
import { Loader2, Clock, Check, ExternalLink, AlertCircle, FolderX } from 'lucide-react';
import type { Task } from '../types';
import { folderNameFromTask } from '../lib/figmaSetup';
import { useFigmaSetupJob } from '../hooks/useFigmaSetupJob';

// 라이브 파트 '1차 기획서' 세부업무 카드 안의 Figma 세팅 버튼.
// 상태: 세팅요청 → 요청대기(맥이 아직 안 가져감) → 반영중 → 세팅완료 (+ 폴더 없음 / 세팅실패)
export default function FigmaSetupButton({ task, canManage, currentUserName, workplaceId, teamId }: {
  task: Task;
  canManage: boolean;
  currentUserName: string;
  workplaceId?: string;
  teamId?: string;
}) {
  const folderName = folderNameFromTask(task);
  const { job, loading, requestSetup } = useFigmaSetupJob(folderName);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const base = 'flex-shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-colors';

  if (!folderName) {
    return (
      <div className="flex items-center gap-2 mt-1 mb-2">
        <span className="text-[11px] font-medium text-gray-500 flex-shrink-0">Figma 세팅</span>
        <span className="text-[11px] text-gray-400">업무명이 "10/6 냉장고&세탁기" 형식이어야 드라이브 폴더를 찾을 수 있어요</span>
      </div>
    );
  }

  const request = async () => {
    setSending(true); setError('');
    try {
      await requestSetup({ folderName, taskId: task.id, taskTitle: task.title, requestedBy: currentUserName, workplaceId, teamId });
    } catch (e) {
      setError('요청을 저장하지 못했어요. 잠시 후 다시 눌러 주세요.');
      console.error('[figmaSetup] request failed', e);
    } finally {
      setSending(false);
    }
  };

  const status = job?.status;
  let button: ReactNode;
  let note: ReactNode = null;

  if (loading) {
    button = <span className={`${base} text-gray-300 border-gray-200`}><Loader2 size={11} className="animate-spin" />확인 중</span>;
  } else if (!status) {
    button = (
      <button type="button" disabled={!canManage || sending} onClick={request}
        title={canManage ? 'Figma에 배너(카피)와 랜딩을 세팅해 달라고 요청합니다' : '업무 편집 권한이 있어야 요청할 수 있어요'}
        className={`${base} text-indigo-600 border-indigo-200 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-default`}>
        {sending ? <Loader2 size={11} className="animate-spin" /> : null}세팅요청
      </button>
    );
  } else if (status === 'requested') {
    button = <span className={`${base} text-amber-600 border-amber-200 bg-amber-50`}><Clock size={11} className="animate-pulse" />요청대기</span>;
    note = '디자이너 맥이 켜지면 자동으로 시작돼요';
  } else if (status === 'running') {
    button = <span className={`${base} text-blue-600 border-blue-200 bg-blue-50`}><Loader2 size={11} className="animate-spin" />반영중</span>;
    note = '배너(카피)와 랜딩을 Figma에 세팅하고 있어요. 보통 10~30분 걸려요';
  } else if (status === 'done') {
    button = <span className={`${base} text-green-600 border-green-200 bg-green-50`}><Check size={11} />세팅완료</span>;
    note = (
      <span className="flex items-center gap-2">
        {job?.bannerUrl && <a href={job.bannerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline">배너 보드<ExternalLink size={10} /></a>}
        {job?.landingUrl && <a href={job.landingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline">랜딩<ExternalLink size={10} /></a>}
        {job?.message && <span className="text-gray-400 truncate">{job.message}</span>}
      </span>
    );
  } else {
    const isNoFolder = status === 'no_folder';
    button = (
      <button type="button" disabled={!canManage || sending} onClick={request}
        title="폴더를 확인한 뒤 다시 요청합니다"
        className={`${base} text-red-500 border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-default`}>
        {isNoFolder ? <FolderX size={11} /> : <AlertCircle size={11} />}{isNoFolder ? '폴더 없음 · 다시 요청' : '세팅실패 · 다시 요청'}
      </button>
    );
    note = isNoFolder ? `드라이브에 "${folderName}" 폴더가 없어요` : (job?.message || '세팅 중 문제가 생겼어요');
  }

  return (
    <div className="flex items-center gap-2 mt-1 mb-2 min-w-0">
      <span className="text-[11px] font-medium text-gray-500 flex-shrink-0">Figma 세팅</span>
      {button}
      <span className="text-[10px] text-gray-400 truncate" title={folderName}>{error || note || folderName}</span>
    </div>
  );
}
