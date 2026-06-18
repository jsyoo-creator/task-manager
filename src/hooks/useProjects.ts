import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Project } from '../types';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const addProject = async (data: Omit<Project, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'projects'), { ...data, createdAt: new Date().toISOString() });
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    await updateDoc(doc(db, 'projects', id), data);
  };

  return { projects, loading, addProject, updateProject };
}
