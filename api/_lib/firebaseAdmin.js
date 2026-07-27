// firebase-admin 초기화 공용 헬퍼. api/sync-stg-from-prod.js와 같은 패턴을 재사용한다.
// 주의: firebase-admin/auth는 의존 체인(jwks-rsa→jose)이 Vercel 함수 번들에서
// ERR_REQUIRE_ESM으로 크래시하므로 절대 import하지 않는다. app/firestore만 사용.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// 이 값은 배포마다(STG/운영) 그 자신의 Firestore 프로젝트 서비스 계정 키를 가리키도록
// 각 Vercel 프로젝트의 환경변수에 설정한다(같은 이름, 다른 값) — 코드는 배포 환경을
// 몰라도 되게 함.
const ENV_VAR = 'FIREBASE_ADMIN_KEY_B64';

let cachedDb = null;

export function getAdminDb() {
  if (cachedDb) return cachedDb;
  const raw = process.env[ENV_VAR];
  if (!raw) throw new Error(`${ENV_VAR} 환경변수가 없습니다.`);
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  const existing = getApps().find(a => a.name === 'api-v1');
  const app = existing ?? initializeApp({ credential: cert(serviceAccount) }, 'api-v1');
  cachedDb = getFirestore(app);
  return cachedDb;
}
