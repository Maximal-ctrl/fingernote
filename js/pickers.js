// Auswahl-Elemente für Vorlagen, Papierfarben, Formate und Farben.
import { el } from './util.js';
import { PAPERS, TEMPLATES, FORMATS, drawPaper } from './ink.js';

export function templatePreview(template, paper, w = 66, h = 92) {
  const c = el('canvas', { class: 'tpl-canvas' });
  const d = Math.min(window.devicePixelRatio || 1, 2);
  c.width = w * d; c.height = h * d;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  // kleinerer Seitenausschnitt, damit Linien in der Vorschau erkennbar sind
  const page = { w: 420, h: 594, template, paper, bg: null };
  ctx.setTransform((w * d) / page.w, 0, 0, (h * d) / page.h, 0, 0);
  drawPaper(ctx, page);
  return c;
}

export function templatePicker(value, paper, onChange) {
  const wrap = el('div', { class: 'tpl-grid' });
  const render = () => {
    wrap.innerHTML = '';
    for (const [k, label] of Object.entries(TEMPLATES)) {
      const b = el('button', { class: `tpl ${k === value ? 'on' : ''}`, type: 'button' }, templatePreview(k, paper), el('span', null, label));
      b.addEventListener('click', () => { value = k; onChange(k); render(); });
      wrap.append(b);
    }
  };
  render();
  wrap.setPaper = (p) => { paper = p; render(); };
  return wrap;
}

export function paperPicker(value, onChange) {
  const wrap = el('div', { class: 'swatch-row' });
  for (const [k, p] of Object.entries(PAPERS)) {
    const b = el('button', { class: `paper-sw ${k === value ? 'on' : ''}`, type: 'button', title: p.label, style: { background: p.bg } });
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(k);
    });
    wrap.append(el('label', { class: 'sw-wrap' }, b, el('span', null, p.label)));
  }
  return wrap;
}

export function formatPicker(value, onChange) {
  const wrap = el('div', { class: 'seg' });
  for (const [k, f] of Object.entries(FORMATS)) {
    const b = el('button', { class: k === value ? 'on' : '', type: 'button' }, f.label);
    b.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(k);
    });
    wrap.append(b);
  }
  return wrap;
}

export function colorRow(colors, value, onChange, cls = 'cover-sw') {
  const wrap = el('div', { class: 'swatch-row' });
  for (const c of colors) {
    const b = el('button', { class: `${cls} ${c === value ? 'on' : ''}`, type: 'button', style: { background: c }, 'aria-label': c });
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(c);
    });
    wrap.append(b);
  }
  return wrap;
}

export const PALETTE = [
  '#1d1d1f', '#4b5563', '#9ca3af', '#ffffff', '#1f5eff', '#0ea5e9',
  '#0d8f80', '#139a52', '#65a30d', '#eab308', '#f08c00', '#e5383b',
  '#db2777', '#8b3dff', '#6d28d9', '#92400e', '#ffe14d', '#7ee08a',
  '#7cc4ff', '#ff94c6', '#ffb35c', '#c4b5fd', '#f6c945', '#8fd3c7',
];

export function field(label, control, hint) {
  return el('div', { class: 'field' }, el('div', { class: 'field-label' }, label), control, hint ? el('div', { class: 'field-hint' }, hint) : null);
}
