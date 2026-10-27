// 워싱본 변경 하이라이트 — 기획팀 통합셋팅기 v13(v09 기능)의 pageHighlight를 화면 DOM에서 그대로 한다.
// 지난 저장본 미리보기와 지금 미리보기를 같은 단위(KV·알림 신청·한정 혜택·OBS·결제혜택·유의사항 …)로 나눠
// 글자가 같은 항목은 짝지어 빼고, 남은(바뀌거나 새로 생긴) 항목에 hlChg를 붙인다. 순서만 바뀐 항목은 표시하지 않는다.
import { PROMO_HL_UNITS } from './promoParse';

function unitText(el: Element): string {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll('.reviewOnly,.addCtl,.missChip,.kvCnt,.addDel').forEach(x => x.remove());
  let t = c.textContent ?? '';
  if (el.classList.contains('mockLinkWrap')) {
    const u = el.querySelector('.mockLinkUrl');
    if (u) t += ' ' + (u.textContent ?? '').split(' · ')[0];
  }
  return t.replace(/\s+/g, ' ').trim();
}

function collect(root: ParentNode): Record<string, { el: Element; t: string }[]> {
  const out: Record<string, { el: Element; t: string }[]> = {};
  for (const [name, sel] of PROMO_HL_UNITS) out[name] = [...root.querySelectorAll(sel)].map(el => ({ el, t: unitText(el) }));
  return out;
}

export interface PromoHighlight { total: number; removed: number; parts: string[] }

/** root(지금 미리보기)에 표시를 붙이고 요약을 돌려준다. baseHtml이 없으면 표시를 지우고 null */
export function applyPromoHighlight(root: HTMLElement, baseHtml: string | null): PromoHighlight | null {
  root.querySelectorAll('.hlChg').forEach(x => x.classList.remove('hlChg'));
  if (!baseHtml) return null;
  const tmp = document.createElement('div');
  tmp.innerHTML = baseHtml;
  const base = collect(tmp), cur = collect(root);
  let total = 0, removed = 0;
  const parts: string[] = [];
  for (const k of Object.keys(cur)) {
    const pool = (base[k] ?? []).map(x => x.t);
    let n = 0;
    for (const u of cur[k]) {
      const i = pool.indexOf(u.t);
      if (i >= 0) pool.splice(i, 1);
      else { u.el.classList.add('hlChg'); n++; }
    }
    const del = Math.max(0, (base[k] ?? []).length - cur[k].length);
    removed += del;
    if (n || del) parts.push(k + (n ? ` ${n}` : '') + (del ? ` (삭제 ${del})` : ''));
    total += n;
  }
  return { total, removed, parts };
}
