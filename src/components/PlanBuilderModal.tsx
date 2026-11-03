import { useState, useMemo, useDeferredValue, useRef, useEffect, type ReactNode } from 'react';
import { X, Loader2, Send, TriangleAlert, CircleCheck, Info, ChevronDown, RotateCcw, ArrowRight } from 'lucide-react';
import type { Task } from '../types';
import {
  LIM, gen, autoFill, ben, bannerGroups, copiesFromGroups, editsFromCopies, countOver, normLine, alertTxt,
  parseBDate, getTimeLabel, getEvLabel, pairRowId,
  type BannerHour, type BannerRow, type GenInput,
} from '../lib/planTools/bannerCopy';
import {
  parsePromo, promoKvOpt, promoJoinProducts, promoHideState, promoOrderState, promoPayState, setPromoPrevCases,
  promoPreviewText, promoEditHtml, promoEdit, promoPlaceLive, promoKvInfo, promoAirHour, promoSummary, promoPayment, promoLiveCards, promoAuto,
  promoLegalSections,
  defaultPromoOpts, PROMO_PREVIEW_CSS, PROMO_EDIT_CSS, type PromoStructured, type PromoOpts,
} from '../lib/planTools/promoParse';
import {
  scopeHasBanner, scopeHasLanding, promoCaseName, defaultPlanFileName, bumpVersion, versionFromFileName, cleanFileName, INVALID_FILE_CHARS, liveDateFromFolder,
  type PlanDraft, type PlanDraftKind, type PlanScope, type PlanDraftBanner, type PlanDraftLanding,
} from '../lib/planDraft';
import { PlanDraftBusyError, loadPrevLiveCases, type PlanRequest } from '../hooks/usePlanDraft';
import { applyPromoHighlight, type PromoHighlight } from '../lib/planTools/promoHighlight';
import { isQuotaError, quotaMessage } from '../lib/dbQuota';

type Tab = 'landing' | 'banner';
type Ov = { product?: string; shortName?: string; discount?: string };

