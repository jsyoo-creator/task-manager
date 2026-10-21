import { useState, type ReactNode } from 'react';
import { Loader2, Clock, Check, AlertCircle, Folder, FolderX, FolderSearch, RotateCcw, X, Send, Download, Image as ImageIcon } from 'lucide-react';
import type { Task } from '../types';
import { folderNameFromTask, figmaSetupDocId, FIGMA_SETUP_SCOPE_LABEL, FIGMA_SETUP_TEXT, type FigmaSetupScope, type FigmaSetupKind } from '../lib/figmaSetup';
import { useFigmaSetupJob } from '../hooks/useFigmaSetupJob';
import { useDriveFolders } from '../hooks/useDriveFolders';
import { UsagePanel, fmtTime } from './UsagePanel';

// 라이브 파트 '1차 기획서'(kind=initial)·'기획서 업데이트'(kind=update) 세부업무 카드 안의 Figma 줄 — 오른쪽에 [폴더 상태] [middle] [버튼].
// middle: '1차 기획서'에서는 기획서 만들기 버튼이 폴더 상태와 세팅요청 사이에 들어간다.
// '기획 제작 소재 검수'(kind=save)는 이미지 저장 → 요청대기 → 저장중 → 저장완료 (드라이브 02.디자인)
// 버튼 상태: 세팅요청|반영요청 → 요청대기(맥이 아직 안 가져감) → 반영중 → 세팅완료|반영완료 (+ 실패 · 다시 요청)
// 자세한 내용(폴더 이름, 실패 이유, 결과 링크)은 마우스를 올리면 보이거나 세팅완료 버튼으로 연다.
export default function FigmaSetupButton({ task, kind = 'initial', canManage, currentUserName, workplaceId, teamId, middle }: {
  task: Task;
  middle?: ReactNode;
  kind?: FigmaSetupKind;
  canManage: boolean;
  currentUserName: string;
  workplaceId?: string;
  teamId?: string;
}) {
  const folderName = folderNameFromTask(task);
  const { job, loading, requestSetup } = useFigmaSetupJob(folderName ? figmaSetupDocId(folderName, kind) : null);
  const text = FIGMA_SETUP_TEXT[kind];
  const { folders, plans, images } = useDriveFolders(!!folderName);
  const latestPlan = folderName ? plans[folderName.normalize('NFC')] : undefined;
  const imageAt = folderName ? images[folderName.normalize('NFC')] : undefined;
  // 기획서 업데이트는 지난번에 반영한 버전과 비교한다 (업데이트 기록이 없으면 1차 기획서 세팅 때 버전)
  const { job: initialJob } = useFigmaSetupJob(kind === 'update' && folderName ? folderName : null);
  const lastVersion = kind === 'save' ? undefined : (job?.status === 'done' && job.planVersion) || (kind === 'update' ? initialJob?.planVersion : undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // 세팅요청·다시 세팅요청 모두 팝업에서 범위를 고른다 (first: 처음/실패 후, again: 세팅완료 뒤)
  const [dialog, setDialog] = useState<null | 'first' | 'again'>(null);

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
      await requestSetup({ folderName, taskId: task.id, taskTitle: task.title, requestedBy: currentUserName, workplaceId, teamId }, again, scope, kind);
    } catch (e) {
      setError('요청을 저장하지 못했어요. 잠시 후 다시 눌러 주세요.');
      console.error('[figmaSetup] request failed', e);
    } finally {
      setSending(false);
    }
  };

  const status = job?.status;
  const canRequest = canManage && !!folderName && !(folderKnown && !folderExists) && !(kind === 'image' && folderKnown && !imageAt);
  const requestTitle = !canManage ? '업무 편집 권한이 있어야 요청할 수 있어요'
    : !folderName ? '업무명 형식을 먼저 확인해 주세요'
    : folderKnown && !folderExists ? `드라이브에 "${folderName}" 폴더를 만든 뒤 요청할 수 있어요`
    : kind === 'image' && folderKnown && !imageAt ? '02.디자인/99_가이드에 banner_img.png를 올린 뒤 요청할 수 있어요'
    : kind === 'image' ? '99_가이드의 배너 원본 이미지를 Figma 배너에 배치해 달라고 요청합니다'
    : kind === 'save' ? '검수 끝난 배너·상세페이지를 이미지로 드라이브 02.디자인에 저장해 달라고 요청합니다'
    : kind === 'update' ? '업데이트된 기획서를 Figma 배너·상세페이지에 반영해 달라고 요청합니다' : 'Figma에 배너(카피)와 상세페이지를 세팅해 달라고 요청합니다';
  let button: ReactNode;

  if (loading) {
    button = <span className={`${chip} text-gray-300 border-gray-200`}><Loader2 size={11} className="animate-spin" />확인 중</span>;
  } else if (!status || status === 'no_folder' || status === 'failed') {
    const retry = status === 'failed';
    button = (
      <button type="button" disabled={!canRequest || sending} onClick={() => setDialog('first')}
        title={error || (retry ? `${job?.message || '세팅 중 문제가 생겼어요'} — 다시 요청합니다` : requestTitle)}
        className={`${chip} ${retry ? 'text-red-500 border-red-200 bg-red-50 hover:bg-red-100' : 'text-indigo-600 border-indigo-200 bg-white hover:bg-indigo-50'} disabled:opacity-50 disabled:cursor-default`}>
        {sending ? <Loader2 size={11} className="animate-spin" /> : retry ? <AlertCircle size={11} /> : null}
        {retry ? text.failed : text.request}
      </button>
    );
  } else if (status === 'requested') {
    button = <span className={`${chip} text-amber-600 border-amber-200 bg-amber-50`} title="디자이너 맥이 켜지면 자동으로 시작돼요"><Clock size={11} className="animate-pulse" />요청대기</span>;
  } else if (status === 'running') {
    button = <span className={`${chip} text-blue-600 border-blue-200 bg-blue-50`} title={kind === 'save' ? 'Figma에서 이미지를 내보내 드라이브에 저장하고 있어요. 보통 5~15분 걸려요' : 'Figma에 세팅하고 있어요. 보통 10~30분 걸려요'}><Loader2 size={11} className="animate-spin" />{text.running}</span>;
  } else {
    // 세팅완료 — 누르면 배너 보드(없으면 상세페이지)를 연다
    const url = kind === 'save' ? undefined : (job?.bannerUrl || job?.landingUrl);  // 저장은 드라이브라 링크 대신 저장 개수를 툴팁으로
    const doneTitle = [job?.planVersion && `기획서 ${job.planVersion} 반영`, kind !== 'save' && job?.bannerUrl && '배너 보드 열기', job?.message].filter(Boolean).join(' · ') || text.done;
    const doneChip = url
      ? <a href={url} target="_blank" rel="noreferrer" title={doneTitle} className={`${chip} text-green-600 border-green-200 bg-green-50 hover:bg-green-100`}><Check size={11} />{text.done}</a>
      : <span className={`${chip} text-green-600 border-green-200 bg-green-50`} title={doneTitle}><Check size={11} />{text.done}</span>;
    // 세팅완료 뒤에도 다시 요청할 수 있게 (기획서가 바뀌었거나 Figma에서 지운 경우)
    button = (
      <>
        {doneChip}
        <button type="button" disabled={!canRequest || sending} onClick={() => setDialog('again')}
          title={canRequest ? `기획서 기준으로 ${text.again}` : requestTitle}
          className={`${chip} text-indigo-600 border-indigo-200 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-default`}>
          {sending ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}{text.again}
        </button>
      </>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 mt-1 mb-2">
      {folderBadge}
      {middle}
      {button}
      {dialog && (
        <ScopeDialog taskTitle={task.title} kind={kind} again={dialog === 'again'} latestPlan={latestPlan} lastVersion={lastVersion || undefined} imageAt={imageAt} onCancel={() => setDialog(null)}
          onPick={scope => { const again = dialog === 'again'; setDialog(null); request(again, scope); }} />
      )}
    </div>
  );
}


