import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
// 브라우저 캐시(IndexedDB): 새로고침·새 탭이 30분 안이면 서버는 바뀐 문서만 보내서 읽기 한도를 아낀다.
// 탭이 여러 개면 한 탭이 연결을 맡고 나머지는 같이 쓴다. (2026-10-27 운영 읽기 한도)
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// API 키 미설정 시 앱이 크래시되지 않도록 안전하게 초기화
let _auth: ReturnType<typeof getAuth> | null = null;
try {
  _auth = getAuth(app);
} catch (e) {
  console.warn('Firebase Auth init failed (check env vars):', e);
}
export const auth = _auth;
