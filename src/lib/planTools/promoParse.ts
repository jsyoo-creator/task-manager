// @ts-nocheck
/* =============================================================================
 * 라이브 판촉 원문 → 워싱본(상세페이지 미리보기) 로직
 * 원본: Live_통합셋팅기_v13.html (Planning Update 폴더, 문서: Live_통합셋팅기_v13_MD.md)
 *       — 2026-10-21 판촉 업데이트기 v21 이식, 2026-10-26 v38, 2026-10-28 통합셋팅기 v13(= 판촉 v40 + 배너 v18)으로 다시 이식
 * 원본 툴과 다시 맞출 수 있도록 원본 스크립트를 통째로 두었다 (함수 이름·본문·var 스타일 유지, 화면용 함수도 남아 있지만 부르지 않는다).
 * 바꾼 것:
 *  - 맨 위 '원본 화면 대신 쓰는 층' — 원본은 화면의 방송명 칸(case_name)과 localStorage를 읽는다. 여기서는
 *    __PV_CTX.caseName(업무명)을 넣어 주고, 저장소는 비어 있는 것으로 둔다(직전 라이브 이어받기·'직전 라이브와 동일'은 쓰지 않음 →
 *    결제혜택은 판촉 원문 + 월별 결제혜택 시트(opts.paySheet)로 만든다). 원본의 이벤트 등록은 가짜 document라 아무 일도 안 한다.
 *  - 원본 init()·setStepUi()·onCaseShown() 실행은 뺐다.
 *  - renderParseSummary + payChipsHtml → summarizeParse (화면 대신 칩 배열을 돌려줌)
 *  - 한정 혜택 윗줄 기본값(LIVE_DEF_LABEL)은 원본처럼 opts.kv 메인 카피 → 업무명 순으로 매번 다시 정한다(__withPv).
 * 파일 맨 아래의 export만 화면에서 쓴다.
 * ========================================================================== */

/* ---- 원본 화면 대신 쓰는 층 ---- */
var __PV_CTX = { caseName: "", cases: [], usePrev: false };
/* 저장소: 방송 목록(promo_mgr_cases_v5)만 '직전 라이브와 동일' 모드일 때 지난 방송(업무관리 1차 기획서 저장분)을 돌려준다.
 * 다른 모드에서는 비어 있게 둬서 원본의 '결제혜택 원문이 없으면 직전 라이브 이어받기'가 저절로 켜지지 않게 한다 (월별 결과가 매번 같도록). */
var localStorage = {
  getItem: function(k){ return k === "promo_mgr_cases_v5" && __PV_CTX.usePrev ? JSON.stringify(__PV_CTX.cases) : null; },
  setItem: function(){}, removeItem: function(){}
};
var document = {
  getElementById: function(id){ return id === "case_name" ? { value: __PV_CTX.caseName } : null; },
  createElement: function(){ return { innerHTML: "", children: [], classList: { add: function(){}, remove: function(){}, contains: function(){ return false; } }, style: {} }; },
  querySelector: function(){ return null; }, querySelectorAll: function(){ return []; },
  addEventListener: function(){}, body: { classList: { add: function(){}, remove: function(){}, contains: function(){ return false; } } }
};
/* 업무명·방송 옵션을 원본이 읽는 자리에 넣고 fn 실행 (원본 collectFormValues가 하던 LIVE_DEF_LABEL·직접 수정 문구 준비 포함) */
function __withPv(pv, fn){
  var prev = __PV_CTX.caseName, prevLabel = LIVE_DEF_LABEL, prevTxt = _TXT, prevUse = __PV_CTX.usePrev;
  __PV_CTX.caseName = (pv && pv.caseName) || "";
  __PV_CTX.usePrev = !!(pv && pv.opts && pv.opts.payMode === "prev");
  try {
    LIVE_DEF_LABEL = liveDefaultLabel(__PV_CTX.caseName, (jparse(pv && pv.opts && pv.opts.kv, {}) || {}).m);
    setTxtState(pv);
    return fn();
  } finally { __PV_CTX.caseName = prev; LIVE_DEF_LABEL = prevLabel; _TXT = prevTxt; __PV_CTX.usePrev = prevUse; }
}
/* ---- 여기부터 원본 통합셋팅기 v13 스크립트 ---- */


var STORE_KEY = {
 cases: "promo_mgr_cases_v5",
 obsBank: "promo_mgr_obs_bank_v5",
 obsBase: "promo_mgr_obs_base_v5"
};

var DEFAULT_OBS_BASE = "https://www.lge.co.kr/benefits/exhibitions/detail-";

function loadData(key) {
 try {
  var raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
 } catch (e) {
  return [];
 }
}

function saveData(key, arr) {
 localStorage.setItem(key, JSON.stringify(arr));
}

function uid() {
 return "id" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function val(id) {
 return document.getElementById(id).value.trim();
}

function escapeHtml(s) {
 if (s === undefined || s === null) return "";
 return String(s).replace(/[&<>"']/g, function(c) {
  return {
   "&": "&amp;",
   "<": "&lt;",
   ">": "&gt;",
   '"': "&quot;",
   "'": "&#39;"
  }[c];
 });
}

function fmtDT(iso) {
 try {
  return new Date(iso).toLocaleString("ko-KR");
 } catch (e) {
  return iso || "-";
 }
}

function copyText(text) {
 if (navigator.clipboard && navigator.clipboard.writeText) {
  navigator.clipboard.writeText(text).catch(function() {
   fallbackCopy(text);
  });
 } else {
  fallbackCopy(text);
 }
}

function fallbackCopy(text) {
 var ta = document.createElement("textarea");
 ta.value = text;
 ta.style.position = "fixed";
 ta.style.opacity = "0";
 document.body.appendChild(ta);
 ta.focus();
 ta.select();
 try {
  document.execCommand("copy");
 } catch (e) {}
 document.body.removeChild(ta);
}

function extractEventCode(url) {
 if (!url) return "";
 var m = url.match(/PE\d+/i);
 return m ? m[0].toUpperCase() : "";
}

var GIFT_TRADEMARKS = {
 "투썸플레이스 아메리카노": "투썸플레이스 아메리카노(R)"
};

var STANDARD_LEGAL_BOILERPLATE = [ "본 행사 내용은 당사 사정에 따라 예고 없이 변경 또는 중단될 수 있습니다.", "결제일 할인, 무이자 할부 등의 카드 혜택은 LGE.COM 월별 회원 혜택에서 자세한 확인이 가능합니다.", "경품 지급은 구매자의 회원 정보에 따라 진행하며, 잘못된 정보 기입 시 당첨 및 경품 지급이 불가합니다.", "경품 및 사은품의 경우 구매 취소 시 지급되지 않으며, 이미 지급된 사은품에 대해서는 환수될 수 있습니다.", "경품에 대한 제세공과금은 LG전자가 부담하며, 이를 위한 개인 정보 수집 절차가 필요합니다. 해당 과정에서 이벤트 위탁사인 (주)에이치에스애드 및 (주)뉴메리크스튜디오를 통한 연락이 갈 수 있으며 연락처 오기입, 2주 이상의 장기간 부재 등의 이유로 연락이 닿지 않는 경우 경품 당첨이 취소될 수 있습니다." ];

var PAYMENT_NOTICE_SECTIONS = [ {
 heading: "LGE.COM 신한카드 플러스 서비스 유의사항",
 trigger: function(ctx) {
  return ctx.some(function(t) {
   return /신한카드/.test(t) && /플러스/.test(t);
  });
 },
 bullets: [ "계약 체결 전, 카드 상품별 연회비, 이용조건 등 상세사항은 금융상품설명서와 약관을 확인하시기 바랍니다.", "금융소비자는 금융소비자보호법 제19조 제1항에 따라 해당 금융상품 또는 서비스에 대하여 설명 받을 권리가 있습니다.", "연체이자율은 '회원별, 이용상품별 약정금리+최대 연 3%, 법정 최고금리(연 20%)이내'에서 적용됩니다. 단, 연체 발생 시점에 약정금리가 없는 경우 아래와 같이 적용됩니다.\n- 일시불 거래 연체 시: 거래 발생 시점의 최소기간(2개월) 유이자 할부 금리\n- 무이자 할부 거래 연체 시: 거래 발생 시점의 동일한 할부 계약기간의 유이자 할부 금리", "신용카드 발급이 부적정한 경우(개인신용평점 낮음,연체(단기 포함) 사유발생 등), 카드발급이 제한될 수 있습니다.", "카드 이용대금과 이에 수반되는 모든 수수료는 고객님께서 지정하신 결제일에 상환하여야 합니다.", "상환능력에 비해 신용카드 사용액이 과도할 경우, 귀하의 개인신용평점이 하락할 수 있습니다.", "개인신용평점 하락 시 금융거래와 관련된 불이익이 발생할 수 있습니다.", "일정기간 신용카드 이용대금을 연체할 경우, 결제일이 도래하지 않은 모든 신용카드 이용대금을 변제할 의무가 발생할 수 있습니다.", "※ 여신금융협회 심의필 제2026-C1h-02851호(2026.03.04~2027.03.03)", "신한카드 고객센터 (1544-7000)" ]
}, {
 heading: "{{PAYDAY}}% 카드 결제일 할인",
 trigger: function(ctx) {
  return ctx.some(function(t) {
   return /결제일\s*할인/.test(t);
  });
 },
 bullets: [ "50만원 이상 해당 카드사({{CARDS}} 신용카드)를 통한 결제 시 적용되며 결제 시점에 할인되는 것이 아닌, 카드 대금 지불 시점에 청구 할인으로 적용됩니다. (네이버/카카오 페이 등의 간편 결제 시, 적용 불가)", "결제일 할인은 횟수 상관없이 카드당 매월 누적 100만원 한도로 할인 적용되며, 동일 명의의 카드와 가족 카드는 하나의 카드로 간주되어 할인금액이 합산됩니다. (매월 1일 ~ 말일 누적 금액 기준) 가족카드의 경우, 카드에 기재된 이름이 다르더라도 회원 본인과 동일한 명의로 간주됩니다.", "결제일 할인 혜택은 기존 {{CARDS}} 신용카드 실적과는 무관하게 적용됩니다.", "체크/법인/선불/충전/기프트 카드는 결제일 할인 혜택이 적용되지 않습니다." ]
}, {
 heading: "무이자 할부 혜택",
 trigger: function(ctx) {
  return ctx.some(function(t) {
   return /무이자/.test(t);
  });
 },
 bullets: [ "12개월 무이자 혜택은 100만원 이상 결제 시 적용되며, 그 외 개월 수는 5만원 이상 결제 시 무이자 혜택 적용됩니다. (네이버/카카오 페이 등의 간편 결제 시, 적용 불가)", "신한카드 5만원 이상 결제 시 2~3개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다. (비인증(정기결제 등) 제외)", "KB 국민카드 5만원 이상 결제 시 2~3개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다. (LG전자 전용)", "삼성카드 5만원 이상 결제 시 2~3개월 무이자 혜택 적용됩니다.", "NH농협카드 5만원 이상 결제 시 2~6개월 무이자 혜택 적용됩니다.", "현대카드 5만원 이상 결제 시 2~3개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다.", "BC카드 5만원 이상 결제 시 2~5개월 무이자 혜택 적용됩니다. (2분기 정책 대상 : BC로고 카드* 우리, IBK, NH, SC, iM뱅크(구.대구), 부산, 경남, 신한, 하나, KB, 씨티BC(씨티 비자 제외), sh수협, 광주의 개인 신용)", "하나카드 5만원 이상 결제 시 2~5개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다. (티켓, 렌터카, 홈쇼핑, 손해보험, 아울렛, 학원(세계로) 업종 제외)", "롯데카드 5만원 이상 결제 시 2~3개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다.", "우리카드 5만원 이상 결제 시 2~5개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다.", "무이자 할부와 결제일 할인 혜택({{CARDS}} 신용카드 실적과 무관)은 중복으로 적용 가능합니다.", "체크/법인/선불/충전/기프트/하이브리드 카드는 무이자 할부 혜택이 적용되지 않습니다.", "법인(기업)/체크/선불/기프트/은행계열 카드는 혜택에서 제외됩니다. (BC마크가 없는 NON BC 카드 불가)", "본 행사는 카드사 사정에 따라 변경 또는 중단될 수 있습니다.", "무이자 할부 결제 시 포인트, 마일리지 적립이 제외될 수 있습니다.", "환금성, 상품권은 제외됩니다.", "일반 신용카드 거래에 한하며 스마일페이는 지마켓이 제공하는 별도 행사 정책에 따릅니다." ]
}, {
 heading: "LGE.COM 신한카드 플러스 서비스 {{CB}}% 캐시백 유의사항",
 trigger: function(ctx) {
  return ctx.some(function(t) {
   return /신한카드/.test(t) && /플러스/.test(t);
  });
 },
 bullets: [ "신한카드 플러스 서비스 약정 고객대상으로 {{CB}}% 캐시백이 적용됩니다. (최대 100만원)", "신한카드 플러스 서비스 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다.", "신한카드 플러스 서비스 약정 결제 시 LG멤버십 포인트 5만P 제공됩니다.", "신한카드 플러스 서비스 {{CB}}% 캐시백은 LGE.COM 신한카드로 자동에서 계좌로 지급됩니다. (50만원 이상 결제 시 캐시백 최대 100만원 한도)", "신한카드 플러스 서비스 {{CB}}% 캐시백은 구매하신 제품을 모두 배송 받은 후, 마지막 제품이 배송된 날 기준으로 다음달 말일에 지급됩니다.", "캐시백이 지급되기 전 대상카드를 해지, 교체, 연체, 카드미사용, 이용정지 등의 사유로 정상 보유하지 않은 고객은 행사대상에서 제외됩니다.", "신한카드 플러스 서비스 LG멤버십 포인트 5만P 혜택은 구매하신 제품을 모두 배송 받은 후, 마지막 제품이 배송된 날 기준으로 다음달 말일에 지급됩니다.", "이용(결제)금액은 쿠폰 적용, 포인트 사용 등의 혜택을 제외한 최종 기준 결제 금액 기준입니다.", "혜택이 잘못 제공된 경우(중복 제공 등) 받은 혜택을 금액으로 청구할 수 있습니다.", "LGE.COM 플러스 서비스 결제 시에는 {{PAYDAY}}% 결제일 할인이 적용되지 않습니다." ]
}, {
 heading: "롯데카드 캐시백 유의사항",
 trigger: function(ctx) {
  return ctx.some(function(t) {
   return /롯데카드/.test(t) && /Trip\s*to|로카|AMEX/i.test(t);
  });
 },
 build: function(c) {
  var t = c.lotte || [ [ "20", "18" ], [ "100", "20" ], [ "1,000", "50" ] ];
  var out = [ "이용기간 내 롯데카드 Trip to 로카(AMEX)로 LGE.COM에서 이용 시 최대 " + t[t.length - 1][1] + "만원 캐시백이 적용됩니다." ];
  t.forEach(function(x) {
   out.push("LGE.COM에서 " + x[0] + "만원 이상 결제 시 " + x[1] + "만원 캐시백이 적용됩니다.");
  });
  return out;
 }
}, {
 heading: "현대카드 M 캐시백 유의사항",
 trigger: function(ctx) {
  return ctx.some(function(t) {
   return /현대카드\s*M\b/i.test(t);
  });
 },
 build: function(c) {
  var t = c.hyundai || [ [ "20", "18" ], [ "100", "20" ] ];
  var out = [ "이용기간 내 현대카드 M으로 LGE.COM에서 이용 시 최대 " + t[t.length - 1][1] + "만원 캐시백이 적용됩니다." ];
  t.forEach(function(x) {
   out.push("LGE.COM에서 " + x[0] + "만원 이상 결제 시 " + x[1] + "만원 캐시백이 적용됩니다.");
  });
  out.push("LGE.COM에서 결제 금액 50% M포인트 자동 사용됩니다. (최대 30만 M포인트 한도)");
  return out;
 }
}, {
 heading: "카카오페이 간편결제 유의사항",
 trigger: function(ctx) {
  return ctx.some(function(t) {
   return /카카오페이/.test(t);
  });
 },
 bullets: [ "프로모션 기간{{PERIOD}} 중 {{K_MIN}}만원 이상 결제 건이 있는 경우에 적용되며 결제금액 합산으로 적용되지 않습니다.", "카카오페이에 등록된 페이머니 / 전체 카드로 {{K_MIN}}만원 이상 결제 시 {{K_PCT}}% 즉시 할인이 적용됩니다. (최대 50만원, 실명 인증 기준 1인당 기간 내 최대 1회, 매일 00시 선착순)", "카카오페이에 등록된 비씨카드로 {{K_MIN}}만원 이상 결제 시 {{K_BC}}% 즉시 할인이 적용됩니다. (최대 100만원, 실명 인증 기준 1인당 기간 내 최대 1회, 매일 00시 선착순)", "※ 선착순 적용여부 및 할인이 적용된 실 결제 금액은 카카오페이 결제창 하단 결제금액을 통해 확인" ]
} ];

function noticeContext(payTexts, pm) {
 var c = {
  CARDS: "신한/현대/국민/롯데/우리",
  PAYDAY: "7",
  CB: "10",
  K_MIN: "15",
  K_PCT: "7",
  K_BC: "8",
  PERIOD: ""
 };
 pm = pm || {
  heroes: [],
  rows: []
 };
 pm.rows.forEach(function(r) {
  var m;
  if (r.kind === "payday") {
   if (r.cards) c.CARDS = r.cards;
   if (m = (r.value || "").match(/([0-9.]+)\s*%/)) c.PAYDAY = m[1];
  } else if (r.kind === "cashback" && /신한/.test(r.label)) {
   if (m = (r.value || "").match(/([0-9.]+)\s*%/)) c.CB = m[1];
  } else if (/카카오/.test(r.label)) {
   if (m = r.label.match(/([0-9,]+)\s*만원\s*이상/)) c.K_MIN = m[1];
   if (m = (r.value || "").match(/전체\s*카드\s*([0-9.]+)\s*%/)) c.K_PCT = m[1]; else if (m = (r.value || "").match(/^([0-9.]+)\s*%/)) c.K_PCT = m[1];
   if (m = (r.value || "").match(/비씨카드\s*([0-9.]+)\s*%/)) c.K_BC = m[1];
  }
 });
 pm.heroes.forEach(function(h) {
  if (h.kind === "lotte" && h.tiers && h.tiers.length) c.lotte = h.tiers;
  if (h.kind === "hyundai" && h.tiers && h.tiers.length) c.hyundai = h.tiers;
 });
 var kakaoText = (payTexts || []).filter(function(t) {
  return /카카오페이/.test(t);
 })[0] || "";
 var periodM = kakaoText.match(/기간\s*[:：]?\s*([0-9][0-9./~\s시]*)/);
 if (periodM && periodM[1].trim()) c.PERIOD = " (" + normDates(periodM[1].trim()) + ")";
 return c;
}

function resolveNotice(sec, c) {
 function fill(x) {
  return String(x).replace(/\{\{(\w+)\}\}/g, function(m, k) {
   return c[k] !== undefined ? c[k] : "";
  });
 }
 var bullets = sec.build ? sec.build(c) : sec.bullets;
 return {
  heading: fill(sec.heading),
  bullets: bullets.map(fill)
 };
}

var PayWash = function() {
 var WD = [ "일", "월", "화", "수", "목", "금", "토" ];
 var ICON_RULES = [ [ /캐시백/, "C" ], [ /포인트|적립/, "P" ], [ /할부/, "/" ], [ /할인/, "%" ] ];
 function iconFor(label, fallback) {
  for (var i = 0; i < ICON_RULES.length; i++) {
   if (ICON_RULES[i][0].test(label)) return ICON_RULES[i][1];
  }
  return fallback;
 }
 var DRE = "(?:(\\d{2,4})[./])?(\\d{1,2})[./](\\d{1,2})";
 function num(s) {
  return Number(String(s).replace(/,/g, ""));
 }
 function comma(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
 }
 function key(o) {
  return o.y * 1e4 + o.m * 100 + o.d;
 }
 function wk(o) {
  return WD[new Date(o.y, o.m - 1, o.d).getDay()];
 }
 function fmt(o, noWk) {
  return o.m + "." + o.d + (noWk ? "" : "(" + wk(o) + ")");
 }
 function toDate(y, m, d, refY) {
  var yy = y ? num(y) : refY;
  if (yy < 100) yy += 2e3;
  return {
   y: yy,
   m: num(m),
   d: num(d),
   ex: !!y
  };
 }
 function parseBroadcast(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  return m ? {
   y: +m[1],
   m: +m[2],
   d: +m[3]
  } : null;
 }
 function findRange(text, refY) {
  var re = new RegExp(DRE + "\\s*(?:\\([^)]{1,2}\\))?\\s*(?:\\d{1,2}시)?\\s*[~∼～–-]\\s*" + DRE);
  var g = re.exec(text);
  if (!g) return null;
  var s = toDate(g[1], g[2], g[3], refY), e = toDate(g[4], g[5], g[6], s.y);
  if (!e.ex && key(e) < key(s)) e.y++;
  return {
   s: s,
   e: e
  };
 }
 function dateBefore(text, tail, refY) {
  var g = new RegExp(DRE + "\\s*(?:\\([^)]{1,2}\\))?\\s*" + tail).exec(text);
  return g ? toDate(g[1], g[2], g[3], refY) : null;
 }
 function inRange(b, r) {
  return key(b) >= key(r.s) && key(b) <= key(r.e);
 }
 /* v08: 카카오페이 하위 혜택(1) 페이머니/전체 카드, 2) 비씨카드)을 각각의 기간으로 판정 */
 function kakaoParse(body, b) {
  var parts = [], cur = null;
  body.split("\n").forEach(function(ln) {
   var m = ln.match(/^\s*(\d)\)\s*(.*)$/);
   if (m) {
    cur = { head: m[2].trim(), lines: [] };
    parts.push(cur);
   } else if (cur) cur.lines.push(ln);
  });
  if (!parts.length) return null;
  /* v11: 하위 혜택에 기간이 없으면 섹션 공통 기간("- 기간: 9/15 ~ 9/30" 등, 1) 앞 줄)을 사용 */
  var pre = body.split(/^\s*\d\)\s*/m)[0], rgCommon = findRange(pre, b.y);
  var out = { notes: [], d: null, any: false };
  var d = { all: null, bc: null, min: null, maxAll: null, maxBc: null, rAll: null, rBc: null, first: /선착순/.test(body), daily: /매일\s*0?0\s*시\s*선착순/.test(body) };
  var tail = (body.match(/※[^\n]+/) || [])[0] || "";
  parts.forEach(function(p) {
   var t = p.head + "\n" + p.lines.join("\n");
   var isBc = /비씨|BC/i.test(p.head) || !/페이머니|전체\s*카드/.test(p.head) && /비씨\s*카드/.test(t);
   var nm = isBc ? "비씨카드" : "페이머니/전체 카드";
   var rt = /(\d+(?:\.\d+)?)\s*%/.exec(t), mn = /(\d[\d,]*)\s*만\s*원\s*이상/.exec(t), mx = /최대\s*(\d[\d,]*)\s*만\s*원/.exec(t), rg = findRange(t, b.y) || rgCommon;
   if (!rt) {
    out.notes.push({ k: "warn", m: nm + " 혜택의 할인율을 읽지 못함" });
    return;
   }
   if (rg && !inRange(b, rg)) {
    out.notes.push({ k: "skip", m: nm + " " + rt[1] + "% → 기간(" + fmt(rg.s, 1) + " ~ " + fmt(rg.e, 1) + ") 밖이라 제외" });
    return;
   }
   out.any = true;
   if (isBc) { d.bc = rt[1]; d.maxBc = mx ? num(mx[1]) : null; d.rBc = rg; } else { d.all = rt[1]; d.maxAll = mx ? num(mx[1]) : null; d.rAll = rg; }
   if (mn && !d.min) d.min = num(mn[1]);
   out.notes.push({ k: "ok", m: nm + " " + rt[1] + "% 포함" + (rg ? " (기간 " + fmt(rg.s, 1) + " ~ " + fmt(rg.e, 1) + ")" : "") });
  });
  if (!out.any) return out;
  var rs = [ d.rAll, d.rBc ].filter(Boolean);
  d.range = rs.length ? { s: rs.reduce(function(a, r) { return key(r.s) < key(a) ? r.s : a; }, rs[0].s), e: rs.reduce(function(a, r) { return key(r.e) > key(a) ? r.e : a; }, rs[0].e) } : null;
  d.max = Math.max(d.maxAll || 0, d.maxBc || 0) || null;
  d.label = d.first ? "선착순 할인" : "즉시 할인";
  var kind = d.first ? "선착순" : "즉시";
  function rgt(r) { return r ? fmt(r.s, 1) + " ~ " + fmt(r.e, 1) : ""; }
  var per = d.rAll && d.rBc && rgt(d.rAll) !== rgt(d.rBc) ? "페이머니/전체 카드 " + rgt(d.rAll) + ", 비씨카드 " + rgt(d.rBc) : rgt(d.range);
  var lim = "실명 인증 기준 1인당 기간 내 최대 1회" + (d.daily ? ", 매일 00시 선착순" : "");
  var mxt = function(v) { return v ? "(최대 " + v + "만원)" : ""; };
  var ben;
  if (d.all && d.bc) ben = "카카오페이로 " + d.min + "만원 이상 결제 시 페이머니/전체 카드 " + d.all + "%" + mxt(d.maxAll) + ", 카카오페이에 등록된 비씨카드는 " + d.bc + "%" + mxt(d.maxBc) + " " + kind + " 할인이 적용됩니다. (" + lim + ")";
  else if (d.bc) ben = "카카오페이에 등록된 비씨카드로 " + d.min + "만원 이상 결제 시 " + d.bc + "% " + kind + " 할인이 적용됩니다. (" + (d.maxBc ? "최대 " + d.maxBc + "만원, " : "") + lim + ")";
  else ben = "카카오페이로 " + d.min + "만원 이상 결제 시 페이머니/전체 카드 " + d.all + "% " + kind + " 할인이 적용됩니다. (" + (d.maxAll ? "최대 " + d.maxAll + "만원, " : "") + lim + ")";
  if (!per) out.notes.push({ k: "warn", m: "카카오페이 프로모션 기간을 원문에서 찾지 못해 유의사항에 기간을 넣지 못했습니다 — 원문 확인 후 직접 입력" });
  d.items = [ "프로모션 기간" + (per ? " (" + per + ")" : "") + " 중 " + d.min + "만원 이상 결제 건이 있는 경우에 적용되며 결제금액 합산으로 적용되지 않습니다.", ben, tail ? tail.replace(/\s+/g, " ").trim() : "※ 선착순 적용여부 및 할인이 적용된 실 결제 금액은 카카오페이 결제창 하단 결제금액을 통해 확인" ];
  out.d = d;
  return out;
 }
 function splitSections(text) {
  var secs = [], cur = null;
  text.split("\n").forEach(function(ln) {
   var m = ln.match(/^\s*(\d{1,2})\.\s+(\S.*)$/);
   if (m) {
    cur = {
     no: +m[1],
     title: m[2].trim(),
     lines: []
    };
    secs.push(cur);
   } else if (cur) cur.lines.push(ln);
  });
  return secs;
 }
 function classify(t) {
  if (/24\s*개월|복지몰/.test(t)) return "ignore";
  if (/결제일\s*할인/.test(t)) return "payday";
  if (/기본\s*무이자|신용카드\s*제공/.test(t)) return "table";
  if (/무이자/.test(t) && /12\s*개월/.test(t)) return "int12";
  if (/카카오/.test(t)) return "kakao";
  if (/네이버/.test(t)) return "naver";
  if (/간편결제/.test(t)) return "simple";
  if (/신한/.test(t)) return "shinhan";
  if (/캐시백/.test(t)) return "promos";
  return "unknown";
 }
 function cardsFrom(text) {
  var m = /대상\s*카드\s*[:：]\s*(.+)/.exec(text);
  if (!m) return [];
  return m[1].replace(/\([^)]*\)/g, "").split(/[\/,·]/).map(function(x) {
   return x.trim();
  }).filter(Boolean);
 }
 function josa(word) {
  var w = word.replace(/\)$/, "");
  var c = w.charAt(w.length - 1);
  var open = word.indexOf("(");
  if (word.slice(-1) === ")" && open > -1) c = word.slice(open + 1, -1).slice(-1);
  var code = c.charCodeAt(0);
  if (code >= 44032 && code <= 55203) {
   var b = (code - 44032) % 28;
   return b === 0 || b === 8 ? "로" : "으로";
  }
  var map = {
   M: 1,
   N: 1,
   m: 1,
   n: 1,
   0: 1,
   3: 1,
   6: 1
  };
  return map[c] ? "으로" : "로";
 }
 function mp(n) {
  return n >= 1e4 && n % 1e4 === 0 ? n / 1e4 + "만P" : comma(n) + "P";
 }
 function parseTable(sec) {
  var cells = sec.lines.join("\n").split(/[\t\n]+/).map(function(x) {
   return x.trim();
  }).filter(Boolean);
  var mi = [];
  cells.forEach(function(c, i) {
   if (/^\d+\s*(~\s*\d+\s*)?개월$/.test(c)) mi.push(i);
  });
  var rows = [];
  mi.forEach(function(i, k) {
   var end = k + 1 < mi.length ? mi[k + 1] - 1 : cells.length;
   var notes = [];
   for (var j = i + 1; j < end; j++) {
    if (/^\*\s*유의사항/.test(cells[j])) break;
    notes.push(cells[j]);
   }
   rows.push({
    card: cells[i - 1],
    months: cells[i].replace(/\s+/g, ""),
    note: notes.join(" ")
   });
  });
  var pm = /(\d{4})년\s*(\d{1,2})월/.exec(cells.join(" "));
  return {
   rows: rows,
   period: pm ? {
    y: +pm[1],
    m: +pm[2]
   } : null
  };
 }
 function cardLabel(n) {
  if (/^KB/.test(n)) return "KB 국민카드";
  if (/^비씨|^BC/i.test(n)) return "BC카드";
  return n + "카드";
 }
 function noteFix(n) {
  return n.replace(/정기결제등/g, "정기결제 등").replace(/(카드)\s*\*\s*/, "$1* ").replace(/\s+/g, " ").trim();
 }
 function wash(raw, dateStr) {
  var res = {
   ok: false,
   broadcast: null,
   heroes: [],
   rows: [],
   notices: [],
   summary: [],
   payText: "",
   legalText: "",
   text: ""
  };
  var b = parseBroadcast(dateStr);
  if (!b) {
   res.summary.push({
    k: "warn",
    m: "방송일을 선택해 주세요."
   });
   return res;
  }
  res.broadcast = b;
  var text = String(raw || "").replace(/\r/g, "").replace(/ /g, " ");
  var secs = splitSections(text);
  if (!secs.length) {
   res.summary.push({
    k: "warn",
    m: '"1. …" 형태의 번호 섹션을 찾지 못했습니다. 원문 전체를 붙여넣어 주세요.'
   });
   return res;
  }
  var S = function(k, m) {
   res.summary.push({
    k: k,
    m: m
   });
  };
  var D = {};
  var bs = fmt(b);
  secs.forEach(function(sec) {
   var kind = classify(sec.title);
   var body = sec.lines.join("\n");
   var label = sec.no + ". " + sec.title;
   if (kind === "ignore") {
    S("skip", label + " → 이 영역(LGE.COM 결제혜택)에 쓰지 않아 제외");
    return;
   }
   if (kind === "unknown" || kind === "simple") {
    S("warn", label + " → 인식하지 못한 섹션(반영 안 됨)");
    return;
   }
   if (kind === "promos") {
    D.promos = [];
    var parts = [], cur = null;
    body.split("\n").forEach(function(ln) {
     var m = ln.match(/^\s*(\d)\)\s*(.+)$/);
     if (m) {
      cur = {
       head: m[2].trim(),
       lines: []
      };
      parts.push(cur);
     } else if (cur) cur.lines.push(ln);
    });
    parts.forEach(function(p) {
     var t = p.lines.join("\n");
     var rg = findRange(t, b.y);
     var nm = p.head;
     if (rg && !inRange(b, rg)) {
      S("skip", nm + " → 기간(" + fmt(rg.s, 1) + " ~ " + fmt(rg.e, 1) + ") 밖이라 제외");
      return;
     }
     var brand = (/(\S+카드)/.exec(p.head) || [])[1] || "";
     var tg = (/대상\s*카드\s*[:：]\s*(.+)/.exec(t) || [])[1];
     tg = tg ? tg.trim() : "";
     var name = /카드/.test(tg) ? tg : brand + " " + tg;
     name = name.replace(/^(.+카드)\s*([A-Za-z]+)$/, "$1 $2").trim();
     var tiers = [], re = /(\d[\d,]*)만원\s*이상\s*결제\s*시\s*(\d[\d,]*)만원/g, m;
     while (m = re.exec(t)) tiers.push({
      min: num(m[1]),
      ben: num(m[2])
     });
     var mx = /최대\s*(\d[\d,]*)만원\s*캐시백/.exec(t);
     var mpm = /(\d+)%\s*M\s*포인트\s*자동\s*사용\s*\(최대\s*(\d[\d,]*)만\s*M\s*포인트/.exec(t);
     if (!tiers.length) {
      S("warn", nm + " → 금액 구간을 읽지 못해 제외");
      return;
     }
     D.promos.push({
      brand: brand,
      name: name,
      tiers: tiers,
      max: mx ? num(mx[1]) : Math.max.apply(null, tiers.map(function(x) {
       return x.ben;
      })),
      mp: mpm ? {
       rate: +mpm[1],
       max: num(mpm[2])
      } : null
     });
     S("ok", nm + " → 포함");
    });
    if (!D.promos.length) delete D.promos;
    return;
   }
   var KK = kind === "kakao" ? kakaoParse(body, b) : null;
   var rg = kind === "table" || KK ? null : findRange(body, b.y);
   if (rg && !inRange(b, rg)) {
    S("skip", label + " → 기간(" + fmt(rg.s, 1) + " ~ " + fmt(rg.e, 1) + ")에 방송일 " + bs + "이 속하지 않아 제외");
    return;
   }
   if (kind === "payday") {
    var mn = /(\d[\d,]*)만원\s*이상/.exec(body), rt = /(\d+(?:\.\d+)?)\s*%/.exec(body), mxx = /최대\s*(\d[\d,]*)만원/.exec(body);
    D.payday = {
     min: mn ? num(mn[1]) : null,
     rate: rt ? rt[1] : null,
     max: mxx ? num(mxx[1]) : null,
     cards: cardsFrom(body)
    };
    if (!D.payday.rate || !D.payday.cards.length) {
     S("warn", label + " → 할인율/대상카드를 읽지 못함");
     delete D.payday;
     return;
    }
   } else if (kind === "int12") {
    var mm = /(\d+)\s*개월/.exec(sec.title), mn2 = /(\d[\d,]*)만원\s*이상/.exec(body);
    D.int12 = {
     months: mm ? +mm[1] : 12,
     min: mn2 ? num(mn2[1]) : 100,
     cards: cardsFrom(body)
    };
    if (!D.int12.cards.length) {
     S("warn", label + " → 대상카드를 읽지 못함");
     delete D.int12;
     return;
    }
   } else if (kind === "table") {
    var tb = parseTable(sec);
    if (!tb.rows.length) {
     S("warn", label + " → 무이자 표를 읽지 못함(카드사/개월수 칸 구분 확인)");
     return;
    }
    D.table = tb;
    if (tb.period && (tb.period.y !== b.y || tb.period.m !== b.m)) S("warn", "무이자 표 기간(" + tb.period.y + "년 " + tb.period.m + "월)이 방송일 월과 다릅니다");
   } else if (kind === "shinhan") {
    var cb = /(\d+)%\s*캐시백(?:\s*\(최대\s*(\d[\d,]*)만원\))?/.exec(body), i2 = /(\d[\d,]*)만원\s*이상\s*결제\s*시?\s*(\d+)\s*개월\s*무이자/.exec(body), pt = /LG\s*멤버십\s*포인트\s*(\d[\d,]*)\s*P/.exec(body);
    D.shinhan = {
     cb: cb ? {
      rate: cb[1],
      max: cb[2] ? num(cb[2]) : null
     } : null,
     int: i2 ? {
      min: num(i2[1]),
      months: +i2[2]
     } : null,
     point: pt ? num(pt[1]) : null,
     noPayday: /결제일\s*할인\s*중복\s*적용\s*불가/.test(body)
    };
   } else if (kind === "naver") {
    var nm2 = /(\d[\d,]*)만원\s*이상\s*결제\s*시?\s*,?\s*(\d+)\s*%/.exec(body), nx = /최대\s*(\d[\d,]*)만원/.exec(body);
    D.naver = {
     range: rg,
     min: nm2 ? num(nm2[1]) : null,
     rate: nm2 ? nm2[2] : null,
     max: nx ? num(nx[1]) : null,
     confirm: dateBefore(body, "까지", b.y),
     pay: dateBefore(body, "포인트\\s*적립", b.y)
    };
    if (!D.naver.rate) {
     S("warn", label + " → 적립률/조건을 읽지 못함");
     delete D.naver;
     return;
    }
   } else if (kind === "kakao" && KK) {
    KK.notes.forEach(function(n) { S(n.k, label + " → " + n.m); });
    if (!KK.any) { S("skip", label + " → 방송일에 진행 중인 카카오페이 혜택이 없어 제외"); return; }
    if (!KK.d.min) { S("warn", label + " → 조건금액을 읽지 못함"); return; }
    D.kakao = KK.d;
    S("warn", "카카오페이 유의사항 문구는 캡처 기반 추정입니다. 원출처와 대조해 주세요.");
   } else if (kind === "kakao") {
    var km = /(\d[\d,]*)만원\s*이상/.exec(body), kx = /최대\s*(\d[\d,]*)만원/.exec(body);
    var kbc = /비씨\s*카드?[^\d%\n]*(\d+(?:\.\d+)?)\s*%/.exec(body), kall = /(?:페이머니|전체\s*카드)[^\d%\n]*(\d+(?:\.\d+)?)\s*%/.exec(body);
    if (!kbc && !kall) {
     var kr = /(\d+(?:\.\d+)?)\s*%/.exec(body);
     if (kr) {
      if (/비씨/.test(body)) kbc = kr; else kall = kr;
     }
    }
    D.kakao = {
     range: rg,
     min: km ? num(km[1]) : null,
     bc: kbc ? kbc[1] : null,
     all: kall ? kall[1] : null,
     max: kx ? num(kx[1]) : null
    };
    if (!D.kakao.bc && !D.kakao.all || !D.kakao.range || !D.kakao.min) {
     S("warn", label + " → 기간/조건금액/할인율을 읽지 못함");
     delete D.kakao;
     return;
    }
    S("warn", "카카오페이 유의사항 문구는 캡처 기반 추정입니다. 원출처와 대조해 주세요.");
   }
   S("ok", label + " → 포함" + (rg ? " (기간 " + fmt(rg.s, 1) + " ~ " + fmt(rg.e, 1) + " 해당)" : ""));
  });
  var H = res.heroes, R = res.rows;
  if (D.shinhan) {
   var mi = D.shinhan.int ? D.shinhan.int.min : 100;
   H.push({
    pre: "",
    big: String(mi),
    un: "만",
    label: "먼저 혜택",
    name: "LGE.COM 신한카드",
    lines: [ mi + " 만원 이상 결제 및", "플러스 서비스 이용 시" ]
   });
  }
  var order = [ "롯데", "현대" ];
  (D.promos || []).slice().sort(function(a, c) {
   function ix(p) {
    var i = order.findIndex(function(o) {
     return p.brand.indexOf(o) === 0;
    });
    return i < 0 ? 99 : i;
   }
   return ix(a) - ix(c);
  }).forEach(function(p) {
   var th = p.tiers.map(function(t) {
    return comma(t.min);
   }).join("/") + "만원", bn = p.tiers.map(function(t) {
    return t.ben;
   }).join("/") + " 만원 캐시백";
   H.push({
    pre: "최대",
    big: String(p.max),
    un: "만원",
    label: "결제 혜택",
    name: p.name,
    lines: [ "이벤트 응모 후 " + th + " 결제 시", bn ]
   });
  });
  if (D.payday) R.push({
   icon: "%",
   t: D.payday.cards.join("/") + " 신용카드 결제일 할인",
   v: D.payday.rate,
   u: "%"
  });
  if (D.int12) R.push({
   icon: "/",
   t: D.int12.cards.join("/") + " 신용카드 무이자 할부",
   v: String(D.int12.months),
   u: "개월"
  });
  if (D.shinhan && D.shinhan.cb) R.push({
   icon: "C",
   t: "LGE.COM 신한카드 플러스 이용 시 캐시백",
   v: D.shinhan.cb.rate,
   u: "%"
  });
  if (D.naver) R.push({
   icon: "P",
   t: "네이버페이로 " + D.naver.min + "만원 이상 결제 시 포인트 적립",
   v: D.naver.rate,
   u: "%"
  });
  if (D.kakao) {
   var kk = D.kakao, sg, lb;
   if (kk.all && kk.bc) {
    lb = "즉시 할인";
    sg = [ {
     t: "페이머니/전체 카드 ",
     n: kk.all,
     u: "%"
    }, {
     t: ", 비씨카드 ",
     n: kk.bc,
     u: "%"
    } ];
   } else if (kk.bc) {
    lb = "선착순 할인";
    sg = [ {
     t: "비씨카드 ",
     n: kk.bc,
     u: "%"
    } ];
   } else {
    lb = "즉시 할인";
    sg = [ {
     t: "페이머니/전체 카드 ",
     n: kk.all,
     u: "%"
    } ];
   }
   if (kk.label) lb = kk.label;
   R.push({
    icon: "%",
    t: "카카오페이로 " + kk.min + "만원 이상 결제 시 " + lb,
    seg: sg
   });
  }
  R.forEach(function(r) {
   r.icon = iconFor(r.t, r.icon);
  });
  var N = res.notices;
  if (D.shinhan) {
   var d1 = [ "계약 체결 전, 카드 상품별 연회비, 이용조건 등 상세사항은 금융상품설명서와 약관을 확인하시기 바랍니다.", "금융소비자는 금융소비자보호법 제19조 제1항에 따라 해당 금융상품 또는 서비스에 대하여 설명 받을 권리가 있습니다.", {
    t: "연체이자율은 '회원별, 이용상품별 약정금리+최대 연 3%, 법정 최고금리(연 20%)이내'에서 적용됩니다.",
    sub: [ "단, 연체 발생 시점에 약정금리가 없는 경우 아래와 같이 적용됩니다.", "- 일시불 거래 연체 시: 거래 발생 시점의 최소기간(2개월) 유이자 할부 금리", "- 무이자 할부 거래 연체 시: 거래 발생 시점의 동일한 할부 계약기간의 유이자 할부 금리" ]
   }, "신용카드 발급이 부적정한 경우(개인신용평점 낮음,연체(단기 포함) 사유발생 등), 카드발급이 제한될 수 있습니다.", "카드 이용대금과 이에 수반되는 모든 수수료는 고객님께서 지정하신 결제일에 상환하여야 합니다.", "상환능력에 비해 신용카드 사용액이 과도할 경우, 귀하의 개인신용평점이 하락할 수 있습니다.", "개인신용평점 하락 시 금융거래와 관련된 불이익이 발생할 수 있습니다.", "일정기간 신용카드 이용대금을 연체할 경우, 결제일이 도래하지 않은 모든 신용카드 이용대금을 변제할 의무가 발생할 수 있습니다.", {
    t: "※ 여신금융협회 심의필 제2026-C1h-02851호(2026.03.04~2027.03.03)",
    sub: [ "신한카드 고객센터 (1544-7000)" ]
   } ];
   N.push({
    title: "LGE.COM 신한카드 플러스 서비스 유의사항",
    items: d1
   });
   if (key(b) > 20270303) S("warn", "신한카드 플러스 심의필 유효기간(2027.03.03)이 지났습니다. 최신 심의번호로 교체하세요.");
  }
  if (D.payday) {
   var pc = D.payday.cards.join("/");
   N.push({
    title: D.payday.rate + "% 카드 결제일 할인",
    items: [ D.payday.min + "만원 이상 해당 카드사(" + pc + " 신용카드)를 통한 결제 시 적용되며 결제 시점에 할인되는 것이 아닌, 카드 대금 지불 시점에 청구 할인으로 적용됩니다. (네이버/카카오 페이 등의 간편 결제 시, 적용 불가)", "결제일 할인은 횟수 상관없이 카드당 매월 누적 " + D.payday.max + "만원 한도로 할인 적용되며, 동일 명의의 카드와 가족 카드는 하나의 카드로 간주되어 할인금액이 합산됩니다. (매월 1일 ~ 말일 누적 금액 기준) 가족카드의 경우, 카드에 기재된 이름이 다르더라도 회원 본인과 동일한 명의로 간주됩니다.", "결제일 할인 혜택은 기존 " + pc + " 신용카드 실적과는 무관하게 적용됩니다.", "체크/법인/선불/충전/기프트 카드는 결제일 할인 혜택이 적용되지 않습니다." ]
   });
  }
  if (D.table || D.int12) {
   var it = [], m12 = D.int12 ? D.int12.min : 100, mo12 = D.int12 ? D.int12.months : 12, c12 = D.int12 ? D.int12.cards : [];
   it.push(mo12 + "개월 무이자 혜택은 " + m12 + "만원 이상 결제 시 적용되며, 그 외 개월 수는 5만원 이상 결제 시 무이자 혜택 적용됩니다. (네이버/카카오 페이 등의 간편 결제 시, 적용 불가)");
   if (D.table) D.table.rows.forEach(function(r) {
    var has12 = c12.some(function(c) {
     return r.card.indexOf(c) > -1;
    });
    var nt = noteFix(r.note);
    it.push(cardLabel(r.card) + " 5만원 이상 결제 시 " + r.months + " 무이자" + (has12 ? ", " + m12 + "만원 이상 결제 시 " + mo12 + "개월 무이자" : "") + " 혜택 적용됩니다." + (nt ? " (" + nt + ")" : ""));
   });
   if (D.payday) it.push("무이자 할부와 결제일 할인 혜택(" + D.payday.cards.join("/") + " 신용카드 실적과 무관)은 중복으로 적용 가능합니다.");
   it.push("체크/법인/선불/충전/기프트/하이브리드 카드는 무이자 할부 혜택이 적용되지 않습니다.", "법인(기업)/체크/선불/기프트/은행계열 카드는 혜택에서 제외됩니다. (BC마크가 없는 NON BC 카드 불가)", "본 행사는 카드사 사정에 따라 변경 또는 중단될 수 있습니다.", "무이자 할부 결제 시 포인트, 마일리지 적립이 제외될 수 있습니다.", "환금성, 상품권은 제외됩니다.", "일반 신용카드 거래에 한하며 스마일페이는 지마켓이 제공하는 별도 행사 정책에 따릅니다.");
   N.push({
    title: "무이자 할부 혜택",
    items: it
   });
  }
  if (D.shinhan && D.shinhan.cb) {
   var s = D.shinhan, it4 = [];
   it4.push("신한카드 플러스 서비스 약정 고객대상으로 " + s.cb.rate + "% 캐시백이 적용됩니다." + (s.cb.max ? " (최대 " + s.cb.max + "만원)" : ""));
   if (s.int) it4.push("신한카드 플러스 서비스 " + s.int.min + "만원 이상 결제 시 " + s.int.months + "개월 무이자 혜택 적용됩니다.");
   if (s.point) it4.push("신한카드 플러스 서비스 약정 결제 시 LG멤버십 포인트 " + mp(s.point) + " 제공됩니다.");
   it4.push("신한카드 플러스 서비스 " + s.cb.rate + "% 캐시백은 LGE.COM 신한카드로 자동에서 계좌로 지급됩니다. (50만원 이상 결제 시 캐시백 최대 " + (s.cb.max || 100) + "만원 한도)", "신한카드 플러스 서비스 " + s.cb.rate + "% 캐시백은 구매하신 제품을 모두 배송 받은 후, 마지막 제품이 배송된 날 기준으로 다음달 말일에 지급됩니다.", "캐시백이 지급되기 전 대상카드를 해지, 교체, 연체, 카드미사용, 이용정지 등의 사유로 정상 보유하지 않은 고객은 행사대상에서 제외됩니다.");
   if (s.point) it4.push("신한카드 플러스 서비스 LG멤버십 포인트 " + mp(s.point) + " 혜택은 구매하신 제품을 모두 배송 받은 후, 마지막 제품이 배송된 날 기준으로 다음달 말일에 지급됩니다.");
   it4.push("이용(결제)금액은 쿠폰 적용, 포인트 사용 등의 혜택을 제외한 최종 기준 결제 금액 기준입니다.", "혜택이 잘못 제공된 경우(중복 제공 등) 받은 혜택을 금액으로 청구할 수 있습니다.");
   if (s.noPayday && D.payday) it4.push("LGE.COM 플러스 서비스 결제 시에는 " + D.payday.rate + "% 결제일 할인이 적용되지 않습니다.");
   N.push({
    title: "LGE.COM 신한카드 플러스 서비스 " + s.cb.rate + "% 캐시백 유의사항",
    items: it4
   });
  }
  (D.promos || []).slice().sort(function(a, c) {
   function ix(p) {
    var i = order.findIndex(function(o) {
     return p.brand.indexOf(o) === 0;
    });
    return i < 0 ? 99 : i;
   }
   return ix(a) - ix(c);
  }).forEach(function(p) {
   var it5 = [ "이용기간 내 " + p.name + josa(p.name) + " LGE.COM에서 이용 시 최대 " + p.max + "만원 캐시백이 적용됩니다." ];
   p.tiers.forEach(function(t) {
    it5.push("LGE.COM에서 " + comma(t.min) + "만원 이상 결제 시 " + t.ben + "만원 캐시백이 적용됩니다.");
   });
   if (p.mp) it5.push("LGE.COM에서 결제 금액 " + p.mp.rate + "% M포인트 자동 사용됩니다. (최대 " + p.mp.max + "만 M포인트 한도)");
   N.push({
    title: (/Trip/.test(p.name) ? p.brand : p.name) + " 캐시백 유의사항",
    items: it5
   });
  });
  if (D.naver) {
   var nv = D.naver, it7 = [];
   it7.push("프로모션 기간" + (nv.range ? " (" + fmt(nv.range.s, 1) + " ~ " + fmt(nv.range.e, 1) + ")" : "") + " 중 " + nv.min + "만원 이상 결제 건이 있는 경우에 적용되며 결제금액 합산으로 적용되지 않습니다.", "이벤트 기간 결제한 후 결제 취소 시 재결제 건이 이벤트 조건에 부합하면 적립 대상에 포함됩니다.(단, 예산 소진 시 제외)", "네이버페이로 " + nv.min + "만원 이상 결제 시 네이버페이 포인트 " + nv.rate + "% 적립됩니다." + (nv.max ? " (최대 " + nv.max + "만원, 실명 인증 기준 1인당 기간 내 1회)" : ""));
   if (nv.pay && nv.confirm) it7.push("네이버페이 결제 시 " + fmt(nv.pay) + " 결제하신 간편결제 ID로 지급됩니다. (단, " + fmt(nv.confirm) + "까지 배송 완료된 건에 한함)"); else S("warn", "네이버페이 지급일/배송완료 기준일을 읽지 못해 해당 문구를 생략했습니다.");
   it7.push("결제 시 네이버페이 자체적으로 제공하는 카드사별 결제일 할인 및 무이자 할부 혜택을 받으실 수 있으며, LGE.COM의 신용카드사별 혜택(결제일 할인, 무이자 할부, 캐시백 등)은 적용되지 않습니다.", "본 이벤트는 예산 소진 시, 프로모션 게시 여부와 상관없이 별도 공지하지 않고 조기 종료될 수 있습니다.");
   N.push({
    title: "네이버페이 간편결제 유의사항",
    items: it7
   });
  }
  if (D.kakao && D.kakao.items) N.push({
   title: "카카오페이 간편결제 유의사항",
   items: D.kakao.items
  }); else if (D.kakao) {
   var k = D.kakao;
   N.push({
    title: "카카오페이 간편결제 유의사항",
    items: [ "프로모션 기간 (" + fmt(k.range.s, 1) + " ~ " + fmt(k.range.e, 1) + ") 중 " + k.min + "만원 이상 결제 건이 있는 경우에 적용되며 결제금액 합산으로 적용되지 않습니다.", (k.all && k.bc ? "카카오페이로 " + k.min + "만원 이상 결제 시 페이머니/전체 카드 " + k.all + "%, 카카오페이에 등록된 비씨카드는 " + k.bc + "% 즉시 할인이 적용됩니다." : k.bc ? "카카오페이에 등록된 비씨카드로 " + k.min + "만원 이상 결제 시 " + k.bc + "% 선착순 할인이 적용됩니다." : "카카오페이로 " + k.min + "만원 이상 결제 시 페이머니/전체 카드 " + k.all + "% 즉시 할인이 적용됩니다.") + (k.max ? " (최대 " + k.max + "만원, 실명 인증 기준 1인당 기간 내 최대 1회, 매일 00시 선착순)" : ""), "※ 선착순 적용여부 및 일정에 적용된 실 결제 금액은 카카오페이 결제창 하단 결제금액을 통해 확인" ]
   });
  }
  N.forEach(function(n, i) {
   n.no = i + 1;
  });
  var P = [ "LGE.COM 결제 혜택", "" ];
  H.forEach(function(h) {
   P.push(h.pre ? h.pre + " " + h.big + h.un : h.big + h.un);
   P.push(h.label);
   P.push("");
   P.push(h.name);
   h.lines.forEach(function(l) {
    P.push(l);
   });
   P.push("");
   P.push("자세히 보기");
   P.push("");
  });
  R.forEach(function(r) {
   P.push(r.icon);
   P.push(r.t);
   P.push(r.seg ? r.seg.map(function(g) {
    return g.t + g.n + g.u;
   }).join("") : r.v + r.u);
   P.push("");
  });
  res.payText = P.join("\n").replace(/\n+$/, "");
  var L = [ "LGE.COM 구매혜택 관련 안내" ];
  N.forEach(function(n) {
   L.push(n.no + ") " + n.title);
   n.items.forEach(function(x) {
    if (typeof x === "string") L.push(x); else {
     L.push(x.t);
     x.sub.forEach(function(y) {
      L.push("     " + y);
     });
    }
   });
   L.push("");
  });
  res.legalText = L.join("\n").replace(/\n+$/, "");
  res.text = res.payText + "\n\n" + res.legalText;
  res.ok = H.length + R.length > 0;
  if (!res.ok) S("warn", "반영 가능한 결제혜택이 없습니다. 방송일과 원문 기간을 확인해 주세요.");
  return res;
 }
 var DEFAULT_INT_TABLE = [ [ "신한", "2~3개월", "비인증(정기결제등) 제외" ], [ "KB국민", "2~3개월", "LG전자 전용" ], [ "삼성", "2~3개월" ], [ "NH농협", "2~6개월" ], [ "현대", "2~3개월" ], [ "비씨", "2~5개월", "2분기 정책", "대상 : BC로고 카드", "* 우리, IBK, NH, SC, iM뱅크(구.대구), 부산, 경남, 신한, 하나, KB, 씨티BC(씨티 비자 제외), sh수협, 광주의 개인 신용" ], [ "하나", "2~5개월", "티켓, 렌터카, 홈쇼핑, 손해보험, 아울렛, 학원(세계로) 업종 제외" ], [ "롯데", "2~3개월" ], [ "우리", "2~5개월" ] ];
 function digestItems(raw) {
  var lines = String(raw || "").replace(/\r/g, "").replace(/ /g, " ").split("\n");
  var start = -1, end = lines.length;
  for (var i = 0; i < lines.length; i++) {
   if (/^\s*\d{1,2}\.\s+/.test(lines[i]) && /(LGE\s*(닷컴|\.?\s*COM)|전사|결제\s*혜택)/i.test(lines[i])) {
    start = i + 1;
    break;
   }
  }
  if (start >= 0) {
   for (var j = start; j < lines.length; j++) {
    if (/^\s*\d{1,2}\.\s+\S/.test(lines[j]) || /^\s*\[?\s*유의사항/.test(lines[j])) {
     end = j;
     break;
    }
   }
  } else start = 0;
  var items = [], cur = null;
  for (var k = start; k < end; k++) {
   var ln = lines[k], m = /^\s*\d{1,2}\)\s*(\S.*)$/.exec(ln);
   if (m) {
    cur = {
     t: m[1].trim()
    };
    items.push(cur);
   } else if (cur && ln.trim() && !/^\s*\d{1,2}\.\s+/.test(ln)) {
    cur.t += " " + ln.trim();
   } else if (!ln.trim()) {}
  }
  return items.filter(function(x) {
   return /(카드|카카오\s*페이|네이버\s*페이|결제일\s*할인|캐시백|무이자)/.test(x.t) && /(결제\s*시|결제시|이벤트\s*응모|결제일\s*할인)/.test(x.t);
  });
 }
 function cardListFrom(t) {
  var m = /\)\s*([^()]*?)카드\s*(?:로|를|\s*결제|\s*이용)/.exec(t) || /^\s*([^()]*?)카드\s*(?:로|를|\s*결제|\s*이용)/.exec(t);
  if (!m) return [];
  return m[1].split(/[\/,·]/).map(function(x) {
   return x.replace(/카드$/, "").replace(/^\s*\[|\]\s*$/g, "").trim();
  }).filter(Boolean);
 }
 function periodFrom(t) {
  var m = /\(\s*\*?\s*기간\s*[:：]?\s*([^)]+?)\s*\)/.exec(t);
  return m ? m[1].trim() : "";
 }
 function digest(raw) {
  var out = {
   sheet: "",
   notes: [],
   found: 0
  };
  var items = digestItems(raw);
  if (!items.length) return out;
  var P = {}, N = out.notes, promos = [];
  items.forEach(function(it) {
   var t = it.t, min = /(\d[\d,]*)\s*만원\s*이상/.exec(t), rate = /(\d+(?:\.\d+)?)\s*%/.exec(t);
   if (/신한\s*카드\s*플러스|플러스\s*서비스/.test(t)) {
    var cb = /(\d+)\s*%\s*캐시백(?:\s*\(\s*최대\s*(\d[\d,]*)\s*만원\s*\))?/.exec(t), pt = /LG\s*멤버십\s*포인트\s*(\d[\d,]*)\s*P/.exec(t);
    P.shinhan = {
     min: min ? min[1] : "100",
     rate: cb ? cb[1] : rate ? rate[1] : "",
     max: cb && cb[2] ? cb[2] : (/최대\s*(\d[\d,]*)\s*만원/.exec(t) || [])[1] || "",
     pt: pt ? pt[1] : "",
     noPay: /결제일\s*할인\s*중복/.test(t)
    };
   } else if (/이벤트\s*응모/.test(t) && /캐시백/.test(t)) {
    var br = (/(롯데|현대|삼성|국민|신한|하나|우리|비씨|BC|NH농협|농협)\s*카드/.exec(t) || [])[0] || "";
    var tg = "";
    var bm = /\[([^\]]+)\]/.exec(t);
    if (bm) tg = bm[1].trim(); else {
     var hm = /^\s*(.+?)\s*이벤트\s*응모/.exec(t);
     tg = hm ? hm[1].trim() : "";
    }
    if (br && tg.indexOf(br) === 0 && !bm) tg = tg.replace(/\s+/g, " ").trim(); else if (br && tg.indexOf(br) === 0) tg = tg.slice(br.length).trim();
    var tiers = [], re = /(\d[\d,]*)\s*만원\s*이상\s*결제\s*시\s*(\d[\d,]*)\s*만원\s*캐시백/g, mm;
    while (mm = re.exec(t)) tiers.push([ mm[1], mm[2] ]);
    var mpm = /(\d+)\s*%\s*M\s*포인트\s*자동\s*사용\s*\(\s*최대\s*(\d[\d,]*)\s*만\s*M\s*포인트/.exec(t);
    promos.push({
     brand: br,
     tg: tg,
     tiers: tiers,
     pr: periodFrom(t),
     mp: mpm ? [ mpm[1], mpm[2] ] : null,
     raw: t
    });
   } else if (/결제일\s*할인|청구\s*할인/.test(t)) {
    var mx = /한도\s*(\d[\d,]*)\s*만원|최대\s*(\d[\d,]*)\s*만원/.exec(t);
    P.payday = {
     min: min ? min[1] : "",
     rate: rate ? rate[1] : "",
     max: mx ? mx[1] || mx[2] : "",
     cards: cardListFrom(t),
     pr: periodFrom(t)
    };
   } else if (/무이자/.test(t)) {
    var mo = /(\d+)\s*개월/.exec(t);
    P.int = P.int || {
     min: min ? min[1] : "100",
     months: mo ? mo[1] : "12",
     cards: cardListFrom(t)
    };
   } else if (/카카오/.test(t)) {
    var kb = /비씨\s*카드?\s*(\d+(?:\.\d+)?)\s*%/.exec(t), firstRate = rate ? rate[1] : "";
    var kall = firstRate && (!kb || kb[1] !== firstRate || /(\d+)\s*%[^()]*\(/.test(t)) ? firstRate : "";
    if (kb && kall === kb[1] && !/페이머니|전체/.test(t) && /^[^%]*비씨/.test(t)) kall = "";
    var kmx = /최대\s*(\d[\d,]*)\s*만원/.exec(t);
    P.kakao = {
     min: min ? min[1] : "",
     all: kall,
     bc: kb ? kb[1] : "",
     max: kmx ? kmx[1] : "",
     pr: periodFrom(t)
    };
   } else if (/네이버/.test(t)) {
    var nmx = /최대\s*(\d[\d,]*)\s*만원/.exec(t);
    var dre = "(\\d{2,4}[./]\\d{1,2}[./]\\d{1,2}(?:\\s*\\([^)]{1,2}\\))?)";
    var c1 = new RegExp(dre + "\\s*까지").exec(t), c2 = new RegExp(dre + "\\s*포인트\\s*적립").exec(t);
    P.naver = {
     min: min ? min[1] : "",
     rate: rate ? rate[1] : "",
     max: nmx ? nmx[1] : "",
     pr: periodFrom(t),
     confirm: c1 ? c1[1] : "",
     pay: c2 ? c2[1] : ""
    };
   }
  });
  var S = [], n = 0;
  function sec(title, lines) {
   n++;
   S.push(n + ". " + title);
   lines.forEach(function(l) {
    S.push(l);
   });
   S.push("");
  }
  if (P.payday && P.payday.rate && P.payday.cards.length) {
   if (!P.payday.max) {
    P.payday.max = "100";
    N.push({
     k: "warn",
     m: "결제일 할인 누적 한도를 원문에서 읽지 못해 100만원(표준값)으로 처리했습니다. 확인해 주세요."
    });
   }
   sec("결제일 할인", [ " - " + (P.payday.min || "50") + "만원 이상 결제시 " + P.payday.rate + "% 청구할인 (최대 " + P.payday.max + "만원)", " - 대상카드 : " + P.payday.cards.join("/") + " (" + P.payday.cards.length + "개)" ]);
   out.found++;
  }
  if (P.int && P.int.cards.length) {
   sec("무이자 할부 " + P.int.months + "개월", [ " - " + P.int.min + "만원이상 결제시 " + P.int.months + "개월 무이자 할부", " - 대상카드 : " + P.int.cards.join("/") + " (" + P.int.cards.length + "개)" ]);
   out.found++;
  }
  if (P.naver && P.naver.rate) {
   var nl = [];
   if (P.naver.pr) nl.push(" - 기간: " + P.naver.pr);
   nl.push(" - 혜택: " + (P.naver.min || "20") + "만원 이상 결제시, " + P.naver.rate + "% 네이버페이 포인트 적립" + (P.naver.max ? " (최대 " + P.naver.max + "만원)" : ""));
   if (P.naver.confirm && P.naver.pay) nl.push(" - 적립 조건: " + P.naver.confirm + "까지 제품 배송 및 구매 확정이 완료된 결제 건에 한해 " + P.naver.pay + " 포인트 적립");
   sec("간편결제 포인트 적립 - 네이버페이", nl);
   out.found++;
  }
  if (P.kakao && (P.kakao.all || P.kakao.bc)) {
   var kl = [];
   if (P.kakao.pr) kl.push(" - 기간: " + P.kakao.pr);
   var kt = [];
   if (P.kakao.all) kt.push("페이머니/전체 카드 " + P.kakao.all + "%");
   if (P.kakao.bc) kt.push("비씨카드 " + P.kakao.bc + "%");
   kl.push(" - 혜택: " + (P.kakao.min || "15") + "만원 이상 결제시 " + kt.join(", ") + " 즉시 할인" + (P.kakao.max ? " (최대 " + P.kakao.max + "만원)" : ""));
   sec("간편결제 - 카카오페이", kl);
   out.found++;
  }
  if (P.shinhan && P.shinhan.rate) {
   var s = P.shinhan, sl = [ "① 플러스 서비스 결제시 " + s.rate + "% 캐시백" + (s.max ? " (최대 " + s.max + "만원)" : "") + (s.noPay || P.payday ? "  *결제일할인 중복적용 불가" : ""), "  - 지급일자 : 배송일 기준 익월 말 (신용카드 연결계좌)" ];
   if (P.int && P.int.months) sl.push("② " + s.min + "만원 이상 결제시 " + P.int.months + "개월 무이자 할부");
   if (s.pt) {
    sl.push("③ 플러스 서비스 결제 시 LG멤버십 포인트 " + s.pt + "P 제공");
    sl.push(" - 지급일자 : 배송일 기준 익월 말");
   }
   sec("LGE.COM 신한카드", sl);
   out.found++;
  }
  if (promos.length) {
   var pl = [];
   promos.forEach(function(p, i) {
    if (!p.tiers.length) {
     N.push({
      k: "warn",
      m: (p.brand || "카드") + " 캐시백 항목의 금액 구간(N만원 이상 결제 시 N만원 캐시백)을 읽지 못해 제외했습니다."
     });
     return;
    }
    var mxb = Math.max.apply(null, p.tiers.map(function(x) {
     return Number(String(x[1]).replace(/,/g, ""));
    }));
    pl.push("  " + (i + 1) + ") " + (p.brand || "카드") + " 캐시백 프로모션");
    pl.push("   - 대상카드: " + (p.tg || p.brand));
    if (p.pr) pl.push("   - 기간: " + p.pr);
    pl.push("   - 캐시백 혜택: 최대 " + mxb + "만원 캐시백");
    p.tiers.forEach(function(x) {
     pl.push("     LGE.COM에서 " + x[0] + "만원 이상 결제 시 " + x[1] + "만원");
    });
    if (p.mp) pl.push("   - 대상 카드로 LGE.COM에서 결제 금액 " + p.mp[0] + "% M포인트 자동사용(최대 " + p.mp[1] + "만 M포인트 한도)");
   });
   if (pl.length) {
    sec("캐시백 프로모션 - 신규발급 및 이용유도 목적", pl);
    out.found++;
   }
  }
  out.sheet = S.join("\n").replace(/\n+$/, "");
  return out;
 }
 function brandOfHead(h) {
  return ((/(\S+카드)/.exec(h) || [])[1] || h).trim();
 }
 function mergePromos(a, b) {
  function parts(sec) {
   var P = [], cur = null;
   sec.lines.forEach(function(ln) {
    var m = ln.match(/^\s*(\d)\)\s*(.+)$/);
    if (m) {
     cur = {
      head: m[2].trim(),
      lines: []
     };
     P.push(cur);
    } else if (cur) cur.lines.push(ln);
   });
   return P;
  }
  var pa = parts(a), pb = parts(b), bb = {};
  pb.forEach(function(p) {
   bb[brandOfHead(p.head)] = 1;
  });
  var all = pa.filter(function(p) {
   return !bb[brandOfHead(p.head)];
  }).concat(pb), lines = [];
  all.forEach(function(p, i) {
   lines.push("  " + (i + 1) + ") " + p.head);
   p.lines.forEach(function(l) {
    lines.push(l);
   });
  });
  return {
   no: a.no,
   title: a.title,
   lines: lines
  };
 }
 function sheetText(secs) {
  return secs.map(function(s, i) {
   return i + 1 + ". " + s.title + "\n" + s.lines.join("\n").replace(/\s+$/, "");
  }).join("\n\n");
 }
 function merge(baseText, overText) {
  var B = splitSections(String(baseText || "").replace(/\r/g, "")), O = splitSections(String(overText || "").replace(/\r/g, "")), out = [], oBy = {};
  O.forEach(function(s) {
   var k = classify(s.title);
   if (k !== "unknown" && k !== "simple" && k !== "ignore") oBy[k] = s;
  });
  B.forEach(function(s) {
   var k = classify(s.title), o = oBy[k];
   if (!o) {
    out.push(s);
    return;
   }
   out.push(k === "promos" ? mergePromos(s, o) : o);
   o.used = true;
  });
  O.forEach(function(s) {
   if (!s.used && classify(s.title) !== "ignore") out.push(s);
  });
  return sheetText(out);
 }
 function ensureTable(text) {
  var secs = splitSections(String(text || "").replace(/\r/g, "")), has = false, int12 = false;
  secs.forEach(function(s) {
   var k = classify(s.title);
   if (k === "table") has = true;
   if (k === "int12") int12 = true;
  });
  if (!int12 || has) return {
   text: text,
   added: false
  };
  var tl = [ "* 무이자할부 행사", "기간\t카드사\t할부개월\t기타" ];
  DEFAULT_INT_TABLE.forEach(function(r) {
   tl.push(r.join("\t"));
  });
  secs.push({
   title: "신용카드 제공 기본 무이자",
   lines: tl
  });
  return {
   text: sheetText(secs),
   added: true
  };
 }
 function supplement(sheet, raw) {
  var res = {
   text: sheet,
   added: []
  };
  raw = String(raw || "");
  if (!/^\s*\d{1,2}\.\s+.*(LGE\s*(닷컴|\.?\s*COM)|전사|결제\s*혜택)/im.test(raw)) return res;
  var dg;
  try {
   dg = digest(raw);
  } catch (e) {
   return res;
  }
  if (!dg || !dg.found) return res;
  var B = splitSections(String(sheet || "").replace(/\r/g, "")), O = splitSections(dg.sheet), has = {}, out = B.slice(), changed = false;
  B.forEach(function(s) {
   has[classify(s.title)] = s;
  });
  O.forEach(function(o) {
   var k = classify(o.title);
   if (k === "promos") {
    if (!has.promos) {
     out.push(o);
     res.added.push("카드사 캐시백");
     changed = true;
    } else {
     var cnt = function(sec) {
      return sec.lines.filter(function(l) {
       return /^\s*\d\)/.test(l);
      }).length;
     };
     var mg = mergePromos(o, has.promos);
     if (cnt(mg) > cnt(has.promos)) {
      out[out.indexOf(has.promos)] = mg;
      has.promos = mg;
      res.added.push("카드사 캐시백(시트에 없는 카드사)");
      changed = true;
     }
    }
   } else if ((k === "kakao" || k === "naver" || k === "shinhan") && !has[k]) {
    out.push(o);
    has[k] = o;
    res.added.push(k === "kakao" ? "카카오페이" : k === "naver" ? "네이버페이" : "신한카드");
    changed = true;
   }
  });
  if (changed) res.text = sheetText(out);
  return res;
 }
 return {
  iconFor: iconFor,
  wash: wash,
  digest: digest,
  merge: merge,
  supplement: supplement,
  ensureTable: ensureTable,
  findRange: findRange,
  splitSections: splitSections,
  parseTable: parseTable
 };
}();

function _paySupp(own, pv) {
 try {
  var sp = PayWash.supplement(own.text, pv.rawText || pv.paymentFullText || "");
  if (sp.added.length) {
   own.text = sp.text;
   own.notes = (own.notes || []).concat([ {
    k: "ok",
    m: "판촉 원문 4번에서 결제혜택 원문에 없던 항목 보충 → " + sp.added.join(", ")
   } ]);
  }
 } catch (e) {}
 return own;
}

function ownPaySheet(pv) {
 var o = pv.opts || {}, t = (o.paySheet || "").trim();
 if (t) return _paySupp({
  text: t,
  src: "결제혜택 원문 입력칸",
  full: true
 }, pv);
 var raw = pv.rawText || "", i = raw.search(/^[ \t]*1\.[ \t]*결제일[ \t]*할인/m);
 if (i >= 0) return _paySupp({
  text: raw.slice(i),
  src: "판촉 원문에서 자동 인식",
  cut: i,
  full: true
 }, pv);
 var dg = null;
 try {
  dg = PayWash.digest(pv.paymentFullText || raw);
 } catch (e) {
  dg = null;
 }
 if (dg && dg.found) return {
  text: dg.sheet,
  src: "판촉 원문 결제혜택 항목을 v01 형식으로 변환",
  notes: dg.notes,
  converted: true
 };
 return null;
}

function caseDateKey(name) {
 var d = parseDateFromCaseName(name || "");
 if (!d) return 0;
 return inferYear(d.month, d.day) * 1e4 + d.month * 100 + d.day;
}

function prevLiveCase(id, name, skip) {
 var me = caseDateKey(name), best = null, bestK = -1;
 loadData(STORE_KEY.cases).forEach(function(c) {
  if (!c || (skip || []).indexOf(c.id) >= 0 || !c.promoVersions || !c.promoVersions.length) return;
  var k = caseDateKey(c.name), key;
  if (me) {
   if (!k || k >= me) return;
   key = k * 1e6 + 0;
  } else key = Date.parse(caseActivity(c)) || 0;
  if (key > bestK) {
   bestK = key;
   best = c;
  }
 });
 return best;
}

function inheritedPayBase(id, name, depth, skip) {
 if (depth > 8) return null;
 var prev = prevLiveCase(id, name, skip);
 if (!prev) return null;
 skip = (skip || []).concat([ prev.id ]);
 var v = prev.promoVersions[prev.promoVersions.length - 1] || {};
 var own = ownPaySheet({
  opts: v.opts,
  rawText: v.rawText,
  paymentFullText: v.paymentFullText
 });
 if (own && own.full) return {
  text: own.text,
  from: prev.name
 };
 var base = inheritedPayBase(prev.id, prev.name, depth + 1, skip);
 if (own && base) return {
  text: PayWash.merge(base.text, own.text),
  from: prev.name
 };
 if (own) return {
  text: own.text,
  from: prev.name
 };
 return base;
}

function paySheetFrom(pv) {
 var own = ownPaySheet(pv);
 if (own && own.full) return own;
 var inh = null;
 if (!(pv.opts && pv.opts.payInh === false)) {
  var nm = (document.getElementById("case_name") || {}).value || "";
  inh = inheritedPayBase(currentCaseId, nm, 0, [ currentCaseId ]);
 }
 var res;
 if (inh && own) res = {
  text: PayWash.merge(inh.text, own.text),
  src: "직전 라이브(" + inh.from + ")의 결제혜택 + 이번 판촉에서 수정·추가된 항목 반영",
  notes: own.notes || [],
  inherited: true,
  from: inh.from,
  edited: true
 }; else if (inh) res = {
  text: inh.text,
  src: "직전 라이브(" + inh.from + ")의 결제혜택을 기본값으로 사용",
  notes: [],
  inherited: true,
  from: inh.from,
  edited: false
 }; else if (own) res = own; else return null;
 var et = PayWash.ensureTable(res.text);
 if (et.added) {
  res.text = et.text;
  res.notes = (res.notes || []).concat([ {
   k: "warn",
   m: "원문에 카드사별 기본 무이자 표가 없어 기존 표준 개월 수(신한·국민·삼성 2~3 / NH 2~6 / 현대 2~3 / BC 2~5 / 하나 2~5 / 롯데 2~3 / 우리 2~5)를 사용했습니다. 이번 달 표와 대조해 주세요."
  } ]);
 }
 return res;
}

function broadcastDateStr(pv) {
 var name = (document.getElementById("case_name") || {}).value || "";
 var d = parseDateFromCaseName(name);
 if (!d && pv && pv.opts && pv.opts.bdate) d = parseDateFromCaseName(pv.opts.bdate);
 if (!d) return "";
 function z(n) {
  return (n < 10 ? "0" : "") + n;
 }
 return inferYear(d.month, d.day) + "-" + z(d.month) + "-" + z(d.day);
}

function payWashInfo(pv) {
 if (!pv) return {
  has: false,
  res: null
 };
 if (pv._pwi) return pv._pwi;
 var info = {
  has: false,
  res: null,
  src: "",
  ds: "",
  warn: ""
 };
 try {
  var src = paySheetByMode(pv);
  if (src) {
   info.has = true;
   info.src = src.src;
   info.ds = src.ds || broadcastDateStr(pv);
   info.dsLabel = src.dsLabel || "방송일";
   info.inherited = !!src.inherited;
   info.from = src.from || "";
   info.edited = !!src.edited;
   if (!info.ds) info.warn = '방송일을 읽지 못해 결제혜택을 워싱하지 못했습니다. 방송명 앞에 "10/27"처럼 날짜를 넣어 주세요(⋯ 더보기 → 방송명 수정).'; else {
    var r = PayWash.wash(src.text, info.ds);
    if (r && r.ok) {
     info.res = r;
    } else info.warn = "결제혜택 원문에서 반영 가능한 항목을 찾지 못했습니다(방송일 " + info.ds + ").";
    info.sum = (src.notes || []).concat(r && r.summary || []);
   }
  }
 } catch (e) {
  info.warn = "결제혜택 워싱 중 오류: " + e.message;
 }
 try {
  Object.defineProperty(pv, "_pwi", {
   value: info,
   enumerable: false,
   writable: true
  });
 } catch (e) {}
 return info;
}

function payWashFor(pv) {
 return payWashInfo(pv).res;
}

function payModelFromWash(W) {
 return {
  heroes: W.heroes.map(function(h, i) {
   return {
    title: h.name,
    desc: h.lines.join(" "),
    descLines: h.lines,
    badgePre: h.pre,
    badgeNum: h.big,
    badgeUnit: h.un,
    badgeLabel: h.label,
    kind: /신한/.test(h.name) ? "shinhan" : /롯데/.test(h.name) ? "lotte" : /현대/.test(h.name) ? "hyundai" : "etc",
    rank: i
   };
  }),
  rows: W.rows.map(function(r, i) {
   return {
    icon: r.icon,
    label: r.t,
    value: r.seg ? r.seg.map(function(g) {
     return g.t + g.n + g.u;
    }).join("") : r.v + r.u,
    seg: r.seg || null,
    note: "",
    kind: "wash",
    rank: i
   };
  })
 };
}

function payModelFor(pv) {
 var W = payWashFor(pv);
 if (!W && payWashInfo(pv).has) return {
  heroes: [],
  rows: []
 };
 return W ? payModelFromWash(W) : pv.paymentFullText ? payModel(pv.paymentFullText) : {
  heroes: [],
  rows: []
 };
}

function noticesFromWash(W) {
 return W.notices.map(function(n) {
  return {
   heading: n.title,
   bullets: n.items.map(function(x) {
    return typeof x === "string" ? x : x.t + "\n" + x.sub.join("\n");
   })
  };
 });
}

function matchedNotices(pv) {
 var _W = payWashFor(pv);
 if (_W) return noticesFromWash(_W);
 if (payWashInfo(pv).has) return [];
 var payTexts = pv.paymentFullText ? paymentAllTextsFrom(pv.paymentFullText) : [];
 var c = noticeContext(payTexts, pv.paymentFullText ? payModel(pv.paymentFullText) : null);
 return PAYMENT_NOTICE_SECTIONS.filter(function(sec) {
  return sec.trigger(payTexts);
 }).map(function(sec) {
  return resolveNotice(sec, c);
 });
}

function applyGiftTrademark(gift) {
 if (!gift) return gift;
 var g = gift.trim();
 return GIFT_TRADEMARKS[g] || gift;
}

function splitPaymentItems(text) {
 var lines = (text || "").split("\n");
 var items = [];
 var cur = null;
 for (var i = 0; i < lines.length; i++) {
  var trimmed = lines[i].trim();
  if (!trimmed) continue;
  if (/^[0-9]+[.)]\s*/.test(trimmed)) {
   if (cur) items.push(cur);
   cur = trimmed.replace(/^[0-9]+[.)]\s*/, "");
  } else if (cur) {
   cur += " " + trimmed;
  } else {
   cur = trimmed;
  }
 }
 if (cur) items.push(cur);
 return items;
}

function isPaymentHeroText(t) {
 if (/신한카드/.test(t) && /플러스/.test(t)) return true;
 if (/현대카드\s*M\b/i.test(t)) return true;
 if (/롯데카드/.test(t) && /Trip\s*to|로카|AMEX/i.test(t)) return true;
 var m = t.match(/^[［\[]([^\]］]+)[\]］]/);
 if (!m) return false;
 var label = m[1];
 return label.indexOf("카드") !== -1 && label.indexOf("/") === -1;
}

function buildPaymentHero(t) {
 var m = t.match(/^[［\[]([^\]］]+)[\]］]\s*(.*)$/);
 var bracketTitle = m ? m[1].trim() : "";
 var rest = (m ? m[2] : "").trim().replace(/^결제\s*시[,]?\s*/, "");
 if (/신한카드/.test(t) && /플러스/.test(t)) {
  var capM = t.match(/최대\s*([0-9,]+)\s*만원/);
  var cap = capM ? capM[1] : "";
  return {
   title: "LGE.COM 신한카드",
   desc: cap ? cap + " 만원 이상 결제 및 플러스 서비스 이용 시" : rest || t,
   badgeNum: cap,
   badgeUnit: "만",
   badgeLabel: "먼저 혜택",
   raw: t,
   rank: 0,
   kind: "shinhan"
  };
 }
 var _pairRe = /([0-9,]+)\s*만원\s*이상\s*결제\s*시\s*([0-9,]+)\s*만원\s*캐시백/g;
 var _pairCount = (t.match(_pairRe) || []).length;
 if (/현대카드\s*M\b/i.test(t) || bracketTitle && /이벤트\s*응모|응모/.test(t) && _pairCount >= 2) {
  var pairs = [];
  var re = /([0-9,]+)\s*만원\s*이상\s*결제\s*시\s*([0-9,]+)\s*만원\s*캐시백/g, pm;
  while (pm = re.exec(t)) {
   pairs.push([ pm[1], pm[2] ]);
  }
  var desc = rest || t, badgeNum = "";
  var badgePre = "";
  if (pairs.length >= 2) {
   desc = "이벤트 응모 후 " + pairs.map(function(x) {
    return x[0];
   }).join("/") + "만원 결제 시 " + pairs.map(function(x) {
    return x[1];
   }).join("/") + " 만원 캐시백";
   badgePre = "최대";
   badgeNum = pairs[pairs.length - 1][1];
  } else if (pairs.length === 1) {
   desc = pairs[0][0] + "만원 이상 결제 시 " + pairs[0][1] + "만원 캐시백";
   badgeNum = pairs[0][1];
  } else {
   var maxM = t.match(/최대\s*([0-9,]+)\s*만원/);
   if (maxM) {
    badgePre = "최대";
    badgeNum = maxM[1];
   }
  }
  var isHyundai = /현대카드\s*M\b/i.test(t);
  var heroTitle = isHyundai ? "현대카드 M" : bracketTitle || (/롯데카드/.test(t) ? "롯데카드 Trip to 로카(AMEX)" : "");
  return {
   title: heroTitle,
   desc: desc,
   badgePre: badgePre,
   badgeNum: badgeNum,
   badgeUnit: "만원",
   badgeLabel: "결제 혜택",
   raw: t,
   tiers: pairs.map(function(x) {
    return [ x[0], x[1] ];
   }),
   rank: isHyundai ? 2 : /롯데/.test(heroTitle) ? 1 : 3,
   kind: isHyundai ? "hyundai" : /롯데/.test(heroTitle) ? "lotte" : "etc"
  };
 }
 var title = bracketTitle || t;
 var condNum = t.match(/([0-9,]+)\s*(만원|천원)\s*이상/);
 var otherNum = t.match(/(최대\s*)?([0-9,]+)\s*(만원|%|천원)/);
 var badgeNum2 = "", badgeUnit2 = "", badgeLabel2 = "결제 혜택";
 if (condNum) {
  badgeNum2 = condNum[1];
  badgeUnit2 = condNum[2];
  badgeLabel2 = "먼저 혜택";
 } else if (otherNum) {
  badgeNum2 = ((otherNum[1] || "").trim() + " " + otherNum[2]).trim();
  badgeUnit2 = otherNum[3];
 }
 return {
  title: title,
  desc: rest || t,
  badgeNum: badgeNum2,
  badgeUnit: badgeUnit2,
  badgeLabel: badgeLabel2,
  raw: t,
  rank: 3,
  kind: "etc"
 };
}

function paymentIconInfo(t) {
 if (/무이자/.test(t)) return {
  icon: "/"
 };
 if (/캐시백/.test(t)) return {
  icon: "C"
 };
 if (/포인트|적립/.test(t)) return {
  icon: "P"
 };
 if (/할인/.test(t)) return {
  icon: "%"
 };
 return {
  icon: "•"
 };
}

function _josaRo(w) {
 var c = (w || "").charCodeAt((w || "").length - 1);
 if (c < 44032 || c > 55203) return "로";
 var jong = (c - 44032) % 28;
 return jong === 0 || jong === 8 ? "로" : "으로";
}

function buildPaymentRow(t) {
 var s = t.trim(), condNote = "";
 var cm = s.match(/^[\(（]([^)）]*)[\)）]\s*/);
 if (cm) {
  condNote = cm[1].trim();
  s = s.slice(cm[0].length);
 }
 var m = s.match(/^(.*?(?:결제|이용)\s*시)[,]?\s*(.+)$/);
 var prefix = m ? m[1].trim() : s;
 var body = m ? m[2].trim() : "";
 var main = body, note = "";
 var pm = body.match(/^([^(（]+)[\s]*([\(（][\s\S]+)$/);
 if (pm) {
  main = pm[1].trim();
  note = pm[2].trim();
 }
 var vm = main.match(/^(최대\s*)?([0-9][0-9,.]*)\s*(%|개월|만원|만P|만|원|P)?\s*(.*)$/);
 var label = prefix, value = main, cards = "", kept = false;
 if (vm && vm[4]) {
  var name = vm[4].trim();
  value = ((vm[1] || "").trim() + " " + vm[2] + (vm[3] || "")).trim();
  var cardList = prefix.match(/^([^\s]*\/[^\s]*?)카드(?:로|으로)?\s*결제\s*시$/);
  var payM = prefix.match(/^([가-힣A-Za-z]*페이)(?:로|으로)?\s*(.*?)결제\s*시$/);
  if (cardList) {
   cards = cardList[1];
   label = cards + " 신용카드 " + name;
  } else if (payM) {
   var cond = (payM[2] || "").trim() || condNote;
   label = payM[1] + _josaRo(payM[1]) + " " + (cond ? cond + " " : "") + "결제 시 " + name;
   kept = true;
   if (/카카오/.test(payM[1])) {
    var bc = t.match(/(?:비씨|BC)\s*카드?\s*(?:로)?[^0-9%]{0,12}([0-9]+(?:\.[0-9]+)?)\s*%/i);
    if (bc && vm[3] === "%") value = "페이머니 / 전체 카드 " + vm[2] + "% , 비씨카드 " + bc[1] + "%";
   }
  } else {
   label = prefix + " " + name;
  }
  var kindName = name;
 }
 var kind = /결제일/.test(label) ? "payday" : /무이자/.test(label) ? "zero" : /캐시백/.test(label) ? "cashback" : "etc";
 var info = paymentIconInfo(label + " " + t);
 var review = [ !kept && condNote ? "원문 조건: " + condNote : "", note ].filter(Boolean).join(" · ");
 return {
  icon: info.icon,
  label: label,
  value: value,
  note: review,
  raw: t,
  kind: kind,
  cards: cards,
  rank: kind === "payday" ? 0 : kind === "zero" ? 1 : kind === "cashback" ? 2 : 3
 };
}

function payModel(text) {
 var heroes = [], rows = [];
 splitPaymentItems(text || "").forEach(function(t) {
  if (isPaymentHeroText(t)) {
   var h = buildPaymentHero(t);
   heroes.push(h);
   if (h.kind === "shinhan") {
    var cb = t.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*캐시백/);
    if (cb) rows.push({
     icon: "C",
     label: "LGE.COM 신한카드 플러스 이용 시 캐시백",
     value: cb[1] + "%",
     note: "",
     raw: t,
     kind: "cashback",
     cards: "",
     rank: 2
    });
   }
  } else rows.push(buildPaymentRow(t));
 });
 function stable(arr) {
  return arr.map(function(x, i) {
   return [ x, i ];
  }).sort(function(a, b) {
   return a[0].rank - b[0].rank || a[1] - b[1];
  }).map(function(p) {
   return p[0];
  });
 }
 return {
  heroes: stable(heroes),
  rows: stable(rows)
 };
}

function paymentAllTextsFrom(paymentFullText) {
 return splitPaymentItems(paymentFullText || "");
}

function splitPayValue(value) {
 var m = (value || "").match(/^(최대\s*)?([0-9][0-9,.]*)\s*(%|개월|만원|만P|만|원|P)?(.*)$/);
 if (!m) return null;
 return {
  pre: (m[1] || "").trim(),
  num: m[2],
  unit: m[3] || "",
  rest: m[4] || ""
 };
}

function renderPaymentBenefitBox(paymentFullText, pvArg) {
 var _W = pvArg ? payWashFor(pvArg) : null;
 if (pvArg && !_W) {
  var _pi = payWashInfo(pvArg);
  if (_pi.has) {
   var _why = _pi.warn || "결제혜택을 읽지 못했습니다.";
   return '<div class="mockSec mockSec13" id="secPay"><div class="mockPayDark dimmable" data-key="pay"><div class="mockPayDarkTitle">LGE.COM 결제 혜택</div>' + '<div class="mockEmpty" style="color:#fbbf24;text-align:center;">' + escapeHtml(_why) + "</div></div></div>";
  }
 }
 var items = splitPaymentItems(paymentFullText || "");
 if (!items.length && !_W) {
  return '<div class="mockSec mockSec13" id="secPay"><div class="mockPayDark dimmable" data-key="pay"><div class="mockPayDarkTitle">LGE.COM 결제 혜택</div>' + '<div class="mockLegalBody" style="color:#fff;">' + escapeHtml(paymentFullText) + "</div></div></div>";
 }
 var pm = _W ? payModelFromWash(_W) : payModel(paymentFullText), heroes = pm.heroes, rows = pm.rows;
 var html = '<div class="mockSec mockSec13" id="secPay"><div class="mockPayDark dimmable" data-key="pay"><div class="mockPayDarkTitle">LGE.COM 결제 혜택</div>';
 heroes.forEach(function(h, idx) {
  html += '<div class="mockPayHero2' + (idx === 0 ? " first" : "") + '"><div class="mockPayHero2Badge">' + (h.badgeNum ? '<div class="mockPayHero2BadgeNum">' + (h.badgePre ? '<span class="mockPayHero2BadgePre">' + escapeHtml(h.badgePre) + " </span>" : "") + escapeHtml(h.badgeNum) + '<span class="mockPayHero2BadgeUnit">' + escapeHtml(h.badgeUnit) + "</span></div>" : "") + '<div class="mockPayHero2BadgeLabel">' + EH(h.badgeLabel) + "</div></div>" + '<div class="mockPayHero2Body"><div><div class="mockPayHero2Title">' + EH(h.title) + "</div>" + '<div class="mockPayHero2Desc">' + (h.descLines ? h.descLines : [ h.desc ]).map(EH).join("\n") + "</div></div>" + '<div class="mockPayHero2More">자세히 보기</div></div></div>';
 });
 if (rows.length) {
  html += '<div class="mockPayRows">';
  rows.forEach(function(r) {
   var sv = r.value ? splitPayValue(r.value) : null;
   var valueHtml = "";
   if (r.seg) {
    valueHtml = '<div class="mockPayRow2Value">' + r.seg.map(function(g) {
     return escapeHtml(g.t) + '<span class="mockPayNum">' + escapeHtml(g.n) + '</span><span class="mockPayNumUnit">' + escapeHtml(g.u) + "</span>";
    }).join("") + "</div>";
   } else if (r.value) {
    valueHtml = sv ? '<div class="mockPayRow2Value">' + (sv.pre ? escapeHtml(sv.pre) + " " : "") + '<span class="mockPayNum">' + escapeHtml(sv.num) + '</span><span class="mockPayNumUnit">' + escapeHtml(sv.unit) + "</span>" + escapeHtml(sv.rest) + "</div>" : '<div class="mockPayRow2Value">' + escapeHtml(r.value) + "</div>";
   }
   var _plain = r.seg ? r.seg.map(function(g) {
    return g.t + g.n + g.u;
   }).join("") : r.value || "";
   if (_plain) {
    if (ED(_plain) !== _plain) valueHtml = '<div class="mockPayRow2Value txtEdit" contenteditable="true" spellcheck="false" data-et="' + _attr(_plain) + '">' + escapeHtml(ED(_plain)) + "</div>"; else valueHtml = valueHtml.replace('<div class="mockPayRow2Value">', '<div class="mockPayRow2Value txtEdit" contenteditable="true" spellcheck="false" data-et="' + _attr(_plain) + '">');
   }
   html += '<div class="mockPayRow2"><div class="mockPayIcon2">' + escapeHtml(r.icon) + "</div>" + '<div class="mockPayRow2Body"><div class="mockPayRow2Label">' + EH(r.label) + "</div>" + valueHtml + "" + "</div></div>";
  });
  html += "</div>";
 }
 html += "</div></div>";
 return html;
}

function getObsBaseUrl() {
 return DEFAULT_OBS_BASE;
}

var _liveRefreshTimer = null;

function scheduleLiveRefresh(e) {
 if (e && e.target && e.target.closest && e.target.closest('[contenteditable="true"]')) return;
 clearTimeout(_liveRefreshTimer);
 _liveRefreshTimer = setTimeout(function() {
  try {
   syncOptUi();
  } catch (e) {}
  renderWashVisual();
 }, 200);
}

function diffFields(prev, cur, fieldsMap) {
 var log = [];
 Object.keys(fieldsMap).forEach(function(k) {
  var pv = prev ? prev[k] || "-" : null;
  var cv = cur[k] || "-";
  if (pv === null) {
   if (cv !== "-") log.push(fieldsMap[k] + " 등록: " + cv);
  } else if (pv !== cv) log.push(fieldsMap[k] + ": " + pv + " → " + cv);
 });
 return log;
}

function diffRowsGeneric(prevRows, newRows, label) {
 var prevSet = (prevRows || []).map(function(r) {
  return r.join(" / ");
 });
 var newSet = (newRows || []).map(function(r) {
  return r.join(" / ");
 });
 var log = [];
 newSet.forEach(function(r) {
  if (prevSet.indexOf(r) === -1) log.push(label + " 추가/변경: " + r);
 });
 prevSet.forEach(function(r) {
  if (newSet.indexOf(r) === -1) log.push(label + " 삭제/이전: " + r);
 });
 return log;
}

function findIdx(text, re) {
 return text.search(re);
}

function splitParagraphs(text) {
 return text.split(/\n\s*\n/).map(function(p) {
  return p.trim();
 }).filter(Boolean);
}

function splitNumberedItems(text) {
 var lines = (text || "").split("\n");
 var items = [];
 var cur = null;
 var tag = "";
 function flush() {
  if (cur && cur.lines.join("\n").trim()) items.push({
   tag: cur.tag,
   text: cur.lines.join("\n")
  });
  cur = null;
 }
 lines.forEach(function(rawLine) {
  var line = rawLine.trim();
  if (!line) {
   flush();
   return;
  }
  var bracketMatch = line.match(/^\[(.+)\]$/);
  if (bracketMatch) {
   flush();
   tag = bracketMatch[1].trim();
   return;
  }
  var numMatch = line.match(/^(?:[0-9]+[.\)]|[-•])\s*(.*)$/);
  if (numMatch) {
   flush();
   cur = {
    tag: tag,
    lines: [ numMatch[1] ]
   };
  } else {
   if (!cur) cur = {
    tag: tag,
    lines: []
   };
   cur.lines.push(line);
  }
 });
 flush();
 for (var i = items.length - 1; i >= 1; i--) {
  if (/^(→|\*)/.test(items[i].text.trim())) {
   items[i - 1].text = items[i - 1].text + "\n" + items[i].text;
   items.splice(i, 1);
  }
 }
 return items;
}

function normalizeInlineNumberedMarkers(text) {
 return (text || "").replace(/([^\n])[ \t]+([0-9]{1,2})([.\)])[ \t]+/g, function(m, prevChar, num, punct) {
  return prevChar + "\n" + num + punct + " ";
 });
}

function normalizeSubConditionMarkers(text) {
 return (text || "").split("\n").map(function(line) {
  return line.replace(/^(\s*)ㄴ\s*/, "$1→ ");
 }).join("\n");
}

function stripExcelWrapQuotes(text) {
 return (text || "").split("\n").map(function(line) {
  var t = line.replace(/^(\s*)"(\d+[.\)])/, "$1$2");
  var quoteCount = (t.match(/"/g) || []).length;
  if (quoteCount === 1) {
   t = t.replace(/^(\s*)"/, "$1").replace(/"(\s*)$/, "$1");
  }
  return t;
 }).join("\n");
}

function simplifyGiftBreakdownDetail(s) {
 var out = (s || "").replace(/\(\s*1개당[^()]*?\/\s*([^()]+)\)/g, "($1)");
 out = out.replace(/증정\s*(?=\()/g, "");
 return out.trim();
}

var BENEFIT_LABEL_SPLIT_RE = /^(.*?(?:구매\s*고객\s*전원|구매고객\s*전원|구매\s*인증\s*시|구매\s*시|인증\s*시|응모\s*후|가입\s*시|신청\s*시|이용\s*시|결제\s*시))\s+(\S.*)$/;

function stripRedundantGift(text) {
 if (/전원\s*증정\s*$/.test(text || "")) return (text || "").trim();
 return (text || "").replace(/증정\s*(?=\()/g, "").replace(/\s*증정\s*$/, "").trim();
}

function autoSplitBenefitLabelMain(text) {
 if (!text || text.indexOf("\n") !== -1) return text;
 var m = text.match(BENEFIT_LABEL_SPLIT_RE);
 if (!m) return text;
 var label = m[1].trim();
 var main = stripRedundantGift(m[2].trim());
 if (!label || !main) return text;
 return label + "\n" + main;
}

function isEmptyPlaceholder(text) {
 var t = (text || "").trim();
 if (!t) return true;
 return /^(x|없음|해당\s*없음|해당\s*사항\s*없음|n\/?a|-|none)$/i.test(t);
}

function loadObsBank() {
 return loadData(STORE_KEY.obsBank);
}

function saveObsBank(list) {
 saveData(STORE_KEY.obsBank, list);
}

function normalizeUrlForMatch(u) {
 return (u || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function findObsBankMatch(bank, url, code) {
 if (!bank || !bank.length) return null;
 if (code) {
  var byCode = bank.filter(function(b) {
   return b.code && b.code.toUpperCase() === code.toUpperCase();
  })[0];
  if (byCode) return byCode;
 }
 var normU = normalizeUrlForMatch(url);
 if (!normU) return null;
 return bank.filter(function(b) {
  return normalizeUrlForMatch(b.url) === normU;
 })[0] || null;
}

function parseRawToStructured(rawOriginal, obsBank) {
 var empty = {
  notify: {
   gift: "",
   count: "",
   deadline: ""
  },
  liveItems: [],
  obsCards: [],
  paymentFullText: "",
  legalNotes: ""
 };
 if (!rawOriginal || !rawOriginal.trim()) return empty;
 var raw = stripExcelWrapQuotes(rawOriginal.replace(/\t/g, " ").replace(/ {2,}/g, " "));
 var idx1 = findIdx(raw, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?알림\s*신청/m);
 var idx2 = findIdx(raw, /^[ \t]*(?:(?:[0-9]+[.\)]\s*)?라이브\s*한정|[\[［]\s*라이브\s*[\]］])/m);
 var idx3 = findIdx(raw, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?(?:OBS|기획전|(?![^\n]*(?:구매|증정|쿠폰|할인|%|지급|추첨|https?:))[^\n\t]{1,25}?기획전[^\n\t]{0,15}[ \t]*$)/im);
 var idx4 = findIdx(raw, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?LGE\s*(?:닷컴|전자|\.COM)/im);
 var points = [ idx1, idx2, idx3, idx4 ].filter(function(x) {
  return x >= 0;
 });
 function sliceFrom(start) {
  if (start < 0) return "";
  var after = points.filter(function(x) {
   return x > start;
  });
  var end = after.length ? Math.min.apply(null, after) : raw.length;
  return raw.slice(start, end);
 }
 var s1 = sliceFrom(idx1), s2 = sliceFrom(idx2), s3 = sliceFrom(idx3), s4 = sliceFrom(idx4);
 var notify = {
  gift: "",
  count: "",
  deadline: ""
 };
 var mCount = s1.match(/[\(（]?\s*([0-9,]+)\s*명\s*[\)）]?(?:\s*추첨)?/);
 if (mCount) {
  var _gl = s1.slice(0, mCount.index).split("\n");
  if (_gl.length > 1) _gl.shift(); else _gl[0] = _gl[0].replace(/^\s*[0-9]+[.)]\s*알림\s*신청[^\-–—·•ㆍ\n]*?(?:판촉|이벤트)?\s*(?=[\-–—·•ㆍ])/, "");
  _gl = _gl.map(function(l) {
   return l.replace(/^[\s\-–—·•ㆍ*※▶▷]+/, "").trim();
  }).filter(Boolean);
  var _gc = _gl.filter(function(l) {
   return !/알림\s*신청|까지/.test(l);
  }), _gp = _gc.length ? _gc : _gl;
  notify.gift = (_gp[_gp.length - 1] || "").replace(/\s*증정\s*$/, "").trim();
  notify.count = mCount[1].trim() + "명";
 }
 var liveItems = [];
 var s2Body = s2.replace(/^[ \t]*(?:[\[［]\s*라이브\s*[\]］]|[^\n]*라이브\s*한정[^\n]*)\n?/, "");
 s2Body = normalizeInlineNumberedMarkers(normalizeSubConditionMarkers(s2Body));
 splitNumberedItems(s2Body).forEach(function(seg) {
  var p = seg.text.replace(/^\s*(?:[0-9]+[.\)]|[-•])\s*/, "").trim();
  if (!p) return;
  var condition = "";
  var mArrow = p.match(/→\s*([^\n]+)/);
  if (mArrow) {
   condition = mArrow[1].trim();
   p = p.replace(mArrow[0], "").trim();
  }
  var mStar = p.match(/\*[^\n]+/);
  if (mStar && /상당|추첨|[0-9]\s*명/.test(mStar[0]) && !/지급|배송|설치|까지/.test(mStar[0])) {
   p = p.replace(/\s*\n\s*(?=\*)/, " ").replace(/\s*\*\s*/, " ").replace(/[ \t]+/g, " ").trim();
   mStar = null;
  }
  if (mStar) {
   condition = (condition ? condition + " / " : "") + mStar[0].replace(/^\*/, "").trim();
   p = p.replace(mStar[0], "").trim();
  }
  var detailLines = [];
  p = p.split("\n").map(function(x) {
   return x.trim();
  }).filter(Boolean).filter(function(line) {
   var dm = line.match(/^·\s*(.*)$/);
   if (dm) {
    detailLines.push(dm[1].trim());
    return false;
   }
   return true;
  }).join("\n");
  condition = condition.replace(/\s*\n\s*/g, " ").trim();
  var pLines = p.split("\n");
  var bulletLines = pLines.slice(1);
  var isBulletBreakdown = bulletLines.length > 0 && bulletLines.every(function(l) {
   return /^[✔※]/.test(l);
  });
  if (isBulletBreakdown) {
   var groupTitle = pLines[0];
   bulletLines.forEach(function(l) {
    var stripped = l.replace(/^[✔※]️?\s*/, "");
    var bm = stripped.match(/^"?([^":]+?)"?\s*(?:소파)?\s*[:：]\s*(.+)$/);
    var itemBenefit = bm ? "[" + groupTitle + "] " + bm[1].trim() + " 소파 구매 시\n" + simplifyGiftBreakdownDetail(bm[2].trim()) : groupTitle + "\n" + stripped;
    liveItems.push({
     benefit: itemBenefit,
     condition: condition,
     tag: seg.tag || "",
     detailLines: detailLines
    });
   });
  } else {
   liveItems.push({
    benefit: autoSplitBenefitLabelMain(p),
    condition: condition,
    tag: seg.tag || "",
    detailLines: detailLines
   });
  }
 });
 liveItems = splitComboCoupons(liveItems);
 liveItems.sort(function(a, b) {
  var aLast = /GS25/i.test(a.benefit) ? 1 : 0;
  var bLast = /GS25/i.test(b.benefit) ? 1 : 0;
  return aLast - bLast;
 });
 var URL_RE = /https?:\/\/[^\s\)]+/g;
 var MD_LINK_LINE_RE = /^\s*(?:([^:\[\n]+?)\s*:\s*)?\[([^\]]*)\]\(\s*(https?:\/\/[^\s\)]+)\s*\)\s*$/;
 var PLAIN_LABEL_URL_RE = /^\s*[-•]?\s*([^:\n]+?)\s*:\s*(https?:\/\/\S+)\s*$/;
 var obsCards = [];
 var urls = [];
 var inlineTitles = {};
 var categoryByUrl = {};
 var rawTabPreserved = rawOriginal.replace(/\r\n?/g, "\n");
 var idx3Tab = findIdx(rawTabPreserved, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?(?:OBS|기획전|(?![^\n]*(?:구매|증정|쿠폰|할인|%|지급|추첨|https?:))[^\n\t]{1,25}?기획전[^\n\t]{0,15}[ \t]*$)/im);
 var idx4Tab = findIdx(rawTabPreserved, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?LGE\s*(?:닷컴|전자|\.COM)/im);
 var s3Tab = idx3Tab >= 0 ? rawTabPreserved.slice(idx3Tab, idx4Tab >= 0 && idx4Tab > idx3Tab ? idx4Tab : rawTabPreserved.length) : "";
 var obsHeadTitle = obsHeadName(s3Tab);
 s3Tab = s3Tab.replace(/^[^\n\t]*/, "");
 function stripBracketAreas(t) {
  return String(t || "").replace(/[\[［][^\]］]*[\]］](?!\s*\()/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
 }
 var CATEGORY_WORDS_RE = /^(세탁기|냉장고|김치냉장고|TV|에어컨|식기세척기|건조기|청소기|모니터|PC|노트북|스타일러|정수기|공기청정기|오븐|전자레인지|냉동고)$/i;
 var currentCategoryLabel = "";
 var inObsCategoryMode = false;
 s3Tab.split("\n").forEach(function(rawLineTab) {
  if (!rawLineTab.trim()) return;
  if (rawLineTab.indexOf("\t") === -1) {
   var rawLine = rawLineTab.replace(/\t/g, " ").replace(/ {2,}/g, " ");
   var m = rawLine.match(MD_LINK_LINE_RE);
   if (m) {
    var mdUrl = m[3];
    var label = (m[1] || "").trim() || (m[2] || "").split("|")[0].trim();
    urls.push(mdUrl);
    if (label) inlineTitles[mdUrl] = label;
    return;
   }
   var m2 = rawLine.match(PLAIN_LABEL_URL_RE);
   if (m2) {
    var plainUrl = m2[2];
    urls.push(plainUrl);
    var label2 = m2[1].trim();
    if (label2) inlineTitles[plainUrl] = label2;
    return;
   }
   var found = rawLine.match(URL_RE);
   if (found) urls = urls.concat(found);
   return;
  }
  var cols = rawLineTab.split("\t").map(function(c) {
   return c.trim();
  }).filter(Boolean);
  var urlIdx = cols.findIndex(function(c) {
   return /^https?:\/\//.test(c);
  });
  if (urlIdx === -1) return;
  var tabUrl = cols[urlIdx];
  var before = cols.slice(0, urlIdx);
  var after = cols.slice(urlIdx + 1);
  var beforeText = before.length ? stripBracketAreas(before[before.length - 1]) : "";
  var afterText = after.length ? stripBracketAreas(after[after.length - 1]) : "";
  if (beforeText) {
   inObsCategoryMode = CATEGORY_WORDS_RE.test(beforeText) || beforeText.length <= 6 && !/기획전|론칭|특가|이벤트|보상|페스타|모음|출시/.test(beforeText);
   if (inObsCategoryMode) currentCategoryLabel = beforeText;
  }
  var title = "";
  if (inObsCategoryMode) {
   title = afterText || currentCategoryLabel;
  } else if (beforeText) {
   title = beforeText;
  } else {
   title = afterText;
  }
  urls.push(tabUrl);
  if (title) inlineTitles[tabUrl] = title;
  if (inObsCategoryMode && currentCategoryLabel) categoryByUrl[tabUrl] = currentCategoryLabel;
 });
 var s3NoUrl = s3.replace(URL_RE, "").replace(/^[^\n]*(?:OBS|기획전)[^\n]*\n?/i, "");
 if (!urls.length && isEmptyPlaceholder(s3NoUrl)) {} else {
  var titleParas = splitParagraphs(s3NoUrl).map(stripBracketAreas).filter(function(p) {
   return p.length < 60 && !/수급받은|기획전\s*작성|배너\s*작성/.test(p) && !/\[.*\]\(\s*$/.test(p) && !/^[^:\n]*:\s*\[/.test(p) && !isEmptyPlaceholder(p);
  });
  var maxLen = Math.max(urls.length, titleParas.length) || 0;
  var titleIdx = 0;
  for (var i = 0; i < maxLen; i++) {
   var url = urls[i] || "";
   var code = extractEventCode(url);
   var mainTitle = "", subTitle = "";
   var bankMatch = findObsBankMatch(obsBank, url, code);
   var titleIsConfirmed = false;
   if (bankMatch) {
    mainTitle = bankMatch.copy1 || "";
    subTitle = bankMatch.copy2 || "";
    titleIsConfirmed = true;
   } else if (inlineTitles[url]) {
    mainTitle = stripBracketAreas(inlineTitles[url]);
   } else {
    var tp = titleParas[titleIdx] || "";
    titleIdx++;
    var tLines = tp.split("\n").map(function(x) {
     return x.trim();
    }).filter(Boolean);
    mainTitle = tLines[0] || "";
    subTitle = tLines[1] || "";
    if (!mainTitle && i === 0 && obsHeadTitle) mainTitle = obsHeadTitle;
   }
   obsCards.push([ code, stripBracketAreas(mainTitle), stripBracketAreas(subTitle), url ]);
  }
 }
 var paymentFullText = s4.replace(/^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?LGE\s*(?:닷컴|전자|\.COM)[^\n]*\n?/i, "");
 paymentFullText = paymentFullText.replace(/\[유의사항\][\s\S]*$/, "").trim();
 var legalMatch = s4.match(/\[유의사항\]([\s\S]*)$/);
 var legalNotes = legalMatch ? legalMatch[1].trim() : "";
 return {
  notify: notify,
  liveItems: liveItems,
  obsCards: obsCards,
  paymentFullText: paymentFullText,
  legalNotes: legalNotes
 };
}

var _WD = [ "일", "월", "화", "수", "목", "금", "토" ];

function inferYear(month, day) {
 var t = new Date, y = t.getFullYear();
 if ((t - new Date(y, month - 1, day)) / 864e5 > 180) y++;
 return y;
}

function weekdayOf(month, day) {
 return _WD[new Date(inferYear(month, day), month - 1, day).getDay()];
}

function fmtMD(month, day, wd) {
 return month + "." + day + "(" + (wd || weekdayOf(month, day)) + ")";
}

function _wdOf(y, m, d) {
 return _WD[new Date(y, m - 1, d).getDay()];
}

function normDates(text) {
 if (!text) return text;
 var re = /(?<![0-9.\/])(?:(20[0-9]{2})\s*[.\/\-년]\s*)?([0-9]{1,2})\s*([.\/월])\s*([0-9]{1,2})(?:\s*(일))?(?:\s*\(([월화수목금토일])\))?/g;
 var TM = /^\s*(?:오전|오후)?\s*[0-9]{1,2}\s*시(?:\s*[0-9]{1,2}\s*분)?/;
 var toks = [], m;
 while (m = re.exec(text)) {
  var mo = Number(m[2]), da = Number(m[4]);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) continue;
  var yy = m[1] ? Number(m[1]) : inferYear(mo, da);
  toks.push({
   s: m.index,
   e: m.index + m[0].length,
   y: yy,
   m: mo,
   d: da,
   wd: m[6] || "",
   mark: m[3] === "월" || !!m[5] || !!m[6]
  });
 }
 if (!toks.length) return text;
 function timeAfter(pos) {
  var t = text.slice(pos).match(TM);
  return t ? t[0] : "";
 }
 function ctxOK(pos) {
  return /^\s*(?:까지|부터|내(?![가-힣])|이후|이전|~|오전|오후|[0-9]{1,2}\s*시|[,)\]]|$)/.test(text.slice(pos));
 }
 function one(t, withYear) {
  return (withYear ? t.y + "." : "") + t.m + "." + t.d + "(" + (t.wd || _wdOf(t.y, t.m, t.d)) + ")";
 }
 var out = "", cur = 0, i = 0;
 while (i < toks.length) {
  var t = toks[i], tm1 = timeAfter(t.e), e1 = t.e + tm1.length, t2 = toks[i + 1];
  var isRange = t2 && /^\s*~\s*$/.test(text.slice(e1, t2.s));
  if (isRange) {
   var tm2 = timeAfter(t2.e), e2 = t2.e + tm2.length;
   if (t.mark || t2.mark || ctxOK(e2)) {
    var rest = text.slice(e2).match(/^\s*까지/);
    var end = rest ? e2 + rest[0].length : e2, wy = t.y !== t2.y;
    out += text.slice(cur, t.s) + one(t, wy) + tm1.replace(/^\s*/, tm1 ? " " : "") + " ~ " + one(t2, wy) + tm2.replace(/^\s*/, tm2 ? " " : "");
    cur = end;
    i += 2;
    continue;
   }
  }
  if (t.mark || tm1 || ctxOK(t.e)) {
   out += text.slice(cur, t.s) + one(t, false);
   cur = t.e;
  }
  i++;
 }
 return out + text.slice(cur);
}

function parseDateFromCaseName(name) {
 if (!name) return null;
 var m = name.match(/([0-9]{1,2})\s*[\/\.\-]\s*([0-9]{1,2})(?![0-9\/\.])/);
 if (m) return {
  month: Number(m[1]),
  day: Number(m[2])
 };
 m = name.match(/([0-9]{1,2})\s*월\s*([0-9]{1,2})\s*일/);
 if (m) return {
  month: Number(m[1]),
  day: Number(m[2])
 };
 return null;
}

function computeDeadlineFromCaseName(name) {
 var d = parseDateFromCaseName(name);
 if (!d) return "";
 return fmtMD(d.month, d.day) + " 오후 3시까지";
}

var HID_PRESETS = {
 it: "화제의 LG IT 제품 총집합",
 lgAll: "남다르게 LG 가전"
};

var HID_TOTAL = [ "LGE.COM 라이브", "BEST 가전 큐레이션" ];

var HID_NOISE_RE = /(?:^|\s)(?:첫|신제품|런칭|오픈|단독|특별|스페셜|1차|2차)(?=\s|$)/g;

var HID_PROD_RE = /김치냉장고|냉장고|세탁기|건조기|에어컨|식기세척기|스타일러|청소기|정수기|인덕션|오븐|TV/g;

function hidAutoMains() {
 var name = (document.getElementById("case_name") || {}).value || "";
 var ev = eventFromCaseName(name);
 if (ev) return [ unifyProdSep(ev) + " 특집" ];
 var p = stripCaseParens(name).replace(/[0-9]{1,2}\s*[\/\.\-]\s*[0-9]{1,2}(?![0-9\/\.])/, "").replace(/[\(\[]?\s*재방송\s*[\)\]]?/g, " ").replace(/남다르게|라이브/g, " ");
 p = p.replace(HID_NOISE_RE, " ").replace(/\s+/g, " ").trim();
 var found = [], m, first = -1;
 HID_PROD_RE.lastIndex = 0;
 while (m = HID_PROD_RE.exec(p)) {
  if (first < 0) first = m.index;
  if (found.indexOf(m[0]) < 0) found.push(m[0]);
 }
 if (found.length >= 2) {
  var prefix = p.slice(0, first).replace(/[&＆·,，\/]/g, " ").replace(/\s+/g, " ").trim();
  return found.map(function(x) {
   return (prefix ? prefix + " " : "") + x + " 특집";
  });
 }
 p = unifyProdSep(p);
 return p ? [ p + " 라이브" ] : [];
}

function hidAutoMain() {
 return hidAutoMains()[0] || "";
}

function hidKeyOf(pv) {
 var h = pv.opts && pv.opts.hid || "auto";
 return HID_PRESETS[h] ? h : "auto";
}

function isHidRow(r) {
 return r[4] === "hidden" || r[4] === "hidden2";
}

var FRIDGE_OBS_CARD = [ "PE01034003", "Fit & Max 냉장고, 김치냉장고", "우리집 주방에 맞는 조합을 확인해보세요", "https://www.lge.co.kr/benefits/exhibitions/detail-PE01034003", "fixed" ];

function defaultOpts(name) {
 return {
  rebro: /재방송/.test(name || ""),
  orig: "",
  viewers: "",
  fridge: "auto",
  air: "",
  cook: "auto",
  cookHead: "",
  cookRates: "",
  cookProds: "",
  paySheet: "",
  bdate: "",
  obsEdit: "",
  hid: "auto",
  hidUrl: "",
  hidTotal: false,
  hidUrl2: "",
  payInh: true,
  txtEdit: "",
  kv: "",
  addLive: "",
  addObs: "",
  liveIcon: "",
  bn: "",
  hide: "",
  payMode: "",
  payDate: "",
  order: ""
 };
}

function collectOpts() {
 var cb = document.getElementById("opt_rebro"), o = document.getElementById("opt_orig"), v = document.getElementById("opt_view"), f = document.getElementById("opt_fridge");
 function gv(id) {
  var e = document.getElementById(id);
  return e ? e.value.trim() : "";
 }
 return {
  rebro: !!(cb && cb.checked),
  orig: o ? o.value.trim() : "",
  viewers: v ? v.value.trim() : "",
  fridge: f ? f.value : "auto",
  air: gv("opt_air"),
  cook: (document.getElementById("opt_cook") || {}).value || "auto",
  cookHead: gv("opt_cookhead"),
  cookRates: (document.getElementById("opt_cookrates") || {}).value ? document.getElementById("opt_cookrates").value.trim() : "",
  cookProds: gv("opt_cookprods"),
  paySheet: (document.getElementById("opt_paysheet") || {}).value ? document.getElementById("opt_paysheet").value.trim() : "",
  bdate: gv("opt_bdate"),
  obsEdit: gv("opt_obsedit"),
  hid: (document.getElementById("opt_hid") || {}).value || "auto",
  hidUrl: gv("opt_hidurl"),
  hidTotal: !!(document.getElementById("chk_hidtotal") || {}).checked,
  hidUrl2: gv("opt_hidurl2"),
  payInh: (document.getElementById("chk_payinh") || {
   checked: true
  }).checked,
  txtEdit: gv("opt_txtedit"),
  kv: gv("opt_kv"),
  addLive: gv("opt_addlive"),
  addObs: gv("opt_addobs"),
  liveIcon: gv("opt_liveicon"),
  bn: gv("opt_bn"),
  hide: gv("opt_hide"),
  payMode: gv("opt_paymode"),
  payDate: gv("opt_paydate"),
  order: gv("opt_order")
 };
}

function setOptsUi(opts) {
 var o = opts || {};
 document.getElementById("opt_rebro").checked = !!o.rebro;
 document.getElementById("opt_orig").value = o.orig || "";
 document.getElementById("opt_view").value = o.viewers || "";
 document.getElementById("opt_fridge").value = o.fridge || "auto";
 document.getElementById("opt_air").value = o.air || "";
 document.getElementById("opt_cook").value = o.cook || "auto";
 document.getElementById("opt_cookhead").value = o.cookHead || "";
 document.getElementById("opt_cookrates").value = o.cookRates || "";
 document.getElementById("opt_cookprods").value = o.cookProds || "";
 var _ps = document.getElementById("opt_paysheet");
 if (_ps) _ps.value = o.paySheet || "";
 var _bd = document.getElementById("opt_bdate");
 if (_bd) _bd.value = o.bdate || "";
 var _oe = document.getElementById("opt_obsedit");
 if (_oe) _oe.value = o.obsEdit || "";
 [ "txtedit:txtEdit", "kv:kv", "addlive:addLive", "addobs:addObs", "liveicon:liveIcon", "bn:bn", "hide:hide", "paymode:payMode", "paydate:payDate", "order:order" ].forEach(function(x) {
  var q = x.split(":"), e = document.getElementById("opt_" + q[0]);
  if (e) e.value = o[q[1]] || "";
 });
 var _hs = document.getElementById("opt_hid");
 if (_hs) _hs.value = {
  it: 1,
  lgAll: 1
 }[o.hid] ? o.hid : "auto";
 var _ht = document.getElementById("chk_hidtotal");
 if (_ht) _ht.checked = !!o.hidTotal || o.hid === "total";
 var _hu2 = document.getElementById("opt_hidurl2");
 if (_hu2) _hu2.value = o.hidUrl2 || "";
 var _pi = document.getElementById("chk_payinh");
 if (_pi) _pi.checked = o.payInh !== false;
 var _hu = document.getElementById("opt_hidurl");
 if (_hu) _hu.value = o.hidUrl || "";
 syncOptUi();
}

function syncAddRow() {
 var ck = document.getElementById("chk_cook"), fr = document.getElementById("chk_fridge");
 if (!ck || !fr) return;
 var pv;
 try {
  pv = collectFormValues();
 } catch (e) {
  return;
 }
 var oc = pv.opts && pv.opts.cook || "auto", of = pv.opts && pv.opts.fridge || "auto";
 ck.checked = cookOn(pv);
 fr.checked = fridgeOn(pv);
 var note = document.getElementById("addNote"), btn = document.getElementById("addAuto");
 if (note) note.textContent = oc !== "auto" || of !== "auto" ? "쿠킹·냉장고: 직접 선택 중" : '쿠킹: 방송명 "쿠킹·주방가전" + 주방가전 2종 이상일 때 자동 · 냉장고: 판촉 내용으로 자동';
 var h2 = document.getElementById("chk_hidtotal"), w2 = document.getElementById("hidUrl2Wrap");
 if (w2) w2.style.display = h2 && h2.checked ? "" : "none";
 if (btn) btn.style.display = oc !== "auto" || of !== "auto" ? "" : "none";
}

function resetAddAuto() {
 [ "opt_cook", "opt_fridge" ].forEach(function(id) {
  var e = document.getElementById(id);
  if (e) e.value = "auto";
 });
 var e = document.getElementById("opt_cook");
 if (e) e.dispatchEvent(new Event("change", {
  bubbles: true
 }));
}

function onAddCheck(which, el) {
 var s = document.getElementById(which === "cook" ? "opt_cook" : "opt_fridge");
 if (!s) return;
 s.value = el.checked ? "on" : "off";
 s.dispatchEvent(new Event("change", {
  bubbles: true
 }));
}

function syncOptUi() {
 var on = !!(document.getElementById("opt_rebro") || {}).checked;
 var box = document.getElementById("rebroFields");
 if (box) box.style.display = on ? "inline-flex" : "none";
 var tab = document.getElementById("tabRebro");
 if (tab) tab.style.display = on ? "" : "none";
 syncAddRow();
}

function fridgeOn(pv) {
 var f = pv.opts && pv.opts.fridge || "auto";
 if (f === "on") return true;
 if (f === "off") return false;
 var name = (document.getElementById("case_name") || {}).value || "";
 return /냉장고|냉세|결산/.test(name) || /냉장고/.test(pv.rawText || "");
}

function obsShowCards(pv) {
 var cards = (pv.obsCards || []).slice();
 if (fridgeOn(pv) && !cards.some(function(r) {
  return r[0] === FRIDGE_OBS_CARD[0] || /PE01034003/.test(r[3] || "");
 })) cards.push(FRIDGE_OBS_CARD.slice());
 var ed = {};
 try {
  ed = JSON.parse(pv.opts && pv.opts.obsEdit || "{}") || {};
 } catch (e) {
  ed = {};
 }
 var out = cards.map(function(r, i) {
  var c = r.slice(), k = obsKeyOf(r, i), e = ed[k] || {};
  c._o = [ r[1] || "", r[2] || "" ];
  c._k = k;
  if (e.m !== undefined) c[1] = e.m;
  if (e.s !== undefined) c[2] = e.s;
  return c;
 });
 var o2 = pv.opts || {};
 var _ad = jparse(o2.addObs, []) || [], _fi = -1;
 out.forEach(function(r, ix) {
  if (r[4] === "fixed") _fi = ix;
 });
 var _rows = _ad.map(function(a, j) {
  var k = "add:" + j, e = ed[k] || {}, c = [ "", e.m !== undefined ? e.m : "", e.s !== undefined ? e.s : "", a && a.u || "", "added" ];
  c._o = [ "", "" ];
  c._k = k;
  c._ai = j;
  return c;
 });
 if (_rows.length) {
  if (_fi >= 0) out.splice.apply(out, [ _fi, 0 ].concat(_rows)); else out = out.concat(_rows);
 }
 if (o2.hidTotal || o2.hid === "total") {
  var te = ed["hid:total"] || {};
  var tc = [ "", te.m !== undefined ? te.m : HID_TOTAL[0], te.s !== undefined ? te.s : HID_TOTAL[1], o2.hidUrl2 || "", "hidden2" ];
  tc._o = [ HID_TOTAL[0], HID_TOTAL[1] ];
  tc._k = "hid:total";
  out.unshift(tc);
 }
 var hk = hidKeyOf(pv), ps = o2.rebro ? "재방송 제품이 궁금하다면?" : "라이브 제품이 궁금하다면?";
 var mains = HID_PRESETS[hk] ? [ HID_PRESETS[hk] ] : hidAutoMains();
 if (!mains.length) mains = [ "" ];
 var pcs = mains.map(function(pm, idx) {
  var kk = "hid:" + hk + (idx ? ":" + (idx + 1) : ""), pe = ed[kk] || {};
  var pc = [ "", pe.m !== undefined ? pe.m : pm, pe.s !== undefined ? pe.s : ps, idx ? "" : o2.hidUrl || "", "hidden" ];
  pc._o = [ pm, ps ];
  pc._k = kk;
  pc._hn = idx ? String(idx + 1) : "";
  return pc;
 });
 out.unshift.apply(out, pcs);
 return out;
}

function obsKeyOf(r, i) {
 return (r[0] || r[3] || "idx:" + i) + "";
}

function commitObsEdit(el) {
 var f = el.getAttribute("data-obs"), key = el.getAttribute("data-okey"), orig = el.getAttribute("data-orig") || "";
 var v = (el.innerText || "").replace(/\u00a0/g, " ").replace(/\s*\n\s*/g, " ").trim();
 var box = document.getElementById("opt_obsedit");
 if (!box) return;
 var ed = {};
 try {
  ed = JSON.parse(box.value || "{}") || {};
 } catch (e) {
  ed = {};
 }
 var cur = ed[key] || {}, fk = f === "main" ? "m" : "s";
 var prevV = cur[fk] !== undefined ? cur[fk] : orig;
 if (v === prevV) return;
 if (v === orig) delete cur[fk]; else cur[fk] = v;
 if (Object.keys(cur).length) ed[key] = cur; else delete ed[key];
 box.value = Object.keys(ed).length ? JSON.stringify(ed) : "";
 box.dispatchEvent(new Event("input", {
  bubbles: true
 }));
}

function rebroTexts(pv) {
 var o = pv.opts || {};
 var date = o.orig ? normDates(o.orig.replace(/^\s*([0-9]{1,2}\s*[.\/]\s*[0-9]{1,2})\s*$/, "$1")) : "";
 var v = (o.viewers || "").trim(), vt = "00.0명";
 var m = v.match(/([0-9]+(?:\.[0-9]+)?)/);
 if (m) {
  vt = /명/.test(v) && !/만/.test(v) ? m[1] + "명" : m[1] + "만명";
 }
 return {
  title: "본방 사수 열기 그대로\n재방송에서도 이어집니다",
  date: date,
  eyebrow: (date || "(본방송 일자 미입력)") + " 남다르게 라이브",
  big: "실시간 시청 " + vt + " 돌파!",
  viewersEmpty: !m
 };
}

function rebroIconSvg() {
 return '<svg class="mockIconSvg" width="68" height="68" viewBox="0 0 68 68" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + '<ellipse cx="38" cy="58" rx="16" ry="2.6" fill="#000" opacity=".18"/>' + '<path d="M14 54 L26 22 Q28 18 32 20 L48 34 Q51 37 47 40 Z" fill="#E8332F"/>' + '<path d="M14 54 L26 22 Q28 18 32 20 L48 34 Q51 37 47 40 Z" fill="none" stroke="#B3201D" stroke-width="1"/>' + '<path d="M18.8 41.2 L27.2 47.6" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M22.4 31.6 L37.1 42.8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' + '<circle cx="46" cy="16" r="2.4" fill="#F28BB0"/><path d="M14 18 q4 -3 6 2" stroke="#F28BB0" stroke-width="1.6" fill="none" stroke-linecap="round"/>' + '<path d="M26 12 l1.8 3.6 4 .6 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.6z" fill="#F7B8CB" transform="translate(-6 -2) scale(.8)"/>' + '<path d="M54 26 q5 -1 6 4" stroke="#F28BB0" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M12 34 q-3 3 0 6" stroke="#F28BB0" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
}

function renderRebroSection(pv) {
 var t = rebroTexts(pv);
 return '<div class="mockSec mockSecRebro" id="secRebro"><div class="mockRebroCard dimmable" data-key="rebro">' + '<div class="mockTitle">' + t.title.split("\n").map(EH).join("<br>") + "</div>" + '<div class="mockRebroBox"><div class="mockRebroImg">' + rebroIconSvg() + '</div><div class="mockRebroText">' + '<div class="mockRebroEyebrow">' + EH(t.eyebrow) + (t.date ? "" : '<span class="missChip reviewOnly">본방송 일자 미입력</span>') + "</div>" + '<div class="mockRebroBig">' + EH(t.big) + (t.viewersEmpty ? '<span class="missChip reviewOnly">시청자 수 미입력(00.0명)</span>' : "") + "</div>" + "</div></div></div></div>";
}

function collectFormValues() {
 var rawText = document.getElementById("pv_raw").value;
 var _cut = function() {
  var o = collectOpts();
  if ((o.paySheet || "").trim()) return -1;
  return rawText.search(/^[ \t]*1\.[ \t]*결제일[ \t]*할인/m);
 }();
 var parsed = applyHidden(parseRawToStructured(_cut > 0 ? rawText.slice(0, _cut) : rawText, loadObsBank()), collectOpts());
 var caseNameEl = document.getElementById("case_name");
 parsed.notify.deadline = computeDeadlineFromCaseName(caseNameEl ? caseNameEl.value : "");
 var sourceEl = document.getElementById("pv_source");
 var _optsNow = collectOpts();
 LIVE_DEF_LABEL = liveDefaultLabel(caseNameEl ? caseNameEl.value : "", (jparse(_optsNow.kv, {}) || {}).m);
 var _pvOut = {
  notify: parsed.notify,
  liveItems: parsed.liveItems,
  obsCards: parsed.obsCards,
  paymentFullText: parsed.paymentFullText,
  legalNotes: parsed.legalNotes,
  rawText: rawText,
  sourceChannel: sourceEl ? sourceEl.value : "",
  opts: _optsNow
 };
 _pvOut.obsShow = obsShowCards(_pvOut);
 applyCardOrder(_pvOut);
 return _pvOut;
}

function computeChanges(prev, cur) {
 var changes = [];
 changes = changes.concat(diffFields(prev ? prev.notify : null, cur.notify, {
  gift: "알림신청 사은품",
  count: "알림신청 인원"
 }));
 var liveRows = cur.liveItems.map(function(it) {
  return [ it.benefit, it.condition ];
 });
 changes = changes.concat(diffRowsGeneric(prev ? (prev.liveItems || []).map(function(it) {
  return [ it.benefit, it.condition ];
 }) : [], liveRows, "라이브한정 판촉"));
 changes = changes.concat(diffRowsGeneric(prev ? prev.obsCards : [], cur.obsCards, "OBS카드"));
 if (prev && prev.paymentFullText !== cur.paymentFullText) changes.push("결제혜택/유의사항 원문 변경");
 var po = prev && prev.opts || defaultOpts(""), co = cur.opts || po;
 if (po.rebro !== co.rebro) changes.push("재방송 영역 " + (co.rebro ? "추가" : "제거"));
 if (co.rebro && (po.orig !== co.orig || po.viewers !== co.viewers)) changes.push("재방송 본방송 일자/시청자 수 변경");
 if ((po.fridge || "auto") !== (co.fridge || "auto")) changes.push("냉장고 고정 OBS 배너 설정 변경");
 if ((po.air || "") !== (co.air || "")) changes.push("방송 시간 변경");
 if ((po.cook || "auto") !== (co.cook || "auto") || (po.cookHead || "") !== (co.cookHead || "") || (po.cookRates || "") !== (co.cookRates || "") || (po.cookProds || "") !== (co.cookProds || "")) changes.push("쿠킹 기획전 안내(할인률·제품) 변경");
 if ((po.paySheet || "") !== (co.paySheet || "")) changes.push("결제혜택 수급 원문 변경");
 if ((po.obsEdit || "") !== (co.obsEdit || "")) changes.push("OBS 배너 카피 직접 수정");
 if ((po.txtEdit || "") !== (co.txtEdit || "")) changes.push("워싱본 문구 직접 수정");
 if ((po.kv || "") !== (co.kv || "")) changes.push("KV 문구 수정");
 if ((po.addLive || "") !== (co.addLive || "")) changes.push("한정 혜택 직접 추가/수정");
 if ((po.addObs || "") !== (co.addObs || "")) changes.push("OBS 배너 직접 추가");
 if ((po.liveIcon || "") !== (co.liveIcon || "")) changes.push("한정 혜택 아이콘 선택 변경");
 if ((po.bdate || "") !== (co.bdate || "")) changes.push("방송일(결제혜택 기간 판정용) 변경");
 if ((po.hid || "auto") !== (co.hid || "auto") || !!po.hidTotal !== !!co.hidTotal) changes.push("히든 기획전 배너 설정 변경");
 if ((po.payMode || "") !== (co.payMode || "") || (po.payDate || "") !== (co.payDate || "")) changes.push("결제혜택·유의사항 반영 기준 변경" + (co.payMode === "prev" ? "(직전 라이브와 동일)" : co.payMode === "date" ? "(반영 일자 " + (co.payDate || "-") + ")" : "(판촉안·방송일 기준)"));
 if ((po.order || "") !== (co.order || "")) changes.push("한정 혜택/OBS 카드 순서 변경");
 if ((po.hide || "") !== (co.hide || "")) changes.push("한정 혜택/OBS 카드 삭제·되돌리기");
 if (po.payInh !== false !== (co.payInh !== false)) changes.push("결제혜택 직전 라이브 이어받기 " + (co.payInh !== false ? "켬" : "끔"));
 if (prev && prev.banner && cur.banner) { var _bc = bannerDiffNames(prev.banner, cur.banner); if (_bc.length) changes.push("배너 카피 변경: " + _bc.join(", ")); }
 if ((po.bn || "") !== (co.bn || "")) changes.push("배너 제품군·할인율/직접 수정 변경");
 return changes;
}

var COOK_DEFAULT_RATES = "13%: 인덕션, 식기세척기\n10%: 냉장고, 광파오븐";

var COOK_DEFAULT_PRODS = "냉장고, 김치냉장고, 인덕션, 광파오븐, 식기세척기";

function _isDiscountCoupon(b) {
 return /쿠폰/.test(b || "") && !/상품권|기프티콘|스타벅스|투썸|커피|네이버/.test(b || "");
}

function couponInfo(pv) {
 var items = (pv.liveItems || []).map(function(it) {
  return isGs25(it.benefit) ? "" : splitBenefit(it.benefit || "").main;
 }).filter(_isDiscountCoupon);
 var info = {
  has: items.length > 0,
  appOnly: false,
  expr: "",
  extra: items.some(function(t) {
   return /추가\s*할인\s*쿠폰/.test(t);
  })
 };
 if (!info.has) return info;
 var rows = items.map(function(t) {
  var pm = t.match(/([0-9]+(?:\.[0-9]+)?)\s*%/), am = t.match(/([0-9][0-9,]*)\s*만\s*원/), wm = t.match(/([0-9][0-9,]*)\s*원/);
  var won = am ? Number(am[1].replace(/,/g, "")) * 1e4 : wm ? Number(wm[1].replace(/,/g, "")) : 0;
  return {
   t: t,
   pct: pm ? parseFloat(pm[1]) : 0,
   won: won,
   mx: /최대/.test(t),
   app: /앱전용/.test(t)
  };
 });
 var pcts = rows.filter(function(r) {
  return r.pct > 0;
 }), wons = rows.filter(function(r) {
  return r.won > 0;
 });
 var pool = pcts.length ? pcts : wons;
 if (pool.length) {
  var key = pcts.length ? "pct" : "won";
  var best = pool.reduce(function(m, r) {
   return r[key] > m[key] ? r : m;
  }, pool[0]);
  var many = pool.length > 1 || pool.some(function(r) {
   return r.mx;
  });
  var val = pcts.length ? best.pct + "%" : best.won % 1e4 === 0 ? best.won / 1e4 + "만원" : best.won.toLocaleString("ko-KR") + "원";
  info.expr = (many ? "최대 " : "") + val;
  info.appOnly = pool.filter(function(r) {
   return r[key] === best[key];
  }).some(function(r) {
   return r.app;
  });
 } else info.appOnly = rows.some(function(r) {
  return r.app;
 });
 return info;
}

function _airHour(o) {
 var t = (o || "").trim();
 if (!t) return 20;
 var h = hour24(/시/.test(t) ? t : t.replace(/[^0-9]/g, "") + "시");
 return h === null ? 20 : h;
}

function airInfo(pv, ov) {
 var md = "", hour = 20;
 if (ov) {
  md = ov.md || "";
  hour = ov.hour === null || ov.hour === undefined ? 20 : ov.hour;
 } else {
  var name = (document.getElementById("case_name") || {}).value || "";
  var d = parseDateFromCaseName(name);
  md = d ? fmtMD(d.month, d.day) : "";
  hour = _airHour(pv.opts && pv.opts.air);
 }
 return {
  md: md || "0.0(요일)",
  hour: hour
 };
}

function _legacyCat(pv) {
 return (pv.liveItems || []).filter(function(it) {
  return (it.detailLines || []).length;
 })[0];
}

var COOK_KW_RE = /주방가전|쿠킹|냉장고|김치냉장고|광파오븐|오븐|식기세척기|인덕션|전기레인지/;

var KITCHEN_TOK = [ "김치냉장고", "냉장고", "인덕션", "광파오븐", "전기레인지", "식기세척기", "오븐" ];

function cookRatesFromRaw(pv) {
 var map = {};
 (pv.liveItems || []).forEach(function(it) {
  var sp = splitBenefit(it.benefit), pm = (sp.main || "").match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  if (!pm) return;
  var toks = (sp.isDefault ? "" : sp.label || "").split(/[,，、·\/]|\s+/).map(function(t) {
   return t.trim();
  }).filter(function(t) {
   return KITCHEN_TOK.indexOf(t) >= 0;
  });
  if (!toks.length) return;
  var k = parseFloat(pm[1]);
  map[k] = map[k] || [];
  toks.forEach(function(t) {
   if (map[k].indexOf(t) < 0) map[k].push(t);
  });
 });
 return Object.keys(map).map(Number).sort(function(a, b) {
  return b - a;
 }).map(function(k) {
  return k + "%: " + map[k].join(", ");
 });
}

var COOK_NAME_RE = /쿠킹|주방\s*가전/;

function kitchenProdCount(pv) {
 var t = (pv.liveItems || []).map(function(it) {
  return (it.benefit || "") + " " + (it.detailLines || []).join(" ");
 }).join(" "), n = 0;
 KITCHEN_TOK.forEach(function(k) {
  if (t.indexOf(k) >= 0) {
   n++;
   t = t.split(k).join(" ");
  }
 });
 return n;
}

function cookOn(pv) {
 var c = pv.opts && pv.opts.cook || "auto";
 if (c === "on") return true;
 if (c === "off") return false;
 var name = (document.getElementById("case_name") || {}).value || "";
 if (!COOK_NAME_RE.test(name)) return false;
 return kitchenProdCount(pv) >= 2 || !!_legacyCat(pv);
}

function cookParts(pv) {
 var o = pv.opts || {}, ci = couponInfo(pv), cat = _legacyCat(pv), used = [];
 var rates = (o.cookRates || "").split("\n").map(function(l) {
  return l.replace(/^\s*[-–·]\s*/, "").trim();
 }).filter(Boolean);
 var derived = false;
 if (!rates.length && cat) rates = cat.detailLines.filter(function(l) {
  return /%\s*[:：]/.test(l);
 }).map(function(l) {
  return l.replace(/^\s*[-–]\s*/, "").trim();
 });
 if (!rates.length) {
  rates = cookRatesFromRaw(pv);
  if (rates.length) {
   derived = true;
   used.push("할인률은 원문 기반 추정");
  }
 }
 if (!rates.length) {
  rates = COOK_DEFAULT_RATES.split("\n");
  used.push("할인률 예시값");
 }
 var expr = ci.expr;
 if (derived) {
  var mx = Math.max.apply(null, rates.map(function(l) {
   return parseFloat(l);
  }).filter(function(n) {
   return !isNaN(n);
  }));
  if (isFinite(mx)) expr = "최대 " + mx + "%";
 }
 var autoHead = "LG 주방가전 " + (expr ? expr + " " : "") + (ci.appOnly ? "앱전용 " : "") + "할인 쿠폰";
 var head = o.cookHead || autoHead;
 var prods = (o.cookProds || "").replace(/^\s*구매\s*인증\s*혜택\s*대상\s*제품\s*[:：]\s*/, "").trim();
 if (!prods && cat) {
  var pl = cat.detailLines.filter(function(l) {
   return /대상\s*제품/.test(l);
  })[0];
  if (pl) prods = pl.replace(/^.*?대상\s*제품\s*[:：]\s*/, "").trim();
 }
 if (!prods) {
  prods = COOK_DEFAULT_PRODS;
  used.push("대상 제품 예시값");
 }
 return {
  head: head,
  autoHead: autoHead,
  rates: rates,
  prods: prods,
  defaultsUsed: used
 };
}

function computeLiveDisclaimerLines(pv, airOv) {
 var lines = [], ci = couponInfo(pv), cook = cookOn(pv);
 if (ci.has) {
  var ai = airInfo(pv, airOv);
  lines.push("라이브 " + (ci.expr ? ci.expr + " " : "") + (ci.appOnly ? "앱전용 " : ci.extra ? "추가 " : "") + "할인 쿠폰은 " + ai.md + " " + ai.hour + "시부터 사용 가능합니다.");
 }
 var cp = cook ? cookParts(pv) : null;
 if (cp) {
  lines.push(cp.head);
  cp.rates.forEach(function(r) {
   lines.push("- " + r);
  });
 }
 var hasApp = (pv.liveItems || []).some(function(it) {
  return /앱전용/.test(it.benefit || "");
 }) || cp && /앱전용/.test(cp.head);
 if (hasApp) {
  lines.push("앱전용 할인 쿠폰은 타 쿠폰과 중복 사용 불가");
  lines.push("(쿠폰별로 중복 사용 가능 여부가 다를 수 있습니다.)");
 }
 if (cp) lines.push("구매 인증 혜택 대상 제품: " + cp.prods);
 lines.push("혜택 지급 관련 상세내용은 하단 유의사항 참고");
 return lines.map(normDates);
}

function _attr(x) {
 return escapeHtml(String(x)).replace(/"/g, "&quot;").replace(/\n/g, "&#10;");
}

function liveDisclaimerHtml(pv) {
 var lines = computeLiveDisclaimerLines(pv);
 if (!lines.length) return "";
 var cook = cookOn(pv), cp = cook ? cookParts(pv) : null;
 var headN = cp ? normDates(cp.head) : null, PROD = "구매 인증 혜택 대상 제품: ";
 var html = '<div class="mockCaptionList">' + groupCaptionLines(lines).map(function(g) {
  var inner;
  if (cp && g[0] === headN) {
   inner = '<span class="cookEdit" contenteditable="true" spellcheck="false" data-cook="head" data-orig="' + _attr(cp.head) + '">' + escapeHtml(cp.head) + "</span>" + '<span class="capSub cookEdit" contenteditable="true" spellcheck="false" data-cook="rates" data-orig="' + _attr(cp.rates.join("\n")) + '">' + cp.rates.map(function(r) {
    return escapeHtml("- " + r);
   }).join("<br>") + "</span>";
   g.slice(1).forEach(function(x) {
    if (!/^- /.test(x)) inner += '<span class="capSub">' + escapeHtml(x) + "</span>";
   });
  } else if (cp && g[0].indexOf(PROD) === 0) {
   inner = escapeHtml(PROD) + '<span class="cookEdit" contenteditable="true" spellcheck="false" data-cook="prods" data-orig="' + _attr(cp.prods) + '">' + escapeHtml(cp.prods) + "</span>";
  } else {
   inner = g.map(function(x, gi) {
    return gi ? '<span class="capSub">' + EH(x) + "</span>" : EH(x);
   }).join("");
  }
  return '<div class="mockCaption mockDisclaimer"><span>' + inner + "</span></div>";
 }).join("") + "</div>";
 if (cp) {
  html += '<div class="reviewOnly" style="margin-top:6px;font-size:11px;color:#6b7280;">쿠킹 기획전 안내 — 점선 영역을 클릭해 할인 문구·할인률·대상 제품을 바로 수정할 수 있습니다.' + (cp.defaultsUsed.length ? ' <span class="missChip">' + escapeHtml(cp.defaultsUsed.join(" · ")) + " 사용 중 — 확인 필요</span>" : "") + "</div>";
 }
 return html;
}

function commitCookEdit(el) {
 var k = el.getAttribute("data-cook"), orig = el.getAttribute("data-orig") || "";
 var v = (el.innerText || "").replace(/\u00a0/g, " ").trim();
 if (k === "rates") v = v.split("\n").map(function(l) {
  return l.replace(/^\s*[-–·]\s*/, "").trim();
 }).filter(Boolean).join("\n");
 if (k === "prods") v = v.replace(/\s*\n\s*/g, " ").replace(/^\s*구매\s*인증\s*혜택\s*대상\s*제품\s*[:：]\s*/, "").trim();
 if (k === "head") v = v.replace(/\s*\n\s*/g, " ");
 if (v === orig) return;
 var id = {
  head: "opt_cookhead",
  rates: "opt_cookrates",
  prods: "opt_cookprods"
 }[k], f = document.getElementById(id);
 if (!f) return;
 if (k === "head") {
  try {
   if (v === cookParts(collectFormValues()).autoHead) v = "";
  } catch (e) {}
 }
 f.value = v;
 f.dispatchEvent(new Event("input", {
  bubbles: true
 }));
}

document.addEventListener("focusout", function(e) {
 var t = e.target;
 if (!(t && t.getAttribute)) return;
 if (t.getAttribute("data-cook")) commitCookEdit(t);
 if (t.getAttribute("data-obs")) commitObsEdit(t);
 if (t.getAttribute("data-et") !== null && t.classList.contains("txtEdit")) commitTxtEdit(t);
 if (t.getAttribute("data-kv")) commitKv(t);
 if (t.getAttribute("data-add")) commitAddLive(t);
});

document.addEventListener("keydown", function(e) {
 var t = e.target;
 if (t && t.getAttribute && t.getAttribute("data-cook") && e.key === "Enter" && t.getAttribute("data-cook") !== "rates") {
  e.preventDefault();
  t.blur();
 }
 if (t && t.getAttribute && t.getAttribute("data-obs") && e.key === "Enter") {
  e.preventDefault();
  t.blur();
 }
 if (t && t.getAttribute && (t.getAttribute("data-et") !== null || t.getAttribute("data-kv") || t.getAttribute("data-add")) && e.key === "Enter") {
  e.preventDefault();
  t.blur();
 }
});

document.addEventListener("paste", function(e) {
 var t = e.target;
 if (t && t.getAttribute && (t.getAttribute("data-cook") || t.getAttribute("data-obs") || t.getAttribute("data-et") !== null || t.getAttribute("data-kv") || t.getAttribute("data-add"))) {
  e.preventDefault();
  var x = (e.clipboardData || window.clipboardData).getData("text");
  document.execCommand("insertText", false, x);
 }
});

function groupCaptionLines(lines) {
 var out = [];
 (lines || []).forEach(function(l) {
  if (/^([\(（]|- )/.test(l) && out.length) out[out.length - 1].push(l); else out.push([ l ]);
 });
 return out;
}

var WASH_LIVE_RULES = [ [ /라이브\s*중\s*구매\s*후\s*채팅으로\s*구매\s*인증\s*시/g, "채팅을 통해 구매 인증 시" ], [ /구매인증/g, "구매 인증" ], [ /모바일상품권/g, "모바일 상품권" ], [ /([0-9]+만원)권\s*\(LG혜택\)/g, "$1" ], [ /앱전용\s*(?:할인\s*)?쿠폰/g, "앱전용 할인 쿠폰" ], [ /([^\s])할인\s*쿠폰/g, "$1 할인 쿠폰" ], [ /할인쿠폰/g, "할인 쿠폰" ], [ /방송당일/g, "방송 당일" ], [ /([가-힣]{2,})상품권/g, "$1 상품권" ] ];

function washLive(t) {
 var r = t || "";
 WASH_LIVE_RULES.forEach(function(x) {
  r = r.replace(x[0], x[1]);
 });
 return normDates(r);
}

function _mdFrom(s) {
 var m = s.match(/([0-9]{1,2})\s*[월\/.]\s*([0-9]{1,2})\s*일?\s*(?:\(([월화수목금토일])\))?/);
 return m ? fmtMD(Number(m[1]), Number(m[2]), m[3]) : "";
}

function condSentence(it) {
 var cond = it.condition || "";
 var DT = "([0-9]{1,2}\\s*[월\\/.]\\s*[0-9]{1,2}\\s*일?\\s*(?:\\([월화수목금토일]\\))?)";
 var m1 = cond.match(new RegExp(DT + "\\s*까지\\s*(?:배송|설치)[^0-9\\n]{0,12}?완료"));
 var m2 = m1 ? cond.slice(m1.index + m1[0].length).match(new RegExp(DT + "\\s*(?:까지|이내|내)?\\s*(?:순차\\s*)?(?:지급|발송|발급|제공|증정|입금)")) : null;
 var a, b;
 if (m1 && m2) {
  a = _mdFrom(m1[1]);
  b = _mdFrom(m2[1]);
 } else if (isGs25(it.benefit)) {
  var _ds = cond.match(new RegExp(DT, "g")) || [];
  if (_ds.length < 2) return "";
  a = _mdFrom(_ds[0]);
  b = _mdFrom(_ds[1]);
 } else return "";
 if (!a || !b) return "";
 if (!(it.benefit || "").trim()) return "";
 var sp = splitBenefit(it.benefit), label = sp.isDefault ? "" : sp.label, main = sp.main;
 var head = (label ? label + " " : "") + main + (/증정|추첨/.test(main) ? " 혜택은 " : " 증정 혜택은 ");
 if (!/라이브\s*중/.test(head)) head = head.replace(/채팅을\s*통해\s*구매\s*인증\s*시/, "라이브 중 채팅을 통해 구매 인증 시");
 var s = head + a + "까지 배송/설치 완료자 대상으로 " + b + "내 순차 지급 예정입니다.";
 var idm = (cond + " " + (it.benefit || "") + " " + (it.detailLines || []).join(" ")).match(/ID\s*당\s*([0-9]+)\s*([회개])?/);
 if (idm) {
  var _unit = isGs25(it.benefit) ? "개" : idm[2] || "개";
  s += " (ID당 " + idm[1] + _unit + " 증정)";
 } else if (isGs25(it.benefit)) s += " (ID당 1개 증정)";
 return s;
}

function computeCondLines(pv) {
 return (pv.liveItems || []).filter(function(it) {
  return it.condition;
 }).map(function(it, i) {
  var sent = condSentence(it);
  if (sent) return i + 1 + ". " + sent;
  var hs = hsCondSentence(it);
  if (hs) return i + 1 + ". " + hs;
  return i + 1 + ". " + (it.benefit ? it.benefit.split("\n")[0] + " 관련 지급조건: " : "지급조건: ") + normDates(it.condition);
 });
}

function buildPromoPreviewText(pv) {
 setTxtState(pv);
 var lines = [];
 lines.push("알림 신청 판촉 = 방송 알림 신청 이벤트");
 var l1 = [];
 if (pv.notify.deadline) l1.push(pv.notify.deadline + " 알림 신청 시");
 if (pv.notify.gift) l1.push(applyGiftTrademark(notifyGiftClean(pv.notify.gift)) + " 증정");
 if (pv.notify.count) l1.push("추첨 " + pv.notify.count);
 lines.push(l1.join(" \n"));
 lines.push("");
 lines.push("[알림신청 디스클레이머 영역 / 고정]");
 lines.push("알림 신청 시 추첨 대상에 자동 응모되며, 회원 정보에 등록된 휴대폰 번호로 방송 알림을 위한 문자가 발송됩니다");
 lines.push("");
 if (pv.opts && pv.opts.rebro) {
  var rt = rebroTexts(pv);
  lines.push("재방송 영역 (알림 신청과 한정 혜택 사이)");
  lines.push(rt.title);
  lines.push(rt.eyebrow);
  lines.push(rt.big);
  lines.push("");
 }
 lines.push("라이브 한정 판촉 = 라이브에서 준비한 한정 혜택");
 lines.push("");
 (pv.liveItems || []).forEach(function(it) {
  if (it.benefit) {
   var _sp = splitBenefit(it.benefit);
   lines.push(_sp.label + "\n" + _sp.main);
  }
  lines.push("");
 });
 (jparse(pv.opts && pv.opts.addLive, []) || []).forEach(function(x) {
  if (x && (x.t || x.m)) {
   lines.push((x.t || "") + "\n" + (x.m || ""));
   lines.push("");
  }
 });
 lines.push("[라이브 한정판촉 디스클레이머영역 / 고정이나 텍스트 내용은 변동있음]");
 var disclaimerLines = computeLiveDisclaimerLines(pv);
 if (disclaimerLines.length) {
  lines = lines.concat(disclaimerLines);
 }
 lines.push("");
 lines.push("OBS 기획전/기본 판촉");
 lines.push("");
 (pv.obsShow || pv.obsCards || []).forEach(function(r) {
  if (r[1]) lines.push(r[1]);
  if (r[2]) lines.push(r[2]);
  lines.push("");
 });
 lines.push("LGE닷컴 전사 판촉 + 판촉 지급 내용 = 결제혜택 및 유의사항");
 lines.push("");
 lines.push("[유의사항]");
 var condLines = computeCondLines(pv);
 if (condLines.length) {
  lines = lines.concat(condLines);
  lines.push("");
 }
 var _Wc = payWashFor(pv);
 lines.push(_Wc ? _Wc.text : pv.paymentFullText || "-");
 lines = lines.map(function(l) {
  return String(l).split("\n").map(EDN).join("\n");
 });
 return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

var GS25_FIXED = {
 label: "채팅을 통해 구매 인증 시",
 main: "GS25 모바일 상품권 1만원",
 iconLabel: "모바일 상품권",
 iconAmt: "1만원"
};

function isGs25(benefit) {
 return /GS\s*25/i.test(benefit || "");
}

var LIVE_LABEL_MAX = 22, LIVE_MAIN_MAX = 34;

function _manWon(v) {
 var m = String(v).match(/^([0-9][0-9,]*)원$/);
 if (!m) return v;
 var n = Number(m[1].replace(/,/g, ""));
 if (n < 1e4 || n % 1e3) return v;
 var man = n / 1e4;
 return Math.round(man * 10) / 10 + "만원";
}

function normalizeGiftMain(main) {
 var t = String(main || "").replace(/\s+/g, " ").trim(), dropped = [];
 if (!/추첨|상당|전원|\*|[0-9]+\s*개/.test(t)) return {
  text: t,
  dropped: dropped,
  touched: false
 };
 var val = "", cnt = "", all = false, m;
 if (m = t.match(/\*?\s*([0-9][0-9,]*\s*(?:만\s*)?원)\s*상당/)) {
  val = _manWon(m[1].replace(/\s+/g, "")) + " 상당";
  t = t.replace(m[0], " ");
 }
 if ((m = t.match(/\(?\s*추첨\s*([0-9][0-9,]*)\s*명\s*\)?/)) || (m = t.match(/([0-9][0-9,]*)\s*명\s*추첨/))) {
  cnt = m[1] + "명";
  t = t.replace(m[0], " ");
 }
 if (/전원(?:\s*증정)?\s*$/.test(t)) {
  all = true;
  t = t.replace(/전원(?:\s*증정)?\s*$/, " ");
 } else if (/전원\s*증정/.test(t)) {
  all = true;
  t = t.replace(/전원\s*증정/, " ");
 }
 t = t.replace(/[*※]/g, " ").replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").trim();
 var bundle = /(각\s*)?[0-9]+\s*개/.test(t);
 t = bundle ? t.replace(/\s*증정\s*$/, "") : t.replace(/\s*증정\s*/g, " ").trim();
 var dropCnt = cnt && val ? cnt : "";
 var tail = cnt && !val ? " " + cnt + " 추첨" : all ? " 전원 증정" : bundle || val || cnt ? " 증정" : "";
 var out = t + tail + (val ? " (" + val + ")" : "");
 if (out.length > LIVE_MAIN_MAX && val) {
  out = t + tail;
  dropped.push(val);
 }
 return {
  text: out.replace(/\s+/g, " ").trim(),
  dropped: dropped,
  touched: true,
  dropCnt: dropCnt
 };
}

function couponCategoryWash(label, main) {
 var full = (String(label || "") + " " + String(main || "")).replace(/\s+/g, " ").trim(), m;
 var GEN = /^(?:라이브\s*한정(?:\s*(?:혜택|판촉))?|남다르게\s*라이브)$/;
 if (m = full.match(/^(?:라이브\s*한정(?:\s*(?:혜택|판촉))?|남다르게\s*라이브)\s+(.*)$/)) full = m[1]; else if (label && !GEN.test(String(label).trim())) return null;
 var ents = [], rest = full;
 function entry(x) {
  var e = x.trim().match(/^([가-힣A-Za-z][^0-9%,()]*?)\s*(?:([0-9]+(?:\.[0-9]+)?)\s*%)?$/);
  return e ? {
   name: e[1].trim(),
   rate: e[2] ? parseFloat(e[2]) : null
  } : null;
 }
 if ((m = full.match(/\s*\(([^()]*)\)\s*/)) && /쿠폰/.test(full.replace(m[0], " "))) {
  var parts = m[1].split(/\s*[,，]\s*/).map(entry);
  if (parts.length && parts.every(function(e) {
   return e && e.name;
  })) {
   ents = parts;
   rest = full.replace(m[0], " ").replace(/\s+/g, " ").trim();
  }
 }
 if (!ents.length && !/^(?:최대\s*)?[0-9]/.test(full)) {
  var seg = full.match(/^(.*?)\s*((?:앱전용\s*)?(?:할인\s*)?쿠폰.*)$/);
  if (seg) {
   var parts2 = seg[1].split(/\s*[,，]\s*/).map(entry);
   if (parts2.length >= 2 && parts2.every(function(e) {
    return e && e.name && e.rate != null;
   })) {
    ents = parts2;
    rest = seg[2];
   }
  }
 }
 if (!ents.length) return null;
 var names = ents.map(function(e) {
  return e.name;
 }), rates = ents.map(function(e) {
  return e.rate;
 }).filter(function(r) {
  return r != null;
 });
 var rm = rest.match(/(최대\s*)?([0-9]+(?:\.[0-9]+)?)\s*%/), note = "";
 if (rm) rates.push(parseFloat(rm[2]));
 var uniq = rates.filter(function(v, i) {
  return rates.indexOf(v) === i;
 }), mx = rates.length ? Math.max.apply(null, rates) : 0;
 var rateTxt = uniq.length > 1 ? "최대 " + mx + "%" : (rm && rm[1] ? "최대 " : "") + (uniq.length ? uniq[0] + "%" : "");
 if (uniq.length > 1) note = ents.map(function(e) {
  return e.name + (e.rate != null ? " " + e.rate + "%" : "");
 }).join(", ");
 if (rm) rest = rest.replace(rm[0], rateTxt); else if (rateTxt) rest = rateTxt + " " + rest;
 rest = rest.replace(/앱전용\s*(?:할인\s*)?쿠폰/, "앱전용 할인 쿠폰").replace(/\s+/g, " ").trim();
 return {
  label: names.join(", "),
  main: rest,
  note: note
 };
}

function splitBenefit(benefit) {
 if (isGs25(benefit)) return {
  label: GS25_FIXED.label,
  main: GS25_FIXED.main,
  isDefault: false,
  fixed: true
 };
 var raw = washLive(benefit || "");
 var lines = raw.split("\n").map(function(x) {
  return x.trim();
 }).filter(Boolean);
 var label = "", main = "", m;
 if (lines.length >= 2) {
  label = lines[0];
  main = lines.slice(1).join(" · ");
 } else if (lines.length === 1) {
  var t = lines[0];
  if (m = t.match(/^(.*?)\s*((?:최대\s*)?[0-9]+(?:\.[0-9]+)?\s*%.*쿠폰.*)$/)) {
   label = m[1];
   main = m[2];
  } else if (m = t.match(BENEFIT_LABEL_SPLIT_RE)) {
   label = m[1];
   main = m[2];
  } else main = t;
 }
 var dropped = [], dropCnt = "", labelOver = false, mainOver = false, note = "";
 if (/쿠폰/.test(main)) {
  var cw = couponCategoryWash(label, main);
  if (cw) {
   label = cw.label;
   main = cw.main;
   note = cw.note;
  }
 }
 if (/쿠폰/.test(main)) main = stripRedundantGift(main); else {
  var ng = normalizeGiftMain(main);
  if (ng.touched) {
   main = ng.text;
   dropped = ng.dropped;
   dropCnt = ng.dropCnt || "";
  } else main = stripRedundantGift(main);
 }
 label = label.replace(/[,\s]+$/, "").trim();
 if (/쿠폰/.test(main)) label = label.replace(/\s*구매\s*시$/, "").trim();
 if (label.length > LIVE_LABEL_MAX) {
  var l2 = label.replace(/^라이브\s*중\s*/, "");
  if (l2 && l2 !== label) label = l2;
 }
 if (label.length > LIVE_LABEL_MAX) labelOver = true;
 if (main.length > LIVE_MAIN_MAX) mainOver = true;
 var isDefault = !label;
 return {
  label: label || LIVE_DEF_LABEL,
  main: main,
  isDefault: isDefault,
  dropped: dropped,
  dropCnt: dropCnt,
  labelOver: labelOver,
  mainOver: mainOver,
  note: note
 };
}

function _amtParts(text) {
 var m = (text || "").match(/(최대\s*)?([0-9][0-9,.]*\s*(?:%|만\s*원|원|만\s*P|P\b))/i);
 return m ? {
  pre: m[1] ? "최대" : "",
  num: m[2].replace(/\s+/g, "")
 } : {
  pre: "",
  num: ""
 };
}

function mockBenefitLines(benefit) {
 if (!benefit || !benefit.trim()) return '<span class="mockEmpty">(혜택 미입력)</span>';
 var sp = splitBenefit(benefit);
 return '<div class="mockBenefitLabel">' + EH(sp.label) + '</div><div class="mockBenefitMain">' + EH(sp.main) + "</div>";
}

function legalBulletHtml(text) {
 var body = (text || "").replace(/^[0-9]+\.\s*/, "");
 var sub = body.split("\n");
 var html = '<div class="legalBullet">· ' + EH(sub[0]) + "</div>";
 for (var i = 1; i < sub.length; i++) {
  html += '<div class="legalBullet" style="padding-left:1.4em;">' + EH(sub[i]) + "</div>";
 }
 return html;
}

function buildMockLegalHtml(pv) {
 var html = "";
 var condLines = computeCondLines(pv);
 var baseHtml = "", baseCount = 0;
 condLines.forEach(function(l) {
  baseHtml += legalBulletHtml(l);
  baseCount++;
 });
 if (pv.legalNotes) {
  pv.legalNotes.split("\n").map(function(l) {
   return normDates(l.trim());
  }).filter(Boolean).forEach(function(l) {
   baseHtml += legalBulletHtml(l);
   baseCount++;
  });
 } else {
  STANDARD_LEGAL_BOILERPLATE.forEach(function(l) {
   baseHtml += legalBulletHtml(l);
   baseCount++;
  });
 }
 html += '<div class="accBody">' + baseHtml + "</div>";
 var matchedSections = matchedNotices(pv);
 if (matchedSections.length) {
  html += '<div class="legalHeading" style="margin-top:14px;">LGE.COM 구매혜택 관련 안내</div>';
  matchedSections.forEach(function(sec, idx) {
   html += '<div class="legalHeading" style="margin-top:12px;">' + (idx + 1) + ") " + EH(sec.heading) + "</div>" + '<div class="accSubBody">';
   sec.bullets.forEach(function(l) {
    html += legalBulletHtml(l);
   });
   html += "</div>";
  });
 }
 return html;
}

function _svg(w, h, inner) {
 return '<svg class="mockIconSvg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + "</svg>";
}

function _amountFrom(text) {
 var m = (text || "").match(/(\d+(?:\.\d+)?\s*%|[\d,]+\s*만\s*원|[\d,]+\s*만\s*P|[\d,]+\s*원|[\d,]+\s*P\b)/i);
 return m ? m[1].replace(/\s+/g, "") : "";
}

function ticketIconSvg(red, label, amount, pre) {
 var fill = red ? "#FD312E" : "#111111";
 var aSize = amount.length > 4 ? 7.6 : 10;
 var preW = pre ? 8.2 : 0;
 var inner = '<rect x="7" y="18" width="52" height="31" rx="2" fill="' + fill + '"/>' + '<circle cx="59" cy="33.5" r="2.6" fill="#F4F4F4"/>' + '<rect x="10.5" y="21" width="5" height="5" rx="1.2" fill="#fff"/><path d="M12 22.6l2 2M14 22.6l-2 2" stroke="' + fill + '" stroke-width=".8" stroke-linecap="round"/>' + '<line x1="45" y1="21" x2="45" y2="46" stroke="#fff" stroke-opacity=".4" stroke-width=".6" stroke-dasharray="1.2 1.2"/>' + '<text x="10.5" y="31.2" font-size="3.6" font-weight="600" fill="#fff" textLength="' + Math.min(31, label.length * 3.5) + '" lengthAdjust="spacingAndGlyphs">' + escapeHtml(label) + "</text>" + (pre ? '<text x="10.5" y="43" font-size="4.4" font-weight="600" fill="#fff">' + escapeHtml(pre) + "</text>" : "") + (amount ? '<text x="' + (10.5 + preW) + '" y="43" font-size="' + aSize + '" font-weight="800" fill="#fff" textLength="' + Math.min(31 - preW, amount.length * aSize * .62) + '" lengthAdjust="spacingAndGlyphs">' + escapeHtml(amount) + "</text>" : "") + '<path d="M52 29v7M49.4 33.4l2.6 2.6 2.6-2.6M49.2 39.4h5.6" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/>';
 return _svg(66, 66, inner);
}

function giftIconSvg(size) {
 var inner = '<rect x="11" y="26" width="38" height="26" rx="2.5" fill="#FD312E"/>' + '<rect x="8" y="19" width="44" height="9" rx="2.5" fill="#e02623"/>' + '<rect x="28" y="19" width="4" height="33" fill="#fff" fill-opacity=".85"/>' + '<path d="M30 19c-6-9-14-4-9 0 3 2 9 0 9 0zM30 19c6-9 14-4 9 0-3 2-9 0-9 0z" fill="none" stroke="#e02623" stroke-width="2.2" stroke-linejoin="round"/>';
 return _svg(size || 60, size || 60, '<g transform="scale(' + (size || 60) / 60 + ')">' + inner + "</g>").replace('viewBox="0 0 ' + (size || 60) + " " + (size || 60) + '"', 'viewBox="0 0 ' + (size || 60) + " " + (size || 60) + '"');
}

function benefitIconHtml(benefit) {
 if (isGs25(benefit)) return ticketIconSvg(false, GS25_FIXED.iconLabel, GS25_FIXED.iconAmt, "");
 var t = (benefit || "").replace(/\n/g, " ");
 var sp = splitBenefit(benefit), ap = _amtParts(sp.main);
 if (!ap.num) ap = _amtParts(t);
 function tk(red, label) {
  return ticketIconSvg(red, label, ap.num, ap.pre);
 }
 if (/상품권|GS25|기프티콘|스타벅스|투썸|커피\s*쿠폰/.test(t)) {
  var coffee = /스타벅스|투썸|커피/.test(t);
  return tk(false, coffee ? "모바일 쿠폰" : "모바일 상품권");
 }
 if (/네이버\s*페이|포인트|[0-9]\s*P\b/.test(t)) {
  return tk(false, /네이버/.test(t) ? "네이버페이" : "포인트");
 }
 if (/쿠폰/.test(t)) {
  return tk(true, /앱전용/.test(t) ? "앱전용 할인 쿠폰" : /추가\s*할인\s*쿠폰/.test(t) ? "추가 할인 쿠폰" : "할인 쿠폰");
 }
 return giftIconSvg(48);
}

var _OBS_ICON_PATHS = {
 fridge: '<rect x="15" y="5" width="30" height="50" rx="3"/><path d="M15 26h30M39 12v8M39 31v10"/>',
 washer: '<rect x="9" y="6" width="42" height="48" rx="4"/><circle cx="30" cy="34" r="14"/><circle cx="30" cy="34" r="7"/><circle cx="17" cy="14" r="2"/><path d="M25 14h20"/>',
 tv: '<rect x="5" y="10" width="50" height="32" rx="2"/><path d="M22 52h16M30 42v10"/>',
 dish: '<rect x="9" y="6" width="42" height="48" rx="3"/><path d="M9 17h42"/><circle cx="17" cy="11.5" r="1.5"/><rect x="16" y="25" width="28" height="22" rx="2"/><path d="M16 33h28M16 40h28"/>',
 induction: '<rect x="5" y="18" width="50" height="26" rx="3"/><circle cx="20" cy="31" r="7"/><circle cx="40" cy="31" r="7"/>',
 aircon: '<rect x="5" y="12" width="50" height="20" rx="5"/><path d="M12 25h36M14 41q4 4 8 0t8 0t8 0M14 49q4 4 8 0t8 0t8 0"/>',
 vacuum: '<circle cx="22" cy="42" r="11"/><circle cx="22" cy="42" r="4"/><path d="M29 34L44 8h8M44 8l-2 6"/>',
 sofa: '<rect x="11" y="22" width="38" height="20" rx="4"/><rect x="5" y="28" width="11" height="18" rx="4"/><rect x="44" y="28" width="11" height="18" rx="4"/><path d="M14 46v6M46 46v6"/>',
 laptop: '<rect x="12" y="12" width="36" height="25" rx="2"/><path d="M5 43h50l-3 7H8z"/>',
 water: '<path d="M30 6C30 6 15 25 15 36a15 15 0 0 0 30 0C45 25 30 6 30 6z"/><path d="M22 38a8 8 0 0 0 8 8"/>',
 coffee: '<path d="M12 24h28v14a14 14 0 0 1-14 14h0a14 14 0 0 1-14-14z"/><path d="M40 28h4a6 6 0 0 1 0 12h-4M12 56h32M20 8q-3 4 0 8M28 6q-3 4 0 8"/>',
 tag: '<path d="M8 8h22l22 22-22 22L8 30z"/><circle cx="19" cy="19" r="3"/>'
};

function _lineIcon(key, size) {
 var inner = _OBS_ICON_PATHS[key] || _OBS_ICON_PATHS.tag;
 return _svg(size, size, '<g transform="scale(' + size / 60 + ')" fill="rgba(255,255,255,.7)" stroke="rgba(0,0,0,.45)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</g>");
}

function obsIconHtml(text) {
 var t = text || "";
 var key = "tag";
 if (/냉장고|김치|김냉|신선/.test(t)) key = "fridge"; else if (/세탁|워시|트롬|건조|스타일러/.test(t)) key = "washer"; else if (/식기\s*세척/.test(t)) key = "dish"; else if (/TV|티비|올레드|OLED|QNED|스탠바이미|스크린|사운드|오디오/i.test(t)) key = "tv"; else if (/인덕션|전기레인지|오븐|쿠킹|주방|광파|레인지/.test(t)) key = "induction"; else if (/에어컨|냉방|휘센|공기청정|에어로/.test(t)) key = "aircon"; else if (/청소기|코드제로|물걸레/.test(t)) key = "vacuum"; else if (/소파|가구|에싸|홈스타일|침대|리빙/.test(t)) key = "sofa"; else if (/PC|노트북|그램|모니터|\bIT\b/i.test(t)) key = "laptop"; else if (/정수기|퓨리케어/.test(t)) key = "water";
 return _lineIcon(key, 60);
}

function notifyIconHtml(gift) {
 var t = gift || "";
 if (/커피|아메리카노|스타벅스|투썸|카페/.test(t)) return _lineIcon("coffee", 46);
 if (/상품권|쿠폰|기프티콘/.test(t)) return ticketIconSvg(false, "모바일 상품권", _amountFrom(t));
 return giftIconSvg(46);
}

function jparse(s, fb) {
 try {
  var v = JSON.parse(s);
  return v === null || v === undefined ? fb : v;
 } catch (e) {
  return fb;
 }
}

var _TXT = {}, LIVE_DEF_LABEL = "000 라이브";

function setTxtState(pv) {
 _TXT = jparse(pv && pv.opts && pv.opts.txtEdit, {}) || {};
}

function _hasK(o, k) {
 return Object.prototype.hasOwnProperty.call(o, k);
}

function ED(t) {
 t = String(t == null ? "" : t);
 return _hasK(_TXT, t) ? _TXT[t] : t;
}

function EDN(line) {
 var s = String(line), m = s.match(/^([0-9]+\.\s)([\s\S]*)$/), t = (m ? m[2] : s).trim();
 if (t && _hasK(_TXT, t)) return (m ? m[1] : "") + _TXT[t];
 return s;
}

function EH(t) {
 t = String(t == null ? "" : t);
 if (!t) return "";
 return '<span class="txtEdit" contenteditable="true" spellcheck="false" data-et="' + _attr(t) + '" data-ph="·">' + escapeHtml(ED(t)) + "</span>";
}

function optGet(id) {
 var e = document.getElementById(id);
 return e ? jparse(e.value, null) : null;
}

function optSet(id, val) {
 var e = document.getElementById(id);
 if (!e) return;
 var empty = val === null || val === undefined || Array.isArray(val) && !val.length || typeof val === "object" && !Array.isArray(val) && !Object.keys(val).length;
 e.value = empty ? "" : JSON.stringify(val);
 e.dispatchEvent(new Event("input", {
  bubbles: true
 }));
}

function _cleanEditText(el) {
 return (el.innerText || "").replace(/\u00a0/g, " ").replace(/\s*\n\s*/g, " ").trim();
}

function commitTxtEdit(el) {
 var orig = el.getAttribute("data-et") || "", v = _cleanEditText(el), m = optGet("opt_txtedit") || {};
 var prev = _hasK(m, orig) ? m[orig] : orig;
 if (v === prev) return;
 if (v === orig || v.replace(/\s+/g, "") === orig.replace(/\s+/g, "")) delete m[orig]; else m[orig] = v;
 optSet("opt_txtedit", m);
}

function commitKv(el) {
 var f = el.getAttribute("data-kv"), orig = el.getAttribute("data-orig") || "", v = _cleanEditText(el), ov = optGet("opt_kv") || {};
 var prev = ov[f] !== undefined ? ov[f] : orig;
 if (v === prev) return;
 if (v === orig) delete ov[f]; else ov[f] = v;
 optSet("opt_kv", ov);
}

function commitAddLive(el) {
 var i = Number(el.getAttribute("data-i")), f = el.getAttribute("data-add"), v = _cleanEditText(el), a = optGet("opt_addlive") || [];
 if (!a[i] || (a[i][f] || "") === v) return;
 a[i][f] = v;
 optSet("opt_addlive", a);
}

function notifyGiftClean(g) {
 return String(g || "").replace(/^[\s\-–—·•ㆍ*※▶▷]+/, "").trim();
}

function productTitleOf(base) {
 return unifyProdSep(stripCaseParens(base).replace(/[0-9]{1,2}\s*[\/\.\-]\s*[0-9]{1,2}(?![0-9\/\.])/, " ").replace(/[\(\[]?\s*재방송\s*[\)\]]?/g, " ").replace(/남다르게|라이브|특집/g, " ").replace(HID_NOISE_RE, " ").replace(/\s+/g, " ").trim());
}

function liveDefaultLabel(name, kvMain) {
 var base = kvMain !== undefined && kvMain !== null && String(kvMain).trim() ? kvMain : name;
 return (productTitleOf(base) || "000") + " 라이브";
}

function kvInfo(pv) {
 var name = (document.getElementById("case_name") || {}).value || "", o = pv.opts || {}, ov = jparse(o.kv, {}) || {};
 var d = parseDateFromCaseName(name), dateAuto = "0. 00 (0) 오후 0시";
 if (d) {
  var dw = weekdayOf(d.month, d.day) || "0", h = airInfo(pv).hour;
  dateAuto = d.month + ". " + d.day + " (" + dw + ") " + (h < 12 ? "오전" : "오후") + " " + (h % 12 === 0 ? 12 : h % 12) + "시";
 }
 var mainAuto = (productTitleOf(name) || "000") + " 라이브";
 return {
  dateAuto: dateAuto,
  mainAuto: mainAuto,
  d: ov.d !== undefined ? ov.d : dateAuto,
  m: ov.m !== undefined ? ov.m : mainAuto,
  s: ov.s !== undefined ? ov.s : ""
 };
}

function renderKvSection(pv) {
 var k = kvInfo(pv);
 var logo = '<svg class="mockKvLogo" width="102" height="14" viewBox="0 0 102 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><text x="0" y="12" font-size="13" font-weight="800" fill="#000" letter-spacing="-0.3">LGE.COM</text><rect x="68.5" y="0" width="33.5" height="14" rx="7" fill="#EA1917"/><text x="85.25" y="10.4" text-anchor="middle" font-size="8.5" font-weight="800" fill="#fff" letter-spacing="0.5">LIVE</text></svg>';
 function ce(cls, f, orig, val, ph) {
  return '<div class="' + cls + ' obsEdit" contenteditable="true" spellcheck="false" data-kv="' + f + '" data-orig="' + _attr(orig) + '" data-ph="' + ph + '">' + escapeHtml(val) + "</div>";
 }
 return '<div class="mockSecLabel reviewOnly" style="border-top:0;padding-top:8px;">KV (최상단 · 검수용 라벨) — 점선 영역을 클릭해 날짜·메인카피·서브카피를 수정합니다. 메인카피의 제품명은 한정 혜택 윗줄 기본값("{제품명} 라이브")에 쓰입니다. 화면의 다른 문구도 클릭해서 직접 수정할 수 있습니다(마우스를 올리면 점선 표시).</div>' + '<div class="mockKv dimmable" id="secKv" data-key="kv"><div class="mockKvTop"><div class="mockKvHead">' + logo + ce("mockKvDate", "d", k.dateAuto, k.d, "0. 00 (0) 오후 0시") + '</div><div class="mockKvTitle">' + ce("mockKvMain", "m", k.mainAuto, k.m, "메인 카피 입력") + ce("mockKvSub", "s", "", k.s, "서브 카피 입력 (2줄)") + '</div><div class="mockKvImg reviewOnly">KV 제품 이미지 영역 (이 도구에서는 표시하지 않음)</div></div>' + '<div class="mockKvBtns"><div class="mockKvBtn dark">알림 신청하기</div><div class="mockKvBtn line">일정 추가하기</div></div></div>';
}

var ICON_TYPES = [ [ "", "자동" ], [ "appcoupon", "앱전용 할인 쿠폰" ], [ "coupon", "할인 쿠폰" ], [ "voucher", "상품권" ], [ "gift", "선물" ] ];

function iconByType(type, amtText, fallbackText) {
 var ap = _amtParts(amtText || fallbackText || "");
 if (type === "appcoupon") return ticketIconSvg(true, "앱전용 할인 쿠폰", ap.num, ap.pre);
 if (type === "coupon") return ticketIconSvg(true, "할인 쿠폰", ap.num, ap.pre);
 if (type === "voucher") return ticketIconSvg(false, "상품권", ap.num, ap.pre);
 return giftIconSvg(48);
}

function iconCtlHtml(onType, onAmt, cur, amt, ph, extra) {
 var opts = ICON_TYPES.map(function(t) {
  return '<option value="' + t[0] + '"' + (cur === t[0] ? " selected" : "") + ">" + t[1] + "</option>";
 }).join("");
 return '<div class="addCtl reviewOnly">아이콘 <select onchange="' + onType + '">' + opts + '</select> 금액·할인율 <input type="text" size="10" value="' + _attr(amt || "") + '" placeholder="' + ph + '" onchange="' + onAmt + '">' + (extra || "") + "</div>";
}

function setLiveIcon(i, f, v) {
 var m = optGet("opt_liveicon") || {}, c = m[i] || {};
 c[f] = v;
 if (!c.t && !c.a) delete m[i]; else m[i] = c;
 optSet("opt_liveicon", m);
}

function addLiveItem() {
 var a = optGet("opt_addlive") || [];
 a.push({
  ic: "appcoupon",
  t: LIVE_DEF_LABEL,
  m: "",
  a: ""
 });
 optSet("opt_addlive", a);
}

function setAddLive(i, f, v) {
 var a = optGet("opt_addlive") || [];
 if (!a[i]) return;
 a[i][f] = v;
 optSet("opt_addlive", a);
}

function delAddLive(i) {
 var a = optGet("opt_addlive") || [];
 a.splice(i, 1);
 optSet("opt_addlive", a);
}

function addObsItem() {
 var a = optGet("opt_addobs") || [];
 a.push({
  u: ""
 });
 optSet("opt_addobs", a);
}

function setAddObsUrl(i, v) {
 var a = optGet("opt_addobs") || [];
 if (!a[i]) return;
 a[i].u = v.trim();
 optSet("opt_addobs", a);
}

function delAddObs(i) {
 var a = optGet("opt_addobs") || [], ed = optGet("opt_obsedit") || {}, n = {};
 a.splice(i, 1);
 Object.keys(ed).forEach(function(k) {
  var m = k.match(/^add:([0-9]+)$/);
  if (!m) {
   n[k] = ed[k];
   return;
  }
  var j = Number(m[1]);
  if (j === i) return;
  n["add:" + (j > i ? j - 1 : j)] = ed[k];
 });
 var box = document.getElementById("opt_obsedit");
 if (box) box.value = Object.keys(n).length ? JSON.stringify(n) : "";
 optSet("opt_addobs", a);
}

function addObsCtl(r) {
 return '<div class="addCtl reviewOnly">직접 추가 배너 · URL <input type="text" class="addUrlIn" value="' + _attr(r[3] || "") + '" placeholder="랜딩 URL (선택)" onchange="setAddObsUrl(' + r._ai + ', this.value)"><button type="button" class="addDel" onclick="delAddObs(' + r._ai + ')">삭제</button></div>';
}

function addedLiveHtml(pv) {
 var a = jparse((pv.opts || {}).addLive, []) || [], html = "";
 a.forEach(function(x, i) {
  x = x || {};
  html += '<div class="mockAddWrap" data-ok="a:' + i + '"><div class="mockBenefitRow dimmable" data-key="live:a' + i + '"><div class="mockImg small sv">' + iconByType(x.ic, x.a, x.m) + "</div><div>" + '<div class="mockBenefitLabel obsEdit" contenteditable="true" spellcheck="false" data-add="t" data-i="' + i + '" data-ph="윗줄 입력">' + escapeHtml(x.t || "") + "</div>" + '<div class="mockBenefitMain obsEdit" contenteditable="true" spellcheck="false" data-add="m" data-i="' + i + '" data-ph="아랫줄 입력">' + escapeHtml(x.m || "") + "</div>" + "</div></div>" + iconCtlHtml("setAddLive(" + i + ",'ic',this.value)", "setAddLive(" + i + ",'a',this.value)", x.ic || "appcoupon", x.a, "예: 10% · 1만원", '<button type="button" class="addDel" onclick="delAddLive(' + i + ')">삭제</button> <span>· 직접 추가 혜택</span>') + "</div>";
 });
 return html;
}

function renderMockPage(pv) {
 setTxtState(pv);
 var html = '<div class="mockPage">';
 html += renderKvSection(pv);
 html += '<div class="mockSec mockSec03" id="secNotify"><div class="mockEventCard dimmable" data-key="notify">' + '<div class="mockTitle">방송 알림 신청 이벤트</div>' + '<div class="mockEventContent">' + '<div class="mockHero"><div class="mockImg sv">' + notifyIconHtml(pv.notify.gift) + '</div><div class="mockHeroText">' + "<div>" + EH((pv.notify.deadline || "(마감일시 미입력)") + " 알림 신청 시") + "</div>" + '<div class="mockHeroGift">' + EH((applyGiftTrademark(notifyGiftClean(pv.notify.gift)) || "(사은품 미입력)") + " 증정") + "</div>" + "<div>" + EH("추첨 " + (pv.notify.count || "-")) + "</div>" + "</div></div>" + '<div class="mockCaptionList"><div class="mockCaption mockDisclaimer"><span>' + EH("알림 신청 시 추첨 대상에 자동 응모되며, 회원 정보에 등록된 휴대폰 번호로 방송 알림을 위한 문자가 발송됩니다") + "</span></div></div>" + "</div></div></div>";
 if (pv.opts && pv.opts.rebro) html += renderRebroSection(pv);
 html += '<div class="mockSec mockSec04" id="secLive"><div class="mockTitle">라이브에서 준비한 한정 혜택</div>';
 html += '<div class="mockBenefitList">';
 if (pv.liveItems && pv.liveItems.length) {
  var _li = jparse(pv.opts && pv.opts.liveIcon, {}) || {};
  pv.liveItems.forEach(function(it, i) {
   var ov = _li[i] || {}, ico = ov.t ? iconByType(ov.t, ov.a, splitBenefit(it.benefit).main) : benefitIconHtml(it.benefit);
   html += '<div class="mockAddWrap" data-ok="' + _attr("p:" + it.benefit) + '"><div class="mockBenefitRow dimmable" data-key="live:' + i + '"><div class="mockImg small sv">' + ico + "</div><div>" + mockBenefitLines(it.benefit) + "</div></div>" + iconCtlHtml("setLiveIcon(" + i + ",'t',this.value)", "setLiveIcon(" + i + ",'a',this.value)", ov.t || "", ov.a, "비우면 자동", '<button type="button" class="addDel" onclick="hideLiveCard(' + i + ')">삭제</button> <span>· 원문에서 인식한 혜택</span>') + "</div>";
  });
 } else if (!jparse(pv.opts && pv.opts.addLive, []).length) {
  html += '<div class="mockEmpty">등록된 판촉이 없습니다.</div>';
 }
 html += addedLiveHtml(pv);
 html += '</div><button type="button" class="addPlus reviewOnly" onclick="addLiveItem()">＋ 혜택 추가 (판촉을 나눠 각각 기재할 때)</button>';
 html += liveDisclaimerHtml(pv);
 html += "</div>";
 html += '<div id="secObs"><div class="mockSecLabel reviewOnly">OBS 랜딩링크 (검수용 라벨 · 실제 화면에는 제목 없이 배너만 노출) — 점선 영역을 클릭하면 메인/서브 카피를 바로 수정할 수 있습니다</div>';
 html += '<div class="mockLinkList">';
 var _obsList = pv.obsShow || pv.obsCards || [];
 if (_obsList.length) {
  _obsList.forEach(function(r, i) {
   var code = r[0], main = r[1], sub = r[2];
   var href = code ? getObsBaseUrl() + code : r[3] || "#";
   var _ok = r._k || obsKeyOf(r, i), _oo = r._o || [ main || "", sub || "" ], _isH = isHidRow(r);
   html += '<div class="mockLinkWrap dimmable" data-ok="' + _attr(obsOrderKey(r)) + '" data-key="obs:' + (r[4] === "hidden" ? "hid" + (r._hn || "") : r[4] === "hidden2" ? "hid2" : i - _obsList.filter(isHidRow).length) + '"><div class="mockLinkRow" data-href="' + escapeHtml(href) + '">' + '<div class="mockLinkImg">' + obsIconHtml((main || "") + " " + (sub || "") + " " + (r[3] || "")) + "</div>" + '<div class="mockLinkBody"><div class="mockLinkText">' + '<div class="mockLinkMain obsEdit" contenteditable="true" spellcheck="false" data-obs="main" data-okey="' + _attr(_ok) + '" data-orig="' + _attr(_oo[0]) + '" data-ph="메인 타이틀 입력">' + escapeHtml(main || "") + "</div>" + '<div class="mockLinkSub obsEdit" contenteditable="true" spellcheck="false" data-obs="sub" data-okey="' + _attr(_ok) + '" data-orig="' + _attr(_oo[1]) + '" data-ph="서브 타이틀 입력">' + escapeHtml(sub || "") + "</div>" + '</div><a class="mockChevron" href="' + escapeHtml(href) + '" target="_blank" aria-label="기획전 열기"><i></i></a></div></div>' + (r[4] === "added" ? addObsCtl(r) : r[4] === "hidden" ? "" : obsDelBtn(r)) + '<div class="mockLinkUrl reviewOnly"' + (r[4] === "added" ? ' style="display:none"' : "") + ">" + escapeHtml(r[3] || "(URL 없음)") + (r[4] === "hidden" ? " · 제품명 기획전 배너(맨 위 고정 · KV 카피)" : "") + (r[4] === "hidden2" ? " · 통합 히든 기획전 배너(선택 추가)" : "") + (main ? "" : " · ⚠ 메인 타이틀 미입력 (위 점선 영역에 직접 입력)") + (r[4] === "fixed" ? " · 냉장고 포함 라이브 고정 배너" : "") + (r._o && (r[1] !== r._o[0] || r[2] !== r._o[1]) ? " · 직접 수정됨" : "") + "</div></div>";
  });
 } else {
  html += '<div class="mockEmpty" style="padding:0 20px 12px;">등록된 OBS 카드가 없습니다.</div>';
 }
 html += '</div><div style="padding:0 20px 12px;"><button type="button" class="addPlus reviewOnly" style="margin-top:0" onclick="addObsItem()">＋ 배너 추가 (동일 사이즈 · 직접 입력)</button></div></div>';
 if (pv.paymentFullText || payWashFor(pv)) {
  html += renderPaymentBenefitBox(pv.paymentFullText, pv);
 } else {
  html += '<div class="mockSec mockSec13" id="secPay"><div class="mockPayDark dimmable" data-key="pay"><div class="mockPayDarkTitle">LGE.COM 결제 혜택</div><div class="mockEmpty" style="color:#9ca3af;text-align:center;">원문에서 결제혜택(LGE닷컴 전사 판촉)을 찾지 못했습니다.</div></div></div>';
 }
 html += '<div class="mockSec mockSec14" id="secLegal">' + '<div class="mockLegalCta">유의사항 확인하기 <span style="font-size:14px;">›</span></div>' + '<div class="mockLegal dimmable" data-key="pay"><div class="mockLegalTitle">[유의사항]</div><div class="mockLegalBody">' + buildMockLegalHtml(pv) + "</div></div></div>";
 html += "</div>";
 return html;
}

var _toastTimer = null;

function showToast(msg) {
 var t = document.getElementById("toast");
 if (!t) return;
 t.textContent = msg;
 t.classList.add("show");
 clearTimeout(_toastTimer);
 _toastTimer = setTimeout(function() {
  t.classList.remove("show");
 }, 1800);
}

function _chip(kind, text) {
 return '<span class="chip ' + kind + '">' + escapeHtml(text) + "</span>";
}

function renderParseSummary(pv) {
 var box = document.getElementById("parseSummary");
 if (!box) return;
 if (!pv || !(pv.rawText || "").trim()) {
  box.innerHTML = "";
  return;
 }
 var h = "", today = new Date;
 var n = pv.notify || {};
 if (n.gift && n.count) h += _chip("ok", "알림 신청 ✓ " + n.gift + " · " + n.count); else h += _chip("bad", "알림 신청 " + (n.gift ? "" : "사은품 ") + (n.count ? "" : "인원 ") + "미인식");
 if (!n.deadline) h += _chip("warn", "알림 마감일시 미확인 (방송명에 날짜가 있어야 자동 계산)");
 var liveN = (pv.liveItems || []).length;
 h += liveN ? _chip("ok", "한정 혜택 " + liveN + "건") : _chip("bad", "한정 혜택 미인식");
 (pv.liveItems || []).forEach(function(it, i) {
  if (!it.benefit || isGs25(it.benefit)) return;
  var sp = splitBenefit(it.benefit), no = "한정 혜택 " + (i + 1) + ": ";
  if (sp.isDefault) h += _chip(/^000 /.test(sp.label) ? "warn" : "info", no + (/^000 /.test(sp.label) ? '제품명을 읽지 못해 윗줄을 "000 라이브"로 표시 — KV 메인카피에 제품명을 입력해 주세요' : '윗줄 기본값 "' + sp.label + '" 사용 (KV 메인카피·방송명 기준)'));
  if (sp.labelDropped && sp.labelDropped.length) h += _chip("info", no + "윗줄 글자 수 한도(" + LIVE_LABEL_MAX + '자)로 "' + sp.labelDropped.join(" ") + '" 생략 — 유의사항에는 전체 표기');
  if (sp.tiers) h += _chip("warn", no + '금액 구간 상품권 → "' + sp.main + '"로 표기하고 구간은 유의사항으로 이동 (양식 추정 · 실제 페이지와 대조)');
  if (sp.targets) h += _chip("info", no + "대상 품목은 카드에서 빼고 유의사항으로 이동");
  if (sp.dropped && sp.dropped.length) h += _chip("warn", no + "글자 수 한도(" + LIVE_MAIN_MAX + '자)로 "' + sp.dropped.join('", "') + '" 생략');
  if (sp.dropCnt) h += _chip("info", no + "사은품 추첨 인원(" + sp.dropCnt + ")은 표기하지 않음(실제 페이지 기준)");
  if (sp.note) h += _chip("info", no + '제품군별 할인률이 달라 아랫줄을 "최대"로 표기 (' + sp.note + ")");
  if (sp.mainOver) h += _chip("warn", no + "아랫줄 " + sp.main.length + "자 — 한도 " + LIVE_MAIN_MAX + "자 초과(직접 줄여주세요)");
  if (sp.labelOver) h += _chip("warn", no + "윗줄 " + sp.label.length + "자 — 한도 " + LIVE_LABEL_MAX + "자 초과(직접 줄여주세요)");
 });
 var cards = pv.obsCards || [], bank = loadObsBank(), noTitle = 0, unconfirmed = 0;
 cards.forEach(function(r) {
  if (!r[1]) noTitle++; else if (!findObsBankMatch(bank, r[3], r[0])) unconfirmed++;
 });
 if (!cards.length) h += _chip("warn", "OBS 링크 없음"); else {
  h += _chip("ok", "OBS 링크 " + cards.length + "건");
  if (noTitle) h += _chip("bad", "OBS 타이틀 미입력 " + noTitle + "건");
  if (unconfirmed) h += _chip("warn", "OBS 타이틀 미등록 " + unconfirmed + '건 (원문 추정 · ⋯ 더보기 → "OBS 공통 배너 카피 관리"에 등록하면 확정)');
 }
 if (fridgeOn(pv)) h += _chip("info", "냉장고 포함 → OBS 맨 아래에 고정 배너(Fit & Max 냉장고, 김치냉장고) 자동 추가");
 if (pv.opts && pv.opts.rebro) {
  var rt0 = rebroTexts(pv);
  h += _chip("ok", "재방송 영역 포함");
  if (!rt0.date) h += _chip("warn", "재방송: 본방송 일자 미입력");
  if (rt0.viewersEmpty) h += _chip("info", "재방송: 실시간 시청자 수 미입력 → 00.0명으로 표시");
 }
 h += pv.legalNotes ? _chip("ok", "유의사항 원문 사용") : _chip("info", "유의사항 표준 문구 자동 삽입");
 var tmp = document.createElement("div");
 tmp.innerHTML = h;
 var okH = "", alertH = "", okN = 0, alN = 0;
 [].slice.call(tmp.children).forEach(function(el) {
  if (el.classList.contains("chip") && (el.classList.contains("ok") || el.classList.contains("info"))) {
   okH += el.outerHTML;
   okN++;
  } else {
   alertH += el.outerHTML;
   alN++;
  }
 });
 box.className = "parseSummaryWrap";
 box.innerHTML = '<div class="psHead"><span class="psLine">인식 결과 ' + okN + "항목 정상" + (alN ? ' · <b style="color:#8a5a00;">확인 필요 ' + alN + "건</b>" : "") + "</span></div>" + (alertH ? '<div class="parseSummary">' + alertH + "</div>" : "") + '<details class="psDetails"><summary>인식 결과 자세히 보기</summary><div class="parseSummary">' + okH + "</div></details>";
}

function renderWashVisual() {
 var wrap = document.getElementById("washVisual");
 if (!wrap) return;
 if (!currentCaseId) {
  wrap.innerHTML = "";
  return;
 }
 var f = document.getElementById("frame"), keepTop = f ? f.scrollTop : 0;
 syncOptUi();
 var pv = collectFormValues();
 wrap.innerHTML = pageHtmlFix(renderMockPage(pv));
 renderDiffBar(getDiffContext(pv));
 if (f && keepTop) {
  var sb = f.style.scrollBehavior;
  f.style.scrollBehavior = "auto";
  f.scrollTop = keepTop;
  f.style.scrollBehavior = sb;
 }
 renderParseSummary(pv);
 updateDirtyBadge();
 updateTabSpy();
 var ta = document.getElementById("pageContentArea");
 if (ta) ta.value = pageTextFix(buildPromoPreviewText(pv));
 afterWashRender(pv);
}

function buildCompareRows(a, b) {
 var rows = [];
 function push(label, av, bv) {
  av = av || "-";
  bv = bv || "-";
  rows.push({
   label: label,
   left: av,
   right: bv,
   changed: av !== bv
  });
 }
 function giftCountText(notify) {
  if (!notify) return "";
  var parts = [ applyGiftTrademark(notify.gift), notify.count ].filter(Boolean);
  return parts.join(" · ");
 }
 push("알림 사은품/인원", a && giftCountText(a.notify), b && giftCountText(b.notify));
 var maxLive = Math.max(a ? a.liveItems.length : 0, b ? b.liveItems.length : 0);
 for (var i = 0; i < maxLive; i++) {
  var ai = a && a.liveItems[i] || {}, bi = b && b.liveItems[i] || {};
  var tagPart = ai.tag || bi.tag ? " [" + (ai.tag || bi.tag) + "]" : "";
  push("혜택" + (i + 1) + tagPart, ai.benefit, bi.benefit);
  push("혜택" + (i + 1) + " 조건", ai.condition, bi.condition);
 }
 var maxObs = Math.max(a ? a.obsCards.length : 0, b ? b.obsCards.length : 0);
 for (i = 0; i < maxObs; i++) {
  var ao = a && a.obsCards[i] || [], bo = b && b.obsCards[i] || [];
  push("OBS" + (i + 1) + " 명", ao[1], bo[1]);
  push("OBS" + (i + 1) + " 링크", ao[3], bo[3]);
 }
 push("결제/유의", a && a.paymentFullText, b && b.paymentFullText);
 if (a && a.banner && b && b.banner) bannerCompareRows(a.banner, b.banner).forEach(function(r) { push(r[0], r[1], r[2]); });
 return rows;
}

function renderCompareTable() {
 if (!currentCaseId) return;
 var cases = loadData(STORE_KEY.cases);
 var c = cases.find(function(x) {
  return x.id === currentCaseId;
 });
 var wrap = document.getElementById("compareTableWrap");
 if (!c || !wrap) return;
 var aSel = document.getElementById("cmpA"), bSel = document.getElementById("cmpB");
 if (!aSel || !bSel) return;
 var a = c.promoVersions.find(function(v) {
  return v.version === Number(aSel.value);
 });
 var b = c.promoVersions.find(function(v) {
  return v.version === Number(bSel.value);
 });
 if (!a || !b) {
  wrap.innerHTML = "";
  return;
 }
 var rows = buildCompareRows(a, b);
 var diffCount = rows.filter(function(r) {
  return r.changed;
 }).length;
 var html = '<div class="diffCallout' + (diffCount ? "" : " ok") + '"><b>' + (diffCount ? "⚠ v" + a.version + " → v" + b.version + " 사이 변경 " + diffCount + "건" : "v" + a.version + " → v" + b.version + " 사이 변경 없음") + "</b></div>";
 html += '<table class="cmpTable"><thead><tr><th style="width:24%;">항목</th><th>v' + a.version + " (" + fmtDT(a.savedAt) + ")</th><th>v" + b.version + " (" + fmtDT(b.savedAt) + ")</th></tr></thead><tbody>";
 rows.forEach(function(r) {
  html += "<tr>" + "<td>" + escapeHtml(r.label) + "</td>" + '<td class="' + (r.changed ? "changed changedLeft" : "") + '">' + escapeHtml(r.left) + "</td>" + '<td class="' + (r.changed ? "changed changedRight" : "") + '"' + (r.changed && rowKey(r.label) ? ' style="cursor:pointer" title="클릭하면 워싱본의 해당 위치로 이동합니다" onclick="jumpTo(\'' + rowKey(r.label) + "')\"" : "") + ">" + escapeHtml(r.right) + "</td>" + "</tr>";
 });
 html += "</tbody></table>";
 wrap.innerHTML = html;
}

var _dlg = null;

function openDlg(o) {
 _dlg = o;
 document.getElementById("dlgTitle").textContent = o.title || "";
 document.getElementById("dlgMsg").textContent = o.msg || "";
 var inp = document.getElementById("dlgInput");
 if (o.input) {
  inp.style.display = "block";
  inp.value = o.input.value || "";
  inp.placeholder = o.input.placeholder || "";
 } else {
  inp.style.display = "none";
  inp.value = "";
 }
 var ok = document.getElementById("dlgOk");
 ok.textContent = o.okLabel || "확인";
 ok.className = "btn" + (o.danger ? " danger" : "");
 document.getElementById("dlgScrim").classList.add("open");
 dlgCheck();
 if (o.input) {
  setTimeout(function() {
   inp.focus();
   inp.select();
  }, 30);
 }
}

function dlgCheck() {
 if (!_dlg) return;
 var ok = document.getElementById("dlgOk"), v = document.getElementById("dlgInput").value.trim(), enabled = true;
 if (_dlg.input) {
  if (_dlg.input.expect !== undefined) enabled = v === _dlg.input.expect; else if (_dlg.input.required) enabled = !!v;
 }
 ok.disabled = !enabled;
}

function dlgClose() {
 document.getElementById("dlgScrim").classList.remove("open");
 _dlg = null;
}

function dlgSubmit() {
 var o = _dlg;
 if (!o) return;
 if (document.getElementById("dlgOk").disabled) return;
 var v = document.getElementById("dlgInput").value.trim();
 dlgClose();
 if (o.onOk) o.onOk(v);
}

function toggleMenu(e) {
 e.stopPropagation();
 document.getElementById("moreMenu").classList.toggle("open");
}

function closeMenu() {
 var m = document.getElementById("moreMenu");
 if (m) m.classList.remove("open");
}

function openShare() {
 openDrawer("share");
 var d = document.getElementById("shareDetails");
 if (!d) return;
 d.scrollIntoView({
  behavior: "smooth",
  block: "center"
 });
}

function currentCase() {
 if (!currentCaseId) return null;
 return loadData(STORE_KEY.cases).find(function(x) {
  return x.id === currentCaseId;
 }) || null;
}

function isDirty() {
 var c = currentCase();
 if (!c) return false;
 var raw = document.getElementById("pv_raw").value;
 var last = c.promoVersions && c.promoVersions.length ? c.promoVersions[c.promoVersions.length - 1] : null;
 var nm = (document.getElementById("case_name") || {}).value || "";
 var optsDiff = JSON.stringify(collectOpts()) !== JSON.stringify(Object.assign(defaultOpts(nm), last && last.opts || {}));
 return last ? raw !== (last.rawText || "") || optsDiff : raw.trim().length > 0 || optsDiff;
}

function updateDirtyBadge() {
 var b = document.getElementById("dirtyBadge");
 if (b) b.classList.toggle("on", isDirty());
}

function guardUnsaved(fn) {
 if (!isDirty()) {
  fn();
  return;
 }
 openDlg({
  title: "저장하지 않은 변경이 있습니다",
  msg: "다른 방송으로 이동하면 현재 입력 내용이 사라집니다. 이동할까요?",
  okLabel: "이동",
  danger: true,
  onOk: fn
 });
 renderCaseBar();
}

function setMode(m) {
 document.body.classList.remove("realMode");
 var a = document.getElementById("modeReal"), b = document.getElementById("modeRev");
 if (a) a.classList.remove("on");
 if (b) b.classList.add("on");
}

function frameIsScroll() {
 var f = document.getElementById("frame");
 return !!f && getComputedStyle(f).overflowY !== "visible" && f.scrollHeight > f.clientHeight + 2;
}

function scrollToEl(el) {
 var f = document.getElementById("frame");
 if (frameIsScroll()) {
  var top = el.getBoundingClientRect().top - f.getBoundingClientRect().top + f.scrollTop - 8;
  f.scrollTo({
   top: top,
   behavior: "smooth"
  });
 } else {
  el.scrollIntoView({
   behavior: "smooth",
   block: "start"
  });
 }
}

function gotoSec(id) {
 var el = document.getElementById(id);
 if (!el) return;
 scrollToEl(el);
 [].slice.call(document.querySelectorAll("#secTabs .tab")).forEach(function(t) {
  t.classList.toggle("on", t.getAttribute("data-t") === id);
 });
}

function updateTabSpy() {
 var ids = [ "secKv", "secNotify", "secRebro", "secLive", "secObs", "secPay", "secLegal" ], cur = ids[0];
 var f = document.getElementById("frame"), inner = frameIsScroll();
 var base = inner ? f.getBoundingClientRect().top : 140;
 ids.forEach(function(id) {
  var el = document.getElementById(id);
  if (!el) return;
  if (el.getBoundingClientRect().top - base <= 60) cur = id;
 });
 [].slice.call(document.querySelectorAll("#secTabs .tab")).forEach(function(t) {
  t.classList.toggle("on", t.getAttribute("data-t") === cur);
 });
}

function jumpTo(key) {
 var el = document.querySelector('#washVisual [data-key="' + key + '"]');
 if (!el) {
  showToast("워싱본에서 해당 항목을 찾지 못했습니다");
  return;
 }
 scrollToEl(el);
 el.classList.remove("flash");
 void el.offsetWidth;
 el.classList.add("flash");
}

function toggleOnlyChanged() {
 var on = document.body.classList.toggle("onlyChg");
 var a = document.getElementById("onlyChgLink");
 if (a) a.textContent = on ? "전체 보기" : "변경점만 보기";
}

function _sameVer(a, b) {
 var ba = a.banner && b.banner ? [ a.banner, b.banner ] : [ 0, 0 ];
 return JSON.stringify([ a.notify, a.liveItems, a.obsCards, a.paymentFullText, ba[0] ]) === JSON.stringify([ b.notify, b.liveItems, b.obsCards, b.paymentFullText, ba[1] ]);
}

function rowKey(label) {
 var m;
 if (/^알림/.test(label)) return "notify";
 if (m = label.match(/^혜택(\d+)/)) return "live:" + (Number(m[1]) - 1);
 if (m = label.match(/^OBS(\d+)/)) return "obs:" + (Number(m[1]) - 1);
 if (/^결제/.test(label)) return "pay";
 return "";
}

function getDiffContext(pv) {
 var c = currentCase();
 if (!c) return null;
 var vs = c.promoVersions || [];
 if (!vs.length) return {
  mode: "none"
 };
 var latest = vs[vs.length - 1];
 var cur = {
  notify: pv.notify,
  liveItems: pv.liveItems,
  obsCards: pv.obsCards,
  paymentFullText: pv.paymentFullText,
  banner: bannerSnapshot(pv)
 };
 if (!_sameVer(latest, cur)) return {
  mode: "unsaved",
  prev: latest,
  cur: cur,
  label: "저장본(v" + latest.version + ") 대비 미저장 변경"
 };
 if (vs.length >= 2) return {
  mode: "saved",
  prev: vs[vs.length - 2],
  cur: latest,
  label: "이전 버전(v" + vs[vs.length - 2].version + ") 대비 (현재 v" + latest.version + ")"
 };
 return {
  mode: "first",
  label: "v1 — 첫 저장 버전입니다 (비교할 이전 버전 없음)"
 };
}

function renderDiffBar(ctx) {
 var box = document.getElementById("diffBar");
 if (!box) return {};
 var keys = {};
 if (!ctx) {
  box.innerHTML = "";
  return keys;
 }
 if (ctx.mode === "none") {
  box.innerHTML = '<div class="diff muted">아직 저장된 버전이 없습니다. 저장하면 이후부터 "이전 버전 대비 변경"이 여기에 표시됩니다.</div>';
  return keys;
 }
 if (ctx.mode === "first") {
  box.innerHTML = '<div class="diff muted">' + escapeHtml(ctx.label) + "</div>";
  return keys;
 }
 var rows = buildCompareRows(ctx.prev, ctx.cur).filter(function(r) {
  return r.changed;
 });
 rows.forEach(function(r) {
  var k = rowKey(r.label);
  if (k) keys[k] = true;
 });
 if (!rows.length) {
  box.innerHTML = '<div class="diff ok">' + escapeHtml(ctx.label) + " · <b>변경 없음</b></div>";
  return keys;
 }
 var names = [], seen = {};
 rows.forEach(function(r) {
  var n = r.label.replace(/\s*\[.*?\]/, "");
  if (!seen[n]) {
   seen[n] = 1;
   names.push(n);
  }
 });
 var shown = names.slice(0, 3).join(" / ") + (names.length > 3 ? " 외 " + (names.length - 3) + "건" : "");
 box.innerHTML = '<div class="diff">' + escapeHtml(ctx.label) + " <b>변경 " + rows.length + "건</b> · " + escapeHtml(shown) + '<a id="onlyChgLink" onclick="toggleOnlyChanged()">' + (document.body.classList.contains("onlyChg") ? "전체 보기" : "변경점만 보기") + "</a></div>";
 return keys;
}

function applyChangeMarks(keys) {
 [].slice.call(document.querySelectorAll("#washVisual [data-key]")).forEach(function(el) {
  el.classList.toggle("chgd", !!keys[el.getAttribute("data-key")]);
 });
}

function caseActivity(c) {
 return c.promoVersions && c.promoVersions.length ? c.promoVersions[c.promoVersions.length - 1].savedAt : c.createdAt || "";
}

var _showAllChips = false;

function renderCaseBar() {
 var sel = document.getElementById("caseSel"), chips = document.getElementById("caseChips");
 if (!sel) return;
 var cases = loadData(STORE_KEY.cases).slice().sort(function(a, b) {
  return caseActivity(b) > caseActivity(a) ? 1 : -1;
 });
 if (!cases.length) {
  sel.innerHTML = '<option value="">방송이 없습니다 — "+ 새 방송"으로 시작하세요</option>';
  sel.disabled = true;
  chips.innerHTML = "";
  return;
 }
 sel.disabled = false;
 sel.innerHTML = (currentCaseId ? "" : '<option value="">방송을 선택하세요</option>') + cases.map(function(c) {
  return '<option value="' + escapeHtml(c.id) + '"' + (c.id === currentCaseId ? " selected" : "") + ">" + escapeHtml(c.name) + " · v" + (c.promoVersions || []).length + "</option>";
 }).join("");
 if (currentCaseId) sel.value = currentCaseId;
 var list = _showAllChips ? cases : cases.slice(0, 4);
 chips.innerHTML = list.map(function(c) {
  return '<button class="chip btnchip' + (c.id === currentCaseId ? " sel" : "") + '" onclick="onCaseSelect(\'' + c.id + "')\">" + escapeHtml(c.name) + "</button>";
 }).join("") + (cases.length > 4 ? '<button class="chip add" onclick="_showAllChips=!_showAllChips;renderCaseBar()">' + (_showAllChips ? "접기" : "전체 보기 (" + cases.length + ")") + "</button>" : "");
}

function onCaseSelect(id) {
 if (!id) return;
 var c = loadData(STORE_KEY.cases).find(function(x) {
  return x.id === id;
 });
 if (!c) return;
 if (id === currentCaseId) return;
 guardUnsaved(function() {
  selectCaseByName(c.name);
 });
}

function selectCaseByName(name) {
 document.getElementById("case_name").value = name;
 loadOrCreateCase();
}

function normalizeCaseName(name) {
 var t = String(name || "").replace(/\s+/g, " ").trim(), m;
 function ok(mo, d) {
  return mo >= 1 && mo <= 12 && d >= 1 && d <= [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ][mo - 1];
 }
 function out(mo, d, rest) {
  return mo + "/" + d + (rest ? " " + rest.replace(/^[\s.,\-]+/, "") : "");
 }
 if ((m = t.match(/^(0?[1-9]|1[0-2])\s*[\/\.\-,·~]{2,3}\s*(0?[1-9]|[12][0-9]|3[01])(?![0-9])\.?(.*)$/)) && ok(+m[1], +m[2])) return out(+m[1], +m[2], m[3]);
 if ((m = t.match(/^(0?[1-9]|1[0-2])\s*[\/\.\-,·]\s*(0?[1-9]|[12][0-9]|3[01])\.(?![0-9])(.*)$/)) && ok(+m[1], +m[2])) return out(+m[1], +m[2], m[3]);
 if ((m = t.match(/^(0?[1-9]|1[0-2]),\s*(0?[1-9]|[12][0-9]|3[01])(?![0-9])(.*)$/)) && ok(+m[1], +m[2])) return out(+m[1], +m[2], m[3]);
 if ((m = t.match(/^(0?[1-9]|1[0-2])\s+(0?[1-9]|[12][0-9]|3[01])(?![0-9])(.*)$/)) && ok(+m[1], +m[2])) return out(+m[1], +m[2], m[3]);
 if ((m = t.match(/^(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])(?![0-9])(.*)$/)) && ok(+m[1], +m[2])) return out(+m[1], +m[2], m[3]);
 if ((m = t.match(/^([1-9])(0[1-9]|[12][0-9]|3[01])(?![0-9])(.*)$/)) && ok(+m[1], +m[2])) return out(+m[1], +m[2], m[3]);
 return t;
}

function openNewCase() {
 guardUnsaved(function() {
  openDlg({
   title: "새 방송 만들기",
   msg: "방송명을 입력하세요. 날짜를 앞에 쓰면 알림 마감일시가 자동 계산됩니다. 예: 10/14 남다르게 라이브",
   input: {
    placeholder: "10/14 남다르게 라이브",
    required: true
   },
   okLabel: "만들기",
   onOk: function(v0) {
    var v = normalizeCaseName(v0);
    if (v !== String(v0 || "").trim()) showToast('방송명을 "' + v + '"(으)로 인식했습니다');
    else if (!parseDateFromCaseName(v)) showToast("방송명에 날짜가 없어 알림 마감·결제혜택·배너 날짜를 계산할 수 없습니다. 앞에 날짜(예: 10/22)를 넣어 주세요");
    var exists = loadData(STORE_KEY.cases).some(function(x) {
     return x.name === v;
    });
    if (exists) showToast("이미 있는 방송이라 저장된 내용을 불러옵니다");
    selectCaseByName(v);
   }
  });
 });
}

var currentCaseId = null;

function refreshCaseSelect() {
 renderCaseBar();
}

function loadOrCreateCase() {
 var name = document.getElementById("case_name").value.trim();
 if (!name) {
  showToast("방송명을 입력해 주세요.");
  return;
 }
 var cases = loadData(STORE_KEY.cases);
 var c = cases.find(function(x) {
  return x.name === name;
 });
 var isNew = false;
 if (!c) {
  c = {
   id: uid(),
   name: name,
   promoVersions: [],
   createdAt: (new Date).toISOString()
  };
  cases.push(c);
  saveData(STORE_KEY.cases, cases);
  isNew = true;
 }
 currentCaseId = c.id;
 document.getElementById("promoCard").style.display = "block";
 onCaseShown(true);
 
 document.getElementById("promoTitle").innerHTML = "" + escapeHtml(name) + (c.promoVersions.length ? '<span class="versionTag">v' + c.promoVersions.length + "</span>" : "");
 document.getElementById("caseStatus").textContent = isNew ? '"' + name + '" 방송을 새로 등록했습니다. 원본 판촉을 붙여넣고 오른쪽 워싱본을 바로 수정하세요. 최종 저장은 ② 배너 워싱에서 합니다.' : '"' + name + '" 방송의 최신 판촉을 불러왔습니다. (v' + (c.promoVersions.length || 0) + ")";
 var last = c.promoVersions.length ? c.promoVersions[c.promoVersions.length - 1] : null;
 document.getElementById("pv_raw").value = last ? last.rawText || "" : "";
 document.getElementById("pv_source").value = last ? last.sourceChannel || "" : "";
 setOptsUi(last && last.opts || defaultOpts(name));
 renderHistoryPanel();
 renderWashVisual();
 refreshCaseSelect();
}

function deleteCase() {
 var c = currentCase();
 if (!c) {
  showToast("삭제할 방송을 먼저 선택해 주세요.");
  return;
 }
 var n = (c.promoVersions || []).length;
 openDlg({
  title: "방송을 삭제할까요?",
  msg: '"' + c.name + '"과 저장된 버전 이력 ' + n + "건이 모두 삭제되며 되돌릴 수 없습니다.\n계속하려면 방송명을 그대로 입력해 주세요.",
  input: {
   expect: c.name,
   placeholder: c.name
  },
  okLabel: "삭제",
  danger: true,
  onOk: function() {
   var cases = loadData(STORE_KEY.cases);
   saveData(STORE_KEY.cases, cases.filter(function(x) {
    return x.id !== c.id;
   }));
   currentCaseId = null;
   document.getElementById("promoCard").style.display = "none";
   onCaseShown(false);
   
   document.getElementById("case_name").value = "";
   document.getElementById("caseStatus").textContent = '"' + c.name + '" 방송을 삭제했습니다.';
   refreshCaseSelect();
   showToast("방송을 삭제했습니다");
  }
 });
}

function resetCaseHistory() {
 var c = currentCase();
 if (!c) {
  showToast("히스토리를 리셋할 방송을 먼저 선택해 주세요.");
  return;
 }
 if (!c.promoVersions || !c.promoVersions.length) {
  showToast('"' + c.name + '"에는 아직 저장된 판촉 히스토리가 없습니다.');
  return;
 }
 var verCount = c.promoVersions.length;
 openDlg({
  title: "판촉 히스토리를 리셋할까요?",
  msg: '"' + c.name + '" 방송의 판촉 히스토리(총 v' + verCount + "개 버전)를 전부 삭제합니다.\n방송명은 그대로 유지되고 버전 이력만 리셋되며, 되돌릴 수 없습니다.",
  okLabel: "리셋",
  danger: true,
  onOk: function() {
   var cases = loadData(STORE_KEY.cases);
   var cc = cases.find(function(x) {
    return x.id === c.id;
   });
   if (!cc) return;
   cc.promoVersions = [];
   saveData(STORE_KEY.cases, cases);
   currentCaseId = cc.id;
   document.getElementById("pv_raw").value = "";
   document.getElementById("pv_source").value = "";
   document.getElementById("promoTitle").innerHTML = "" + escapeHtml(cc.name);
   document.getElementById("caseStatus").textContent = '"' + cc.name + '" 방송의 판촉 히스토리가 초기화되었습니다. 원본 판촉을 새로 붙여넣고 저장해 주세요.';
   renderHistoryPanel();
   renderWashVisual();
   refreshCaseSelect();
  }
 });
}

function renameCase() {
 var c = currentCase();
 if (!c) {
  showToast("이름을 수정할 방송을 먼저 선택해 주세요.");
  return;
 }
 var oldName = c.name;
 openDlg({
  title: "방송명 수정",
  msg: "판촉 이력은 그대로 유지되고 이름만 바뀝니다.",
  input: {
   value: oldName,
   required: true
  },
  okLabel: "수정",
  onOk: function(newName) {
   if (!newName || newName === oldName) return;
   var cases = loadData(STORE_KEY.cases);
   if (cases.some(function(x) {
    return x.id !== c.id && x.name === newName;
   })) {
    showToast("이미 같은 이름의 방송이 있습니다. 다른 이름을 입력해 주세요.");
    return;
   }
   var cc = cases.find(function(x) {
    return x.id === c.id;
   });
   if (!cc) return;
   cc.name = newName;
   saveData(STORE_KEY.cases, cases);
   currentCaseId = cc.id;
   document.getElementById("case_name").value = newName;
   document.getElementById("promoTitle").innerHTML = "" + escapeHtml(newName) + (cc.promoVersions.length ? '<span class="versionTag">v' + cc.promoVersions.length + "</span>" : "");
   document.getElementById("caseStatus").textContent = '방송명이 "' + oldName + '"에서 "' + newName + '"(으)로 수정되었습니다.';
   refreshCaseSelect();
   renderWashVisual();
  }
 });
}

function resetAllCases() {
 var cases = loadData(STORE_KEY.cases);
 if (!cases.length) {
  showToast("초기화할 판촉 데이터가 없습니다. (등록된 방송이 없습니다)");
  return;
 }
 openDlg({
  title: "전체 초기화",
  msg: "이 브라우저에 저장된 모든 방송(총 " + cases.length + '개)과 판촉 히스토리를 전부 삭제합니다.\n방송명 목록까지 사라지며 되돌릴 수 없습니다. 계속하려면 "전체 초기화"를 입력해 주세요.',
  input: {
   expect: "전체 초기화",
   placeholder: "전체 초기화"
  },
  okLabel: "전체 삭제",
  danger: true,
  onOk: function() {
   saveData(STORE_KEY.cases, []);
   currentCaseId = null;
   document.getElementById("promoCard").style.display = "none";
   onCaseShown(false);
   
   document.getElementById("case_name").value = "";
   document.getElementById("caseStatus").textContent = '모든 방송/판촉 데이터가 초기화되었습니다. "+ 새 방송"으로 새로 시작해 주세요.';
   refreshCaseSelect();
   showToast("전체 초기화했습니다");
  }
 });
}

function savePromo() {
 if (!currentCaseId) {
  showToast("먼저 방송을 선택하거나 새로 만들어 주세요.");
  return;
 }
 var cases = loadData(STORE_KEY.cases);
 var c = cases.find(function(x) {
  return x.id === currentCaseId;
 });
 if (!c) return;
 var prev = c.promoVersions.length ? c.promoVersions[c.promoVersions.length - 1] : null;
 var cur = collectFormValues();
 cur.banner = bannerSnapshot(cur);
 var changes = computeChanges(prev, cur);
 var ver = {
  version: c.promoVersions.length + 1,
  savedAt: (new Date).toISOString(),
  rawText: cur.rawText,
  notify: cur.notify,
  liveItems: cur.liveItems,
  obsCards: cur.obsCards,
  paymentFullText: cur.paymentFullText,
  sourceChannel: cur.sourceChannel || "",
  opts: cur.opts,
  banner: cur.banner,
  changeLog: prev ? changes.length ? changes : [ "변경 사항 없음(문구 수정 등)" ] : [ "최초 등록" ]
 };
 c.promoVersions.push(ver);
 saveData(STORE_KEY.cases, cases);
 document.getElementById("caseStatus").textContent = '"' + c.name + '" v' + ver.version + " 저장 완료 (변경 " + (prev ? changes.length : 0) + "건) — 원본 판촉 내용도 히스토리에 함께 백업되었습니다.";
 document.getElementById("promoTitle").innerHTML = "" + escapeHtml(c.name) + '<span class="versionTag">v' + ver.version + "</span>";
 renderWashVisual();
 renderHistoryPanel();
 refreshCaseSelect();
}

function renderHistoryPanel() {
 var wrap = document.getElementById("historyWrap");
 if (!currentCaseId) {
  wrap.innerHTML = "";
  return;
 }
 var cases = loadData(STORE_KEY.cases);
 var c = cases.find(function(x) {
  return x.id === currentCaseId;
 });
 if (!c || !c.promoVersions || !c.promoVersions.length) {
  wrap.innerHTML = '<div class="empty">아직 저장된 이력이 없습니다.</div>';
  return;
 }
 var versions = c.promoVersions;
 var html = '<p class="small-note" style="margin-top:0;">버전을 저장할 때마다 그 시점의 "① 원본 판촉 수급 내용"이 통째로 백업되고, 변경 내역이 함께 쌓입니다.</p>';
 html += "<table><thead><tr><th>버전</th><th>일시</th><th>수급 경로</th><th>변경 내역</th><th>원본 백업</th></tr></thead><tbody>";
 versions.slice().reverse().forEach(function(v) {
  html += "<tr><td>v" + v.version + "</td><td>" + fmtDT(v.savedAt) + "</td><td>" + escapeHtml(v.sourceChannel || "-") + "</td><td>" + v.changeLog.map(escapeHtml).join("<br>") + "</td>" + '<td><details><summary style="cursor:pointer;color:var(--accent-2);font-weight:700;">원본 보기</summary>' + '<pre style="white-space:pre-wrap;font-size:11px;background:#fafafa;border:1px solid var(--line);border-radius:6px;padding:8px;margin-top:6px;max-width:320px;">' + escapeHtml(v.rawText || "(원본 없음)") + "</pre></details></td></tr>";
 });
 html += "</tbody></table>";
 if (versions.length >= 2) {
  var opts = versions.map(function(v) {
   return '<option value="' + v.version + '">v' + v.version + " (" + fmtDT(v.savedAt) + ")</option>";
  }).join("");
  var defA = versions[versions.length - 2].version;
  var defB = versions[versions.length - 1].version;
  html += '<h3>버전 비교 <span class="small-note" style="display:inline;font-weight:400;">— 표로 데이터 항목별 좌우 비교</span></h3>' + '<div class="row" style="align-items:flex-end;">' + '<div><label>이전 버전</label><select id="cmpA" onchange="renderCompareTable()">' + opts + "</select></div>" + '<div><label>비교 버전</label><select id="cmpB" onchange="renderCompareTable()">' + opts + "</select></div>" + '<div style="flex:0;min-width:auto;"><button class="btn secondary small" onclick="renderCompareTable()">비교하기</button></div>' + "</div>" + '<div id="compareTableWrap" style="margin-top:10px;"></div>';
  wrap.innerHTML = html;
  document.getElementById("cmpA").value = String(defA);
  document.getElementById("cmpB").value = String(defB);
  renderCompareTable();
  return;
 } else {
  html += '<p class="small-note">비교할 이전 버전이 아직 없습니다 (2개 버전 이상 저장하면 표 비교가 나타납니다).</p>';
 }
 wrap.innerHTML = html;
}

function exportAll() {
 var payload = {
  exportedAt: (new Date).toISOString(),
  cases: loadData(STORE_KEY.cases),
  obsBank: loadData(STORE_KEY.obsBank)
 };
 var blob = new Blob([ JSON.stringify(payload, null, 2) ], {
  type: "application/json"
 });
 var url = URL.createObjectURL(blob);
 var a = document.createElement("a");
 a.href = url;
 a.download = "Live_통합셋팅기_데이터_" + (new Date).toISOString().slice(0, 10) + ".json";
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 document.getElementById("shareStatus").textContent = '내보내기 완료. 이 파일을 팀원에게 전달하고, 팀원은 "가져오기"로 불러오면 됩니다.';
}

function importAll(e) {
 var file = e.target.files[0];
 if (!file) return;
 var reader = new FileReader;
 reader.onload = function() {
  var incoming;
  try {
   incoming = JSON.parse(reader.result);
  } catch (err) {
   showToast("올바른 JSON 파일이 아닙니다.");
   return;
  }
  var myCases = loadData(STORE_KEY.cases);
  var myBank = loadData(STORE_KEY.obsBank);
  var mergedCount = 0, addedCount = 0;
  (incoming.cases || []).forEach(function(inC) {
   var mine = myCases.find(function(x) {
    return x.name === inC.name;
   });
   if (!mine) {
    myCases.push(inC);
    addedCount++;
    return;
   }
   var mineLatest = mine.promoVersions.length ? mine.promoVersions[mine.promoVersions.length - 1].savedAt : null;
   var inLatest = inC.promoVersions.length ? inC.promoVersions[inC.promoVersions.length - 1].savedAt : null;
   if (inLatest && (!mineLatest || new Date(inLatest) > new Date(mineLatest))) {
    mine.promoVersions = inC.promoVersions;
    mergedCount++;
   }
  });
  (incoming.obsBank || []).forEach(function(b) {
   var exists = myBank.some(function(x) {
    return x.mainTitle === b.mainTitle && x.subTitle === b.subTitle;
   });
   if (!exists) {
    myBank.push(b);
   }
  });
  saveData(STORE_KEY.cases, myCases);
  saveData(STORE_KEY.obsBank, myBank);
  refreshCaseSelect();
  document.getElementById("shareStatus").textContent = "가져오기 완료 — 새 방송 " + addedCount + "건 추가, 기존 방송 " + mergedCount + "건 최신본으로 갱신.";
  e.target.value = "";
 };
 reader.readAsText(file);
}

var EXAMPLE_RAW = [ "알림 신청 판촉", "투썸플레이스 아메리카노 (30명)", "", "라이브 한정 판촉", "세탁기 10% 앱전용 할인쿠폰", "", "채팅을 통해 구매 인증 시 GS25 모바일상품권 1만원 *ID당 1회 증정 →26년 8월 9일까지 배송/설치 완료 시 8월 14일 내 발송예정", "", "OBS 기획전/기본 판촉", "https://www.lge.co.kr/benefits/exhibitions/detail-PE00897002", "https://www.lge.co.kr/benefits/exhibitions/detail-PE00955004", "", "트루스팀", "LG트롬 건조할 시간", "", "세탁 대전", "세탁가전 혜택 총 출동", "", "LGE닷컴 전사 판촉", "(50만원 이상) 신한/현대/국민/롯데/하나/우리카드로 결제 시, 7% 결제일 할인", "(100만원 이상) 신한/현대/국민/롯데/하나/우리카드로 결제 시, 12개월 무이자 할부", "", "[유의사항]", "1. 본 행사 내용은 당사 사정에 따라 예고 없이 변경 또는 중단될 수 있습니다.", "2. 결제일 할인, 무이자 할부 등의 카드 혜택은 LGE.COM 월별 회원 혜택에서 자세한 확인이 가능합니다.", "3. 경품 지급은 구매자의 회원 정보에 따라 진행하며, 잘못된 정보 기입 시 당첨 및 경품 지급이 불가합니다.", "※ 본 유의사항은 예시이며, 실제 발신 전 원본 수급 내용과 반드시 대조 후 사용해야 합니다." ].join("\n");

function loadExample() {
 closeMenu();
 guardUnsaved(function() {
  openDlg({
   title: "예시 데이터로 체험할까요?",
   msg: '"예시) 8월 세탁기 라이브" 방송을 만들고(또는 불러오고) 예시 원문을 입력창에 채웁니다. 이미 저장된 내용은 바뀌지 않으며, ② 배너 워싱에서 "최종 저장(확정)"을 눌러야 버전이 만들어집니다.',
   okLabel: "채우기",
   onOk: function() {
    document.getElementById("case_name").value = "예시) 8월 세탁기 라이브";
    loadOrCreateCase();
    document.getElementById("pv_raw").value = EXAMPLE_RAW;
    renderWashVisual();
    showToast("예시 원문을 채웠습니다. 오른쪽 워싱본을 바로 수정한 뒤 ② 배너 워싱으로 넘어가세요");
   }
  });
 });
}

function saveObsBankEntry() {
 var url = document.getElementById("bank_url").value.trim();
 var copy1 = document.getElementById("bank_copy1").value.trim();
 var copy2 = document.getElementById("bank_copy2").value.trim();
 if (!url || !copy1) {
  showToast("URL과 카피 1줄은 필수입니다.");
  return;
 }
 var bank = loadObsBank();
 var code = extractEventCode(url);
 var existing = findObsBankMatch(bank, url, code);
 if (existing) {
  existing.url = url;
  existing.code = code;
  existing.copy1 = copy1;
  existing.copy2 = copy2;
  existing.updatedAt = (new Date).toISOString();
 } else {
  bank.push({
   id: uid(),
   url: url,
   code: code,
   copy1: copy1,
   copy2: copy2,
   updatedAt: (new Date).toISOString()
  });
 }
 saveObsBank(bank);
 document.getElementById("bank_url").value = "";
 document.getElementById("bank_copy1").value = "";
 document.getElementById("bank_copy2").value = "";
 renderObsBankList();
 renderWashVisual();
}

function deleteObsBankEntry(id) {
 openDlg({
  title: "공통 배너 카피를 삭제할까요?",
  msg: '이 카피를 삭제하면 해당 URL은 다시 "[카테고리]" 검수용 표기로 나옵니다.',
  okLabel: "삭제",
  danger: true,
  onOk: function() {
   saveObsBank(loadObsBank().filter(function(b) {
    return b.id !== id;
   }));
   renderObsBankList();
   renderWashVisual();
  }
 });
}

function renderObsBankList() {
 var wrap = document.getElementById("obsBankList");
 if (!wrap) return;
 var bank = loadObsBank();
 if (!bank.length) {
  wrap.innerHTML = '<div class="empty">등록된 공통 배너 카피가 없습니다.</div>';
  return;
 }
 var html = "<table><thead><tr><th>URL</th><th>카피</th><th></th></tr></thead><tbody>";
 bank.forEach(function(b) {
  html += '<tr><td style="max-width:220px;word-break:break-all;">' + escapeHtml(b.url) + "</td>" + "<td>" + escapeHtml(b.copy1) + (b.copy2 ? '<br><span style="color:var(--sub);">' + escapeHtml(b.copy2) + "</span>" : "") + "</td>" + '<td><button class="btn ghost small" onclick="deleteObsBankEntry(\'' + b.id + "')\">삭제</button></td></tr>";
 });
 html += "</tbody></table>";
 wrap.innerHTML = html;
}

function init() {
 refreshCaseSelect();
 renderObsBankList();
 setMode("rev");
 document.addEventListener("click", function(e) {
  if (!e.target.closest || !e.target.closest(".menuWrap")) closeMenu();
 });
 document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
   closeMenu();
   if (_dlg) dlgClose();
  }
 });
 window.addEventListener("beforeunload", function(e) {
  if (isDirty()) {
   e.preventDefault();
   e.returnValue = "";
  }
 });
 var fr = document.getElementById("frame");
 if (fr) fr.addEventListener("scroll", updateTabSpy);
 window.addEventListener("scroll", updateTabSpy, {
  passive: true
 });
 var card = document.getElementById("promoCard");
 card.addEventListener("input", scheduleLiveRefresh);
 card.addEventListener("change", scheduleLiveRefresh);
 document.getElementById("chk_cook").addEventListener("change", function() {
  onAddCheck("cook", this);
 });
 document.getElementById("chk_fridge").addEventListener("change", function() {
  onAddCheck("fridge", this);
 });
 document.getElementById("chk_hidtotal").addEventListener("change", syncAddRow);
 document.getElementById("addRow").addEventListener("input", scheduleLiveRefresh);
 document.getElementById("addRow").addEventListener("change", scheduleLiveRefresh);
 var orow = document.getElementById("optRow");
 orow.addEventListener("input", scheduleLiveRefresh);
 orow.addEventListener("change", scheduleLiveRefresh);
}

/* init(); — 업무관리에서는 화면 초기화 안 함 */

function eventFromCaseName(caseName) {
 var n = stripCaseParens(caseName || "").replace(/[0-9]{1,2}\s*[\/\.\-]\s*[0-9]{1,2}(?![0-9\/\.])\s*/, "").trim();
 var m = n.match(/([0-9]{1,2}월\s*\S.*?)\s*(?:라이브|특집)?\s*$/);
 return m ? m[1].trim() : "";
}

function hour24(airTime) {
 var m = (airTime || "").match(/(오전|오후)?\s*([0-9]{1,2})\s*시/);
 if (!m) return null;
 var h = Number(m[2]);
 if (m[1] === "오후" && h < 12) h += 12;
 if (m[1] === "오전" && h === 12) h = 0;
 return h;
}

/* ── v03: 방송명 괄호 내용 제외 — (최종) [재] （LG） 【단독】 등. 날짜·재방송 판정은 원래 방송명 그대로 사용 ── */
function stripCaseParens(s) {
 return String(s || "").replace(/[\(（\[【［][^\)）\]】］]*[\)）\]】］]/g, " ").replace(/[\(（\[【［\)）\]】］]/g, " ").replace(/\s+/g, " ").trim();
}
/* ── v02 표기 통일 ── */
/* 방송명에서 읽은 제품 나열: & ＆ + / ㆍ ・ (앞뒤 공백 포함) → "·" (예: 냉장고&세탁기 → 냉장고·세탁기) */
function unifyProdSep(s) {
 return String(s || "").replace(/\s*(?:[&＆+ㆍ・·]|(?<=[가-힣A-Za-z])\s*\/(?=\s*[가-힣A-Za-z]))\s*/g, "·").replace(/·{2,}/g, "·").replace(/^·|·$/g, "").trim();
}
/* 화면·복사 문구의 "할인쿠폰" → "할인 쿠폰" (원문·수정 키는 그대로 두고 표시만) */
function pageTextFix(t) {
 return String(t == null ? "" : t).replace(/([^\s>])할인\s*쿠폰/g, "$1 할인 쿠폰").replace(/할인쿠폰/g, "할인 쿠폰");
}
function pageHtmlFix(h) {
 return String(h || "").replace(/>([^<]+)</g, function(m, t) { return ">" + pageTextFix(t) + "<"; });
}

/* ── 배너 버전 비교 보조 ── */
function bannerDiffNames(a, b) {
 var ma = {}, out = [];
 (a || []).forEach(function(x) { ma[x.g] = x.t; });
 (b || []).forEach(function(x) { if (ma[x.g] !== x.t) out.push(x.g); });
 return out;
}
function bannerCompareRows(a, b) {
 var ma = {}, mb = {}, names = [];
 (a || []).forEach(function(x) { ma[x.g] = x.t; if (names.indexOf(x.g) < 0) names.push(x.g); });
 (b || []).forEach(function(x) { mb[x.g] = x.t; if (names.indexOf(x.g) < 0) names.push(x.g); });
 return names.map(function(n) {
  var s = function(t) { return String(t || "").replace(/^\[[^\]]*\]\n?/, "").replace(/\n/g, " / "); };
  return [ "배너 · " + n, s(ma[n]), s(mb[n]) ];
 });
}

/* ── v04: OBS 헤더명 ("3. 까사미아 기획전" → OBS 타이틀 후보) ── */
function obsHeadName(sec) {
 var h = String(sec || "").split("\n")[0].replace(/\t[\s\S]*$/, "").replace(/^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?/, "").replace(/[\]］]\s*$/, "").trim();
 if (!h || /OBS|기본\s*판촉/i.test(h)) return "";
 return h;
}
/* ── v04: "A% ○○ 쿠폰 + B% ○○ 쿠폰" 묶음 → 카드 2장 ── */
function splitComboCoupons(items) {
 var out = [];
 (items || []).forEach(function(it) {
  var b = String(it.benefit || ""), m;
  if (b.indexOf("\n") < 0 && (m = b.match(/^(.*?)\s*((?:최대\s*)?[0-9]+(?:\.[0-9]+)?\s*(?:%|만\s*원|원)[^+]*?쿠폰)\s*\+\s*((?:최대\s*)?[0-9]+(?:\.[0-9]+)?\s*(?:%|만\s*원|원)[^+]*?쿠폰)\s*(?:증정|지급|발급)?\s*$/))) {
   var pre = m[1].trim();
   [ m[2], m[3] ].forEach(function(c) {
    out.push(Object.assign({}, it, { benefit: (pre ? pre + " " : "") + c.replace(/\s+/g, " ").trim(), detailLines: (it.detailLines || []).slice() }));
   });
  } else out.push(it);
 });
 return out;
}
/* ── v04: 한정 혜택 카드 — 금액 구간 상품권·대상 품목·추가 증정·윗줄 글자 수 맞춤 ── */
var _splitBenefitV03 = splitBenefit;
splitBenefit = function(benefit) {
 var r = _splitBenefitV03(benefit);
 if (r.fixed) return r;
 var main = r.main, m, tiers = "", targets = "";
 if (m = main.match(/\s*\(\s*대상\s*품목\s*[:：]\s*([^()]*)\)/)) {
  targets = m[1].replace(/\s+/g, " ").trim();
  main = main.replace(m[0], " ");
 }
 if (m = main.match(/\s*\(([^()]*[0-9]\s*만\s*원[^()]*)\)/)) {
  var amts = (m[1].match(/[0-9]+(?:\.[0-9]+)?(?=\s*만\s*원)/g) || []).map(parseFloat);
  if (amts.length >= 2) {
   tiers = m[1].replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").trim();
   main = main.replace(m[0], " ").replace(/\s+/g, " ").trim() + " 최대 " + Math.max.apply(null, amts) + "만원";
  }
 }
 main = main.replace(/추가\s*$/, "추가 증정").replace(/\s+/g, " ").trim();
 r.main = main;
 r.tiers = tiers;
 r.targets = targets;
 r.labelFull = r.label;
 if (r.label.length > LIVE_LABEL_MAX && !r.isDefault) {
  var tk = r.label.split(" "), suf = /구매\s*인증\s*시$/.test(r.label) ? 3 : /(?:구매|가입|신청|이용|결제)\s*시$/.test(r.label) ? 2 : 0, p = tk.length - suf - 1, drop = [];
  if (suf && p >= 2) {
   var i = p - 1;
   while (tk.join(" ").length > LIVE_LABEL_MAX && i >= 1) {
    drop.unshift(tk[i]);
    tk.splice(i, 1);
    i--;
   }
   if (tk.join(" ").length <= LIVE_LABEL_MAX) {
    r.label = tk.join(" ");
    r.labelDropped = drop;
   }
  }
 }
 r.labelOver = r.label.length > LIVE_LABEL_MAX;
 r.mainOver = r.main.length > LIVE_MAIN_MAX;
 return r;
};
/* ── v04: 날짜형이 아닌 지급조건 → 유의사항 문장 (홈스타일 양식 · 추정) ── */
function _hsSpace(t) {
 return String(t || "").replace(/배송\s*완료/g, "배송 완료").replace(/주문\s*상품/g, "주문 상품").replace(/단품\s*구매자/g, "단품 구매자").replace(/\s+/g, " ").trim();
}
function _ro(w) {
 var c = String(w || "").slice(-1).charCodeAt(0) - 44032;
 if (c < 0 || c > 11171) return "로";
 var j = c % 28;
 return j === 0 || j === 8 ? "로" : "으로";
}
function hsCondSentence(it) {
 if (!it || !it.condition || isGs25(it.benefit)) return "";
 var sp = splitBenefit(it.benefit);
 if (sp.fixed || sp.isDefault) return "";
 var parts = [];
 String(it.condition).split(/\s+\/\s+/).forEach(function(x) {
  var pm = x.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (pm && pm[1]) { parts.push(pm[1]); parts.push(pm[2]); } else parts.push(x);
 });
 parts = parts.map(_hsSpace).filter(Boolean);
 var lead = "", subs = [];
 parts.forEach(function(x) {
  var m = x.match(/^배송 완료 후\s*([0-9]+)\s*일\s*(?:이내|내)\s*(.*?)\s*(발송|지급|발급)(?:\s*예정)?$/);
  if (m && !lead) lead = "배송 완료 후 " + m[1] + "일 이내 " + (m[2] ? m[2] + _ro(m[2]) + " " : "") + m[3] + " 예정입니다.";
  else subs.push(x);
 });
 if (!lead && !sp.targets && !sp.tiers) return "";
 if (!lead && sp.targets) lead = "대상 품목(" + sp.targets + ") 구매 시 적용됩니다.";
 else if (sp.targets) subs.unshift("대상 품목: " + sp.targets);
 if (sp.tiers) subs.unshift("증정 금액: " + sp.tiers);
 var gift = sp.main.replace(/\s*최대\s*[0-9.]+\s*만\s*원$/, "");
 var head = (sp.labelFull || sp.label) + " " + gift + (/(?:증정|추첨)$/.test(gift) ? " 혜택은 " : " 증정 혜택은 ");
 return normDates(head + lead) + subs.map(function(s) { return "\n- " + s; }).join("");
}

/* ── v05: 생성된 카드 삭제(숨김) — opts.hide = { live:[혜택 원문], obs:[URL|PE코드|t:타이틀] } ── */
function hideState(o) {
 var h = jparse(o && o.hide, {}) || {};
 if (!Array.isArray(h.live)) h.live = [];
 if (!Array.isArray(h.obs)) h.obs = [];
 return h;
}
function obsHideKey(r) {
 return r[3] || r[0] || "t:" + (r._o && r._o[0] || r[1] || "");
}
function applyHidden(parsed, opts) {
 var h = hideState(opts);
 if (h.live.length) parsed.liveItems = parsed.liveItems.filter(function(it) { return h.live.indexOf(it.benefit) < 0; });
 if (h.obs.length) parsed.obsCards = parsed.obsCards.filter(function(r) { return h.obs.indexOf(obsHideKey(r)) < 0; });
 return parsed;
}
function _saveHide(h) {
 optSet("opt_hide", h.live.length || h.obs.length ? h : null);
}
function hideLiveCard(i) {
 var pv = collectFormValues(), it = pv.liveItems[i];
 if (!it) return;
 var h = hideState(pv.opts);
 if (h.live.indexOf(it.benefit) < 0) h.live.push(it.benefit);
 var li = optGet("opt_liveicon") || {}, n = {};
 Object.keys(li).forEach(function(k) {
  var j = Number(k);
  if (j === i) return;
  n[j > i ? j - 1 : j] = li[k];
 });
 var e = document.getElementById("opt_liveicon");
 if (e) e.value = Object.keys(n).length ? JSON.stringify(n) : "";
 _saveHide(h);
 showToast("혜택 카드를 삭제했습니다 · \"추가 영역\"에서 되돌릴 수 있습니다");
}
function obsDelBtn(r) {
 var t = r[4] === "fixed" ? "fridge" : r[4] === "hidden2" ? "hid2" : "card";
 return '<div class="addCtl reviewOnly"><button type="button" class="addDel obsDel" data-k="' + _attr(obsHideKey(r)) + '" onclick="hideObsCard(this.getAttribute(\'data-k\'),\'' + t + '\')">배너 삭제</button><span>· ' + (t === "fridge" ? "냉장고 고정 배너(추가 영역 체크 해제와 같음)" : t === "hid2" ? "통합 히든 기획전(추가 영역 체크 해제와 같음)" : "원문에서 인식한 배너") + "</span></div>";
}
function hideObsCard(key, type) {
 if (type === "fridge") {
  var c = document.getElementById("chk_fridge");
  if (c) { c.checked = false; c.dispatchEvent(new Event("change", { bubbles: true })); }
  return;
 }
 if (type === "hid2") {
  var t = document.getElementById("chk_hidtotal");
  if (t) { t.checked = false; t.dispatchEvent(new Event("change", { bubbles: true })); }
  return;
 }
 var h = hideState({ hide: (document.getElementById("opt_hide") || {}).value });
 if (h.obs.indexOf(key) < 0) h.obs.push(key);
 _saveHide(h);
 showToast("OBS 배너를 삭제했습니다 · \"추가 영역\"에서 되돌릴 수 있습니다");
}
function unhideCard(kind, i) {
 var h = hideState({ hide: (document.getElementById("opt_hide") || {}).value });
 if (kind === "all") { h.live = []; h.obs = []; } else h[kind].splice(i, 1);
 _saveHide(h);
}
function renderHideBox(pv) {
 var box = document.getElementById("hideBox");
 if (!box) return;
 var h = hideState(pv.opts), n = h.live.length + h.obs.length;
 if (!n) { box.innerHTML = ""; return; }
 var rows = h.live.map(function(b, i) {
  return '<div class="hideItem"><span class="k">혜택</span><span title="' + _attr(b) + '">' + escapeHtml(b.replace(/\n/g, " / ")) + '</span><button type="button" class="btn small secondary" onclick="unhideCard(\'live\',' + i + ')">되돌리기</button></div>';
 }).concat(h.obs.map(function(k, i) {
  return '<div class="hideItem"><span class="k">OBS</span><span title="' + _attr(k) + '">' + escapeHtml(k.replace(/^t:/, "")) + '</span><button type="button" class="btn small secondary" onclick="unhideCard(\'obs\',' + i + ')">되돌리기</button></div>';
 }));
 box.innerHTML = '<div class="cardHead" style="margin:14px 0 6px;"><h3>삭제한 카드 ' + n + '건</h3><span class="hint">원문에서 인식했지만 페이지에서 뺀 카드</span><button type="button" class="btn small secondary act" onclick="unhideCard(\'all\')">모두 되돌리기</button></div><div class="hideList">' + rows.join("") + "</div>";
}

/* ── v06: 제품명 나열 → 가운데점(·) 필수 — "냉장고세탁기", "냉장고 세탁기", "냉장고&세탁기" → "냉장고·세탁기" ── */
var PROD_JOIN_WORDS = "김치냉장고|냉장고|세탁기|건조기|워시타워|워시콤보|스타일러|식기세척기|공기청정기|정수기|제습기|가습기|청소기|에어컨|인덕션|광파오븐|오븐|전자레인지|TV|모니터|노트북|사운드바|프로젝터";
var PROD_JOIN_RE = new RegExp("(" + PROD_JOIN_WORDS + ")\\s*(?:[&＆+/ㆍ・·,，]\\s*)?(?=(?:" + PROD_JOIN_WORDS + "))", "g");
function joinProducts(s) {
 return String(s == null ? "" : s).replace(PROD_JOIN_RE, "$1·");
}
var _unifyProdSepV05 = unifyProdSep;
unifyProdSep = function(s) {
 return joinProducts(_unifyProdSepV05(s));
};
/* KV 메인·서브: 직접 입력한 값도 표시·배너에는 가운데점으로 통일 */
var _kvInfoV05 = kvInfo;
kvInfo = function(pv) {
 var k = _kvInfoV05(pv);
 k.m = joinProducts(k.m);
 k.s = joinProducts(k.s);
 return k;
};
/* 워싱본 KV 아래 배너 기준 글자 수 안내 (검수용) */
function renderKvCount(pv) {
 var t = document.querySelector("#washVisual #secKv .mockKvTitle");
 if (!t) return;
 var k = kvInfo(pv), lm = BN_LIM.keyMain, ls = BN_LIM.keySub, nm = String(k.m || "").trim().length, ns = String(k.s || "").trim().length;
 var d = document.createElement("div");
 d.className = "kvCnt reviewOnly" + (nm > lm || ns > ls ? " warn" : "");
 d.textContent = "배너 기준 · 메인 " + nm + "/" + lm + "자" + (nm > lm ? " (" + (nm - lm) + "자 초과)" : "") + " · 서브 " + ns + "/" + ls + "자" + (ns > ls ? " (" + (ns - ls) + "자 초과)" : "");
 t.appendChild(d);
}

/* ── v07: 라이브 한정 혜택 — 제품 2개 이상은 ", " 구분 / 앱전용 할인 쿠폰 표기 규칙 ── */
var LIVE_PROD_SEP_RE = new RegExp("(" + PROD_JOIN_WORDS + ")\\s*(?:[\\/／&＆+ㆍ・·,，]\\s*)?(?=(?:" + PROD_JOIN_WORDS + "))", "g");
function liveProdComma(s) {
 return String(s == null ? "" : s).replace(LIVE_PROD_SEP_RE, "$1, ").replace(/\s*,\s*/g, ", ");
}
function liveProdList(s) {
 var re = new RegExp(PROD_JOIN_WORDS, "g"), out = [], m;
 while ((m = re.exec(String(s || "")))) if (out.indexOf(m[0]) < 0) out.push(m[0]);
 return out;
}
/* "세탁기/스타일러 앱전용 10% 할인쿠폰" → 윗줄 "세탁기, 스타일러" / 아랫줄 "10% 앱전용 할인 쿠폰" */
function liveCouponWash(r) {
 var full = (r.isDefault ? "" : r.label) + " " + r.main;
 if (!/쿠폰/.test(r.main) || !/앱전용|할인\s*쿠폰|할인쿠폰/.test(full)) return r;
 var app = /앱전용/.test(full), extra = !app && /추가\s*할인/.test(full);
 var rates = [], m, re = /([0-9]+(?:\.[0-9]+)?)\s*%/g;
 while ((m = re.exec(full))) rates.push(parseFloat(m[1]));
 var val = "", pre = "";
 if (rates.length) {
  var uniq = rates.filter(function(v, i) { return rates.indexOf(v) === i; });
  val = Math.max.apply(null, rates) + "%";
  pre = uniq.length > 1 || /최대/.test(full) ? "최대 " : "";
  if (uniq.length > 1 && !r.note) {
   var pr = [], pm, pre2 = new RegExp("(" + PROD_JOIN_WORDS + ")\\s*([0-9]+(?:\\.[0-9]+)?)\\s*%", "g");
   while ((pm = pre2.exec(full))) pr.push(pm[1] + " " + pm[2] + "%");
   if (pr.length) r.note = pr.join(", ");
  }
 } else if ((m = full.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*만\s*원/))) {
  val = m[1] + "만원";
  pre = /최대/.test(full) ? "최대 " : "";
 } else return r;
 r.main = pre + val + " " + (app ? "앱전용 할인 쿠폰" : extra ? "추가 할인 쿠폰" : "할인 쿠폰");
 var prods = liveProdList(full);
 if (prods.length >= 2 || r.isDefault && prods.length === 1) {
  r.label = prods.join(", ");
  r.isDefault = false;
 } else if (!r.isDefault) {
  var lb = r.label.replace(/(?:최대\s*)?[0-9]+(?:\.[0-9]+)?\s*(?:%|만\s*원)/g, " ").replace(/앱전용|추가|할인|쿠폰|구매\s*시$/g, " ").replace(/[\/／&＆+,，·]\s*$/, "").replace(/\s+/g, " ").trim();
  if (lb) r.label = lb; else { r.label = LIVE_DEF_LABEL; r.isDefault = true; }
 }
 return r;
}
var _splitBenefitV04 = splitBenefit;
splitBenefit = function(benefit) {
 var r = _splitBenefitV04(benefit);
 if (r.fixed) return r;
 r = liveCouponWash(r);
 if (!r.isDefault) r.label = liveProdComma(r.label);
 r.main = liveProdComma(r.main);
 r.labelOver = r.label.length > LIVE_LABEL_MAX;
 r.mainOver = r.main.length > LIVE_MAIN_MAX;
 return r;
};

/* ── v08: 결제혜택 · 유의사항 반영 기준 ──
   opts.payMode = "" (판촉안 · 방송일 기준, 기본) | "prev" (직전 라이브와 동일) | "date" (판촉안 · 반영 일자 opts.payDate 기준) */
function _isoOfMD(s) {
 var d = parseDateFromCaseName(String(s || ""));
 if (!d) return "";
 var z = function(n) { return (n < 10 ? "0" : "") + n; };
 return inferYear(d.month, d.day) + "-" + z(d.month) + "-" + z(d.day);
}
function _mdOfIso(iso) {
 var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
 return m ? fmtMD(+m[2], +m[3]) : "";
}
/* 저장된 방송 c의 최신 버전이 실제로 쓴 결제혜택 원문·기준일 (직전 라이브 동일 모드를 위해 재현) */
function caseWashSpec(c, depth) {
 if (!c || depth > 8 || !c.promoVersions || !c.promoVersions.length) return null;
 var v = c.promoVersions[c.promoVersions.length - 1] || {}, o = v.opts || {};
 if (o.payMode === "prev") {
  var pc = prevLiveCase(c.id, c.name, [ c.id ]);
  var sp = caseWashSpec(pc, depth + 1);
  return sp ? Object.assign({}, sp, { via: c.name }) : null;
 }
 var own = ownPaySheet({ opts: o, rawText: v.rawText, paymentFullText: v.paymentFullText }), text = "";
 if (own && own.full) text = own.text; else {
  var inh = o.payInh === false ? null : inheritedPayBase(c.id, c.name, 0, [ c.id ]);
  text = inh && own ? PayWash.merge(inh.text, own.text) : inh ? inh.text : own ? own.text : "";
 }
 if (!text) return null;
 text = PayWash.ensureTable(text).text;
 var ds = o.payMode === "date" && _isoOfMD(o.payDate) ? _isoOfMD(o.payDate) : _isoOfMD(c.name) || _isoOfMD(o.bdate);
 return { text: text, ds: ds, name: c.name, dateMode: o.payMode === "date" };
}
function paySheetByMode(pv) {
 var o = pv.opts || {}, nm = (document.getElementById("case_name") || {}).value || "";
 if (o.payMode === "prev") {
  var pc = prevLiveCase(currentCaseId, nm, [ currentCaseId ]), sp = caseWashSpec(pc, 0);
  if (sp && sp.ds) return { text: sp.text, ds: sp.ds, dsLabel: "직전 라이브 기준일", src: "직전 라이브(" + sp.name + ")와 동일하게 반영 · " + _mdOfIso(sp.ds) + " 기준" + (sp.via ? " (" + sp.via + " 경유)" : ""), notes: [ { k: "info", m: "결제혜택·유의사항: 직전 라이브(" + sp.name + ") 셋팅을 그대로 사용 — 이번 판촉의 결제혜택 원문은 반영하지 않음" } ], inherited: true, from: sp.name, prevSame: true };
  var r0 = paySheetFrom(pv);
  if (r0) r0.notes = (r0.notes || []).concat([ { k: "warn", m: "직전 라이브 셋팅을 찾지 못해 판촉안 기준으로 반영했습니다(저장된 이전 방송 없음)" } ]);
  return r0;
 }
 var r = paySheetFrom(pv);
 if (r && o.payMode === "date") {
  var iso = _isoOfMD(o.payDate);
  if (iso) {
   r.ds = iso;
   r.dsLabel = "반영 일자";
   r.notes = (r.notes || []).concat([ { k: "info", m: "결제혜택·유의사항: 반영 일자 " + _mdOfIso(iso) + " 기준으로 기간 혜택 포함/제외 (방송일 " + (_mdOfIso(broadcastDateStr(pv)) || "-") + ")" } ]);
  } else r.notes = (r.notes || []).concat([ { k: "warn", m: "반영 일자를 읽지 못해 방송일 기준으로 반영했습니다 (예: 10/15)" } ]);
 }
 return r;
}
function onPayMode(which, el) {
 var m = document.getElementById("opt_paymode");
 if (!m) return;
 m.value = el.checked ? which : "";
 var other = document.getElementById(which === "prev" ? "chk_paydate" : "chk_payprev");
 if (el.checked && other) other.checked = false;
 if (which === "date" && el.checked) {
  var d = document.getElementById("opt_paydate");
  if (d && !d.value.trim()) setTimeout(function() { d.focus(); }, 30);
 }
 m.dispatchEvent(new Event("input", { bubbles: true }));
}
function syncPayModeUi_v08_unused(/* 원본에서 v09 같은 이름 함수가 뒤에 다시 나와 덮어씀 — 모듈은 중복 선언이 안 돼 이름만 바꿈 */ pv) {
 var o = pv.opts || {}, a = document.getElementById("chk_payprev"), b = document.getElementById("chk_paydate"), d = document.getElementById("opt_paydate");
 if (a) a.checked = o.payMode === "prev";
 if (b) b.checked = o.payMode === "date";
 if (d) d.disabled = o.payMode !== "date";
 var nm = (document.getElementById("case_name") || {}).value || "", pc = prevLiveCase(currentCaseId, nm, [ currentCaseId ]);
 var pn = document.getElementById("payPrevName");
 if (pn) pn.textContent = pc ? "(" + pc.name + ")" : "(저장된 직전 라이브 없음)";
 if (a) a.disabled = !pc && o.payMode !== "prev";
 var note = document.getElementById("payModeNote"), bd = _mdOfIso(broadcastDateStr(pv)) || "방송일 미확인";
 if (note) note.innerHTML = o.payMode === "prev" ? "직전 라이브의 결제혜택·유의사항을 <b>그대로</b> 씁니다. 이번 판촉의 결제혜택 원문은 쓰지 않습니다." : o.payMode === "date" ? "판촉안 내용을 <b>" + (_mdOfIso(_isoOfMD(o.payDate)) || "반영 일자") + "</b> 기준으로 반영합니다 (그 날짜에 진행 중인 혜택만). 방송일: " + bd : "기본: 판촉안 내용을 <b>방송일 " + bd + "</b> 기준으로 반영합니다.";
}

/* ── v09: 결제혜택 카드 정리 (반영 기준 3택 + 상태 1줄 + 결제혜택 인식 결과 분리) ── */
function setPayMode(m) {
 var a = document.getElementById("chk_payprev"), b = document.getElementById("chk_paydate");
 if (m === "prev") { if (a) a.checked = true; onPayMode("prev", a); }
 else if (m === "date") { if (b) b.checked = true; onPayMode("date", b); }
 else {
  if (a) a.checked = false;
  if (b) b.checked = false;
  var h = document.getElementById("opt_paymode");
  if (h) { h.value = ""; h.dispatchEvent(new Event("input", { bubbles: true })); }
 }
}
function syncPayModeUi(pv) {
 var o = pv.opts || {}, mode = o.payMode === "prev" || o.payMode === "date" ? o.payMode : "";
 var a = document.getElementById("chk_payprev"), b = document.getElementById("chk_paydate");
 if (a) a.checked = mode === "prev";
 if (b) b.checked = mode === "date";
 var nm = (document.getElementById("case_name") || {}).value || "", pc = prevLiveCase(currentCaseId, nm, [ currentCaseId ]);
 [].slice.call(document.querySelectorAll("#paySeg button")).forEach(function(x) {
  x.classList.toggle("on", x.getAttribute("data-m") === mode);
  x.setAttribute("aria-checked", String(x.getAttribute("data-m") === mode));
 });
 var sp = document.getElementById("segPrev");
 if (sp) sp.disabled = !pc && mode !== "prev";
 var pn = document.getElementById("payPrevName");
 if (pn) pn.textContent = pc ? pc.name : "저장된 직전 라이브 없음";
 var dr = document.getElementById("payDateRow"), d = document.getElementById("opt_paydate");
 if (dr) dr.style.display = mode === "date" ? "" : "none";
 if (d) d.disabled = mode !== "date";
 var src = document.getElementById("paySrcBox");
 if (src) src.style.display = mode === "prev" ? "none" : "";
 var pi = payWashInfo(pv), bd = _mdOfIso(broadcastDateStr(pv)) || "방송일 미확인";
 var basis = pi.ds ? _mdOfIso(pi.ds) : "";
 var st = document.getElementById("payState"), note = document.getElementById("payModeNote");
 var stTxt, stCls = pi.res ? "ok" : pi.has ? "warn" : "off";
 if (mode === "prev") stTxt = pc ? "직전 라이브 동일 · " + pc.name + (basis ? " (" + basis + " 기준)" : "") : "직전 라이브 없음";
 else if (mode === "date") stTxt = "판촉안 · " + (basis && pi.dsLabel === "반영 일자" ? basis : "반영 일자 미입력") + " 기준";
 else stTxt = "판촉안 · 방송일 " + bd + " 기준";
 if (!pi.has && !(pv.paymentFullText || "").trim()) { stTxt += " · 결제혜택 원문 없음"; stCls = "warn"; } else if (!pi.has) stCls = "ok";
 if (st) { st.textContent = stTxt; st.className = "payState " + stCls; }
 if (note) note.textContent = mode === "prev" ? "직전 라이브가 실제로 쓴 결제혜택·유의사항을 그대로 씁니다. 이번 판촉의 결제혜택 원문은 쓰지 않습니다." : mode === "date" ? "판촉안 결제혜택 중 반영 일자에 진행 중인 혜택만 씁니다. (방송일 " + bd + ")" : "판촉안 결제혜택 중 방송일에 진행 중인 혜택만 씁니다.";
}
function payChipsHtml(pv) {
 var _pwi = payWashInfo(pv), h = "", today = new Date;
 var srcTxt = _pwi.src ? String(_pwi.src).replace(/\s*·\s*[0-9.()월화수목금토일]+\s*기준$/, "") : "";
 if (_pwi.res) {
  if (srcTxt) h += _chip("info", "원문: " + srcTxt);
  (_pwi.sum || []).forEach(function(x) {
   if (/^결제혜택·유의사항:/.test(x.m)) return;
   h += _chip(x.k === "warn" ? "warn" : x.k === "skip" ? "info" : "ok", x.m);
  });
 } else if (_pwi.has) {
  h += _chip("warn", _pwi.warn || "결제혜택 워싱을 적용하지 못했습니다");
  (_pwi.sum || []).filter(function(x) { return x.k === "warn"; }).forEach(function(x) { h += _chip("warn", x.m); });
 } else {
  var payItems = pv.paymentFullText ? splitPaymentItems(pv.paymentFullText) : [];
  h += payItems.length ? _chip("ok", "결제혜택 " + payItems.length + "건") : _chip("warn", "결제혜택 원문 없음 — 판촉 원문 'LGE닷컴 전사 판촉' 또는 결제혜택 수급 원문을 넣어 주세요");
 }
 var secs = matchedNotices(pv), curQ = Math.floor(today.getMonth() / 3) + 1, notes = [];
 if (secs.length) h += _chip("ok", "카드사 세부 유의사항 " + secs.length + "종");
 secs.forEach(function(sec) {
  sec.bullets.forEach(function(b) {
   var qm = b.match(/([1-4])분기\s*정책/);
   if (qm && Number(qm[1]) !== curQ && notes.indexOf("q") < 0) { notes.push("q"); h += _chip("info", "무이자 표준 문구에 \"" + qm[1] + "분기 정책\" 표기 — 현행 노출 문구와 같지만 카드사 정책 변경 시 최신 기획서와 대조"); }
   var em = b.match(/심의필[^()]*\([0-9.]+~\s*(\d{4})\.(\d{2})\.(\d{2})\)/);
   if (em) {
    var days = Math.floor((new Date(+em[1], +em[2] - 1, +em[3]) - today) / 864e5);
    if (days < 0) h += _chip("bad", "신한 심의필 유효기간(" + em[1] + "." + em[2] + "." + em[3] + ") 만료 — 최신 심의번호로 교체 필요");
    else if (days <= 45) h += _chip("warn", "신한 심의필 유효기간 " + days + "일 남음(" + em[1] + "." + em[2] + "." + em[3] + ")");
   }
  });
 });
 return h;
}
function renderPaySummaryBox(pv) {
 var box = document.getElementById("paySummary");
 if (!box) return;
 var tmp = document.createElement("div");
 tmp.innerHTML = payChipsHtml(pv);
 var okH = "", alH = "", okN = 0, alN = 0;
 [].slice.call(tmp.children).forEach(function(el) {
  if (el.classList.contains("ok") || el.classList.contains("info")) { okH += el.outerHTML; okN++; } else { alH += el.outerHTML; alN++; }
 });
 box.innerHTML = '<div class="psHead"><span class="psLine">결제혜택 인식 ' + okN + "항목 정상" + (alN ? ' · <b style="color:#8a5a00;">확인 필요 ' + alN + "건</b>" : "") + "</span></div>" + (alH ? '<div class="parseSummary">' + alH + "</div>" : "") + (okH ? '<details class="psDetails"><summary>포함·제외 내역 보기</summary><div class="parseSummary">' + okH + "</div></details>" : "");
}

/* ── v09: 변경 하이라이트 — 이전 버전 대비 바뀐 판촉·결제혜택·유의사항을 워싱본에 배경색으로 표시 ── */
var HL_UNITS = [ [ "KV", "#secKv .mockKvDate, #secKv .mockKvMain, #secKv .mockKvSub" ], [ "알림 신청", "#secNotify .mockEventCard" ], [ "재방송", "#secRebro .mockRebroCard" ], [ "한정 혜택", "#secLive .mockBenefitRow" ], [ "한정 혜택 안내", "#secLive .mockCaption" ], [ "OBS", "#secObs .mockLinkWrap" ], [ "결제혜택", "#secPay .mockPayHero2, #secPay .mockPayRow2" ], [ "유의사항", "#secLegal .legalBullet, #secLegal .legalHeading" ] ];
var HL_OFF = false, _hlCache = { k: null, t: null };
function _hlText(el) {
 var c = el.cloneNode(true);
 [].slice.call(c.querySelectorAll(".reviewOnly,.addCtl,.missChip,.kvCnt,.addDel")).forEach(function(x) { x.parentNode.removeChild(x); });
 var t = c.textContent;
 if (el.classList.contains("mockLinkWrap")) {
  var u = el.querySelector(".mockLinkUrl");
  if (u) t += " " + u.textContent.split(" · ")[0];
 }
 return t.replace(/\s+/g, " ").trim();
}
function _hlCollect(root) {
 var out = {};
 HL_UNITS.forEach(function(u) {
  out[u[0]] = [].slice.call(root.querySelectorAll(u[1])).map(function(el) { return { el: el, t: _hlText(el) }; });
 });
 return out;
}
function hlBaseline() {
 var c = currentCase();
 if (!c || !c.promoVersions || !c.promoVersions.length) return null;
 var vs = c.promoVersions, last = vs[vs.length - 1];
 if (isDirty()) return { v: last, label: "저장본 v" + last.version + " 대비" };
 if (vs.length >= 2) return { v: vs[vs.length - 2], label: "v" + vs[vs.length - 2].version + " → v" + last.version };
 return null;
}
function pvFromVersion(v) {
 var name = (document.getElementById("case_name") || {}).value || "", o = Object.assign(defaultOpts(name), v.opts || {}), raw = v.rawText || "";
 var cut = (o.paySheet || "").trim() ? -1 : raw.search(/^[ \t]*1\.[ \t]*결제일[ \t]*할인/m);
 LIVE_DEF_LABEL = liveDefaultLabel(name, (jparse(o.kv, {}) || {}).m);
 var parsed = applyHidden(parseRawToStructured(cut > 0 ? raw.slice(0, cut) : raw, loadObsBank()), o);
 parsed.notify.deadline = computeDeadlineFromCaseName(name);
 var pv = { notify: parsed.notify, liveItems: parsed.liveItems, obsCards: parsed.obsCards, paymentFullText: parsed.paymentFullText, legalNotes: parsed.legalNotes, rawText: raw, sourceChannel: v.sourceChannel || "", opts: o };
 pv.obsShow = obsShowCards(pv);
 return applyCardOrder(pv);
}
function _hlBaseTexts(base, curPv) {
 var key = currentCaseId + "|" + base.v.version + "|" + base.v.savedAt + "|" + ((document.getElementById("case_name") || {}).value || "") + "|" + JSON.stringify(loadObsBank()).length;
 if (_hlCache.k === key) return _hlCache.t;
 var saved = LIVE_DEF_LABEL, t = null;
 try {
  var div = document.createElement("div");
  div.innerHTML = pageHtmlFix(renderMockPage(pvFromVersion(base.v)));
  var col = _hlCollect(div);
  t = {};
  Object.keys(col).forEach(function(k) { t[k] = col[k].map(function(x) { return x.t; }); });
 } catch (e) { t = null; }
 LIVE_DEF_LABEL = saved;
 setTxtState(curPv);
 _hlCache = { k: key, t: t };
 return t;
}
function pageHighlight(pv) {
 var wrap = document.getElementById("washVisual"), bar = document.getElementById("hlBar");
 if (!wrap) return;
 [].slice.call(wrap.querySelectorAll(".hlChg")).forEach(function(x) { x.classList.remove("hlChg"); });
 var base = hlBaseline(), db = document.getElementById("diffBar");
 if (!bar && db) { bar = document.createElement("div"); bar.id = "hlBar"; db.parentNode.insertBefore(bar, db.nextSibling); }
 if (!base) { if (bar) bar.innerHTML = ""; return; }
 var bt = _hlBaseTexts(base, pv);
 if (!bt) { if (bar) bar.innerHTML = ""; return; }
 var cur = _hlCollect(wrap), total = 0, removed = 0, parts = [];
 Object.keys(cur).forEach(function(k) {
  var pool = (bt[k] || []).slice(), n = 0;
  cur[k].forEach(function(u) {
   var i = pool.indexOf(u.t);
   if (i >= 0) pool.splice(i, 1); else { u.el.classList.add("hlChg"); var dm = u.el.closest(".dimmable"); if (dm) dm.classList.add("chgd"); n++; }
  });
  var del = Math.max(0, (bt[k] || []).length - cur[k].length);
  removed += del;
  if (n || del) parts.push(k + (n ? " " + n : "") + (del ? " (삭제 " + del + ")" : ""));
  total += n;
 });
 document.body.classList.toggle("hlOff", HL_OFF);
 if (bar) bar.innerHTML = total || removed ? '<div class="hlInfo"><span class="hlSw"></span><b>변경 하이라이트 ' + total + "곳</b>" + (removed ? " · 빠진 항목 " + removed + "곳" : "") + " <span>(" + escapeHtml(base.label) + ")</span><span class=\"hlParts\">" + escapeHtml(parts.join(" · ")) + '</span><a onclick="HL_OFF=!HL_OFF;document.body.classList.toggle(\'hlOff\',HL_OFF);this.textContent=HL_OFF?\'하이라이트 켜기\':\'하이라이트 끄기\'">' + (HL_OFF ? "하이라이트 켜기" : "하이라이트 끄기") + "</a></div>" : '<div class="hlInfo none">' + escapeHtml(base.label) + " · 페이지 문구 변경 없음</div>";
}

/* ── v13: 한정 혜택·OBS 카드 드래그 앤 드롭 순서 변경 — opts.order = { live:[키], obs:[키] } ──
   한정 혜택 키: "p:"+원문 혜택(자동 인식) / "a:"+n(직접 추가)  ·  OBS 키: obsOrderKey(r) */
function orderState(o) {
 var s = jparse(o && o.order, {}) || {};
 if (!Array.isArray(s.live)) s.live = [];
 if (!Array.isArray(s.obs)) s.obs = [];
 return s;
}
function obsOrderKey(r) {
 if (r[4] === "hidden") return "h:" + (r._hn || 1);
 if (r[4] === "hidden2") return "h2";
 if (r[4] === "fixed") return "f:" + (r[0] || r[3] || "");
 if (r[4] === "added") return "a:" + r._ai;
 return "u:" + obsHideKey(r);
}
function _sortByKeys(list, keyOf, keys) {
 if (!keys.length) return list;
 return list.map(function(x, i) { var k = keys.indexOf(keyOf(x)); return { x: x, s: k >= 0 ? k : 1e4 + i }; }).sort(function(a, b) { return a.s - b.s; }).map(function(o) { return o.x; });
}
function applyCardOrder(pv) {
 var s = orderState(pv.opts);
 var pk = s.live.filter(function(k) { return /^p:/.test(k); });
 if (pk.length) pv.liveItems = _sortByKeys(pv.liveItems || [], function(it) { return "p:" + it.benefit; }, pk);
 if (s.obs.length && pv.obsShow) pv.obsShow = _sortByKeys(pv.obsShow, obsOrderKey, s.obs);
 return pv;
}
/* 직접 추가 혜택은 자동 인식 카드 사이에 끼울 수 있도록 화면 순서를 맞춤 */
function placeLiveCards(pv) {
 var list = document.querySelector("#secLive .mockBenefitList");
 if (!list) return;
 var keys = orderState(pv.opts).live;
 var items = [].slice.call(list.children).filter(function(e) { return e.classList.contains("mockAddWrap"); });
 if (!keys.length || !items.length) return;
 _sortByKeys(items, function(e) { return e.getAttribute("data-ok"); }, keys).forEach(function(e) { list.appendChild(e); });
}
function commitCardOrder(kind) {
 var sel = kind === "live" ? "#secLive .mockBenefitList > .mockAddWrap" : "#secObs .mockLinkList > .mockLinkWrap";
 var keys = [].slice.call(document.querySelectorAll(sel)).map(function(e) { return e.getAttribute("data-ok"); }).filter(Boolean);
 var s = orderState({ order: (document.getElementById("opt_order") || {}).value });
 if (kind === "live") {
  /* 아이콘 직접 선택값(자동 인식 카드 순번 기준)을 새 순서로 옮김 */
  var pv = collectFormValues(), oldKeys = (pv.liveItems || []).map(function(it) { return "p:" + it.benefit; });
  var newKeys = keys.filter(function(k) { return /^p:/.test(k); }), li = optGet("opt_liveicon") || {}, n = {};
  Object.keys(li).forEach(function(i) { var j = newKeys.indexOf(oldKeys[Number(i)]); if (j >= 0) n[j] = li[i]; });
  var e = document.getElementById("opt_liveicon");
  if (e) e.value = Object.keys(n).length ? JSON.stringify(n) : "";
 }
 s[kind] = keys;
 optSet("opt_order", s.live.length || s.obs.length ? s : null);
 showToast(kind === "live" ? "한정 혜택 순서를 바꿨습니다" : "OBS 배너 순서를 바꿨습니다");
}
function resetCardOrder() {
 var s = orderState({ order: (document.getElementById("opt_order") || {}).value }), pv = collectFormValues();
 /* 원래 순서로: 아이콘 선택값도 원문 순서 기준으로 되돌림 */
 var cur = (pv.liveItems || []).map(function(it) { return "p:" + it.benefit; });
 var o2 = Object.assign({}, pv.opts, { order: "" }), base = applyHidden(parseRawToStructured(pv.rawText || "", loadObsBank()), o2);
 var orig = (base.liveItems || []).map(function(it) { return "p:" + it.benefit; }), li = optGet("opt_liveicon") || {}, n = {};
 Object.keys(li).forEach(function(i) { var j = orig.indexOf(cur[Number(i)]); if (j >= 0) n[j] = li[i]; });
 var e = document.getElementById("opt_liveicon");
 if (e) e.value = Object.keys(n).length ? JSON.stringify(n) : "";
 optSet("opt_order", null);
}
/* 직접 추가 혜택·배너 삭제 시 순서 키(a:n) 보정 */
function _shiftAddKeys(kind, i) {
 var s = orderState({ order: (document.getElementById("opt_order") || {}).value });
 if (!s[kind].length) return;
 s[kind] = s[kind].filter(function(k) { return k !== "a:" + i; }).map(function(k) { var m = k.match(/^a:(\d+)$/); return m && +m[1] > i ? "a:" + (+m[1] - 1) : k; });
 var e = document.getElementById("opt_order");
 if (e) e.value = s.live.length || s.obs.length ? JSON.stringify(s) : "";
}
var _delAddLiveV12 = delAddLive;
delAddLive = function(i) { _shiftAddKeys("live", i); _delAddLiveV12(i); };
var _delAddObsV12 = delAddObs;
delAddObs = function(i) { _shiftAddKeys("obs", i); _delAddObsV12(i); };

/* 드래그 핸들 · 드롭 위치 표시 */
function addDragHandles() {
 [ [ "#secLive .mockBenefitList > .mockAddWrap", "live" ], [ "#secObs .mockLinkList > .mockLinkWrap", "obs" ] ].forEach(function(x) {
  [].slice.call(document.querySelectorAll(x[0])).forEach(function(w) {
   if (w.querySelector(":scope > .dragH")) return;
   var h = document.createElement("span");
   h.className = "dragH reviewOnly";
   h.setAttribute("draggable", "true");
   h.setAttribute("data-kind", x[1]);
   h.title = "드래그해서 순서 변경";
   h.textContent = "⋮⋮";
   w.insertBefore(h, w.firstChild);
   w.classList.add("dndItem");
  });
 });
}
var _dnd = null;
document.addEventListener("dragstart", function(e) {
 var h = e.target && e.target.closest && e.target.closest(".dragH");
 if (!h) return;
 var item = h.parentNode;
 _dnd = { item: item, kind: h.getAttribute("data-kind") };
 item.classList.add("dragging");
 try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "card"); e.dataTransfer.setDragImage(item, 20, 20); } catch (err) {}
});
document.addEventListener("dragover", function(e) {
 if (!_dnd) return;
 var t = e.target && e.target.closest && e.target.closest(".dndItem");
 if (!t || t === _dnd.item || t.parentNode !== _dnd.item.parentNode) return;
 e.preventDefault();
 var r = t.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
 [].slice.call(t.parentNode.querySelectorAll(".dropB,.dropA")).forEach(function(x) { x.classList.remove("dropB", "dropA"); });
 t.classList.add(after ? "dropA" : "dropB");
});
document.addEventListener("drop", function(e) {
 if (!_dnd) return;
 var t = e.target && e.target.closest && e.target.closest(".dndItem");
 if (t && t !== _dnd.item && t.parentNode === _dnd.item.parentNode) {
  e.preventDefault();
  var after = t.classList.contains("dropA");
  t.parentNode.insertBefore(_dnd.item, after ? t.nextSibling : t);
  var k = _dnd.kind;
  _dndEnd();
  commitCardOrder(k);
 }
});
function _dndEnd() {
 if (_dnd && _dnd.item) _dnd.item.classList.remove("dragging");
 [].slice.call(document.querySelectorAll(".dropB,.dropA")).forEach(function(x) { x.classList.remove("dropB", "dropA"); });
 _dnd = null;
}
document.addEventListener("dragend", _dndEnd);
function renderOrderNote(pv) {
 var box = document.getElementById("hideBox");
 if (!box) return;
 var s = orderState(pv.opts), old = document.getElementById("orderNote");
 if (old) old.parentNode.removeChild(old);
 if (!s.live.length && !s.obs.length) return;
 var d = document.createElement("div");
 d.id = "orderNote";
 d.className = "hideItem";
 d.style.marginTop = "12px";
 d.innerHTML = '<span class="k">순서</span><span>' + [ s.live.length && "한정 혜택", s.obs.length && "OBS 배너" ].filter(Boolean).join(" · ") + ' 순서를 직접 바꾼 상태입니다</span><button type="button" class="btn small secondary" onclick="resetCardOrder()">원래 순서로</button>';
 box.parentNode.insertBefore(d, box);
}

/* ===================================================================
   통합셋팅기 v13 — 2단계 흐름 (① 판촉·페이지 셋팅 → ② 배너 워싱) — v13에서 판촉 업데이트·페이지 수정 단계 통합
   - 앞 단계로 넘어갈 때 저장 안 된 변경이 있으면 "저장(새 버전)"과 같은 동작 후 이동
   - 뒤로 갈 때는 저장하지 않음(미저장 표시 유지)
   =================================================================== */
var STEP = 1;
var STEP_NAMES = { 1: "판촉·페이지 셋팅", 2: "배너 워싱" };
var STEP_MAX = 2;

function setStepUi() {
 document.body.classList.remove("step1", "step2");
 document.body.classList.add("step" + STEP);
 [].slice.call(document.querySelectorAll(".stp")).forEach(function(b) {
  var s = Number(b.getAttribute("data-s"));
  b.classList.toggle("on", s === STEP);
  b.classList.toggle("done", s < STEP);
  b.disabled = !currentCaseId;
  b.setAttribute("aria-current", s === STEP ? "step" : "false");
 });
 var prev = document.getElementById("navPrev"), next = document.getElementById("navNext"), note = document.getElementById("navNote");
 if (prev) prev.style.visibility = STEP > 1 ? "visible" : "hidden";
 if (next) {
  next.style.display = STEP < STEP_MAX ? "" : "none";
  next.textContent = STEP < STEP_MAX ? "다음: " + STEP_NAMES[STEP + 1] + " →" : "";
 }
 if (note) note.textContent = STEP < STEP_MAX ? "넘어가도 저장되지 않음 · 최종 저장은 배너 워싱에서" : "최종 저장해야 새 버전이 만들어집니다";
 var fs = document.getElementById("navSave");
 if (fs) fs.style.display = STEP === STEP_MAX ? "" : "none";
}

function goStep(n) {
 n = Number(n);
 if (!(n >= 1 && n <= STEP_MAX)) return;
 if (!currentCaseId) {
  showToast("먼저 방송을 선택하거나 새로 만들어 주세요.");
  return;
 }
 if (n === STEP) return;
 var ae = document.activeElement;
 if (ae && ae.blur && ae !== document.body) ae.blur();
 STEP = n;
 setStepUi();
 renderWashVisual();
 window.scrollTo(0, 0);
}

function onCaseShown(on) {
 document.body.classList.toggle("noCase", !on);
 var es = document.getElementById("emptyState");
 if (es) es.style.display = on ? "none" : "";
 var sb = document.getElementById("saveBtn");
 if (sb) sb.disabled = !on;
 STEP = 1;
 setStepUi();
}

/* 워싱본 렌더 직후 훅 (renderWashVisual 끝에서 호출) */
function afterWashRender(pv) {
 syncKvForm(pv);
 renderHideBox(pv);
 placeLiveCards(pv);
 addDragHandles();
 renderOrderNote(pv);
 renderKvCount(pv);
 syncPayModeUi(pv);
 renderPaySummaryBox(pv);
 pageHighlight(pv);
 var bn = document.getElementById("bdateNote");
 if (bn) {
  var d = parseDateFromCaseName((document.getElementById("case_name") || {}).value || "");
  bn.innerHTML = d ? "방송일: <b>" + fmtMD(d.month, d.day) + "</b> (방송명에서 자동)" : '<span style="color:#a12020;font-weight:700;">방송명에 날짜가 없습니다</span> → ⋯ 더보기 → 방송명 수정에서 "10/22 …"처럼 앞에 날짜를 넣어 주세요';
 }
 if (STEP === 2) renderBanners(pv);
}

/* ── ② KV 카피 폼 (워싱본 KV 영역과 같은 값: opts.kv) ── */
function syncKvForm(pv) {
 var k = kvInfo(pv);
 [ [ "kvM", "m" ], [ "kvS", "s" ], [ "kvD", "d" ], [ "kvM3", "m" ], [ "kvS3", "s" ] ].forEach(function(x) {
  var e = document.getElementById(x[0]);
  if (e && document.activeElement !== e && e.value !== k[x[1]]) e.value = k[x[1]];
 });
 kvCounters();
}

function kvCounters() {
 function one(id, lim) {
  var e = document.getElementById(id), cc = document.getElementById(id + "cc");
  if (!e || !cc) return;
  var n = e.value.trim().length;
  cc.textContent = n + " / " + lim + "자" + (n > lim ? " · " + (n - lim) + "자 초과" : "");
  cc.className = "cc " + (n > lim ? "warn" : n ? "ok" : "");
  var cd = document.getElementById(id + "cand"), ls = bnTrimCands(e.value, lim);
  if (cd) {
   if (ls.length) {
    cd.classList.add("show");
    cd.innerHTML = "<b>축약 제안</b>" + ls.map(function(s) {
     return '<button type="button" data-v="' + _attr(s) + '" onclick="kvPick(\'' + id + "',this.getAttribute('data-v'))\">" + escapeHtml(s) + " (" + s.length + "자)</button>";
    }).join("");
   } else {
    cd.classList.remove("show");
    cd.innerHTML = "";
   }
  }
 }
 one("kvM", BN_LIM.keyMain);
 one("kvS", BN_LIM.keySub);
 one("kvM3", BN_LIM.keyMain);
 one("kvS3", BN_LIM.keySub);
 var a = document.getElementById("kvMlim"), b = document.getElementById("kvSlim");
 if (a) a.textContent = BN_LIM.keyMain;
 if (b) b.textContent = BN_LIM.keySub;
}

function kvPick(id, v) {
 var e = document.getElementById(id);
 if (!e) return;
 e.value = v;
 onKvForm(/^kvM/.test(id) ? "m" : "s", e);
}

function onKvForm(f, el) {
 var k = kvInfo({ opts: collectOpts() });
 var orig = f === "d" ? k.dateAuto : f === "m" ? k.mainAuto : "";
 var v = el.value.replace(/\s+/g, " ").trim(), ov = optGet("opt_kv") || {};
 if (v === orig) delete ov[f]; else ov[f] = v;
 optSet("opt_kv", ov);
 [ [ "kvM", "m" ], [ "kvS", "s" ], [ "kvM3", "m" ], [ "kvS3", "s" ] ].forEach(function(x) {
  var e = document.getElementById(x[0]);
  if (e && e !== el && x[1] === f) e.value = el.value;
 });
 kvCounters();
}

/* ── 설정 · 관리 서랍 ── */
function openDrawer(sec) {
 document.getElementById("drawerOv").hidden = false;
 document.getElementById("drawer").hidden = false;
 sec = sec || "obs";
 [].slice.call(document.querySelectorAll("#drawer .dsec")).forEach(function(s) {
  s.classList.toggle("on", s.getAttribute("data-d") === sec);
 });
 [].slice.call(document.querySelectorAll("#drawer .dtabs .tab")).forEach(function(t) {
  t.classList.toggle("on", t.getAttribute("data-d") === sec);
 });
 if (sec === "lim") bnBuildLim();
 if (sec === "obs") renderObsBankList();
}

function closeDrawer() {
 document.getElementById("drawerOv").hidden = true;
 document.getElementById("drawer").hidden = true;
}

document.addEventListener("keydown", function(e) {
 if (e.key === "Escape") {
  var d = document.getElementById("drawer");
  if (d && !d.hidden) closeDrawer();
 }
});

/* v13: 버전은 ② 배너 워싱의 "최종 저장(확정)"에서만 생성 (단계 이동은 저장하지 않음) */
function finalSave() {
 if (!currentCaseId) { showToast("먼저 방송을 선택하거나 새로 만들어 주세요."); return; }
 if (STEP !== STEP_MAX) { goStep(STEP_MAX); showToast("배너 카피까지 확인한 뒤 최종 저장해 주세요"); return; }
 var ae = document.activeElement;
 if (ae && ae.blur && ae !== document.body) ae.blur();
 if (!isDirty()) { showToast("바뀐 내용이 없어 새 버전을 만들지 않았습니다"); return; }
 savePromo();
 var c = currentCase();
 showToast("v" + (c ? c.promoVersions.length : "") + " 최종 저장 완료 (페이지 + 배너)");
}

/* ===================================================================
   ② 배너 워싱 — 라이브 배너 카피 생성기 v18 규칙 이식
   입력: ② 페이지의 KV 카피(opts.kv) · 방송명 날짜 · 방송 시간 · 재방송
   저장: opts.bn (JSON) = { prod, prodS, pt, pst, rt, r1, r2, r3, mx, cb, ed:{행키:{o,v}} }
         ed.o = 수정 당시 자동 카피, ed.v = 직접 수정 문구 → KV가 바뀌면 "자동 카피가 바뀜" 안내
   =================================================================== */
var BN_LIM_DEF = { keyMain: 15, keySub: 28, heroMain: 18, heroSub: 28, homeHeroMain: 12, homeHeroSub: 24, pr1: 20, pr2: 20, bt1: 14, pop1: 12, th1: 16, th2: 15, sn1: 16, sn2: 15, in1: 18, in2: 18 };
var BN_LIM_L = { keyMain: "KV 카피 메인", keySub: "KV 카피 서브", heroMain: "라이브 히어로 메인", heroSub: "라이브 히어로 서브", homeHeroMain: "홈메인 히어로 메인", homeHeroSub: "홈메인 히어로 서브", pr1: "상단홍보 1줄", pr2: "상단홍보 2줄", bt1: "바텀시트(MO) 메인카피", pop1: "팝업(PC) 메인카피", th1: "썸네일 1줄", th2: "썸네일 2줄", sn1: "SNS 1줄", sn2: "SNS 2줄", in1: "인사이더 1줄", in2: "인사이더 2줄" };
var BN_LIM_KEY = "lts_bn_lim_v1";
var BN_LIM = (function() {
 var o = Object.assign({}, BN_LIM_DEF);
 try {
  var s = JSON.parse(localStorage.getItem(BN_LIM_KEY) || "{}") || {};
  Object.keys(o).forEach(function(k) {
   if (Number(s[k]) > 0) o[k] = Number(s[k]);
  });
 } catch (e) {}
 return o;
})();
var BN_PD = [
 { l: "에어컨", k: [ "에어컨", "휘센" ], f: "LG 휘센 에어컨" },
 { l: "냉장고", k: [ "냉장고", "디오스" ], f: "LG 디오스 냉장고" },
 { l: "세탁기", k: [ "세탁기", "트롬", "워시타워", "워시콤보" ], f: "LG 트롬 세탁기" },
 { l: "건조기", k: [ "건조기" ], f: "LG 트롬 건조기" },
 { l: "제습기", k: [ "제습기" ], f: "LG 휘센 제습기" },
 { l: "스타일러", k: [ "스타일러" ], f: "LG 스타일러" },
 { l: "공기청정기", k: [ "공기청정기", "퓨리케어" ], f: "LG 퓨리케어 공기청정기" },
 { l: "정수기", k: [ "정수기" ], f: "LG 퓨리케어 정수기" },
 { l: "식기세척기", k: [ "식기세척기" ], f: "LG 디오스 식기세척기" },
 { l: "인덕션", k: [ "인덕션" ], f: "LG 디오스 인덕션" },
 { l: "광파오븐", k: [ "광파오븐" ], f: "LG 디오스 광파오븐" },
 { l: "TV", k: [ "TV", "올레드", "OLED", "QNED" ], f: "LG TV" },
 { l: "노트북", k: [ "노트북", "그램" ], f: "LG 그램 노트북" },
 { l: "사운드바", k: [ "사운드바" ], f: "LG 사운드바" },
 { l: "청소기", k: [ "청소기", "코드제로" ], f: "LG 코드제로 청소기" },
 { l: "침대", k: [ "침대", "시몬스", "매트리스" ], f: "시몬스 침대" },
 { l: "소파", k: [ "소파", "알로소" ], f: "알로소 소파" },
 { l: "주방가전", k: [ "주방가전" ], f: "LG 주방가전" },
 { l: "가전", k: [ "가전" ], f: "LG 가전" }
];
/* 축약명 카테고리: 제품군이 아래 제품 2개 이상으로만 이루어지면 카테고리명으로 축약 */
var BN_KITCHEN_SET = [ "냉장고", "인덕션", "광파오븐", "식기세척기" ];
var BN_LIVING_SET = [ "세탁기", "스타일러", "청소기", "건조기" ];

function bnShorten(t, lim) {
 t = (t || "").trim().replace(/\s+/g, " ");
 if (!t || t.length <= lim) return t;
 var steps = [ function(x) { return x.replace(/^LG\s+/, ""); }, function(x) { return x.replace(/베스트 특집/, "특집"); }, function(x) { return x.replace(/할인 혜택/, "혜택"); } ];
 var cur = t;
 for (var i = 0; i < steps.length; i++) {
  cur = steps[i](cur).trim();
  if (cur.length <= lim) return cur;
 }
 var tk = cur.split(" ");
 for (var j = 1; j < tk.length; j++) {
  if (/^[&+·ㆍ・\/,]$/.test(tk[j])) continue;
  var s = tk.slice(j).join(" ");
  if (s.length <= lim) return s;
 }
 return cur;
}

function bnTrimCands(t, lim) {
 t = (t || "").trim().replace(/\s+/g, " ");
 if (t.length <= lim) return [];
 var tk = t.split(" "), cs = [], i;
 function add(x) { if (cs.indexOf(x) < 0) cs.push(x); }
 for (i = 1; i < tk.length; i++) add(tk.slice(i).join(" "));
 for (i = tk.length - 1; i >= 1; i--) add(tk.slice(0, i).join(" "));
 if (t.indexOf(",") >= 0) {
  var p = t.split(",").map(function(s) { return s.trim(); });
  if (p.length > 1) { add(p.slice(1).join(" ").trim()); add(p[0]); }
 }
 var sub = t.replace(/^LG\s*/, "").replace(/베스트 특집/, "특집").replace(/할인 혜택/, "혜택").replace(/\s+/g, " ").trim();
 if (sub && sub !== t) add(sub);
 var v = cs.filter(function(c) { return c.length > 0 && c.length <= lim && !/^[&+·ㆍ・\/,]/.test(c); });
 v.sort(function(a, b) { return b.length - a.length; });
 return v.slice(0, 5);
}

/* KV 카피에서 제품군·축약명·할인율 자동 인식 (v18 autoFill과 같은 규칙) */
function bnAuto(main, sub) {
 var raw = (main || "") + " " + (sub || ""), txt = raw.toUpperCase(), out = { prod: "", prodS: "", r: [ "", "", "" ], mx: /최대/.test(raw) };
 var mt = BN_PD.filter(function(p) { return p.k.some(function(k) { return txt.indexOf(k.toUpperCase()) >= 0; }); });
 if (mt.length > 1) {
  var ls0 = mt.map(function(m) { return m.l; });
  mt = mt.filter(function(m) { return !ls0.some(function(o) { return o !== m.l && o.indexOf(m.l) >= 0; }); });
 }
 var GENERIC = [ "가전", "주방가전" ];
 if (mt.length > 1) {
  var specific = mt.filter(function(m) { return GENERIC.indexOf(m.l) < 0; });
  if (specific.length) mt = specific;
 }
 if (mt.length === 1) {
  out.prod = mt[0].f;
  out.prodS = mt[0].l;
 } else if (mt.length > 1) {
  var sp = mt.map(function(m) {
   var b = null;
   m.k.forEach(function(k) {
    var i = txt.indexOf(k.toUpperCase());
    if (i >= 0 && (!b || i < b.i)) b = { i: i, e: i + k.length };
   });
   return { m: m, i: b ? b.i : 1e9, e: b ? b.e : 1e9 };
  }).sort(function(a, b) { return a.i - b.i; });
  var sep = "&";
  for (var x = 1; x < sp.length; x++) {
   if (sp[x].i < sp[x - 1].e) continue;
   var bt = raw.slice(sp[x - 1].e, sp[x].i), t = bt.trim();
   if (t.length === 1 && /[&·ㆍ・+\/,]/.test(t)) { sep = bt; break; }
  }
  var ls = sp.map(function(o) { return o.m.l; });
  var cat = ls.every(function(l) { return BN_KITCHEN_SET.indexOf(l) >= 0; }) ? "주방가전" : ls.every(function(l) { return BN_LIVING_SET.indexOf(l) >= 0; }) ? "리빙가전" : null;
  sep = "·"; /* v06: 제품 나열은 가운데점 필수 */
  out.prod = ls.join(sep);
  out.prodS = cat || ls.join(sep);
 }
 var rm = [], re = /(\d+)\s*%/g, m;
 while ((m = re.exec(raw))) rm.push(m[1]);
 for (var k = 0; k < 3; k++) if (rm[k] !== undefined) out.r[k] = rm[k];
 return out;
}

/* 페이지(①·②)에서 받아오는 값 */
function bnSource(pv) {
 var k = kvInfo(pv), o = pv.opts || {};
 var name = (document.getElementById("case_name") || {}).value || "";
 var d = parseDateFromCaseName(name) || parseDateFromCaseName(o.bdate || "");
 var ds = "", h = null, mi = 0, fromKv = false;
 var km = String(k.d || "").match(/([0-9]{1,2})\s*\.\s*([0-9]{1,2})\s*\(\s*([월화수목금토일])\s*\)\s*(오전|오후)?\s*([0-9]{1,2})\s*시(?:\s*([0-9]{1,2})\s*분)?/);
 if (km && Number(km[1]) >= 1 && Number(km[1]) <= 12) {
  ds = Number(km[1]) + "." + Number(km[2]) + "(" + km[3] + ")";
  h = Number(km[5]);
  if (km[4] === "오후" && h < 12) h += 12;
  if (km[4] === "오전" && h === 12) h = 0;
  mi = km[6] ? Number(km[6]) : 0;
  fromKv = !!(jparse(o.kv, {}) || {}).d;
 } else if (d) {
  ds = fmtMD(d.month, d.day);
  h = airInfo(pv).hour;
 }
 var hh = h === null ? 20 : h, ap = hh < 12 ? "오전" : "오후", h12 = hh % 12 === 0 ? 12 : hh % 12;
 var tl = ap + " " + h12 + "시" + (mi ? " " + mi + "분" : "");
 var ev = (hh >= 12 ? "저녁" : "오전") + " " + h12 + "시" + (mi ? " " + mi + "분" : "");
 return {
  main: String(k.m || "").replace(/\s+/g, " ").trim(),
  sub: String(k.s || "").replace(/\s+/g, " ").trim(),
  mainAuto: k.mainAuto,
  ds: ds,
  timeLabel: tl,
  evLabel: ev,
  full: ds ? ds + " " + tl : "",
  fromKv: fromKv,
  bc: o.rebro ? "재방송" : "라이브"
 };
}

function bnState(pv) {
 var s = jparse(pv && pv.opts && pv.opts.bn, {}) || {};
 if (!s.ed || typeof s.ed !== "object") s.ed = {};
 return s;
}

function bnInputs(pv) {
 var src = bnSource(pv), st = bnState(pv), au = bnAuto(src.main, src.sub);
 var I = Object.assign({}, src);
 I.auto = au;
 I.st = st;
 I.prodV = st.pt ? st.prod || "" : au.prod;
 I.prodSV = st.pst ? st.prodS || "" : au.prodS;
 if (st.rt) {
  I.r = [ st.r1 || "", st.r2 || "", st.r3 || "" ];
  I.mx = !!st.mx;
 } else {
  I.r = au.r.slice();
  I.mx = au.mx;
 }
 I.cb = st.cb || "";
 return I;
}

function bnBen(I) {
 if (I.cb.trim()) return I.cb.trim();
 var b = String(I.r[0] || "").trim(), cp = String(I.r[1] || "").trim(), cd = String(I.r[2] || "").trim();
 if (!b) return I.mx ? "최대 할인" : "";
 var s = (I.mx ? "최대 " : "") + b + "% 할인";
 if (cp) s += " + " + cp + "% 쿠폰";
 if (cd) s += " + " + cd + "% 카드";
 return s;
}

function bnGen(I) {
 var m = I.main, s = I.sub, b = I.bc, bn = bnBen(I);
 var p = I.prodV.trim() || "(입력 필요)", ps = I.prodSV.trim() || p;
 var prLine1 = I.full ? I.full + " LIVE" : "(날짜 입력 필요) LIVE";
 var bnPart = bn ? " " + bn : "";
 var bBn = bn ? b + bnPart : b;
 var AC = BN_PD[0];
 var isAC = I.prodV.trim() === AC.f || I.prodV.trim() === AC.l || I.prodSV.trim() === AC.l;
 var kv = function(lim) { return m ? bnShorten(m, lim) : "(입력 필요)"; };
 var tl = "오늘 " + I.timeLabel + ",";
 var btLim = Math.min(BN_LIM.pop1, BN_LIM.bt1);
 return {
  full: I.full,
  pr: [ prLine1, bn ? ps + bnPart : ps ],
  btP: [ tl, kv(btLim) ],
  btM: [ tl, kv(btLim) ],
  hero: [ m, s ],
  th: [ isAC ? AC.f : kv(BN_LIM.th1), bBn ],
  sn: [ isAC ? AC.f : kv(BN_LIM.sn1), bBn ],
  ins: [ "오늘 " + I.evLabel + " " + ps, bBn ],
  home: [ bnShorten(m, BN_LIM.homeHeroMain), bnShorten(s, BN_LIM.homeHeroSub) ],
  homeSrc: [ m, s ],
  src: m,
  isAC: isAC,
  btLim: btLim
 };
}

function bnShNote(o, t, l, x) {
 return o && t && o !== t ? "ℹ 원문 " + o.length + "자를 " + l + "자 기준" + (x || "") + "으로 자동 축약했습니다 · 원문: " + o : "";
}

function bnAlertTxt(n, l) {
 return "⚠ 글자수 초과 — 현재 " + n + "자 / 기준 " + l + "자 (" + (n - l) + "자 초과)";
}

/* 배너 모델: 그룹 → 행(이미지) → 줄(키·자동값·수정값·한도·안내) */
function bnModel(pv) {
 var I = bnInputs(pv), g = bnGen(I), ed = I.st.ed;
 var acN = 'ℹ 에어컨 라이브 — KV 카피보다 "LG 휘센 에어컨"을 우선 적용했습니다';
 var mkN = function(t, l) { return g.isAC ? acN : bnShNote(g.src, t, l); };
 var hl = [ BN_LIM.homeHeroMain, BN_LIM.homeHeroSub ];
 var hn = g.homeSrc.map(function(o, i) { return o && o !== g.home[i] ? "ℹ 원문 " + o.length + "자를 " + hl[i] + "자 기준으로 자동 축약했습니다 · 원문: " + o : ""; });
 var btN = [ "", bnShNote(g.src, g.btP[1], g.btLim, "(PC·MO 동일 카피)") ];
 var G = [
  { id: "home", name: "홈메인 히어로배너", en: "main-home_herobanner", cl: "홈메인 히어로배너", rows: [
   { id: "PC", nm: "PC", en: "main-home_herobanner_pc", img: "homehero_pc", lines: g.home, lk: [ "homeHeroMain", "homeHeroSub" ], notes: hn },
   { id: "MO", nm: "MO", en: "main-home_herobanner_mo", img: "homehero_mo", lines: g.home, lk: [ "homeHeroMain", "homeHeroSub" ], notes: hn } ] },
  { id: "promo", name: "상단홍보배너", en: "Promotion_Banner", cl: "상단홍보배너", rows: [
   { id: "PC", nm: "PC", en: "Promotion_Banner_pc", img: "promo_pc", lines: g.pr, lk: [ "pr1", "pr2" ] },
   { id: "MO", nm: "MO", en: "Promotion_Banner_mo", img: "promo_mo", lines: g.pr, lk: [ "pr1", "pr2" ] } ] },
  { id: "bottom", name: "바텀시트 · 팝업", en: "main-home_bottom / Popup", cl: "바텀시트 · 팝업", warn: "⚠️ <b>블랙 제품</b>은 샤픈·빛효과로 배경 구분 필수", rows: [
   { id: "PC", nm: "PC 팝업", en: "main-home_Popup_live_PC", img: "bottom_pc", lines: g.btP, lk: [ null, "pop1" ], notes: btN },
   { id: "MO", nm: "MO 바텀시트", en: "main-home_bottom_live_MO", img: "bottom_mo", lines: g.btM, lk: [ null, "bt1" ], notes: btN } ] },
  { id: "hero", name: "라이브 히어로배너", en: "Lgelive_herobanner", cl: "히어로배너 - KV", kv: true, rows: [
   { id: "PC", nm: "PC", en: "Lgelive_herobanner_pc", img: "hero_pc", lines: g.hero, lk: [ "heroMain", "heroSub" ] },
   { id: "MO", nm: "MO", en: "Lgelive_herobanner_mo", img: "hero_mo", lines: g.hero, lk: [ "heroMain", "heroSub" ] } ] },
  { id: "cal", name: "캘린더 썸네일", en: "Lgelive_720x720", cl: "캘린더 썸네일", nocopy: true, rows: [
   { id: "cal", nm: "캘린더", en: "Lgelive_720x720", img: "calendar", nc: true } ] },
  { id: "thumb", name: "방송 썸네일", en: "Banner_thumb", cl: "방송 썸네일", rows: [
   { id: "900", nm: "900x1200", en: "Banner_thumb_900x1200", img: "thumb_1", lines: g.th, lk: [ "th1", "th2" ], notes: [ mkN(g.th[0], BN_LIM.th1), "" ] },
   { id: "1080", nm: "1080x810", en: "Banner_thumb_1080x810", img: "thumb_2", lines: g.th, lk: [ "th1", "th2" ], notes: [ mkN(g.th[0], BN_LIM.th1), "" ] } ] },
  { id: "sns", name: "SNS · 방송안내 썸네일", en: "Banner_sns", cl: "SNS", rows: [
   { id: "1000", nm: "1000x1000", en: "thumbnail_1000x1000", img: "thumb_1000", lines: g.sn, lk: [ "sn1", "sn2" ], notes: [ mkN(g.sn[0], BN_LIM.sn1), "" ] },
   { id: "1024", nm: "SNS 1024", en: "Banner_sns_1024", img: "sns_1", lines: g.sn, lk: [ "sn1", "sn2" ], notes: [ mkN(g.sn[0], BN_LIM.sn1), "" ] },
   { id: "1200", nm: "SNS 1200", en: "Banner_sns_1200", img: "sns_2", nc: true } ] },
  { id: "ins", name: "인사이더 배너", en: "Insider_banner", cl: "인사이더", rows: [
   { id: "ins", nm: "인사이더", en: "Insider_banner", img: "insider", lines: g.ins, lk: [ "in1", "in2" ] } ] }
 ];
 G.forEach(function(gr) {
  gr.rows.forEach(function(r) {
   r.gid = gr.id;
   r.pair = /^PC/.test(r.nm) ? "MO" : /^MO/.test(r.nm) ? "PC" : null;
   if (r.nc) { r.L = []; return; }
   r.L = (r.lines || []).map(function(auto, i) {
    auto = auto || "";
    var key = gr.id + ":" + r.id + ":" + i, e = ed[key], lk = r.lk && r.lk[i] || null;
    var val = e ? String(e.v) : auto;
    var n = val.length, lim = lk ? BN_LIM[lk] : null;
    return { key: key, i: i, auto: auto, val: val, lk: lk, lim: lim, n: n, over: lim !== null && n > lim, edited: !!e && e.v !== auto, stale: !!e && e.o !== auto && e.v !== auto, note: r.notes && r.notes[i] || "" };
   });
  });
 });
 return { I: I, g: g, groups: G };
}

/* 버전 저장·비교용 스냅샷: [{g:그룹명, t:복사 텍스트}] */
function bannerSnapshot(pv) {
 try {
  var M = bnModel(pv);
  return M.groups.filter(function(gr) { return !gr.nocopy; }).map(function(gr) {
   return { g: gr.name, t: bnGroupText(gr) };
  });
 } catch (e) {
  return null;
 }
}

function bnGroupText(gr) {
 var rows = gr.rows.filter(function(r) { return !r.nc; });
 if (!rows.length) return "";
 var label = "[" + gr.cl + "]";
 var bl = rows.map(function(r) { return { nm: r.nm, lines: r.L.map(function(l) { return l.val.trim(); }) }; });
 var same = bl.every(function(b) { return b.lines.join("\n") === bl[0].lines.join("\n"); });
 return same ? label + "\n" + bl[0].lines.join("\n") : bl.map(function(b) { return label + " " + b.nm + "\n" + b.lines.join("\n"); }).join("\n\n");
}

/* ── 화면 ── */
var _bnM = null;

function renderBanners(pv) {
 var box = document.getElementById("bnResults");
 if (!box || !currentCaseId) return;
 if (box.contains(document.activeElement) && document.activeElement.classList.contains("bnTxt")) return;
 pv = pv || collectFormValues();
 var M = bnModel(pv);
 _bnM = M;
 bnRenderInputs(M.I);
 var h = '<div class="bnBar" id="bnBar"></div>';
 M.groups.forEach(function(gr, gi) {
  h += '<div class="bnGrp" data-g="' + gr.id + '"><div class="bnGrpT"><span class="gn">' + escapeHtml(gr.name) + ' <span class="en">' + escapeHtml(gr.en) + "</span></span>" + (gr.nocopy ? "" : '<span class="bnGb"></span><button type="button" class="bnGcp" onclick="bnCopyGroup(' + gi + ',this)">그룹 복사</button>') + "</div>";
  if (gr.warn) h += '<p class="bnWarnP">' + gr.warn + "</p>";
  gr.rows.forEach(function(r, ri) {
   var img = r.img && typeof TH !== "undefined" && TH[r.img] ? '<div class="bnImg"><img src="' + TH[r.img] + '" alt=""></div>' : '<div class="bnImg"></div>';
   if (r.nc) {
    h += '<div class="bnRow nc">' + img + '<div class="bnCopy"><div class="bnNm">' + escapeHtml(r.nm) + ' <span class="en">' + escapeHtml(r.en) + '</span></div><div class="bnCt">카피 없음 · 이미지 전용</div></div></div>';
    return;
   }
   var lines = r.L.map(function(l) {
    var ce = ' contenteditable="true" spellcheck="false" role="textbox" title="클릭해서 직접 수정 · Enter로 확정" data-bk="' + _attr(l.key) + '"' + (l.lk ? ' data-lk="' + l.lk + '"' : "");
    var s = '<div class="bnLine' + (l.over ? " over" : "") + (l.edited ? " edited" : "") + '"><span class="bnTxt"' + ce + ">" + escapeHtml(l.val) + "</span>" + (l.lk ? '<span class="bnLc">' + l.n + "/" + l.lim + "</span>" : "") + "</div>";
    if (l.lk) s += '<div class="bnAlert">' + bnAlertTxt(l.n, l.lim) + "</div>";
    if (l.stale) s += '<div class="bnStale">⚠ KV 카피가 바뀌어 자동 카피는 「' + escapeHtml(l.auto) + '」입니다 · 직접 수정한 문구 유지 중<button type="button" onclick="bnRevert(\'' + l.key + "')\">자동 카피로</button></div>";
    if (l.note && !l.edited) s += '<div class="bnInfo">' + escapeHtml(l.note) + "</div>";
    return s;
   }).join("");
   h += '<div class="bnRow' + (gr.kv ? " kv" : "") + '" data-r="' + gi + ":" + ri + '">' + img + '<div class="bnCopy"><div class="bnNm">' + escapeHtml(r.nm) + ' <span class="en">' + escapeHtml(r.en) + '</span></div><div class="bnCt">' + lines + '</div><button type="button" class="bnCp" onclick="bnCopyRow(' + gi + "," + ri + ',this)">복사</button></div></div>';
  });
  h += "</div>";
 });
 var y = window.scrollY;
 box.innerHTML = h;
 if (y) window.scrollTo(0, y);
 bnUpdateSummary();
}

function bnRenderInputs(I) {
 function set(id, v) {
  var e = document.getElementById(id);
  if (e && document.activeElement !== e && e.value !== v) e.value = v;
 }
 function txt(id, v, empty) {
  var e = document.getElementById(id);
  if (!e) return;
  e.textContent = v || empty;
  e.classList.toggle("empty", !v);
 }
 txt("bnSrcM", I.main, "(메인 카피 없음)");
 txt("bnSrcS", I.sub, "(서브 카피 없음)");
 txt("bnSrcD", I.full + (I.fromKv ? " · KV 날짜 기준" : ""), "날짜 미확인");
 txt("bnSrcB", I.bc, "");
 var w = [], nM = I.main.length, nS = I.sub.length;
 if (!I.main || /^000 /.test(I.main)) w.push("KV 메인카피에 제품명이 없습니다 → 왼쪽 KV 카피에 입력해 주세요");
 if (nM > BN_LIM.keyMain) w.push("KV 메인 " + nM + "자 · 기준 " + BN_LIM.keyMain + "자 초과(" + (nM - BN_LIM.keyMain) + "자)");
 if (nS > BN_LIM.keySub) w.push("KV 서브 " + nS + "자 · 기준 " + BN_LIM.keySub + "자 초과(" + (nS - BN_LIM.keySub) + "자)");
 if (!I.full) w.push("방송 날짜를 읽지 못했습니다 → ⋯ 더보기 → 방송명 수정에서 방송명 앞에 날짜(예: 10/22)를 넣어 주세요");
 if (!I.prodV.trim() && !I.prodSV.trim()) w.push("제품군을 인식하지 못했습니다 → 아래 제품군·축약명을 입력해 주세요");
 var wb = document.getElementById("bnSrcWarn");
 if (wb) wb.innerHTML = w.map(function(x) { return '<div class="srcWarn">' + escapeHtml(x) + "</div>"; }).join("");
 /* v10: 칸에는 직접 입력값만, 자동 인식값은 회색 안내(placeholder)로 */
 function ph(id, v, base) {
  var e = document.getElementById(id);
  if (e) e.placeholder = v ? "자동: " + v : base;
 }
 set("bnProd", I.st.pt ? I.st.prod || "" : "");
 set("bnProdS", I.st.pst ? I.st.prodS || "" : "");
 ph("bnProd", I.auto.prod, "제품군 (자동 인식 없음)");
 ph("bnProdS", I.auto.prodS, "축약명 (자동 인식 없음)");
 [ "bnR1", "bnR2", "bnR3" ].forEach(function(id, i) {
  set(id, I.st.rt ? I.st["r" + (i + 1)] || "" : "");
  ph(id, I.auto.r[i] ? I.auto.r[i] + "%" : "", [ "기본%", "쿠폰%", "카드%" ][i]);
 });
 var mx = document.getElementById("bnMx");
 if (mx) mx.checked = !!I.mx;
 set("bnCb", I.cb);
 function tag(id, manual) {
  var e = document.getElementById(id);
  if (e) e.innerHTML = manual ? '<span class="autoTag man">직접 입력</span>' : "";
 }
 tag("bnProdTag", I.st.pt);
 tag("bnProdSTag", I.st.pst);
 tag("bnRateTag", I.st.rt);
 var man = [ I.st.pt && "제품군", I.st.pst && "축약명", I.st.rt && "할인율", I.cb && "커스텀 문구" ].filter(Boolean);
 var as = document.getElementById("bnAccState");
 if (as) { as.textContent = man.length ? "직접 입력 중: " + man.join(", ") : "배너 일괄 수정 시 사용"; as.className = "accS" + (man.length ? " man" : ""); }
 var ab = document.getElementById("bnAutoBtn");
 if (ab) ab.style.display = I.st.pt || I.st.pst || I.st.rt || I.cb ? "" : "none";
}

function bnSave(st) {
 var clean = {};
 if (st.pt) { clean.pt = true; clean.prod = st.prod || ""; }
 if (st.pst) { clean.pst = true; clean.prodS = st.prodS || ""; }
 if (st.rt) { clean.rt = true; clean.r1 = st.r1 || ""; clean.r2 = st.r2 || ""; clean.r3 = st.r3 || ""; clean.mx = !!st.mx; }
 if (st.cb) clean.cb = st.cb;
 if (st.ed && Object.keys(st.ed).length) clean.ed = st.ed;
 optSet("opt_bn", Object.keys(clean).length ? clean : null);
}

function bnCurState() {
 return bnState({ opts: { bn: (document.getElementById("opt_bn") || {}).value || "" } });
}

function bnSetIn(f, v) {
 var st = bnCurState();
 if (f === "prod") { st.prod = v; st.pt = v.trim() !== ""; }
 if (f === "prodS") { st.prodS = v; st.pst = v.trim() !== ""; }
 if (f === "cb") st.cb = v;
 if (f === "rate") {
  if (!st.rt && _bnM) {
   /* 처음 직접 입력할 때: 비어 있는 다른 칸은 자동 인식값으로 채워 둠 */
   [ "bnR1", "bnR2", "bnR3" ].forEach(function(id, i) {
    var e = document.getElementById(id);
    if (e && !e.value && e !== document.activeElement && _bnM.I.auto.r[i]) e.value = _bnM.I.auto.r[i];
   });
  }
  st.rt = true;
  st.r1 = document.getElementById("bnR1").value.trim();
  st.r2 = document.getElementById("bnR2").value.trim();
  st.r3 = document.getElementById("bnR3").value.trim();
  st.mx = document.getElementById("bnMx").checked;
 }
 bnSave(st);
}

function bnResetAuto() {
 var st = bnCurState();
 delete st.pt; delete st.pst; delete st.rt;
 st.prod = st.prodS = "";
 bnSave(st);
 [ "bnProd", "bnProdS", "bnR1", "bnR2", "bnR3" ].forEach(function(id) {
  var e = document.getElementById(id);
  if (e) e.value = "";
 });
 renderBanners();
}

/* 결과 행 직접 수정 */
function bnLineOf(key) {
 if (!_bnM) return null;
 var p = key.split(":"), out = null;
 _bnM.groups.forEach(function(gr) {
  if (gr.id !== p[0]) return;
  gr.rows.forEach(function(r) {
   if (r.id === p[1] && r.L) out = { gr: gr, r: r, l: r.L[Number(p[2])] };
  });
 });
 return out;
}

function bnPairKey(key) {
 var x = bnLineOf(key);
 if (!x || !x.r.pair) return null;
 var o = x.gr.rows.filter(function(r) { return r.id === x.r.pair; })[0];
 return o ? x.gr.id + ":" + o.id + ":" + key.split(":")[2] : null;
}

function bnNorm(s) {
 return String(s || "").replace(/ /g, " ").replace(/\s*\n\s*/g, " ");
}

function bnLiveCount(t) {
 var line = t.closest(".bnLine");
 if (!line) return;
 var v = bnNorm(t.textContent), lk = t.getAttribute("data-lk");
 if (lk) {
  var n = v.length, l = BN_LIM[lk], lc = line.querySelector(".bnLc"), al = line.nextElementSibling;
  if (lc) lc.textContent = n + "/" + l;
  line.classList.toggle("over", n > l);
  if (al && al.classList.contains("bnAlert")) al.textContent = bnAlertTxt(n, l);
 }
 var x = bnLineOf(t.getAttribute("data-bk"));
 line.classList.toggle("edited", !!x && v.trim() !== x.l.auto);
 var br = t.closest(".bnRow");
 if (br) bnResetDone(br);
}

function bnCommit(t) {
 var key = t.getAttribute("data-bk"), x = bnLineOf(key);
 if (!x) return;
 var v = bnNorm(t.textContent).trim();
 if (t.textContent !== v) t.textContent = v;
 var st = bnCurState(), changed = false;
 function put(k, auto) {
  var cur = st.ed[k];
  if (v === auto) {
   if (cur) { delete st.ed[k]; changed = true; }
  } else if (!cur || cur.v !== v) {
   st.ed[k] = { o: auto, v: v };
   changed = true;
  }
 }
 put(key, x.l.auto);
 var pk = bnPairKey(key);
 if (pk) {
  var y = bnLineOf(pk);
  if (y) put(pk, y.l.auto);
 }
 if (changed) bnSave(st);
 setTimeout(function() { renderBanners(); }, 0);
}

function bnRevert(key) {
 var st = bnCurState();
 delete st.ed[key];
 var pk = bnPairKey(key);
 if (pk) delete st.ed[pk];
 bnSave(st);
 renderBanners();
}

document.addEventListener("input", function(e) {
 var t = e.target;
 if (!(t && t.classList && t.classList.contains("bnTxt"))) return;
 bnLiveCount(t);
 var pk = bnPairKey(t.getAttribute("data-bk"));
 if (pk) {
  var o = document.querySelector('#bnResults .bnTxt[data-bk="' + pk + '"]');
  if (o) {
   var v = bnNorm(t.textContent);
   if (o.textContent !== v) o.textContent = v;
   bnLiveCount(o);
  }
 }
 bnUpdateSummary();
});
document.addEventListener("focusout", function(e) {
 var t = e.target;
 if (t && t.classList && t.classList.contains("bnTxt")) bnCommit(t);
});
document.addEventListener("keydown", function(e) {
 var t = e.target;
 if (e.key === "Enter" && t && t.classList && t.classList.contains("bnTxt")) {
  e.preventDefault();
  t.blur();
 }
});
document.addEventListener("paste", function(e) {
 var t = e.target;
 if (!(t && t.classList && t.classList.contains("bnTxt"))) return;
 e.preventDefault();
 var tx = bnNorm((e.clipboardData || window.clipboardData).getData("text"));
 if (document.execCommand) document.execCommand("insertText", false, tx);
});

/* 요약 바 · 이동 */
function bnUpdateSummary() {
 var res = document.getElementById("bnResults"), bar = document.getElementById("bnBar");
 if (!res || !bar) return;
 var bad = 0, pass = 0, total = 0, links = [];
 [].slice.call(res.querySelectorAll(".bnGrp")).forEach(function(gr, i) {
  total++;
  var n = gr.querySelectorAll(".bnLine.over").length, gb = gr.querySelector(".bnGb");
  if (gb) { gb.className = "bnGb " + (n ? "bad" : "ok"); gb.textContent = n ? "초과 " + n + "건" : "통과"; }
  if (n) {
   bad += n;
   links.push('<button type="button" class="bnJl" onclick="bnJump(' + i + ')">' + escapeHtml(gr.querySelector(".gn").firstChild.textContent.trim()) + " · " + n + "건</button>");
  } else pass++;
 });
 var chip = bad ? '<span class="bnSc bad">⚠ 글자수 초과 ' + bad + "건</span>" : '<span class="bnSc ok">✔ 전체 통과</span>';
 bar.innerHTML = chip + '<span class="bnJls">' + links.join("") + '</span><span class="bnSbn">' + total + "개 그룹 중 " + pass + '개 통과 · 카피를 클릭하면 직접 수정</span><button type="button" class="bnCopyAll" onclick="bnCopyAll(this)">전체 복사</button>';
}

function bnJump(i) {
 var gr = document.querySelectorAll("#bnResults .bnGrp")[i];
 if (!gr) return;
 var l = gr.querySelector(".bnLine.over");
 if (!l) return;
 var b = l.closest(".bnRow");
 if (b.scrollIntoView) b.scrollIntoView({ behavior: "smooth", block: "center" });
 b.classList.remove("flash");
 void b.offsetWidth;
 b.classList.add("flash");
}

/* 복사 (화면에 보이는 = 수정 반영된 문구) */
function bnDomLines(br) {
 return [].slice.call(br.querySelectorAll(".bnTxt")).map(function(e) { return bnNorm(e.textContent).trim(); });
}
function bnDone(btn, on) {
 btn.classList.toggle("done", on);
 btn.textContent = on ? "✔ 복사됨" : btn.classList.contains("bnGcp") ? "그룹 복사" : "복사";
}
function bnResetDone(br) {
 var b = br.querySelector(".bnCp");
 if (b) bnDone(b, false);
 var gr = br.closest(".bnGrp"), gb = gr && gr.querySelector(".bnGcp");
 if (gb) bnDone(gb, false);
}
function bnCopyRow(gi, ri, btn) {
 var br = btn.closest(".bnRow");
 copyText(bnDomLines(br).join("\n"));
 bnDone(btn, true);
}
function bnCopyGroup(gi, btn) {
 if (!_bnM) return;
 copyText(bnGroupText(_bnM.groups[gi]));
 var gr = btn.closest(".bnGrp");
 [].slice.call(gr.querySelectorAll(".bnCp")).forEach(function(b) { bnDone(b, true); });
 bnDone(btn, true);
}
function bnCopyAll() {
 if (!_bnM) return;
 var parts = [ "[날짜] " + (_bnM.g.full || "(날짜 미확인)") ];
 _bnM.groups.forEach(function(gr) {
  if (gr.nocopy) return;
  var t = bnGroupText(gr);
  if (t) parts.push("", t);
 });
 copyText(parts.join("\n"));
 [].slice.call(document.querySelectorAll("#bnResults .bnCp,#bnResults .bnGcp")).forEach(function(b) { bnDone(b, true); });
}

/* 글자수 기준 설정 (이 브라우저에 저장) */
function bnBuildLim() {
 var w = document.getElementById("bnLimIn");
 if (!w) return;
 w.innerHTML = Object.keys(BN_LIM).map(function(k) {
  return "<div><span>" + escapeHtml(BN_LIM_L[k]) + '</span><input type="number" min="1" value="' + BN_LIM[k] + '" data-k="' + k + '" onchange="bnLimSet(this)"></div>';
 }).join("");
}
function bnLimSet(el) {
 var k = el.getAttribute("data-k"), v = parseInt(el.value, 10);
 if (!(v > 0)) { el.value = BN_LIM[k]; return; }
 BN_LIM[k] = v;
 try { localStorage.setItem(BN_LIM_KEY, JSON.stringify(BN_LIM)); } catch (e) {}
 kvCounters();
 if (STEP === 2) renderBanners();
}
function bnLimReset() {
 Object.keys(BN_LIM_DEF).forEach(function(k) { BN_LIM[k] = BN_LIM_DEF[k]; });
 try { localStorage.removeItem(BN_LIM_KEY); } catch (e) {}
 bnBuildLim();
 kvCounters();
 if (STEP === 2) renderBanners();
}

/* setStepUi(); — 업무관리에서는 실행 안 함 */
/* onCaseShown(false); — 업무관리에서는 실행 안 함 */


/* 원본 renderParseSummary(판촉 인식) + payChipsHtml(결제혜택 인식)을 화면 대신 칩 배열로 돌려주게 바꾼 것
 * (OBS 공통 배너 카피 뱅크는 업무관리에 없어 '미등록' 칩은 뺐다) */
function summarizeParse(pv) {
 function _c(k, s) { return { kind: k, text: s }; }
 var chips = [], notes = [];
 if (!pv || !(pv.rawText || "").trim()) return { chips: chips, notes: notes };
 var n = pv.notify || {};
 if (n.gift && n.count) chips.push(_c("ok", "알림 신청 ✓ " + n.gift + " · " + n.count)); else chips.push(_c("bad", "알림 신청 " + (n.gift ? "" : "사은품 ") + (n.count ? "" : "인원 ") + "미인식"));
 if (!n.deadline) chips.push(_c("warn", "알림 마감일시 미확인 (방송명에 날짜가 있어야 자동 계산)"));
 var liveN = (pv.liveItems || []).length;
 chips.push(liveN ? _c("ok", "한정 혜택 " + liveN + "건") : _c("bad", "한정 혜택 미인식"));
 (pv.liveItems || []).forEach(function(it, i) {
  if (!it.benefit || isGs25(it.benefit)) return;
  var sp = splitBenefit(it.benefit), no = "한정 혜택 " + (i + 1) + ": ";
  if (sp.isDefault) chips.push(_c(/^000 /.test(sp.label) ? "warn" : "info", no + (/^000 /.test(sp.label) ? '제품명을 읽지 못해 윗줄을 "000 라이브"로 표시 — KV 메인카피에 제품명을 입력해 주세요' : '윗줄 기본값 "' + sp.label + '" 사용 (KV 메인카피·방송명 기준)')));
  if (sp.labelDropped && sp.labelDropped.length) chips.push(_c("info", no + "윗줄 글자 수 한도(" + LIVE_LABEL_MAX + '자)로 "' + sp.labelDropped.join(" ") + '" 생략 — 유의사항에는 전체 표기'));
  if (sp.tiers) chips.push(_c("warn", no + '금액 구간 상품권 → "' + sp.main + '"로 표기하고 구간은 유의사항으로 이동 (양식 추정 · 실제 페이지와 대조)'));
  if (sp.targets) chips.push(_c("info", no + "대상 품목은 카드에서 빼고 유의사항으로 이동"));
  if (sp.dropped && sp.dropped.length) chips.push(_c("warn", no + "글자 수 한도(" + LIVE_MAIN_MAX + '자)로 "' + sp.dropped.join('", "') + '" 생략'));
  if (sp.dropCnt) chips.push(_c("info", no + "사은품 추첨 인원(" + sp.dropCnt + ")은 표기하지 않음(실제 페이지 기준)"));
  if (sp.note) chips.push(_c("info", no + '제품군별 할인률이 달라 아랫줄을 "최대"로 표기 (' + sp.note + ")"));
  if (sp.mainOver) chips.push(_c("warn", no + "아랫줄 " + sp.main.length + "자 — 한도 " + LIVE_MAIN_MAX + "자 초과(직접 줄여주세요)"));
  if (sp.labelOver) chips.push(_c("warn", no + "윗줄 " + sp.label.length + "자 — 한도 " + LIVE_LABEL_MAX + "자 초과(직접 줄여주세요)"));
 });
 var cards = pv.obsCards || [], noTitle = 0;
 cards.forEach(function(r) { if (!r[1]) noTitle++; });
 if (!cards.length) chips.push(_c("warn", "OBS 링크 없음")); else {
  chips.push(_c("ok", "OBS 링크 " + cards.length + "건"));
  if (noTitle) chips.push(_c("bad", "OBS 타이틀 미입력 " + noTitle + "건"));
 }
 if (fridgeOn(pv)) chips.push(_c("info", "냉장고 포함 → OBS 맨 아래에 고정 배너(Fit & Max 냉장고, 김치냉장고) 자동 추가"));
 if (pv.opts && pv.opts.rebro) {
  var rt0 = rebroTexts(pv);
  chips.push(_c("ok", "재방송 영역 포함"));
  if (!rt0.date) chips.push(_c("warn", "재방송: 본방송 일자 미입력"));
  if (rt0.viewersEmpty) chips.push(_c("info", "재방송: 실시간 시청자 수 미입력 → 00.0명으로 표시"));
 }
 chips.push(pv.legalNotes ? _c("ok", "유의사항 원문 사용") : _c("info", "유의사항 표준 문구 자동 삽입"));
 // 결제혜택 인식 (원본은 '결제혜택 · 유의사항' 카드에 따로 표시) — 칩 HTML을 배열로 바꿔 붙인다
 var re = /<span class="chip (\w+)">([\s\S]*?)<\/span>/g, m;
 var unesc = function(s) { return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"); };
 var ph = payChipsHtml(pv);
 while ((m = re.exec(ph))) chips.push(_c(m[1], "결제혜택: " + unesc(m[2]).replace(/^결제혜택:?\s*/, "")));
 return { chips: chips, notes: notes };
}


/* ================= 화면에서 쓰는 타입·함수 ================= */
/** 원본 opts (방송별 옵션) — defaultOpts와 같은 키. 문자열 필드 중 kv·hide·order·addLive·addObs·liveIcon·txtEdit·bn은 원본처럼 JSON 문자열 */
export interface PromoOpts {
  rebro: boolean; orig: string; viewers: string; fridge: 'auto' | 'on' | 'off'; air: string;
  cook: 'auto' | 'on' | 'off'; cookHead: string; cookRates: string; cookProds: string;
  paySheet: string; bdate: string; obsEdit: string;
  hid: 'auto' | 'it' | 'lgAll'; hidUrl: string; hidTotal: boolean; hidUrl2: string; payInh: boolean;
  txtEdit: string; kv: string; addLive: string; addObs: string; liveIcon: string; bn: string;
  hide: string; payMode: '' | 'prev' | 'date'; payDate: string; order: string;
}
export interface PromoLiveItem { benefit: string; condition: string; tag: string; detailLines: string[] }
/** 원본 collectFormValues 결과 + 업무명 — JSON으로 그대로 저장 가능 */
export interface PromoStructured {
  notify: { gift: string; count: string; deadline: string };
  liveItems: PromoLiveItem[];
  obsCards: any[];          // 원문에서 읽은 OBS 배너 [code, main, sub, url]
  obsShow?: any[];          // 실제 노출 목록 (히든 기획전·냉장고 Fit&Max 배너 포함, opts.order 순서)
  paymentFullText: string;
  legalNotes: string;
  rawText: string;
  sourceChannel: string;
  opts: PromoOpts;
  caseName: string;         // 업무명(방송명) 전체 — 원본은 여기서 날짜·제품·쿠킹/냉장고/재방송 키워드를 읽는다
}
export interface PromoChip { kind: 'ok' | 'warn' | 'bad' | 'info'; text: string }

export function defaultPromoOpts(caseName: string): PromoOpts { return defaultOpts(caseName || ''); }

/** KV 메인·서브(배너 탭 입력값)를 원본 opts.kv 모양으로 — 한정 혜택 윗줄 기본값·페이지 KV가 이 값을 따른다 */
export function promoKvOpt(main: string, sub: string): string {
  var o = {};
  if ((main || '').trim()) o.m = main.trim();
  if ((sub || '').trim()) o.s = sub.trim();
  return Object.keys(o).length ? JSON.stringify(o) : '';
}

/** 판촉 원문 → 구조화 (원본 collectFormValues·pvFromVersion과 같은 방식). caseName은 업무명 전체(예: "11/2 냉장고&쿠킹") */
export function parsePromo(raw: string, caseName: string, opts?: Partial<PromoOpts>): PromoStructured {
  var o = Object.assign(defaultOpts(caseName || ''), opts || {});
  return __withPv({ caseName: caseName, opts: o }, function(){
    var rawText = raw || '';
    // 결제혜택 시트가 있으면 원문 전체, 없으면 '1. 결제일 할인' 앞까지만 판촉으로 읽는다 (결제혜택은 원문 전체로 엔진이 따로 읽음)
    var cut = (o.paySheet || '').trim() ? -1 : rawText.search(/^[ \t]*1\.[ \t]*결제일[ \t]*할인/m);
    var parsed = applyHidden(parseRawToStructured(cut > 0 ? rawText.slice(0, cut) : rawText, []), o);
    parsed.notify.deadline = computeDeadlineFromCaseName(caseName || '');
    var pv = {
      notify: parsed.notify, liveItems: parsed.liveItems, obsCards: parsed.obsCards,
      paymentFullText: parsed.paymentFullText, legalNotes: parsed.legalNotes,
      rawText: rawText, sourceChannel: '', opts: o, caseName: caseName || '',
    };
    pv.obsShow = obsShowCards(pv);
    return applyCardOrder(pv);
  });
}
/** 워싱본 텍스트(섹션별 순서대로, 사내 공유·기획서 디스클레이머용) — 원본처럼 '할인 쿠폰' 띄어쓰기 표시 보정 */
export function promoPreviewText(pv: PromoStructured): string {
  return __withPv(pv, function(){ return pageTextFix(buildPromoPreviewText(pv)); });
}
/** 실제 상세페이지처럼 보이는 미리보기 HTML — 원본의 클릭·직접 수정(점선 영역)·끌기 핸들은 뺀다.
 *  OBS 링크 URL은 따옴표·꺾쇠 같은 글자를 %인코딩해 속성이 깨지지 않게 한다. */
export function promoPreviewHtml(pv: PromoStructured): string {
  var safeUrl = function(u){ return (u || '').replace(/["'<>`\s]/g, function(c){ return encodeURIComponent(c); }); };
  var fix = function(list){ return (list || []).map(function(r){ var c = Object.assign(r.slice(), r); c[3] = safeUrl(c[3]); return c; }); };
  var safe = Object.assign({}, pv, { obsCards: fix(pv.obsCards), obsShow: pv.obsShow ? fix(pv.obsShow) : undefined });
  return __withPv(pv, function(){ return pageHtmlFix(renderMockPage(safe)); })
    .replace(/ on(?:click|change|input|dragstart|keydown)="[^"]*"/g, '').replace(/ contenteditable="[^"]*"/g, '').replace(/ draggable="[^"]*"/g, '')
    .replace(/ target="_blank"/g, ' target="_blank" rel="noreferrer"');
}
export function promoSummary(pv: PromoStructured): { chips: PromoChip[]; notes: string[] } {
  return __withPv(pv, function(){ return summarizeParse(pv); });
}
export interface PromoPaymentHero { title: string; desc: string; descLines?: string[]; badgePre?: string; badgeNum: string; badgeUnit: string; badgeLabel: string; raw?: string }
export interface PromoPaymentRow { icon: string; label: string; value: string; note: string; raw?: string }
export interface PromoPayment { heroes: PromoPaymentHero[]; rows: PromoPaymentRow[] }
/** 결제 혜택 → 히어로 카드·아이콘 행 (미리보기와 같은 PayWash 결과, 기획서 PPT 13번 장을 맥 프로그램이 채운다) */
export function promoPayment(pv: PromoStructured): PromoPayment {
  return __withPv(pv, function(){ return payModelFor(pv); });
}
/** 한정 혜택 카드 — 미리보기와 같은 2줄 정리(윗줄·아랫줄) + 지급조건 문장 (기획서 11번 장) */
export function promoLiveCards(pv: PromoStructured): { label: string; main: string; cond: string }[] {
  return __withPv(pv, function(){
    return (pv.liveItems || []).map(function(it){
      if (!(it.benefit || '').trim()) return { label: '', main: '', cond: '' };
      var sp = splitBenefit(it.benefit);
      return { label: pageTextFix(sp.label || ''), main: pageTextFix(sp.main || ''), cond: pageTextFix(condSentence(it) || '') };
    });
  });
}
/** 자동 판단 결과 — '추가 영역' 체크의 자동 값 표시용 (사용자가 직접 고르기 전) */
export function promoAuto(pv: PromoStructured): { cook: boolean; fridge: boolean; hidMains: string[] } {
  return __withPv(pv, function(){
    var a = Object.assign({}, pv, { opts: Object.assign({}, pv.opts, { cook: 'auto', fridge: 'auto' }) });
    return { cook: !!cookOn(a), fridge: !!fridgeOn(a), hidMains: hidAutoMains() };
  });
}
/** 이전 저장본과 비교한 변경 목록 (원본 computeChanges) */
export function promoChanges(prev: PromoStructured | null, cur: PromoStructured): string[] { return computeChanges(prev, cur); }
/** 제품명 나열 → 가운데점 (v06: "냉장고세탁기"·"냉장고&세탁기" → "냉장고·세탁기") — 배너 KV 카피에도 쓴다 */
export function promoJoinProducts(s: string): string { return joinProducts(s); }

/* ---- 통합셋팅기 v05·v08·v09·v13 화면 기능용 (카드 삭제·순서, 결제혜택 반영 기준, 변경 하이라이트) ---- */

/** 직전 라이브 후보 — 원본 저장소의 방송 1건 모양 (업무관리에서는 다른 업무의 1차 기획서 저장분으로 만든다) */
export interface PromoPrevCase { id: string; name: string; updatedAt?: string; promoVersions: { rawText: string; opts: Partial<PromoOpts>; paymentFullText?: string; savedAt?: string }[] }
/** '직전 라이브와 동일' 모드에서 찾아볼 지난 방송 목록을 넣는다 */
export function setPromoPrevCases(cases: PromoPrevCase[]): void { __PV_CTX.cases = Array.isArray(cases) ? cases : []; }

export interface PromoCardRow {
  key: string;        // 순서 키 (원본 opts.order 값)
  hideKey: string;    // 삭제 키 (원본 opts.hide 값)
  kind: 'live' | 'card' | 'hidden' | 'hidden2' | 'fixed' | 'added';
  title: string; sub: string; url: string;
}
/** 워싱본에 나오는 한정 혜택·OBS 카드 (지금 순서, 삭제한 카드 제외) */
export function promoCards(pv: PromoStructured): { live: PromoCardRow[]; obs: PromoCardRow[] } {
  return __withPv(pv, function(){
    var live = (pv.liveItems || []).map(function(it){
      var sp = (it.benefit || '').trim() ? splitBenefit(it.benefit) : { label: '', main: '' };
      return { key: 'p:' + it.benefit, hideKey: it.benefit, kind: 'live', title: pageTextFix(sp.label || ''), sub: pageTextFix(sp.main || ''), url: '' };
    });
    var obs = (pv.obsShow || []).map(function(r){
      return { key: obsOrderKey(r), hideKey: obsHideKey(r), kind: r[4] || 'card', title: r[1] || '', sub: r[2] || '', url: r[3] || '' };
    });
    return { live: live, obs: obs };
  });
}
/** opts.hide / opts.order 읽기 (원본 hideState·orderState) */
export function promoHideState(o: Partial<PromoOpts>): { live: string[]; obs: string[] } { return hideState(o); }
export function promoOrderState(o: Partial<PromoOpts>): { live: string[]; obs: string[] } { return orderState(o); }

/** 결제혜택·유의사항 반영 기준 상태 1줄 + 설명 (원본 syncPayModeUi) */
export function promoPayState(pv: PromoStructured): { mode: '' | 'prev' | 'date'; text: string; kind: 'ok' | 'warn' | 'off'; note: string; prevName: string } {
  return __withPv(pv, function(){
    var o = pv.opts || {}, mode = o.payMode === 'prev' || o.payMode === 'date' ? o.payMode : '';
    var saveUse = __PV_CTX.usePrev; __PV_CTX.usePrev = true;   // 직전 라이브 이름은 모드와 상관없이 보여 준다
    var pc = prevLiveCase(null, pv.caseName || '', [null]);
    __PV_CTX.usePrev = saveUse;
    var pi = payWashInfo(pv), bd = _mdOfIso(broadcastDateStr(pv)) || '방송일 미확인', basis = pi.ds ? _mdOfIso(pi.ds) : '';
    var text, kind = pi.res ? 'ok' : pi.has ? 'warn' : 'off';
    if (mode === 'prev') text = pc ? '직전 라이브 동일 · ' + pc.name + (basis ? ' (' + basis + ' 기준)' : '') : '직전 라이브 없음';
    else if (mode === 'date') text = '판촉안 · ' + (basis && pi.dsLabel === '반영 일자' ? basis : '반영 일자 미입력') + ' 기준';
    else text = '판촉안 · 방송일 ' + bd + ' 기준';
    if (!pi.has && !(pv.paymentFullText || '').trim()) { text += ' · 결제혜택 원문 없음'; kind = 'warn'; } else if (!pi.has) kind = 'ok';
    var note = mode === 'prev' ? '직전 라이브가 실제로 쓴 결제혜택·유의사항을 그대로 씁니다. 이번 판촉의 결제혜택 원문은 쓰지 않습니다.'
      : mode === 'date' ? '판촉안 결제혜택 중 반영 일자에 진행 중인 혜택만 씁니다. (방송일 ' + bd + ')' : '판촉안 결제혜택 중 방송일에 진행 중인 혜택만 씁니다.';
    return { mode: mode, text: text, kind: kind, note: note, prevName: pc ? pc.name : '' };
  });
}

/** 변경 하이라이트 단위 [이름, 선택자] (원본 HL_UNITS) — 화면이 실제 DOM에서 비교한다 */
export const PROMO_HL_UNITS: [string, string][] = HL_UNITS;

export {
  parseRawToStructured, computeChanges, buildPromoPreviewText, renderMockPage, computeDeadlineFromCaseName,
  splitBenefit, normalizeGiftMain, condSentence, PayWash, joinProducts,
};

// 미리보기 HTML용 CSS — 원본 v38(+ 통합셋팅기 v13의 KV 영역) <style>에서 미리보기에 쓰는 규칙만 .promo-preview 안으로 한정 (검수 라벨·직접 수정 표시는 숨김)
export const PROMO_PREVIEW_CSS: string = ".promo-preview .btn.small{padding:4px 10px;font-size:12px;}.promo-preview .mockPage{width:100%;max-width:390px;margin:8px auto 0;background:#fff;box-shadow:0 0 0 1px var(--line);overflow:hidden;font-family:'Pretendard','Pretendard Variable',-apple-system,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;letter-spacing:-0.04em;color:#000;}.promo-preview .mockSec{display:flex;flex-direction:column;align-items:center;background:#fff;}.promo-preview .mockEmpty{color:#8a8a8a;font-size:12px;}.promo-preview .mockSecLabel{font-size:11px;color:#9a9a9a;padding:20px 20px 6px;letter-spacing:0;border-top:1px dashed #e5e5e5;margin-top:0;}.promo-preview .mockSec03{padding:64px 20px 0;}.promo-preview .mockEventCard{width:100%;background:#E3E0DC;border-radius:16px;padding:32px 24px;display:flex;flex-direction:column;gap:12px;}.promo-preview .mockTitle{font-size:22px;line-height:140%;font-weight:700;text-align:center;color:#000;}.promo-preview .mockEventContent{display:flex;flex-direction:column;gap:16px;}.promo-preview .mockHero{display:flex;align-items:center;gap:10px;}.promo-preview .mockImg{width:68px;height:68px;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;color:#c9c9c9;}.promo-preview .mockImg.small{width:48px;height:48px;font-size:16px;border-radius:6px;background:#fff;}.promo-preview .mockHeroText{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;font-size:14px;line-height:140%;color:#000;}.promo-preview .mockHeroGift{font-weight:600;font-size:18px;line-height:140%;}.promo-preview .mockCaptionList{display:flex;flex-direction:column;gap:2px;}.promo-preview .mockEventContent .mockCaptionList{padding-top:16px;border-top:1px solid #CACACA;}.promo-preview .mockCaption{display:flex;gap:5px;font-size:12px;line-height:140%;color:#262626;letter-spacing:-0.04em;}.promo-preview .mockCaption>span{min-width:0;}.promo-preview .mockCaption:before{content:'';flex:none;width:2px;height:2px;border-radius:50%;background:#262626;margin:8px 3px 0;}.promo-preview .mockSec04{padding:64px 20px;}.promo-preview .mockSec04 .mockTitle{font-size:26px;padding-bottom:16px;width:100%;}.promo-preview .mockBenefitList{width:100%;display:flex;flex-direction:column;gap:8px;}.promo-preview .mockBenefitRow{display:flex;align-items:center;gap:16px;background:#F4F4F4;border:1px solid #E1E1E1;border-radius:6px;padding:19px 15px;min-height:88px;box-sizing:border-box;}.promo-preview .mockBenefitRow>div:last-child{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;}.promo-preview .mockBenefitLabel{font-size:12px;line-height:140%;font-weight:500;color:#262626;}.promo-preview .mockBenefitMain{font-size:14px;line-height:130%;font-weight:600;color:#000;}.promo-preview .mockSec04 .mockCaptionList{width:100%;padding-top:16px;}.promo-preview .mockLinkList{width:100%;display:flex;flex-direction:column;background:#fff;}.promo-preview .mockLinkWrap{padding:0 20px 12px;}.promo-preview .mockLinkRow{box-sizing:border-box;display:flex;flex-direction:row;align-items:center;gap:8px;width:100%;min-height:88px;padding:0 20px 0 0;border-radius:8px;color:inherit;background:#EBD2CE;}.promo-preview .mockLinkWrap:nth-child(8n+2) .mockLinkRow{background:#CCE2EE;}.promo-preview .mockLinkWrap:nth-child(8n+3) .mockLinkRow{background:#CCEED7;}.promo-preview .mockLinkWrap:nth-child(8n+4) .mockLinkRow{background:#F2E7B9;}.promo-preview .mockLinkWrap:nth-child(8n+5) .mockLinkRow{background:#D3E6E5;}.promo-preview .mockLinkWrap:nth-child(8n+6) .mockLinkRow{background:#EAD1E5;}.promo-preview .mockLinkWrap:nth-child(8n+7) .mockLinkRow{background:#D2D8E6;}.promo-preview .mockLinkWrap:nth-child(8n+8) .mockLinkRow{background:#D9E8C1;}.promo-preview .mockLinkImg{width:82px;height:88px;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;color:rgba(0,0,0,.25);}.promo-preview .mockLinkBody{flex:1;min-width:0;display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:11.73px;}.promo-preview .mockLinkText{flex:1;min-width:0;max-width:200px;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:6px 0;}.promo-preview .obsEdit{outline:none;cursor:text;border-radius:2px;border-bottom:1px dashed rgba(232,89,12,.75);min-height:1.4em;word-break:keep-all;}.promo-preview .obsEdit:hover{background:rgba(255,244,229,.7);}.promo-preview .obsEdit:focus{background:#FFE3BF;}.promo-preview .obsEdit:empty:before{content:attr(data-ph);color:rgba(0,0,0,.32);font-weight:400;}.promo-preview .mockLinkMain{font-size:18px;line-height:140%;font-weight:600;letter-spacing:-0.04em;color:#000;opacity:.8;}.promo-preview .mockLinkSub{font-size:14px;line-height:140%;font-weight:500;letter-spacing:-0.03em;color:#262626;opacity:.7;}.promo-preview .mockChevron{flex:none;width:24px;height:24px;display:flex;align-items:center;justify-content:center;text-decoration:none;}.promo-preview .mockChevron i{display:block;width:8px;height:8px;border-top:1.4px solid #000;border-right:1.4px solid #000;transform:rotate(45deg);margin-left:-3px;}.promo-preview .mockLinkUrl{font-size:10px;color:var(--accent-2);margin:4px 2px 0;word-break:break-all;font-family:monospace;user-select:all;letter-spacing:0;}.promo-preview .mockSec13{padding:64px 20px 0;}.promo-preview .mockPayDark{width:100%;box-sizing:border-box;background:#000;border-radius:16px;padding:32px 24px;display:flex;flex-direction:column;gap:20px;}.promo-preview .mockPayDarkTitle{color:#fff;font-size:22px;line-height:140%;font-weight:700;text-align:center;}.promo-preview .mockPayHero2{background:#262626;border-radius:8px;padding:16px;min-height:111px;box-sizing:border-box;display:flex;align-items:center;gap:12px;}.promo-preview .mockPayHero2Badge{color:#fff;flex:none;width:90px;display:flex;flex-direction:column;gap:2px;}.promo-preview .mockPayHero2BadgeNum{font-family:'Lexend Mega','Pretendard',sans-serif;font-size:28px;font-weight:700;line-height:100%;letter-spacing:-0.05em;white-space:nowrap;}.promo-preview .mockPayHero2.first .mockPayHero2BadgeNum{font-size:32px;}.promo-preview .mockPayHero2BadgeUnit{font-family:'Lexend Mega','Pretendard',sans-serif;font-size:13px;font-weight:700;letter-spacing:-0.03em;margin-left:1px;}.promo-preview .mockPayHero2BadgePre{font-family:'Pretendard',-apple-system,'Malgun Gothic',sans-serif;font-size:12px;font-weight:600;letter-spacing:-0.02em;margin-right:1px;}.promo-preview .mockPayHero2BadgeLabel{font-size:13px;font-weight:600;line-height:140%;}.promo-preview .mockPayHero2Body{min-width:0;flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center;}.promo-preview .mockPayHero2Title{color:#FD312E;font-size:14px;font-weight:600;line-height:130%;}.promo-preview .mockPayHero2Desc{color:#fff;font-size:12px;line-height:140%;white-space:pre-line;}.promo-preview .mockPayHero2More{color:#fff;font-size:11px;line-height:140%;text-decoration:underline;}.promo-preview .mockPayRows{display:flex;flex-direction:column;gap:16px;}.promo-preview .mockPayRow2{display:flex;align-items:center;gap:8px;}.promo-preview .mockPayIcon2{width:40px;height:40px;box-sizing:border-box;padding:8px;border-radius:4px;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;font-family:'Lexend Mega','Pretendard',sans-serif;font-size:18px;font-weight:700;flex:none;}.promo-preview .mockPayRow2Body{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;padding:4px 0;}.promo-preview .mockPayRow2Label{color:#fff;font-size:14px;font-weight:500;line-height:140%;letter-spacing:-0.04em;}.promo-preview .mockPayRow2Value{color:#FD312E;font-size:14px;font-weight:600;line-height:130%;}.promo-preview .mockPayNum{font-family:'Lexend Mega','Pretendard',sans-serif;font-size:21px;font-weight:700;line-height:18px;}.promo-preview .mockPayNumUnit{margin-left:3px;font-family:'Lexend Mega','Pretendard',sans-serif;font-size:13px;font-weight:700;letter-spacing:-0.03em;}.promo-preview .mockSec14{padding:64px 20px 40px;align-items:stretch;}.promo-preview .mockLegalCta{display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;line-height:100%;color:#000;letter-spacing:-0.02em;}.promo-preview .mockLegal{margin-top:16px;background:#F4F4F4;border-radius:8px;padding:20px 16px;display:flex;flex-direction:column;gap:12px;}.promo-preview .mockLegalTitle{font-size:13px;font-weight:600;line-height:18px;letter-spacing:-0.02em;color:#000;}.promo-preview .mockLegalBody{font-size:12px;line-height:140%;color:#262626;letter-spacing:-0.04em;}.promo-preview .legalBullet{padding-left:9px;text-indent:-9px;margin-bottom:2px;}.promo-preview .legalBullet:last-child{margin-bottom:0;}.promo-preview .legalHeading{font-weight:600;color:#000;margin:12px 0 4px;}.promo-preview .legalHeading:first-child{margin-top:0;}.promo-preview .frame .mockPage{box-shadow:none;margin-top:0;}.promo-preview body.onlyChg .dimmable:not(.chgd){opacity:.22;}.promo-preview .missChip{display:inline-block;font-size:10.5px;font-weight:700;color:#a12020;background:#fdecec;border:1px solid #f3c3c3;border-radius:999px;padding:1px 7px;margin-left:6px;letter-spacing:0;vertical-align:middle;}.promo-preview .accSubBody{padding-top:6px;}.promo-preview .mockIconSvg{display:block;}.promo-preview .mockImg.sv{background:transparent;overflow:visible;position:relative;}.promo-preview .mockImg.sv .mockIconSvg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);}.promo-preview .mockImg.small{position:relative;overflow:visible;}.promo-preview .mockImg.small.sv{width:48px;height:48px;}.promo-preview .mockSecRebro{padding:64px 20px 0;}.promo-preview .mockRebroCard{width:100%;background:#E3E0DC;border-radius:16px;padding:32px 24px;display:flex;flex-direction:column;gap:12px;}.promo-preview .mockRebroCard .mockTitle{letter-spacing:-0.04em;}.promo-preview .mockRebroBox{display:flex;align-items:center;gap:10px;background:#fff;border-radius:16px;min-height:68px;padding:0;}.promo-preview .mockRebroImg{flex:none;width:68px;height:68px;display:flex;align-items:center;justify-content:center;}.promo-preview .mockRebroText{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;padding-right:10px;}.promo-preview .mockRebroEyebrow{font-family:'Pretendard',\"Malgun Gothic\",sans-serif;font-weight:400;font-size:14px;line-height:140%;letter-spacing:-0.04em;color:#000;}.promo-preview .mockRebroBig{font-family:'Pretendard',\"Malgun Gothic\",sans-serif;font-weight:600;font-size:18px;line-height:140%;letter-spacing:-0.04em;color:#FD312E;}.promo-preview .cookEdit{border-bottom:1px dashed #E8590C;background:#FFF4E5;border-radius:2px;outline:none;cursor:text;}.promo-preview .cookEdit:focus{background:#FFE3BF;}.promo-preview .capSub.cookEdit{display:block;padding-left:.33em;}.promo-preview .mockCaption .capSub{display:block;padding-left:.33em;}.promo-preview .reviewOnly{display:none}.promo-preview .obsEdit{border-bottom:none;cursor:default}.promo-preview .mockKv{width:100%;background:#fff;}.promo-preview .mockKvTop{box-sizing:border-box;height:440px;padding:46px 35px;display:flex;flex-direction:column;align-items:center;gap:7px;background:#fff;position:relative;}.promo-preview .mockKvHead{width:215px;height:18px;display:flex;align-items:flex-start;gap:7px;flex:none;}.promo-preview .mockKvLogo{width:102px;height:14px;margin-top:2px;flex:none;display:block;}.promo-preview .mockKvDate{flex:1;min-width:0;height:18px;font-size:15px;line-height:18px;font-weight:500;letter-spacing:-0.04em;color:#000;white-space:nowrap;}.promo-preview .mockKvTitle{width:320px;display:flex;flex-direction:column;align-items:center;gap:10px;}.promo-preview .mockKvMain{max-width:320px;font-size:32px;line-height:130%;font-weight:700;letter-spacing:-0.05em;text-align:center;color:#000;word-break:keep-all;}.promo-preview .mockKvSub{width:211px;min-height:40px;font-size:14px;line-height:140%;font-weight:500;letter-spacing:-0.03em;text-align:center;color:#000;}.promo-preview .mockKvImg{position:absolute;left:35px;right:35px;bottom:24px;height:190px;border:1px dashed #d4d4d4;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#b0b0b0;letter-spacing:0;}.promo-preview .mockKvBtns{box-sizing:border-box;height:84px;padding:20px;background:#F1EFEC;display:flex;gap:12px;}.promo-preview .mockKvBtn{flex:1;min-width:145px;height:44px;border-radius:30px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;letter-spacing:-0.04em;box-sizing:border-box;}.promo-preview .mockKvBtn.dark{background:#000;color:#fff;}.promo-preview .mockKvBtn.line{border:1px solid #000;color:#000;}.promo-preview .mockAddWrap{display:flex;flex-direction:column;gap:4px;}.promo-preview .txtEdit{outline:none;cursor:default;}.promo-preview .addCtl,.promo-preview .addPlus,.promo-preview .dragH{display:none}.promo-preview:not(.hlOff) .hlChg{background:#FFF1A6 !important;box-shadow:0 0 0 2px #F2C200 !important;border-radius:6px;}.promo-preview:not(.hlOff) #secPay .hlChg{background:#5A4800 !important;box-shadow:0 0 0 2px #FFD400 !important;}.promo-preview:not(.hlOff) .mockLinkWrap.hlChg{padding-top:6px;padding-bottom:6px;}";