// 기획서 편집 화면 — 기획팀 통합셋팅기 v17과 같은 흐름 (2026-11-02 기획팀: "한 파일 내 탭 이동이 원칙, 페이지 확인 후 > 배너 순")
//  ① 페이지 셋팅: 판촉 원문을 붙여넣으면 워싱본(와이어프레임)이 나오고, 그 위에서 바로 고친다 — KV·문구 클릭 수정, 카드 삭제, ⋮⋮ 끌어서 순서, ＋추가, 아이콘 선택
//  ② 배너 워싱: 페이지 KV·방송 시간·재방송으로 배너 카피가 자동으로 만들어진다 (생성 버튼 없음). 직접 고친 줄은 KV가 바뀌어도 유지
// 고른 범위의 탭만 보이고 보낸다. 추가 작성하기·실패 후 다시 요청은 지난번에 보낸 내용으로 채워서 연다.
export default function PlanBuilderModal({ task, folderName, scope, draft, seed, again, kind = 'initial', title, baseFile, account = '', currentUserName, workplaceId, teamId, requestPlan, onClose }: {
  task: Task;
  folderName: string;
  scope: PlanScope;
  draft: PlanDraft | null;
  seed: PlanDraft | null;          // 화면을 채울 값 (업데이트는 1차 기획서 입력값을 가져온다)
  again: boolean;
  kind?: PlanDraftKind;
  title: string;
  baseFile?: string;               // 업데이트가 틀로 삼을 지난 결과 파일 (.pptx 포함)
  account?: string;                // 팝업에서 고른 Claude 계정 ('' = 자동)
  currentUserName: string;
  workplaceId?: string;
  teamId?: string;
  requestPlan: (req: PlanRequest) => Promise<void>;
  onClose: () => void;
}) {
  const showBanner = scopeHasBanner(scope);
  const showLanding = scopeHasLanding(scope);
  const [tab, setTab] = useState<Tab>(showLanding ? 'landing' : 'banner');
  const prevBanner = seed?.banner;
  const promoCase = promoCaseName(task.title);
  const baseYear = folderYear(folderName);

  // ── 방송 옵션 (페이지·배너 공통) — KV·방송 시간·재방송까지 원본처럼 opts 하나에 둔다 ──
  const [raw, setRaw] = useState(seed?.landing?.raw ?? '');
  const deferredRaw = useDeferredValue(raw);
  const [opts, setOpts] = useState<PromoOpts>(() => {
    const o: PromoOpts = { ...defaultPromoOpts(promoCase), ...(seed?.landing?.structured?.opts ?? {}) };
    const hasLandingOpts = !!seed?.landing?.structured?.opts;
    // 배너만 저장했던 요청(또는 예전 요청)은 배너 입력값에서 KV·방송 시간·재방송을 가져온다
    if (!o.kv && prevBanner?.kvMain) o.kv = promoKvOpt(prevBanner.kvMain, prevBanner.kvSub ?? '');
    if (!hasLandingOpts && prevBanner?.liveTime) o.air = airFromLabel(prevBanner.liveTime);
    if (!hasLandingOpts && prevBanner?.broadcastType === '재방송') o.rebro = true;
    return o;
  });
  const setOpt = <K extends keyof PromoOpts>(k: K, v: PromoOpts[K]) => setOpts(o => ({ ...o, [k]: v }));

  // 결제혜택 '직전 라이브와 동일'을 고르면 그때 한 번 지난 방송(같은 팀 1차 기획서 저장분)을 읽는다 (통합셋팅기 v08)
  const [prevLoad, setPrevLoad] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [prevVer, setPrevVer] = useState(0);
  useEffect(() => {
    if (opts.payMode !== 'prev' || prevLoad !== 'idle') return;
    setPrevLoad('loading');
    loadPrevLiveCases(teamId ?? '')
      .then(cs => { setPromoPrevCases(cs); setPrevLoad('ready'); setPrevVer(v => v + 1); })
      .catch(e => { console.error('[planDraft] prev live load failed', e); setPrevLoad('error'); });
  }, [opts.payMode, prevLoad, teamId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pv = useMemo<PromoStructured>(() => parsePromo(deferredRaw, promoCase, opts), [deferredRaw, promoCase, opts, prevVer]);
  const pvRef = useRef(pv);
  pvRef.current = pv;
  const payState = useMemo(() => promoPayState(pv), [pv]);
  const promoAutoVal = useMemo(() => promoAuto(pv), [pv]);
  const summary = useMemo(() => promoSummary(pv), [pv]);

  // ── KV (페이지 워싱본 KV 점선 영역 = 배너 탭 KV 칸, 같은 값) ──
  const kv = useMemo(() => promoKvInfo(pv), [pv]);
  const kvMainJ = promoJoinProducts(kv.m), kvSubJ = promoJoinProducts(kv.s);   // v06: 제품 나열은 표시·배너에서 가운데점
  const setKv = (f: 'd' | 'm' | 's', v: string) => setOpts(o => {
    const ov = jparse(o.kv);
    const orig = f === 'd' ? kv.dateAuto : f === 'm' ? kv.mainAuto : '';
    const t = v.replace(/\s+/g, ' ');
    if (t.trim() === orig) delete ov[f]; else ov[f] = t;
    return { ...o, kv: Object.keys(ov).length ? JSON.stringify(ov) : '' };
  });

  // ── 방송 일시: KV 날짜("11. 2 (월) 오후 8시")에서 — 업무명 날짜 + 방송 시간이 자동값, KV 날짜를 직접 고치면 그 값 (v17 3장) ──
  const when = useMemo(() => kvWhen(kv.d) ?? null, [kv.d]);
  const airHour = promoAirHour(opts.air);
  const parsedDate = useMemo(() => (when ? parseBDate(`${when.m}/${when.d}`, baseYear) : null), [when, baseYear]);
  const hourInfo = when ? labelHour(when.h, when.min) : labelHour(airHour, 0);
  const broadcastType = opts.rebro ? '재방송' : '라이브';

  // ── 제품군·할인율: 비워 두면 KV에서 자동, 입력하면 모든 배너에 일괄 반영 (v10 아코디언) ──
  const auto = useMemo(() => {
    const af = autoFill(kvMainJ, kvSubJ);
    return { product: af.prod ?? kvMainJ.trim(), shortName: af.prodS ?? kvMainJ.trim(), discount: ben({ r1: af.r1 ?? '', r2: af.r2 ?? '', r3: af.r3 ?? '', useMax: af.useMax }), found: !!af.prod };
  }, [kvMainJ, kvSubJ]);
  const [ov, setOv] = useState<Ov>(() => {
    if (!prevBanner) return {};
    const af = autoFill(promoJoinProducts(prevBanner.kvMain ?? ''), promoJoinProducts(prevBanner.kvSub ?? ''));
    const a = { product: af.prod ?? prevBanner.kvMain ?? '', shortName: af.prodS ?? prevBanner.kvMain ?? '', discount: ben({ r1: af.r1 ?? '', r2: af.r2 ?? '', r3: af.r3 ?? '', useMax: af.useMax }) };
    const o: Ov = {};
    for (const k of ['product', 'shortName', 'discount'] as const) if (prevBanner[k] && prevBanner[k] !== a[k]) o[k] = prevBanner[k];
    return o;
  });
  const product = ov.product ?? auto.product, shortName = ov.shortName ?? auto.shortName, discount = ov.discount ?? auto.discount;

  // ── 배너 카피: 입력이 바뀌면 바로 다시 만든다 (v17: 생성 버튼 없음) ──
  const genInput: GenInput = {
    kvMain: kvMainJ, kvSub: kvSubJ, liveDate: parsedDate?.iso ?? '', timeLabel: getTimeLabel(hourInfo.hour, hourInfo.custom), evLabel: getEvLabel(hourInfo.hour, hourInfo.custom),
    broadcastType, benefit: discount, product, shortName,
  };
  const inputKey = JSON.stringify(genInput);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => bannerGroups(gen(genInput)), [inputKey]);
  const [edits, setEdits] = useState<Record<string, string[]>>(() => (prevBanner ? editsFromCopies(groups, prevBanner.copies) : {}));
  // 줄 하나 고치기 — PC·MO가 함께 들어가는 배너는 짝 행도 같은 문구로 (원본 v18 pairTxt)
  const rowById = useMemo(() => Object.fromEntries(groups.flatMap(gr => gr.rows.map(r => [r.id, r] as [string, BannerRow]))), [groups]);
  const editLine = (r: BannerRow, li: number, v: string) => setEdits(prev => {
    const next = { ...prev };
    const pair = rowById[pairRowId(r.id) ?? ''];
    for (const row of pair ? [r, pair] : [r]) { const cur = [...(prev[row.id] ?? row.lines)]; cur[li] = v; next[row.id] = cur; }
    return next;
  });
  const revertRow = (r: BannerRow) => setEdits(prev => {
    const next = { ...prev };
    delete next[r.id];
    const pair = pairRowId(r.id);
    if (pair) delete next[pair];
    return next;
  });
  const over = countOver(groups, edits);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── 워싱본(와이어프레임) 직접 수정 — 원본 함수를 그대로 불러 opts에 반영 ──
  const previewRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = (m: string) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2000); };
  // 문구를 고치고 바로 삭제 버튼을 누르면 화면이 다시 그려지기 전에 두 번 불린다 → 직전 수정 결과(latestOpts)를 바탕으로 이어서 고친다
  const latestOpts = useRef(opts);
  const pvOpts = useRef(opts);
  if (pvOpts.current !== opts) { pvOpts.current = opts; latestOpts.current = opts; }
  // 점선 영역 수정(포커스가 빠질 때)은 화면을 조금 늦게 다시 그린다 — 바로 그리면 그 클릭이 누른 버튼이 사라져 클릭이 씹힌다 (원본도 200ms 뒤에 그림)
  const commitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const doEdit = (call: string, el?: Element | null, defer = false) => {
    const base = latestOpts.current === pvOpts.current ? pvRef.current : parsePromo(deferredRaw, promoCase, latestOpts.current);
    const r = promoEdit(base, previewRef.current, call, el);
    if (!r) return;
    latestOpts.current = r.opts;
    clearTimeout(commitTimer.current);
    if (defer) commitTimer.current = setTimeout(() => setOpts(latestOpts.current), 200);
    else setOpts(r.opts);
    if (r.toast) flash(r.toast);
  };
  const doEditRef = useRef(doEdit);
  doEditRef.current = doEdit;

  // 변경 하이라이트 (통합셋팅기 v09) — 지난번 저장한 상세 내용 대비 바뀐 문구를 워싱본에 노란 배경으로
  const baseHtml = useMemo(() => {
    const l = seed?.landing;
    if (!l?.raw?.trim()) return null;
    const o = { ...(l.structured?.opts ?? {}) };
    if (!o.kv && seed?.banner?.kvMain) o.kv = promoKvOpt(seed.banner.kvMain, seed.banner.kvSub ?? '');
    return promoEditHtml(parsePromo(l.raw, promoCase, o));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, promoCase, prevVer]);
  const [hl, setHl] = useState<PromoHighlight | null>(null);
  const [hlOff, setHlOff] = useState(false);
  const editHtml = useMemo(() => (deferredRaw.trim() ? promoEditHtml(pv) : ''), [pv, deferredRaw]);
  useEffect(() => {
    const el = previewRef.current;
    if (!el || !editHtml) { setHl(null); return; }
    promoPlaceLive(pvRef.current, el);   // 직접 추가 혜택을 정해 둔 순서 자리에
    setHl(applyPromoHighlight(el, baseHtml));
    addDragHandles(el);
  }, [editHtml, baseHtml, tab]);

  // 점선 영역 수정·버튼·선택·끌기 — 원본 document 이벤트와 같은 동작을 미리보기 영역에서만
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const attr = (t: Element, k: string) => t.getAttribute(k);
    const editable = (t: Element) => !!(attr(t, 'data-cook') || attr(t, 'data-obs') || (attr(t, 'data-et') !== null && t.classList.contains('txtEdit')) || attr(t, 'data-kv') || attr(t, 'data-add'));
    const onFocusOut = (e: FocusEvent) => {
      const t = e.target as Element;
      if (!t?.getAttribute) return;
      if (attr(t, 'data-cook')) doEditRef.current('commitCookEdit', t, true);
      else if (attr(t, 'data-obs')) doEditRef.current('commitObsEdit', t, true);
      else if (attr(t, 'data-et') !== null && t.classList.contains('txtEdit')) doEditRef.current('commitTxtEdit', t, true);
      else if (attr(t, 'data-kv')) doEditRef.current('commitKv', t, true);
      else if (attr(t, 'data-add')) doEditRef.current('commitAddLive', t, true);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.getAttribute && editable(t) && e.key === 'Enter' && attr(t, 'data-cook') !== 'rates' && !e.isComposing) { e.preventDefault(); t.blur(); }
    };
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as Element;
      if (!t?.getAttribute || !editable(t)) return;
      e.preventDefault();
      const x = e.clipboardData?.getData('text') ?? '';
      document.execCommand('insertText', false, attr(t, 'data-cook') === 'rates' ? x : x.replace(/\s*\n\s*/g, ' '));
    };
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element)?.closest?.('[data-click]');
      if (!b || !box.contains(b)) return;
      e.preventDefault();
      doEditRef.current(b.getAttribute('data-click') ?? '', b);
    };
    const onChange = (e: Event) => {
      const t = e.target as Element;
      const c = t?.getAttribute?.('data-change');
      if (c) doEditRef.current(c, t);
    };
    // ⋮⋮ 핸들로 끌어서 순서 바꾸기 (v13)
    let dnd: { item: HTMLElement; kind: string } | null = null;
    const clearDrop = () => box.querySelectorAll('.dropB,.dropA').forEach(x => x.classList.remove('dropB', 'dropA'));
    const onDragStart = (e: DragEvent) => {
      const h = (e.target as Element)?.closest?.('.dragH');
      if (!h) return;
      const item = h.parentElement as HTMLElement;
      dnd = { item, kind: h.getAttribute('data-kind') ?? '' };
      item.classList.add('dragging');
      try { e.dataTransfer!.effectAllowed = 'move'; e.dataTransfer!.setData('text/plain', 'card'); e.dataTransfer!.setDragImage(item, 20, 20); } catch { /* 브라우저마다 다름 */ }
    };
    const onDragOver = (e: DragEvent) => {
      if (!dnd) return;
      const t = (e.target as Element)?.closest?.('.dndItem') as HTMLElement | null;
      if (!t || t === dnd.item || t.parentNode !== dnd.item.parentNode) return;
      e.preventDefault();
      const r = t.getBoundingClientRect();
      clearDrop();
      t.classList.add(e.clientY > r.top + r.height / 2 ? 'dropA' : 'dropB');
    };
    const onDrop = (e: DragEvent) => {
      if (!dnd) return;
      const t = (e.target as Element)?.closest?.('.dndItem') as HTMLElement | null;
      if (t && t !== dnd.item && t.parentNode === dnd.item.parentNode) {
        e.preventDefault();
        t.parentNode!.insertBefore(dnd.item, t.classList.contains('dropA') ? t.nextSibling : t);
        const k = dnd.kind;
        onDragEnd();
        doEditRef.current(`commitCardOrder('${k === 'obs' ? 'obs' : 'live'}')`);
      }
    };
    const onDragEnd = () => { dnd?.item.classList.remove('dragging'); clearDrop(); dnd = null; };
    const ev: [string, EventListener][] = [['focusout', onFocusOut as EventListener], ['keydown', onKey as EventListener], ['paste', onPaste as EventListener], ['click', onClick as EventListener],
      ['change', onChange], ['dragstart', onDragStart as EventListener], ['dragover', onDragOver as EventListener], ['drop', onDrop as EventListener], ['dragend', onDragEnd]];
    ev.forEach(([n, f]) => box.addEventListener(n, f));
    return () => ev.forEach(([n, f]) => box.removeEventListener(n, f));
  }, [tab, showLanding]);

  const unhideCard = (list: 'live' | 'obs' | 'all', i = 0) => doEdit(list === 'all' ? `unhideCard('all')` : `unhideCard('${list}',${i})`);

  // ── 파일 이름 ──
  const [fileName, setFileName] = useState(() => {
    // 실패한 요청은 같은 이름으로 다시. 단 2026-10-23 폴더 6자리 규칙 직후 버그로 '라이브커머스_261103_이름_…_오늘날짜'처럼
    // 날짜가 이름에 섞여 저장된 요청은 올바른 기본 이름으로 바꿔 준다
    if (draft?.status === 'failed' && draft.fileName)
      return /라이브커머스_\d{6}_/.test(draft.fileName) ? defaultPlanFileName(folderName) : draft.fileName;
    // 업데이트는 드라이브 최신 기획서(baseFile) 다음 버전으로 — 사람이 그 사이 버전을 올렸어도 겹치지 않게
    const last = (kind === 'update' ? baseFile || draft?.outputFile : draft?.outputFile || baseFile) || '';
    if (kind === 'update') {
      // 기획서 업데이트는 고칠 때마다 버전을 올린 새 파일로 남긴다 (2026-10-22 사용자)
      return last ? bumpVersion(cleanFileName(last)) : defaultPlanFileName(folderName);
    }
    if (!draft?.fileName) return defaultPlanFileName(folderName);
    // 1차 기획서는 같은 파일을 고쳐 쓰는 구조라 버전은 올리지 않고 그대로 둔다 (2026-10-22 사용자)
    return last ? cleanFileName(last) : draft.fileName;
  });
  const cleanName = cleanFileName(fileName);
  const noVersion = !!cleanName && !versionFromFileName(cleanName);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // 점선 영역을 고치다 바로 저장을 누르면 그 수정이 아직 화면 값에 안 들어가 있다 → 먼저 반영하고 다시 그린 뒤 저장
  const [saveTick, setSaveTick] = useState(0);
  useEffect(() => { if (saveTick) void save(); }, [saveTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (latestOpts.current !== pvOpts.current) {
      clearTimeout(commitTimer.current);
      setOpts(latestOpts.current);
      setSaveTick(t => t + 1);
      return;
    }
    setError('');
    if (!cleanName) { setError('파일 이름을 입력해 주세요'); return; }
    if (INVALID_FILE_CHARS.test(cleanName)) { setError('파일 이름에 쓸 수 없는 글자(\\ / : * ? " < > |)가 있어요'); return; }
    let banner: PlanDraftBanner | undefined;
    let landing: PlanDraftLanding | undefined;
    if (showLanding) {
      if (!raw.trim()) { setTab('landing'); setError('페이지: 판촉 원문을 붙여넣어 주세요'); return; }
    }
    if (showBanner) {
      if (!kvMainJ.trim()) { setTab(showLanding ? 'landing' : 'banner'); setError('KV 메인 카피를 입력해 주세요'); return; }
      if (!parsedDate) { setTab(showLanding ? 'landing' : 'banner'); setError("방송일을 찾지 못했어요 — KV 날짜를 '11. 2 (월) 오후 8시'처럼 적어 주세요"); return; }
      banner = {
        kvMain: kvMainJ.trim(), kvSub: kvSubJ.trim(), liveDate: parsedDate.iso, liveTime: genInput.timeLabel,
        product: product.trim(), shortName: shortName.trim(), discount: discount.trim(), broadcastType,
        copies: copiesFromGroups(groups, edits),
      };
    }
    if (showLanding) {
      const cur = parsePromo(raw, promoCase, opts);
      landing = {
        raw,
        structured: {
          notify: cur.notify,
          liveItems: cur.liveItems,
          liveCards: promoLiveCards(cur),   // 11번 한정 혜택 — 워싱본과 같은 2줄 정리
          // 12번 기획전 배너 — 실제 노출 목록(히든 기획전·냉장고 Fit&Max 포함)
          // fixed: 냉장고 포함 시 자동으로 붙는 고정 배너 — 기획서 12번 이미지 영역에 모델명을 넣지 않는다
          obsCards: (cur.obsShow ?? cur.obsCards).map(([code, mainTitle, subTitle, url, kind]) => ({ code: code || '', mainTitle: mainTitle || '', subTitle: subTitle || '', url: url || '', fixed: kind === 'fixed' })),
          paymentFullText: cur.paymentFullText,
          payment: promoPayment(cur),   // 13번 결제 혜택 장 — 워싱본과 같은 결제혜택 엔진 결과
          legalNotes: cur.legalNotes,
          legalSections: promoLegalSections(cur),   // 워싱본에 보이는 번호 유의사항 (원문에 없는 카카오·네이버페이 포함)
          opts: cur.opts,
        },
        previewText: promoPreviewText(cur),
      };
    }
    setSending(true);
    try {
      await requestPlan({ folderName, taskId: task.id, taskTitle: task.title, workplaceId, teamId, requestedBy: currentUserName, scope, fileName: cleanName, banner, landing, baseFile, account });
      onClose();
    } catch (e) {
      if (e instanceof PlanDraftBusyError) setError('이미 작성 요청을 처리 중이에요');
      else if (isQuotaError(e)) setError(quotaMessage(true));
      else { setError('요청을 저장하지 못했어요. 잠시 후 다시 눌러 주세요.'); console.error('[planDraft] request failed', e); }
    } finally {
      setSending(false);
    }
  };

  const input = 'w-full bg-black/3 border border-black/8 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder-gray-400 transition-all';
  const label = 'block text-[11px] font-semibold text-gray-500 mb-1';
  const tabs: Tab[] = [...(showLanding ? ['landing' as const] : []), ...(showBanner ? ['banner' as const] : [])];
  const tabName = (t: Tab) => (tabs.length > 1 ? (t === 'landing' ? '① 페이지 셋팅' : '② 배너 워싱') : t === 'landing' ? '페이지 셋팅' : '배너 워싱');
  const broadcast = <BroadcastPanel opts={opts} setOpt={setOpt} dateText={parsedDate ? `${parsedDate.m}.${parsedDate.d}(${parsedDate.wd})` : ''} input={input} />;
  const kvNote = `배너 기준 · 메인 ${kvMainJ.trim().length}/${LIM.keyMain}자 · 서브 ${kvSubJ.trim().length}/${LIM.keySub}자`;
  const kvOver = kvMainJ.trim().length > LIM.keyMain || kvSubJ.trim().length > LIM.keySub;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
      <div className="w-full max-w-[1100px] mx-4 h-[90vh] rounded-2xl bg-white border border-black/8 shadow-2xl flex flex-col overflow-hidden break-keep">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="text-[11px] text-gray-400 truncate" title={folderName}>{task.title} · 드라이브 폴더 {folderName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={17} /></button>
        </div>

        {/* 단계 탭 — 페이지 확인 후 배너 */}
        {tabs.length > 1 && (
          <div className="flex items-center gap-1 px-5 pt-3 flex-shrink-0">
            {tabs.map((t, i) => (
              <span key={t} className="flex items-center gap-1">
                {i > 0 && <ArrowRight size={12} className="text-gray-300" />}
                <button onClick={() => setTab(t)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                  {tabName(t)}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {tab === 'landing' && showLanding && (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_460px] gap-5 items-start">
              <div className="flex flex-col gap-3 min-w-0">
                {broadcast}
                <div>
                  <label className={label}>판촉 원문 (수급받은 원문 전체를 그대로 붙여넣기)</label>
                  <textarea className={`${input} min-h-[300px] font-mono text-xs leading-relaxed resize-y`} value={raw} onChange={e => setRaw(e.target.value)}
                    placeholder={'알림 신청 판촉\n투썸플레이스 아메리카노 (30명)\n\n라이브 한정 판촉\n1) …\n\nOBS 기획전/기본 판촉\nhttps://www.lge.co.kr/benefits/exhibitions/detail-PE…\n\nLGE닷컴 전사 판촉\n…'} />
                </div>
                <PromoOptionsPanel opts={opts} auto={promoAutoVal} setOpt={setOpt} input={input} />
                {raw.trim() && <HiddenCardsPanel opts={opts} onUnhide={unhideCard} onResetOrder={() => doEdit('resetCardOrder')} />}
                <PayModePanel opts={opts} setOpt={setOpt} state={payState} prevLoad={prevLoad} input={input} />
                {raw.trim() && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] font-semibold text-gray-500">인식 결과</div>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.chips.map((c, i) => <SummaryChip key={i} kind={c.kind}>{c.text}</SummaryChip>)}
                    </div>
                    {summary.notes.map((t, i) => <p key={i} className="text-[11px] text-amber-700">⚠ {t}</p>)}
                    <details className="mt-1 group">
                      <summary className="text-[11px] text-gray-500 cursor-pointer select-none flex items-center gap-1"><ChevronDown size={12} className="group-open:rotate-180 transition-transform" />워싱본 텍스트 보기 (기획서에 들어갈 문구)</summary>
                      <pre className="mt-1.5 text-[11px] leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3 text-gray-700 max-h-[300px] overflow-auto">{promoPreviewText(pv)}</pre>
                    </details>
                  </div>
                )}
                {showBanner && (
                  <button type="button" onClick={() => setTab('banner')}
                    className="self-end px-3.5 py-2 text-xs font-semibold rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1">
                    페이지 확인 끝 · ② 배너 워싱으로 <ArrowRight size={13} />
                  </button>
                )}
              </div>
              <div className="md:sticky md:top-0 relative">
                <div className="text-[11px] font-semibold text-gray-500 mb-1">워싱본 · 점선 영역을 눌러 바로 고치고, 카드 삭제·⋮⋮ 끌어서 순서·＋추가도 여기서 해요</div>
                {hl && (hl.total || hl.removed ? (
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] bg-[#FFF8D6] border border-[#F2C200] text-[#5c4a00] rounded-lg px-2.5 py-1.5">
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[#FFF1A6] ring-2 ring-[#F2C200] flex-shrink-0" />
                    <b>변경 하이라이트 {hl.total}곳</b>{hl.removed ? ` · 빠진 항목 ${hl.removed}곳` : ''}<span className="text-[#7a6400]">(지난 저장본 대비)</span>
                    <button type="button" onClick={() => setHlOff(v => !v)} className="ml-auto font-semibold underline">{hlOff ? '하이라이트 켜기' : '하이라이트 끄기'}</button>
                    <span className="w-full text-[10px] text-[#7a6400]">{hl.parts.join(' · ')}</span>
                  </div>
                ) : (
                  <div className="mb-1.5 text-[11px] bg-gray-50 border border-black/5 text-gray-500 rounded-lg px-2.5 py-1.5">지난 저장본 대비 · 페이지 문구 변경 없음</div>
                ))}
                {editHtml && <div className={`mb-1.5 text-center text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${kvOver ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'}`}>{kvNote}</div>}
                <div ref={boxRef} className="rounded-xl bg-gray-50 border border-black/5 max-h-[calc(90vh-250px)] overflow-y-auto p-2">
                  {editHtml ? (
                    <>
                      <style>{PROMO_PREVIEW_CSS + PROMO_EDIT_CSS}</style>
                      <div ref={previewRef} className={`promo-preview editing${hlOff ? ' hlOff' : ''}`} dangerouslySetInnerHTML={{ __html: editHtml }} />
                    </>
                  ) : (
                    <div className="py-16 text-center text-xs text-gray-400">판촉 원문을 붙여넣으면 워싱본이 나와요</div>
                  )}
                </div>
                {toast && <div className="absolute left-1/2 -translate-x-1/2 bottom-8 text-[11px] text-white bg-gray-800/90 rounded-lg px-3 py-1.5 shadow-lg pointer-events-none">{toast}</div>}
                <p className="text-[10px] text-gray-400 mt-1.5">금액·기간·조건·카드사 문구는 원문과 대조해 주세요 · 아이콘은 대체 그림이에요</p>
              </div>
            </div>
          )}

          {tab === 'banner' && showBanner && (
            <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start">
              {/* 입력 */}
              <div className="flex flex-col gap-4 md:sticky md:top-0">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 flex flex-col gap-3">
                  <div className="text-xs font-semibold text-indigo-600">KV 카피 <span className="font-normal text-indigo-400">· 페이지 워싱본 KV와 같은 값</span></div>
                  <div>
                    <label className={label}>메인</label>
                    <input className={input} value={kv.m} placeholder="예: 냉장고·쿠킹 라이브" onChange={e => setKv('m', e.target.value)} />
                    <KvCounter value={kvMainJ} lim={LIM.keyMain} />
                  </div>
                  <div>
                    <label className={label}>서브</label>
                    <input className={input} value={kv.s} placeholder="예: 남다른 혜택으로 산다, 라이브 최대 13% 할인" onChange={e => setKv('s', e.target.value)} />
                    <KvCounter value={kvSubJ} lim={LIM.keySub} />
                  </div>
                </div>

                {!showLanding ? broadcast : (
                  <div className="text-[11px] text-gray-500 rounded-xl bg-gray-50 border border-black/5 px-3 py-2">
                    방송 {parsedDate ? `${parsedDate.m}.${parsedDate.d}(${parsedDate.wd}) ${genInput.timeLabel}` : '일시 미확인'} · {broadcastType}
                    <span className="block text-[10px] text-gray-400 mt-0.5">업무명 날짜·① 방송 시간·재방송에서 자동 (KV 날짜를 직접 고치면 그 값)</span>
                  </div>
                )}

                <details className="rounded-xl border border-black/8 group" open={!!(ov.product || ov.shortName || ov.discount) || (!auto.found && !!kvMainJ.trim())}>
                  <summary className="px-3 py-2.5 cursor-pointer select-none flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <ChevronDown size={13} className="group-open:rotate-180 transition-transform" />제품군 · 할인율
                    <span className="ml-auto font-normal text-[10px] text-gray-400">
                      {ov.product || ov.shortName || ov.discount ? `직접 입력 중: ${[ov.product !== undefined && '제품군', ov.shortName !== undefined && '축약명', ov.discount !== undefined && '할인율'].filter(Boolean).join('·')}` : '배너 일괄 수정 시 사용'}
                    </span>
                  </summary>
                  <div className="px-3 pb-3 flex flex-col gap-2">
                    {!auto.found && !!kvMainJ.trim() && ov.product === undefined && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">KV 카피에서 제품군을 찾지 못해 KV 메인 카피로 채웠어요. 맞는지 확인해 주세요</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={label}>제품군</label>
                        <input className={input} value={ov.product ?? ''} placeholder={`자동: ${auto.product || '—'}`} onChange={e => setOv(o => ({ ...o, product: e.target.value || undefined }))} />
                      </div>
                      <div>
                        <label className={label}>축약명</label>
                        <input className={input} value={ov.shortName ?? ''} placeholder={`자동: ${auto.shortName || '—'}`} onChange={e => setOv(o => ({ ...o, shortName: e.target.value || undefined }))} />
                      </div>
                    </div>
                    <div>
                      <label className={label}>할인율 (혜택 문구)</label>
                      <input className={input} value={ov.discount ?? ''} placeholder={`자동: ${auto.discount || '—'}`} onChange={e => setOv(o => ({ ...o, discount: e.target.value || undefined }))} />
                    </div>
                    {(ov.product || ov.shortName || ov.discount) && (
                      <button type="button" onClick={() => setOv({})} className="self-start text-[11px] text-indigo-500 hover:underline">입력값 지우고 자동값으로</button>
                    )}
                  </div>
                </details>
              </div>

              {/* 결과 — KV가 바뀌면 바로 다시 만든다 */}
              <div className="min-w-0 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 border border-black/5 px-3 py-2">
                  {over.bad
                    ? <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5">⚠ 글자수 초과 {over.bad}건</span>
                    : <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-0.5">✔ 전체 통과</span>}
                  {groups.map((gr, i) => over.byGroup[i] ? (
                    <button key={gr.title} type="button" onClick={() => groupRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className="text-[11px] text-red-500 underline underline-offset-2 hover:text-red-600">{gr.title} · {over.byGroup[i]}건</button>
                  ) : null)}
                  <span className="text-[11px] text-gray-400 ml-auto">{groups.length}개 그룹 중 {over.byGroup.filter(n => !n).length}개 통과 · 카피를 눌러 바로 수정</span>
                </div>
                {groups.map((gr, gi) => (
                  <div key={gr.title} ref={el => { groupRefs.current[gi] = el; }} className="rounded-xl border border-black/8 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-800">{gr.title}</span>
                      <span className="text-[10px] text-gray-400">{gr.en}</span>
                      <span className={`ml-auto text-[10px] font-semibold rounded-md px-1.5 py-0.5 ${over.byGroup[gi] ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>
                        {over.byGroup[gi] ? `초과 ${over.byGroup[gi]}건` : '통과'}
                      </span>
                    </div>
                    {gr.warn && <p className="text-[10px] text-amber-700 bg-amber-50 rounded-md px-2 py-1 mb-2">⚠ {gr.warn}</p>}
                    <div className="flex flex-col gap-2.5">
                      {gr.rows.map(r => {
                        const lines = edits[r.id] ?? r.lines;
                        const edited = !!edits[r.id] && edits[r.id].map(normLine).join('\n') !== r.lines.join('\n');
                        return (
                          <div key={r.id} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                            <div className="pt-1.5">
                              <div className="text-xs font-medium text-gray-700">{r.name}</div>
                              <div className="text-[9px] text-gray-400 break-all leading-tight">{r.en}</div>
                            </div>
                            <div className="flex flex-col gap-1">
                              {lines.map((line, li) => {
                                const lk = r.limKeys[li];
                                const n = normLine(line).length;
                                const l = lk ? LIM[lk] : 0;
                                const isOver = !!lk && n > l;
                                return (
                                  <div key={li}>
                                    <div className={`flex items-center gap-2 rounded-lg border px-2 ${isOver ? 'border-red-200 bg-red-50/50' : 'border-black/8 bg-white'}`}>
                                      <input value={line} spellCheck={false}
                                        onChange={e => { const v = e.target.value; editLine(r, li, v); }}
                                        onBlur={e => { const v = normLine(e.target.value); if (v !== line) editLine(r, li, v); }}
                                        className={`flex-1 min-w-0 py-1.5 text-sm bg-transparent focus:outline-none ${isOver ? 'text-red-600' : 'text-gray-800'}`} />
                                      {lk && <span className={`text-[10px] flex-shrink-0 ${isOver ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{n}/{l}</span>}
                                    </div>
                                    {isOver && <p className="text-[11px] text-red-500 mt-0.5">{alertTxt(n, l)}</p>}
                                    {r.notes?.[li] && <p className="text-[10px] text-gray-400 mt-0.5">{r.notes[li]}</p>}
                                  </div>
                                );
                              })}
                              {edited && (
                                <p className="text-[10px] text-indigo-600">직접 수정한 줄 · KV가 바뀌어도 유지돼요 (자동 카피: 「{r.lines.join(' / ')}」)
                                  <button type="button" onClick={() => revertRow(r)} className="ml-1.5 underline">자동 카피로</button></p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-gray-400">캘린더 썸네일(Lgelive_720x720)·SNS 1200은 카피 없는 이미지 전용이라 빠져 있어요</p>
              </div>
            </div>
          )}
        </div>

        {/* 아래 고정 줄 */}
        <div className="flex-shrink-0 border-t border-black/5 px-5 py-3 bg-white flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-gray-600 flex-shrink-0">파일 이름</label>
            <div className="flex-1 min-w-[240px] flex items-center gap-1">
              <input className={input} value={fileName} onChange={e => setFileName(e.target.value)} spellCheck={false} />
              <span className="text-xs text-gray-400 flex-shrink-0">.pptx</span>
            </div>
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
              <button type="button" onClick={save} disabled={sending}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}기획서 저장 요청
              </button>
            </div>
          </div>
          {noVersion && (
            <p className="text-[11px] text-amber-700 flex items-center gap-1"><TriangleAlert size={12} />파일 이름에 버전(_v1.0 같은)이 없으면 '기획서 업데이트'의 바뀐 부분만 반영이 동작하지 않아요</p>
          )}
          {(draft?.outputFile || baseFile) && (again || kind === 'update') && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1"><Info size={12} />
              {kind === 'update'
                ? `${draft?.outputFile || baseFile}을 바탕으로 ${scope === 'both' ? '배너·상세를' : scope === 'banner' ? '배너만' : '상세만'} 고쳐 새 버전 파일로 저장해요`
                : `같은 파일 ${draft?.outputFile}에서 ${scope === 'both' ? '배너·상세를' : scope === 'banner' ? '배너만' : '상세만'} 고쳐 저장해요 (버전 그대로)`}</p>
          )}
          {error && <p className="text-[11px] text-red-500 flex items-center gap-1"><TriangleAlert size={12} />{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ── 도움 함수 ──
function jparse(s: string | undefined): Record<string, string> {
  try { const v = JSON.parse(s || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
// 폴더 이름의 연도 (YYYYMMDD_ 또는 YYMMDD_)
function folderYear(folderName: string): number | undefined {
  const a = liveDateFromFolder(folderName);
  if (a) return a.year;
  const m = folderName.match(/^(\d{2})\d{4}_/);
  return m ? 2000 + Number(m[1]) : undefined;
}
// KV 날짜 "11. 2 (월) 오후 8시(30분)" → 월·일·시(24시간)·분. 형식이 다르면 null (v17: 그때는 배너가 업무명 날짜 + 방송 시간)
function kvWhen(d: string): { m: number; d: number; h: number; min: number } | null {
  const a = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\([^)]*\)\s*(오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/.exec(d || '');
  if (!a || +a[1] < 1 || +a[2] < 1) return null;
  const h12 = +a[4] % 12;
  return { m: +a[1], d: +a[2], h: a[3] === '오후' ? h12 + 12 : h12, min: a[5] ? +a[5] : 0 };
}
// 24시간 시·분 → 배너 시간 선택값 (오후 7·8·9시 정시는 원본 선택지, 그 밖은 직접 입력 문구)
function labelHour(h: number, min: number): { hour: BannerHour; custom: string } {
  if (!min && (h === 19 || h === 20 || h === 21)) return { hour: String(h) as BannerHour, custom: '' };
  return { hour: 'custom', custom: `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${min ? ` ${min}분` : ''}` };
}
// 예전 요청의 배너 시간 문구("오후 7시") → 방송 시간 칸 값("19시")
function airFromLabel(label: string): string {
  const a = /(오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/.exec(label || '');
  if (!a) return '';
  const h = (+a[2] % 12) + (a[1] === '오후' ? 12 : 0);
  return h === 20 && !a[3] ? '' : `${h}시${a[3] ? ` ${+a[3]}분` : ''}`;
}

function KvCounter({ value, lim }: { value: string; lim: number }) {
  const n = value.trim().length;
  return (
    <p className={`text-[11px] mt-1 text-right ${n > lim ? 'text-red-500 font-semibold' : n ? 'text-green-600' : 'text-gray-400'}`}>
      {n} / {lim}자{n > lim ? ` · ${n - lim}자 초과` : ''}
    </p>
  );
}

// 방송 정보 (원본 ① 방송 정보 카드) — 방송일은 업무명에서, 방송 시간·재방송은 여기서. 배너 시간·방송 구분도 이 값을 따른다
function BroadcastPanel({ opts, setOpt, dateText, input }: {
  opts: PromoOpts; setOpt: <K extends keyof PromoOpts>(k: K, v: PromoOpts[K]) => void; dateText: string; input: string;
}) {
  const cur = promoAirHour(opts.air);
  const quick: [string, string][] = [['19시', '오후 7시'], ['', '오후 8시'], ['21시', '오후 9시']];
  return (
    <div className="rounded-xl border border-black/5 bg-gray-50/60 p-3 flex flex-col gap-2 break-keep">
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-semibold text-gray-500">방송 정보</div>
        <span className={`text-[11px] ${dateText ? 'text-gray-600' : 'text-red-500'}`}>방송일 {dateText || '업무명에서 날짜를 못 찾음 — 워싱본 KV 날짜에 직접 적어 주세요'}{dateText && <span className="text-gray-400"> (업무명에서 자동)</span>}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-gray-500 w-14">방송 시간</span>
        {quick.map(([v, l]) => {
          const on = (v === '' ? cur === 20 : promoAirHour(v) === cur) && !/분/.test(opts.air);
          return <button key={l} type="button" onClick={() => setOpt('air', v)}
            className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${on ? 'border-indigo-300 bg-indigo-50 text-indigo-600 font-semibold' : 'border-black/8 bg-white text-gray-500 hover:bg-gray-50'}`}>{l}</button>;
        })}
        <input className={`${input} !w-36 !py-1 !text-xs`} value={opts.air} onChange={e => setOpt('air', e.target.value)} placeholder="직접 (예: 19시 30분)" />
        <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none ml-auto">
          <input type="checkbox" className="accent-indigo-500" checked={opts.rebro} onChange={e => setOpt('rebro', e.target.checked)} />재방송
        </label>
      </div>
      {opts.rebro && (
        <div className="grid grid-cols-2 gap-1.5">
          <input className={`${input} !py-1.5 !text-xs`} value={opts.orig} onChange={e => setOpt('orig', e.target.value)} placeholder="본방송 일자 (예: 10/22)" />
          <input className={`${input} !py-1.5 !text-xs`} value={opts.viewers} onChange={e => setOpt('viewers', e.target.value)} placeholder="실시간 시청자 수 (예: 12.3만)" />
        </div>
      )}
    </div>
  );
}

// 추가 영역 (기획팀 통합셋팅기의 '추가 영역'과 같은 동작)
// 쿠킹·냉장고는 자동 판단이 기본이고, 직접 체크/해제하면 그 선택이 우선 — '자동 감지로'로 되돌린다
function PromoOptionsPanel({ opts, auto, setOpt, input }: {
  opts: PromoOpts; auto: { cook: boolean; fridge: boolean; hidMains: string[] };
  setOpt: <K extends keyof PromoOpts>(k: K, v: PromoOpts[K]) => void; input: string;
}) {
  const tri = (k: 'cook' | 'fridge', text: string, hint: string) => {
    const mode = opts[k], on = mode === 'auto' ? auto[k] : mode === 'on';
    return (
      <div className="flex items-center gap-2 min-h-[24px]">
        <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
          <input type="checkbox" className="accent-indigo-500" checked={on} onChange={e => setOpt(k, e.target.checked ? 'on' : 'off')} />
          {text}
        </label>
        <span className="text-[10px] text-gray-400 truncate" title={hint}>{mode === 'auto' ? '자동 감지' : '직접 선택 중'}</span>
        {mode !== 'auto' && <button type="button" onClick={() => setOpt(k, 'auto')} className="text-[10px] text-indigo-500 hover:underline">자동 감지로</button>}
      </div>
    );
  };
  return (
    <div className="rounded-xl border border-black/5 bg-gray-50/60 p-3 flex flex-col gap-1.5 break-keep">
      <div className="text-[11px] font-semibold text-gray-500">추가 영역 <span className="font-normal text-gray-400">· 기획팀 통합셋팅기 v17과 같은 규칙</span></div>
      {tri('cook', '주방가전(쿠킹 기획전) 유의사항', '업무명에 "쿠킹"·"주방가전"이 있고 한정 혜택에 주방가전 제품이 2종 이상일 때 자동으로 켜져요')}
      {tri('fridge', '냉장고 Fit&Max 배너', '업무명·원문에 냉장고가 있으면 OBS 맨 아래에 고정 배너를 자동으로 붙여요')}
      <div className="flex items-center gap-2 min-h-[24px]">
        <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
          <input type="checkbox" className="accent-indigo-500" checked={opts.hidTotal} onChange={e => setOpt('hidTotal', e.target.checked)} />
          통합 히든 기획전 추가
        </label>
        <span className="text-[10px] text-gray-400 truncate" title="제품명 기획전 배너 — 업무명에서 자동으로 만들어요">제품명 기획전: {auto.hidMains.join(' · ') || '—'}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input className={`${input} !py-1.5 !text-xs`} value={opts.hidUrl} onChange={e => setOpt('hidUrl', e.target.value)} placeholder="제품명 기획전 URL (선택, 첫 배너에만)" />
        <input className={`${input} !py-1.5 !text-xs ${opts.hidTotal ? '' : 'opacity-40'}`} disabled={!opts.hidTotal} value={opts.hidUrl2} onChange={e => setOpt('hidUrl2', e.target.value)} placeholder="통합 기획전 URL" />
      </div>
    </div>
  );
}

function SummaryChip({ kind, children }: { kind: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  const cls = kind === 'ok' ? 'text-green-700 bg-green-50 border-green-200'
    : kind === 'warn' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : kind === 'bad' ? 'text-red-600 bg-red-50 border-red-200' : 'text-gray-600 bg-gray-50 border-gray-200';
  const icon = kind === 'ok' ? <CircleCheck size={11} /> : kind === 'info' ? <Info size={11} /> : <TriangleAlert size={11} />;
  return <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border ${cls}`}>{icon}{children}</span>;
}

// 삭제한 카드 되돌리기 · 순서 원래대로 (원본 '추가 영역' 아래 목록 — 삭제·순서 바꾸기 자체는 워싱본에서)
function HiddenCardsPanel({ opts, onUnhide, onResetOrder }: {
  opts: PromoOpts; onUnhide: (list: 'live' | 'obs' | 'all', i?: number) => void; onResetOrder: () => void;
}) {
  const hidden = promoHideState(opts), order = promoOrderState(opts);
  const ordered = order.live.length > 0 || order.obs.length > 0;
  const nHidden = hidden.live.length + hidden.obs.length;
  if (!ordered && !nHidden) return null;
  return (
    <div className="rounded-xl border border-black/5 bg-gray-50/60 p-3 flex flex-col gap-1.5 break-keep">
      {ordered && (
        <div className="flex items-center text-[11px] text-gray-600">
          <span className="text-[10px] text-gray-400 w-7 flex-shrink-0">순서</span>
          {[order.live.length && '한정 혜택', order.obs.length && 'OBS 배너'].filter(Boolean).join(' · ')} 순서를 직접 바꾼 상태입니다
          <button type="button" onClick={onResetOrder} className="ml-auto flex items-center gap-0.5 text-indigo-500 hover:underline"><RotateCcw size={11} />원래 순서로</button>
        </div>
      )}
      {nHidden > 0 && (
        <>
          <div className="flex items-center text-[11px] font-semibold text-gray-500">삭제한 카드 {nHidden}건 <span className="font-normal text-gray-400 ml-1">· 원문에서 인식했지만 페이지에서 뺀 카드</span>
            <button type="button" onClick={() => onUnhide('all')} className="ml-auto text-[10px] font-normal text-indigo-500 hover:underline">모두 되돌리기</button></div>
          {(['live', 'obs'] as const).flatMap(k => hidden[k].map((t, i) => (
            <div key={k + i} className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span className="text-[10px] text-gray-400 w-7 flex-shrink-0">{k === 'live' ? '혜택' : 'OBS'}</span>
              <span className="truncate flex-1" title={t}>{t.replace(/^t:/, '').replace(/\n/g, ' / ')}</span>
              <button type="button" onClick={() => onUnhide(k, i)} className="flex items-center gap-0.5 text-indigo-500 hover:underline flex-shrink-0"><RotateCcw size={11} />되돌리기</button>
            </div>
          )))}
        </>
      )}
    </div>
  );
}

// 결제혜택 · 유의사항 반영 기준 (기획팀 통합셋팅기 v08·v09 3택)
function PayModePanel({ opts, setOpt, state, prevLoad, input }: {
  opts: PromoOpts; setOpt: <K extends keyof PromoOpts>(k: K, v: PromoOpts[K]) => void;
  state: { mode: '' | 'prev' | 'date'; text: string; kind: 'ok' | 'warn' | 'off'; note: string; prevName: string };
  prevLoad: 'idle' | 'loading' | 'ready' | 'error'; input: string;
}) {
  const mode = state.mode;
  const seg = (m: '' | 'prev' | 'date', label: string) => (
    <button type="button" onClick={() => setOpt('payMode', m)} aria-pressed={mode === m}
      className={`flex-1 px-2 py-1.5 text-[11px] rounded-lg border transition-colors ${mode === m ? 'bg-indigo-500 border-indigo-500 text-white font-semibold' : 'bg-white border-black/10 text-gray-600 hover:bg-gray-50'}`}>{label}</button>
  );
  const stCls = state.kind === 'ok' ? 'text-green-700' : state.kind === 'warn' ? 'text-amber-700' : 'text-gray-500';
  return (
    <div className="rounded-xl border border-black/5 bg-gray-50/60 p-3 flex flex-col gap-1.5 break-keep">
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-semibold text-gray-500">결제혜택 · 유의사항 반영 기준</div>
        <span className={`ml-auto text-[10px] truncate ${stCls}`} title={state.text}>{state.text}</span>
      </div>
      <div className="flex gap-1.5">
        {seg('', '판촉안 · 방송일')}
        {seg('date', '판촉안 · 반영 일자')}
        {seg('prev', '직전 라이브와 동일')}
      </div>
      {mode === 'date' && (
        <input className={`${input} !py-1.5 !text-xs`} value={opts.payDate} onChange={e => setOpt('payDate', e.target.value)} placeholder="반영 일자 (예: 10/15) — 그날 진행 중인 혜택만 반영" />
      )}
      <p className="text-[10px] text-gray-400">
        {state.note}
        {mode === 'prev' && (prevLoad === 'loading' ? ' · 지난 방송 불러오는 중…' : prevLoad === 'error' ? ' · 지난 방송을 불러오지 못했어요' : prevLoad === 'ready' && !state.prevName ? ' · 저장된 직전 라이브가 없어 판촉안 기준으로 반영해요' : '')}
      </p>
    </div>
  );
}

// ⋮⋮ 끌기 핸들 (원본 addDragHandles) — 미리보기를 그릴 때마다 한정 혜택·OBS 카드에 붙인다
function addDragHandles(root: HTMLElement) {
  ([['#secLive .mockBenefitList > .mockAddWrap', 'live'], ['#secObs .mockLinkList > .mockLinkWrap', 'obs']] as const).forEach(([sel, kind]) => {
    root.querySelectorAll(sel).forEach(w => {
      if (w.querySelector(':scope > .dragH')) return;
      const h = document.createElement('span');
      h.className = 'dragH reviewOnly';
      h.setAttribute('draggable', 'true');
      h.setAttribute('data-kind', kind);
      h.title = '드래그해서 순서 변경';
      h.textContent = '⋮⋮';
      w.insertBefore(h, w.firstChild);
      w.classList.add('dndItem');
    });
  });
}