// 세팅요청 팝업 — 앱 확인 팝업(ConfirmDialog)과 같은 모양에 선택지 3개
function ScopeDialog({ taskTitle, kind, again, latestPlan, lastVersion, imageAt, onPick, onCancel }: { taskTitle: string; kind: FigmaSetupKind; again: boolean; latestPlan?: { version: string; file: string }; lastVersion?: string; imageAt?: string; onPick: (scope: FigmaSetupScope) => void; onCancel: () => void }) {
  const t = FIGMA_SETUP_TEXT[kind];
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
          <h2 className="text-sm font-semibold text-gray-900">{again ? t.again : t.request}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={17} /></button>
        </div>
        <div className="px-5 py-6 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-50">
            {again ? <RotateCcw size={24} className="text-indigo-400" /> : kind === 'save' ? <Download size={24} className="text-indigo-400" /> : kind === 'image' ? <ImageIcon size={24} className="text-indigo-400" /> : <Send size={24} className="text-indigo-400" />}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 truncate max-w-[280px] mx-auto" title={taskTitle}>{taskTitle}</p>
            <p className="text-sm text-gray-500 mt-1">{again ? t.againQuestion : t.question}</p>
            <p className="text-xs text-gray-400 mt-1.5">{again ? t.againSub : t.sub}</p>
          </div>
          {kind === 'image' && (
            <div className="w-full rounded-xl border border-black/5 bg-gray-50/60 p-3 flex justify-between text-[11px]">
              <span className="text-gray-500">배너 원본 이미지 (99_가이드/banner_img.png)</span>
              <span className={imageAt ? 'text-gray-800 font-semibold' : 'text-red-500 font-semibold'}>{imageAt ? `${fmtTime(imageAt)} 올림` : '없음'}</span>
            </div>
          )}
          {(kind === 'initial' || kind === 'update') && <PlanInfo kind={kind} latest={latestPlan} lastVersion={lastVersion} />}
          <UsagePanel />
        </div>
        {kind === 'image' ? (
          <div className="flex gap-2 px-5 pb-3">
            <button onClick={() => onPick('banner')} disabled={!imageAt}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-40">
              {again ? t.again : t.request}
            </button>
          </div>
        ) : (
          <div className="flex gap-2 px-5 pb-3">
            {pick('banner')}
            {pick('landing')}
            {pick('both', true)}
          </div>
        )}
        {kind === 'save' && (
          <div className="px-5 pb-3">
            <button onClick={() => onPick('draft')} title="보드 전체·상세페이지 전체 이미지를 드라이브 00_시안 폴더에만 저장해요"
              className="w-full py-2.5 text-sm font-semibold rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">
              {FIGMA_SETUP_SCOPE_LABEL.draft} <span className="font-normal text-indigo-400">· 00_시안 폴더</span>
            </button>
          </div>
        )}
        <div className="px-5 pb-5">
          <button onClick={onCancel} className="w-full py-2 text-sm font-medium rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
        </div>
      </div>
    </div>
  );
}


