import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, deleteField, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AiTool } from '../types';

// collectionName으로 백엔드 Firestore 컬렉션을 지정 — 'AI 툴 리스트', 'AI UI 어휘 사전' 등
// 형식은 동일하지만 서로 데이터가 섞이지 않는 여러 게시판에서 재사용하기 위함
export function useAiTools(collectionName: string) {
  const [tools, setTools] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, collectionName), snap => {
      setTools(snap.docs.map(d => ({ id: d.id, recommendedBy: [], ...d.data() } as AiTool)));
      setLoading(false);
    }, err => {
      console.error('useAiTools error:', err);
      setLoading(false);
    });
    return unsub;
  }, [collectionName]);

  const addTool = async (data: Omit<AiTool, 'id' | 'createdAt' | 'updatedAt' | 'recommendedBy'>) => {
    await addDoc(collection(db, collectionName), {
      ...data,
      relatedToolIds: data.relatedToolIds ?? [],
      recommendedBy: [],
      createdAt: new Date().toISOString(),
    });
  };

  const updateTool = async (id: string, data: Omit<AiTool, 'id' | 'authorUid' | 'authorName' | 'createdAt' | 'updatedAt' | 'recommendedBy'>) => {
    const { subtitle, siteUrl, iconUrl, level, relatedToolIds, ...rest } = data;
    await updateDoc(doc(db, collectionName, id), {
      ...rest,
      subtitle: subtitle || deleteField(),
      siteUrl: siteUrl || deleteField(),
      iconUrl: iconUrl || deleteField(),
      level: level || deleteField(),
      relatedToolIds: relatedToolIds ?? [],
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteTool = async (id: string) => {
    await deleteDoc(doc(db, collectionName, id));
  };

  const toggleRecommend = async (id: string, uid: string, alreadyRecommended: boolean) => {
    await updateDoc(doc(db, collectionName, id), {
      recommendedBy: alreadyRecommended ? arrayRemove(uid) : arrayUnion(uid),
    });
  };

  return { tools, loading, addTool, updateTool, deleteTool, toggleRecommend };
}
