import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const ALLOWED_DOMAIN = 'pivot-inc.com';
const provider = new GoogleAuthProvider();

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 3초 안에 응답 없으면 강제로 로딩 해제 (Firebase Console 미설정 대비)
    const timeout = setTimeout(() => setLoading(false), 3000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeout);
      if (u) {
        const domain = u.email?.split('@')[1];
        if (domain !== ALLOWED_DOMAIN) {
          await fbSignOut(auth);
          setUser(null);
          setError(`${ALLOWED_DOMAIN} 계정만 접속할 수 있습니다.`);
        } else {
          setUser(u);
          setError(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => { clearTimeout(timeout); unsub(); };
  }, []);

  const signIn = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      const domain = result.user.email?.split('@')[1];
      if (domain !== ALLOWED_DOMAIN) {
        await fbSignOut(auth);
        setError(`${ALLOWED_DOMAIN} 계정만 접속할 수 있습니다.`);
      }
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== 'auth/popup-closed-by-user') {
        setError('로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const signOut = () => fbSignOut(auth);

  return { user, loading, error, signIn, signOut };
}
