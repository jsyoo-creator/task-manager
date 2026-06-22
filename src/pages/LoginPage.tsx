import { useState } from 'react';

interface Props {
  onSignIn: () => void;
  onSignInWithEmail: (email: string, password: string) => Promise<void>;
  onSignUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  error: string | null;
}

export default function LoginPage({ onSignIn, onSignInWithEmail, onSignUpWithEmail, error }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setLocalError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (mode === 'signup') {
      if (!displayName.trim()) { setLocalError('이름을 입력해주세요.'); return; }
      if (password !== confirmPassword) { setLocalError('비밀번호가 일치하지 않습니다.'); return; }
      if (password.length < 6) { setLocalError('비밀번호는 6자 이상이어야 합니다.'); return; }
    }
    setLoading(true);
    if (mode === 'login') {
      await onSignInWithEmail(email, password);
    } else {
      await onSignUpWithEmail(email, password, displayName);
    }
    setLoading(false);
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 focus:border-[#6C63FF]/50";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F0FE]">
      <div className="relative z-10 w-full max-w-[400px] mx-4">
        <div className="glass-card p-10 text-center">

          {/* Logo */}
          <div className="flex justify-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-[#6C63FF] flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              T
            </div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <p className="text-[10px] font-bold tracking-[0.18em] text-gray-400 uppercase mb-1.5">PIVOT CREATIVE</p>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">업무 관리 시스템</h1>
          </div>

          {/* 로그인/가입 탭 */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button onClick={() => switchMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              로그인
            </button>
            <button onClick={() => switchMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              가입
            </button>
          </div>

          {/* Error */}
          {(error || localError) && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              {localError ?? error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 mb-4 text-left">
            {mode === 'signup' && (
              <input type="text" placeholder="이름" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name" className={inputCls} />
            )}
            <input type="email" placeholder="이메일" value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email" className={inputCls} />
            <input type="password" placeholder="비밀번호" value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={inputCls} />
            {mode === 'signup' && (
              <input type="password" placeholder="비밀번호 확인" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password" className={inputCls} />
            )}
            <button type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 rounded-xl bg-[#6C63FF] hover:bg-[#5B52E8] text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(108,99,255,0.35)]">
              {loading ? (mode === 'login' ? '로그인 중...' : '가입 중...') : (mode === 'login' ? '로그인' : '가입하기')}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google */}
          <button onClick={onSignIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.10)] transition-all active:scale-[0.98] text-sm font-semibold text-gray-700">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Google로 로그인 (pivot-inc.com)
          </button>

          <p className="mt-6 text-[11px] text-gray-400">
            접근 권한 문의: js.yoo@pivot-inc.com
          </p>
        </div>
      </div>
    </div>
  );
}
