import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task, SubTask } from '../types';

export function useTasks(projectId: string, teamId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !teamId) { setTasks([]); setLoading(false); return; }
    const q = query(collection(db, 'tasks'), where('teamId', '==', teamId));
    const unsub = onSnapshot(q,
      snap => {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Task))
          .sort((a, b) => {
            if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
            if (a.sortOrder != null) return -1;
            if (b.sortOrder != null) return 1;
            return b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0;
          });
        setTasks(sorted);
        setLoading(false);
      },
      err => { console.error('tasks:', err); setLoading(false); }
    );
    return unsub;
  }, [projectId, teamId]);

  const addTask = async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    await addDoc(collection(db, 'tasks'), { ...data, createdAt: now, updatedAt: now });
  };

  const updateTask = async (id: string, data: Partial<Task>) => {
    await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: new Date().toISOString() });
  };

  const deleteTask = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id));
  };

  return { tasks, loading, addTask, updateTask, deleteTask };
}

export function useSubTasks(taskId: string) {
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);

  useEffect(() => {
    if (!taskId) return;
    const q = query(collection(db, 'subtasks'), where('taskId', '==', taskId));
    const unsub = onSnapshot(q,
      snap => {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as SubTask))
          .sort((a, b) => a.createdAt?.localeCompare(b.createdAt ?? '') ?? 0);
        setSubtasks(sorted);
      },
      err => console.error('subtasks:', err)
    );
    return unsub;
  }, [taskId]);

  const addSubTask = async (data: Omit<SubTask, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'subtasks'), { ...data, createdAt: new Date().toISOString() });
  };

  const updateSubTask = async (id: string, data: Partial<SubTask>) => {
    await updateDoc(doc(db, 'subtasks', id), data);
  };

  const deleteSubTask = async (id: string) => {
    await deleteDoc(doc(db, 'subtasks', id));
  };

  return { subtasks, addSubTask, updateSubTask, deleteSubTask };
}

export function useAllSubTasks(projectId: string) {
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'subtasks'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q,
      snap => setSubtasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubTask))),
      err => console.error('allSubtasks:', err)
    );
    return unsub;
  }, [projectId]);

  return { subtasks };
}
