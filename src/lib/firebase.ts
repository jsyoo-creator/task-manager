import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, disableNetwork, enableNetwork } from "firebase/firestore";
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

// 안 보는 탭은 10분 뒤 서버 연결을 끊는다 — 2026-11-10 라이브 DB가 밤새(아무도 일 안 할 때) 시간당 약 2만 건씩
// 읽혀 하루 한도를 넘었다. 열어 둔 채 퇴근한 탭이 원인으로 보여, 숨겨진 지 10분이 지나면 끊고 다시 보면 잇는다.
// 다시 이을 때 30분 안이면 바뀐 문서만 받는다. 화면은 브라우저 캐시로 그대로 보인다.
const IDLE_DISCONNECT_MS = 10 * 60 * 1000;
if (typeof document !== 'undefined') {
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let offline = false;
  const onVisibility = () => {
    clearTimeout(idleTimer);
    if (document.visibilityState === 'hidden') {
      idleTimer = setTimeout(() => {
        offline = true;
        disableNetwork(db).catch(e => console.warn('[firestore] 연결 끊기 실패', e));
      }, IDLE_DISCONNECT_MS);
    } else if (offline) {
      offline = false;
      enableNetwork(db).catch(e => console.warn('[firestore] 다시 연결 실패', e));
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  onVisibility();
}

// API 키 미설정 시 앱이 크래시되지 않도록 안전하게 초기화
let _auth: ReturnType<typeof getAuth> | null = null;
try {
  _auth = getAuth(app);
} catch (e) {
  console.warn('Firebase Auth init failed (check env vars):', e);
}
export const auth = _auth;
