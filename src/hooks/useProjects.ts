import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Project } from '../types';

export function useProjects(workplaceId?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workplaceId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'projects'), where('workplaceId', '==', workplaceId)),
      snap => {
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))
          .sort((a, b) => a.createdAt?.localeCompare(b.createdAt ?? '') ?? 0));
        setLoading(false);
      },
      err => { console.error('projects:', err); setLoading(false); }
    );
    return unsub;
  }, [workplaceId]);

  const addProject = async (data: Omit<Project, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'projects'), { ...data, createdAt: new Date().toISOString() });
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    await updateDoc(doc(db, 'projects', id), data);
  };

  return { projects, loading, addProject, updateProject };
}
