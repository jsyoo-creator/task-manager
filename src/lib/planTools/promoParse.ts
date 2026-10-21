// @ts-nocheck
/* =============================================================================
 * 라이브 판촉 원문 → 워싱본(상세페이지 미리보기) 로직
 * 원본: Live_판촉_업데이트기_v21.html (Planning Update 폴더) — 2026-10 이식
 * 원본 툴과 다시 맞출 수 있도록 함수 이름·본문은 원본 그대로 두었다 (var·function 스타일 유지).
 * 뺀 것: localStorage(방송 이력·OBS 공통 배너 카피 뱅크), DOM 조작, 복사·토스트, 비교표 UI.
 * 바꾼 것: renderParseSummary → summarizeParse (DOM 대신 칩 배열을 돌려줌, 뱅크 없이).
 * 파일 맨 아래의 export만 화면에서 쓴다. (이 파일은 원본 JS를 그대로 옮겨 와 타입 검사를 끈다 —
 * 바깥에 내보내는 함수에는 타입을 붙여 두었다.)
 * ========================================================================== */

var STORE_KEY = { cases: "promo_mgr_cases_v5", obsBank: "promo_mgr_obs_bank_v5", obsBase: "promo_mgr_obs_base_v5" };
var DEFAULT_OBS_BASE = "https://www.lge.co.kr/benefits/exhibitions/detail-";

function escapeHtml(s){
  if(s === undefined || s === null) return "";
  return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; });
}
function extractEventCode(url){
  if(!url) return '';
  var m = url.match(/PE\d+/i);
  return m ? m[0].toUpperCase() : '';
}
/* 실제 방송 데이터 확인 결과, 반복적으로 쓰이는 사은품은 최종 노출 시 상표 표기(R)가 붙습니다.
   필요 시 아래 목록에 항목을 추가해 확장하세요. */
var GIFT_TRADEMARKS = { '투썸플레이스 아메리카노': '투썸플레이스 아메리카노(R)' };
/* 실제 라이브 상세페이지 기획서(HSAD 페이지 구조 가이드) 5개 방송(냉장고세탁기/냉장고쿠킹/TV/
   홈스타일/PC)을 비교해 본 결과, 아래 5개 문구는 방송·품목과 무관하게 [유의사항] 영역 맨 아래에
   토씨 하나 틀리지 않고 항상 그대로 들어가는 표준 고정 문구였다. 원문에 별도로 "[유의사항]"
   섹션을 직접 써주지 않은 경우, buildMockLegalText()가 이 문구를 자동으로 채워 넣는다. */
var STANDARD_LEGAL_BOILERPLATE = [
  '본 행사 내용은 당사 사정에 따라 예고 없이 변경 또는 중단될 수 있습니다.',
  '결제일 할인, 무이자 할부 등의 카드 혜택은 LGE.COM 월별 회원혜택에서 자세한 확인이 가능합니다.',
  '경품 지급은 구매자의 회원 정보에 따라 진행하며, 잘못된 정보 기입 시 당첨 및 경품 지급이 불가합니다.',
  '경품 및 사은품의 경우 구매 취소 시 지급되지 않으며, 이미 지급된 사은품에 대해서는 환수될 수 있습니다.',
  '경품에 대한 제세공과금은 LG전자가 부담하며, 이를 위한 개인 정보 수집 절차가 필요합니다. 해당 과정에서 이벤트 위탁사인 (주)에이치에스애드 및 (주)뉴메리크스튜디오를 통한 연락이 갈 수 있으며 연락처 오기입, 2주 이상의 장기간 부재 등의 이유로 연락이 닿지 않는 경우 경품 당첨이 취소될 수 있습니다.'
];
/* "LGE.COM 결제혜택"의 히어로 카드(예: LGE.COM 신한카드)는 실제 화면에서 "자세히 보기"를 누르면
   유의사항 박스 맨 아래에 "LGE.COM 구매혜택 관련 안내" 섹션으로 카드사별 세부 유의사항이 번호(1~6)
   순서로 펼쳐진다. 5개 기획서(PPT) 전체(PC/TV/냉장고세탁기/냉장고쿠킹/홈스타일)에서 이 6개 섹션의
   문구가 토씨 하나 안 틀리고 완전히 동일하게 반복되는 것을 확인했다 — 방송·판촉 내용과 무관하게
   항상 똑같이 쓰이는 카드사/결제수단 표준 안내문이므로, STANDARD_LEGAL_BOILERPLATE와 같은 방식으로
   고정 문구를 등록해두고 결제혜택에 해당 카드/결제수단이 등장할 때만 자동으로 붙인다.
   주의: PAYMENT_NOTICE_SECTIONS[0]의 "※ 여신금융협회 심의필" 줄은 유효기간(2026.03.04~2027.03.03)이
   있는 심의번호라서, 그 이후에는 기획서에서 최신 번호로 갱신해서 교체해야 한다. */
var PAYMENT_NOTICE_SECTIONS = [
  {
    heading: 'LGE.COM 신한카드 플러스 서비스 유의사항',
    trigger: function(ctx){ return ctx.some(function(t){ return /신한카드/.test(t) && /플러스/.test(t); }); },
    bullets: [
      '계약 체결 전, 카드 상품별 연회비, 이용조건 등 상세사항은 금융상품설명서와 약관을 확인하시기 바랍니다.',
      '금융소비자는 금융소비자보호법 제19조 제1항에 따라 해당 금융상품 또는 서비스에 대하여 설명 받을 권리가 있습니다.',
      '연체이자율은 \'회원별, 이용상품별 약정금리+최대 연 3%, 법정 최고금리(연 20%)이내\'에서 적용됩니다. 단, 연체 발생 시점에 약정금리가 없는 경우 아래와 같이 적용됩니다.\n- 일시불 거래 연체 시: 거래 발생 시점의 최소기간(2개월) 유이자 할부 금리\n- 무이자 할부 거래 연체 시: 거래 발생 시점의 동일한 할부 계약기간의 유이자 할부 금리',
      '신용카드 발급이 부적정한 경우(개인신용평점 낮음,연체(단기 포함) 사유 발생 등), 카드발급이 제한될 수 있습니다.',
      '카드 이용대금과 이에 수반되는 모든 수수료는 고객님께서 지정하신 결제일에 상환하여야 합니다.',
      '상환능력에 비해 신용카드 사용액이 과도할 경우, 귀하의 개인신용평점이 하락할 수 있습니다.',
      '개인신용평점 하락 시 금융거래와 관련된 불이익이 발생할 수 있습니다.',
      '일정기간 신용카드 이용대금을 연체할 경우, 결제일이 도래하지 않은 모든 신용카드 이용대금을 변제할 의무가 발생할 수 있습니다.',
      '※ 여신금융협회 심의필 제2026-C1h-02851호(2026.03.04~2027.03.03)',
      '신한카드 고객센터 (1544-7000)'
    ]
  },
  {
    heading: '7% 카드 결제일 할인',
    trigger: function(ctx){ return ctx.some(function(t){ return /결제일\s*할인/.test(t); }); },
    bullets: [
      '50만원 이상 해당 카드사(신한/현대/국민/롯데/하나/우리 신용카드)를 통한 결제 시 적용되며 결제 시점에 할인되는 것이 아닌, 카드 대금 지불 시점에 청구 할인으로 적용됩니다. (네이버/카카오 페이 등의 간편 결제 시, 적용 불가)',
      '결제일 할인은 횟수 상관없이 카드당 매월 누적 100만원 한도로 할인 적용되며, 동일 명의의 카드와 가족 카드는 하나의 카드로 간주되어 할인금액이 합산됩니다. (매월 1일 ~ 말일 누적 금액 기준) 가족카드의 경우, 카드에 기재된 이름이 다르더라도 회원 본인과 동일한 명의로 간주됩니다.',
      '결제일 할인 혜택은 기존 신한/현대/국민/롯데/하나/우리 신용카드 실적과는 무관하게 적용됩니다.',
      '체크/법인/선불/충전/기프트 카드는 결제일 할인 혜택이 적용되지 않습니다.'
    ]
  },
  {
    heading: '무이자 할부 혜택',
    trigger: function(ctx){ return ctx.some(function(t){ return /무이자/.test(t); }); },
    bullets: [
      '12개월 무이자 혜택은 100만원 이상 결제 시 적용되며, 그 외 개월 수는 5만원 이상 결제 시 무이자 혜택 적용됩니다. (네이버/카카오 페이 등의 간편 결제 시, 적용 불가)',
      '신한카드 5만원 이상 결제 시 2~3개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다. (비인증(정기결제 등) 제외)',
      'KB 국민카드 5만원 이상 결제 시 2~5개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다. (LG전자 전용)',
      '삼성카드 5만원 이상 결제 시 2~3개월 무이자 혜택 적용됩니다.',
      'NH농협카드 5만원 이상 결제 시 2~6개월 무이자 혜택 적용됩니다.',
      '현대카드 5만원 이상 결제 시 2~3개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다.',
      'BC카드 5만원 이상 결제 시 2~6개월 무이자 혜택 적용됩니다. (2분기 정책 대상 : BC로고 카드* 우리, IBK, NH, SC, iM뱅크(구.대구), 부산, 경남, 신한, 하나, KB, 씨티BC(씨티 비자 제외), sh수협, 광주의 개인 신용)',
      '하나카드 5만원 이상 결제 시 2~5개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다. (티켓, 렌터카, 홈쇼핑, 손해보험, 아울렛, 학원(세계로) 업종 제외)',
      '롯데카드 5만원 이상 결제 시 2~5개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다.',
      '우리카드 5만원 이상 결제 시 2~6개월 무이자, 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다.',
      '무이자 할부와 결제일 할인 혜택(신한/현대/국민/롯데/하나/우리 신용카드 실적과 무관)은 중복으로 적용 가능합니다.',
      '체크/법인/선불/충전/기프트/하이브리드 카드는 무이자 할부 혜택이 적용되지 않습니다.',
      '법인(기업)/체크/선불/기프트/은행계열 카드는 혜택에서 제외됩니다. (BC마크가 없는 NON BC 카드 불가)',
      '본 행사는 카드사 사정에 따라 변경 또는 중단될 수 있습니다.',
      '무이자 할부 결제 시 포인트, 마일리지 적립이 제외될 수 있습니다.',
      '환금성, 상품권은 제외됩니다.',
      '일반 신용카드 거래에 한하며 스마일페이는 지마켓이 제공하는 별도 행사 정책에 따릅니다.'
    ]
  },
  {
    heading: 'LGE.COM 신한카드 플러스 서비스 7% 캐시백 유의사항',
    trigger: function(ctx){ return ctx.some(function(t){ return /신한카드/.test(t) && /플러스/.test(t); }); },
    bullets: [
      '신한카드 플러스 서비스 약정 고객대상으로 7% 캐시백이 적용됩니다. (최대 100만원)',
      '신한카드 플러스 서비스 100만원 이상 결제 시 12개월 무이자 혜택 적용됩니다.',
      '신한카드 플러스 서비스 약정 결제 시 LG멤버십 포인트 5만P 제공됩니다.',
      '신한카드 플러스 서비스 7% 캐시백은 LGE.COM 신한카드로 자동에서 계좌로 지급됩니다. (50만원 이상 결제 시 캐시백 최대 100만원 한도)',
      '신한카드 플러스 서비스 7% 캐시백은 구매하신 제품을 모두 배송 받은 후, 마지막 제품이 배송된 날 기준으로 다음달 말일에 지급됩니다.',
      '캐시백이 지급되기 전 대상카드를 해지, 교체, 연체, 카드미사용, 이용정지 등의 사유로 정상 보유하지 않은 고객은 행사대상에서 제외됩니다.',
      '신한카드 플러스 서비스 LG멤버십 포인트 5만P 혜택은 구매하신 제품을 모두 배송 받은 후, 마지막 제품이 배송된 날 기준으로 다음달 말일에 지급됩니다.',
      '이용(결제)금액은 쿠폰 적용, 포인트 사용 등의 혜택을 제외한 최종 기준 결제 금액 기준입니다.',
      '혜택이 잘못 제공된 경우(중복 제공 등) 받은 혜택을 금액으로 청구할 수 있습니다.',
      'LGE.COM 플러스 서비스 결제 시에는 7% 결제일 할인이 적용되지 않습니다.'
    ]
  },
  {
    heading: '현대카드 M 캐시백 유의사항',
    trigger: function(ctx){ return ctx.some(function(t){ return /현대카드\s*M\b/i.test(t); }); },
    bullets: [
      '이용기간 내 현대카드 M으로 LGE.COM에서 이용 시 최대 20만원 캐시백이 적용됩니다.',
      'LGE.COM에서 20만원 이상 결제 시 18만원 캐시백이 적용됩니다.',
      'LGE.COM에서 100만원 이상 결제 시 20만원 캐시백이 적용됩니다.',
      'LGE.COM에서 결제 금액 50% M포인트 자동 사용됩니다. (최대 30만 M포인트 한도)'
    ]
  },
  {
    heading: '카카오페이 간편결제 유의사항',
    trigger: function(ctx){ return ctx.some(function(t){ return /카카오페이/.test(t); }); },
    // 프로모션 기간(예: "9.9 10시 ~ 9.30")은 매달 갱신되는 값이라 고정 문구로 박아두면 금방 옛날 정보가
    // 되어버린다. 그래서 이 기간만 결제혜택 원문에서 실제로 찾은 값으로 채워 넣고(placeholder ↓),
    // 원문에서 기간을 못 찾으면 날짜 없이 "프로모션 기간 중"으로만 표시해 틀린 날짜를 보여주지 않는다.
    bullets: [
      '프로모션 기간{{PERIOD}} 중 15만원 이상 결제 건이 있는 경우에 적용되며 결제금액 합산으로 적용되지 않습니다.',
      '카카오페이에 등록된 페이머니 / 전체 카드로 15만원 이상 결제 시 7% 즉시 할인이 적용됩니다. (최대 50만원, 실명 인증 기준 1인당 기간 내 최대 1회, 매일 00시 선착순)',
      '카카오페이에 등록된 비씨카드로 15만원 이상 결제 시 8% 즉시 할인이 적용됩니다. (최대 100만원, 실명 인증 기준 1인당 기간 내 최대 1회, 매일 00시 선착순)',
      '※ 선착순 적용여부 및 할인이 적용된 실 결제 금액은 카카오페이 결제창 하단 결제금액을 통해 확인'
    ]
  }
];
function applyGiftTrademark(gift){
  if(!gift) return gift;
  var g = gift.trim();
  return GIFT_TRADEMARKS[g] || gift;
}

