// 세부업무 시작일~종료일 기준으로 "주차(월~금)"를 계산하고, weeklyHours(w{n}d{1~5}) 맵을
// 다루는 공용 로직. 업무상세 패널과 캘린더 페이지가 동일한 계산식을 공유해야
// 두 화면에서 같은 세부업무의 시간이 서로 어긋나지 않는다.

export function getWeekDays(startDate: string, endDate?: string) {
  const DAY_NAMES = ['월', '화', '수', '목', '금'];
  if (!startDate) return [];

  const base = new Date(startDate);
  const dow = base.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);

  let weekCount = 1;
  if (endDate) {
    const end = new Date(endDate);
    const endDow = end.getDay();
    const endDiff = endDow === 0 ? -6 : 1 - endDow;
    const endMonday = new Date(end);
    endMonday.setDate(end.getDate() + endDiff);
    const diffMs = endMonday.getTime() - monday.getTime();
    weekCount = Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
  }

  return Array.from({ length: weekCount }, (_, wi) => {
    const weekMon = new Date(monday);
    weekMon.setDate(monday.getDate() + wi * 7);
    const weekLabel = `${weekMon.getMonth() + 1}/${weekMon.getDate()}`;
    const days = Array.from({ length: 5 }, (__, di) => {
      const d = new Date(weekMon);
      d.setDate(weekMon.getDate() + di);
      return { name: DAY_NAMES[di], date: `${d.getMonth() + 1}/${d.getDate()}` };
    });
    return { weekLabel, days };
  });
}

export function getStartEndDayIdx(startDate?: string, endDate?: string): { startDayIdx: number; endDayIdx: number } {
  const sd = startDate ? new Date(startDate) : null;
  const sdDow = sd?.getDay() ?? 1;
  const startDayIdx = !sd ? 0 : (sdDow === 0 || sdDow === 6) ? 0 : sdDow - 1;
  const endDayIdx = (() => {
    if (!endDate) return 4;
    const ed = new Date(endDate);
    const edDow = ed.getDay();
    return (edDow === 0 || edDow === 6) ? 4 : edDow - 1;
  })();
  return { startDayIdx, endDayIdx };
}

export function calcHoursInRange(hours: Record<string, number>, startDate: string, endDate?: string): number {
  const weeks = getWeekDays(startDate, endDate);
  if (weeks.length === 0) return 0;
  const { startDayIdx, endDayIdx } = getStartEndDayIdx(startDate, endDate);
  const validKeys = new Set<string>();
  weeks.forEach((_, wi) => {
    const fromDay = wi === 0 ? startDayIdx : 0;
    const toDay = wi === weeks.length - 1 ? endDayIdx : 4;
    for (let di = fromDay; di <= toDay; di++) validKeys.add(`w${wi + 1}d${di + 1}`);
  });
  return Object.entries(hours).filter(([k]) => validKeys.has(k)).reduce((s, [, v]) => s + v, 0);
}

// PL 검수(review) 항목들의 시간 합계 — 항목별로 날짜 범위가 다를 수 있어 항목마다 calcHoursInRange를 적용
export function calcReviewTotal(
  weeklyHoursByItem: Record<string, Record<string, number>>,
  datesByItem: Record<string, { startDate?: string; endDate?: string }>,
  itemIds: string[]
): number {
  return itemIds.reduce((sum, id) => {
    const d = datesByItem[id];
    const h = weeklyHoursByItem[id] ?? {};
    if (!d?.startDate) return sum + Object.values(h).reduce((a, b) => a + b, 0);
    return sum + calcHoursInRange(h, d.startDate, d.endDate);
  }, 0);
}
