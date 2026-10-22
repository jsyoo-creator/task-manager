/* =============================================================================
 * 라이브 배너 카피 생성 로직
 * 원본: Live_배너카피생성기_v14.html (Planning Update 폴더, 문서: Live_배너카피생성기_v14_MD.md) — 2026-10 이식
 * 원본 툴과 다시 맞출 수 있도록 함수 이름(gen, shorten, autoFill, prod, prodS, ben, bco, parseBDate,
 * getTimeLabel, getEvLabel, LIM)과 규칙은 원본 그대로 두고, DOM에서 값을 읽던 부분만 인자로 바꿨다.
 * 뺀 것: 미리보기 이미지(base64), 최근 방송(localStorage), 복사·토스트, 설정 서랍(글자수 기준 수정).
 * 더한 것: bannerGroups()/copiesFromGroups() — 결과를 화면 행과 Firestore 저장 모양으로 바꾼다.
 * ========================================================================== */

// 글자수 기준 (공백 포함) — 원본 LIM 그대로
export const LIM = { keyMain: 15, keySub: 28, heroMain: 18, heroSub: 28, homeHeroMain: 12, homeHeroSub: 24, pr1: 20, pr2: 20, bt1: 14, pop1: 12, th1: 16, th2: 15, sn1: 16, sn2: 15, in1: 17, in2: 17 } as const;
export type LimKey = keyof typeof LIM;
export const LIM_L: Record<LimKey, string> = { keyMain: 'KV 카피 메인', keySub: 'KV 카피 서브', heroMain: '히어로 메인 (라이브)', heroSub: '히어로 서브 (라이브)', homeHeroMain: '히어로 메인 (홈메인)', homeHeroSub: '히어로 서브 (홈메인)', pr1: '홍보배너 1줄', pr2: '홍보배너 2줄', bt1: '바텀시트 메인카피 (MO)', pop1: '팝업 메인카피 (PC)', th1: '썸네일 1줄', th2: '썸네일 2줄', sn1: 'SNS 1줄', sn2: 'SNS 2줄', in1: '인사이더 1줄', in2: '인사이더 2줄' };

const PD: { l: string; k: string[]; f: string }[] = [
  { l: '에어컨', k: ['에어컨', '휘센'], f: 'LG 휘센 에어컨' },
  { l: '냉장고', k: ['냉장고', '디오스'], f: 'LG 디오스 냉장고' },
  { l: '세탁기', k: ['세탁기', '트롬', '워시타워', '워시콤보'], f: 'LG 트롬 세탁기' },
  { l: '건조기', k: ['건조기'], f: 'LG 트롬 건조기' },
  { l: '제습기', k: ['제습기'], f: 'LG 휘센 제습기' },
  { l: '스타일러', k: ['스타일러'], f: 'LG 스타일러' },
  { l: '공기청정기', k: ['공기청정기', '퓨리케어'], f: 'LG 퓨리케어 공기청정기' },
  { l: '정수기', k: ['정수기'], f: 'LG 퓨리케어 정수기' },
  { l: '식기세척기', k: ['식기세척기'], f: 'LG 디오스 식기세척기' },
  { l: 'TV', k: ['TV', '올레드', 'OLED', 'QNED'], f: 'LG TV' },
  { l: '노트북', k: ['노트북', '그램'], f: 'LG 그램 노트북' },
  { l: '사운드바', k: ['사운드바'], f: 'LG 사운드바' },
  { l: '청소기', k: ['청소기', '코드제로'], f: 'LG 코드제로 청소기' },
  { l: '침대', k: ['침대', '시몬스', '매트리스'], f: '시몬스 침대' },
  { l: '소파', k: ['소파', '알로소'], f: '알로소 소파' },
  { l: '주방가전', k: ['주방가전'], f: 'LG 주방가전' },
  { l: '가전', k: ['가전'], f: 'LG 가전' },
];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const pad2 = (n: number) => String(n).padStart(2, '0');

// ── 방송 시간 ── hour: '20' | '21' | 'custom' (원본 라디오 값)
export type BannerHour = '20' | '21' | 'custom';
export function getTimeLabel(hour: BannerHour, custom = ''): string {
  if (hour === 'custom') return custom.trim() || '오후 8시';
  return hour === '20' ? '오후 8시' : '오후 9시';
}
export function getEvLabel(hour: BannerHour, custom = ''): string {
  if (hour === 'custom') {
    const t = custom.trim() || '저녁 8시';
    return t.startsWith('오후') ? t.replace('오후', '저녁') : t;
  }
  return hour === '20' ? '저녁 8시' : '저녁 9시';
}
// 저장된 시간 문구('오후 8시' 등) → 화면 선택값
export function hourFromLabel(label: string): { hour: BannerHour; custom: string } {
  const t = (label ?? '').trim();
  if (!t || t === '오후 8시') return { hour: '20', custom: '' };
  if (t === '오후 9시') return { hour: '21', custom: '' };
  return { hour: 'custom', custom: t };
}

