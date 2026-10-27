import { useState, useMemo, useDeferredValue, useRef, type ReactNode } from 'react';
import { X, Loader2, Wand2, Send, TriangleAlert, CircleCheck, Info, ChevronDown } from 'lucide-react';
import type { Task } from '../types';
import {
  LIM, gen, autoFill, ben, bannerGroups, copiesFromGroups, editsFromCopies, countOver, normLine, alertTxt,
  parseBDate, getTimeLabel, getEvLabel, hourFromLabel, DT_HINT, HOUR_OPTIONS, pairRowId,
  type BannerHour, type BroadcastType, type BannerGroup, type BannerRow, type GenInput,
} from '../lib/planTools/bannerCopy';
import { parsePromo, promoKvOpt, promoJoinProducts, promoPreviewText, promoPreviewHtml, promoSummary, promoPayment, promoLiveCards, promoAuto, defaultPromoOpts, PROMO_PREVIEW_CSS, type PromoStructured, type PromoOpts } from '../lib/planTools/promoParse';
import {
  scopeHasBanner, scopeHasLanding, defaultPlanFileName, bumpVersion, versionFromFileName, cleanFileName, INVALID_FILE_CHARS, liveDateFromFolder,
  type PlanDraft, type PlanDraftKind, type PlanScope, type PlanDraftBanner, type PlanDraftLanding,
} from '../lib/planDraft';
import { PlanDraftBusyError, type PlanRequest } from '../hooks/usePlanDraft';
import { isQuotaError, quotaMessage } from '../lib/dbQuota';

type Tab = 'banner' | 'landing';

