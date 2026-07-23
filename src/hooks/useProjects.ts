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
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))
          .sort((a, b) => a.createdAt?.localeCompare(b.createdAt ?? '') ?? 0);
        setProjects(data);
        // 로컬 캐시에만 있고 서버 확인 전인 "빈" 스냅샷을 진짜 로딩 완료로 치면, 이 근무지에
        // 실제로는 프로젝트가 있는데도 순간적으로 0건으로 보여 "완전히 새 근무지"로 오판하고
        // 기본 프로젝트를 중복 생성하는 사고가 난다(App.tsx의 자동 생성 가드 참고).
        // 서버가 확인해준 결과(비어있어도 fromCache=false)일 때만 로딩 완료로 간주한다.
        if (data.length > 0 || !snap.metadata.fromCache) setLoading(false);
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
