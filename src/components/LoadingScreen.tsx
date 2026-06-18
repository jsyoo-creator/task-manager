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

export default function LoadingScreen({ done, onFinished, isDark }: Props) {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  /* ── fake progress until ~88%, then wait for `done` ── */
  useEffect(() => {
    const tick = () => {
      setProgress(p => {
        if (p >= 88) return p;
        // 구간마다 다른 속도 → 앞 단계를 충분히 보여주고, 끝쪽에서 천천히 대기
        let bump: number;
        if (p < 25)      bump = Math.random() * 3   + 2;    // 빠름  (~1.1초)
        else if (p < 50) bump = Math.random() * 2   + 1.5;  // 중간  (~1.6초)
        else if (p < 75) bump = Math.random() * 1.2 + 0.8;  // 느림  (~2.8초)
        else             bump = Math.random() * 0.5 + 0.25; // 매우 느림 — Firebase 대기
        return Math.min(88, p + bump);
      });
    };
    const id = setInterval(tick, 160);
    return () => clearInterval(id);
  }, []);

  /* ── step label changes every ~25% ── */
  useEffect(() => {
    const idx = Math.min(STEPS.length - 1, Math.floor(progress / 25));
    setStepIdx(idx);
  }, [progress]);

  /* ── when Firebase done → sprint to 100 then fade out ── */
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

  /* ── character bounce: CSS animation via inline keyframe tag ── */
  const charX = Math.max(0, Math.min(96, progress - 2));   /* slightly ahead of bar */

  return (
    <>
      <style>{`
        @keyframes ls-bounce {
          0%,100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-10px) scale(1.08); }
        }
        @keyframes ls-shadow {
          0%,100% { transform: scaleX(1); opacity: 0.35; }
          50%      { transform: scaleX(0.55); opacity: 0.15; }
        }
        @keyframes ls-trail {
          0%   { opacity: 0.7; }
          100% { opacity: 0; transform: scaleX(0.5); }
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
          className="relative glass-card px-10 py-9 flex flex-col items-center gap-6 w-[360px]"
          style={{ animation: 'ls-fadein 0.5s ease both' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 select-none">
            <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-[0_4px_14px_rgba(37,99,235,0.45)]"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.22) inset, 0 4px 14px rgba(37,99,235,0.45)' }}>
              T
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-black/28 dark:text-white/28 uppercase">PIVOT</p>
              <p className="text-sm font-bold text-black/80 dark:text-white/85">Task Manager</p>
            </div>
          </div>

          {/* Character + Progress track */}
          <div className="w-full">
            {/* Character track */}
            <div className="relative h-10 mb-1.5">
              {/* Shadow under character */}
              <div
                className="absolute bottom-0 w-5 h-1.5 rounded-full bg-black/20 dark:bg-black/40"
                style={{
                  left: `calc(${charX}% - 8px)`,
                  transition: 'left 0.15s linear',
                  animation: 'ls-shadow 0.55s ease-in-out infinite',
                }}
              />

              {/* Character: gradient sphere */}
              <div
                className="absolute bottom-2 w-6 h-6"
                style={{
                  left: `calc(${charX}% - 10px)`,
                  transition: 'left 0.15s linear',
                  animation: 'ls-bounce 0.55s ease-in-out infinite',
                }}
              >
                {/* Sphere body */}
                <div className="w-6 h-6 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 38% 35%, #93c5fd, #3b82f6 45%, #1d4ed8)',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.55), 0 0 0 1px rgba(255,255,255,0.25) inset',
                  }}
                />
                {/* Shine dot */}
                <div className="absolute top-[4px] left-[5px] w-2 h-1.5 rounded-full bg-white/55" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-2 bg-black/8 dark:bg-white/10 rounded-full overflow-hidden">
              {/* Fill */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #60a5fa, #3b82f6 60%, #a78bfa)',
                }}
              />
              {/* Shimmer */}
              <div
                className="absolute inset-y-0 w-16 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                  animation: 'ls-shimmer 1.4s linear infinite',
                }}
              />
            </div>

            {/* Percentage */}
            <div className="flex items-center justify-between mt-2">
              <span
                className="text-[11px] font-medium text-black/50 dark:text-white/45"
                style={{ transition: 'opacity 0.3s' }}
              >
                {STEPS[stepIdx]}
              </span>
              <span className="text-[11px] font-bold text-blue-500 dark:text-blue-400 tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Animated dots (loading indicator) */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-400"
                style={{ animation: `ls-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
