interface Props {
  onSignIn: () => void;
  error: string | null;
  loading?: boolean;
}

export default function LoginPage({ onSignIn, error }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F0FE] relative overflow-hidden">

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[400px] mx-4">
        <div className="glass-card p-10 text-center">

          {/* Logo */}
          <div className="flex justify-center mb-7">
            <div className="relative w-14 h-14 rounded-2xl bg-[#6C63FF] flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              T
            </div>
          </div>

          {/* Title */}
          <div className="mb-2">
            <p className="text-[10px] font-bold tracking-[0.18em] text-gray-400 uppercase mb-1.5">PIVOT CREATIVE</p>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">업무 관리 시스템</h1>
          </div>
          <p className="text-sm text-gray-500 mb-8">
            pivot-inc.com 계정으로 로그인하세요
          </p>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl
              bg-white hover:bg-gray-50
              border border-gray-200
              shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]
              hover:shadow-[0_2px_6px_rgba(0,0,0,0.10),0_8px_20px_rgba(0,0,0,0.07)]
              transition-all active:scale-[0.98] text-sm font-semibold
              text-gray-700"
          >
            {/* Google SVG icon */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Google로 로그인
          </button>

          <p className="mt-6 text-[11px] text-gray-400">
            접근 권한 문의: js.yoo@pivot-inc.com
          </p>
        </div>
      </div>
    </div>
  );
}
