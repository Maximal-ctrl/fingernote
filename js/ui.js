// Dialoge, Menüs, Hinweise.
import { el } from './util.js';
import { icon } from './icons.js';

const root = () => document.getElementById('overlay');

// ---------------------------------------------------------------- Hinweis (Toast)
let toastTimer = 0;
export function toast(msg, opts = {}) {
  let t = document.querySelector('.toast');
  if (t) t.remove();
  t = el('div', { class: 'toast', role: 'status' }, el('span', null, msg));
  if (opts.action) {
    t.append(el('button', { class: 'toast-btn', onclick: () => { t.remove(); opts.action.run(); } }, opts.action.label));
  }
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, opts.ms || 2600);
}

// ---------------------------------------------------------------- Dialog
export function dialog({ title, body, buttons = [{ label: 'OK', value: true, primary: true }], wide = false, onOpen, dismissValue = null, cls = '' }) {
  return new Promise((resolve) => {
    const back = el('div', { class: 'dlg-back' });
    const box = el('div', { class: `dlg ${wide ? 'wide' : ''} ${cls}`, role: 'dialog', 'aria-modal': 'true' });
    const close = (v) => {
      back.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => back.remove(), 200);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(dismissValue);
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        const prim = buttons.find((b) => b.primary);
        if (prim) { e.preventDefault(); close(typeof prim.value === 'function' ? prim.value() : prim.value); }
      }
    };
    if (title) box.append(el('h2', { class: 'dlg-title' }, title));
    const content = el('div', { class: 'dlg-body' });
    if (typeof body === 'string') content.innerHTML = body;
    else if (body) content.append(body);
    box.append(content);
    if (buttons.length) {
      const bar = el('div', { class: 'dlg-btns' });
      for (const b of buttons) {
        bar.append(el('button', {
          class: `btn ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}`,
          onclick: () => {
            const v = typeof b.value === 'function' ? b.value() : b.value;
            if (v === undefined) return; // Validierung fehlgeschlagen
            close(v);
          },
        }, b.label));
      }
      box.append(bar);
    }
    back.append(box);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(dismissValue); });
    root().append(back);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => back.classList.add('show'));
    if (onOpen) onOpen(box, close);
  });
}

export async function prompt(title, value = '', { placeholder = '', okLabel = 'OK' } = {}) {
  const inp = el('input', { class: 'inp', type: 'text', value, placeholder, autocomplete: 'off', autocapitalize: 'sentences' });
  return dialog({
    title,
    body: inp,
    buttons: [{ label: 'Abbrechen', value: null }, { label: okLabel, primary: true, value: () => inp.value.trim() }],
    onOpen: () => setTimeout(() => { inp.focus(); inp.select(); }, 60),
  });
}

export function confirm(title, msg, okLabel = 'OK', danger = false) {
  return dialog({
    title,
    body: el('p', null, msg),
    buttons: [{ label: 'Abbrechen', value: false }, { label: okLabel, value: true, primary: !danger, danger }],
    dismissValue: false,
  });
}

// ---------------------------------------------------------------- Popover / Menü
let openPop = null;
export function closePopover() { if (openPop) { openPop(); openPop = null; } }

export function popover(anchor, content, { placement = 'below', cls = '', onClose } = {}) {
  closePopover();
  const pop = el('div', { class: `pop ${cls}` });
  pop.append(content);
  root().append(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = r.left + r.width / 2 - pw / 2;
  let y = placement === 'above' ? r.top - ph - 8 : r.bottom + 8;
  if (y + ph > vh - 8) y = Math.max(8, r.top - ph - 8);
  if (y < 8) y = 8;
  x = Math.max(8, Math.min(vw - pw - 8, x));
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
  requestAnimationFrame(() => pop.classList.add('show'));
  const outside = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  const close = () => {
    document.removeEventListener('pointerdown', outside, true);
    pop.classList.remove('show');
    setTimeout(() => pop.remove(), 150);
    if (onClose) onClose();
  };
  openPop = close;
  return close;
}

/** items: [{label, icon, run, danger, checked, disabled, sep, hint}] */
export function menu(anchor, items, opts = {}) {
  const list = el('div', { class: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { list.append(el('div', { class: 'menu-sep' })); continue; }
    if (it.title) { list.append(el('div', { class: 'menu-title' }, it.title)); continue; }
    const b = el('button', {
      class: `menu-item ${it.danger ? 'danger' : ''}`,
      disabled: it.disabled,
      onclick: () => { closePopover(); it.run && it.run(); },
    });
    b.innerHTML = `${it.icon ? icon(it.icon) : '<span class="ic"></span>'}<span class="menu-label"></span>${it.checked ? icon('check', 'menu-check') : ''}`;
    b.querySelector('.menu-label').textContent = it.label;
    if (it.hint) b.append(el('span', { class: 'menu-hint' }, it.hint));
    list.append(b);
  }
  return popover(anchor, list, opts);
}

// ---------------------------------------------------------------- Fortschritt
export function progress(title) {
  const bar = el('div', { class: 'prog-bar' }, el('div', { class: 'prog-fill' }));
  const label = el('div', { class: 'prog-label' }, '');
  let closeFn;
  dialog({ title, body: el('div', null, bar, label), buttons: [], onOpen: (box, close) => { closeFn = close; } });
  return {
    set(frac, text) {
      bar.firstChild.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
      if (text != null) label.textContent = text;
    },
    close() { if (closeFn) closeFn(null); },
  };
}

// ---------------------------------------------------------------- Segmentschalter
export function segmented(options, value, onChange) {
  const wrap = el('div', { class: 'seg' });
  for (const [v, label] of options) {
    const b = el('button', { class: v === value ? 'on' : '', type: 'button' }, label);
    b.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(v);
    });
    wrap.append(b);
  }
  return wrap;
}

export function toggle(checked, onChange) {
  const inp = el('input', { type: 'checkbox', class: 'switch' });
  inp.checked = !!checked;
  inp.addEventListener('change', () => onChange(inp.checked));
  return inp;
}