// ── 팝업 안 기획서 버전 (파일 이름의 v1.0, v2.0 …) ──
const verKey = (v?: string) => (v ?? '').replace(/^v/i, '').split('.').map(n => Number(n) || 0);
const verCmp = (a?: string, b?: string) => {
  const x = verKey(a), y = verKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
};

function PlanInfo({ kind, latest, lastVersion }: { kind: FigmaSetupKind; latest?: { version: string; file: string }; lastVersion?: string }) {
  if (!latest) return <div className="w-full text-[11px] text-gray-400 text-center">기획서 버전 확인 전이에요 (디자이너 맥이 켜지면 확인돼요)</div>;
  const isNew = !lastVersion || verCmp(latest.version, lastVersion) > 0;
  const notice = kind === 'update'
    ? (isNew ? { cls: 'bg-green-50 text-green-700', text: lastVersion ? `새 버전이 있어요 (${lastVersion} → ${latest.version || '버전 없음'}) — 바뀐 글자만 찾아서 반영해요` : `${latest.version || '최신 기획서'}로 반영해요` }
             : { cls: 'bg-amber-50 text-amber-700', text: `새 버전이 없어요 — 지난번에 ${lastVersion}를 반영했어요. 요청해도 Figma는 바뀌지 않아요` })
    : null;
  return (
    <div className="w-full rounded-xl border border-black/5 bg-gray-50/60 p-3 flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-gray-500">사용할 기획서</span>
        <span className="text-gray-800 font-semibold">{latest.version || '버전 표시 없음'}</span>
      </div>
      <div className="text-[10px] text-gray-400 truncate" title={latest.file}>{latest.file}</div>
      {lastVersion && (
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-500">지난번 반영</span>
          <span className="text-gray-600">{lastVersion}</span>
        </div>
      )}
      {notice && <div className={`text-[11px] rounded-lg px-2.5 py-1.5 ${notice.cls}`}>{notice.text}</div>}
    </div>
  );
}