/* LGE.COM 결제혜택 카드형 UI — 실제 페이지(HSAD 페이지 구조 가이드 14번 슬라이드)를 보면
   "LGE.COM 신한카드"처럼 카드 1종을 단독으로 내세우는 항목은 큼직한 히어로 타일(아이콘+제목+설명)로,
   "신한/현대/국민/롯데/하나/우리카드" 처럼 여러 카드사를 묶어 나열하는 일반 조건/카카오페이 등은
   작은 아이콘 행으로 나간다. 원문에서 이 둘을 기계적으로 구분하는 기준은: 항목이 대괄호[ ]로 시작하고
   그 안에 "카드"라는 단어가 있으면서 "/"(여러 카드 나열)가 없으면 → 단독 카드 항목(히어로),
   그 외(괄호( )로 시작하거나 여러 카드/카카오페이·네이버페이 등)는 → 아이콘 행으로 취급한다.
   이 구분이 애매하거나 항목을 아예 못 만든 경우를 대비해, 파싱 결과가 비어있으면 항상 원문
   텍스트 박스로 그대로 보여주는 폴백을 유지한다(문구를 임의로 지어내지 않기 위함). */
function splitPaymentItems(text){
  var lines = (text||'').split('\n');
  var items = [];
  var cur = null;
  for(var i=0;i<lines.length;i++){
    var trimmed = lines[i].trim();
    if(!trimmed) continue;
    if(/^[0-9]+[.)]\s*/.test(trimmed)){
      if(cur) items.push(cur);
      cur = trimmed.replace(/^[0-9]+[.)]\s*/, '');
    } else if(cur){
      cur += ' ' + trimmed;
    } else {
      cur = trimmed;
    }
  }
  if(cur) items.push(cur);
  return items;
}
function isPaymentHeroText(t){
  // 신한카드 플러스 / 현대카드 M은 실제 확인된 히어로 카드 대상이라, 대괄호로 안 감싸져 있어도
  // 문구만으로 바로 히어로로 인식한다.
  if(/신한카드/.test(t) && /플러스/.test(t)) return true;
  if(/현대카드\s*M\b/i.test(t)) return true;
  var m = t.match(/^[［\[]([^\]］]+)[\]］]/);
  if(!m) return false;
  var label = m[1];
  return label.indexOf('카드') !== -1 && label.indexOf('/') === -1;
}
// 히어로 배지 숫자는 실제 화면(캡처 확인)에서 "이 카드로 OO만원 이상 결제하면" 같은 지출 조건
// 금액을 그대로 보여준다("100만 먼저 혜택"). 그래서 "N만원/천원 이상" 형태의 조건 금액을 최우선으로
// 찾고, 그런 조건이 없는 문구(예: 한도 금액만 있는 경우)는 차선책으로 "최대 N만원/N%" 표기를 쓴다.
// 라벨도 실제 화면처럼 조건 금액이 있으면 "먼저 혜택", 없으면 "결제 혜택"으로 구분한다(카드마다
// 다른 정확한 마케팅 문구는 원문만으로는 알 수 없어 임의로 지어내지 않고 이 두 일반 표현만 사용).
// 신한카드/현대카드 M 히어로 타일은 5개 기획서(PPT) + 실제 화면 캡처를 대조해본 결과, "문장 틀"은
// 방송이 달라도 항상 똑같이 유지되고("N만원 이상 결제 및 플러스 서비스 이용 시", "이벤트 응모 후
// A/B만원 결제 시 C/D만원 캐시백") 그 안의 금액만 시기에 따라 달라지는 걸 확인했다(예: 구버전 PPT는
// "50만원 이상", 최신 PPT·실제 캡처는 "100만원 이상"). 그래서 문장 틀은 실제 확인된 형태 그대로 쓰되,
// 숫자는 항상 이번 방송 원문에서 그대로 뽑아 쓴다 — 금액을 고정값으로 박아두면 다음에 조건이
// 바뀌었을 때 옛날 숫자를 계속 보여주는 위험이 있기 때문이다.
function buildPaymentHero(t){
  var m = t.match(/^[［\[]([^\]］]+)[\]］]\s*(.*)$/);
  var bracketTitle = m ? m[1].trim() : '';
  var rest = (m ? m[2] : '').trim().replace(/^결제\s*시[,]?\s*/, '');

  if(/신한카드/.test(t) && /플러스/.test(t)){
    var capM = t.match(/최대\s*([0-9,]+)\s*만원/);
    var cap = capM ? capM[1] : '';
    return {
      title: 'LGE.COM 신한카드',
      desc: cap ? (cap+' 만원 이상 결제 및 플러스 서비스 이용 시') : rest || t,
      badgeNum: cap, badgeUnit: '만', badgeLabel: '먼저 혜택', raw: t
    };
  }
  var _pairRe = /([0-9,]+)\s*만원\s*이상\s*결제\s*시\s*([0-9,]+)\s*만원\s*캐시백/g;
  var _pairCount = (t.match(_pairRe)||[]).length;
  if(/현대카드\s*M\b/i.test(t) || (bracketTitle && /이벤트\s*응모|응모/.test(t) && _pairCount >= 2)){
    // "OO만원 이상 결제 시 OO만원 캐시백"이 원문에 반복되는 형태(문턱금액↔캐시백 짝)를 그대로 찾아
    // "A/B만원 결제 시 C/D만원 캐시백" 형태로 압축한다. 짝을 못 찾으면 원문 설명을 그대로 보여준다.
    var pairs = [];
    var re = /([0-9,]+)\s*만원\s*이상\s*결제\s*시\s*([0-9,]+)\s*만원\s*캐시백/g, pm;
    while((pm = re.exec(t))){ pairs.push([pm[1], pm[2]]); }
    var desc = rest || t, badgeNum = '';
    var badgePre = '';
    if(pairs.length >= 2){
      desc = '이벤트 응모 후 '+pairs.map(function(x){ return x[0]; }).join('/')+'만원 결제 시 '+pairs.map(function(x){ return x[1]; }).join('/')+' 만원 캐시백';
      badgePre = '최대'; badgeNum = pairs[pairs.length-1][1];
    } else if(pairs.length === 1){
      desc = pairs[0][0]+'만원 이상 결제 시 '+pairs[0][1]+'만원 캐시백';
      badgeNum = pairs[0][1];
    } else {
      var maxM = t.match(/최대\s*([0-9,]+)\s*만원/);
      if(maxM){ badgePre = '최대'; badgeNum = maxM[1]; }
    }
    return { title: /현대카드\s*M\b/i.test(t) ? '현대카드 M' : bracketTitle, desc: desc, badgePre: badgePre, badgeNum: badgeNum, badgeUnit: '만원', badgeLabel: '결제 혜택', raw: t };
  }

  // 그 외 카드는 정확한 고정 문구를 확보하지 못했으니 원문을 그대로 보여주는 일반 로직을 쓴다.
  var title = bracketTitle || t;
  var condNum = t.match(/([0-9,]+)\s*(만원|천원)\s*이상/);
  var otherNum = t.match(/(최대\s*)?([0-9,]+)\s*(만원|%|천원)/);
  var badgeNum2 = '', badgeUnit2 = '', badgeLabel2 = '결제 혜택';
  if(condNum){ badgeNum2 = condNum[1]; badgeUnit2 = condNum[2]; badgeLabel2 = '먼저 혜택'; }
  else if(otherNum){ badgeNum2 = ((otherNum[1]||'').trim()+' '+otherNum[2]).trim(); badgeUnit2 = otherNum[3]; }
  return { title: title, desc: rest || t, badgeNum: badgeNum2, badgeUnit: badgeUnit2, badgeLabel: badgeLabel2, raw: t };
}
function paymentIconInfo(t){
  // 실제 구현 화면(캡처) 기준: 할인=%, 무이자 할부=/, 캐시백=C, 포인트 적립=P
  if(/무이자/.test(t)) return {icon:'/'};
  if(/캐시백/.test(t)) return {icon:'C'};
  if(/포인트|적립/.test(t)) return {icon:'P'};
  if(/할인/.test(t)) return {icon:'%'};
  return {icon:'•'};
}
// 결제혜택 아이콘 행. 실제 구현 화면 캡처 기준 형식:
//   [혜택 대상 + 혜택명]  (예: "신한/현대/국민/롯데/우리 신용카드 결제일 할인")
//   [핵심 수치]           (예: "7 %", "12 개월")
// 원문은 "(50만원 이상) 신한/현대/…카드로 결제 시, 7% 결제일 할인 (부가설명)" 형태라서
//  ① 맨 앞 "(…이상)" 조건 괄호는 화면 문구에서 빼고, ② "A/B/C카드로 결제 시"는 "A/B/C 신용카드"로,
//  ③ 값 뒤의 혜택명("결제일 할인")은 대상 뒤로 옮기고, ④ 값 뒤 괄호 부가설명은 검수용으로만 남긴다.
function buildPaymentRow(t){
  var s = t.trim(), condNote = '';
  var cm = s.match(/^[\(（]([^)）]*)[\)）]\s*/);
  if(cm){ condNote = cm[1].trim(); s = s.slice(cm[0].length); }
  var m = s.match(/^(.*?(?:결제|이용)\s*시)[,]?\s*(.+)$/);
  var prefix = m ? m[1].trim() : s;
  var body = m ? m[2].trim() : '';
  var main = body, note = '';
  var pm = body.match(/^([^(（]+)[\s]*([\(（][\s\S]+)$/);
  if(pm){ main = pm[1].trim(); note = pm[2].trim(); }
  var vm = main.match(/^(최대\s*)?([0-9][0-9,.]*)\s*(%|개월|만원|만P|만|원|P)?\s*(.*)$/);
  var label, value;
  if(vm && vm[4]){
    var name = vm[4].trim();
    value = ((vm[1]||'').trim()+' '+vm[2]+(vm[3]||'')).trim();
    var cardList = prefix.match(/^([^\s]*\/[^\s]*?)카드(?:로|으로)?\s*결제\s*시$/);
    label = cardList ? (cardList[1]+' 신용카드 '+name) : (prefix+' '+name);
  } else {
    label = prefix; value = main;
  }
  var info = paymentIconInfo(t);
  var review = [condNote ? '원문 조건: '+condNote : '', note].filter(Boolean).join(' · ');
  return { icon: info.icon, label: label, value: value, note: review, raw: t };
}
// renderPaymentBenefitBox()와 유의사항 박스(buildMockLegalHtml) 둘 다 "결제혜택 원문 중 어떤 항목이
// 히어로 카드인지"를 알아야 해서(카드사별 세부 유의사항을 붙일지 판단) 파싱 로직을 여기 한 곳에 모은다.
function paymentHeroesFrom(paymentFullText){
  return splitPaymentItems(paymentFullText).filter(isPaymentHeroText).map(buildPaymentHero);
}
// 유의사항 박스에서 "결제혜택에 어떤 카드/결제수단이 등장했는지"를 판단하려면 히어로뿐 아니라
// 아이콘 행(카카오페이/무이자/결제일할인 등)의 원문도 같이 봐야 한다. 두 종류를 합쳐서 돌려준다.
function paymentAllTextsFrom(paymentFullText){
  return splitPaymentItems(paymentFullText||'');
}
// "7% 결제일 할인" 같은 값에서 맨 앞 숫자+단위만 큰 숫자(Lexend Mega)로, 나머지는 일반 문구로 나눈다.
function splitPayValue(value){
  var m = (value||'').match(/^(최대\s*)?([0-9][0-9,.]*)\s*(%|개월|만원|만P|만|원|P)?(.*)$/);
  if(!m) return null;
  return { pre: (m[1]||'').trim(), num: m[2], unit: m[3]||'', rest: m[4]||'' };
}
function renderPaymentBenefitBox(paymentFullText){
  var items = splitPaymentItems(paymentFullText);
  if(!items.length){
    // 항목을 나누지 못한 경우(번호 형식이 아닌 자유 서술형 원문 등) → 원문 텍스트 박스로 폴백
    return '<div class="mockSec mockSec13" id="secPay"><div class="mockPayDark dimmable" data-key="pay"><div class="mockPayDarkTitle">LGE.COM 결제 혜택</div>'+
      '<div class="mockLegalBody" style="color:#fff;">'+escapeHtml(paymentFullText)+'</div></div></div>';
  }
  var heroes = [], rows = [];
  items.forEach(function(t){
    if(isPaymentHeroText(t)) heroes.push(buildPaymentHero(t));
    else rows.push(buildPaymentRow(t));
  });
  var html = '<div class="mockSec mockSec13" id="secPay"><div class="mockPayDark dimmable" data-key="pay"><div class="mockPayDarkTitle">LGE.COM 결제 혜택</div>';
  heroes.forEach(function(h, idx){
    html += '<div class="mockPayHero2'+(idx===0?' first':'')+'"><div class="mockPayHero2Badge">'+
      (h.badgeNum ? '<div class="mockPayHero2BadgeNum">'+(h.badgePre ? '<span class="mockPayHero2BadgePre">'+escapeHtml(h.badgePre)+' </span>' : '')+escapeHtml(h.badgeNum)+'<span class="mockPayHero2BadgeUnit">'+escapeHtml(h.badgeUnit)+'</span></div>' : '') +
      '<div class="mockPayHero2BadgeLabel">'+escapeHtml(h.badgeLabel)+'</div></div>'+
      '<div class="mockPayHero2Body"><div><div class="mockPayHero2Title">'+escapeHtml(h.title)+'</div>'+
      '<div class="mockPayHero2Desc">'+escapeHtml(h.desc)+'</div></div>'+
      '<div class="mockPayHero2More">자세히 보기</div></div></div>';
  });
  if(rows.length){
    html += '<div class="mockPayRows">';
    rows.forEach(function(r){
      var sv = r.value ? splitPayValue(r.value) : null;
      var valueHtml = '';
      if(r.value){
        valueHtml = sv
          ? '<div class="mockPayRow2Value">'+(sv.pre?escapeHtml(sv.pre)+' ':'')+'<span class="mockPayNum">'+escapeHtml(sv.num)+'</span><span class="mockPayNumUnit">'+escapeHtml(sv.unit)+'</span>'+escapeHtml(sv.rest)+'</div>'
          : '<div class="mockPayRow2Value">'+escapeHtml(r.value)+'</div>';
      }
      html += '<div class="mockPayRow2"><div class="mockPayIcon2">'+escapeHtml(r.icon)+'</div>'+
        '<div class="mockPayRow2Body"><div class="mockPayRow2Label">'+escapeHtml(r.label)+'</div>'+
        valueHtml +
        (r.note ? '<div class="mockPayRow2Note reviewOnly">검수용 · '+escapeHtml(r.note)+'</div>' : '') +
        '</div></div>';
    });
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}
function getObsBaseUrl(){ return DEFAULT_OBS_BASE; }

function diffFields(prev, cur, fieldsMap){
  var log = [];
  Object.keys(fieldsMap).forEach(function(k){
    var pv = prev ? (prev[k]||'-') : null;
    var cv = cur[k] || '-';
    if(pv === null){ if(cv !== '-') log.push(fieldsMap[k]+' 등록: '+cv); }
    else if(pv !== cv) log.push(fieldsMap[k]+': '+pv+' → '+cv);
  });
  return log;
}
function diffRowsGeneric(prevRows, newRows, label){
  var prevSet = (prevRows||[]).map(function(r){ return r.join(' / '); });
  var newSet = (newRows||[]).map(function(r){ return r.join(' / '); });
  var log = [];
  newSet.forEach(function(r){ if(prevSet.indexOf(r) === -1) log.push(label+' 추가/변경: '+r); });
  prevSet.forEach(function(r){ if(newSet.indexOf(r) === -1) log.push(label+' 삭제/이전: '+r); });
  return log;
}

/* ================= 원본 판촉 텍스트 → 구조화 데이터 (순수 함수, DOM 건드리지 않음) ================= */
function findIdx(text, re){ return text.search(re); }
function splitParagraphs(text){
  return text.split(/\n\s*\n/).map(function(p){ return p.trim(); }).filter(Boolean);
}
/* "1) ... 2) ... 3) ..." 처럼 줄바꿈(빈 줄) 없이 번호만으로 이어붙은 항목들도
   번호가 나오는 줄을 기준으로 강제로 각각 분리한다. "[TV]"처럼 대괄호로 된 줄은
   묶음 표시(tag)로 취급해 이후 항목들에 붙여준다. */
function splitNumberedItems(text){
  var lines = (text||'').split('\n');
  var items = [];
  var cur = null;
  var tag = '';
  function flush(){
    if(cur && cur.lines.join('\n').trim()) items.push({ tag: cur.tag, text: cur.lines.join('\n') });
    cur = null;
  }
  lines.forEach(function(rawLine){
    var line = rawLine.trim();
    if(!line){ flush(); return; }
    var bracketMatch = line.match(/^\[(.+)\]$/);
    if(bracketMatch){ flush(); tag = bracketMatch[1].trim(); return; }
    // 번호("1)" "2.") 뿐 아니라 "-"/"•" 같은 글머리 기호로 항목을 나열하는 원문도 있어서,
    // 둘 다 "새 항목 시작"으로 인정한다.
    var numMatch = line.match(/^(?:[0-9]+[.\)]|[-•])\s*(.*)$/);
    if(numMatch){
      flush();
      cur = { tag: tag, lines: [numMatch[1]] };
    } else {
      if(!cur) cur = { tag: tag, lines: [] };
      cur.lines.push(line);
    }
  });
  flush();
  // 엑셀/팀즈에서 복사하면 항목 본문과 그 아래 "→"(조건/부가설명 — "ㄴ"에서 변환됨) 줄 사이에
  // 빈 줄이 하나 끼는 경우가 있다. 위 로직은 빈 줄을 항목 구분자로도 보기 때문에, 이런 경우
  // "→ ..." 조건 줄만 있는 항목이 별도의 "혜택"으로 분리되어 버리고, 그 안의 문구 전체가
  // 조건으로 추출되고 나면 혜택 내용이 없는 빈 카드("혜택 미입력")가 생기는 오류로 이어진다.
  // 그래서 내용 전체가 "→"나 "*"로만 시작하는(=조건/부가설명뿐인) 항목은 새 혜택으로 두지 않고
  // 바로 앞 항목에 다시 이어붙인다.
  for(var i = items.length - 1; i >= 1; i--){
    if(/^(→|\*)/.test(items[i].text.trim())){
      items[i-1].text = items[i-1].text + '\n' + items[i].text;
      items.splice(i, 1);
    }
  }
  return items;
}
/* splitNumberedItems()는 "줄"을 기준으로만 번호를 인식한다. 그런데 실제 수급 원문(특히 엑셀에서
   복사)에는 "...증정  2) 구매 고객...  3) 라이브 중..." 처럼 줄바꿈 없이 같은 줄 안에 번호가
   공백만 사이에 두고 이어 붙는 경우가 있다. 이 경우 기존 로직은 번호를 줄 맨 앞에서만 찾기 때문에
   전부 혜택1 하나로 뭉쳐서 인식했다. 그래서 splitNumberedItems()에 넘기기 전에, 줄 중간에 나오는
   "공백+숫자)+공백" / "공백+숫자.+공백" 패턴 앞에 줄바꿈을 미리 끼워 넣어 각 번호가 항상 줄 맨 앞에
   오도록 정규화한다. (소수점 표기 "1.5%"와 헷갈리지 않도록, 숫자 뒤에 공백이 오는 경우만 번호로 인정) */
function normalizeInlineNumberedMarkers(text){
  return (text||'').replace(/([^\n])[ \t]+([0-9]{1,2})([.\)])[ \t]+/g, function(m, prevChar, num, punct){
    return prevChar + '\n' + num + punct + ' ';
  });
}
/* "ㄴ10월 11일까지 배송/설치 완료 시..."처럼 위 항목에 대한 부가 조건/설명을 "ㄴ"로 표시하는
   경우가 있다. 기존 "→" 조건 표시와 역할이 같으므로, 조건 추출 로직(mArrow)이 그대로 인식하도록
   줄 맨 앞의 "ㄴ"을 "→"로 바꿔둔다. */
