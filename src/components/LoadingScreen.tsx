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

/* ── Pixel art cat ──────────────────────────────────── */
function PixelCat() {
  const P = 4; // px per pixel
  const COLOR: Record<string, string> = {
    B: '#fb923c', // body orange
    D: '#e8710a', // darker orange stripe
    P: '#fda4af', // ear inner pink
    E: '#292524', // eye
    N: '#f43f5e', // nose
    R: '#fca5a5', // rosy cheek
    M: '#7c2d12', // mouth
    W: '#fff7ed', // white belly
  };
  // 12 columns × 12 rows
  const MAP = [
    '..B......B..',  // 0  ear tips
    '.BBB....BBB.',  // 1  ears
    '.BPB....BPB.',  // 2  inner ear
    'BBBBBBBBBBBB',  // 3  head top
    'BBBBDDDDBBBB',  // 4  forehead stripe
    'BBEEBBBBEEBB',  // 5  eyes
    'BBBBBBBBBBBB',  // 6  mid head
    'BRRBBNNBBRRB',  // 7  cheeks + nose
    'BBBBBMMBBBBB',  // 8  mouth
    'WWWWWWWWWWWW',  // 9  belly
    '.WWWWWWWWWW.',  // 10 chin
    '..WWWWWWWW..',  // 11 bottom
  ];

  const rects: React.ReactNode[] = [];
  MAP.forEach((row, y) => {
    row.split('').forEach((ch, x) => {
      const fill = COLOR[ch];
      if (fill) rects.push(
        <rect key={`${x}-${y}`} x={x * P} y={y * P} width={P} height={P} fill={fill} />
      );
    });
  });

  const W = 12 * P; // 48
  const H = 12 * P; // 48
  const WX = 10;    // whisker extension

  return (
    <svg
      viewBox={`${-WX} 0 ${W + WX * 2} ${H}`}
      width={W + WX * 2}
      height={H}
      style={{ imageRendering: 'pixelated' }}
    >
      {rects}
      {/* Whiskers left */}
      <line x1={-WX} y1={7 * P + 1} x2={P}     y2={7.5 * P}     stroke="#d4a27f" strokeWidth="0.9" strokeLinecap="round" />
      <line x1={-WX} y1={7 * P + 5} x2={P}     y2={7.5 * P + 2} stroke="#d4a27f" strokeWidth="0.9" strokeLinecap="round" />
      {/* Whiskers right */}
      <line x1={11 * P} y1={7.5 * P}     x2={W + WX} y2={7 * P + 1} stroke="#d4a27f" strokeWidth="0.9" strokeLinecap="round" />
      <line x1={11 * P} y1={7.5 * P + 2} x2={W + WX} y2={7 * P + 5} stroke="#d4a27f" strokeWidth="0.9" strokeLinecap="round" />
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

  const charX = Math.max(0, Math.min(91, progress - 2));

  return (
    <>
      <style>{`
        @keyframes ls-cat {
          0%,100% { transform: scaleX(1.12) scaleY(0.88) translateY(0px); }
          15%     { transform: scaleX(1)    scaleY(1)    translateY(-2px); }
          45%     { transform: scaleX(0.9)  scaleY(1.12) translateY(-22px); }
          75%     { transform: scaleX(1)    scaleY(1)    translateY(-2px); }
          88%     { transform: scaleX(1.06) scaleY(0.94) translateY(0px); }
        }
        @keyframes ls-shadow {
          0%,100% { transform: scaleX(1.2)  scaleY(1);   opacity: 0.32; }
          45%     { transform: scaleX(0.45) scaleY(0.5); opacity: 0.10; }
          88%     { transform: scaleX(1.1)  scaleY(0.8); opacity: 0.25; }
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
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#b8c8ff] opacity-45 dark:bg-[#1e40af] dark:opacity-12 blur-[90px]" />
          <div className="absolute top-[15%] right-[-80px] w-[520px] h-[520px] rounded-full bg-[#d4b8ff] opacity-38 dark:bg-[#6d28d9] dark:opacity-10 blur-[90px]" />
          <div className="absolute bottom-0 left-[20%] w-[480px] h-[480px] rounded-full bg-[#ffb8d4] opacity-30 dark:bg-[#9d174d] dark:opacity-8 blur-[90px]" />
        </div>

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

          {/* Cat + progress */}
          <div className="w-full">
            <div className="relative h-20 mb-1">
              {/* Shadow */}
              <div
                className="absolute bottom-0 rounded-full bg-black/20 dark:bg-black/35"
                style={{
                  width: 44,
                  height: 8,
                  left: `calc(${charX}% - 2px)`,
                  transition: 'left 0.15s linear',
                  animation: 'ls-shadow 0.68s ease-in-out infinite',
                }}
              />
              {/* Cat */}
              <div
                className="absolute bottom-2"
                style={{
                  left: `calc(${charX}% - 14px)`,
                  transition: 'left 0.15s linear',
                  animation: 'ls-cat 0.68s ease-in-out infinite',
                  transformOrigin: 'bottom center',
                }}
              >
                <PixelCat />
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
              <div key={i} className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#fb923c', animation: `ls-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
