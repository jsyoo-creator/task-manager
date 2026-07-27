import { createHash } from 'node:crypto';
import { getAdminDb } from './firebaseAdmin.js';

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

// Authorization: Bearer <key> 헤더를 검증하고, 유효하면 이 키가 접근 가능한
// workplaceId를 반환한다. 실패 시 적절한 상태코드로 res에 직접 응답하고 null을 반환
// (호출부는 null이면 바로 return하면 됨).
export async function verifyApiKey(req, res) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Authorization: Bearer <API 키> 헤더가 필요합니다.' });
    return null;
  }
  const plain = match[1].trim();
  const keyHash = sha256Hex(plain);

  const db = getAdminDb();
  const snap = await db.collection('apiKeys').where('keyHash', '==', keyHash).limit(1).get();
  if (snap.empty) {
    res.status(401).json({ error: '유효하지 않은 API 키입니다.' });
    return null;
  }
  const keyDoc = snap.docs[0];
  const keyData = keyDoc.data();
  if (keyData.revokedAt) {
    res.status(401).json({ error: '폐기된 API 키입니다.' });
    return null;
  }

  // 사용 시각 갱신은 응답을 막지 않도록 fire-and-forget
  keyDoc.ref.update({ lastUsedAt: new Date().toISOString() }).catch(() => {});

  return { workplaceId: keyData.workplaceId, db };
}
