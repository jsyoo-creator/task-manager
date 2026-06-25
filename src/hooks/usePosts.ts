import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, updateDoc, doc, increment, deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Post {
  id: string;
  teamId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string;
  title: string;
  content: string;
  createdAt: string;
  commentCount?: number;
  isNotice?: boolean;
  noticeAt?: string; // ISO — 공지 지정 시각 (정렬 기준)
}

export interface PostComment {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string;
  content: string;
  createdAt: string;
}

export function usePosts(teamId: string | null) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'posts'), where('teamId', '==', teamId));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setPosts(data);
      setLoading(false);
    }, err => {
      console.error('usePosts error:', err);
      setLoading(false);
    });
    return unsub;
  }, [teamId]);

  const addPost = async (data: Omit<Post, 'id' | 'createdAt' | 'commentCount'>) => {
    const now = new Date().toISOString();
    await addDoc(collection(db, 'posts'), {
      ...data,
      createdAt: now,
      commentCount: 0,
      ...(data.isNotice ? { noticeAt: now } : {}),
    });
  };

  const deletePost = async (postId: string) => {
    await deleteDoc(doc(db, 'posts', postId));
  };

  const setNotice = async (postId: string, isNotice: boolean) => {
    if (isNotice) {
      await updateDoc(doc(db, 'posts', postId), {
        isNotice: true,
        noticeAt: new Date().toISOString(),
      });
    } else {
      await updateDoc(doc(db, 'posts', postId), {
        isNotice: deleteField(),
        noticeAt: deleteField(),
      });
    }
  };

  const updatePost = async (postId: string, title: string, content: string) => {
    await updateDoc(doc(db, 'posts', postId), { title, content });
  };

  return { posts, loading, addPost, updatePost, deletePost, setNotice };
}

export function useComments(postId: string | null) {
  const [comments, setComments] = useState<PostComment[]>([]);

  useEffect(() => {
    if (!postId) { setComments([]); return; }
    const q = query(collection(db, 'comments'), where('postId', '==', postId));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as PostComment));
      data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setComments(data);
    }, err => {
      console.error('useComments error:', err);
    });
    return unsub;
  }, [postId]);

  const addComment = async (data: Omit<PostComment, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'comments'), {
      ...data,
      createdAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'posts', data.postId), { commentCount: increment(1) });
  };

  const deleteComment = async (commentId: string, postId: string) => {
    await deleteDoc(doc(db, 'comments', commentId));
    await updateDoc(doc(db, 'posts', postId), { commentCount: increment(-1) });
  };

  const updateComment = async (commentId: string, content: string) => {
    await updateDoc(doc(db, 'comments', commentId), { content });
  };

  return { comments, addComment, updateComment, deleteComment };
}
