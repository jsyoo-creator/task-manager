import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Sparkles, Pencil, Trash2, ExternalLink } from 'lucide-react';
import type { AiTool, AppUser } from '../types';
import { useAiTools } from '../hooks/useAiTools';
import RichTextEditor from './RichTextEditor';
import { sanitizeRichText, isRichTextEmpty, toDisplayHtml, extractToc } from '../lib/sanitizeRichText';

type SortMode = 'recommend' | 'name';
export type ToolView = { type: 'list' } | { type: 'write' } | { type: 'read'; toolId: string } | { type: 'edit'; toolId: string };

const CATEGORY_OPTIONS = ['AI · LLM', 'Workspace', '디자인·웹', '자동화'];

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'recommend', label: '추천순' },
  { key: 'name', label: '이름순' },
];

function ToolIcon({ iconUrl, name, size = 48 }: { iconUrl?: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (iconUrl && !broken) {
    return (
      <img
        src={iconUrl}
        alt={name}
        onError={() => setBroken(true)}
        className="rounded-2xl object-cover flex-shrink-0 bg-gray-100"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#9B8FFF] flex items-center justify-center flex-shrink-0 text-white"
      style={{ width: size, height: size }}>
      <Sparkles size={Math.round(size * 0.42)} />
    </div>
  );
}

function RecommendButton({ count, active, onClick }: { count: number; active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-14 h-12 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 transition-colors ${
        active ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300'
      }`}
    >
      <span className="leading-none text-[10px]">▲</span>
      <span className="text-sm font-bold leading-none mt-0.5">{count}</span>
    </button>
  );
}

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

// ─── 글쓰기 / 수정 뷰 — 일반 게시판 글쓰기와 동일한 형태 ────────────────
function ToolWriteView({ initial, onBack, onSubmit }: {
  initial: AiTool | null;
  onBack: () => void;
  onSubmit: (data: Omit<AiTool, 'id' | 'authorUid' | 'authorName' | 'createdAt' | 'updatedAt' | 'recommendedBy'>) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '');
  const [description, setDescription] = useState(() => (initial ? toDisplayHtml(initial.description) : ''));
  const [category, setCategory] = useState(initial?.category ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '));
  const [siteUrl, setSiteUrl] = useState(initial?.siteUrl ?? '');
  const [iconUrl, setIconUrl] = useState(initial?.iconUrl ?? '');
  const [submitting, setSubmitting] = useState(false);

  const valid = name.trim() && !isRichTextEmpty(description);

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        subtitle: subtitle.trim() || undefined,
        description: sanitizeRichText(description),
        category: category.trim(),
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        siteUrl: siteUrl.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const iCls = "w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/50 text-gray-900 placeholder:text-gray-300 transition-all";
  const lCls = "block text-xs font-semibold text-gray-500 mb-1.5";

  return (
    <div className="glass-card">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5">
        <button onClick={onBack} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-gray-900">{initial ? 'AI 툴 수정' : 'AI 툴 추가'}</h2>
        <div className="flex-1" />
        <button
          onClick={handleSubmit}
          disabled={!valid || submitting}
          className="px-4 py-1.5 text-sm font-semibold rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white disabled:opacity-40 transition-colors"
        >
          {submitting ? '등록 중…' : initial ? '수정 완료' : '등록'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className={lCls}>메인 제목</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="클로드(Claude)" autoFocus className={iCls} />
        </div>

        <div>
          <label className={lCls}>서브 제목 (선택, 목록에 메인 제목 옆 한 줄로 표시)</label>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="채팅·업무 위임·코딩까지 한 번에 처리하는 앤트로픽의 AI LLM" className={iCls} />
        </div>

        <div>
          <label className={lCls}>상세 설명</label>
          <RichTextEditor
            initialValue={description}
            onChange={setDescription}
            placeholder="상세 페이지에 보여줄 내용을 작성하거나, 서식이 있는 글을 그대로 붙여넣으세요"
          />
        </div>

        <div>
          <label className={lCls}>카테고리 (선택)</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setCategory(c => c === opt ? '' : opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  category === opt
                    ? 'bg-[#6C63FF] text-white border-[#6C63FF]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={lCls}>태그 (쉼표로 구분, 선택)</label>
          <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="대화형 AI, 글쓰기" className={iCls} />
        </div>

        <div>
          <label className={lCls}>공식 사이트 URL (선택)</label>
          <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://..." className={iCls} />
        </div>

        <div>
          <label className={lCls}>아이콘 이미지 URL (선택)</label>
          <div className="flex items-center gap-3">
            <ToolIcon iconUrl={iconUrl || undefined} name={name} size={40} />
            <input value={iconUrl} onChange={e => setIconUrl(e.target.value)} placeholder="https://.../icon.png" className={iCls} />
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 px-5 pb-5">
        <button onClick={onBack} className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
        <button
          onClick={handleSubmit}
          disabled={!valid || submitting}
          className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white disabled:opacity-40 transition-colors"
        >
          {submitting ? '등록 중…' : initial ? '수정 완료' : '등록'}
        </button>
      </div>
    </div>
  );
}

// ─── 상세 보기 뷰 ─────────────────────────────────────────────────────
function ToolReadView({ tool, canManage, hasRecommended, onBack, onToggleRecommend, onEdit, onDelete }: {
  tool: AiTool;
  canManage: boolean;
  hasRecommended: boolean;
  onBack: () => void;
  onToggleRecommend: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { html: descriptionHtml, headings } = useMemo(() => extractToc(toDisplayHtml(tool.description)), [tool.description]);

  const scrollToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasSidebar = tool.tags.length > 0 || headings.length > 0;

  return (
    <>
      <div className="glass-card">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5">
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all">
            <ArrowLeft size={14} />
            목록으로
          </button>
          <div className="flex-1" />
          {canManage && (
            <>
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
                <Pencil size={12} />수정
              </button>
              <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-400 hover:bg-red-100 transition-all">
                <Trash2 size={12} />삭제
              </button>
            </>
          )}
        </div>

        <div className="px-6 pt-6 pb-6">
          {/* 제목 영역 — 전체 너비 */}
          <div className="flex items-start gap-5">
            <ToolIcon iconUrl={tool.iconUrl} name={tool.name} size={64} />
            <div className="flex-1 min-w-0">
              {(tool.category || tool.tags.length > 0) && (
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  {tool.category && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#6C63FF]/10 text-[#6C63FF]">{tool.category}</span>
                  )}
                  {tool.tags.map((t, i) => (
                    <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">{t}</span>
                  ))}
                </div>
              )}
              <h1 className="text-3xl font-extrabold text-gray-900 leading-tight tracking-tight">{tool.name}</h1>
              {tool.subtitle && <p className="text-base font-semibold text-gray-500 mt-1.5">{tool.subtitle}</p>}
              {tool.siteUrl && (
                <a href={tool.siteUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-sm font-semibold transition-colors">
                  공식 사이트 열기 <ExternalLink size={14} />
                </a>
              )}
            </div>
            <RecommendButton count={tool.recommendedBy.length} active={hasRecommended} onClick={onToggleRecommend} />
          </div>

          {/* 본문 + 사이드바 — 제목 영역 아래에서 시작하는 2단 레이아웃 */}
          <div className="flex items-start gap-6 mt-6 pt-6 border-t border-gray-100">
            <div
              className="ai-tool-rich flex-1 min-w-0"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />

            {hasSidebar && (
              <div className="w-[220px] flex-shrink-0 space-y-6 pl-6 border-l border-gray-100 sticky top-6 hidden lg:block">
                {tool.tags.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 tracking-widest mb-3">USE CASE</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tool.tags.map((t, i) => (
                        <span key={i} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#6C63FF]/10 text-[#6C63FF]">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {headings.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 tracking-widest mb-3">CONTENTS</p>
                    <div className="flex flex-col gap-2.5">
                      {headings.map(h => (
                        <button
                          key={h.id}
                          onClick={() => scrollToHeading(h.id)}
                          style={{ paddingLeft: (h.level - 1) * 10 }}
                          className="text-left text-[13px] text-gray-600 hover:text-[#6C63FF] transition-colors leading-snug"
                        >
                          {h.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteConfirm
          label={tool.name}
          onConfirm={() => { setShowDeleteModal(false); onDelete(); }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}

export default function AiToolBoard({ appUser, canManage, view, onViewChange }: {
  appUser: AppUser;
  canManage: boolean;
  view: ToolView;
  onViewChange: (v: ToolView) => void;
}) {
  const { tools, loading, addTool, updateTool, deleteTool, toggleRecommend } = useAiTools();
  const [sortMode, setSortMode] = useState<SortMode>('recommend');
  const setView = onViewChange;
  const [deleteTarget, setDeleteTarget] = useState<AiTool | null>(null);

  const sorted = useMemo(() => {
    const arr = [...tools];
    if (sortMode === 'recommend') arr.sort((a, b) => b.recommendedBy.length - a.recommendedBy.length);
    else arr.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return arr;
  }, [tools, sortMode]);

  const selectedTool = (view.type === 'read' || view.type === 'edit') ? (tools.find(t => t.id === view.toolId) ?? null) : null;

  // 상세/수정 화면에서 항목이 삭제되면 목록으로
  useEffect(() => {
    if ((view.type === 'read' || view.type === 'edit') && !loading && !tools.find(t => t.id === view.toolId)) {
      setView({ type: 'list' });
    }
  }, [tools, loading, view]);

  const handleCreate = async (data: Omit<AiTool, 'id' | 'authorUid' | 'authorName' | 'createdAt' | 'updatedAt' | 'recommendedBy'>) => {
    await addTool({ ...data, authorUid: appUser.uid, authorName: appUser.displayName });
    setView({ type: 'list' });
  };

  const handleEdit = async (data: Omit<AiTool, 'id' | 'authorUid' | 'authorName' | 'createdAt' | 'updatedAt' | 'recommendedBy'>) => {
    if (view.type !== 'edit') return;
    await updateTool(view.toolId, data);
    setView({ type: 'read', toolId: view.toolId });
  };

  const handleToggleRecommend = (tool: AiTool) => {
    toggleRecommend(tool.id, appUser.uid, tool.recommendedBy.includes(appUser.uid));
  };

  if (view.type === 'write') {
    return <ToolWriteView initial={null} onBack={() => setView({ type: 'list' })} onSubmit={handleCreate} />;
  }
  if (view.type === 'edit' && selectedTool) {
    return <ToolWriteView initial={selectedTool} onBack={() => setView({ type: 'read', toolId: selectedTool.id })} onSubmit={handleEdit} />;
  }
  if (view.type === 'read' && selectedTool) {
    return (
      <ToolReadView
        tool={selectedTool}
        canManage={canManage}
        hasRecommended={selectedTool.recommendedBy.includes(appUser.uid)}
        onBack={() => setView({ type: 'list' })}
        onToggleRecommend={() => handleToggleRecommend(selectedTool)}
        onEdit={() => setView({ type: 'edit', toolId: selectedTool.id })}
        onDelete={() => { deleteTool(selectedTool.id); setView({ type: 'list' }); }}
      />
    );
  }

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">오늘의 톱 {tools.length}</h2>
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
              <button onClick={() => setView({ type: 'write' })} className="text-[13px] font-semibold text-[#6C63FF] hover:underline">
                첫 번째 AI 툴을 추가해보세요
              </button>
            )}
          </div>
        ) : (
          <div>
            {sorted.map((tool, i) => {
              const hasRecommended = tool.recommendedBy.includes(appUser.uid);
              return (
                <div key={tool.id}
                  onClick={() => setView({ type: 'read', toolId: tool.id })}
                  className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0 group hover:bg-gray-50/60 transition-colors cursor-pointer">
                  <span className="w-7 text-sm font-bold text-gray-300 tabular-nums flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <ToolIcon iconUrl={tool.iconUrl} name={tool.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-[15px] font-bold text-gray-900">{tool.name}</span>
                      {tool.subtitle && <span className="text-[13px] text-gray-500 truncate">— {tool.subtitle}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {tool.category && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#6C63FF]/10 text-[#6C63FF] flex-shrink-0">{tool.category}</span>
                      )}
                      {tool.tags.map((t, ti) => (
                        <span key={ti} className="text-[12px] text-gray-400">· {t}</span>
                      ))}
                      {tool.siteUrl && (
                        <span className="text-[12px] text-gray-400 flex items-center gap-0.5">· 공식 사이트<ExternalLink size={10} /></span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setView({ type: 'edit', toolId: tool.id })} className="p-1.5 text-gray-400 hover:text-[#6C63FF] hover:bg-gray-100 rounded-lg transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget(tool)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                  <RecommendButton
                    count={tool.recommendedBy.length}
                    active={hasRecommended}
                    onClick={e => { e.stopPropagation(); handleToggleRecommend(tool); }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

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
