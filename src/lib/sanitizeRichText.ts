import DOMPurify from 'dompurify';

// AI 툴 상세 설명 등, 사용자가 외부에서 복사해온 서식(굵게/제목/목록/표)을 저장·표시할 때
// 항상 이 필터를 거친다 — 붙여넣기 직후, 저장 직전, 렌더링 직전 3곳에서 반복 적용(중복 방어).
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
];
// style 허용 — 붙여넣은 콜아웃 박스 등의 배경색·테두리·둥근 모서리를 그대로 보존하기 위함.
// DOMPurify가 style 값 안의 위험한 패턴(javascript:, expression(), -moz-binding 등)은 계속 걸러낸다.
const ALLOWED_ATTR = ['href', 'style'];

export function sanitizeRichText(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  // <a>는 href만 허용했으니 target/rel은 항상 안전한 값으로 통일
  const wrap = document.createElement('div');
  wrap.innerHTML = clean;
  wrap.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noreferrer noopener');
  });
  return wrap.innerHTML;
}

// 값 검증용 — 태그만 있고 실제 텍스트가 없는 경우(예: <p><br></p>)를 빈 값으로 취급
export function isRichTextEmpty(html: string): boolean {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return (wrap.textContent ?? '').trim().length === 0;
}

// 리치 에디터 도입 이전에 일반 텍스트(줄바꿈 포함)로 저장된 설명과 호환 — 태그가 전혀 없으면
// 평문으로 간주해 이스케이프 후 줄바꿈만 <br>로 변환, 이미 HTML이면 그대로 정제
export function toDisplayHtml(raw: string): string {
  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/\n/g, '<br>');
  }
  return sanitizeRichText(raw);
}
