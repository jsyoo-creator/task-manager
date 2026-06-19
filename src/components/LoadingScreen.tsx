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

/* ── pixel witch (walking 2-frame, P=3) ──────────────────────── */
function PixelWitch() {
  const p = 3;
  const colors: Record<string, string> = {
    P: '#9333ea',  // purple hat
    B: '#c084fc',  // hat brim (light purple)
    e: '#60a5fa',  // hat gem (blue)
    H: '#f472b6',  // pink hair
    S: '#fde2b5',  // skin
    E: '#1c1917',  // eyes
    G: '#4ade80',  // green dress
    g: '#22c55e',  // dress shadow
    R: '#fb7185',  // shoes
  };

  // 12 cols × 12 rows  →  36 × 36 px (same as old cat)
  const body = [
    '....PP......',   // hat tip
    '...PePP.....',   // hat body + blue gem
    '..BBBBBBBB..',   // hat brim
    '..HHHSSHHH..',   // hair + face
    '..HHESEHHH..',   // eyes (E=eye, S=nose bridge)
    '..HHHSSHHH..',   // lower face
    '.HHGGGGGHHH.',   // dress shoulders
    '.HgGGGGGgHH.',   // dress (with shadow trim)
    '..GGGGGGG...',   // dress hem
    '...GGG.GGG..',   // legs upper
  ];

  // frame 1: right foot forward
  const f1 = [...body, '..GGG...GGG.', '..RR.....RR.'];
  // frame 2: left foot forward
  const f2 = [...body, '..GG...GGGG.', '..RR....RRR.'];

  const sz = 12 * p; // 36px

  return (
    <div style={{ position: 'relative', width: sz, height: sz }}>
      <div style={{ position: 'absolute', top: 0, left: 0, animation: 'ls-wf1 0.48s steps(1,end) infinite' }}>
        <Pixels map={f1} colors={colors} p={p} />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, animation: 'ls-wf2 0.48s steps(1,end) infinite' }}>
        <Pixels map={f2} colors={colors} p={p} />
      </div>
    </div>
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
        @keyframes ls-walk {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-2px); }
        }
        @keyframes ls-wf1 {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes ls-wf2 {
          0%, 49% { opacity: 0; }
          50%, 100% { opacity: 1; }
        }
        @keyframes ls-shadow {
          0%,100% { transform: scaleX(1.1) scaleY(1);   opacity:0.22; }
          50%     { transform: scaleX(0.8) scaleY(0.6); opacity:0.10; }
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
          className="relative glass-card px-10 py-9 flex flex-col items-center gap-6 w-[380px]"
          style={{ animation: 'ls-fadein 0.5s ease both' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 select-none">
            <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.22) inset, 0 4px 14px rgba(37,99,235,0.45)' }}>T</div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-black/28 dark:text-white/28 uppercase">PIVOT</p>
              <p className="text-sm font-bold text-black/80 dark:text-white/85">Task Manager</p>
            </div>
          </div>

          {/* Track */}
          <div className="w-full">
            <div className="relative h-20 mb-1">

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
                  animation: entering ? 'none' : 'ls-shadow 0.48s ease-in-out infinite',
                  opacity: entering ? 0 : undefined,
                }}
              />

              {/* Witch */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: `calc(${catX}% - 8px)`,
                  transition: 'left 0.15s linear',
                  animation: entering
                    ? 'ls-arrive 0.4s ease-in forwards'
                    : 'ls-walk 0.48s ease-in-out infinite',
                  transformOrigin: 'bottom center',
                  zIndex: 1,
                }}
              >
                <PixelWitch />
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-2.5 bg-black/8 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#a855f7,#9333ea 60%,#fb7185)' }}
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
              <span className="text-[11px] font-bold tabular-nums" style={{ color: '#a855f7' }}>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#a855f7', animation: `ls-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
