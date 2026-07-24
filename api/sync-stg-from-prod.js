import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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
  return initializeApp({ credential: cert(loadServiceAccount(envVar)) }, name);
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

function toImportRecord(u) {
  const record = {
    uid: u.uid,
    email: u.email,
    emailVerified: u.emailVerified,
    displayName: u.displayName,
    photoURL: u.photoURL,
    phoneNumber: u.phoneNumber,
    disabled: u.disabled,
    customClaims: u.customClaims,
    providerData: u.providerData
      .filter((p) => p.providerId !== 'password')
      .map((p) => ({
        uid: p.uid,
        email: p.email,
        displayName: p.displayName,
        photoURL: p.photoURL,
        providerId: p.providerId,
        phoneNumber: p.phoneNumber,
      })),
  };
  if (u.metadata) {
    record.metadata = {
      creationTime: u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
    };
  }
  return record;
}

async function listAllUsers(auth) {
  let all = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    all = all.concat(res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return all;
}

async function syncNewAuthUsers(prodAuth, stgAuth) {
  const [prodUsers, stgUsers] = await Promise.all([listAllUsers(prodAuth), listAllUsers(stgAuth)]);
  const stgUids = new Set(stgUsers.map((u) => u.uid));
  const newUsers = prodUsers.filter((u) => !stgUids.has(u.uid));
  if (newUsers.length === 0) return { newCount: 0, successCount: 0, failureCount: 0 };

  const result = await stgAuth.importUsers(newUsers.map(toImportRecord));
  return { newCount: newUsers.length, successCount: result.successCount, failureCount: result.failureCount, errors: result.errors };
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
    const prodAuth = getAuth(prodApp);
    const stgAuth = getAuth(stgApp);

    const firestoreSummary = await syncFirestore(prodDb, stgDb);
    const authSummary = await syncNewAuthUsers(prodAuth, stgAuth);

    res.status(200).json({ ok: true, firestoreSummary, authSummary });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
