import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface NoticeInfo {
  id: string;
  teamId: string;
}

// 사용자 소속 팀의 공지 목록 구독 (in 쿼리 + isNotice 클라이언트 필터)
export function useTeamNotices(teamIds: string[]): NoticeInfo[] {
  const [notices, setNotices] = useState<NoticeInfo[]>([]);

  useEffect(() => {
    if (!teamIds.length) { setNotices([]); return; }
    const q = query(collection(db, 'posts'), where('teamId', 'in', teamIds));
    const unsub = onSnapshot(q, snap => {
      setNotices(
        snap.docs
          .filter(d => d.data().isNotice === true)
          .map(d => ({ id: d.id, teamId: d.data().teamId as string }))
      );
    }, () => setNotices([]));
    return unsub;
  }, [teamIds.join(',')]);

  return notices;
}
