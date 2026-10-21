import { useClaudeUsage, type ClaudeUsage } from '../hooks/useClaudeUsage';

// 팝업 안 Claude 남은 사용량 — Figma 세팅요청 팝업과 1차 기획서 만들기 팝업이 같이 쓴다.
export const fmtTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};
const fmtLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (!iso || isNaN(ms) || ms <= 0) return '';
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `약 ${m}분 뒤`;
  const h = Math.floor(m / 60);
  if (h < 48) return `약 ${h}시간 ${m % 60}분 뒤`;
  return `약 ${Math.floor(h / 24)}일 뒤`;
};

function UsageBar({ label, used, resetAt }: { label: string; used: number; resetAt: string }) {
  const left = Math.max(0, 100 - used);
  const color = used >= 100 ? 'bg-red-400' : used >= 85 ? 'bg-amber-400' : 'bg-indigo-400';
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-700 font-medium">남은 양 {left}%{resetAt && <span className="text-gray-400 font-normal"> · {fmtTime(resetAt)} 초기화</span>}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${left}%` }} />
      </div>
    </div>
  );
}

function usageVerdict(u: ClaudeUsage): { tone: 'ok' | 'warn' | 'wait'; text: string } {
  const full = [u.sessionUsed >= 100 && u.sessionResetAt, u.weekUsed >= 100 && u.weekResetAt].filter(Boolean) as string[];
  if (full.length) {
    const until = full.sort().slice(-1)[0];
    return { tone: 'wait', text: `지금은 한도가 다 찼어요 · ${fmtTime(until)}(${fmtLeft(until)})부터 요청 가능 — 지금 눌러 두면 그때 자동으로 시작해요` };
  }
  if (u.sessionUsed >= 85 || u.weekUsed >= 90) {
    const r = u.sessionUsed >= 85 ? u.sessionResetAt : u.weekResetAt;
    return { tone: 'warn', text: `요청 가능 · 남은 양이 적어서 작업 중 멈출 수 있어요 (멈추면 ${fmtTime(r)} 초기화 뒤 이어서 해요)` };
  }
  return { tone: 'ok', text: '지금 바로 요청할 수 있어요' };
}

export function UsagePanel() {
  const u = useClaudeUsage(true);
  if (u === undefined) return <div className="w-full text-[11px] text-gray-300 text-center">Claude 사용량 확인 중…</div>;
  if (u === null) return <div className="w-full text-[11px] text-gray-400 text-center">Claude 사용량 정보가 아직 없어요 (디자이너 맥이 켜지면 표시돼요)</div>;
  const v = usageVerdict(u);
  const stale = u.checkedAt && Date.now() - new Date(u.checkedAt).getTime() > 15 * 60000;
  const box = v.tone === 'wait' ? 'bg-red-50 text-red-600' : v.tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700';
  return (
    <div className="w-full rounded-xl border border-black/5 bg-gray-50/60 p-3 flex flex-col gap-2.5">
      <div className="text-[11px] font-semibold text-gray-600">Claude 사용량 (디자이너 맥)</div>
      {u.sessionUsed >= 0 && <UsageBar label="이번 세션 (약 5시간)" used={u.sessionUsed} resetAt={u.sessionResetAt} />}
      {u.weekUsed >= 0 && <UsageBar label="이번 주" used={u.weekUsed} resetAt={u.weekResetAt} />}
      <div className={`text-[11px] rounded-lg px-2.5 py-1.5 ${box}`}>{v.text}</div>
      {stale && <div className="text-[10px] text-gray-400">마지막 확인 {fmtTime(u.checkedAt)} — 맥이 꺼져 있어 최신이 아닐 수 있어요</div>}
    </div>
  );
}
