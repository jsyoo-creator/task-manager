import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ApiKey } from '../types';

// 원문 키를 브라우저에서만 생성하고 해시만 저장한다(이 앱은 Firestore 보안 규칙이 없어
// 클라이언트가 다른 컬렉션도 전부 직접 r/w하는 구조라 이 패턴을 그대로 따름 —
// 다만 원문 키 자체는 Firestore에 절대 쓰지 않고, 생성 직후 반환값으로만 한 번 전달함)
function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `tm_${b64}`;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useApiKeys(workplaceId?: string) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  useEffect(() => {
    if (!workplaceId) { setApiKeys([]); return; }
    const q = query(collection(db, 'apiKeys'), where('workplaceId', '==', workplaceId));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ApiKey))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      setApiKeys(list);
    });
    return unsub;
  }, [workplaceId]);

  // 생성된 원문 키를 반환값으로만 넘겨줌 — 호출부(설정 화면)가 모달에 한 번 보여주고
  // 그 이후로는 다시 조회할 방법이 없어야 함(Firestore엔 해시만 남음)
  const createApiKey = async (
    workplaceId: string,
    createdByUid: string,
    createdByName: string,
    label?: string
  ): Promise<string> => {
    const plain = randomKey();
    const keyHash = await sha256Hex(plain);
    const now = new Date().toISOString();
    await addDoc(collection(db, 'apiKeys'), {
      workplaceId,
      label: label || '',
      keyPrefix: plain.slice(0, 11),
      keyHash,
      createdByUid,
      createdByName,
      createdAt: now,
    });
    return plain;
  };

  const revokeApiKey = async (id: string) => {
    await updateDoc(doc(db, 'apiKeys', id), { revokedAt: new Date().toISOString() });
  };

  return { apiKeys, createApiKey, revokeApiKey };
}
