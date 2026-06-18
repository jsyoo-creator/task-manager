import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task, SubTask } from '../types';

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, 'tasks'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

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
    const q = query(
      collection(db, 'subtasks'),
      where('taskId', '==', taskId),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setSubtasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubTask)));
    });
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
    const q = query(collection(db, 'subtasks'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setSubtasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubTask)));
    });
    return unsub;
  }, [projectId]);

  return { subtasks };
}
