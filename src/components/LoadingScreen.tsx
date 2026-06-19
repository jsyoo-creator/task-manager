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

/* ── pixel helpers ─────────────────────────────────── */
type PixelMap = { map: string[]; colors: Record<string, string>; p: number };

function Pixels({ map, colors, p }: PixelMap) {
  return (
    <svg
      viewBox={`0 0 ${map[0].length * p} ${map.length * p}`}
      width={map[0].length * p}
      height={map.length * p}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {map.flatMap((row, y) =>
        row.split('').map((ch, x) => {
          const fill = colors[ch];
          return fill
            ? <rect key={`${x}-${y}`} x={x * p} y={y * p} width={p} height={p} fill={fill} />
            : null;
        })
      )}
    </svg>
  );
}

/* ── pixel cat (smaller, P=3) ──────────────────────── */
function PixelCat() {
  const p = 3;
  const colors: Record<string, string> = {
    B: '#fb923c', D: '#ea7019', P: '#fda4af',
    E: '#1c1917', N: '#f43f5e', R: '#fca5a5',
    M: '#7c2d12', W: '#fff7ed',
  };
  const map = [
    '..B......B..',
    '.BBB....BBB.',
    '.BPB....BPB.',
    'BBBBBBBBBBBB',
    'BBBBDDDDBBBB',
    'BBEEBBBBEEBB',
    'BBBBBBBBBBBB',
    'BRRBBNNBBRRB',
    'BBBBBMMBBBBB',
    'WWWWWWWWWWWW',
    '.WWWWWWWWWW.',
    '..WWWWWWWW..',
  ];
  const W = map[0].length * p;
  const H = map.length * p;
  return (
    <svg viewBox={`-8 0 ${W + 16} ${H}`} width={W + 16} height={H} style={{ imageRendering: 'pixelated', display: 'block' }}>
      <Pixels map={map} colors={colors} p={p} />
      <g transform={`translate(-8, 0)`}>
        {/* whiskers left */}
        <line x1={0} y1={21} x2={p * 2} y2={22} stroke="#d4a27f" strokeWidth="0.8" strokeLinecap="round" />
        <line x1={0} y1={24} x2={p * 2} y2={24} stroke="#d4a27f" strokeWidth="0.8" strokeLinecap="round" />
      </g>
      {/* whiskers right */}
      <line x1={W + 8} y1={21} x2={W - p * 2 + 8} y2={22} stroke="#d4a27f" strokeWidth="0.8" strokeLinecap="round" />
      <line x1={W + 8} y1={24} x2={W - p * 2 + 8} y2={24} stroke="#d4a27f" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── pixel house ───────────────────────────────────── */
function PixelHouse() {
  const p = 3;
  const colors: Record<string, string> = {
    R: '#e74c3c',
    r: '#c0392b',
    W: '#fde8b4',
    D: '#7c3c0d',
    G: '#9ca3af',
    N: '#93c5fd',
  };
  const map = [
    '.G........',
    '.G...R....',
    '.G..RrR...',
    '.G.RrRrR..',
    '.GRrRrRrR.',
    'RrRrRrRrRr',
    'WWWWWWWWWW',
    'WNNWWWWDWW',
    'WNNWWWWDWW',
    'WWWWWWWWWW',
  ];
  return <Pixels map={map} colors={colors} p={p} />;
}

/* ── smoke puffs ───────────────────────────────────── */
function Smoke() {
  return (
    <div className="absolute" style={{ top: -12, left: 3 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute rounded-full bg-gray-400/50 dark:bg-white/25"
          style={{
            width: 5 - i,
            height: 5 - i,
            left: i * 2,
            animation: `ls-smoke 1.8s ease-out ${i * 0.5}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ── main component ────────────────────────────────── */
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
    setStepIdx(Math.min(STEPS.length - 1, Math.floor(progress / 25)));
  }, [progress]);

  useEffect(() => {
    if (!done) return;
    let p = progressRef.current;
    const sprint = setInterval(() => {
      p = Math.min(100, p + 4);
      setProgress(p);
      if (p >= 100) {
        clearInterval(sprint);
        setTimeout(() => { setFadeOut(true); setTimeout(onFinished, 420); }, 300);
      }
    }, 30);
    return () => clearInterval(sprint);
  }, [done]);

  const catX = Math.max(0, Math.min(82, progress - 2));
  const entering = progress >= 90;

  return (
    <>
      <style>{`
        @keyframes ls-cat {
          0%,100% { transform: scaleX(1.1) scaleY(0.9) translateY(0px); }
          15%     { transform: scaleX(1)   scaleY(1)   translateY(-1px); }
          45%     { transform: scaleX(0.9) scaleY(1.1) translateY(-18px); }
          75%     { transform: scaleX(1)   scaleY(1)   translateY(-1px); }
          88%     { transform: scaleX(1.06) scaleY(0.94) translateY(0px); }
        }
        @keyframes ls-shadow {
          0%,100% { transform: scaleX(1.2) scaleY(1);   opacity:0.28; }
          45%     { transform: scaleX(0.4) scaleY(0.5); opacity:0.08; }
        }
        @keyframes ls-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes ls-dot {
          0%,80%,100% { transform:scale(0); opacity:0; }
          40%         { transform:scale(1); opacity:1; }
        }
        @keyframes ls-fadein {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes ls-smoke {
          0%   { transform:translateY(0) scale(1);   opacity:0.5; }
          100% { transform:translateY(-14px) scale(1.8); opacity:0; }
        }
        @keyframes ls-arrive {
          0%   { transform:scale(1);   opacity:1; }
          100% { transform:scale(0.1); opacity:0; }
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
          className="relative glass-card px-10 py-7 flex flex-col items-center gap-4 w-[360px]"
          style={{ animation: 'ls-fadein 0.5s ease both' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-base"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.22) inset, 0 4px 14px rgba(37,99,235,0.45)' }}>T</div>
            <div className="leading-snug">
              <p className="text-[9px] font-semibold tracking-[0.18em] text-black/35 dark:text-white/35 uppercase">PIVOT</p>
              <p className="text-base font-bold text-black/80 dark:text-white/85">Task Manager</p>
            </div>
          </div>

          {/* Track */}
          <div className="w-full">
            <div className="relative h-16 mb-1">

              {/* House */}
              <div className="absolute right-0 bottom-2" style={{ zIndex: 2 }}>
                <div className="relative">
                  <Smoke />
                  <PixelHouse />
                </div>
              </div>

              {/* Shadow */}
              <div
                className="absolute rounded-full bg-black/18 dark:bg-black/30"
                style={{
                  width: 32, height: 6,
                  bottom: 2,
                  left: `calc(${catX}% + 2px)`,
                  transition: 'left 0.15s linear',
                  animation: entering ? 'none' : 'ls-shadow 0.68s ease-in-out infinite',
                  opacity: entering ? 0 : undefined,
                }}
              />

              {/* Cat */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: `calc(${catX}% - 8px)`,
                  transition: 'left 0.15s linear',
                  animation: entering
                    ? 'ls-arrive 0.4s ease-in forwards'
                    : 'ls-cat 0.68s ease-in-out infinite',
                  transformOrigin: 'bottom center',
                  zIndex: 1,
                }}
              >
                <PixelCat />
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-2.5 bg-black/8 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#fb923c,#f97316 60%,#fb7185)' }}
              />
              <div
                className="absolute inset-y-0 w-16 rounded-full"
                style={{
                  background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)',
                  animation: 'ls-shimmer 1.4s linear infinite',
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] font-medium text-black/50 dark:text-white/45">{STEPS[stepIdx]}</span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: '#f97316' }}>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#fb923c', animation: `ls-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
