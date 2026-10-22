import { useEffect, useRef, useState } from 'react';
import { Figma, Image as ImageIcon, FileText, ChevronDown, ExternalLink, Pencil, X } from 'lucide-react';
import { useFigmaBoards, type FigmaBoard } from '../hooks/useFigmaBoards';

// 업무관리 툴바의 [피그마 설정] — 고른 달의 Figma 판(배너판·상세페이지판)을 열고, 링크를 등록한다.
// 월마다 새 판을 쓰기 때문에 링크는 사람이 넣는다 (자동화가 만든 업무별 보드 링크는 세부업무 카드에 따로 있다).
export default function FigmaBoardLinks({ month, canManage, currentUserName }: {
  month: string | null;          // 'YYYY-MM' — 월 필터가 '전체'면 null
  canManage: boolean;
  currentUserName: string;
}) {
  const { boards, save } = useFigmaBoards(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = month && boards ? boards[month] : undefined;
  const monthLabel = month ? `${Number(month.slice(5, 7))}월` : '';
  const done = !!(cur?.banner || cur?.landing);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // 판 한 줄 — 등록돼 있으면 눌러서 열고, 없으면 '미등록'
  const row = (kind: 'banner' | 'landing', label: string, Icon: typeof ImageIcon) => {
    const url = cur?.[kind];
    const base = 'w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-xs transition-colors';
    if (!url) {
      return (
        <div className={`${base} text-gray-400`}>
          <Icon size={12} className="flex-shrink-0" />
          <span className="flex-1 text-left">{label}</span>
          <span className="text-[11px] text-gray-300">미등록</span>
        </div>
      );
    }
    return (
      <a href={url} target="_blank" rel="noreferrer" title={url} onClick={() => setOpen(false)}
        className={`${base} text-gray-700 font-medium hover:bg-indigo-50 hover:text-indigo-600`}>
        <Icon size={12} className="flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ExternalLink size={11} className="text-gray-300 flex-shrink-0" />
      </a>
    );
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)} title={month ? `${monthLabel} Figma 판 열기·등록` : '월을 고르면 그 달 Figma 판을 열 수 있어요'}
        className={`h-7 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all glass-card !rounded-lg !overflow-visible ${
          done ? 'text-gray-700 hover:text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}>
        <Figma size={11} className={done ? 'text-indigo-500' : 'text-gray-400'} />
        피그마 설정
        <ChevronDown size={10} className="text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-20 w-[248px] bg-white rounded-xl shadow-lg border border-black/[0.06] p-1.5 break-keep">
          <div className="px-2.5 pt-1.5 pb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-bold text-gray-400">{month ? `${monthLabel} 피그마 판` : '피그마 판'}</span>
            {cur?.updatedBy && <span className="text-[10px] text-gray-300">{cur.updatedBy} 등록</span>}
          </div>
          {month ? (
            <>
              {row('banner', '배너판', ImageIcon)}
              {row('landing', '상세페이지판', FileText)}
              <div className="mt-1 pt-1.5 border-t border-black/[0.06]">
                <button type="button" disabled={!canManage} onClick={() => { setEdit(true); setOpen(false); }}
                  title={canManage ? `${monthLabel} 판 링크를 등록·수정합니다` : '업무 편집 권한이 있어야 등록할 수 있어요'}
                  className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-default">
                  <Pencil size={11} />{done ? '링크 수정' : '링크 등록'}
                </button>
              </div>
            </>
          ) : (
            <p className="px-2.5 py-3 text-[11px] text-gray-400 leading-relaxed">월을 고르면 그 달 판을 열 수 있어요.<br />월마다 새 판을 쓰기 때문이에요.</p>
          )}
        </div>
      )}

      {edit && month && (
        <BoardDialog month={month} cur={cur} currentUserName={currentUserName}
          onClose={() => setEdit(false)} onSave={save} />
      )}
    </div>
  );
}

// 링크 등록 팝업 — 상태가 바뀌어도 높이가 변하지 않게 안내·오류 자리를 고정해 둔다
function BoardDialog({ month, cur, currentUserName, onClose, onSave }: {
  month: string;
  cur?: FigmaBoard;
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

  const title = `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월 피그마 판`;
  // 월마다 그 달 페이지에 작업하므로, 파일 주소가 아니라 '그 달 페이지를 연 링크'(node-id 포함)를 받는다
  const bad = (v: string) => !!v.trim() && !(/^https:\/\/(www\.)?figma\.com\//.test(v.trim()) && /[?&]node-id=\d+-\d+/.test(v.trim()));

  const submit = async () => {
    if (bad(banner) || bad(landing)) { setError('그 달 페이지를 연 Figma 링크를 넣어 주세요 (주소에 node-id가 있어야 해요)'); return; }
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
          {field('배너판', "그 달 'ㄴ N월 Banner' 페이지 링크", banner, setBanner)}
          {field('상세페이지판', "그 달 'N월 Live Page' 링크", landing, setLanding)}
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