// 기획서 편집 화면 — 배너 탭(배너카피생성기 v14 로직) / 상세 탭(판촉 업데이트기 v21 로직), 기획서 차례가 배너 먼저 (2026-10-22 기획 확인), 아래 고정 줄에 파일 이름과 저장 요청.
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
  const [tab, setTab] = useState<Tab>(showBanner ? 'banner' : 'landing');
  const folderDate = liveDateFromFolder(folderName);
  const prevBanner = seed?.banner;

  // ── 배너 입력 ──
  const [kvMain, setKvMain] = useState(prevBanner?.kvMain ?? '');
  const [kvSub, setKvSub] = useState(prevBanner?.kvSub ?? '');
  const [dateText, setDateText] = useState(() => {
    const p = prevBanner?.liveDate ? parseBDate(prevBanner.liveDate) : null;
    return p ? `${p.m}/${p.d}` : folderDate?.text ?? '';
  });
  const [dateTouched, setDateTouched] = useState(false);
  const initHour = hourFromLabel(prevBanner?.liveTime ?? '');
  const [hour, setHour] = useState<BannerHour>(initHour.hour);
  const [customTime, setCustomTime] = useState(initHour.custom);
  const [broadcastType, setBroadcastType] = useState<BroadcastType>(prevBanner?.broadcastType === '재방송' ? '재방송' : '라이브');
  const [product, setProduct] = useState(prevBanner?.product ?? '');
  const [shortName, setShortName] = useState(prevBanner?.shortName ?? '');
  const [discount, setDiscount] = useState(prevBanner?.discount ?? '');
  // 직접 고친 값은 KV 카피를 바꿔도 유지 (비우면 다시 자동) — 원본 prodTouched와 같은 동작
  const [touched, setTouched] = useState({ product: !!prevBanner?.product, shortName: !!prevBanner?.shortName, discount: !!prevBanner?.discount });
  const [prodFromKv, setProdFromKv] = useState(false); // 제품군을 못 찾아 KV 카피 메인으로 채웠는지

  const baseYear = folderDate?.year;
  const parsedDate = useMemo(() => parseBDate(dateText, baseYear), [dateText, baseYear]);
  // 통합셋팅기 v13: KV에 쓴 제품 나열도 배너·페이지에는 가운데점으로 ("냉장고세탁기"·"냉장고&세탁기" → "냉장고·세탁기")
  const kvMainJ = promoJoinProducts(kvMain), kvSubJ = promoJoinProducts(kvSub);
  const genInput: GenInput = {
    kvMain: kvMainJ, kvSub: kvSubJ, liveDate: parsedDate?.iso ?? '', timeLabel: getTimeLabel(hour, customTime), evLabel: getEvLabel(hour, customTime),
    broadcastType, benefit: discount, product, shortName,
  };
  const inputKey = JSON.stringify(genInput);

  // ── 생성 결과 (버튼을 눌러야 만든다 — 원본 툴의 결정: 실시간 갱신 없음) ──
  const [generated, setGenerated] = useState<{ groups: BannerGroup[]; key: string } | null>(() => {
    if (!prevBanner) return null;
    return { groups: bannerGroups(gen(genInput)), key: inputKey };
  });
  const [edits, setEdits] = useState<Record<string, string[]>>(() => (generated ? editsFromCopies(generated.groups, prevBanner?.copies) : {}));
  // 줄 하나 고치기 — PC·MO가 함께 들어가는 배너는 짝 행도 같은 문구로 (원본 v18 pairTxt)
  const rowById = useMemo(() => Object.fromEntries((generated?.groups ?? []).flatMap(gr => gr.rows.map(r => [r.id, r] as [string, BannerRow]))), [generated]);
  const editLine = (r: BannerRow, li: number, v: string) => setEdits(prev => {
    const next = { ...prev };
    const pair = rowById[pairRowId(r.id) ?? ''];
    for (const row of pair ? [r, pair] : [r]) { const cur = [...(prev[row.id] ?? row.lines)]; cur[li] = v; next[row.id] = cur; }
    return next;
  });
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);

  const applyKv = (main: string, sub: string) => {
    const af = autoFill(main, sub);
    const found = !!af.prod;
    if (!touched.product) setProduct(found ? af.prod! : main.trim());
    if (!touched.shortName) setShortName(found ? af.prodS! : main.trim());
    setProdFromKv(!found && !!main.trim());
    if (!touched.discount) setDiscount(ben({ r1: af.r1 ?? '', r2: af.r2 ?? '', r3: af.r3 ?? '', useMax: af.useMax }));
  };
  const editField = (key: keyof typeof touched, set: (v: string) => void) => (v: string) => {
    set(v);
    setTouched(t => ({ ...t, [key]: v.trim() !== '' }));
  };

  const generate = () => {
    setGenerated({ groups: bannerGroups(gen(genInput)), key: inputKey });
    setEdits({});
  };
  const over = generated ? countOver(generated.groups, edits) : null;
  const bannerStale = !!generated && generated.key !== inputKey;

  // ── 상세 입력 ──
  const [raw, setRaw] = useState(seed?.landing?.raw ?? '');
  const deferredRaw = useDeferredValue(raw);
  // 판촉 로직(기획팀 도구 v38)은 방송명 전체에서 날짜·제품·쿠킹/냉장고/재방송 단어를 읽는다.
  // 이 팀은 재방송을 업무명에 '(재)'로 쓰고 원본은 '재방송'만 알아봐서, 넘길 때만 바꿔 준다 (2026-10-26)
  const promoCase = (task.title ?? '').normalize('NFC').trim().replace(/\(\s*재\s*\)/g, ' 재방송').replace(/\s+/g, ' ');
  // 추가 영역·재방송 옵션 — 다시 열면 지난번 선택을 그대로 (없으면 원본 기본값)
  const [opts, setOpts] = useState<PromoOpts>(() => ({ ...defaultPromoOpts(promoCase), ...(seed?.landing?.structured?.opts ?? {}) }));
  const setOpt = <K extends keyof PromoOpts>(k: K, v: PromoOpts[K]) => setOpts(o => ({ ...o, [k]: v }));
  // 한정 혜택 윗줄 기본값('○○ 라이브')은 원본처럼 KV 메인 카피 → 업무명 순으로 정한다 (통합셋팅기 v13, opts.kv)
  const optsKv = useMemo<PromoOpts>(() => ({ ...opts, kv: promoKvOpt(kvMainJ, kvSubJ) }), [opts, kvMainJ, kvSubJ]);
  const pv = useMemo<PromoStructured>(() => parsePromo(deferredRaw, promoCase, optsKv), [deferredRaw, promoCase, optsKv]);
  const promoAutoVal = useMemo(() => promoAuto(pv), [pv]);
  const summary = useMemo(() => promoSummary(pv), [pv]);
  const previewHtml = useMemo(() => (deferredRaw.trim() ? promoPreviewHtml(pv) : ''), [pv, deferredRaw]);

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

  const save = async () => {
    setError('');
    if (!cleanName) { setError('파일 이름을 입력해 주세요'); return; }
    if (INVALID_FILE_CHARS.test(cleanName)) { setError('파일 이름에 쓸 수 없는 글자(\\ / : * ? " < > |)가 있어요'); return; }
    let banner: PlanDraftBanner | undefined;
    let landing: PlanDraftLanding | undefined;
    if (showBanner) {
      if (!kvMain.trim()) { setTab('banner'); setError('배너: KV 카피 메인을 입력해 주세요'); return; }
      if (!parsedDate) { setTab('banner'); setError('배너: 방송일을 확인해 주세요 (예: 10/27)'); return; }
      if (!generated) { setTab('banner'); setError("배너: '배너 카피 생성'을 먼저 눌러 주세요"); return; }
      if (bannerStale) { setTab('banner'); setError("배너: 입력이 바뀌었어요. '배너 카피 생성'을 다시 눌러 결과를 맞춰 주세요"); return; }
      banner = {
        kvMain: kvMainJ.trim(), kvSub: kvSubJ.trim(), liveDate: parsedDate.iso, liveTime: genInput.timeLabel,
        product: product.trim(), shortName: shortName.trim(), discount: discount.trim(), broadcastType,
        copies: copiesFromGroups(generated.groups, edits),
      };
    }
    if (showLanding) {
      if (!raw.trim()) { setTab('landing'); setError('상세: 판촉 원문을 붙여넣어 주세요'); return; }
      const cur = parsePromo(raw, promoCase, optsKv);
      landing = {
        raw,
        structured: {
          notify: cur.notify,
          liveItems: cur.liveItems,
          liveCards: promoLiveCards(cur),   // 11번 한정 혜택 — 미리보기와 같은 2줄 정리
          // 12번 기획전 배너 — 실제 노출 목록(히든 기획전·냉장고 Fit&Max 포함)
          obsCards: (cur.obsShow ?? cur.obsCards).map(([code, mainTitle, subTitle, url]) => ({ code: code || '', mainTitle: mainTitle || '', subTitle: subTitle || '', url: url || '' })),
          paymentFullText: cur.paymentFullText,
          payment: promoPayment(cur),   // 13번 결제 혜택 장 — 미리보기와 같은 결제혜택 엔진 결과
          legalNotes: cur.legalNotes,
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

        {/* 탭 */}
        {showBanner && showLanding && (
          <div className="flex gap-1 px-5 pt-3 flex-shrink-0">
            {(['banner', 'landing'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                {t === 'banner' ? '배너' : '상세'}
              </button>
            ))}
          </div>
        )}

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {tab === 'banner' && showBanner && (
            <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start">
              {/* 입력 */}
              <div className="flex flex-col gap-4 md:sticky md:top-0">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 flex flex-col gap-3">
                  <div className="text-xs font-semibold text-indigo-600">1단계 · KV 카피</div>
                  <div>
                    <label className={label}>KV 카피 메인</label>
                    <input className={input} value={kvMain} placeholder="예: 10월 결산 특집"
                      onChange={e => { setKvMain(e.target.value); applyKv(e.target.value, kvSub); }} />
                    <KvCounter value={kvMain} lim={LIM.keyMain} />
                  </div>
                  <div>
                    <label className={label}>KV 카피 서브</label>
                    <input className={input} value={kvSub} placeholder="예: 남다른 혜택으로 산다, 라이브 최대 13% 할인"
                      onChange={e => { setKvSub(e.target.value); applyKv(kvMain, e.target.value); }} />
                    <KvCounter value={kvSub} lim={LIM.keySub} />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="text-xs font-semibold text-gray-600">2단계 · 방송 일시</div>
                  <div>
                    <label className={label}>방송일</label>
                    <input className={input} value={dateText} placeholder="예: 10/27" onChange={e => setDateText(e.target.value)} onBlur={() => setDateTouched(true)} />
                    <p className={`text-[11px] mt-1 ${parsedDate ? 'text-green-600' : dateTouched && dateText.trim() ? 'text-red-500' : 'text-gray-400'}`}>
                      {parsedDate ? `${parsedDate.y}년 ${parsedDate.m}.${parsedDate.d}(${parsedDate.wd}) 인식됨`
                        : dateTouched && dateText.trim() ? '날짜를 확인해 주세요 (예: 10/27, 10월 27일)' : DT_HINT}
                    </p>
                  </div>
                  <div>
                    <label className={label}>방송 시간</label>
                    <div className="flex gap-1.5">
                      {HOUR_OPTIONS.map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setHour(v)}
                          className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${hour === v ? 'border-indigo-300 bg-indigo-50 text-indigo-600 font-semibold' : 'border-black/8 text-gray-500 hover:bg-gray-50'}`}>{l}</button>
                      ))}
                    </div>
                    {hour === 'custom' && (
                      <input className={`${input} mt-1.5`} value={customTime} placeholder="예: 오후 7시 30분" onChange={e => setCustomTime(e.target.value)} />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="text-xs font-semibold text-gray-600">3단계 · 제품군 · 할인율 확인</div>
                  {prodFromKv && !touched.product && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">KV 카피에서 제품군을 찾지 못해 KV 카피 메인으로 채웠어요. 맞는지 확인해 주세요</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={label}>제품군</label>
                      <input className={input} value={product} placeholder="예: LG 디오스 냉장고" onChange={e => editField('product', setProduct)(e.target.value)} />
                    </div>
                    <div>
                      <label className={label}>축약명</label>
                      <input className={input} value={shortName} placeholder="예: 냉장고" onChange={e => editField('shortName', setShortName)(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div>
                      <label className={label}>할인율 (혜택 문구)</label>
                      <input className={input} value={discount} placeholder="예: 최대 13% 할인" onChange={e => editField('discount', setDiscount)(e.target.value)} />
                    </div>
                    <div>
                      <label className={label}>방송구분</label>
                      <div className="flex gap-1">
                        {(['라이브', '재방송'] as BroadcastType[]).map(b => (
                          <button key={b} type="button" onClick={() => setBroadcastType(b)}
                            className={`px-2.5 py-2 text-xs rounded-lg border transition-colors ${broadcastType === b ? 'border-indigo-300 bg-indigo-50 text-indigo-600 font-semibold' : 'border-black/8 text-gray-500 hover:bg-gray-50'}`}>{b}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button type="button" onClick={generate}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors flex items-center justify-center gap-1.5">
                  <Wand2 size={15} />배너 카피 생성
                </button>
                {bannerStale && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 -mt-2">입력이 바뀌었어요 — '배너 카피 생성'을 다시 누르면 반영돼요 (고친 카피는 초기화돼요)</p>
                )}
              </div>

              {/* 결과 */}
              <div className="min-w-0">
                {!generated ? (
                  <div className="h-full min-h-[240px] rounded-xl border border-dashed border-black/10 flex flex-col items-center justify-center gap-2 text-center p-6">
                    <Wand2 size={22} className="text-gray-300" />
                    <p className="text-sm text-gray-500">KV 카피와 방송 일시를 넣고 '배너 카피 생성'을 눌러 주세요</p>
                    <p className="text-xs text-gray-400">결과는 바로 고칠 수 있어요 · 글자수 기준(공백 포함)을 넘으면 알려 드려요</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 border border-black/5 px-3 py-2">
                      {over!.bad
                        ? <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5">⚠ 글자수 초과 {over!.bad}건</span>
                        : <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-0.5">✔ 전체 통과</span>}
                      {generated.groups.map((gr, i) => over!.byGroup[i] ? (
                        <button key={gr.title} type="button" onClick={() => groupRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                          className="text-[11px] text-red-500 underline underline-offset-2 hover:text-red-600">{gr.title} · {over!.byGroup[i]}건</button>
                      ) : null)}
                      <span className="text-[11px] text-gray-400 ml-auto">{generated.groups.length}개 그룹 중 {over!.byGroup.filter(n => !n).length}개 통과 · 카피를 눌러 바로 수정</span>
                    </div>
                    {generated.groups.map((gr, gi) => (
                      <div key={gr.title} ref={el => { groupRefs.current[gi] = el; }} className="rounded-xl border border-black/8 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-800">{gr.title}</span>
                          <span className="text-[10px] text-gray-400">{gr.en}</span>
                          <span className={`ml-auto text-[10px] font-semibold rounded-md px-1.5 py-0.5 ${over!.byGroup[gi] ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>
                            {over!.byGroup[gi] ? `초과 ${over!.byGroup[gi]}건` : '통과'}
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
                                  {edited && <div className="text-[10px] text-indigo-500 mt-0.5">수정됨</div>}
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-400">캘린더 썸네일(Lgelive_720x720)·SNS 1200은 카피 없는 이미지 전용이라 빠져 있어요</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'landing' && showLanding && (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
              <div className="flex flex-col gap-3 min-w-0">
                <PromoOptionsPanel opts={opts} auto={promoAutoVal} setOpt={setOpt} input={input} />
                <div>
                  <label className={label}>판촉 원문 (수급받은 원문 전체를 그대로 붙여넣기)</label>
                  <textarea className={`${input} min-h-[360px] font-mono text-xs leading-relaxed resize-y`} value={raw} onChange={e => setRaw(e.target.value)}
                    placeholder={'알림 신청 판촉\n투썸플레이스 아메리카노 (30명)\n\n라이브 한정 판촉\n1) …\n\nOBS 기획전/기본 판촉\nhttps://www.lge.co.kr/benefits/exhibitions/detail-PE…\n\nLGE닷컴 전사 판촉\n…'} />
                </div>
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
              </div>
              <div className="md:sticky md:top-0">
                <div className="text-[11px] font-semibold text-gray-500 mb-1">워싱본 미리보기 · 실제 상세페이지 순서 (알림 신청 → 한정 혜택 → OBS 랜딩링크 → 결제 혜택 → 유의사항)</div>
                <div className="rounded-xl bg-gray-50 border border-black/5 max-h-[calc(90vh-230px)] overflow-y-auto p-2">
                  {previewHtml ? (
                    <>
                      <style>{PROMO_PREVIEW_CSS}</style>
                      <div className="promo-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </>
                  ) : (
                    <div className="py-16 text-center text-xs text-gray-400">판촉 원문을 붙여넣으면 미리보기가 나와요</div>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">금액·기간·조건·카드사 문구는 원문과 대조해 주세요 · 아이콘은 대체 그림이에요</p>
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

function KvCounter({ value, lim }: { value: string; lim: number }) {
  const n = value.trim().length;
  return (
    <p className={`text-[11px] mt-1 text-right ${n > lim ? 'text-red-500 font-semibold' : n ? 'text-green-600' : 'text-gray-400'}`}>
      {n} / {lim}자{n > lim ? ` · ${n - lim}자 초과` : ''}
    </p>
  );
}

// 추가 영역 (기획팀 판촉 업데이트기 v38의 '워싱본 맨 위 추가 영역'과 같은 동작)
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
      <div className="text-[11px] font-semibold text-gray-500">추가 영역 <span className="font-normal text-gray-400">· 기획팀 판촉 업데이트기 v38과 같은 규칙</span></div>
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
      <div className="flex items-center gap-2 min-h-[24px]">
        <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
          <input type="checkbox" className="accent-indigo-500" checked={opts.rebro} onChange={e => setOpt('rebro', e.target.checked)} />
          재방송 영역
        </label>
        <span className="text-[10px] text-gray-400">업무명에 '(재)'·'재방송'이 있으면 자동으로 켜져요</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input className={`${input} !py-1.5 !text-xs ${opts.rebro ? '' : 'opacity-40'}`} disabled={!opts.rebro} value={opts.orig} onChange={e => setOpt('orig', e.target.value)} placeholder="본방송 일자 (예: 10/22)" />
        <input className={`${input} !py-1.5 !text-xs ${opts.rebro ? '' : 'opacity-40'}`} disabled={!opts.rebro} value={opts.viewers} onChange={e => setOpt('viewers', e.target.value)} placeholder="실시간 시청자 수 (예: 12.3만)" />
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