// ── 방송일 ── 원본과 같은 형식을 인식. 연도를 안 쓰면 baseYear(없으면 올해)
export const DT_HINT = '월/일만 입력해도 됩니다 · 예: 10/27, 10.27, 10월 27일, 1027';
export function parseBDate(s: string, baseYear?: number): { y: number; m: number; d: number; auto: boolean; iso: string; wd: string } | null {
  s = (s || '').trim(); if (!s) return null;
  const cy = baseYear ?? new Date().getFullYear(); let y = cy, m: number, d: number, a: RegExpMatchArray | null, auto = true;
  if ((a = s.match(/^(\d{4})(\d{2})(\d{2})$/))) { y = +a[1]; m = +a[2]; d = +a[3]; auto = false; }
  else if ((a = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/))) { y = +a[1]; m = +a[2]; d = +a[3]; auto = false; }
  else if ((a = s.match(/^(\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})$/))) { y = 2000 + (+a[1]); m = +a[2]; d = +a[3]; auto = false; }
  else if ((a = s.match(/^(\d{1,2})\s*[-./월\s]\s*(\d{1,2})\s*일?$/))) { m = +a[1]; d = +a[2]; }
  else if ((a = s.match(/^(\d{1,2})(\d{2})$/))) { m = +a[1]; d = +a[2]; }
  else return null;
  if (y < 2000 || y > 2099) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return { y, m, d, auto, iso: y + '-' + pad2(m) + '-' + pad2(d), wd: WD[dt.getDay()] };
}
// 원본 fmt() — iso 'YYYY-MM-DD' → "10.27(화)" / "10.27(화) 오후 8시"
export function fmt(iso: string, timeLabel: string): { ds: string; full: string } {
  if (!iso) return { ds: '', full: '' };
  const dt = new Date(iso + 'T00:00:00');
  if (isNaN(dt.getTime())) return { ds: '', full: '' };
  const ds = `${dt.getMonth() + 1}.${dt.getDate()}(${WD[dt.getDay()]})`;
  return { ds, full: `${ds} ${timeLabel}` };
}

// ── 혜택 문구 ── 원본 ben(): 커스텀 문구가 있으면 그대로, 아니면 "최대 13% 할인 + 5% 쿠폰 + 7% 카드"
export interface BenefitParts { r1: string; r2: string; r3: string; useMax: boolean; customB?: string }
export function ben(p: BenefitParts): string {
  const c = (p.customB ?? '').trim(); if (c) return c;
  const b = p.r1.trim(), cp = p.r2.trim(), cd = p.r3.trim(), mx = p.useMax;
  if (!b) return mx ? '최대 할인' : '';
  let s = `${mx ? '최대 ' : ''}${b}% 할인`;
  if (cp) s += ` + ${cp}% 쿠폰`; if (cd) s += ` + ${cd}% 카드`; return s;
}
// 방송구분 (원본 라디오 bc)
export type BroadcastType = '라이브' | '재방송';
export const bco = (v?: string): BroadcastType => (v === '재방송' ? '재방송' : '라이브');
export const prod = (v: string) => v.trim() || '(입력 필요)';
export const prodS = (short: string, product: string) => short.trim() || prod(product);

// 홈메인 히어로 자동 축약 — 원본 shorten 그대로
export function shorten(t: string, lim: number): string {
  t = (t || '').trim().replace(/\s+/g, ' ');
  if (!t || t.length <= lim) return t;
  const steps = [(x: string) => x.replace(/^LG\s+/, ''), (x: string) => x.replace(/베스트 특집/, '특집'), (x: string) => x.replace(/할인 혜택/, '혜택')];
  let cur = t;
  for (const f of steps) { cur = f(cur).trim(); if (cur.length <= lim) return cur; }
  const tk = cur.split(' ');
  for (let i = 1; i < tk.length; i++) { const s = tk.slice(i).join(' '); if (s.length <= lim) return s; }
  return cur;
}

