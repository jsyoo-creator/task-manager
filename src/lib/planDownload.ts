// 기획서 내려받기 (2026-11-26 기획팀: 드라이브 저장 때 폰트가 깨져서, 맥 프로그램이 드라이브 대신 여기로 올린다)
// planDownloads/{id} = { fileName, version, size, chunks, ... } + chunks/{000..} = { i, data(bytes) }
// 요청한 사람이 내려받아 확인한 뒤 직접 드라이브 01.기획에 올린다. 맥 프로그램이 10일 지난 파일은 지운다.
import { collection, doc, getDoc, getDocs, type Bytes } from 'firebase/firestore';
import { db } from './firebase';

export const PLAN_DOWNLOAD_COLLECTION = 'planDownloads';

export async function downloadPlanFile(id: string, fallbackName: string): Promise<void> {
  const meta = await getDoc(doc(db, PLAN_DOWNLOAD_COLLECTION, id));
  if (!meta.exists()) throw new Error('gone');
  const snap = await getDocs(collection(db, PLAN_DOWNLOAD_COLLECTION, id, 'chunks'));
  const parts = snap.docs.map(d => d.data() as { i: number; data: Bytes }).sort((a, b) => a.i - b.i).map(p => p.data.toUint8Array());
  const blob = new Blob(parts as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (meta.data().fileName as string) || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// 'v1.10' 같은 버전 문자열 비교 — a가 b보다 크면 양수
export function cmpVersion(a = '', b = ''): number {
  const p = (v: string) => (v.match(/\d+/g) ?? []).map(Number);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
}
