import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIGMA_SETUP_META_COLLECTION, DRIVE_FOLDERS_DOC } from '../lib/figmaSetup';

// 맥 프로그램이 올려 둔 드라이브 작업 폴더 이름 목록. 아직 한 번도 안 올라왔으면 folders가 null.
export function useDriveFolders(enabled: boolean) {
  const [folders, setFolders] = useState<Set<string> | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();

  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(doc(db, FIGMA_SETUP_META_COLLECTION, DRIVE_FOLDERS_DOC), snap => {
      const data = snap.exists() ? snap.data() : null;
      setFolders(Array.isArray(data?.folders) ? new Set((data!.folders as string[]).map(f => f.normalize('NFC'))) : null);
      setUpdatedAt(data?.updatedAt);
    });
    return unsub;
  }, [enabled]);

  return { folders, updatedAt };
}
