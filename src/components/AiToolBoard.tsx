import { useMemo, useState } from 'react';
import { Sparkles, Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import type { AiTool, AppUser } from '../types';
import { useAiTools } from '../hooks/useAiTools';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'rank', label: '랭크순' },
  { key: 'popularity', label: '인기순' },
  { key: 'name', label: '이름순' },
];

type SortMode = 'rank' | 'popularity' | 'name';

const ICON_COLOR_PRESETS = ['#E8744F', '#1A1A1A', '#6C63FF', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

function DeleteConfirm({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-[300px] mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl p-5 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <Trash2 size={20} className="text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">'{label}'을 삭제할까요?</p>
          <p className="text-xs text-gray-400 mt-1">삭제 후 복구할 수 없습니다</p>
        </div>
        <div className="flex gap-2 w-full">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors">삭제</button>
        </div>
      </div>
    </div>
  );
}

function ToolFormModal({ initial, onSubmit, onClose }: {
  initial: AiTool | null;
  onSubmit: (data: Omit<AiTool, 'id' | 'authorUid' | 'authorName' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [rank, setRank] = useState(String(initial?.rank ?? ''));
  const [rankChange, setRankChange] = useState(String(initial?.rankChange ?? 0));
  const [popularity, setPopularity] = useState(String(initial?.popularity ?? 0));
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '));
  const [siteUrl, setSiteUrl] = useState(initial?.siteUrl ?? '');
  const [iconLabel, setIconLabel] = useState(initial?.iconLabel ?? '');
  const [iconColor, setIconColor] = useState(initial?.iconColor ?? ICON_COLOR_PRESETS[0]);
  const [submitting, setSubmitting] = useState(false);

  const valid = name.trim() && description.trim() && iconLabel.trim() && rank.trim() !== '';

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        rank: Number(rank) || 0,
        rankChange: Number(rankChange) || 0,
        popularity: Number(popularity) || 0,
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        siteUrl: siteUrl.trim() || undefined,
        iconLabel: iconLabel.trim().slice(0, 3),
        iconColor,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const iCls = "w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/50 text-gray-900 placeholder:text-gray-300 transition-all";
  const lCls = "block text-xs font-semibold text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-black/8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h2 className="text-sm font-bold text-gray-900">{initial ? 'AI 툴 수정' : 'AI 툴 추가'}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lCls}>순위</label>
              <input type="number" value={rank} onChange={e => setRank(e.target.value)} placeholder="1" className={iCls} />
            </div>
            <div>
              <label className={lCls}>순위 변동</label>
              <input type="number" value={rankChange} onChange={e => setRankChange(e.target.value)} className={iCls} />
            </div>
            <div>
              <label className={lCls}>인기 점수</label>
              <input type="number" value={popularity} onChange={e => setPopularity(e.target.value)} className={iCls} />
            </div>
          </div>

          <div>
            <label className={lCls}>이름</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="클로드(Claude)" className={iCls} />
          </div>

          <div>
            <label className={lCls}>한 줄 설명</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="채팅·업무 위임·코딩까지 한 번에 처리하는 앤트로픽의 AI LLM" className={iCls} />
          </div>

          <div>
            <label className={lCls}>카테고리 배지</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="AI · LLM" className={iCls} />
          </div>

          <div>
            <label className={lCls}>태그 (쉼표로 구분)</label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="대화형 AI, 글쓰기" className={iCls} />
          </div>

          <div>
            <label className={lCls}>공식 사이트 URL (선택)</label>
            <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://..." className={iCls} />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className={lCls}>아이콘 글자 (최대 3자)</label>
              <input value={iconLabel} onChange={e => setIconLabel(e.target.value.slice(0, 3))} placeholder="AI" className={iCls} />
            </div>
            <div className="flex items-center gap-1.5 pb-0.5">
              {ICON_COLOR_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setIconColor(c)}
                  className={`w-6 h-6 rounded-full flex-shrink-0 transition-all ${iconColor === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={iconColor} onChange={e => setIconColor(e.target.value)} className="w-6 h-6 rounded-full overflow-hidden cursor-pointer border-0 flex-shrink-0" />
            </div>
          </div>

          {/* 미리보기 */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: iconColor }}>
              {iconLabel || '?'}
            </div>
            <span className="text-sm font-semibold text-gray-700 truncate">{name || '이름 미입력'}</span>
          </div>
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
          <button onClick={handleSubmit} disabled={!valid || submitting}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white disabled:opacity-40 transition-colors">
            {submitting ? '저장 중…' : initial ? '수정 완료' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AiToolBoard({ appUser, canManage }: { appUser: AppUser; canManage: boolean }) {
  const { tools, loading, addTool, updateTool, deleteTool } = useAiTools();
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [formTarget, setFormTarget] = useState<'new' | AiTool | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiTool | null>(null);

  const sorted = useMemo(() => {
    const arr = [...tools];
    if (sortMode === 'rank') arr.sort((a, b) => a.rank - b.rank);
    else if (sortMode === 'popularity') arr.sort((a, b) => b.popularity - a.popularity);
    else arr.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return arr;
  }, [tools, sortMode]);

  const handleSubmit = async (data: Omit<AiTool, 'id' | 'authorUid' | 'authorName' | 'createdAt' | 'updatedAt'>) => {
    if (formTarget && formTarget !== 'new') {
      await updateTool(formTarget.id, data);
    } else {
      await addTool({ ...data, authorUid: appUser.uid, authorName: appUser.displayName });
    }
  };

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">오늘의 톱 {tools.length}</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setSortMode(opt.key)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                    sortMode === opt.key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {canManage && (
              <button onClick={() => setFormTarget('new')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-[12px] font-semibold transition-colors shadow-md shadow-[#6C63FF]/25">
                <Plus size={13} /><span>AI 툴 추가</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-8 h-4 bg-gray-100 rounded-full" />
                <div className="w-12 h-12 bg-gray-100 rounded-2xl" />
                <div className="flex-1"><div className="h-3 w-1/2 bg-gray-100 rounded-full" /></div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(108,99,255,0.08)' }}>
              <Sparkles size={20} style={{ color: 'rgba(108,99,255,0.4)' }} />
            </div>
            <p className="text-sm text-gray-400">아직 등록된 AI 툴이 없습니다</p>
            {canManage && (
              <button onClick={() => setFormTarget('new')} className="text-[13px] font-semibold text-[#6C63FF] hover:underline">
                첫 번째 AI 툴을 추가해보세요
              </button>
            )}
          </div>
        ) : (
          <div>
            {sorted.map((tool, i) => (
              <div key={tool.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0 group hover:bg-gray-50/60 transition-colors">
                <span className="w-7 text-sm font-bold text-gray-300 tabular-nums flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0" style={{ background: tool.iconColor }}>
                  {tool.iconLabel}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[15px] font-bold text-gray-900">{tool.name}</span>
                    {tool.description && <span className="text-[13px] text-gray-500">— {tool.description}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {tool.category && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#6C63FF]/10 text-[#6C63FF] flex-shrink-0">{tool.category}</span>
                    )}
                    {tool.tags.map((t, ti) => (
                      <span key={ti} className="text-[12px] text-gray-400">· {t}</span>
                    ))}
                    {tool.siteUrl && (
                      <a href={tool.siteUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        className="text-[12px] text-gray-400 hover:text-[#6C63FF] flex items-center gap-0.5 transition-colors">
                        · 공식 사이트<ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setFormTarget(tool)} className="p-1.5 text-gray-400 hover:text-[#6C63FF] hover:bg-gray-100 rounded-lg transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget(tool)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-100 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
                <div className="w-14 h-12 rounded-xl border border-gray-200 bg-white flex flex-col items-center justify-center flex-shrink-0">
                  <span className={`leading-none text-[10px] ${tool.rankChange < 0 ? 'text-red-400' : 'text-gray-700'}`}>
                    {tool.rankChange < 0 ? '▼' : '▲'}
                  </span>
                  <span className="text-sm font-bold text-gray-800 leading-none mt-0.5">{Math.abs(tool.rankChange)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formTarget && (
        <ToolFormModal
          initial={formTarget === 'new' ? null : formTarget}
          onSubmit={handleSubmit}
          onClose={() => setFormTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          label={deleteTarget.name}
          onConfirm={() => { deleteTool(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
