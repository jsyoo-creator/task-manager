import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_META_COLLECTION, DRIVE_FOLDERS_DOC } from '../lib/figmaSetup';

// 맥 프로그램이 올려 둔 드라이브 작업 폴더 이름 목록. 아직 한 번도 안 올라왔으면 folders가 null.
export function useDriveFolders(enabled: boolean) {
  const [folders, setFolders] = useState<Set<string> | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  // 폴더별 최신 기획서 (파일 이름 버전이 가장 높은 것) — 맥 프로그램이 같이 올린다
  const [plans, setPlans] = useState<Record<string, { version: string; file: string }>>({});
  // 폴더별 배너 원본 이미지(99_가이드/banner_img.png) 수정 시각
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(doc(db, FIGMA_SETUP_META_COLLECTION, DRIVE_FOLDERS_DOC), snap => {
      const data = snap.exists() ? snap.data() : null;
      setFolders(Array.isArray(data?.folders) ? new Set((data!.folders as string[]).map(f => f.normalize('NFC'))) : null);
      setUpdatedAt(data?.updatedAt);
      const vers = (data?.planVersions ?? {}) as Record<string, string>;
      const files = (data?.planFiles ?? {}) as Record<string, string>;
      setImages(Object.fromEntries(Object.entries((data?.images ?? {}) as Record<string, string>).map(([k, v]) => [k.normalize('NFC'), v])));
      setPlans(Object.fromEntries(Object.keys({ ...vers, ...files }).map(k => [k.normalize('NFC'), { version: vers[k] ?? '', file: files[k] ?? '' }])));
    });
    return unsub;
  }, [enabled]);

  return { folders, updatedAt, plans, images };
}
