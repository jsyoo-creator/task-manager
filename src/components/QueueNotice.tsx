import { Hourglass, CheckCircle2 } from 'lucide-react';
import { useJobQueue, runningLabel } from '../hooks/useJobQueue';

// 요청 팝업 안 작업 순서 안내 — 높이를 고정해 내용이 바뀌어도 팝업이 흔들리지 않게 한다
export function QueueNotice() {
  const q = useJobQueue(true);
  const shell = 'w-full rounded-xl border px-3 h-[48px] flex items-center gap-2.5 text-[11px] leading-tight';
  if (q === undefined) return <div className={`${shell} border-black/5 bg-gray-50/60 text-gray-300`}>작업 순서 확인 중…</div>;
  const run = q?.running ?? null;
  const n = q?.waiting?.length ?? 0;
  if (!run && !n) {
    return (
      <div className={`${shell} border-green-100 bg-green-50 text-green-700`}>
        <CheckCircle2 size={15} className="flex-none text-green-500" />
        <div className="min-w-0">
          <div className="truncate">지금 밀린 작업이 없어요</div>
          <div className="text-[10px] opacity-70 truncate">요청하면 바로 이어서 시작해요 (최대 2분 안에 가져가요)</div>
        </div>
      </div>
    );
  }
  const ahead = (run ? 1 : 0) + n;
  return (
    <div className={`${shell} border-amber-100 bg-amber-50 text-amber-700`}>
      <Hourglass size={15} className="flex-none text-amber-500" />
      <div className="min-w-0">
        <div className="truncate" title={run ? runningLabel(run) : undefined}>
          {run ? `지금 ${runningLabel(run)} 진행 중` : '앞 요청을 곧 시작해요'}{n ? ` · 대기 ${n}건` : ''}
        </div>
        <div className="text-[10px] opacity-80 truncate">지금 요청하면 {ahead + 1}번째예요</div>
      </div>
    </div>
  );
}
