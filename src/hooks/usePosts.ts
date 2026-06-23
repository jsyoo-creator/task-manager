import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
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

  const addPost = async (data: Omit<Post, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'posts'), {
      ...data,
      createdAt: new Date().toISOString(),
    });
  };

  const deletePost = async (postId: string) => {
    await deleteDoc(doc(db, 'posts', postId));
  };

  return { posts, loading, addPost, deletePost };
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
  };

  const deleteComment = async (commentId: string) => {
    await deleteDoc(doc(db, 'comments', commentId));
  };

  return { comments, addComment, deleteComment };
}
