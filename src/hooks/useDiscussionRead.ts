import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
