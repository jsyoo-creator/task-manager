// 업무관리 DB(Firestore 무료 요금제) 하루 읽기 한도 — 2026-10-26 사용자: "우린 무료로 최대한 쓰는 거니깐"
// 한도가 차면 읽기가 막혀 저장 요청(먼저 읽고 쓰는 트랜잭션)도 실패한다. 건수는 결제 계정 없이는 조회가 안 돼서
// '찼는지'만 Firestore 오류 코드(resource-exhausted)로 알아낸다. 한도는 태평양 시간 자정에 풀린다.

export function isQuotaError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code ?? '';
  return code === 'resource-exhausted' || code === 'firestore/resource-exhausted';
}

/** 한도가 풀리는 시각(내 컴퓨터 시간) — 한국은 16시, 미국 서머타임이 끝나면(11월 첫 일요일~) 17시 */
export function quotaResetLabel(now = new Date()): string {
  const hourPT = (d: Date) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(d));
  const t = new Date(now);
  t.setMinutes(0, 0, 0);
  for (let i = 0; i < 26; i++) {
    t.setTime(t.getTime() + 3600000);
    if (hourPT(t) === 0) return `${t.getHours()}시`;
  }
  return '오후 4~5시';
}

export const quotaMessage = (keepInput = false) => `업무관리 DB 오늘 읽기 한도가 찼어요 — ${quotaResetLabel()}에 풀려요. 그때 다시 눌러 주세요`
  + (keepInput ? ' (입력한 내용은 이 창을 닫지 않으면 그대로 있어요)' : '');
