import { useEffect, useState } from 'react';
import { Image as ImageIcon, FileText, Pencil, X, ExternalLink } from 'lucide-react';
import { useFigmaBoards } from '../hooks/useFigmaBoards';

// 업무관리 툴바의 [배너판] [상세페이지판] — 고른 달의 Figma 판을 바로 연다.
// 월마다 새 판을 쓰기 때문에 링크는 사람이 등록한다 (자동화가 쓰는 보드 링크는 업무별로 따로 남는다).
export default function FigmaBoardLinks({ month, canManage, currentUserName }: {
  month: string | null;          // 'YYYY-MM' — 월 필터가 '전체'면 null
  canManage: boolean;
  currentUserName: string;
}) {
  const { boards, save } = useFigmaBoards(true);
  const [open, setOpen] = useState(false);
  const cur = month && boards ? boards[month] : undefined;
  const monthLabel = month ? `${Number(month.slice(5, 7))}월` : '';

  const chip = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all glass-card !rounded-lg !overflow-visible';

  const link = (kind: 'banner' | 'landing', label: string, Icon: typeof ImageIcon) => {
    const url = cur?.[kind];
    if (!month) {
      return (
        <span key={kind} className={`${chip} text-gray-300 cursor-default`} title="월을 고르면 그 달 Figma 판을 열 수 있어요">
          <Icon size={11} />{label}
        </span>
      );
    }
    if (!url) {
      return (
        <button key={kind} type="button" disabled={!canManage} onClick={() => setOpen(true)}
          title={canManage ? `${monthLabel} ${label} 링크를 등록합니다` : '업무 편집 권한이 있어야 등록할 수 있어요'}
          className={`${chip} text-gray-400 hover:text-indigo-600 disabled:hover:text-gray-400 disabled:cursor-default`}>
          <Icon size={11} />{label} 미등록
        </button>
      );
    }
    return (
      <a key={kind} href={url} target="_blank" rel="noreferrer" title={`${monthLabel} ${label} 열기 — ${url}`}
        className={`${chip} text-gray-600 hover:text-indigo-600`}>
        <Icon size={11} />{label}<ExternalLink size={10} className="text-gray-300" />
      </a>
    );
  };

  return (
    <>
      {link('banner', '배너판', ImageIcon)}
      {link('landing', '상세페이지판', FileText)}
      {month && canManage && (cur?.banner || cur?.landing) && (
        <button type="button" onClick={() => setOpen(true)} title={`${monthLabel} Figma 판 링크 수정`}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 transition-colors">
          <Pencil size={11} />
        </button>
      )}
      {open && month && (
        <BoardDialog month={month} cur={cur} currentUserName={currentUserName}
          onClose={() => setOpen(false)} onSave={save} />
      )}
    </>
  );
}

// 링크 등록 팝업 — 상태가 바뀌어도 높이가 변하지 않게 안내·오류 자리를 고정해 둔다
function BoardDialog({ month, cur, currentUserName, onClose, onSave }: {
  month: string;
  cur?: { banner?: string; landing?: string; updatedBy?: string; updatedAt?: string };
  currentUserName: string;
  onClose: () => void;
  onSave: (month: string, v: { banner: string; landing: string }, who: string) => Promise<void>;
}) {
  const [banner, setBanner] = useState(cur?.banner ?? '');
  const [landing, setLanding] = useState(cur?.landing ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const title = `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월 Figma 판`;
  const bad = (v: string) => !!v.trim() && !/^https:\/\/(www\.)?figma\.com\//.test(v.trim());

  const submit = async () => {
    if (bad(banner) || bad(landing)) { setError('Figma 주소(https://www.figma.com/…)만 넣을 수 있어요'); return; }
    setSaving(true); setError('');
    try {
      await onSave(month, { banner: banner.trim(), landing: landing.trim() }, currentUserName);
      onClose();
    } catch (e) {
      setError('저장하지 못했어요. 잠시 후 다시 눌러 주세요.');
      console.error('[figmaBoards] save failed', e);
      setSaving(false);
    }
  };

  const field = (label: string, hint: string, value: string, set: (v: string) => void) => (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-semibold text-gray-600">{label}</span>
        <span className="text-[10px] text-gray-400">{hint}</span>
      </div>
      <input value={value} onChange={e => set(e.target.value)} placeholder="https://www.figma.com/design/…"
        className={`w-full px-3 py-2 text-xs rounded-xl border bg-white outline-none transition-colors ${
          bad(value) ? 'border-red-200 focus:border-red-300' : 'border-black/8 focus:border-indigo-300'}`} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[380px] mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl flex flex-col break-keep"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={17} /></button>
        </div>
        <div className="px-5 py-5 flex flex-col gap-3">
          {field('배너판', '배너 보드가 있는 Figma', banner, setBanner)}
          {field('상세페이지판', '상세페이지가 있는 Figma', landing, setLanding)}
          <div className="rounded-xl bg-gray-50/60 border border-black/5 px-3 h-[38px] flex flex-col justify-center">
            <p className="text-[11px] text-gray-500 leading-tight">
              {cur?.updatedBy ? `${cur.updatedBy} 등록 · 달이 바뀌면 새 판 링크를 넣어 주세요` : '월마다 새 판을 쓰니 그 달 판 링크를 넣어 주세요'}
            </p>
          </div>
          <div className="h-[14px] text-[11px] text-red-500 leading-tight">{error}</div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
