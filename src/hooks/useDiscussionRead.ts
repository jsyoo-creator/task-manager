import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, setDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PostComment } from './usePosts';

// AI 툴 상세 '토론하기' 버튼에 안 읽은 댓글 수를 배지로 보여주기 위한 사용자별 열람 기록.
// 다른 사람과 공유되지 않는 나만의 상태라 실시간 구독 없이 1회 조회로 충분
export function useDiscussionRead(postId: string, uid: string) {
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const docId = `${uid}_${postId}`;

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    getDoc(doc(db, 'discussionReads', docId)).then(snap => {
      if (cancelled) return;
      setLastReadAt(snap.exists() ? (snap.data().lastReadAt ?? null) : null);
      setLoaded(true);
    }).catch(err => {
      console.error('useDiscussionRead error:', err);
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [docId]);

  const markRead = async () => {
    const now = new Date().toISOString();
    setLastReadAt(now);
    await setDoc(doc(db, 'discussionReads', docId), { uid, postId, lastReadAt: now });
  };

  return { lastReadAt, loaded, markRead };
}

// 목록 화면에서 각 항목 아이콘에 안 읽은 토론 배지를 띄우기 위한 일괄 조회 버전.
// postId별로 낱개 구독하는 대신, 댓글은 30개씩 끊어 'in' 쿼리로, 열람 기록은
// 이 사용자 것만 한 번에 가져와 클라이언트에서 매칭 — 목록이 길어도 쿼리 수가 늘지 않음
export function useDiscussionUnreadCounts(postIds: string[], uid: string): Record<string, number> {
  const idsKey = postIds.slice().sort().join(',');
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [readMap, setReadMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (postIds.length === 0) { setCommentsByPost({}); return; }
    const chunks: string[][] = [];
    for (let i = 0; i < postIds.length; i += 30) chunks.push(postIds.slice(i, i + 30));
    const perChunk: (PostComment[])[] = chunks.map(() => []);

    const unsubs = chunks.map((chunk, idx) => {
      const q = query(collection(db, 'comments'), where('postId', 'in', chunk));
      return onSnapshot(q, snap => {
        perChunk[idx] = snap.docs.map(d => d.data() as PostComment);
        const grouped: Record<string, PostComment[]> = {};
        perChunk.flat().forEach(c => { (grouped[c.postId] ??= []).push(c); });
        setCommentsByPost(grouped);
      }, err => console.error('useDiscussionUnreadCounts comments error:', err));
    });
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (!uid) { setReadMap({}); return; }
    const q = query(collection(db, 'discussionReads'), where('uid', '==', uid));
    const unsub = onSnapshot(q, snap => {
      const map: Record<string, string> = {};
      snap.docs.forEach(d => {
        const data = d.data() as { postId: string; lastReadAt: string };
        map[data.postId] = data.lastReadAt;
      });
      setReadMap(map);
    }, err => console.error('useDiscussionUnreadCounts reads error:', err));
    return unsub;
  }, [uid]);

  return useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(commentsByPost).forEach(([postId, comments]) => {
      const lastReadAt = readMap[postId];
      result[postId] = lastReadAt ? comments.filter(c => c.createdAt > lastReadAt).length : comments.length;
    });
    return result;
  }, [commentsByPost, readMap]);
}
