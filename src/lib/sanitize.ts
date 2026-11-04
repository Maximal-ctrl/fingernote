const ALLOWED = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3',
  'SPAN', 'A', 'CODE', 'PRE', 'BLOCKQUOTE', 'FONT', 'MARK', 'SUB', 'SUP',
]);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'META', 'LINK', 'TITLE', 'SVG', 'MATH']);
const TAGS = new Set(['todo', 'important', 'question', 'idea']);

/** Lässt nur einfache Formatierung durch. Keine Skripte, keine Event-Handler, keine fremden Styles. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return '';
  clean(root);
  return root.innerHTML;
}

function clean(el: Element) {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toUpperCase();
    if (DROP_WITH_CONTENT.has(tag)) {
      child.remove();
      continue;
    }
    clean(child);
    if (!ALLOWED.has(tag)) {
      // Element auspacken, Inhalt behalten
      const frag = child.ownerDocument.createDocumentFragment();
      while (child.firstChild) frag.appendChild(child.firstChild);
      child.replaceWith(frag);
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const keep =
        (name === 'href' && tag === 'A' && /^(https?:|mailto:)/i.test(attr.value.trim())) ||
        (name === 'data-tag' && TAGS.has(attr.value)) ||
        (name === 'data-done' && attr.value === '1') ||
        (name === 'color' && tag === 'FONT' && /^#[0-9a-f]{3,8}$/i.test(attr.value)) ||
        (name === 'style' && safeStyle(attr.value) !== '');
      if (!keep) child.removeAttribute(attr.name);
      else if (name === 'style') child.setAttribute('style', safeStyle(attr.value));
    }
    if (tag === 'A') {
      child.setAttribute('target', '_blank');
      child.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

/** Erlaubt nur Text- und Hintergrundfarbe als Hex/rgb (so schreibt execCommand Farben). */
function safeStyle(style: string): string {
  const out: string[] = [];
  for (const part of style.split(';')) {
    const [k, v] = part.split(':').map((s) => s && s.trim().toLowerCase());
    if (!k || !v) continue;
    if ((k === 'color' || k === 'background-color') && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/.test(v)) {
      out.push(`${k}: ${v}`);
    }
    if (k === 'font-weight' && /^(bold|[5-9]00)$/.test(v)) out.push(`${k}: ${v}`);
    if (k === 'font-style' && v === 'italic') out.push(`${k}: ${v}`);
    if (k === 'text-decoration' && /^(underline|line-through)/.test(v)) out.push(`${k}: ${v}`);
  }
  return out.join('; ');
}