function normalizeSubConditionMarkers(text){
  return (text||'').split('\n').map(function(line){
    return line.replace(/^(\s*)ㄴ\s*/, '$1→ ');
  }).join('\n');
}
/* 엑셀 셀 안에 줄바꿈이 들어있는 내용을 그대로 복사해 붙여넣으면, 엑셀이 그 셀 전체를 큰따옴표로
   감싸서 내보내는 경우가 있다 (예: `"4) 가죽소파 구매고객 전원\n캐럿 가죽 에센스&클리너 SET 증정"`).
   앞쪽 여는 따옴표가 번호 바로 앞에 붙으면 번호 인식이 깨지고, 뒤쪽 닫는 따옴표는 문구 끝에 그대로
   남는다. "티바트"처럼 한 줄 안에서 여닫는 큰따옴표가 쌍으로 있는 경우는 건드리지 않도록,
   줄 안에 따옴표가 "하나만" 있을 때만(=엑셀이 감싼 흔적일 때만) 제거한다. */
function stripExcelWrapQuotes(text){
  return (text||'').split('\n').map(function(line){
    var t = line.replace(/^(\s*)"(\d+[.\)])/, '$1$2');
    var quoteCount = (t.match(/"/g) || []).length;
    if(quoteCount === 1){
      t = t.replace(/^(\s*)"/, '$1').replace(/"(\s*)$/, '$1');
    }
    return t;
  }).join('\n');
}
/* "사은품 더블" 제품별 사은품 설명에 "(1개당 15만원 상당 / 총 30만원 상당)"처럼 단가와 합계를
   같이 적어주는 경우가 있는데, HSAD 페이지 구조 가이드(홈스타일 v1.4) 11번 슬라이드의 실제 렌더링
   결과를 보면 이 중 "1개당 ~ 상당 / " 부분은 화면에서 빼고 "(총 N만원 상당)"만 보여준다. 그리고
   "가죽쿠션 2개 증정(...)"처럼 괄호 바로 앞에 중복으로 붙는 "증정"도 화면에는 나가지 않는다.
   두 규칙 모두 실제 페이지 캡처로 확인된 내용이라 여기서 그대로 재현한다. */
function simplifyGiftBreakdownDetail(s){
  var out = (s||'').replace(/\(\s*1개당[^()]*?\/\s*([^()]+)\)/g, '($1)');
  out = out.replace(/증정\s*(?=\()/g, '');
  return out.trim();
}
/* 실제 라이브 상세페이지 캡처(에싸 방송)를 보면 "구매고객 전원 네이버페이 3만P 증정", "라이브 중
   구매 후 채팅으로 구매인증 시 GS25 모바일상품권 1만원권 증정"처럼 조건/대상을 밝히는 어구로
   끝나는 한 줄짜리 혜택 문장도, 실제 화면에서는 그 어구를 라벨(작은 회색 글씨)로 떼어내고 나머지를
   본문(굵은 글씨)으로 보여주는 2줄 카드로 나간다("구매 고객 전원 / 네이버페이 3만원", "채팅을 통해
   구매 인증 시 / GS25 모바일 상품권 1만원"으로 확인). 원문이 이미 줄바꿈으로 라벨/본문을 나눠서
   온 경우는 그 구조를 그대로 존중하고(엑셀 셀 안에 줄바꿈이 있는 경우), 한 줄로 붙어있을 때만
   아래 트리거 어구들을 기준으로 똑같이 나눠준다. 트리거 목록은 지금까지 확인된 것들이라, 새로운
   패턴이 확인되면 이 목록에 추가하면 된다. */
var BENEFIT_LABEL_SPLIT_RE = /^(.*?(?:구매\s*고객\s*전원|구매고객\s*전원|구매\s*인증\s*시|구매\s*시|인증\s*시|응모\s*후|가입\s*시|신청\s*시|이용\s*시|결제\s*시))\s+(\S.*)$/;
/* 위 라벨/본문 분리 시(실제 화면 캡처 2건에서 공통 확인), 본문 끝에 중복으로 붙는 "증정"은
   화면에 나가지 않는다 — "GS25 모바일상품권 1만원권 증정" → "GS25 모바일상품권 1만원권". */
function stripRedundantGift(text){
  return (text||'').replace(/증정\s*(?=\()/g, '').replace(/\s*증정\s*$/, '').trim();
}
function autoSplitBenefitLabelMain(text){
  if(!text || text.indexOf('\n') !== -1) return text; // 이미 줄바꿈으로 라벨/본문이 나뉜 경우는 그대로 존중
  var m = text.match(BENEFIT_LABEL_SPLIT_RE);
  if(!m) return text;
  var label = m[1].trim();
  var main = stripRedundantGift(m[2].trim());
  if(!label || !main) return text;
  return label + '\n' + main;
}
/* "X" / "없음" / "해당없음" / "N/A" 처럼 해당 항목이 없다는 표시만 있는 경우를 인식해서,
   그 자리에 빈 문자열을 억지로 항목화하지 않고 진짜 "없음"으로 처리한다. */
function isEmptyPlaceholder(text){
  var t = (text||'').trim();
  if(!t) return true;
  return /^(x|없음|해당\s*없음|해당\s*사항\s*없음|n\/?a|-|none)$/i.test(t);
}
function normalizeUrlForMatch(u){
  return (u||'').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}
function findObsBankMatch(bank, url, code){
  if(!bank || !bank.length) return null;
  if(code){
    var byCode = bank.filter(function(b){ return b.code && b.code.toUpperCase() === code.toUpperCase(); })[0];
    if(byCode) return byCode;
  }
  var normU = normalizeUrlForMatch(url);
  if(!normU) return null;
  return bank.filter(function(b){ return normalizeUrlForMatch(b.url) === normU; })[0] || null;
}
function parseRawToStructured(rawOriginal, obsBank){
  var empty = { notify: {gift:'', count:'', deadline:''}, liveItems: [], obsCards: [], paymentFullText: '', legalNotes: '' };
  if(!rawOriginal || !rawOriginal.trim()) return empty;
  var raw = stripExcelWrapQuotes(rawOriginal.replace(/\t/g, ' ').replace(/ {2,}/g, ' '));

  // 각 구간 헤더는 "줄 맨 앞"에 나올 때만 구간 시작으로 인정한다 — 그래야 라이브한정 항목
  // 문구 중간에 "LGE.COM 멤버십 포인트" 처럼 섞여 나오는 문구를 4)LGE닷컴 헤더로 오인해
  // 뒤쪽 항목들을 통째로 잘라먹는 일이 없다.
  // "[알림신청]" "[라이브]" "[OBS]"처럼 대괄호로만 표시하거나, "OBS" 대신 "기획전"이라는
  // 말만 쓰는 경우도 있어서 그 형태들도 함께 인식한다.
  var idx1 = findIdx(raw, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?알림\s*신청/m);
  var idx2 = findIdx(raw, /^[ \t]*(?:(?:[0-9]+[.\)]\s*)?라이브\s*한정|[\[［]\s*라이브\s*[\]］])/m);
  var idx3 = findIdx(raw, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?(?:OBS|기획전)/im);
  var idx4 = findIdx(raw, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?LGE\s*(?:닷컴|전자|\.COM)/im);
  var points = [idx1, idx2, idx3, idx4].filter(function(x){ return x >= 0; });
  function sliceFrom(start){
    if(start < 0) return '';
    var after = points.filter(function(x){ return x > start; });
    var end = after.length ? Math.min.apply(null, after) : raw.length;
    return raw.slice(start, end);
  }
  var s1 = sliceFrom(idx1), s2 = sliceFrom(idx2), s3 = sliceFrom(idx3), s4 = sliceFrom(idx4);

  // 알림신청: "(30명)"처럼 괄호가 있는 경우와 "30명" / "30명 추첨"처럼 괄호 없이 오는 경우가 섞여 있어 모두 인식
  var notify = {gift:'', count:'', deadline:''};
  var mCount = s1.match(/[\(（]?\s*([0-9,]+)\s*명\s*[\)）]?(?:\s*추첨)?/);
  if(mCount){
    // 사은품명 앞에 "-투썸플레이스 아메리카노"처럼 글머리 기호가 붙어 나오는 경우, 그 기호는 제거한다.
    // 뒤에는 "투썸플레이스 아메리카노 증정 (30명)"처럼 "증정"이 이미 붙어 나오는 경우도 있는데,
    // 워싱본에서는 항상 "증정"을 다시 붙여서 보여주기 때문에(mockHeroGift 등), 여기서 미리
    // 제거해두지 않으면 "...아메리카노 증정 증정"처럼 중복되어 나간다.
    notify.gift = s1.slice(0, mCount.index).replace(/^[^\n]*\n/, '').replace(/^[ \t]*[-•]\s*/, '').replace(/\s*증정\s*$/, '').trim();
    notify.count = mCount[1].trim() + '명';
  }

  // 라이브 한정 — 헤더 줄 제외한 나머지를, 빈 줄이 없어도 "1) 2) 3)" 번호가 나오는 줄마다
  // 강제로 끊어서 각각 별개의 혜택으로 분리한다 ("[TV]" 같은 대괄호 묶음은 tag로 붙여줌)
  var liveItems = [];
  var s2Body = s2.replace(/^[ \t]*(?:[\[［]\s*라이브\s*[\]］]|[^\n]*라이브\s*한정[^\n]*)\n?/, '');
  s2Body = normalizeInlineNumberedMarkers(normalizeSubConditionMarkers(s2Body));
  splitNumberedItems(s2Body).forEach(function(seg){
    var p = seg.text.replace(/^\s*(?:[0-9]+[.\)]|[-•])\s*/, '').trim();
    if(!p) return;
    var condition = '';
    var mArrow = p.match(/→\s*([^\n]+)/);
    if(mArrow){ condition = mArrow[1].trim(); p = p.replace(mArrow[0], '').trim(); }
    var mStar = p.match(/\*[^\n]+/);
    if(mStar){ condition = (condition ? condition + ' / ' : '') + mStar[0].replace(/^\*/,'').trim(); p = p.replace(mStar[0], '').trim(); }
    // "·"로 표시된 줄(1차 카테고리 %-breakdown, 구매 인증 혜택 대상 제품 안내 등 부가 문구)은
    // 라이브 혜택 카드에는 노출하지 않고 detailLines로 따로 보관한다 — 하단 라이브 혜택
    // 디스클레이머 문구(computeLiveDisclaimerLines)를 만들 때만 그대로 사용한다.
    var detailLines = [];
    p = p.split('\n').map(function(x){ return x.trim(); }).filter(Boolean).filter(function(line){
      var dm = line.match(/^·\s*(.*)$/);
      if(dm){ detailLines.push(dm[1].trim()); return false; }
      return true;
    }).join('\n');
    // 실제 라이브 페이지는 "제품 카테고리명(줄바꿈)00% 앱전용 할인 쿠폰"처럼 혜택을 2줄(라벨+본문)로
    // 보여준다. 예전에는 여기서 모든 줄바꿈을 공백으로 뭉개버려서(→ 한 줄로 합쳐짐), 워싱본의
    // mockBenefitLines()가 라벨/본문을 구분해서 보여줄 수 있는 구조인데도 실제로는 항상 한 줄로만
    // 보였다. 그래서 줄바꿈 자체는 유지하고, 각 줄의 앞뒤 공백만 정리한다. (위에서 이미 처리)
    condition = condition.replace(/\s*\n\s*/g, ' ').trim();
    // "사은품 더블"처럼 한 항목 안에서 "✔"/"※" 글머리로 제품(소파 등)별 사은품을 나열하는 경우,
    // 실제 라이브 페이지에서는 이 목록이 한 카드로 뭉쳐지지 않고 제품별로 각각 별개의 혜택 카드로
    // 나뉘어 나간다(수급 원문에 없는 사실은 아니고, 그냥 카드 분리 방식의 문제). 그래서 "첫 줄 =
    // 묶음 제목, 이후 줄이 전부 ✔/※ 글머리"인 패턴을 감지해서 카드를 제품 수만큼 쪼갠다.
    var pLines = p.split('\n');
    var bulletLines = pLines.slice(1);
    var isBulletBreakdown = bulletLines.length > 0 && bulletLines.every(function(l){ return /^[✔※]/.test(l); });
    if(isBulletBreakdown){
      var groupTitle = pLines[0];
      bulletLines.forEach(function(l){
        var stripped = l.replace(/^[✔※]️?\s*/, '');
        var bm = stripped.match(/^"?([^":]+?)"?\s*(?:소파)?\s*[:：]\s*(.+)$/);
        var itemBenefit = bm ? ('['+groupTitle+'] '+bm[1].trim()+' 소파 구매 시\n'+simplifyGiftBreakdownDetail(bm[2].trim())) : (groupTitle+'\n'+stripped);
        liveItems.push({ benefit: itemBenefit, condition: condition, tag: seg.tag || '', detailLines: detailLines });
      });
    } else {
      liveItems.push({ benefit: autoSplitBenefitLabelMain(p), condition: condition, tag: seg.tag || '', detailLines: detailLines });
    }
  });
  // GS25 모바일상품권류 혜택은 항상 라이브 혜택 목록의 맨 아래로 고정 노출한다. (그 외 항목들의
  // 상대 순서는 그대로 유지 — Array.sort는 최신 브라우저에서 안정 정렬을 보장한다.)
  liveItems.sort(function(a, b){
    var aLast = /GS25/i.test(a.benefit) ? 1 : 0;
    var bLast = /GS25/i.test(b.benefit) ? 1 : 0;
    return aLast - bLast;
  });

  // OBS — URL에서 이벤트코드를 추출해 링크 재구성에 쓰고, 원본 URL 자체도 그대로 보관 (비교표 노출용)
  // URL은 뒤에 붙는 ")" 를 포함하지 않도록 인식한다 — 그래야 "기획전명: [표시텍스트 | 카테고리 | LG전자](URL)"
  // 같은 마크다운 링크 형태를 붙여넣었을 때 URL 끝에 괄호가 섞여 들어가지 않는다.
  var URL_RE = /https?:\/\/[^\s\)]+/g;
  // "기획전명: [표시텍스트 | 카테고리 | LG전자](URL)" 한 줄짜리 마크다운 링크 형식을 그대로 인식한다.
  // 콜론 앞의 레이블을 기획전명으로 쓰고, 레이블이 없으면 대괄호 안 첫 "|" 앞부분을 대신 쓴다.
  var MD_LINK_LINE_RE = /^\s*(?:([^:\[\n]+?)\s*:\s*)?\[([^\]]*)\]\(\s*(https?:\/\/[^\s\)]+)\s*\)\s*$/;
  // "-더 넥스트 스크린: https://..." 처럼 대괄호 없이 "레이블: URL"만 한 줄에 붙여넣는 경우도 인식한다.
  var PLAIN_LABEL_URL_RE = /^\s*[-•]?\s*([^:\n]+?)\s*:\s*(https?:\/\/\S+)\s*$/;
  var obsCards = [];
  var urls = [];
  var inlineTitles = {};
  var categoryByUrl = {};
  // 엑셀에서 "세탁기 [탭] URL [탭]...[탭] LG 트롬 추석 국민 감사제"처럼 한 줄에 여러 칸(품목
  // 카테고리 / URL / (빈칸들) / 기획전명 or 비고)을 탭으로 나눠 그대로 붙여넣는 경우가 있다. 이건
  // 맨 위에서 탭을 전부 공백으로 뭉개버린 s3로는 칸을 구분할 수 없으므로, 탭을 보존한 원문에서
  // OBS 구간만 다시 잘라내 별도로 처리한다. (구간 헤더 자체가 데이터와 같은 줄에 탭으로 붙어
  // 있는 경우도 있어서, 헤더 문구는 먼저 지워둔다.)
  var rawTabPreserved = rawOriginal.replace(/\r\n?/g, '\n');
  var idx3Tab = findIdx(rawTabPreserved, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?(?:OBS|기획전)/im);
  var idx4Tab = findIdx(rawTabPreserved, /^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?LGE\s*(?:닷컴|전자|\.COM)/im);
  var s3Tab = idx3Tab >= 0 ? rawTabPreserved.slice(idx3Tab, (idx4Tab >= 0 && idx4Tab > idx3Tab) ? idx4Tab : rawTabPreserved.length) : '';
  s3Tab = s3Tab.replace(/^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?(?:OBS|기획전)[^\n\t]*/i, '');
  var CATEGORY_WORDS_RE = /^(세탁기|냉장고|김치냉장고|TV|에어컨|식기세척기|건조기|청소기|모니터|PC|노트북|스타일러|정수기|공기청정기|오븐|전자레인지|냉동고)$/i;
  var currentCategoryLabel = '';
  var inObsCategoryMode = false;
  s3Tab.split('\n').forEach(function(rawLineTab){
    if(!rawLineTab.trim()) return;
    if(rawLineTab.indexOf('\t') === -1){
      // 탭이 없는 일반 줄은 기존 방식(콜론 기반 "레이블: URL", 마크다운 링크, 단독 URL) 그대로 처리
      var rawLine = rawLineTab.replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
      var m = rawLine.match(MD_LINK_LINE_RE);
      if(m){
        var mdUrl = m[3];
        var label = (m[1]||'').trim() || (m[2]||'').split('|')[0].trim();
        urls.push(mdUrl);
        if(label) inlineTitles[mdUrl] = label;
        return;
      }
      var m2 = rawLine.match(PLAIN_LABEL_URL_RE);
      if(m2){
        var plainUrl = m2[2];
        urls.push(plainUrl);
        var label2 = m2[1].trim();
        if(label2) inlineTitles[plainUrl] = label2;
        return;
      }
      var found = rawLine.match(URL_RE);
      if(found) urls = urls.concat(found);
      return;
    }
    // 탭으로 칸이 나뉜 줄: [카테고리 or 기획전명] [탭] URL [탭]...(빈칸)...[탭] [기획전명 or 비고]
    var cols = rawLineTab.split('\t').map(function(c){ return c.trim(); }).filter(Boolean);
    var urlIdx = cols.findIndex(function(c){ return /^https?:\/\//.test(c); });
    if(urlIdx === -1) return;
    var tabUrl = cols[urlIdx];
    var before = cols.slice(0, urlIdx);
    var after = cols.slice(urlIdx+1);
    var beforeText = before.length ? before[before.length-1] : '';
    var afterText = after.length ? after[after.length-1].replace(/^[\[［](.+)[\]］]$/, '$1').trim() : '';
    // URL 앞 칸이 "세탁기"/"냉장고"처럼 짧은 품목 카테고리명이면 그건 기획전명이 아니라 묶음
    // 라벨이므로, 실제 기획전명은 URL 뒤 칸(afterText)에서 가져온다. 반대로 URL 앞 칸이 그 자체로
    // "~기획전"/"~론칭"처럼 이미 완결된 기획전명이면(이 경우 URL 뒤 칸은 보통 내부 공유용 비고라서
    // 고객 노출용이 아님) 앞 칸을 기획전명으로 쓴다.
    // beforeText가 있는 줄에서만 "카테고리 모드"인지 다시 판단하고, beforeText가 빈 줄(엑셀에서
    // 병합된 셀이라 위 칸 라벨이 이어지는 경우)은 직전 줄의 카테고리 모드를 그대로 이어받는다.
    if(beforeText){
      inObsCategoryMode = CATEGORY_WORDS_RE.test(beforeText) || (beforeText.length <= 6 && !/기획전|론칭|특가|이벤트|보상|페스타|모음|출시/.test(beforeText));
      if(inObsCategoryMode) currentCategoryLabel = beforeText;
    }
    var title = '';
    if(inObsCategoryMode){ title = afterText || currentCategoryLabel; }
    else if(beforeText){ title = beforeText; }
    else { title = afterText; }
    urls.push(tabUrl);
    if(title) inlineTitles[tabUrl] = title;
    if(inObsCategoryMode && currentCategoryLabel) categoryByUrl[tabUrl] = currentCategoryLabel;
  });
  var s3NoUrl = s3.replace(URL_RE, '').replace(/^[^\n]*(?:OBS|기획전)[^\n]*\n?/i, '');
  // "[OBS]\nX" 처럼 URL도 없이 "없음" 표시만 있는 경우, 그 "X"를 기획전명으로 잘못 인식하지
  // 않도록 — 남은 본문 전체가 "없음" 표시뿐이면 OBS 카드를 아예 만들지 않는다.
  if(!urls.length && isEmptyPlaceholder(s3NoUrl)){
    // obsCards 그대로 빈 배열 유지
  } else {
    var titleParas = splitParagraphs(s3NoUrl).filter(function(p){
      return p.length < 60 && !/수급받은|기획전\s*작성|배너\s*작성/.test(p) && !/\[.*\]\(\s*$/.test(p) && !/^[^:\n]*:\s*\[/.test(p) && !isEmptyPlaceholder(p);
    });
    var maxLen = Math.max(urls.length, titleParas.length) || 0;
    var titleIdx = 0;
    for(var i=0;i<maxLen;i++){
      var url = urls[i] || '';
      var code = extractEventCode(url);
      var mainTitle = '', subTitle = '';
      // 공통 배너 카피(등록된 URL별 고정 카피)가 있으면 최우선으로 사용한다 — 방송마다 카피를
      // 다시 옮겨적지 않아도 되도록, 원문의 URL이 등록된 URL과 일치하면 그 카피를 그대로 쓴다.
      var bankMatch = findObsBankMatch(obsBank, url, code);
      var titleIsConfirmed = false;
      if(bankMatch){
        mainTitle = bankMatch.copy1 || '';
        subTitle = bankMatch.copy2 || '';
        titleIsConfirmed = true; // 사용자가 "OBS 공통 배너 카피 관리"에 직접 등록해둔 실제 노출 문구
      } else if(inlineTitles[url]){
        mainTitle = inlineTitles[url];
      } else {
        var tp = titleParas[titleIdx] || '';
        titleIdx++;
        var tLines = tp.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
        mainTitle = tLines[0] || '';
        subTitle = tLines[1] || '';
      }
      // 세탁기/냉장고처럼 품목별로 묶어 붙여넣은 경우, 어느 품목의 기획전인지 헷갈리지 않도록
      // 카테고리 라벨을 제목 앞에 "[세탁기]"처럼 붙여준다. 단, 실제 화면 캡처(냉세/PC 기획서)를
      // 보면 실제 노출되는 카드 제목에는 이런 카테고리 접두어가 전혀 없었다. 그래서 "OBS 공통
      // 배너 카피 관리"에 등록해서 실제 문구임이 확인된 제목에는 접두어를 붙이지 않고, 원문에서
      // 그대로 가져온(아직 검수 전인) 제목에만 구분용으로 붙여둔다.
      if(!titleIsConfirmed && categoryByUrl[url] && mainTitle.indexOf('['+categoryByUrl[url]+']') !== 0){
        mainTitle = '['+categoryByUrl[url]+'] ' + mainTitle;
      }
      obsCards.push([code, mainTitle, subTitle, url]);
    }
  }

  // 결제혜택/유의사항 원문 (요약 없이 원문 그대로 사용) — 비교표 "OBS 혜택" 행 등에서 그대로 노출(원문 그대로 노출 결정 유지)
  // 이제 워싱본에 "LGE.COM 결제혜택"이라는 제목을 따로 달아서 보여주므로, 원문 첫 줄의 구간
  // 헤더("4. LGE닷컴 전사 판촉" 등)까지 그대로 다시 보여주면 제목과 겹쳐 중복돼 보인다. 헤더
  // 줄만 제거하고 나머지 내용은 그대로 살린다. 원문 "4. LGE닷컴 전사 판촉" 섹션 뒤에 바로
  // "[유의사항]" 헤더가 이어붙는 경우(실무에서 흔함)도 있는데, 예전에는 여기서 자르지 않아서
  // 유의사항 내용까지 결제혜택 카드로 잘못 쪼개져 들어가는 버그가 있었다. 그래서 "[유의사항]"이
  // 나오는 지점에서 결제혜택 원문을 끊는다(그 뒤 내용은 legalNotes가 별도로 담당).
  var paymentFullText = s4.replace(/^[ \t]*[\[［]?\s*(?:[0-9]+[.\)]\s*)?LGE\s*(?:닷컴|전자|\.COM)[^\n]*\n?/i, '');
  paymentFullText = paymentFullText.replace(/\[유의사항\][\s\S]*$/, '').trim();

  // 4) 워싱본 유의사항 박스에는 "진짜 원문 유의사항"만 보여줘야 한다. 원문 안에도 "[유의사항]" 헤더가
  // 오는 표준 형식이 많은데, 예전에는 사내공유용 전체 텍스트를 문자열로 만든 뒤 "[유의사항]" 기준으로
  // split해서 잘라 쓰다 보니, 원문 안의 "[유의사항]" 헤더 때문에 실제 1/2/3번 조항과 마지막 안내문이
  // 통째로 잘려나가는 버그가 있었다. 그래서 파싱 단계에서 원문의 "[유의사항]" 이후 텍스트를 미리
  // 별도 필드로 분리해 둔다 (원문에 해당 헤더가 없으면 빈 값 — 이 경우 화면에서는 paymentFullText 전체로 대체됨).
  var legalMatch = s4.match(/\[유의사항\]([\s\S]*)$/);
  var legalNotes = legalMatch ? legalMatch[1].trim() : '';

  return { notify: notify, liveItems: liveItems, obsCards: obsCards, paymentFullText: paymentFullText, legalNotes: legalNotes };
}

/* ================= 폼 <-> 데이터 (① 원본 텍스트만 입력받고, 나머지는 자동 파싱) ================= */
/* 마감일시는 별도 입력칸이 없으므로, "방송명"에 들어있는 날짜(예: "8/21 세탁기")를 그대로 읾어
   "오후 3시" 고정값을 붙여 계산한다. 방송명에 날짜가 없으면 빈 값으로 둔다. */
function parseDateFromCaseName(name){
  if(!name) return null;
  var m = name.match(/([0-9]{1,2})\s*[\/\.\-]\s*([0-9]{1,2})(?!\s*[0-9])/);
  if(m) return { month: Number(m[1]), day: Number(m[2]) };
  m = name.match(/([0-9]{1,2})\s*월\s*([0-9]{1,2})\s*일/);
  if(m) return { month: Number(m[1]), day: Number(m[2]) };
  return null;
}
function computeDeadlineFromCaseName(name){
  var d = parseDateFromCaseName(name);
  if(!d) return '';
  return d.month + '월 ' + d.day + '일 오후 3시까지';
}
function computeChanges(prev, cur){
  var changes = [];
  changes = changes.concat(diffFields(prev?prev.notify:null, cur.notify, {gift:'알림신청 사은품', count:'알림신청 인원'}));
  var liveRows = cur.liveItems.map(function(it){ return [it.benefit, it.condition]; });
  changes = changes.concat(diffRowsGeneric(prev ? (prev.liveItems||[]).map(function(it){return [it.benefit,it.condition];}) : [], liveRows, '라이브한정 판촉'));
  changes = changes.concat(diffRowsGeneric(prev?prev.obsCards:[], cur.obsCards, 'OBS카드'));
  if(prev && prev.paymentFullText !== cur.paymentFullText) changes.push('결제혜택/유의사항 원문 변경');
  return changes;
}

/* ================= 판촉워싱 텍스트 (사내 공유·복사용 원문 텍스트) ================= */
function computeLiveDisclaimerLines(pv){
  // 실제 라이브 페이지 문구 기준으로 케이스별 안내 문구를 다르게 붙인다.
  //  [기본] (쿠폰이 있을 때): 중복사용 불가 안내 2줄 + 유의사항 참고 안내
  //  [쿠폰이 없을 때]: 유의사항 참고 안내 1줄만
  //  [1차 카테고리(주방가전/생활가전 등)로 앱전용 할인쿠폰이 명시될 때]: 원문에서 해당 혜택 줄
  //   바로 아래에 "·"로 표시한 %-breakdown/구매인증 대상제품 등 부가 문구(detailLines)를 그대로
  //   살려서 "혜택명 → %-breakdown → 중복사용 불가 안내 → (·로 표시된 나머지 부가 문구) → 유의사항
  //   참고 안내" 순서로 조립한다. "·" 줄은 라이브 혜택 카드에는 노출하지 않는다(parseRawToStructured
  //   에서 이미 분리해 둠).
  var liveBenefits = (pv.liveItems||[]).map(function(it){ return it.benefit||''; }).filter(Boolean);
  if(!liveBenefits.length) return ['혜택 지급 관련 상세내용은 하단 유의사항 참고'];
  var catItem = (pv.liveItems||[]).filter(function(it){ return (it.detailLines||[]).length; })[0];
  var hasCoupon = liveBenefits.some(function(b){ return /쿠폰/.test(b); });
  var lines = [];
  if(catItem){
    lines.push(catItem.benefit.split('\n')[0]);
    var pctLines = catItem.detailLines.filter(function(l){ return /%\s*[:：]/.test(l); });
    var etcLines = catItem.detailLines.filter(function(l){ return !/%\s*[:：]/.test(l); });
    lines = lines.concat(pctLines);
    lines.push('앱전용 할인 쿠폰은 타 쿠폰과 중복 사용 불가');
    lines.push('(쿠폰별로 중복 사용 가능 여부가 다를 수 있습니다.)');
    lines = lines.concat(etcLines);
    lines.push('혜택 지급 관련 상세내용은 하단 유의사항 참고');
    return lines;
  }
  if(hasCoupon){
    lines.push('앱전용 할인 쿠폰은 타 쿠폰과 중복 사용 불가');
    lines.push('(쿠폰별로 중복 사용 가능 여부가 다를 수 있습니다.)');
  }
  lines.push('혜택 지급 관련 상세내용은 하단 유의사항 참고');
  return lines;
}
// "(쿠폰별로 …)"처럼 괄호로 시작하는 줄은 앞 불릿의 연속 줄(실제 화면: 한 불릿 안에서 줄바꿈)로 묶는다.
function groupCaptionLines(lines){
  var out = [];
  (lines||[]).forEach(function(l){
    if(/^[\(（]/.test(l) && out.length) out[out.length-1].push(l); else out.push([l]);
  });
  return out;
}
function computeCondLines(pv){
  return (pv.liveItems||[]).filter(function(it){ return it.condition; }).map(function(it, i){
    return (i+1) + '. ' + (it.benefit ? it.benefit.split('\n')[0] + ' 관련 지급조건: ' : '지급조건: ') + it.condition;
  });
}
function buildPromoPreviewText(pv){
  var lines = [];
  lines.push('알림 신청 판촉 = 방송 알림 신청 이벤트');
  var l1 = [];
  if(pv.notify.deadline) l1.push(pv.notify.deadline + ' 알림 신청 시');
  if(pv.notify.gift) l1.push(applyGiftTrademark(pv.notify.gift) + ' 증정');
  if(pv.notify.count) l1.push('추첨 ' + pv.notify.count);
  lines.push(l1.join(' \n'));
  lines.push('');
  lines.push('[알림신청 디스클레이머 영역 / 고정]');
  lines.push('알림 신청 시 추첨 대상에 자동 응모되며, 회원 정보에 등록된 휴대폰 번호로 방송 알림을 위한 문자가 발송됩니다');
  lines.push('');
  lines.push('라이브 한정 판촉 = 라이브에서 준비한 한정 혜택');
  lines.push('');
  (pv.liveItems||[]).forEach(function(it){
    if(it.benefit) lines.push(it.benefit);
    lines.push('');
  });
  lines.push('[라이브 한정판촉 디스클레이머영역 / 고정이나 텍스트 내용은 변동있음]');
  var disclaimerLines = computeLiveDisclaimerLines(pv);
  if(disclaimerLines.length){ lines = lines.concat(disclaimerLines); }
  lines.push('');
  lines.push('OBS 기획전/기본 판촉');
  lines.push('');
  (pv.obsCards||[]).forEach(function(r){
    if(r[1]) lines.push(r[1]);
    if(r[2]) lines.push(r[2]);
    lines.push('');
  });
  lines.push('LGE닷컴 전사 판촉 + 판촉 지급 내용 = 결제혜택 및 유의사항');
  lines.push('');
  lines.push('[유의사항]');
  var condLines = computeCondLines(pv);
  if(condLines.length){ lines = lines.concat(condLines); lines.push(''); }
  lines.push(pv.paymentFullText || '-');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/* ================= 4) 라이브 판촉 워싱본 — 실제 페이지처럼 보이는 클린한 시각 카드 ================= */
function mockBenefitLines(benefit){
  if(!benefit || !benefit.trim()) return '<span class="mockEmpty">(혜택 미입력)</span>';
  var lines = benefit.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
  if(lines.length <= 1) return '<div class="mockBenefitMain">'+escapeHtml(lines[0]||'')+'</div>';
  // 라벨/본문 2줄로 나가는 카드는 실제 화면 캡처(에싸 방송)에서 본문 끝의 중복 "증정"이 항상
  // 빠져 있는 것을 여러 건 확인했다("캐럿 가죽 에센스&클리너 SET 증정" → "...SET", "GS25
  // 모바일상품권 1만원권 증정" → "...1만원권"). 그래서 라벨이 있는 경우에 한해 본문에서 증정을 뗀다
  // (라벨 없이 한 줄로만 나가는 카드는 아직 확인된 사례가 없어 그대로 둔다).
  var mainText = stripRedundantGift(lines.slice(1).join(' · '));
  return '<div class="mockBenefitLabel">'+escapeHtml(lines[0])+'</div><div class="mockBenefitMain">'+escapeHtml(mainText)+'</div>';
}
/* v13 버그 수정: 예전에는 buildPromoPreviewText(pv)를 "[유의사항]" 문자열로 split해서 [1]번 조각을
   유의사항 박스에 썼는데, 원문 안에도 "[유의사항]" 헤더가 있으면(표준 형식) 문자열 전체에 그 표시가
   두 번 등장해 실제 1/2/3번 조항과 마지막 안내문(※)이 통째로 잘려나갔다. 이제는 파싱 단계에서 미리
   분리해둔 pv.legalNotes(원문의 진짜 유의사항)를 그대로 이어붙여 데이터 손실이 없게 한다. */
// 실제 라이브 상세페이지 캡처 화면을 보면 유의사항 박스는 번호(1. 2. 3.)가 아니라 "·" 불릿 목록으로
// 나간다. 그래서 각 문장 앞의 "N. " 번호는 떼고 "·" 불릿으로 다시 감싼다(번호 자체는 내부 공유용
// 텍스트(buildPromoPreviewText)에서는 그대로 유용하니 computeCondLines()는 건드리지 않는다).
function legalBulletHtml(text){
  var body = (text||'').replace(/^[0-9]+\.\s*/, '');
  var sub = body.split('\n');
  var html = '<div class="legalBullet">· '+escapeHtml(sub[0])+'</div>';
  for(var i=1;i<sub.length;i++){
    html += '<div class="legalBullet" style="padding-left:1.4em;">'+escapeHtml(sub[i])+'</div>';
  }
  return html;
}
function buildMockLegalHtml(pv){
  var html = '';
  var condLines = computeCondLines(pv);
  var baseHtml = '', baseCount = 0;
  condLines.forEach(function(l){ baseHtml += legalBulletHtml(l); baseCount++; });
  if(pv.legalNotes){
    // 원문에 "[유의사항]" 섹션을 직접 써준 경우에는 그 문구를 그대로 존중해서 쓴다(표준 문구를
    // 덧붙이지 않음 — 이미 원문 작성자가 필요한 내용을 판단해서 넣은 것으로 보기 때문).
    pv.legalNotes.split('\n').map(function(l){ return l.trim(); }).filter(Boolean).forEach(function(l){
      baseHtml += legalBulletHtml(l); baseCount++;
    });
  } else {
    // 원문에 별도 "[유의사항]" 섹션이 없는 경우(실제로 가장 흔한 케이스) — 결제/사은품 관련 표준
    // 유의사항 문구를 "기본값"으로 항상 채운다(혜택·OBS·결제혜택이 비어 있어도 실제 페이지에는 이
    // 기본 안내가 들어가므로).
    STANDARD_LEGAL_BOILERPLATE.forEach(function(l){ baseHtml += legalBulletHtml(l); baseCount++; });
  }
  html += '<div class="accHead reviewOnly" onclick="toggleAcc(this,\'base\')"><span>기본 안내 ('+baseCount+'항목)</span><span class="accArrow">'+(_accOpen.base !== false ? '▾ 접기' : '▸ 펼치기')+'</span></div>'+
    '<div class="accBody'+(_accOpen.base !== false ? ' open' : '')+'">'+baseHtml+'</div>';

  // 결제혜택 히어로/아이콘 행의 "자세히 보기"에 해당하는 카드·결제수단별 세부 유의사항. 원문에
  // 등장한 카드/결제수단에 맞는 섹션만, 기획서에 나온 고정 순서(1~6) 그대로 골라서 붙인다.
  var payTexts = pv.paymentFullText ? paymentAllTextsFrom(pv.paymentFullText) : [];
  var kakaoText = payTexts.filter(function(t){ return /카카오페이/.test(t); })[0] || '';
  var periodM = kakaoText.match(/기간\s*[:：]?\s*([0-9][0-9./~\s시]*)/);
  var matchedSections = PAYMENT_NOTICE_SECTIONS.filter(function(sec){ return sec.trigger(payTexts); });
  if(matchedSections.length){
    html += '<div class="legalHeading" style="margin-top:14px;">LGE.COM 구매혜택 관련 안내</div>';
    matchedSections.forEach(function(sec, idx){
      var sid = 'sub'+idx+':'+sec.heading, open = !!_accOpen[sid];
      html += '<div class="accSub" onclick="toggleAcc(this,\''+sid.replace(/'/g,"\\'")+'\')"><span class="legalHeading">'+(idx+1)+') '+escapeHtml(sec.heading)+'</span><span class="accPlus">'+(open ? '－' : '＋')+'</span></div>'+
        '<div class="accSubBody'+(open ? ' open' : '')+'">';
      sec.bullets.forEach(function(l){
        // 카카오페이 섹션의 "프로모션 기간" 자리는 이번 방송 원문에서 실제로 찾은 기간으로 채우고,
        // 못 찾으면 날짜 없이 "중"으로만 이어서 옛날 날짜를 잘못 보여주지 않게 한다.
        if(l.indexOf('{{PERIOD}}') !== -1){
          var periodStr = (periodM && periodM[1].trim()) ? ' ('+periodM[1].trim()+')' : '';
          l = l.replace('{{PERIOD}}', periodStr);
        }
        html += legalBulletHtml(l);
      });
      html += '</div>';
    });
  }
  return html;
}
/* ================= v20: 아이콘 영역(한정 혜택 / OBS 배너 / 알림 이벤트) =================
   Figma 레이어 기준: 한정혜택_IMG(쿠폰·상품권 티켓 그래픽), Banner_IMG(82x88 제품 이미지 영역),
   알림_IMG(68x68). 실제 제품 사진/배너 이미지는 이 도구에 없으므로, 혜택 종류와 제목 키워드로
   알맞은 아이콘(티켓/제품 라인아이콘)을 자리에 그려 넣는다. 실제 이미지는 셋팅 시 교체한다. */
function _svg(w, h, inner){
  return '<svg class="mockIconSvg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+inner+'</svg>';
}
function _amountFrom(text){
  var m = (text||'').match(/(\d+(?:\.\d+)?\s*%|[\d,]+\s*만\s*원|[\d,]+\s*만\s*P|[\d,]+\s*원|[\d,]+\s*P\b)/i);
  return m ? m[1].replace(/\s+/g,'') : '';
}
function ticketIconSvg(red, label, amount){
  // 실제 구현 화면(캡처) 기준: 52x31 티켓, 좌상단 로고 → 라벨 → 큰 금액, 점선 구분 + 다운로드 화살표, 오른쪽 노치
  var fill = red ? '#FD312E' : '#111111';
  var aSize = amount.length > 4 ? 7.6 : 10;
  var inner =
    '<rect x="7" y="18" width="52" height="31" rx="2" fill="'+fill+'"/>'+
    '<circle cx="59" cy="33.5" r="2.6" fill="#F4F4F4"/>'+
    '<rect x="10.5" y="21" width="5" height="5" rx="1.2" fill="#fff"/><path d="M12 22.6l2 2M14 22.6l-2 2" stroke="'+fill+'" stroke-width=".8" stroke-linecap="round"/>'+
    '<line x1="45" y1="21" x2="45" y2="46" stroke="#fff" stroke-opacity=".4" stroke-width=".6" stroke-dasharray="1.2 1.2"/>'+
    '<text x="10.5" y="31.2" font-size="3.6" font-weight="600" fill="#fff" textLength="'+Math.min(31, label.length*3.5)+'" lengthAdjust="spacingAndGlyphs">'+escapeHtml(label)+'</text>'+
    (amount ? '<text x="10.5" y="43" font-size="'+aSize+'" font-weight="800" fill="#fff" textLength="'+Math.min(31, amount.length*aSize*0.62)+'" lengthAdjust="spacingAndGlyphs">'+escapeHtml(amount)+'</text>' : '')+
    '<path d="M52 29v7M49.4 33.4l2.6 2.6 2.6-2.6M49.2 39.4h5.6" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/>';
  return _svg(66, 66, inner);
}
function giftIconSvg(size){
  var inner =
    '<rect x="11" y="26" width="38" height="26" rx="2.5" fill="#FD312E"/>'+
    '<rect x="8" y="19" width="44" height="9" rx="2.5" fill="#e02623"/>'+
    '<rect x="28" y="19" width="4" height="33" fill="#fff" fill-opacity=".85"/>'+
    '<path d="M30 19c-6-9-14-4-9 0 3 2 9 0 9 0zM30 19c6-9 14-4 9 0-3 2-9 0-9 0z" fill="none" stroke="#e02623" stroke-width="2.2" stroke-linejoin="round"/>';
  return _svg(size||60, size||60, '<g transform="scale('+((size||60)/60)+')">'+inner+'</g>').replace('viewBox="0 0 '+(size||60)+' '+(size||60)+'"','viewBox="0 0 '+(size||60)+' '+(size||60)+'"');
}
function benefitIconHtml(benefit){
  var t = (benefit||'').replace(/\n/g,' ');
  if(/상품권|GS25|기프티콘|스타벅스|투썸|커피\s*쿠폰/.test(t)){
    var coffee = /스타벅스|투썸|커피/.test(t);
    return ticketIconSvg(false, coffee ? '모바일 쿠폰' : '모바일 상품권', _amountFrom(t));
  }
  if(/네이버\s*페이|포인트|[0-9]\s*P\b/.test(t)){
    return ticketIconSvg(false, /네이버/.test(t) ? '네이버페이' : '포인트', _amountFrom(t));
  }
  if(/쿠폰/.test(t)){
    return ticketIconSvg(true, /앱전용/.test(t) ? '앱전용 할인 쿠폰' : '할인 쿠폰', _amountFrom(t));
  }
  return giftIconSvg(48);
}
var _OBS_ICON_PATHS = {
  fridge:'<rect x="15" y="5" width="30" height="50" rx="3"/><path d="M15 26h30M39 12v8M39 31v10"/>',
  washer:'<rect x="9" y="6" width="42" height="48" rx="4"/><circle cx="30" cy="34" r="14"/><circle cx="30" cy="34" r="7"/><circle cx="17" cy="14" r="2"/><path d="M25 14h20"/>',
  tv:'<rect x="5" y="10" width="50" height="32" rx="2"/><path d="M22 52h16M30 42v10"/>',
  dish:'<rect x="9" y="6" width="42" height="48" rx="3"/><path d="M9 17h42"/><circle cx="17" cy="11.5" r="1.5"/><rect x="16" y="25" width="28" height="22" rx="2"/><path d="M16 33h28M16 40h28"/>',
  induction:'<rect x="5" y="18" width="50" height="26" rx="3"/><circle cx="20" cy="31" r="7"/><circle cx="40" cy="31" r="7"/>',
  aircon:'<rect x="5" y="12" width="50" height="20" rx="5"/><path d="M12 25h36M14 41q4 4 8 0t8 0t8 0M14 49q4 4 8 0t8 0t8 0"/>',
  vacuum:'<circle cx="22" cy="42" r="11"/><circle cx="22" cy="42" r="4"/><path d="M29 34L44 8h8M44 8l-2 6"/>',
  sofa:'<rect x="11" y="22" width="38" height="20" rx="4"/><rect x="5" y="28" width="11" height="18" rx="4"/><rect x="44" y="28" width="11" height="18" rx="4"/><path d="M14 46v6M46 46v6"/>',
  laptop:'<rect x="12" y="12" width="36" height="25" rx="2"/><path d="M5 43h50l-3 7H8z"/>',
  water:'<path d="M30 6C30 6 15 25 15 36a15 15 0 0 0 30 0C45 25 30 6 30 6z"/><path d="M22 38a8 8 0 0 0 8 8"/>',
  coffee:'<path d="M12 24h28v14a14 14 0 0 1-14 14h0a14 14 0 0 1-14-14z"/><path d="M40 28h4a6 6 0 0 1 0 12h-4M12 56h32M20 8q-3 4 0 8M28 6q-3 4 0 8"/>',
  tag:'<path d="M8 8h22l22 22-22 22L8 30z"/><circle cx="19" cy="19" r="3"/>'
};
function _lineIcon(key, size){
  var inner = _OBS_ICON_PATHS[key] || _OBS_ICON_PATHS.tag;
  return _svg(size, size, '<g transform="scale('+(size/60)+')" fill="rgba(255,255,255,.7)" stroke="rgba(0,0,0,.45)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+inner+'</g>');
}
function obsIconHtml(text){
  var t = text || '';
  var key = 'tag';
  if(/냉장고|김치|김냉|신선/.test(t)) key = 'fridge';
  else if(/세탁|워시|트롬|건조|스타일러/.test(t)) key = 'washer';
  else if(/식기\s*세척/.test(t)) key = 'dish';
  else if(/TV|티비|올레드|OLED|QNED|스탠바이미|스크린|사운드|오디오/i.test(t)) key = 'tv';
  else if(/인덕션|전기레인지|오븐|쿠킹|주방|광파|레인지/.test(t)) key = 'induction';
  else if(/에어컨|냉방|휘센|공기청정|에어로/.test(t)) key = 'aircon';
  else if(/청소기|코드제로|물걸레/.test(t)) key = 'vacuum';
  else if(/소파|가구|에싸|홈스타일|침대|리빙/.test(t)) key = 'sofa';
  else if(/PC|노트북|그램|모니터|\bIT\b/i.test(t)) key = 'laptop';
  else if(/정수기|퓨리케어/.test(t)) key = 'water';
  return _lineIcon(key, 60);
}
function notifyIconHtml(gift){
  var t = gift || '';
  if(/커피|아메리카노|스타벅스|투썸|카페/.test(t)) return _lineIcon('coffee', 46);
  if(/상품권|쿠폰|기프티콘/.test(t)) return ticketIconSvg(false, '모바일 상품권', _amountFrom(t));
  return giftIconSvg(46);
}

var _accOpen = { base: true };
function _accId(k){ return k; }
function renderMockPage(pv){
  // 레이아웃 수치는 Figma "Landing_mo"(390px) 레이어 기준: mo_03(알림) · mo_04(한정 혜택) ·
  // mo_05~12(OBS 배너) · mo_13(결제혜택) · mo_14(유의사항). CSS 쪽 주석 참고.
  var html = '<div class="mockPage">';

  // mo_03 — 방송 알림 신청 이벤트
  html += '<div class="mockSec mockSec03" id="secNotify"><div class="mockEventCard dimmable" data-key="notify">'+
    '<div class="mockTitle">방송 알림 신청 이벤트</div>'+
    '<div class="mockEventContent">'+
      '<div class="mockHero"><div class="mockImg sv">'+notifyIconHtml(pv.notify.gift)+'</div><div class="mockHeroText">'+
        '<div>'+escapeHtml(pv.notify.deadline||'(마감일시 미입력)')+' 알림 신청 시</div>'+
        '<div class="mockHeroGift">'+escapeHtml(applyGiftTrademark(pv.notify.gift)||'(사은품 미입력)')+' 증정</div>'+
        '<div>추첨 '+escapeHtml(pv.notify.count||'-')+'</div>'+
      '</div></div>'+
      '<div class="mockCaptionList"><div class="mockCaption mockDisclaimer">알림 신청 시 추첨 대상에 자동 응모되며, 회원 정보에 등록된 휴대폰 번호로 방송 알림을 위한 문자가 발송됩니다</div></div>'+
    '</div></div></div>';

  // mo_04 — 라이브에서 준비한 한정 혜택 (유의사항 관련 기본 안내 문구는 혜택이 없어도 항상 포함)
  html += '<div class="mockSec mockSec04" id="secLive"><div class="mockTitle">라이브에서 준비한 한정 혜택</div>';
  html += '<div class="mockBenefitList">';
  if(pv.liveItems && pv.liveItems.length){
    pv.liveItems.forEach(function(it, i){
      html += '<div class="mockBenefitRow dimmable" data-key="live:'+i+'"><div class="mockImg small sv">'+benefitIconHtml(it.benefit)+'</div><div>'+mockBenefitLines(it.benefit)+'</div></div>';
    });
  } else {
    html += '<div class="mockEmpty">등록된 판촉이 없습니다.</div>';
  }
  html += '</div>';
  var disclaimerLines = computeLiveDisclaimerLines(pv);
  if(disclaimerLines.length){
    html += '<div class="mockCaptionList">'+groupCaptionLines(disclaimerLines).map(function(g){ return '<div class="mockCaption mockDisclaimer"><span>'+g.map(escapeHtml).join('<br>')+'</span></div>'; }).join('')+'</div>';
  }
  html += '</div>';

  // mo_05~12 — OBS 랜딩링크 배너 (Figma에는 이 구간에 별도 제목이 없어 작은 검수용 라벨만 둔다)
  html += '<div id="secObs"><div class="mockSecLabel reviewOnly">OBS 랜딩링크 (검수용 라벨 · 실제 화면에는 제목 없이 배너만 노출)</div>';
  html += '<div class="mockLinkList">';
  if(pv.obsCards && pv.obsCards.length){
    pv.obsCards.forEach(function(r, i){
      var code = r[0], main = r[1], sub = r[2];
      // PE코드가 있으면 표준 URL로 재구성하되, "homestyle.lge.co.kr" 같이 PE코드가 없는 다른
      // 형식의 원본 링크가 온 경우에는 죽은 '#' 링크 대신 원본 URL을 그대로 써서 클릭 가능하게 한다.
      var href = code ? (getObsBaseUrl()+code) : (r[3] || '#');
      html += '<div class="mockLinkWrap dimmable" data-key="obs:'+i+'"><a class="mockLinkRow" href="'+href+'" target="_blank">'+
        '<div class="mockLinkImg">'+obsIconHtml((main||'')+' '+(sub||'')+' '+(r[3]||''))+'</div>'+
        '<div class="mockLinkText"><div class="mockLinkMain">'+escapeHtml(main||'(메인타이틀 미입력)')+(main?'':'<span class="missChip reviewOnly">타이틀 미입력</span>')+'</div>'+
        (sub?'<div class="mockLinkSub">'+escapeHtml(sub)+'</div>':'')+
        '</div><div class="mockChevron">›</div></a>'+
        // 실제 셋팅 시 URL을 바로 드래그해서 복붙하거나 링크가 맞는지 확인해야 하는 경우가 많아서,
        // 배너 아래에 원본 URL을 그대로 눈에 보이게 노출한다(검수용).
        '<div class="mockLinkUrl reviewOnly">'+escapeHtml(r[3]||'(URL 없음)')+'</div></div>';
    });
  } else {
    html += '<div class="mockEmpty" style="padding:0 20px 12px;">등록된 OBS 카드가 없습니다.</div>';
  }
  html += '</div></div>';

  // mo_13 — LGE.COM 결제혜택 (OBS 랜딩링크와 유의사항 사이)
  if(pv.paymentFullText){
    html += renderPaymentBenefitBox(pv.paymentFullText);
  } else {
    html += '<div class="mockSec mockSec13" id="secPay"><div class="mockPayDark dimmable" data-key="pay"><div class="mockPayDarkTitle">LGE.COM 결제 혜택</div><div class="mockEmpty" style="color:#9ca3af;text-align:center;">원문에서 결제혜택(LGE닷컴 전사 판촉)을 찾지 못했습니다.</div></div></div>';
  }

  // mo_14 — 유의사항
  html += '<div class="mockSec mockSec14" id="secLegal">'+
    '<div class="mockLegalCta">유의사항 확인하기 <span style="font-size:14px;">›</span></div>'+
    '<div class="mockLegal dimmable" data-key="pay"><div class="mockLegalTitle">[유의사항]</div><div class="mockLegalBody">'+
    buildMockLegalHtml(pv) + '</div></div></div>';

  html += '</div>';
  return html;
}

/* ================= 이식 추가: 인식 요약 칩 (원본 renderParseSummary를 DOM 없이) ================= */
// 원본과 다른 점: OBS 공통 배너 카피 뱅크가 없으므로(원본은 브라우저 저장) 타이틀은 모두 "원문 추정"으로 본다.
function summarizeParse(pv, today){
  var chips = [], notes = [];
  if(!pv || !(pv.rawText||'').trim()) return { chips: chips, notes: notes };
  today = today || new Date();
  var n = pv.notify || {};
  if(n.gift && n.count) chips.push({ kind:'ok', text:'알림 신청 ✓ '+n.gift+' · '+n.count });
  else chips.push({ kind:'bad', text:'알림 신청 '+(n.gift?'':'사은품 ')+(n.count?'':'인원 ')+'미인식' });
  if(!n.deadline) chips.push({ kind:'warn', text:'알림 마감일시 미확인 (업무명에 날짜가 있어야 자동 계산)' });
  var liveN = (pv.liveItems||[]).length;
  chips.push(liveN ? { kind:'ok', text:'한정 혜택 '+liveN+'건' } : { kind:'bad', text:'한정 혜택 미인식' });
  var cards = pv.obsCards || [], noTitle = 0;
  cards.forEach(function(r){ if(!r[1]) noTitle++; });
  if(!cards.length) chips.push({ kind:'warn', text:'OBS 링크 없음' });
  else {
    chips.push({ kind:'ok', text:'OBS 링크 '+cards.length+'건' });
    if(noTitle) chips.push({ kind:'bad', text:'OBS 타이틀 미입력 '+noTitle+'건' });
  }
  var payItems = pv.paymentFullText ? splitPaymentItems(pv.paymentFullText) : [];
  if(payItems.length){
    var heroN = payItems.filter(isPaymentHeroText).length;
    chips.push({ kind:'ok', text:'결제혜택 '+payItems.length+'건 (히어로 '+heroN+' · 아이콘행 '+(payItems.length-heroN)+')' });
  } else chips.push({ kind:'warn', text:'결제혜택 미인식' });
  chips.push(pv.legalNotes ? { kind:'ok', text:'유의사항 원문 사용' } : { kind:'info', text:'유의사항 표준 문구 자동 삽입' });
  var payTexts = pv.paymentFullText ? paymentAllTextsFrom(pv.paymentFullText) : [];
  var secs = PAYMENT_NOTICE_SECTIONS.filter(function(sec){ return sec.trigger(payTexts); });
  if(secs.length) chips.push({ kind:'ok', text:'카드사 세부 유의사항 '+secs.length+'종' });
  var curQ = Math.floor(today.getMonth()/3)+1;
  secs.forEach(function(sec){
    sec.bullets.forEach(function(b){
      var qm = b.match(/([1-4])분기\s*정책/);
      if(qm && Number(qm[1]) !== curQ) notes.push('"'+sec.heading+'"의 표준 문구에 "'+qm[1]+'분기 정책"이 들어 있습니다(현재 달력 기준 '+curQ+'분기). 최신 기획서와 대조하세요.');
      var em = b.match(/심의필[^()]*\([0-9.]+~\s*(\d{4})\.(\d{2})\.(\d{2})\)/);
      if(em){
        var end = new Date(Number(em[1]), Number(em[2])-1, Number(em[3]));
        var days = Math.floor((end - today)/86400000);
        if(days < 0) notes.push('여신금융협회 심의필 유효기간('+em[1]+'.'+em[2]+'.'+em[3]+')이 지났습니다. 최신 심의번호로 교체가 필요합니다.');
        else if(days <= 45) notes.push('여신금융협회 심의필 유효기간이 '+days+'일 남았습니다('+em[1]+'.'+em[2]+'.'+em[3]+').');
      }
    });
  });
  return { chips: chips, notes: notes };
}

/* ================= 화면에서 쓰는 타입·함수 ================= */
export interface PromoLiveItem { benefit: string; condition: string; tag: string; detailLines: string[] }
/** 원본 parseRawToStructured 결과 + 마감일시(업무명에서 계산) + 원문 — JSON으로 그대로 저장 가능 */
export interface PromoStructured {
  notify: { gift: string; count: string; deadline: string };
  liveItems: PromoLiveItem[];
  obsCards: [code: string, mainTitle: string, subTitle: string, url: string][];
  paymentFullText: string;
  legalNotes: string;
  rawText: string;
}
export interface PromoChip { kind: 'ok' | 'warn' | 'bad' | 'info'; text: string }

/** 판촉 원문 → 구조화. caseName(업무명, 예: "10/27 10월 결산")의 날짜로 알림 마감일시를 채운다 (원본 collectFormValues와 같은 방식) */
export function parsePromo(raw: string, caseName: string): PromoStructured {
  const parsed = parseRawToStructured(raw || '', []);
  parsed.notify.deadline = computeDeadlineFromCaseName(caseName || '');
  return {
    notify: parsed.notify,
    liveItems: parsed.liveItems,
    obsCards: parsed.obsCards,
    paymentFullText: parsed.paymentFullText,
    legalNotes: parsed.legalNotes,
    rawText: raw || '',
  };
}
/** 워싱본 텍스트(섹션별 순서대로, 사내 공유용) */
export function promoPreviewText(pv: PromoStructured): string { return buildPromoPreviewText(pv); }
/** 실제 상세페이지처럼 보이는 미리보기 HTML — 원본의 아코디언 클릭 핸들러는 뺀다(전부 펼쳐 보여줌).
 *  원본은 OBS 링크 URL을 href에 그대로 넣으므로, 따옴표·꺾쇠 같은 글자는 %인코딩해 속성이 깨지지 않게 한다. */
export function promoPreviewHtml(pv: PromoStructured): string {
  const safeUrl = (u: string) => (u || '').replace(/["'<>`\s]/g, c => encodeURIComponent(c));
  const safe = { ...pv, obsCards: pv.obsCards.map(r => [r[0], r[1], r[2], safeUrl(r[3])]) };
  return renderMockPage(safe).replace(/ onclick="[^"]*"/g, '').replace(/ target="_blank"/g, ' target="_blank" rel="noreferrer"');
}
export function promoSummary(pv: PromoStructured): { chips: PromoChip[]; notes: string[] } { return summarizeParse(pv); }
/** 이전 저장본과 비교한 변경 목록 (원본 computeChanges) */
export function promoChanges(prev: PromoStructured | null, cur: PromoStructured): string[] { return computeChanges(prev, cur); }

export {
  parseRawToStructured, computeChanges, diffFields, buildPromoPreviewText, computeLiveDisclaimerLines,
  computeDeadlineFromCaseName, renderMockPage, PAYMENT_NOTICE_SECTIONS, STANDARD_LEGAL_BOILERPLATE,
};

// 미리보기 HTML용 CSS — 원본 <style>의 mock·legal·acc 규칙을 .promo-preview 안으로 한정 (이식 시 아코디언은 항상 펼침)
export const PROMO_PREVIEW_CSS: string = ".promo-preview .mockPage{width:100%;max-width:390px;margin:8px auto 0;background:#fff;box-shadow:0 0 0 1px #e5e7eb;overflow:hidden;\n    font-family:'Pretendard','Pretendard Variable',-apple-system,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;letter-spacing:-0.04em;color:#000;}\n.promo-preview .mockSec{display:flex;flex-direction:column;align-items:center;background:#fff;}\n.promo-preview .mockEmpty{color:#8a8a8a;font-size:12px;}\n.promo-preview .mockSecLabel{font-size:11px;color:#9a9a9a;padding:20px 20px 6px;letter-spacing:0;border-top:1px dashed #e5e5e5;margin-top:0;}\n.promo-preview .mockSec03{padding:64px 20px 0;}\n.promo-preview .mockEventCard{width:100%;background:#E3E0DC;border-radius:16px;padding:32px 24px;display:flex;flex-direction:column;gap:12px;}\n.promo-preview .mockTitle{font-size:22px;line-height:140%;font-weight:700;text-align:center;color:#000;}\n.promo-preview .mockEventContent{display:flex;flex-direction:column;gap:16px;}\n.promo-preview .mockHero{display:flex;align-items:center;gap:10px;}\n.promo-preview .mockImg{width:68px;height:68px;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;color:#c9c9c9;}\n.promo-preview .mockImg.small{width:48px;height:48px;font-size:16px;border-radius:6px;background:#fff;}\n.promo-preview .mockHeroText{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;font-size:14px;line-height:140%;color:#000;}\n.promo-preview .mockHeroGift{font-weight:600;font-size:18px;line-height:140%;}\n.promo-preview .mockCaptionList{display:flex;flex-direction:column;gap:2px;}\n.promo-preview .mockEventContent .mockCaptionList{padding-top:16px;border-top:1px solid #CACACA;}\n.promo-preview .mockCaption{display:flex;gap:5px;font-size:12px;line-height:140%;color:#262626;}\n.promo-preview .mockCaption>span{min-width:0;}\n.promo-preview .mockCaption:before{content:'';flex:none;width:2px;height:2px;border-radius:50%;background:#262626;margin:8px 3px 0;}\n.promo-preview .mockSec04{padding:64px 20px;}\n.promo-preview .mockSec04 .mockTitle{font-size:26px;padding-bottom:16px;width:100%;}\n.promo-preview .mockBenefitList{width:100%;display:flex;flex-direction:column;gap:8px;}\n.promo-preview .mockBenefitRow{display:flex;align-items:center;gap:16px;background:#F4F4F4;border:1px solid #E1E1E1;border-radius:6px;padding:19px 15px;min-height:88px;box-sizing:border-box;}\n.promo-preview .mockBenefitRow>div:last-child{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;}\n.promo-preview .mockBenefitLabel{font-size:12px;line-height:140%;font-weight:500;color:#262626;}\n.promo-preview .mockBenefitMain{font-size:14px;line-height:130%;font-weight:600;color:#000;}\n.promo-preview .mockSec04 .mockCaptionList{width:100%;padding-top:16px;}\n.promo-preview .mockLinkList{width:100%;display:flex;flex-direction:column;background:#fff;}\n.promo-preview .mockLinkWrap{padding:0 20px 12px;}\n.promo-preview .mockLinkRow{box-sizing:border-box;display:flex;align-items:center;gap:8px;min-height:88px;padding:0 20px 0 0;border-radius:8px;text-decoration:none;color:inherit;background:#EBD2CE;}\n.promo-preview .mockLinkWrap:nth-child(8n+2) .mockLinkRow{background:#CCE2EE;}\n.promo-preview .mockLinkWrap:nth-child(8n+3) .mockLinkRow{background:#CCEED7;}\n.promo-preview .mockLinkWrap:nth-child(8n+4) .mockLinkRow{background:#F2E7B9;}\n.promo-preview .mockLinkWrap:nth-child(8n+5) .mockLinkRow{background:#D3E6E5;}\n.promo-preview .mockLinkWrap:nth-child(8n+6) .mockLinkRow{background:#EAD1E5;}\n.promo-preview .mockLinkWrap:nth-child(8n+7) .mockLinkRow{background:#D2D8E6;}\n.promo-preview .mockLinkWrap:nth-child(8n+8) .mockLinkRow{background:#D9E8C1;}\n.promo-preview .mockLinkImg{width:82px;height:88px;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;color:rgba(0,0,0,.25);}\n.promo-preview .mockLinkText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;justify-content:center;padding:6px 0;}\n.promo-preview .mockLinkMain{font-size:18px;line-height:140%;font-weight:600;color:#000;opacity:.8;}\n.promo-preview .mockLinkSub{font-size:14px;line-height:140%;font-weight:500;letter-spacing:-0.03em;color:#262626;opacity:.7;}\n.promo-preview .mockChevron{flex:none;font-size:22px;line-height:1;color:#000;margin:0 0 0 auto;}\n.promo-preview .mockLinkUrl{font-size:10px;color:#0f766e;margin:4px 2px 0;word-break:break-all;font-family:monospace;user-select:all;letter-spacing:0;}\n.promo-preview .mockSec13{padding:64px 20px 0;}\n.promo-preview .mockPayDark{width:100%;box-sizing:border-box;background:#000;border-radius:16px;padding:32px 24px;display:flex;flex-direction:column;gap:20px;}\n.promo-preview .mockPayDarkTitle{color:#fff;font-size:22px;line-height:140%;font-weight:700;text-align:center;}\n.promo-preview .mockPayHero2{background:#262626;border-radius:8px;padding:16px;min-height:111px;box-sizing:border-box;display:flex;align-items:center;gap:12px;}\n.promo-preview .mockPayHero2Badge{color:#fff;flex:none;width:90px;display:flex;flex-direction:column;gap:2px;}\n.promo-preview .mockPayHero2BadgeNum{font-family:'Lexend Mega','Pretendard',sans-serif;font-size:28px;font-weight:700;line-height:100%;letter-spacing:-0.05em;white-space:nowrap;}\n.promo-preview .mockPayHero2.first .mockPayHero2BadgeNum{font-size:32px;}\n.promo-preview .mockPayHero2BadgeUnit{font-family:'Lexend Mega','Pretendard',sans-serif;font-size:13px;font-weight:700;letter-spacing:-0.03em;margin-left:1px;}\n.promo-preview .mockPayHero2BadgePre{font-family:'Pretendard',-apple-system,'Malgun Gothic',sans-serif;font-size:12px;font-weight:600;letter-spacing:-0.02em;margin-right:1px;}\n.promo-preview .mockPayHero2BadgeLabel{font-size:13px;font-weight:600;line-height:140%;}\n.promo-preview .mockPayHero2Body{min-width:0;flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center;}\n.promo-preview .mockPayHero2Title{color:#FD312E;font-size:14px;font-weight:600;line-height:130%;}\n.promo-preview .mockPayHero2Desc{color:#fff;font-size:12px;line-height:140%;}\n.promo-preview .mockPayHero2More{color:#fff;font-size:11px;line-height:140%;text-decoration:underline;}\n.promo-preview .mockPayRows{display:flex;flex-direction:column;gap:16px;}\n.promo-preview .mockPayRow2{display:flex;align-items:center;gap:8px;}\n.promo-preview .mockPayIcon2{width:40px;height:40px;box-sizing:border-box;padding:8px;border-radius:4px;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;font-family:'Lexend Mega','Pretendard',sans-serif;font-size:18px;font-weight:700;flex:none;}\n.promo-preview .mockPayRow2Body{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;padding:4px 0;}\n.promo-preview .mockPayRow2Label{color:#fff;font-size:14px;font-weight:500;line-height:140%;letter-spacing:-0.04em;}\n.promo-preview .mockPayRow2Value{color:#FD312E;font-size:14px;font-weight:600;line-height:130%;}\n.promo-preview .mockPayNum{font-family:'Lexend Mega','Pretendard',sans-serif;font-size:21px;font-weight:700;line-height:18px;}\n.promo-preview .mockPayNumUnit{margin-left:3px;font-family:'Lexend Mega','Pretendard',sans-serif;font-size:13px;font-weight:700;letter-spacing:-0.03em;}\n.promo-preview .mockPayRow2Note{color:#bdbdbd;font-size:11px;line-height:140%;margin-top:2px;}\n.promo-preview .mockSec14{padding:64px 20px 40px;align-items:stretch;}\n.promo-preview .mockLegalCta{display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;line-height:100%;color:#000;letter-spacing:-0.02em;}\n.promo-preview .mockLegal{margin-top:16px;background:#F4F4F4;border-radius:8px;padding:20px 16px;display:flex;flex-direction:column;gap:12px;}\n.promo-preview .mockLegalTitle{font-size:13px;font-weight:600;line-height:18px;letter-spacing:-0.02em;color:#000;}\n.promo-preview .mockLegalBody{font-size:12px;line-height:140%;color:#262626;letter-spacing:-0.04em;}\n.promo-preview .legalBullet{padding-left:9px;text-indent:-9px;margin-bottom:2px;}\n.promo-preview .legalBullet:last-child{margin-bottom:0;}\n.promo-preview .legalHeading{font-weight:600;color:#000;margin:12px 0 4px;}\n.promo-preview .legalHeading:first-child{margin-top:0;}\n.promo-preview .missChip{display:inline-block;font-size:10.5px;font-weight:700;color:#a12020;background:#fdecec;border:1px solid #f3c3c3;border-radius:999px;padding:1px 7px;margin-left:6px;letter-spacing:0;vertical-align:middle;}\n.promo-preview .accHead{display:flex;align-items:center;justify-content:space-between;cursor:pointer;background:#e9eaed;border-radius:6px;padding:8px 10px;font-weight:700;font-size:12px;margin:0 0 6px;}\n.promo-preview .accBody{display:none;}\n.promo-preview .accBody.open{display:block;}\n.promo-preview .accSub{display:flex;align-items:center;justify-content:space-between;cursor:pointer;background:#fff;border-radius:6px;padding:7px 10px;margin-top:6px;}\n.promo-preview .accSub .legalHeading{margin:0;}\n.promo-preview .accSubBody{display:none;padding-top:6px;}\n.promo-preview .accSubBody.open{display:block;}\n.promo-preview .mockIconSvg{display:block;}\n.promo-preview .mockImg.sv{background:transparent;overflow:visible;position:relative;}\n.promo-preview .mockImg.sv .mockIconSvg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);}\n.promo-preview .mockImg.small{position:relative;overflow:visible;}\n.promo-preview .mockImg.small.sv{width:48px;height:48px;}\n.promo-preview .accBody,.promo-preview .accSubBody{display:block}\n.promo-preview .accArrow,.promo-preview .accPlus{display:none}\n.promo-preview .accHead,.promo-preview .accSub{cursor:default}";
