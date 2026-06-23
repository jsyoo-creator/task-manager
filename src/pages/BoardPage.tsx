import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Plus, Trash2, Send, X } from 'lucide-react';
import type { AppUser, Team } from '../types';
import { usePosts, useComments, type Post, type PostComment } from '../hooks/usePosts';

// ─── 유틸 ────────────────────────────────────────────────
function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return '방금 전';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function Avatar({ name, photoURL, size = 8 }: { name: string; photoURL?: string; size?: number }) {
  const px = size * 4;
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover flex-shrink-0 ring-1 ring-black/5"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#6C63FF] to-[#9B8FFF] flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{ width: px, height: px, fontSize: px < 32 ? 10 : 12 }}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ─── 댓글 아이템 ──────────────────────────────────────────
function CommentItem({ comment, canDelete, onDelete }: {
  comment: PostComment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2.5 group">
      <Avatar name={comment.authorName} photoURL={comment.authorPhotoURL} size={7} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-800">{comment.authorName}</span>
          <span className="text-[10px] text-gray-400">{formatRelative(comment.createdAt)}</span>
          {canDelete && (
            <button
              onClick={onDelete}
              className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-400 transition-all"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
          {comment.content}
        </p>
      </div>
    </div>
  );
}

// ─── 댓글 섹션 ────────────────────────────────────────────
function CommentSection({ postId, appUser }: { postId: string; appUser: AppUser }) {
  const { comments, addComment, deleteComment } = useComments(postId);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  return (
    <div className="mt-4 pt-4 border-t border-black/5">
      {comments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2 mb-3">첫 번째 댓글을 남겨보세요</p>
      ) : (
        <div className="space-y-3 mb-4">
          {comments.map(c => (
            <CommentItem
              key={c.id}
              comment={c}
              canDelete={c.authorUid === appUser.uid || appUser.role === 'superadmin'}
              onDelete={() => deleteComment(c.id)}
            />
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Avatar name={appUser.displayName} photoURL={appUser.photoURL} size={7} />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
          placeholder="댓글 달기… (Ctrl+Enter로 등록)"
          rows={1}
          className="flex-1 text-xs px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/40 resize-none text-gray-800 placeholder:text-gray-400"
          style={{ minHeight: 36, maxHeight: 120 }}
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#6C63FF] text-white disabled:opacity-40 hover:bg-[#5a52e0] transition-colors flex-shrink-0"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── 게시글 카드 ──────────────────────────────────────────
function PostCard({ post, appUser, expanded, onToggle, onDelete }: {
  post: Post;
  appUser: AppUser;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const canDelete = post.authorUid === appUser.uid || appUser.role === 'superadmin';

  return (
    <div className={`glass-card transition-all duration-200 ${expanded ? 'ring-1 ring-[#6C63FF]/25' : ''}`}>
      <div className="p-4">
        {/* 작성자 행 */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <Avatar name={post.authorName} photoURL={post.authorPhotoURL} size={8} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-gray-800">{post.authorName}</span>
            <span className="text-[10px] text-gray-400 ml-1.5">{formatRelative(post.createdAt)}</span>
          </div>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* 제목 */}
        <h3
          className="text-sm font-semibold text-gray-900 mb-1.5 cursor-pointer hover:text-[#6C63FF] transition-colors"
          onClick={onToggle}
        >
          {post.title}
        </h3>

        {/* 본문 */}
        {expanded ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
            {post.content}
          </p>
        ) : (
          <p
            className="text-sm text-gray-500 cursor-pointer leading-relaxed"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            onClick={onToggle}
          >
            {post.content}
          </p>
        )}

        {/* 접힌 상태 푸터 */}
        {!expanded && (
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 mt-2.5 text-[11px] text-gray-400 hover:text-[#6C63FF] transition-colors"
          >
            <MessageSquare size={12} />
            <span>댓글 달기</span>
          </button>
        )}

        {/* 펼친 상태 — 댓글 섹션 */}
        {expanded && <CommentSection postId={post.id} appUser={appUser} />}
      </div>
    </div>
  );
}

// ─── 글쓰기 모달 ──────────────────────────────────────────
function WriteModal({ teamLabel, onClose, onSubmit }: {
  teamLabel: string;
  onClose: () => void;
  onSubmit: (title: string, content: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(title.trim(), content.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h2 className="text-sm font-semibold text-gray-900">
            새 글 작성{' '}
            <span className="text-gray-400 font-normal">— {teamLabel}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={17} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            autoFocus
            className="w-full text-sm font-medium px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/40 text-gray-900 placeholder:text-gray-400"
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
            placeholder="내용을 입력하세요 (Ctrl+Enter로 등록)"
            rows={6}
            className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]/40 text-gray-800 placeholder:text-gray-400 resize-none leading-relaxed"
          />
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !content.trim() || submitting}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white disabled:opacity-50 transition-colors"
          >
            {submitting ? '등록 중…' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 삭제 확인 모달 ───────────────────────────────────────
function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-[300px] mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl p-5 flex flex-col items-center gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <Trash2 size={20} className="text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">글을 삭제할까요?</p>
          <p className="text-xs text-gray-400 mt-1">삭제 후 복구할 수 없습니다</p>
        </div>
        <div className="flex gap-2 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────
interface Props {
  appUser: AppUser;
  teams: Team[];
}

export default function BoardPage({ appUser, teams }: Props) {
  const userTeams = teams.filter(t => appUser.selectedTeamIds?.includes(t.id));
  const [activeTeamId, setActiveTeamId] = useState<string | null>(userTeams[0]?.id ?? null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [showWrite, setShowWrite] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (userTeams.length > 0 && (!activeTeamId || !userTeams.some(t => t.id === activeTeamId))) {
      setActiveTeamId(userTeams[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTeams.map(t => t.id).join(',')]);

  const activeTeam = userTeams.find(t => t.id === activeTeamId) ?? null;
  const { posts, loading, addPost, deletePost } = usePosts(activeTeamId);

  const handleWrite = async (title: string, content: string) => {
    if (!activeTeamId) return;
    await addPost({
      teamId: activeTeamId,
      authorUid: appUser.uid,
      authorName: appUser.displayName,
      authorPhotoURL: appUser.photoURL,
      title,
      content,
    });
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    await deletePost(deleteTargetId);
    if (expandedPostId === deleteTargetId) setExpandedPostId(null);
    setDeleteTargetId(null);
  };

  const handleTeamChange = (teamId: string) => {
    setActiveTeamId(teamId);
    setExpandedPostId(null);
  };

  // 소속 팀 없음
  if (userTeams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#6C63FF]/10 flex items-center justify-center">
          <MessageSquare size={24} className="text-[#6C63FF]" />
        </div>
        <p className="text-sm text-gray-500">소속 팀이 없어 게시판을 볼 수 없습니다.</p>
        <p className="text-xs text-gray-400">설정에서 팀을 선택해주세요.</p>
      </div>
    );
  }

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center">
              <MessageSquare size={14} className="text-[#6C63FF]" />
            </div>
            <h1 className="text-base font-bold text-gray-900">커뮤니티</h1>
          </div>

          {/* 팀 탭 (2개 이상일 때만) */}
          {userTeams.length > 1 && (
            <div className="flex items-center gap-1 p-1 rounded-[12px] bg-gray-100 border border-black/6">
              {userTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTeamChange(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all ${
                    t.id === activeTeamId
                      ? 'bg-white text-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)]'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          )}

          {userTeams.length === 1 && activeTeam && (
            <span className="text-sm text-gray-400">
              {activeTeam.emoji} {activeTeam.name}
            </span>
          )}
        </div>

        <button
          onClick={() => setShowWrite(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-[13px] font-semibold transition-colors shadow-md shadow-[#6C63FF]/25"
        >
          <Plus size={14} />
          <span>글 쓰기</span>
        </button>
      </div>

      {/* 게시글 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="space-y-1.5">
                  <div className="h-2.5 w-20 bg-gray-200 rounded-full" />
                  <div className="h-2 w-14 bg-gray-100 rounded-full" />
                </div>
              </div>
              <div className="h-3 w-1/2 bg-gray-200 rounded-full mb-2" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-full bg-gray-100 rounded-full" />
                <div className="h-2.5 w-2/3 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(108,99,255,0.08)' }}>
            <MessageSquare size={20} style={{ color: 'rgba(108,99,255,0.45)' }} />
          </div>
          <p className="text-sm text-gray-400">아직 작성된 글이 없습니다</p>
          <button
            onClick={() => setShowWrite(true)}
            className="text-[13px] font-semibold text-[#6C63FF] hover:underline"
          >
            첫 번째 글을 작성해보세요
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              appUser={appUser}
              expanded={expandedPostId === post.id}
              onToggle={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
              onDelete={() => setDeleteTargetId(post.id)}
            />
          ))}
        </div>
      )}

      {/* 삭제 확인 */}
      {deleteTargetId && (
        <DeleteModal onConfirm={handleDelete} onCancel={() => setDeleteTargetId(null)} />
      )}

      {/* 글쓰기 모달 */}
      {showWrite && activeTeam && (
        <WriteModal
          teamLabel={`${activeTeam.emoji} ${activeTeam.name}`}
          onClose={() => setShowWrite(false)}
          onSubmit={handleWrite}
        />
      )}
    </>
  );
}
