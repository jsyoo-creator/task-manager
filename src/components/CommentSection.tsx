import { useRef, useState } from 'react';
import { MessageSquare, Pencil, Trash2, Send } from 'lucide-react';
import type { AppUser } from '../types';
import { useComments, type PostComment } from '../hooks/usePosts';

// 댓글은 일반 텍스트로 저장되므로 dangerouslySetInnerHTML 없이, URL만 골라
// <a> 엘리먼트로 바꿔 안전하게 클릭 가능한 링크로 렌더링
function linkify(text: string) {
  // split의 캡처 그룹 덕에 매칭된 URL도 결과 배열에 그대로 끼어 들어옴 —
  // 매 호출마다 새 정규식을 만들어야 g 플래그의 lastIndex 상태가 다음 호출로 새지 않음
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-[#6C63FF] underline break-all">{part}</a>
      : <span key={i}>{part}</span>
  );
}

export function formatRelative(iso: string): string {
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

export function Avatar({ name, photoURL, size = 8 }: { name: string; photoURL?: string; size?: number }) {
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

function DeleteModal({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
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

// postId 자리에 게시글 id뿐 아니라 AiTool id 등 임의의 문서 id를 넘겨도 됨 —
// comments 컬렉션은 postId 필드로만 묶이는 평평한 구조라 게시판 종류를 가리지 않음
export default function CommentSection({ postId, appUser, canManageBoard, parentCollection }: { postId: string; appUser: AppUser; canManageBoard: boolean; parentCollection?: string }) {
  const { comments, addComment, updateComment, deleteComment } = useComments(postId, parentCollection);
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
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words leading-relaxed">{linkify(c.content)}</p>
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
