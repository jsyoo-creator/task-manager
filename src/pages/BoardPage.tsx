import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MessageSquare, Plus, Trash2, Send, Pin, PinOff, Pencil, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { AppUser, Team } from '../types';
import { usePosts, useComments, type Post, type PostComment } from '../hooks/usePosts';
import AiToolBoard from '../components/AiToolBoard';

// ─── 유틸 ─────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${M}.${D}`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return '방금 전';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d2 = Math.floor(h / 24);
  if (d2 < 7) return `${d2}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function Avatar({ name, photoURL, size = 8 }: { name: string; photoURL?: string; size?: number }) {
  const px = size * 4;
  if (photoURL) {
    return (
      <img src={photoURL} alt={name} referrerPolicy="no-referrer"
        className="rounded-full object-cover flex-shrink-0 ring-1 ring-black/5"
        style={{ width: px, height: px }} />
    );
  }
  return (
    <div className="rounded-full bg-gradient-to-br from-[#6C63FF] to-[#9B8FFF] flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{ width: px, height: px, fontSize: px < 32 ? 10 : 12 }}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ─── 삭제 확인 모달 ───────────────────────────────────────────────────
function DeleteModal({ label, onConfirm, onCancel }: {
  label: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-[300px] mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl p-5 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <Trash2 size={20} className="text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{label}을 삭제할까요?</p>
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

// ─── 페이지네이션 ─────────────────────────────────────────────────────
const PAGE_SIZE = 10;

function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push(-1);
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push(-2);
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center justify-center gap-1 py-3 border-t border-gray-50">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}
        className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft size={13} /> 이전
      </button>
      {pages.map((p, i) =>
        p < 0
          ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-300">…</span>
          : <button key={p} onClick={() => onChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                p === page ? 'bg-[#6C63FF] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{p}</button>
      )}
      <button disabled={page === totalPages} onClick={() => onChange(page + 1)}
        className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        다음 <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ─── 목록 뷰 ──────────────────────────────────────────────────────────
function ListView({ posts, loading, page, onPageChange, onSelect, onWrite }: {
  posts: Post[];
  loading: boolean;
  page: number;
  onPageChange: (p: number) => void;
  onSelect: (postId: string) => void;
  onWrite: () => void;
}) {
  const noticePosts = posts
    .filter(p => p.isNotice)
    .sort((a, b) => (a.noticeAt ?? '').localeCompare(b.noticeAt ?? ''));
  const regularPosts = posts.filter(p => !p.isNotice);
  const totalRegular = regularPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalRegular / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRegular = regularPosts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const PostRow = ({ post, index, isNotice }: { post: Post; index?: number; isNotice?: boolean }) => (
    <div
      onClick={() => onSelect(post.id)}
      className={`flex items-center px-5 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-0 group ${
        isNotice ? 'bg-[#6C63FF]/[0.03] hover:bg-[#6C63FF]/[0.06]' : 'hover:bg-gray-50'
      }`}
    >
      {/* 구분 */}
      <div className="w-14 flex-shrink-0 flex justify-center">
        {isNotice ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#6C63FF] text-white tracking-wide">공지</span>
        ) : (
          <span className="text-xs text-gray-300 tabular-nums">{index}</span>
        )}
      </div>
      {/* 제목 */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className={`text-sm truncate group-hover:text-[#6C63FF] transition-colors ${
          isNotice ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
        }`}>
          {post.title}
        </span>
        {(post.commentCount ?? 0) > 0 && (
          <span className="text-[11px] font-semibold text-[#6C63FF] flex-shrink-0">[{post.commentCount}]</span>
        )}
      </div>
      {/* 작성자 */}
      <div className="w-24 flex-shrink-0 hidden sm:flex items-center justify-center gap-1.5">
        <Avatar name={post.authorName} photoURL={post.authorPhotoURL} size={6} />
        <span className="text-xs text-gray-500 truncate">{post.authorName}</span>
      </div>
      {/* 날짜 */}
      <div className="w-14 flex-shrink-0 text-center">
        <span className="text-xs text-gray-400">{formatDate(post.createdAt)}</span>
      </div>
    </div>
  );

  return (
    <div className="glass-card">
      {/* 테이블 헤더 */}
      <div className="flex items-center px-5 py-2.5 border-b border-gray-100 bg-gray-50/50">
        <div className="w-14 flex-shrink-0 text-center text-[11px] font-semibold text-gray-400">구분</div>
        <div className="flex-1 pl-1 text-[11px] font-semibold text-gray-400">제목</div>
        <div className="w-24 flex-shrink-0 text-center text-[11px] font-semibold text-gray-400 hidden sm:block">작성자</div>
        <div className="w-14 flex-shrink-0 text-center text-[11px] font-semibold text-gray-400">날짜</div>
      </div>

      {loading ? (
        <div className="divide-y divide-gray-50">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center px-5 py-3 gap-4 animate-pulse">
              <div className="w-14 flex justify-center"><div className="h-2.5 w-6 bg-gray-200 rounded-full" /></div>
              <div className="flex-1"><div className="h-2.5 w-2/3 bg-gray-200 rounded-full" /></div>
              <div className="w-20 hidden sm:block"><div className="h-2 w-12 bg-gray-100 rounded-full mx-auto" /></div>
              <div className="w-14"><div className="h-2 w-8 bg-gray-100 rounded-full mx-auto" /></div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(108,99,255,0.08)' }}>
            <MessageSquare size={20} style={{ color: 'rgba(108,99,255,0.4)' }} />
          </div>
          <p className="text-sm text-gray-400">아직 작성된 글이 없습니다</p>
          <button onClick={onWrite} className="text-[13px] font-semibold text-[#6C63FF] hover:underline">
            첫 번째 글을 작성해보세요
          </button>
        </div>
      ) : (
        <>
          {/* 공지 */}
          {noticePosts.map(post => (
            <PostRow key={post.id} post={post} isNotice />
          ))}
          {/* 구분선 */}
          {noticePosts.length > 0 && regularPosts.length > 0 && (
            <div className="h-px bg-gray-200 mx-5" />
          )}
          {/* 일반 글 */}
          {pagedRegular.map((post, i) => (
            <PostRow key={post.id} post={post} index={totalRegular - ((safePage - 1) * PAGE_SIZE + i)} />
          ))}
        </>
      )}
      <Pagination page={safePage} totalPages={totalPages} onChange={onPageChange} />
    </div>
  );
}

// ─── 글쓰기 뷰 ────────────────────────────────────────────────────────
function WriteView({ activeTeam, appUser, canSetNotice, onBack, onSubmit }: {
  activeTeam: Team;
  appUser: AppUser;
  canSetNotice: boolean;
  onBack: () => void;
  onSubmit: (title: string, content: string, isNotice: boolean) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isNotice, setIsNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(title.trim(), content.trim(), isNotice);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5">
        <button onClick={onBack} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-gray-900">글 쓰기</h2>
        <span className="text-sm text-gray-400">{activeTeam.emoji} {activeTeam.name}</span>
        <div className="flex-1" />
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim() || submitting}
          className="px-4 py-1.5 text-sm font-semibold rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white disabled:opacity-40 transition-colors"
        >
          {submitting ? '등록 중…' : '등록'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* 공지 설정 */}
        {canSetNotice && (
          <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
            <div
              onClick={() => setIsNotice(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                isNotice ? 'bg-[#6C63FF]' : 'bg-gray-200'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                isNotice ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
            <span className={`text-sm font-medium transition-colors ${isNotice ? 'text-[#6C63FF]' : 'text-gray-600'}`}>
              공지로 설정
            </span>
            {isNotice && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#6C63FF] text-white">공지</span>
            )}
          </label>
        )}

        {/* 제목 */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">제목</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            autoFocus
            className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/50 text-gray-900 placeholder:text-gray-300 transition-all"
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">내용</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
            placeholder="내용을 입력하세요 (Ctrl+Enter로 등록)"
            rows={16}
            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/50 text-gray-800 placeholder:text-gray-300 resize-none leading-relaxed transition-all"
          />
        </div>
      </div>

      <div className="flex gap-2.5 px-5 pb-5">
        <button onClick={onBack} className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors">
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim() || submitting}
          className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white disabled:opacity-40 transition-colors"
        >
          {submitting ? '등록 중…' : '등록'}
        </button>
      </div>
    </div>
  );
}

// ─── 댓글 섹션 ────────────────────────────────────────────────────────
function CommentSection({ postId, appUser, canManageBoard }: { postId: string; appUser: AppUser; canManageBoard: boolean }) {
  const { comments, addComment, updateComment, deleteComment } = useComments(postId);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PostComment | null>(null);
  const [editTarget, setEditTarget] = useState<PostComment | null>(null);
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await addComment({
        postId,
        authorUid: appUser.uid,
        authorName: appUser.displayName,
        authorPhotoURL: appUser.photoURL,
        content: trimmed,
      });
      setText('');
      textareaRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c: PostComment) => {
    setEditTarget(c);
    setEditText(c.content);
  };

  const cancelEdit = () => {
    setEditTarget(null);
    setEditText('');
  };

  const handleEditSave = async () => {
    if (!editTarget || !editText.trim() || editSaving) return;
    setEditSaving(true);
    try {
      await updateComment(editTarget.id, editText.trim());
      cancelEdit();
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={14} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">댓글</span>
        <span className="text-xs text-gray-400">{comments.length}</span>
      </div>

      {comments.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">첫 번째 댓글을 남겨보세요</p>
      ) : (
        <div className="space-y-4 mb-5">
          {comments.map(c => {
            const canManage = c.authorUid === appUser.uid || canManageBoard;
            const isEditing = editTarget?.id === c.id;
            return (
              <div key={c.id} className="flex gap-3 group">
                <Avatar name={c.authorName} photoURL={c.authorPhotoURL} size={7} />
                <div className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800">{c.authorName}</span>
                    <span className="text-[10px] text-gray-400">{formatRelative(c.createdAt)}</span>
                    {canManage && !isEditing && (
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => startEdit(c)}
                          className="p-0.5 text-gray-400 hover:text-[#6C63FF] transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="p-0.5 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleEditSave(); if (e.key === 'Escape') cancelEdit(); }}
                        rows={2}
                        autoFocus
                        className="w-full text-sm px-3 py-2 rounded-lg border border-[#6C63FF]/40 bg-white focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 resize-none text-gray-800 transition-all"
                        style={{ minHeight: 56, maxHeight: 120 }}
                      />
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors">취소</button>
                        <button
                          onClick={handleEditSave}
                          disabled={!editText.trim() || editSaving}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#6C63FF] text-white hover:bg-[#5a52e0] disabled:opacity-40 transition-colors"
                        >
                          {editSaving ? '저장 중…' : '저장'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words leading-relaxed">{c.content}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 댓글 입력 */}
      <div className="flex items-end gap-2.5">
        <Avatar name={appUser.displayName} photoURL={appUser.photoURL} size={7} />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
          placeholder="댓글 달기… (Ctrl+Enter로 등록)"
          rows={1}
          className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/50 resize-none text-gray-800 placeholder:text-gray-400 transition-all"
          style={{ minHeight: 40, maxHeight: 120 }}
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#6C63FF] text-white disabled:opacity-40 hover:bg-[#5a52e0] transition-colors flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </div>

      {deleteTarget && (
        <DeleteModal
          label="댓글"
          onConfirm={() => { deleteComment(deleteTarget.id, deleteTarget.postId); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── 글 수정 뷰 ───────────────────────────────────────────────────────
function EditView({ post, onBack, onSubmit }: {
  post: Post;
  onBack: () => void;
  onSubmit: (title: string, content: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(title.trim(), content.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all"
        >
          <ArrowLeft size={14} />
          취소
        </button>
        <span className="text-sm font-semibold text-gray-700">글 수정</span>
      </div>

      <div className="px-6 py-5 space-y-4">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full text-base font-semibold px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/50 text-gray-800 placeholder:text-gray-400 transition-all"
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          rows={10}
          className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/50 resize-none text-gray-800 placeholder:text-gray-400 transition-all"
        />
      </div>

      <div className="flex justify-end gap-2.5 px-6 pb-5">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim() || submitting}
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#6C63FF] text-white hover:bg-[#5a52e0] disabled:opacity-40 transition-colors shadow-md shadow-[#6C63FF]/25"
        >
          {submitting ? '저장 중…' : '수정 완료'}
        </button>
      </div>
    </div>
  );
}

// ─── 글 읽기 뷰 ───────────────────────────────────────────────────────
function ReadView({ post, appUser, regularPosts, canSetNotice, canManageBoard, onBack, onDelete, onEdit, onSetNotice, onReadNotice, onNavigate }: {
  post: Post;
  appUser: AppUser;
  regularPosts: Post[];
  canSetNotice: boolean;
  canManageBoard: boolean;
  onBack: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSetNotice: (isNotice: boolean) => void;
  onReadNotice?: (postId: string) => void;
  onNavigate: (postId: string) => void;
}) {
  const canManage = post.authorUid === appUser.uid || canManageBoard;
  const canManageNotice = canSetNotice;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 공지 글이면 열람 즉시 읽음 처리
  useEffect(() => {
    if (post.isNotice && onReadNotice) onReadNotice(post.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  return (
    <>
      <div className="glass-card">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all"
          >
            <ArrowLeft size={14} />
            목록으로
          </button>
          <div className="flex-1" />
          {/* 공지 관리 버튼 (중간 관리자+) */}
          {canManageNotice && (
            <button
              onClick={() => onSetNotice(!post.isNotice)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                post.isNotice
                  ? 'bg-[#6C63FF]/10 text-[#6C63FF] hover:bg-[#6C63FF]/20'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {post.isNotice ? <PinOff size={12} /> : <Pin size={12} />}
              {post.isNotice ? '공지 해제' : '공지 설정'}
            </button>
          )}
          {/* 수정/삭제 버튼 */}
          {canManage && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
            >
              <Pencil size={12} />
              수정
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-400 hover:bg-red-100 transition-all"
            >
              <Trash2 size={12} />
              삭제
            </button>
          )}
        </div>

        {/* 제목 */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-2.5 mb-4">
            {post.isNotice && (
              <span className="flex-shrink-0 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#6C63FF] text-white">공지</span>
            )}
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{post.title}</h1>
          </div>

          {/* 메타 정보 */}
          <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
            <Avatar name={post.authorName} photoURL={post.authorPhotoURL} size={7} />
            <div>
              <span className="text-sm font-medium text-gray-700">{post.authorName}</span>
              <span className="text-xs text-gray-400 ml-2">{formatRelative(post.createdAt)}</span>
            </div>
            {(post.commentCount ?? 0) > 0 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                <MessageSquare size={12} />
                {post.commentCount}
              </span>
            )}
          </div>

          {/* 본문 */}
          <div className="py-6 min-h-[160px]">
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-[1.9]">{post.content}</p>
          </div>
        </div>

        {/* 댓글 */}
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
          <CommentSection postId={post.id} appUser={appUser} canManageBoard={canManageBoard} />
        </div>

        {/* 이전글 / 다음글 */}
        {!post.isNotice && (() => {
          const idx = regularPosts.findIndex(p => p.id === post.id);
          const prevPost = idx < regularPosts.length - 1 ? regularPosts[idx + 1] : null;
          const nextPost = idx > 0 ? regularPosts[idx - 1] : null;
          if (!prevPost && !nextPost) return null;
          return (
            <div className="border-t border-gray-100">
              {nextPost && (
                <button onClick={() => onNavigate(nextPost.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 group">
                  <span className="text-[11px] font-medium text-gray-400 w-12 flex-shrink-0">다음글</span>
                  <span className="text-sm text-gray-700 truncate group-hover:text-[#6C63FF] transition-colors">{nextPost.title}</span>
                </button>
              )}
              {prevPost && (
                <button onClick={() => onNavigate(prevPost.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors group">
                  <span className="text-[11px] font-medium text-gray-400 w-12 flex-shrink-0">이전글</span>
                  <span className="text-sm text-gray-700 truncate group-hover:text-[#6C63FF] transition-colors">{prevPost.title}</span>
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {showDeleteModal && (
        <DeleteModal
          label="글"
          onConfirm={() => { setShowDeleteModal(false); onDelete(); }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────
type BoardView = { type: 'list' } | { type: 'write' } | { type: 'read'; postId: string } | { type: 'edit'; postId: string };

interface Props {
  appUser: AppUser;
  teams: Team[];
  onReadNotice?: (postId: string) => void;
  canSetNotice: boolean;
  canManageBoard: boolean;
}

export default function BoardPage({ appUser, teams, onReadNotice, canSetNotice, canManageBoard }: Props) {
  const userTeams = teams.filter(t => appUser.selectedTeamIds?.includes(t.id));

  // 커뮤니티 진입 시 기본 화면은 'AI 툴 리스트' (팀 구분 없는 전체 공용 탭)
  const [activeView, setActiveView] = useState<'aitools' | string>('aitools');
  const [view, setView] = useState<BoardView>({ type: 'list' });
  const [listPage, setListPage] = useState(1);

  const activeTeamId = activeView === 'aitools' ? null : activeView;

  // 소속 팀 탭이 사라지면(팀 변경 등) AI 툴 리스트로 복귀
  useEffect(() => {
    if (activeView !== 'aitools' && !userTeams.some(t => t.id === activeView)) {
      setActiveView('aitools');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTeams.map(t => t.id).join(',')]);

  const { posts, loading, addPost, updatePost, deletePost, setNotice } = usePosts(activeTeamId);
  const activeTeam = userTeams.find(t => t.id === activeTeamId) ?? null;

  // 읽기/수정 뷰에서 글이 삭제됐으면 목록으로
  useEffect(() => {
    if ((view.type === 'read' || view.type === 'edit') && !loading && !posts.find(p => p.id === view.postId)) {
      setView({ type: 'list' });
    }
  }, [posts, loading, view]);

  const selectedPost = (view.type === 'read' || view.type === 'edit') ? (posts.find(p => p.id === view.postId) ?? null) : null;

  const handleEdit = async (title: string, content: string) => {
    if (view.type !== 'edit') return;
    await updatePost(view.postId, title, content);
    setView({ type: 'read', postId: view.postId });
  };

  const handleWrite = async (title: string, content: string, isNotice: boolean) => {
    if (!activeTeamId) return;
    await addPost({
      teamId: activeTeamId,
      authorUid: appUser.uid,
      authorName: appUser.displayName,
      authorPhotoURL: appUser.photoURL,
      title,
      content,
      ...(isNotice ? { isNotice: true } : {}),
    });
    setView({ type: 'list' });
  };

  const handleDelete = async (postId: string) => {
    await deletePost(postId);
    setView({ type: 'list' });
  };

  const handleTeamChange = (teamId: string) => {
    setActiveView(teamId);
    setView({ type: 'list' });
    setListPage(1);
  };
  const regularPosts = posts.filter(p => !p.isNotice);

  return (
    <>
      {/* 공통 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center">
              <MessageSquare size={14} className="text-[#6C63FF]" />
            </div>
            <h1 className="text-base font-bold text-gray-900">커뮤니티</h1>
          </div>

          {/* 탭: AI 툴 리스트(공용, 기본) + 소속 팀 게시판들 */}
          <div className="flex items-center gap-1 p-1 rounded-[12px] bg-gray-100 border border-black/6 flex-wrap">
            <button
              onClick={() => { setActiveView('aitools'); setView({ type: 'list' }); setListPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all ${
                activeView === 'aitools'
                  ? 'bg-white text-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)]'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              <Sparkles size={13} />
              <span>AI 툴 리스트</span>
            </button>
            {userTeams.map(t => (
              <button
                key={t.id}
                onClick={() => handleTeamChange(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all ${
                  t.id === activeView
                    ? 'bg-white text-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)]'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                <span>{t.emoji}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 글쓰기 버튼 — 팀 게시판 목록에서만 (AI 툴 리스트는 자체 추가 버튼 사용) */}
        {activeView !== 'aitools' && activeTeam && view.type === 'list' && (
          <button
            onClick={() => setView({ type: 'write' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-[13px] font-semibold transition-colors shadow-md shadow-[#6C63FF]/25"
          >
            <Plus size={14} />
            <span>글 쓰기</span>
          </button>
        )}
      </div>

      {/* 뷰 렌더 */}
      {activeView === 'aitools' ? (
        <AiToolBoard appUser={appUser} canManage={canManageBoard} />
      ) : !activeTeam ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#6C63FF]/10 flex items-center justify-center">
            <MessageSquare size={24} className="text-[#6C63FF]" />
          </div>
          <p className="text-sm text-gray-500">소속 팀이 없어 게시판을 볼 수 없습니다.</p>
          <p className="text-xs text-gray-400">설정에서 팀을 선택해주세요.</p>
        </div>
      ) : (
        <>
          {view.type === 'list' && (
            <ListView
              posts={posts}
              loading={loading}
              page={listPage}
              onPageChange={setListPage}
              onSelect={postId => setView({ type: 'read', postId })}
              onWrite={() => setView({ type: 'write' })}
            />
          )}

          {view.type === 'write' && activeTeam && (
            <WriteView
              activeTeam={activeTeam}
              appUser={appUser}
              canSetNotice={canSetNotice}
              onBack={() => setView({ type: 'list' })}
              onSubmit={handleWrite}
            />
          )}

          {view.type === 'read' && selectedPost && (
            <ReadView
              post={selectedPost}
              appUser={appUser}
              regularPosts={regularPosts}
              canSetNotice={canSetNotice}
              canManageBoard={canManageBoard}
              onBack={() => setView({ type: 'list' })}
              onDelete={() => handleDelete(selectedPost.id)}
              onEdit={() => setView({ type: 'edit', postId: selectedPost.id })}
              onSetNotice={isNotice => setNotice(selectedPost.id, isNotice)}
              onReadNotice={onReadNotice}
              onNavigate={postId => setView({ type: 'read', postId })}
            />
          )}

          {view.type === 'edit' && selectedPost && (
            <EditView
              post={selectedPost}
              onBack={() => setView({ type: 'read', postId: selectedPost.id })}
              onSubmit={handleEdit}
            />
          )}
        </>
      )}
    </>
  );
}
