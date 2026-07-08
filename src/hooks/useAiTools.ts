import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AiTool } from '../types';

export function useAiTools() {
  const [tools, setTools] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'aiTools'), snap => {
      setTools(snap.docs.map(d => ({ id: d.id, ...d.data() } as AiTool)));
      setLoading(false);
    }, err => {
      console.error('useAiTools error:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  const addTool = async (data: Omit<AiTool, 'id' | 'createdAt' | 'updatedAt'>) => {
    await addDoc(collection(db, 'aiTools'), { ...data, createdAt: new Date().toISOString() });
  };

  const updateTool = async (id: string, data: Omit<AiTool, 'id' | 'authorUid' | 'authorName' | 'createdAt' | 'updatedAt'>) => {
    const { siteUrl, ...rest } = data;
    await updateDoc(doc(db, 'aiTools', id), {
      ...rest,
      siteUrl: siteUrl || deleteField(),
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteTool = async (id: string) => {
    await deleteDoc(doc(db, 'aiTools', id));
  };

  return { tools, loading, addTool, updateTool, deleteTool };
}
