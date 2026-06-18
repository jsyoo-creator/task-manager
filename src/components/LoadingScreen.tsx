import { useState, useEffect, useRef } from 'react';

interface Props {
  done: boolean;
  onFinished: () => void;
  isDark: boolean;
}

const STEPS = [
  '프로젝트 불러오는 중',
  '팀원 데이터 동기화',
  '업무 목록 준비',
  '대시보드 구성',
];

function CatSVG() {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
      {/* Left ear */}
      <polygon points="6,22 13,6 20,22" fill="#fb923c" />
      <polygon points="8.5,21 13,9 17.5,21" fill="#fda4af" />
      {/* Right ear */}
      <polygon points="28,22 35,6 42,22" fill="#fb923c" />
      <polygon points="30.5,21 35,9 39.5,21" fill="#fda4af" />
      {/* Head */}
      <circle cx="24" cy="30" r="16" fill="#fb923c" />
      {/* Forehead stripe */}
      <path d="M22,16 Q24,14 26,16 Q25,19 24,20 Q23,19 22,16Z" fill="#fdba74" opacity="0.6" />
      {/* Left eye — squinting happy */}
      <path d="M16,28 Q18.5,25.5 21,28" stroke="#1c1917" stroke-width="1.8" fill="none" stroke-linecap="round" />
      {/* Right eye */}
      <path d="M27,28 Q29.5,25.5 32,28" stroke="#1c1917" stroke-width="1.8" fill="none" stroke-linecap="round" />
      {/* Cheek blush left */}
      <ellipse cx="14" cy="32" rx="3.5" ry="2" fill="#fca5a5" opacity="0.55" />
      {/* Cheek blush right */}
      <ellipse cx="34" cy="32" rx="3.5" ry="2" fill="#fca5a5" opacity="0.55" />
      {/* Nose */}
      <ellipse cx="24" cy="32" rx="2.2" ry="1.5" fill="#fb7185" />
      {/* Mouth */}
      <path d="M21,34.5 Q24,37 27,34.5" stroke="#1c1917" stroke-width="1.2" fill="none" stroke-linecap="round" />
      {/* Whiskers left */}
      <line x1="3" y1="31" x2="18" y2="32.5" stroke="#a8a29e" stroke-width="0.9" stroke-linecap="round" />
      <line x1="3" y1="34.5" x2="18" y2="34" stroke="#a8a29e" stroke-width="0.9" stroke-linecap="round" />
      {/* Whiskers right */}
      <line x1="30" y1="32.5" x2="45" y2="31" stroke="#a8a29e" stroke-width="0.9" stroke-linecap="round" />
      <line x1="30" y1="34" x2="45" y2="34.5" stroke="#a8a29e" stroke-width="0.9" stroke-linecap="round" />
    </svg>
  );
}

export default function LoadingScreen({ done, onFinished, isDark }: Props) {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const tick = () => {
      setProgress(p => {
        if (p >= 88) return p;
        let bump: number;
        if (p < 25)      bump = Math.random() * 3   + 2;
        else if (p < 50) bump = Math.random() * 2   + 1.5;
        else if (p < 75) bump = Math.random() * 1.2 + 0.8;
        else             bump = Math.random() * 0.5 + 0.25;
        return Math.min(88, p + bump);
      });
    };
    const id = setInterval(tick, 160);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const idx = Math.min(STEPS.length - 1, Math.floor(progress / 25));
    setStepIdx(idx);
  }, [progress]);

  useEffect(() => {
    if (!done) return;
    let p = progressRef.current;
    const sprint = setInterval(() => {
      p = Math.min(100, p + 4);
      setProgress(p);
      if (p >= 100) {
        clearInterval(sprint);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(onFinished, 420);
        }, 300);
      }
    }, 30);
    return () => clearInterval(sprint);
  }, [done]);

  const charX = Math.max(0, Math.min(93, progress - 2));

  return (
    <>
      <style>{`
        @keyframes ls-cat-bounce {
          0%, 100% { transform: translateY(0px) scaleX(1.08) scaleY(0.92); }
          20%      { transform: translateY(-2px) scaleX(1) scaleY(1); }
          45%      { transform: translateY(-20px) scaleX(0.92) scaleY(1.08); }
          70%      { transform: translateY(-3px) scaleX(1) scaleY(1); }
          85%      { transform: translateY(-8px) scaleX(0.96) scaleY(1.04); }
        }
        @keyframes ls-shadow {
          0%, 100% { transform: scaleX(1.1) scaleY(0.6); opacity: 0.3; }
          45%      { transform: scaleX(0.5) scaleY(0.3); opacity: 0.12; }
          85%      { transform: scaleX(0.75) scaleY(0.45); opacity: 0.2; }
        }
        @keyframes ls-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes ls-dot {
          0%,80%,100% { transform: scale(0); opacity:0; }
          40%         { transform: scale(1); opacity:1; }
        }
        @keyframes ls-fadein {
          from { opacity:0; transform: translateY(12px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes ls-tail {
          0%, 100% { transform: rotate(-15deg); }
          50%      { transform: rotate(15deg); }
        }
      `}</style>

      <div
        className={`fixed inset-0 z-[999] flex items-center justify-center transition-opacity duration-400 ${
          fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${isDark ? 'dark' : ''}`}
        style={{ background: isDark ? '#080c18' : '#e8eaf6' }}
      >
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#b8c8ff] opacity-45 dark:bg-[#1e40af] dark:opacity-12 blur-[90px]" />
          <div className="absolute top-[15%] right-[-80px] w-[520px] h-[520px] rounded-full bg-[#d4b8ff] opacity-38 dark:bg-[#6d28d9] dark:opacity-10 blur-[90px]" />
          <div className="absolute bottom-0 left-[20%] w-[480px] h-[480px] rounded-full bg-[#ffb8d4] opacity-30 dark:bg-[#9d174d] dark:opacity-8 blur-[90px]" />
        </div>

        {/* Card */}
        <div
          className="relative glass-card px-10 py-9 flex flex-col items-center gap-6 w-[380px]"
          style={{ animation: 'ls-fadein 0.5s ease both' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 select-none">
            <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.22) inset, 0 4px 14px rgba(37,99,235,0.45)' }}>
              T
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-black/28 dark:text-white/28 uppercase">PIVOT</p>
              <p className="text-sm font-bold text-black/80 dark:text-white/85">Task Manager</p>
            </div>
          </div>

          {/* Cat + Progress track */}
          <div className="w-full">
            {/* Cat track */}
            <div className="relative h-16 mb-1">
              {/* Shadow */}
              <div
                className="absolute bottom-0 rounded-full bg-black/20 dark:bg-black/40"
                style={{
                  width: '36px',
                  height: '8px',
                  left: `calc(${charX}% - 6px)`,
                  transition: 'left 0.15s linear',
                  animation: 'ls-shadow 0.65s ease-in-out infinite',
                }}
              />
              {/* Cat */}
              <div
                className="absolute bottom-2"
                style={{
                  left: `calc(${charX}% - 10px)`,
                  transition: 'left 0.15s linear',
                  animation: 'ls-cat-bounce 0.65s ease-in-out infinite',
                  transformOrigin: 'bottom center',
                }}
              >
                <CatSVG />
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-2.5 bg-black/8 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #fb923c, #f97316 60%, #fb7185)',
                }}
              />
              <div
                className="absolute inset-y-0 w-16 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                  animation: 'ls-shimmer 1.4s linear infinite',
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] font-medium text-black/50 dark:text-white/45">
                {STEPS[stepIdx]}
              </span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: '#f97316' }}>
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#fb923c',
                  animation: `ls-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
