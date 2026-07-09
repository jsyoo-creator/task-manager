import DOMPurify from 'dompurify';

// AI 툴 상세 설명 등, 사용자가 외부에서 복사해온 서식(굵게/제목/목록/표)을 저장·표시할 때
// 항상 이 필터를 거친다 — 붙여넣기 직후, 저장 직전, 렌더링 직전 3곳에서 반복 적용(중복 방어).
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
];
// style 허용 — 붙여넣은 콜아웃 박스 등의 배경색·테두리·둥근 모서리를 그대로 보존하기 위함.
// DOMPurify가 style 값 안의 위험한 패턴(javascript:, expression(), -moz-binding 등)은 계속 걸러낸다.
// src/alt 허용 — 실제 <img src="https://...">는 통과시켜 붙여넣은 이미지가 그대로 보이게 함
// (SVG로 그려진 미리보기 등 이미지가 아닌 요소는 애초에 허용 태그가 아니라서 계속 빠짐)
const ALLOWED_ATTR = ['href', 'style', 'src', 'alt'];

export function sanitizeRichText(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  const wrap = document.createElement('div');
  wrap.innerHTML = clean;
  // <a>는 href만 허용했으니 target/rel은 항상 안전한 값으로 통일
  wrap.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noreferrer noopener');
  });
  // 배경색은 붙여넣은 원본 사이트의 배경(대부분 의도치 않은 회색·크림색 박스)이라 항상 제거.
  // 테두리·둥근 모서리·글자색 등은 그대로 유지해 콜아웃 박스 형태는 살아있게 함
  wrap.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.removeProperty('background-image');
  });
  // 원본에 SVG·캔버스 등 허용되지 않는 요소(이미지가 아닌 미리보기 등)만 들어있던 칸은
  // 내용이 통째로 사라져 빈 상자·이상한 여백만 남으므로, 완전히 빈 div/p는 제거
  wrap.querySelectorAll('div, p').forEach(el => {
    const hasContent = (el.textContent ?? '').trim().length > 0 || el.querySelector('img, table');
    if (!hasContent) el.remove();
  });
  return wrap.innerHTML;
}

// 값 검증용 — 태그만 있고 실제 텍스트가 없는 경우(예: <p><br></p>)를 빈 값으로 취급
export function isRichTextEmpty(html: string): boolean {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return (wrap.textContent ?? '').trim().length === 0;
}

// 갤러리 카드 미리보기 등 순수 텍스트만 필요한 곳에서 태그를 걷어내고 공백을 정리
export function stripHtml(html: string): string {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return (wrap.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// <a>로 감싸지 않고 그냥 텍스트로 타이핑/붙여넣기한 URL은 사용자가 직접 링크 삽입 기능을
// 쓰지 않는 한 계속 평문으로 남아 클릭이 안 되므로, 표시 직전에 찾아서 <a>로 감싼다
function linkifyPlainUrls(root: HTMLElement) {
  const urlPattern = /https?:\/\/[^\s<]+/g;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => (node.parentElement?.closest('a') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const targets: Text[] = [];
  let node: Node | null;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) targets.push(node as Text);
  targets.forEach(textNode => {
    const text = textNode.textContent ?? '';
    urlPattern.lastIndex = 0;
    if (!urlPattern.test(text)) return;
    urlPattern.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = urlPattern.exec(text))) {
      if (match.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      const a = document.createElement('a');
      a.href = match[0];
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      a.textContent = match[0];
      frag.appendChild(a);
      lastIndex = match.index + match[0].length;
    }
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    textNode.replaceWith(frag);
  });
}

// 붙여넣기 등의 과정에서 이미 이스케이프된 엔티티(&lt; &amp; 등)가 한 번 더 이스케이프되면
// (&amp;lt; &amp;amp; 등) 화면에 "&lt;"나 "&amp;" 같은 글자가 그대로 노출됨 — 반복 적용해
// 한 겹만 남도록 정규화(윈도우 클립보드 등 환경에서 이런 중복 이스케이프가 특히 잘 발생함)
function collapseDoubleEscaped(s: string): string {
  let cur = s;
  for (let i = 0; i < 5; i++) {
    const next = cur.replace(/&amp;(amp|lt|gt|quot|#39|nbsp);/gi, '&$1;');
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

// 서식 없는 붙여넣기(클립보드에 HTML이 없어 평문만 들어온 경우) 등으로 <b> <div> 같은
// 태그 문자 자체가 통째로 이스케이프되어 저장되면(&lt;b&gt;...&lt;/b&gt;) 화면에 굵게가 아니라
// "<b>" 글자 그대로 노출됨. 속성이 없는 단순 서식 태그는 실제 태그로 되돌려 서식이 살아나게
// 함 — 이후 sanitizeRichText(DOMPurify)가 다시 한 번 안전하게 걸러내므로 보안상 문제 없음
const SIMPLE_HEALABLE_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'div', 'p', 'ul', 'ol', 'li', 'blockquote', 'br'];
function healEscapedSimpleTags(s: string): string {
  const pattern = new RegExp(`&lt;(\\/?)(${SIMPLE_HEALABLE_TAGS.join('|')})\\s*&gt;`, 'gi');
  return s.replace(pattern, '<$1$2>');
}

// 리치 에디터 도입 이전에 일반 텍스트(줄바꿈 포함)로 저장된 설명과 호환 — 태그나 엔티티가
// 전혀 없으면 순수 평문으로 간주해 이스케이프 후 줄바꿈만 <br>로 변환, 하나라도 있으면(태그든
// 엔티티든) 이미 처리된 HTML로 보고 다시 이스케이프하지 않고 그대로 정제
export function toDisplayHtml(raw: string): string {
  const normalized = healEscapedSimpleTags(collapseDoubleEscaped(raw));
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(normalized) || /&(amp|lt|gt|quot|#39|nbsp);/i.test(normalized);
  const html = !looksLikeHtml
    ? normalized.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    : sanitizeRichText(normalized);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  linkifyPlainUrls(wrap);
  return wrap.innerHTML;
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

// 상세 설명 안의 제목(h1~h4)에 고유 id를 붙이고 목차 목록을 뽑아낸다 —
// 우측 사이드바 CONTENTS 클릭 시 해당 위치로 스크롤 이동시키기 위함
export function extractToc(html: string): { html: string; headings: TocHeading[] } {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const headings: TocHeading[] = [];
  wrap.querySelectorAll('h1, h2, h3, h4').forEach((el, i) => {
    const text = (el.textContent ?? '').trim();
    if (!text) return;
    const id = `toc-${i}`;
    el.id = id;
    headings.push({ id, text, level: Number(el.tagName[1]) });
  });
  return { html: wrap.innerHTML, headings };
}
