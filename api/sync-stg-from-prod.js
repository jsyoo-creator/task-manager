import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLLECTIONS = [
  'aiTools', 'comments', 'discussionReads', 'members', 'posts', 'projects',
  'seatGroups', 'subtasks', 'tasks', 'teams', 'users', 'vacations', 'workplaces',
];
const BATCH_SIZE = 400;

function loadServiceAccount(envVar) {
  const raw = process.env[envVar];
  if (!raw) throw new Error(`${envVar} 환경변수가 없습니다.`);
  return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
}

function getApp(name, envVar) {
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  const serviceAccount = loadServiceAccount(envVar);
  const app = initializeApp({ credential: cert(serviceAccount) }, name);
  app.__projectId = serviceAccount.project_id;
  return app;
}

async function syncFirestore(prodDb, stgDb) {
  const summary = {};
  for (const name of COLLECTIONS) {
    const snap = await prodDb.collection(name).get();
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = stgDb.batch();
      for (const doc of chunk) {
        batch.set(stgDb.collection(name).doc(doc.id), doc.data(), { merge: true });
      }
      await batch.commit();
    }
    summary[name] = docs.length;
  }
  return summary;
}

// firebase-admin/auth는 jwks-rsa→jose 의존성이 Vercel 번들 환경에서 ERR_REQUIRE_ESM으로
// 크래시하므로 사용하지 않고, Identity Toolkit REST API를 직접 호출한다.
async function getAccessToken(app) {
  return (await app.options.credential.getAccessToken()).access_token;
}

async function listAllUsers(app) {
  const token = await getAccessToken(app);
  let all = [];
  let pageToken;
  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${app.__projectId}/accounts:batchGet`);
    url.searchParams.set('maxResults', '1000');
    if (pageToken) url.searchParams.set('nextPageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`accounts:batchGet 실패 (${res.status}): ${await res.text()}`);
    const data = await res.json();
    all = all.concat(data.users || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

function toRestImportRecord(u) {
  return {
    localId: u.localId,
    email: u.email,
    emailVerified: !!u.emailVerified,
    displayName: u.displayName,
    photoUrl: u.photoUrl,
    disabled: !!u.disabled,
    providerUserInfo: (u.providerUserInfo || [])
      .filter((p) => p.providerId !== 'password')
      .map((p) => ({
        providerId: p.providerId,
        rawId: p.rawId || p.federatedId,
        email: p.email,
        displayName: p.displayName,
        photoUrl: p.photoUrl,
      })),
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

async function importUsers(app, users) {
  if (users.length === 0) return { successCount: 0, failureCount: 0 };
  const token = await getAccessToken(app);
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${app.__projectId}/accounts:batchCreate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: users.map(toRestImportRecord) }),
  });
  if (!res.ok) throw new Error(`accounts:batchCreate 실패 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const errors = data.error || [];
  return { successCount: users.length - errors.length, failureCount: errors.length, errors };
}

async function syncNewAuthUsers(prodApp, stgApp) {
  const [prodUsers, stgUsers] = await Promise.all([listAllUsers(prodApp), listAllUsers(stgApp)]);
  const stgUids = new Set(stgUsers.map((u) => u.localId));
  const newUsers = prodUsers.filter((u) => !stgUids.has(u.localId));
  const result = await importUsers(stgApp, newUsers);
  return { newCount: newUsers.length, ...result };
}

export default async function handler(req, res) {
  if (process.env.VITE_APP_ENV !== 'stg') {
    res.status(204).end();
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const prodApp = getApp('prod-sync', 'FIREBASE_ADMIN_PROD_KEY_B64');
    const stgApp = getApp('stg-sync', 'FIREBASE_ADMIN_STG_KEY_B64');
    const prodDb = getFirestore(prodApp);
    const stgDb = getFirestore(stgApp);

    const firestoreSummary = await syncFirestore(prodDb, stgDb);
    const authSummary = await syncNewAuthUsers(prodApp, stgApp);

    res.status(200).json({ ok: true, firestoreSummary, authSummary });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
