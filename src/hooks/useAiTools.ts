import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, deleteField, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AiTool } from '../types';

export function useAiTools() {
  const [tools, setTools] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'aiTools'), snap => {
      setTools(snap.docs.map(d => ({ id: d.id, recommendedBy: [], ...d.data() } as AiTool)));
      setLoading(false);
    }, err => {
      console.error('useAiTools error:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  const addTool = async (data: Omit<AiTool, 'id' | 'createdAt' | 'updatedAt' | 'recommendedBy'>) => {
    await addDoc(collection(db, 'aiTools'), { ...data, recommendedBy: [], createdAt: new Date().toISOString() });
  };

  const updateTool = async (id: string, data: Omit<AiTool, 'id' | 'authorUid' | 'authorName' | 'createdAt' | 'updatedAt' | 'recommendedBy'>) => {
    const { siteUrl, iconUrl, ...rest } = data;
    await updateDoc(doc(db, 'aiTools', id), {
      ...rest,
      siteUrl: siteUrl || deleteField(),
      iconUrl: iconUrl || deleteField(),
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteTool = async (id: string) => {
    await deleteDoc(doc(db, 'aiTools', id));
  };

  const toggleRecommend = async (id: string, uid: string, alreadyRecommended: boolean) => {
    await updateDoc(doc(db, 'aiTools', id), {
      recommendedBy: alreadyRecommended ? arrayRemove(uid) : arrayUnion(uid),
    });
  };

  return { tools, loading, addTool, updateTool, deleteTool, toggleRecommend };
}
