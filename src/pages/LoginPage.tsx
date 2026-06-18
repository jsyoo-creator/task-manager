interface Props {
  onSignIn: () => void;
  error: string | null;
  loading?: boolean;
}

export default function LoginPage({ onSignIn, error }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#e8eaf6] dark:bg-[#080c18] relative overflow-hidden">

      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#b8c8ff] opacity-50 dark:bg-[#1e40af] dark:opacity-15 blur-[90px]" />
        <div className="absolute top-[15%] right-[-80px] w-[520px] h-[520px] rounded-full bg-[#d4b8ff] opacity-40 dark:bg-[#6d28d9] dark:opacity-12 blur-[90px]" />
        <div className="absolute bottom-0 left-[20%] w-[480px] h-[480px] rounded-full bg-[#ffb8d4] opacity-35 dark:bg-[#9d174d] dark:opacity-10 blur-[90px]" />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[400px] mx-4">
        <div className="glass-card p-10 text-center">

          {/* Logo */}
          <div className="flex justify-center mb-7">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center text-white font-bold text-2xl
              shadow-[0_4px_16px_rgba(37,99,235,0.45),0_0_0_1px_rgba(255,255,255,0.2)_inset]">
              T
            </div>
          </div>

          {/* Title */}
          <div className="mb-2">
            <p className="text-[10px] font-bold tracking-[0.18em] text-black/25 dark:text-white/25 uppercase mb-1.5">PIVOT CREATIVE</p>
            <h1 className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">업무 관리 시스템</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-white/42 mb-8">
            pivot-inc.com 계정으로 로그인하세요
          </p>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl
              bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15
              border border-black/8 dark:border-white/12
              shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]
              hover:shadow-[0_2px_6px_rgba(0,0,0,0.10),0_8px_20px_rgba(0,0,0,0.07)]
              transition-all active:scale-[0.98] text-sm font-semibold
              text-gray-700 dark:text-white/80"
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

          <p className="mt-6 text-[11px] text-gray-400 dark:text-white/25">
            접근 권한 문의: js.yoo@pivot-inc.com
          </p>
        </div>
      </div>
    </div>
  );
}
