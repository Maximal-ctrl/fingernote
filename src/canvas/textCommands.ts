import type { TagKind } from '../db/repo';

const BLOCK_RE = /^(P|DIV|LI|H1|H2|H3|BLOCKQUOTE|PRE)$/;

let separatorSet = false;
export function ensureParagraphSeparator() {
  if (separatorSet) return;
  separatorSet = true;
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* alt */ }
}

export function activeEditable(): HTMLElement | null {
  const el = document.activeElement as HTMLElement | null;
  return el?.classList.contains('tb-content') ? el : null;
}

export function currentParagraph(root: HTMLElement): HTMLElement | null {
  const sel = getSelection();
  if (!sel || !sel.rangeCount) return null;
  let n: Node | null = sel.anchorNode;
  while (n && n !== root) {
    if (n.nodeType === 1 && BLOCK_RE.test(n.nodeName)) return n as HTMLElement;
    n = n.parentNode;
  }
  return null;
}

export function fire(root: HTMLElement) {
  root.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

export function toggleTag(tag: TagKind, root = activeEditable()) {
  if (!root) return false;
  let p = currentParagraph(root);
  if (!p) {
    document.execCommand('formatBlock', false, 'p');
    p = currentParagraph(root);
  }
  if (!p) return false;
  if (p.getAttribute('data-tag') === tag) {
    p.removeAttribute('data-tag');
    p.removeAttribute('data-done');
  } else {
    p.setAttribute('data-tag', tag);
    p.removeAttribute('data-done');
  }
  fire(root);
  return true;
}

export function exec(cmd: string, value?: string) {
  const root = activeEditable();
  if (!root) return;
  if (cmd === 'formatBlock') {
    const p = currentParagraph(root);
    const tag = value?.replace(/[<>]/g, '').toUpperCase();
    // erneut gleiche Überschrift → zurück zu Absatz
    document.execCommand('formatBlock', false, p && p.tagName === tag ? 'p' : value);
  } else {
    if (cmd === 'hiliteColor' || cmd === 'foreColor') document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, value);
    document.execCommand('styleWithCSS', false, 'false');
  }
  fire(root);
}
