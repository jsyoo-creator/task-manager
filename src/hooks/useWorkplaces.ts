import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Workplace } from '../types';

// 근무지(클라이언트 TF 단위) 관리 — 플랫폼 관리자 전용, 필터 없이 전체 조회
export function useWorkplaces() {
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'workplaces'), orderBy('createdAt', 'asc')),
      snap => {
        setWorkplaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Workplace)));
        setLoading(false);
      },
      err => { console.error('workplaces:', err); setLoading(false); }
    );
    return unsub;
  }, []);

  const createWorkplace = async (name: string): Promise<string> => {
    const ref = await addDoc(collection(db, 'workplaces'), {
      name,
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  };

  const renameWorkplace = async (id: string, name: string) => {
    await updateDoc(doc(db, 'workplaces', id), { name });
  };

  // 메뉴 하나만 켜고 끄기 (전체 menuConfig를 덮어쓰지 않도록 dot-notation으로 갱신).
  // menuId는 '/' 없는 안전한 키여야 함 — Firestore 필드 이름에는 '/'를 쓸 수 없음
  const setMenuEnabled = async (id: string, menuId: string, enabled: boolean) => {
    await updateDoc(doc(db, 'workplaces', id), { [`menuConfig.${menuId}`]: enabled });
  };

  return { workplaces, loading, createWorkplace, renameWorkplace, setMenuEnabled };
}
