// Kleine Hilfsfunktionen, die überall gebraucht werden.

export const APP_VERSION = '1.01';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const round2 = (v) => Math.round(v * 100) / 100;

export function debounce(fn, ms) {
  let t = 0;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** DOM-Element bauen: el('div', {class: 'x', onclick: fn}, 'Text', child) */
export function el(tag, attrs, ...children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) n.style.setProperty(sk, sv);
          else n.style[sk] = sv;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

export function relTime(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'gerade eben';
  if (d < 3600) return `vor ${Math.floor(d / 60)} Min.`;
  if (d < 86400) return `vor ${Math.floor(d / 3600)} Std.`;
  if (d < 86400 * 2) return 'gestern';
  if (d < 86400 * 7) return `vor ${Math.floor(d / 86400)} Tagen`;
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

export function dateStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function safeFileName(s) {
  return (s || 'Notiz').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'Notiz';
}

// ---------- Einstellungen (pro Gerät, localStorage) ----------
const SKEY = 'fingernote.settings';
const DEFAULTS = {
  theme: 'system',          // system | light | dark
  finger: 'auto',           // auto | draw | pan
  pencilSeen: false,
  holdShape: true,          // Zeichnen & halten -> saubere Form
  tapUndo: true,            // 2-Finger-Tippen = Rückgängig, 3 = Wiederholen
  sort: 'updated',          // updated | name
  lastBackup: 0,
  welcomed: false,
  tools: null,              // Werkzeugeinstellungen (Farben, Stärken)
};
let settings = null;
export function getSettings() {
  if (!settings) {
    try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; }
    catch (e) { settings = { ...DEFAULTS }; }
  }
  return settings;
}
export function saveSettings(patch) {
  Object.assign(getSettings(), patch || {});
  try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { /* privater Modus */ }
  return settings;
}

export function applyTheme() {
  const t = getSettings().theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', dark ? '#1b1b1e' : '#f6f6f3');
}

export function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

export function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}

export function base64ToArrayBuffer(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

export function canvasToBlob(canvas, type = 'image/png', q) {
  return new Promise((res) => canvas.toBlob(res, type, q));
}

/** Datei teilen (iPad-Teilen-Menü → „In Dateien sichern“, AirDrop …) oder herunterladen. */
export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.share) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}

export function pickFile(accept, multiple = false) {
  return new Promise((resolve) => {
    const inp = el('input', { type: 'file', accept, style: { position: 'fixed', left: '-1000px', top: '0' } });
    if (multiple) inp.multiple = true;
    let done = false;
    inp.addEventListener('change', () => { done = true; resolve(multiple ? [...inp.files] : inp.files[0] || null); inp.remove(); });
    // Abbrechen erkennen (wenn möglich)
    inp.addEventListener('cancel', () => { if (!done) { resolve(multiple ? [] : null); inp.remove(); } });
    document.body.append(inp);
    inp.click();
  });
}