// KV 카피에서 제품군·축약명·할인율 자동 인식 — 원본 autoFill (값을 돌려주기만 함, 덮어쓸지는 화면이 정함)
export function autoFill(kvMain: string, kvSub: string): { prod?: string; prodS?: string; r1?: string; r2?: string; r3?: string; useMax: boolean } {
  const txt = (kvMain + ' ' + kvSub).toUpperCase();
  let mt = PD.filter(p => p.k.some(k => txt.includes(k.toUpperCase())));
  if (mt.length > 1) { const ls = mt.map(m => m.l); mt = mt.filter(m => !ls.some(o => o !== m.l && o.includes(m.l))); }
  const GENERIC = ['가전', '주방가전'];
  if (mt.length > 1) { const specific = mt.filter(m => !GENERIC.includes(m.l)); if (specific.length) mt = specific; }
  const out: ReturnType<typeof autoFill> = { useMax: /최대/.test(kvMain + ' ' + kvSub) };
  if (mt.length === 1) { out.prod = mt[0].f; out.prodS = mt[0].l; }
  else if (mt.length > 1) { out.prod = mt.map(m => m.l).join('&'); out.prodS = mt.map(m => m.l).join('&'); }
  const rm = [...(kvMain + ' ' + kvSub).matchAll(/(\d+)\s*%/g)].map(m => m[1]);
  if (rm[0] !== undefined) out.r1 = rm[0];
  if (rm[1] !== undefined) out.r2 = rm[1];
  if (rm[2] !== undefined) out.r3 = rm[2];
  return out;
}

// ── 생성 ── 원본 gen()과 같은 결과 (DOM 대신 입력값을 받는다)
export interface GenInput {
  kvMain: string; kvSub: string;
  liveDate: string;          // 'YYYY-MM-DD' (없으면 '')
  timeLabel: string;         // '오후 8시'
  evLabel: string;           // '저녁 8시'
  broadcastType: BroadcastType;
  benefit: string;           // ben() 결과 또는 직접 입력
  product: string; shortName: string;
}
export function gen(i: GenInput) {
  const m = i.kvMain.trim(), s = i.kvSub.trim();
  const { full } = fmt(i.liveDate, i.timeLabel), b = i.broadcastType, bn = i.benefit.trim(), p = prod(i.product), ps = prodS(i.shortName, i.product);
  const evLbl = i.evLabel;
  const prLine1 = full ? full + ' LIVE' : '(날짜 입력 필요) LIVE';
  const bnPart = bn ? ' ' + bn : '';
  const bBn = bn ? b + bnPart : b;
  const thMain = p.length <= LIM.th1 ? p : ps;
  const snMain = p.length <= LIM.sn1 ? p : ps;
  return { full, pr: [prLine1, bn ? ps + bnPart : ps], bt: ['오늘 ' + i.timeLabel + ',', m || '(입력 필요)'], hero: [m, s], th: [thMain, bBn], sn: [snMain, bBn], ins: ['오늘 ' + evLbl + ' ' + ps, bBn], home: [shorten(m, LIM.homeHeroMain), shorten(s, LIM.homeHeroSub)], homeSrc: [m, s] };
}

// ── 화면 행 · 저장 모양 ──
// Firestore planDrafts.banner.copies 의 키. 순서 = 결과 화면 순서 (홈메인 → 상단홍보 → 바텀시트·팝업 → 라이브 히어로 → 방송 썸네일 → SNS → 인사이더)
export type CopyKey = 'homeHero' | 'promo' | 'bottomSheet' | 'popup' | 'liveHero' | 'thumb' | 'sns' | 'insider';
export const COPY_KEYS: CopyKey[] = ['homeHero', 'promo', 'bottomSheet', 'popup', 'liveHero', 'thumb', 'sns', 'insider'];
export type BannerCopies = Partial<Record<CopyKey, { pc?: string[]; mo?: string[] }>>;

export interface BannerRow {
  id: string;                // `${copyKey}.${slot}` — 수정값 보관 키
  copyKey: CopyKey; slot: 'pc' | 'mo';
  name: string; en: string;  // 원본 표의 이름 / 영문 파일명
  lines: string[];           // 생성된 원래 줄 (위→아래)
  limKeys: (LimKey | null)[];
  notes?: string[];          // 줄별 안내 (홈메인 자동 축약)
}
export interface BannerGroup { title: string; en: string; rows: BannerRow[]; warn?: string }

