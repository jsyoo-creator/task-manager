import { useClaudeUsage, type ClaudeAccountUsage } from '../hooks/useClaudeUsage';
import { useJobCost } from '../hooks/useJobCost';

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

// 계정 한 줄: [고름 표시] 이름 [막대] 남은 양 — 세션·주간 중 더 빠듯한 쪽만 보여 높이를 일정하게 둔다
const tighter = (a: ClaudeAccountUsage) => {
  const sess = a.sessionUsed >= 0 ? 100 - a.sessionUsed : 100;
  const week = a.weekUsed >= 0 ? 100 - a.weekUsed : 100;
  return week <= sess
    ? { left: week, label: '주간', resetAt: a.weekResetAt }
    : { left: sess, label: '세션', resetAt: a.sessionResetAt };
};

function AccountRow({ a, picked, auto, onPick }: { a: ClaudeAccountUsage; picked: boolean; auto: boolean; onPick?: () => void }) {
  const t = tighter(a);
  const color = t.left <= 0 ? 'bg-red-400' : t.left <= 20 ? 'bg-amber-400' : 'bg-indigo-400';
  return (
    <button type="button" onClick={onPick} disabled={!onPick}
      title={onPick ? `${a.name} 계정으로 요청해요` : undefined}
      className={`w-full flex items-center gap-2 h-7 px-1.5 rounded-lg text-[11px] transition-colors ${onPick ? 'hover:bg-white' : ''} ${picked ? 'bg-white ring-1 ring-indigo-200' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-none ${picked ? 'bg-indigo-500' : 'bg-gray-300'}`} />
      <span className={`flex-none w-12 text-left font-semibold ${picked ? 'text-gray-800' : 'text-gray-500'}`}>{a.name || '계정'}</span>
      <span className="flex-1 h-1.5 rounded-full bg-gray-200/80 overflow-hidden"><span className={`block h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, t.left))}%` }} /></span>
      <span className="flex-none w-24 text-right text-gray-600">{t.label} 남음 {Math.max(0, t.left)}%</span>
      {picked && auto && <span className="flex-none text-[10px] text-indigo-500 font-medium">자동</span>}
    </button>
  );
}

function usageVerdict(u: ClaudeAccountUsage): { tone: 'ok' | 'warn' | 'wait'; text: string; sub: string } {
  const full = [u.sessionUsed >= 100 && u.sessionResetAt, u.weekUsed >= 100 && u.weekResetAt].filter(Boolean) as string[];
  if (full.length) {
    const until = full.sort().slice(-1)[0];
    return { tone: 'wait', text: `${u.name} 한도가 다 찼어요`, sub: `${fmtTime(until)}(${fmtLeft(until)})부터 — 지금 눌러 두면 그때 시작해요` };
  }
  const t = tighter(u);
  if (t.left <= 20) {
    return { tone: 'warn', text: `${u.name} ${t.label} 남음 ${t.left}% — 작업 중 멈출 수 있어요`,
             sub: t.resetAt ? `${fmtTime(t.resetAt)} 초기화 뒤 이어서 해요` : '' };
  }
  return { tone: 'ok', text: `${u.name}으로 지금 바로 요청할 수 있어요`, sub: '' };
}

// '자동'일 때 맥 프로그램이 고르는 계정 — 남은 양이 많은 쪽부터, 이 작업에 필요한 만큼 남은 계정을 쓴다.
const autoAccount = (list: ClaudeAccountUsage[], need = 0) => {
  const sorted = [...list].sort((a, b) => tighter(b).left - tighter(a).left);
  return sorted.find(a => tighter(a).left >= need) ?? sorted[0];
};

// account: 이번 요청에 쓸 계정 이름 (''이면 남은 계정을 맥 프로그램이 고른다). onAccount를 주면 줄을 눌러 고를 수 있다.
// 높이가 들쭉날쭉하지 않게 줄 높이와 안내 줄 높이를 고정한다.
export function UsagePanel({ account = '', onAccount, jobKind }: { account?: string; onAccount?: (v: string) => void; jobKind?: string }) {
  const u = useClaudeUsage(true);
  const costs = useJobCost(true);
  const cost = jobKind ? costs[jobKind] : undefined;   // 이 작업이 보통 쓰는 세션 사용량 (기록이 쌓이면 표시)
  const shell = 'w-full rounded-xl border border-black/5 bg-gray-50/60 p-3 flex flex-col gap-1.5 min-h-[104px] justify-center';
  if (u === undefined) return <div className={`${shell} text-[11px] text-gray-300 text-center`}>Claude 사용량 확인 중…</div>;
  if (u === null) return <div className={`${shell} text-[11px] text-gray-400 text-center`}>Claude 사용량 정보가 아직 없어요 (디자이너 맥이 켜지면 표시돼요)</div>;
  const accounts: ClaudeAccountUsage[] = u.accounts.length ? u.accounts
    : [{ name: '계정', sessionUsed: u.sessionUsed, sessionResetAt: u.sessionResetAt, weekUsed: u.weekUsed, weekResetAt: u.weekResetAt }];
  const auto = !accounts.some(a => a.name === account);
  const need = cost ? Math.ceil(cost.sessionPct * 1.2) : 0;   // 평균보다 조금 여유 있게 본다
  const target = auto ? autoAccount(accounts, need) : accounts.find(a => a.name === account)!;
  const short = need > 0 && tighter(target).left < need;
  const v = usageVerdict(target);
  const stale = u.checkedAt && Date.now() - new Date(u.checkedAt).getTime() > 15 * 60000;
  const box = v.tone === 'wait' ? 'bg-red-50 text-red-600' : v.tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700';
  return (
    <div className={shell}>
      <div className="flex items-center justify-between gap-2 px-1.5">
        <div className="text-[11px] font-semibold text-gray-600 truncate">
          Claude 사용량 (디자이너 맥)
          {cost && <span className="font-medium text-gray-400"> · 이 작업 보통 {Math.round(cost.sessionPct)}%</span>}
        </div>
        {onAccount && accounts.length > 1 && (
          <button type="button" onClick={() => onAccount('')} title="여유 있는 계정을 알아서 고르게 해요"
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${auto ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>자동</button>
        )}
      </div>
      {accounts.map(a => (
        <AccountRow key={a.name} a={a} picked={a.name === target.name} auto={auto}
          onPick={onAccount ? () => onAccount(a.name) : undefined} />
      ))}
      <div className={`text-[11px] rounded-lg px-2.5 py-1 leading-tight h-[40px] flex flex-col justify-center gap-0.5 overflow-hidden ${box}`}>
        <div className="truncate">{short ? `${target.name} 남은 양이 이 작업 평균 ${Math.round(cost!.sessionPct)}%보다 적어요` : v.text}</div>
        {(short || v.sub) && <div className="text-[10px] opacity-70 truncate">{short ? '중간에 멈출 수 있어요' : v.sub}</div>}
      </div>
      {stale && <div className="text-[10px] text-gray-400 px-1.5">마지막 확인 {fmtTime(u.checkedAt)} — 맥이 꺼져 있어 최신이 아닐 수 있어요</div>}
    </div>
  );
}