export function bannerGroups(g: ReturnType<typeof gen>): BannerGroup[] {
  const row = (copyKey: CopyKey, slot: 'pc' | 'mo', name: string, en: string, lines: string[], limKeys: (LimKey | null)[], notes?: string[]): BannerRow =>
    ({ id: `${copyKey}.${slot}`, copyKey, slot, name, en, lines, limKeys, notes });
  const hl = [LIM.homeHeroMain, LIM.homeHeroSub];
  const hn = g.homeSrc.map((o, i) => (o && o !== g.home[i] ? 'ℹ 원문 ' + o.length + '자를 ' + hl[i] + '자 기준으로 자동 축약했습니다 · 원문: ' + o : ''));
  return [
    { title: '홈메인 히어로배너', en: 'main-home_herobanner', rows: [
      row('homeHero', 'pc', 'PC', 'main-home_herobanner_pc', g.home, ['homeHeroMain', 'homeHeroSub'], hn),
      row('homeHero', 'mo', 'MO', 'main-home_herobanner_mo', g.home, ['homeHeroMain', 'homeHeroSub'], hn),
    ] },
    { title: '상단홍보배너', en: 'Promotion_Banner', rows: [
      row('promo', 'pc', 'PC', 'Promotion_Banner_pc', g.pr, ['pr1', 'pr2']),
      row('promo', 'mo', 'MO', 'Promotion_Banner_mo', g.pr, ['pr1', 'pr2']),
    ] },
    { title: '바텀시트 · 팝업', en: 'main-home_bottom / Popup', warn: '블랙 제품은 샤픈·빛효과로 배경 구분 필수', rows: [
      row('popup', 'pc', 'PC 팝업', 'main-home_Popup_live_PC', g.bt, [null, 'pop1']),
      row('bottomSheet', 'mo', 'MO 바텀시트', 'main-home_bottom_live_MO', g.bt, [null, 'bt1']),
    ] },
    { title: '라이브 히어로배너', en: 'Lgelive_herobanner', rows: [
      row('liveHero', 'pc', 'PC', 'Lgelive_herobanner_pc', g.hero, ['heroMain', 'heroSub']),
      row('liveHero', 'mo', 'MO', 'Lgelive_herobanner_mo', g.hero, ['heroMain', 'heroSub']),
    ] },
    { title: '방송 썸네일', en: 'Banner_thumb', rows: [
      row('thumb', 'pc', '900x1200', 'Banner_thumb_900x1200', g.th, ['th1', 'th2']),
      row('thumb', 'mo', '1080x810', 'Banner_thumb_1080x810', g.th, ['th1', 'th2']),
    ] },
    { title: 'SNS · 방송안내 썸네일', en: 'Banner_sns', rows: [
      row('sns', 'pc', '1000x1000', 'thumbnail_1000x1000', g.sn, ['sn1', 'sn2']),
      row('sns', 'mo', 'SNS 1024', 'Banner_sns_1024', g.sn, ['sn1', 'sn2']),
    ] },
    { title: '인사이더 배너', en: 'Insider_banner', rows: [
      row('insider', 'pc', '인사이더', 'Insider_banner', g.ins, ['in1', 'in2']),
    ] },
  ];
}

// 줄 하나 정리 (원본 normTxt + trim)
export const normLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();
export const alertTxt = (n: number, l: number) => '⚠ 글자수 초과 — 현재 ' + n + '자 / 기준 ' + l + '자 (' + (n - l) + '자 초과)';

// 화면 행 + 사람이 고친 줄(edits[row.id]) → 저장할 최종 카피
export function copiesFromGroups(groups: BannerGroup[], edits: Record<string, string[]>): BannerCopies {
  const out: BannerCopies = {};
  groups.forEach(gr => gr.rows.forEach(r => {
    const lines = (edits[r.id] ?? r.lines).map(normLine);
    out[r.copyKey] = { ...(out[r.copyKey] ?? {}), [r.slot]: lines };
  }));
  return out;
}

// 저장된 카피 → 수정값(edits)으로 되돌리기 (추가 작성하기에서 지난 내용을 다시 보여줄 때)
export function editsFromCopies(groups: BannerGroup[], copies: BannerCopies | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!copies) return out;
  groups.forEach(gr => gr.rows.forEach(r => {
    const saved = copies[r.copyKey]?.[r.slot];
    if (saved && saved.join('\n') !== r.lines.join('\n')) out[r.id] = saved;
  }));
  return out;
}

// 글자수 초과 줄 수 (원본 요약 바와 같은 기준: 기준이 있는 줄만)
export function countOver(groups: BannerGroup[], edits: Record<string, string[]>): { bad: number; byGroup: number[] } {
  const byGroup = groups.map(gr => gr.rows.reduce((sum, r) => {
    const lines = edits[r.id] ?? r.lines;
    return sum + r.limKeys.filter((k, i) => k && normLine(lines[i] ?? '').length > LIM[k]).length;
  }, 0));
  return { bad: byGroup.reduce((a, b) => a + b, 0), byGroup };
}
