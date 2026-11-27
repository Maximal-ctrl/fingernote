// Bauteil-Editor (Vollbild): eigene Schaltzeichen zeichnen und vorhandene komplett bearbeiten.
// Werkzeuge wie in CAD-Programmen: Auswahl (verschieben, Griffe), Linie, Linienzug, Rechteck, Kreis, Bogen,
// Freihand (Stift), Text, Anschlusspunkt, Radierer. Fangen am Raster und an Endpunkten, Rückgängig/Wiederholen,
// Drehen/Spiegeln/Duplizieren, Eigenschaften mit Zahlenwerten, Anschlussliste.
// Datenformat wie die eingebauten Symbole: ops = [['l',x1,y1,x2,y2], ['d',…], ['r',x,y,w,h,fill], ['c',cx,cy,r,fill],
// ['a',cx,cy,r,a0,a1], ['p',[x,y,…],closed,fill], ['t',x,y,text,size,align], ['b',x,y,w,h,color]], pins = [[x,y,name]].
import { el } from './util.js';
import { prompt, toast, confirm } from './ui.js';
import { allSymbols, getSym } from './schem-symbols.js';

const INK = '#16161a', SEL = '#6a5cff', PIN = '#e5384b', LW = 0.35;
const NS_ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  select: '<path d="M5 3l14 8-6 2-3 6z"/>',
  l: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
  pl: '<path d="M4 18l5-9 6 5 5-9"/>',
  r: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  c: '<circle cx="12" cy="12" r="7.5"/>',
  a: '<path d="M5 17a8 8 0 0114 0"/><circle cx="12" cy="17" r="1.2"/>',
  free: '<path d="M4 17c3-6 5 2 8-3s4-6 8-4"/>',
  t: '<path d="M5 6V5h14v1"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  pin: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v5.5M12 15.5V21"/>',
  erase: '<path d="M7 21l-4.3-4.3a2.4 2.4 0 010-3.4l9.6-9.6a2.4 2.4 0 013.4 0l5.6 5.6a2.4 2.4 0 010 3.4L13 21"/><path d="M22 21H7"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  rot: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
  mir: '<path d="M12 3v18"/><path d="M8 7L3 17h5zM16 7l5 10h-5z"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  front: '<rect x="9" y="9" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity=".25"/><path d="M4 15V5a1 1 0 011-1h10"/>',
  back: '<rect x="4" y="4" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity=".25"/><path d="M20 9v10a1 1 0 01-1 1H9"/>',
  center: '<circle cx="12" cy="12" r="2"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
};
const TOOLS = [
  ['select', 'Auswählen / Verschieben (V)'], ['l', 'Linie (L)'], ['pl', 'Linienzug / Vieleck (P)'], ['r', 'Rechteck (R)'],
  ['c', 'Kreis (C)'], ['a', 'Bogen (A): Mitte, Anfang, Ende'], ['free', 'Freihand mit Stift/Finger (F)'], ['t', 'Text (T)'],
  ['pin', 'Anschlusspunkt (K)'], ['erase', 'Radierer (E)'],
];
const NAMES = { l: 'Linie', d: 'Linie (gestrichelt)', r: 'Rechteck', b: 'Farbfläche', c: 'Kreis', a: 'Bogen', p: 'Linienzug', t: 'Text', pin: 'Anschluss' };

const R2 = (v) => Math.round(v * 100) / 100;
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const angDeg = (cx, cy, x, y) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
const norm360 = (a) => ((a % 360) + 360) % 360;

/** Ramer–Douglas–Peucker für Freihandlinien. */
function rdp(pts, eps) {
  if (pts.length <= 4) return pts;
  const n = pts.length / 2;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const st = [[0, n - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[2 * i], pts[2 * i + 1], pts[2 * a], pts[2 * a + 1], pts[2 * b], pts[2 * b + 1]);
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(R2(pts[2 * i]), R2(pts[2 * i + 1]));
  return out;
}

// ---------------------------------------------------------------- Geometrie je Element
function arcPts(op, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = ((op[4] + ((op[5] - op[4]) * i) / n) * Math.PI) / 180; out.push(op[1] + Math.cos(a) * op[3], op[2] + Math.sin(a) * op[3]); }
  return out;
}
function opDist(op, x, y) {
  switch (op[0]) {
    case 'l': case 'd': return segDist(x, y, op[1], op[2], op[3], op[4]);
    case 'r': case 'b': {
      const [a, b, w, h] = [op[1], op[2], op[3], op[4]];
      const edge = Math.min(segDist(x, y, a, b, a + w, b), segDist(x, y, a + w, b, a + w, b + h), segDist(x, y, a + w, b + h, a, b + h), segDist(x, y, a, b + h, a, b));
      const inside = x > a && x < a + w && y > b && y < b + h;
      return inside && (op[0] === 'b' || op[5]) ? 0 : edge;
    }
    case 'c': { const d = Math.hypot(x - op[1], y - op[2]); return op[4] && d < op[3] ? 0 : Math.abs(d - op[3]); }
    case 'a': { const p = arcPts(op); let m = Infinity; for (let i = 0; i + 2 < p.length; i += 2) m = Math.min(m, segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3])); return m; }
    case 'p': { const p = op[1]; let m = Infinity; const n = p.length; for (let i = 0; i + 2 < n; i += 2) m = Math.min(m, segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3])); if (op[2] && n >= 4) m = Math.min(m, segDist(x, y, p[n - 2], p[n - 1], p[0], p[1])); return m; }
    case 't': { const b = opBox(op); return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 ? 0 : Math.hypot(x - op[1], y - op[2]); }
    default: return Infinity;
  }
}
function opBox(op) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  switch (op[0]) {
    case 'l': case 'd': add(op[1], op[2]); add(op[3], op[4]); break;
    case 'r': case 'b': add(op[1], op[2]); add(op[1] + op[3], op[2] + op[4]); break;
    case 'c': add(op[1] - op[3], op[2] - op[3]); add(op[1] + op[3], op[2] + op[3]); break;
    case 'a': { const p = arcPts(op, 12); for (let i = 0; i < p.length; i += 2) add(p[i], p[i + 1]); break; }
    case 'p': for (let i = 0; i < op[1].length; i += 2) add(op[1][i], op[1][i + 1]); break;
    case 't': { const s = op[4] || 3, w = String(op[3]).length * s * 0.58, al = op[5] || 'center'; const xa = al === 'left' ? op[1] : al === 'right' ? op[1] - w : op[1] - w / 2; add(xa, op[2] - s * 0.6); add(xa + w, op[2] + s * 0.6); break; }
    default: break;
  }
  return { x0, y0, x1, y1 };
}
/** Griffe (verschiebbare Punkte) eines Elements. */
function handles(op) {
  switch (op[0]) {
    case 'l': case 'd': return [[op[1], op[2]], [op[3], op[4]]];
    case 'r': case 'b': return [[op[1], op[2]], [op[1] + op[3], op[2]], [op[1] + op[3], op[2] + op[4]], [op[1], op[2] + op[4]]];
    case 'c': return [[op[1], op[2]], [op[1] + op[3], op[2]]];
    case 'a': { const p = arcPts(op, 1); return [[op[1], op[2]], [p[0], p[1]], [p[2], p[3]]]; }
    case 'p': { const h = []; for (let i = 0; i < op[1].length; i += 2) h.push([op[1][i], op[1][i + 1]]); return h; }
    case 't': return [[op[1], op[2]]];
    default: return [];
  }
}
function setHandle(op, i, x, y) {
  switch (op[0]) {
    case 'l': case 'd': if (i === 0) { op[1] = x; op[2] = y; } else { op[3] = x; op[4] = y; } break;
    case 'r': case 'b': {
      const ox = i === 0 || i === 3 ? op[1] + op[3] : op[1], oy = i === 0 || i === 1 ? op[2] + op[4] : op[2];
      op[1] = Math.min(x, ox); op[2] = Math.min(y, oy); op[3] = Math.abs(x - ox); op[4] = Math.abs(y - oy);
      break;
    }
    case 'c': if (i === 0) { op[1] = x; op[2] = y; } else op[3] = Math.max(0.3, R2(Math.hypot(x - op[1], y - op[2]))); break;
    case 'a':
      if (i === 0) { op[1] = x; op[2] = y; }
      else if (i === 1) { const sweep = op[5] - op[4]; op[4] = R2(angDeg(op[1], op[2], x, y)); op[5] = op[4] + sweep; op[3] = Math.max(0.3, R2(Math.hypot(x - op[1], y - op[2]))); }
      else { let a = angDeg(op[1], op[2], x, y); while (a <= op[4]) a += 360; while (a > op[4] + 360) a -= 360; op[5] = R2(a); }
      break;
    case 'p': op[1][2 * i] = x; op[1][2 * i + 1] = y; break;
    case 't': op[1] = x; op[2] = y; break;
    default: break;
  }
}
function moveOp(op, dx, dy) {
  switch (op[0]) {
    case 'l': case 'd': op[1] += dx; op[2] += dy; op[3] += dx; op[4] += dy; break;
    case 'p': for (let i = 0; i < op[1].length; i += 2) { op[1][i] += dx; op[1][i + 1] += dy; } break;
    default: op[1] += dx; op[2] += dy; break;
  }
  roundOp(op);
}
function roundOp(op) {
  for (let i = 1; i < op.length; i++) if (typeof op[i] === 'number') op[i] = R2(op[i]);
  if (op[0] === 'p') op[1] = op[1].map(R2);
}
/** Um (cx, cy) 90° im Uhrzeigersinn drehen (wie beim Platzieren). */
function rotOp(op, cx, cy) {
  const R = (x, y) => [cx - (y - cy), cy + (x - cx)];
  switch (op[0]) {
    case 'l': case 'd': { const a = R(op[1], op[2]), b = R(op[3], op[4]); op[1] = a[0]; op[2] = a[1]; op[3] = b[0]; op[4] = b[1]; break; }
    case 'r': case 'b': { const a = R(op[1], op[2]), b = R(op[1] + op[3], op[2] + op[4]); op[1] = Math.min(a[0], b[0]); op[2] = Math.min(a[1], b[1]); op[3] = Math.abs(a[0] - b[0]); op[4] = Math.abs(a[1] - b[1]); break; }
    case 'c': case 't': { const a = R(op[1], op[2]); op[1] = a[0]; op[2] = a[1]; break; }
    case 'a': { const a = R(op[1], op[2]); op[1] = a[0]; op[2] = a[1]; op[4] += 90; op[5] += 90; break; }
    case 'p': for (let i = 0; i < op[1].length; i += 2) { const a = R(op[1][i], op[1][i + 1]); op[1][i] = a[0]; op[1][i + 1] = a[1]; } break;
    default: break;
  }
  roundOp(op);
}
function mirOp(op, cx) {
  const M = (x) => 2 * cx - x;
  switch (op[0]) {
    case 'l': case 'd': op[1] = M(op[1]); op[3] = M(op[3]); break;
    case 'r': case 'b': op[1] = M(op[1] + op[3]); break;
    case 'c': op[1] = M(op[1]); break;
    case 't': op[1] = M(op[1]); if (op[5] === 'left') op[5] = 'right'; else if (op[5] === 'right') op[5] = 'left'; break;
    case 'a': { op[1] = M(op[1]); const a0 = 180 - op[5], a1 = 180 - op[4]; op[4] = a0; op[5] = a1; break; }
    case 'p': for (let i = 0; i < op[1].length; i += 2) op[1][i] = M(op[1][i]); break;
    default: break;
  }
  roundOp(op);
}
/** Eckpunkte/Endpunkte zum Fangen. */
function snapPoints(op) {
  const h = handles(op);
  if (op[0] === 'c') return [[op[1], op[2]], [op[1] + op[3], op[2]], [op[1] - op[3], op[2]], [op[1], op[2] + op[3]], [op[1], op[2] - op[3]]];
  if (op[0] === 'l' || op[0] === 'd') h.push([(op[1] + op[3]) / 2, (op[2] + op[4]) / 2]);
  return h;
}

// ---------------------------------------------------------------- Zeichnen
function drawOps(ctx, ops, color, s, opt = {}) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = Math.min(LW, 2.2 / s) * (opt.bold ? 1.8 : 1); // dünn genug zum genauen Arbeiten
  const F = (f) => (!f ? null : f === 'w' ? '#ffffff' : typeof f === 'string' && f[0] === '#' ? f : color);
  for (const op of ops) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash([]);
    switch (op[0]) {
      case 'l': case 'd':
        if (op[0] === 'd') ctx.setLineDash([1.2, 1]);
        ctx.beginPath(); ctx.moveTo(op[1], op[2]); ctx.lineTo(op[3], op[4]); ctx.stroke(); break;
      case 'r': ctx.beginPath(); ctx.rect(op[1], op[2], op[3], op[4]); if (F(op[5])) { ctx.fillStyle = F(op[5]); ctx.fill(); } ctx.stroke(); break;
      case 'b': ctx.fillStyle = opt.sel ? 'rgba(106,92,255,.35)' : op[5] || '#dddddd'; ctx.fillRect(op[1], op[2], op[3], op[4]); if (opt.sel) { ctx.strokeRect(op[1], op[2], op[3], op[4]); } break;
      case 'c': ctx.beginPath(); ctx.arc(op[1], op[2], op[3], 0, Math.PI * 2); if (F(op[4])) { ctx.fillStyle = F(op[4]); ctx.fill(); } ctx.stroke(); break;
      case 'a': { const p = arcPts(op); ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.stroke(); break; }
      case 'p': {
        const p = op[1]; if (p.length < 2) break;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        if (op[2]) ctx.closePath();
        if (F(op[3])) { ctx.fillStyle = F(op[3]); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 't': {
        const size = op[4] || 3;
        ctx.font = `${size}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
        ctx.textAlign = op[5] || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = opt.sel ? color : op[6] || color;
        ctx.fillText(op[3], op[1], op[2]);
        break;
      }
      default: break;
    }
  }
}

/**
 * Editor öffnen. def: { id, name, prefix, val, kind, pins, ops }.
 * Rückgabe: Promise<{ action:'save', def, applyAll? } | { action:'del' } | null>
 */
export function openSymbolEditor({ def: src, title = 'Bauteil-Editor', canDelete = false, fromBuiltin = '', fromPart = false }) {
  return new Promise((resolve) => {
    const def = JSON.parse(JSON.stringify(src));
    def.ops = def.ops || []; def.pins = def.pins || [];
    let tool = 'select';
    let grid = 1.25;
    let fill = false, dashed = false, textSize = 3;
    let sel = new Set(); // 'o3', 'p1'
    const undo = [], redo = [];
    let draft = null; // laufende Aktion
    let hover = null;
    const view = { s: 8, ox: 0, oy: 0 };

    // ------------------------------------------------ DOM
    const cv = el('canvas', { class: 'sx-canvas' });
    const ctx = cv.getContext('2d');
    const stage = el('div', { class: 'sx-stage' }, cv);
    const hint = el('div', { class: 'sx-hint' });
    stage.append(hint);
    const toolBtns = new Map();
    const toolbar = el('div', { class: 'sx-tools' });
    for (const [k, t] of TOOLS) {
      const b = el('button', { class: 'sx-tb', title: t, 'aria-label': t, html: NS_ICON(IC[k]) });
      b.addEventListener('click', () => setTool(k));
      toolBtns.set(k, b); toolbar.append(b);
    }
    const nameInp = el('input', { class: 'inp sx-name', type: 'text', value: def.name || '', placeholder: 'Name des Bauteils, z. B. Lichtschranke' });
    const ib = (k, t, fn) => { const b = el('button', { class: 'sx-ib', title: t, 'aria-label': t, html: NS_ICON(IC[k]) }); b.addEventListener('click', fn); return b; };
    const undoBtn = ib('undo', 'Rückgängig (⌘Z)', () => doUndo());
    const redoBtn = ib('redo', 'Wiederholen (⇧⌘Z)', () => doRedo());
    const head = el('div', { class: 'sx-head' },
      el('button', { class: 'btn', onclick: () => close(null) }, 'Abbrechen'),
      el('div', { class: 'sx-title' }, el('b', null, title), nameInp),
      undoBtn, redoBtn, ib('fit', 'Einpassen', () => { fit(); paint(); }),
      el('button', { class: 'btn primary', onclick: () => save() }, 'Speichern'));
    const opts = el('div', { class: 'sx-opts' });
    const side = el('div', { class: 'sx-side' });
    const root = el('div', { class: 'sx-root' }, head, el('div', { class: 'sx-body' }, toolbar, el('div', { class: 'sx-center' }, opts, stage), side));
    document.body.append(root);
    requestAnimationFrame(() => root.classList.add('show'));

    // ------------------------------------------------ Bauteil-Eigenschaften (rechts)
    const prefix = el('input', { class: 'inp', type: 'text', value: def.prefix || '', placeholder: 'z. B. B', maxlength: '3' });
    const val = el('input', { class: 'inp', type: 'text', value: def.val || '', placeholder: 'optional' });
    const kindSel = el('select', { class: 'inp' }, [['', 'Allgemein'], ['no', 'Schließer (Kontakt)'], ['nc', 'Öffner (Kontakt)'], ['co', 'Wechsler (Kontakt)'], ['coil', 'Spule (Kontaktspiegel)']].map(([v, l]) => el('option', { value: v, selected: (def.kind || '') === v ? true : null }, l)));
    const tplSel = el('select', { class: 'inp' }, el('option', { value: '' }, 'Vorlage einfügen …'),
      Object.entries(allSymbols()).filter(([k, v]) => !k.startsWith('__') && v.ops && v.kind !== 'cab').map(([k, v]) => el('option', { value: k }, `${v.cat}: ${v.name}`)));
    tplSel.addEventListener('change', () => {
      const t = getSym(tplSel.value); tplSel.value = '';
      if (!t) return;
      push();
      const n0 = def.ops.length;
      def.ops.push(...JSON.parse(JSON.stringify(t.ops)));
      for (const p of t.pins) def.pins.push([...p]);
      if (!nameInp.value) nameInp.value = t.name + ' (eigen)';
      if (!prefix.value) prefix.value = t.prefix || '';
      sel = new Set(def.ops.slice(n0).map((_, i) => 'o' + (n0 + i)));
      changed();
    });
    const applyAll = el('input', { type: 'checkbox', class: 'switch' });
    const fld = (l, n) => el('label', { class: 'sx-fld' }, el('span', null, l), n);
    const partBox = el('div', { class: 'sx-sec' }, el('h4', null, 'Bauteil'),
      fld('Kennbuchstabe (BMK)', prefix), fld('Art', kindSel), fld('Standardwert', val), fld('Vorlage', tplSel),
      fromPart ? el('label', { class: 'sx-row' }, applyAll, el('span', null, 'Alle gleichen Bauteile im Plan ersetzen')) : null,
      fromBuiltin ? el('p', { class: 'sx-note' }, `Kopie von „${fromBuiltin}“ – wird als eigenes Bauteil gespeichert.`) : null);
    const selBox = el('div', { class: 'sx-sec' });
    const pinBox = el('div', { class: 'sx-sec' });
    side.append(...[selBox, pinBox, partBox,
      canDelete ? el('button', { class: 'btn danger sx-delbtn', onclick: async () => { if (await confirm('Bauteil löschen?', `„${def.name}“ aus deiner Bibliothek entfernen? Bereits gezeichnete Pläne behalten es.`, 'Löschen', true)) close({ action: 'del' }); } }, 'Bauteil löschen') : null].filter(Boolean));

    // ------------------------------------------------ Zustand / Verlauf
    const snapState = () => JSON.stringify({ ops: def.ops, pins: def.pins });
    function push() { undo.push(snapState()); if (undo.length > 200) undo.shift(); redo.length = 0; }
    function restore(s) { const o = JSON.parse(s); def.ops = o.ops; def.pins = o.pins; sel = new Set(); changed(); }
    function doUndo() { if (draft && draft.kind === 'pl') { draft = null; paint(); return; } const s = undo.pop(); if (!s) return; redo.push(snapState()); restore(s); }
    function doRedo() { const s = redo.pop(); if (!s) return; undo.push(snapState()); restore(s); }
    function changed() { paint(); panels(); undoBtn.disabled = !undo.length; redoBtn.disabled = !redo.length; }

    function setTool(k) {
      if (draft && draft.kind === 'pl') finishPoly();
      tool = k; draft = null;
      if (k !== 'select') sel = new Set();
      toolBtns.forEach((b, kk) => b.classList.toggle('on', kk === k));
      opts.replaceChildren(...optionBar());
      const H = {
        select: 'Antippen = auswählen · Ziehen = verschieben · Griffe ziehen = Form ändern · leere Fläche ziehen = Rahmen-Auswahl',
        l: 'Ziehen – oder Anfang und Ende antippen. Endpunkte rasten an anderen Linien ein.',
        pl: 'Punkte nacheinander antippen · ersten Punkt antippen = schließen · letzten Punkt erneut antippen = fertig',
        r: 'Ziehen – oder zwei Ecken antippen', c: 'Mitte antippen/ziehen bis zum Radius',
        a: 'Mitte antippen, dann Anfang des Bogens, dann Ende (im Uhrzeigersinn)',
        free: 'Mit Stift oder Finger frei zeichnen – wird automatisch geglättet', t: 'Antippen, wo der Text stehen soll',
        pin: 'Anschluss antippen (rastet im 5-mm-Raster) – dort werden im Plan die Leitungen angeschlossen',
        erase: 'Über Linien wischen = löschen · Freihandlinien werden nur teilweise radiert',
      };
      hint.textContent = H[k] || '';
      panels(); paint();
    }

    function optionBar() {
      const out = [];
      const seg = (items, cur, fn) => { const w = el('div', { class: 'seg' }); for (const [v, l] of items) { const b = el('button', { type: 'button', class: v === cur ? 'on' : '' }, l); b.addEventListener('click', () => { w.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); fn(v); }); w.append(b); } return w; };
      out.push(el('span', { class: 'sx-lab' }, 'Raster'), seg([[0.5, '0,5'], [1.25, '1,25'], [2.5, '2,5'], [5, '5 mm']], grid, (v) => { grid = v; paint(); }));
      if (['l', 'pl'].includes(tool)) out.push(seg([[false, '— durchgezogen'], [true, '- - gestrichelt']], dashed, (v) => { dashed = v; }));
      if (['r', 'c', 'pl'].includes(tool)) out.push(el('span', { class: 'sx-lab' }, 'Füllung'), seg([[false, 'keine'], ['w', 'weiß'], [true, 'schwarz']], fill, (v) => { fill = v; }));
      if (tool === 't') out.push(el('span', { class: 'sx-lab' }, 'Größe'), seg([[2, '2'], [2.5, '2,5'], [3, '3'], [4, '4'], [5, '5 mm']], textSize, (v) => { textSize = v; }));
      if (tool === 'select') {
        const act = (k, t, fn) => ib(k, t, fn);
        out.push(act('dup', 'Duplizieren (⌘D)', () => duplicate()), act('rot', 'Auswahl drehen 90°', () => transformSel('rot')), act('mir', 'Auswahl spiegeln', () => transformSel('mir')),
          act('front', 'Nach vorne', () => reorder(1)), act('back', 'Nach hinten', () => reorder(-1)), act('del', 'Löschen (Entf)', () => deleteSel()),
          act('center', 'Ganzes Bauteil auf den Ursprung zentrieren', () => centerAll()),
          el('button', { class: 'ctx-btn', type: 'button', onclick: () => { sel = new Set([...def.ops.map((_, i) => 'o' + i), ...def.pins.map((_, i) => 'p' + i)]); changed(); } }, 'Alles'));
      }
      return out;
    }

    // ------------------------------------------------ Ansicht
    function resize() {
      const r = stage.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d);
      cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      view.d = d; view.W = r.width; view.H = r.height;
    }
    function bboxAll() {
      let x0 = -10, y0 = -10, x1 = 10, y1 = 10;
      for (const op of def.ops) { const b = opBox(op); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
      for (const [x, y] of def.pins) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return { x0, y0, x1, y1 };
    }
    function fit() {
      const b = bboxAll();
      const w = b.x1 - b.x0 + 16, h = b.y1 - b.y0 + 16;
      view.s = Math.max(2, Math.min(40, Math.min(view.W / w, view.H / h)));
      view.ox = view.W / 2 - ((b.x0 + b.x1) / 2) * view.s;
      view.oy = view.H / 2 - ((b.y0 + b.y1) / 2) * view.s;
    }
    const toMm = (sx, sy) => [(sx - view.ox) / view.s, (sy - view.oy) / view.s];

    // ------------------------------------------------ Fangen
    function snap(x, y, { grid: g = grid, objects = true, skip = null } = {}) {
      if (objects) {
        let best = null, bd = 9 / view.s;
        def.ops.forEach((op, i) => {
          if (skip && skip.has('o' + i)) return;
          for (const [px, py] of snapPoints(op)) { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = [px, py]; } }
        });
        def.pins.forEach(([px, py], i) => { if (skip && skip.has('p' + i)) return; const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = [px, py]; } });
        if (best) return [R2(best[0]), R2(best[1]), true];
      }
      return [R2(Math.round(x / g) * g), R2(Math.round(y / g) * g), false];
    }

    // ------------------------------------------------ Darstellung
    function paint() {
      const d = view.d || 1, s = view.s;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(d * s, 0, 0, d * s, d * view.ox, d * view.oy);
      // Raster
      const [ax, ay] = toMm(0, 0), [bx, by] = toMm(view.W, view.H);
      let g = grid; while (g * s < 6) g *= 2;
      ctx.fillStyle = 'rgba(60,80,120,.28)';
      const r0 = 0.9 / s;
      for (let y = Math.floor(ay / g) * g; y <= by; y += g) for (let x = Math.floor(ax / g) * g; x <= bx; x += g) {
        const big = Math.abs(x % 5) < 1e-6 && Math.abs(y % 5) < 1e-6;
        const r = big ? r0 * 1.8 : r0;
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      // Ursprung (Einfügepunkt)
      ctx.strokeStyle = 'rgba(106,92,255,.55)'; ctx.lineWidth = 1 / s;
      ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke();
      // Elemente
      drawOps(ctx, def.ops, INK, s);
      const selOps = def.ops.filter((_, i) => sel.has('o' + i));
      if (selOps.length) drawOps(ctx, selOps, SEL, s, { sel: true, bold: true });
      // Anschlüsse
      def.pins.forEach(([x, y, n], i) => {
        const on = sel.has('p' + i);
        ctx.fillStyle = on ? SEL : PIN;
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, 4 / s), 0, Math.PI * 2); ctx.fill();
        ctx.font = `600 ${Math.max(2, 11 / s)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(n || '', x + 6 / s, y - 3 / s);
      });
      // Entwurf
      if (draft && draft.preview) drawOps(ctx, [draft.preview], SEL, s);
      if (draft && draft.kind === 'pl' && draft.pts.length) {
        ctx.fillStyle = SEL;
        for (let i = 0; i < draft.pts.length; i += 2) { ctx.beginPath(); ctx.arc(draft.pts[i], draft.pts[i + 1], 3 / s, 0, 7); ctx.fill(); }
      }
      if (draft && draft.kind === 'a' && draft.c) { ctx.fillStyle = SEL; ctx.beginPath(); ctx.arc(draft.c[0], draft.c[1], 3 / s, 0, 7); ctx.fill(); }
      if (draft && draft.kind === 'tap1') { ctx.fillStyle = SEL; ctx.beginPath(); ctx.arc(draft.a[0], draft.a[1], 3 / s, 0, 7); ctx.fill(); }
      // Griffe
      const one = single();
      if (one && one.op) {
        handles(one.op).forEach(([x, y]) => {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = SEL; ctx.lineWidth = 1.5 / s;
          ctx.beginPath(); ctx.rect(x - 4.5 / s, y - 4.5 / s, 9 / s, 9 / s); ctx.fill(); ctx.stroke();
        });
      }
      // Rahmen-Auswahl
      if (draft && draft.kind === 'box') {
        ctx.strokeStyle = SEL; ctx.lineWidth = 1 / s; ctx.setLineDash([4 / s, 3 / s]);
        ctx.fillStyle = 'rgba(106,92,255,.08)';
        const [x0, y0] = draft.a, [x1, y1] = draft.b;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
      }
      // Fangpunkt / Radierer
      if (hover) {
        ctx.strokeStyle = hover.snap ? '#30b158' : 'rgba(106,92,255,.6)'; ctx.lineWidth = 1.5 / s;
        if (tool === 'erase') { ctx.beginPath(); ctx.arc(hover.x, hover.y, eraseR(), 0, 7); ctx.stroke(); }
        else if (tool !== 'select') { const k = 5 / s; ctx.beginPath(); ctx.moveTo(hover.x - k, hover.y); ctx.lineTo(hover.x + k, hover.y); ctx.moveTo(hover.x, hover.y - k); ctx.lineTo(hover.x, hover.y + k); ctx.stroke(); if (hover.snap) { ctx.beginPath(); ctx.rect(hover.x - k, hover.y - k, 2 * k, 2 * k); ctx.stroke(); } }
      }
    }
    const eraseR = () => 12 / view.s;

    // ------------------------------------------------ Auswahl & Treffer
    function single() {
      if (sel.size !== 1) return null;
      const k = [...sel][0];
      const i = +k.slice(1);
      return k[0] === 'o' ? { op: def.ops[i], i } : { pin: def.pins[i], i };
    }
    function hitAt(x, y) {
      const tol = 10 / view.s;
      let best = null, bd = tol;
      def.pins.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = 'p' + i; } });
      if (best) return best;
      for (let i = def.ops.length - 1; i >= 0; i--) { const d = opDist(def.ops[i], x, y); if (d < bd) { bd = d; best = 'o' + i; } }
      return best;
    }
    function handleAt(x, y) {
      const one = single();
      if (!one || !one.op) return -1;
      const tol = 12 / view.s;
      const h = handles(one.op);
      for (let i = 0; i < h.length; i++) if (Math.hypot(h[i][0] - x, h[i][1] - y) < tol) return i;
      return -1;
    }

    // ------------------------------------------------ Bearbeiten
    function deleteSel() {
      if (!sel.size) return;
      push();
      const oi = new Set([...sel].filter((k) => k[0] === 'o').map((k) => +k.slice(1)));
      const pi = new Set([...sel].filter((k) => k[0] === 'p').map((k) => +k.slice(1)));
      def.ops = def.ops.filter((_, i) => !oi.has(i));
      def.pins = def.pins.filter((_, i) => !pi.has(i));
      sel = new Set(); changed();
    }
    function selCenter() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const k of sel) {
        const i = +k.slice(1);
        if (k[0] === 'o') { const b = opBox(def.ops[i]); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
        else { const [x, y] = def.pins[i]; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      return [Math.round((x0 + x1) / 2 / grid) * grid, Math.round((y0 + y1) / 2 / grid) * grid];
    }
    function transformSel(kind) {
      if (!sel.size) { sel = new Set([...def.ops.map((_, i) => 'o' + i), ...def.pins.map((_, i) => 'p' + i)]); }
      push();
      const [cx, cy] = selCenter();
      for (const k of sel) {
        const i = +k.slice(1);
        if (k[0] === 'o') (kind === 'rot' ? rotOp(def.ops[i], cx, cy) : mirOp(def.ops[i], cx));
        else { const p = def.pins[i]; if (kind === 'rot') { const x = p[0], y = p[1]; p[0] = R2(cx - (y - cy)); p[1] = R2(cy + (x - cx)); } else p[0] = R2(2 * cx - p[0]); }
      }
      changed();
    }
    function duplicate() {
      if (!sel.size) return;
      push();
      const ns = new Set();
      for (const k of sel) {
        const i = +k.slice(1);
        if (k[0] === 'o') { const op = JSON.parse(JSON.stringify(def.ops[i])); moveOp(op, 5, 5); def.ops.push(op); ns.add('o' + (def.ops.length - 1)); }
        else { const p = def.pins[i]; def.pins.push([p[0] + 5, p[1] + 5, nextPinName()]); ns.add('p' + (def.pins.length - 1)); }
      }
      sel = ns; changed();
    }
    function reorder(dir) {
      const idx = [...sel].filter((k) => k[0] === 'o').map((k) => +k.slice(1));
      if (!idx.length) return;
      push();
      const picked = idx.sort((a, b) => a - b).map((i) => def.ops[i]);
      const rest = def.ops.filter((_, i) => !idx.includes(i));
      def.ops = dir > 0 ? [...rest, ...picked] : [...picked, ...rest];
      const start = dir > 0 ? rest.length : 0;
      sel = new Set(picked.map((_, j) => 'o' + (start + j)));
      changed();
    }
    function centerAll() {
      const b = bboxAll();
      const dx = -Math.round((b.x0 + b.x1) / 2 / 5) * 5, dy = -Math.round((b.y0 + b.y1) / 2 / 5) * 5;
      if (!dx && !dy) return;
      push();
      for (const op of def.ops) moveOp(op, dx, dy);
      for (const p of def.pins) { p[0] = R2(p[0] + dx); p[1] = R2(p[1] + dy); }
      changed();
    }
    function nextPinName() {
      const nums = def.pins.map((p) => parseInt(p[2], 10)).filter((n) => !isNaN(n));
      return String(nums.length ? Math.max(...nums) + 1 : 1);
    }
    function finishPoly(close) {
      const p = draft && draft.pts;
      draft = null;
      if (p && p.length >= 4) {
        push();
        if (p.length === 4 && !close) def.ops.push([dashed ? 'd' : 'l', p[0], p[1], p[2], p[3]]);
        else def.ops.push(['p', p.slice(), !!close, close ? fill : false]);
      }
      changed();
    }
    /** Radieren: ganze Elemente löschen, Freihandlinien an der Stelle auftrennen. */
    function eraseAt(x, y) {
      const r = eraseR();
      let hit = false;
      const ops = [];
      for (const op of def.ops) {
        if (op[0] === 'p' && !op[2] && op[1].length > 4) {
          const p = op[1]; const parts = []; let cur = [];
          for (let i = 0; i < p.length; i += 2) {
            if (Math.hypot(p[i] - x, p[i + 1] - y) <= r) { hit = true; if (cur.length >= 4) parts.push(cur); cur = []; }
            else cur.push(p[i], p[i + 1]);
          }
          if (cur.length >= 4) parts.push(cur);
          if (parts.length === 1 && parts[0].length === p.length) { ops.push(op); continue; }
          for (const q of parts) ops.push(['p', q, false, false]);
          continue;
        }
        if (opDist(op, x, y) <= r) { hit = true; continue; }
        ops.push(op);
      }
      const pins = def.pins.filter(([px, py]) => { const k = Math.hypot(px - x, py - y) <= r; if (k) hit = true; return !k; });
      if (hit) { def.ops = ops; def.pins = pins; return true; }
      return false;
    }

    // ------------------------------------------------ Eigenschaften (rechts)
    function num(v, fn, step = 0.25) {
      const i = el('input', { class: 'inp sx-num', type: 'number', step: String(step), value: String(R2(v)) });
      i.addEventListener('change', () => { const n = parseFloat(String(i.value).replace(',', '.')); if (isFinite(n)) { push(); fn(n); changed(); } });
      return i;
    }
    function panels() {
      // Auswahl
      const one = single();
      const rows = [];
      if (!sel.size) rows.push(el('p', { class: 'sx-note' }, tool === 'select' ? 'Nichts ausgewählt. Element antippen oder einen Rahmen ziehen.' : 'Zeichne mit dem gewählten Werkzeug.'));
      else if (one && one.op) {
        const op = one.op;
        const t = op[0];
        rows.push(el('div', { class: 'sx-type' }, NAMES[t] || t));
        const grid2 = (...kids) => el('div', { class: 'sx-grid2' }, ...kids);
        const f = (l, n) => el('label', { class: 'sx-f' }, el('span', null, l), n);
        if (t === 'l' || t === 'd') {
          rows.push(grid2(f('X1', num(op[1], (v) => { op[1] = v; })), f('Y1', num(op[2], (v) => { op[2] = v; })), f('X2', num(op[3], (v) => { op[3] = v; })), f('Y2', num(op[4], (v) => { op[4] = v; }))));
          rows.push(el('label', { class: 'sx-row' }, toggleEl(t === 'd', (v) => { op[0] = v ? 'd' : 'l'; }), el('span', null, 'gestrichelt (Wirkverbindung)')));
        } else if (t === 'r' || t === 'b') {
          rows.push(grid2(f('X', num(op[1], (v) => { op[1] = v; })), f('Y', num(op[2], (v) => { op[2] = v; })), f('Breite', num(op[3], (v) => { op[3] = Math.max(0.1, v); })), f('Höhe', num(op[4], (v) => { op[4] = Math.max(0.1, v); }))));
          if (t === 'r') rows.push(fillSel(op[5], (v) => { op[5] = v; }));
          else { const c = el('input', { type: 'color', value: op[5] || '#dddddd', class: 'sx-color' }); c.addEventListener('change', () => { push(); op[5] = c.value; changed(); }); rows.push(f('Farbe', c)); }
        } else if (t === 'c') {
          rows.push(grid2(f('Mitte X', num(op[1], (v) => { op[1] = v; })), f('Mitte Y', num(op[2], (v) => { op[2] = v; })), f('Radius', num(op[3], (v) => { op[3] = Math.max(0.2, v); }))));
          rows.push(fillSel(op[4], (v) => { op[4] = v; }));
        } else if (t === 'a') {
          rows.push(grid2(f('Mitte X', num(op[1], (v) => { op[1] = v; })), f('Mitte Y', num(op[2], (v) => { op[2] = v; })), f('Radius', num(op[3], (v) => { op[3] = Math.max(0.2, v); })),
            f('Start °', num(norm360(op[4]), (v) => { const sw = op[5] - op[4]; op[4] = v; op[5] = v + sw; }, 15)), f('Winkel °', num(op[5] - op[4], (v) => { op[5] = op[4] + Math.max(1, Math.min(360, v)); }, 15))));
          rows.push(el('button', { class: 'ctx-btn', type: 'button', onclick: () => { push(); const a0 = op[5], a1 = op[4] + 360; op[4] = R2(norm360(a0)); op[5] = R2(op[4] + (a1 - a0)); changed(); } }, 'Andere Seite des Kreises'));
        } else if (t === 'p') {
          rows.push(el('div', { class: 'sx-note' }, `${op[1].length / 2} Punkte`));
          rows.push(el('label', { class: 'sx-row' }, toggleEl(!!op[2], (v) => { op[2] = v; if (!v) op[3] = false; }), el('span', null, 'geschlossen')));
          if (op[2]) rows.push(fillSel(op[3], (v) => { op[3] = v; }));
          rows.push(el('button', { class: 'ctx-btn', type: 'button', onclick: () => { push(); op[1] = rdp(op[1], 0.4); changed(); } }, 'Glätten / vereinfachen'));
        } else if (t === 't') {
          const ti = el('input', { class: 'inp', type: 'text', value: op[3] });
          ti.addEventListener('change', () => { push(); op[3] = ti.value || ' '; changed(); });
          rows.push(f('Text', ti));
          rows.push(grid2(f('X', num(op[1], (v) => { op[1] = v; })), f('Y', num(op[2], (v) => { op[2] = v; })), f('Größe mm', num(op[4] || 3, (v) => { op[4] = Math.max(1, v); }, 0.5))));
          const al = el('div', { class: 'seg' }, [['left', 'links'], ['center', 'mittig'], ['right', 'rechts']].map(([v, l]) => { const b = el('button', { type: 'button', class: (op[5] || 'center') === v ? 'on' : '' }, l); b.addEventListener('click', () => { push(); op[5] = v; changed(); }); return b; }));
          rows.push(al);
        }
      } else if (one && one.pin) {
        const p = one.pin;
        rows.push(el('div', { class: 'sx-type' }, 'Anschluss'));
        const ni = el('input', { class: 'inp', type: 'text', value: p[2] || '', placeholder: 'z. B. 13, A1, L+' });
        ni.addEventListener('input', () => { p[2] = ni.value.trim(); paint(); renderPins(); });
        ni.addEventListener('change', () => { push(); });
        rows.push(el('label', { class: 'sx-f' }, el('span', null, 'Bezeichnung'), ni));
        rows.push(el('div', { class: 'sx-grid2' }, el('label', { class: 'sx-f' }, el('span', null, 'X'), num(p[0], (v) => { p[0] = v; }, 5)), el('label', { class: 'sx-f' }, el('span', null, 'Y'), num(p[1], (v) => { p[1] = v; }, 5))));
        if (p[0] % 5 || p[1] % 5) rows.push(el('p', { class: 'sx-warn' }, 'Liegt nicht im 5-mm-Raster – Leitungen lassen sich dann schlecht anschließen.'));
      } else rows.push(el('div', { class: 'sx-type' }, `${sel.size} Elemente ausgewählt`));
      if (sel.size) rows.push(el('div', { class: 'sx-acts' },
        ib('dup', 'Duplizieren', duplicate), ib('rot', 'Drehen 90°', () => transformSel('rot')), ib('mir', 'Spiegeln', () => transformSel('mir')), ib('del', 'Löschen', deleteSel)));
      selBox.replaceChildren(el('h4', null, 'Auswahl'), ...rows);
      renderPins();
    }
    function renderPins() {
      const list = el('div', { class: 'sx-pins' });
      def.pins.forEach((p, i) => {
        const inp = el('input', { class: 'inp', type: 'text', value: p[2] || '', placeholder: String(i + 1) });
        inp.addEventListener('focus', () => { sel = new Set(['p' + i]); paint(); });
        inp.addEventListener('input', () => { p[2] = inp.value.trim(); paint(); });
        const del = el('button', { class: 'sx-x', title: 'Anschluss löschen', 'aria-label': 'Anschluss löschen' }, '×');
        del.addEventListener('click', () => { push(); def.pins.splice(i, 1); sel = new Set(); changed(); });
        list.append(el('div', { class: 'sx-pin' }, el('span', { class: 'sx-dot' }), el('small', null, `${R2(p[0])} / ${R2(p[1])}`), inp, del));
      });
      if (!def.pins.length) list.append(el('p', { class: 'sx-note' }, 'Noch keine Anschlüsse. Werkzeug „Anschluss“ wählen und antippen.'));
      pinBox.replaceChildren(el('h4', null, `Anschlüsse (${def.pins.length})`), list);
    }
    function toggleEl(v, fn) { const i = el('input', { type: 'checkbox', class: 'switch' }); i.checked = !!v; i.addEventListener('change', () => { push(); fn(i.checked); changed(); }); return i; }
    function fillSel(cur, fn) {
      const w = el('div', { class: 'seg' }, [[false, 'keine Füllung'], ['w', 'weiß'], [true, 'schwarz']].map(([v, l]) => {
        const b = el('button', { type: 'button', class: (cur || false) === v ? 'on' : '' }, l);
        b.addEventListener('click', () => { push(); fn(v); changed(); });
        return b;
      }));
      return w;
    }

    // ------------------------------------------------ Eingabe
    const pts = new Map();
    let pinch = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      const [sx, sy] = pos(e);
      pts.set(e.pointerId, { sx, sy, type: e.pointerType });
      const touches = [...pts.values()].filter((p) => p.type === 'touch');
      if (touches.length >= 2) {
        // zwei Finger: verschieben / zoomen, laufende Aktion abbrechen
        if (draft && draft.kind !== 'pl' && draft.kind !== 'a' && draft.kind !== 'tap1') { if (draft.pushed) { const s = undo.pop(); if (s) restore(s); } draft = null; }
        const [a, b] = touches;
        pinch = { d: Math.hypot(b.sx - a.sx, b.sy - a.sy) || 1, s: view.s, mx: (a.sx + b.sx) / 2, my: (a.sy + b.sy) / 2, ox: view.ox, oy: view.oy };
        paint();
        return;
      }
      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) { pinch = { pan: true, sx, sy, ox: view.ox, oy: view.oy }; return; }
      down(sx, sy, e);
    });
    cv.addEventListener('pointermove', (e) => {
      const [sx, sy] = pos(e);
      const p = pts.get(e.pointerId);
      if (p) { p.sx = sx; p.sy = sy; }
      if (pinch) {
        if (pinch.pan) { view.ox = pinch.ox + sx - pinch.sx; view.oy = pinch.oy + sy - pinch.sy; paint(); return; }
        const touches = [...pts.values()].filter((q) => q.type === 'touch');
        if (touches.length >= 2) {
          const [a, b] = touches;
          const d = Math.hypot(b.sx - a.sx, b.sy - a.sy) || 1;
          const s = Math.max(1.5, Math.min(60, pinch.s * (d / pinch.d)));
          const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2;
          view.ox = mx - ((pinch.mx - pinch.ox) * s) / pinch.s;
          view.oy = my - ((pinch.my - pinch.oy) * s) / pinch.s;
          view.s = s;
          paint();
        }
        return;
      }
      move(sx, sy, !!p, e);
    });
    const up = (e) => {
      const had = pts.delete(e.pointerId);
      if (pinch) { if (![...pts.values()].some((q) => q.type === 'touch') || pinch.pan) pinch = null; return; }
      if (!had) return;
      const [sx, sy] = pos(e);
      upAt(sx, sy, e.type === 'pointercancel');
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !pts.size) { hover = null; paint(); } });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = pos(e);
      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(-e.deltaY * 0.01), s = Math.max(1.5, Math.min(60, view.s * f));
        view.ox = sx - ((sx - view.ox) * s) / view.s; view.oy = sy - ((sy - view.oy) * s) / view.s; view.s = s;
      } else { view.ox -= e.deltaX; view.oy -= e.deltaY; }
      paint();
    }, { passive: false });
    cv.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    let last = { t: 0, x: 0, y: 0 };
    function down(sx, sy, e) {
      const [x, y] = toMm(sx, sy);
      const shift = e.shiftKey;
      if (tool === 'select') {
        const h = handleAt(x, y);
        if (h >= 0) { draft = { kind: 'handle', h, i: single().i, moved: false }; return; }
        const k = hitAt(x, y);
        if (k) {
          if (shift) { if (sel.has(k)) sel.delete(k); else sel.add(k); }
          else if (!sel.has(k)) sel = new Set([k]);
          // Doppeltippen auf Text = Text ändern
          const now = performance.now();
          if (k[0] === 'o' && def.ops[+k.slice(1)][0] === 't' && now - last.t < 380 && Math.hypot(sx - last.x, sy - last.y) < 12) editText(+k.slice(1));
          last = { t: now, x: sx, y: sy };
          draft = { kind: 'move', a: [x, y], last: [0, 0], moved: false };
          changed();
          return;
        }
        if (!shift) sel = new Set();
        draft = { kind: 'box', a: [x, y], b: [x, y] };
        changed();
        return;
      }
      if (tool === 'erase') { push(); draft = { kind: 'erase', any: false }; if (eraseAt(x, y)) draft.any = true; changed(); return; }
      if (tool === 'free') { draft = { kind: 'free', raw: [x, y] }; draft.preview = ['p', draft.raw, false, false]; paint(); return; }
      const [gx, gy] = snap(x, y, tool === 'pin' ? { grid: 5, objects: false } : {});
      if (tool === 'pin') { push(); def.pins.push([gx, gy, nextPinName()]); sel = new Set(['p' + (def.pins.length - 1)]); tool = 'pin'; changed(); return; }
      if (tool === 't') { addText(gx, gy); return; }
      if (tool === 'pl') {
        if (!draft || draft.kind !== 'pl') draft = { kind: 'pl', pts: [] };
        const p = draft.pts;
        if (p.length >= 4 && Math.hypot(p[0] - gx, p[1] - gy) < 0.01) { finishPoly(true); return; }
        if (p.length >= 2 && Math.hypot(p[p.length - 2] - gx, p[p.length - 1] - gy) < 0.01) { finishPoly(false); return; }
        p.push(gx, gy);
        draft.preview = ['p', [...p, gx, gy], false, false];
        paint();
        return;
      }
      if (tool === 'a') {
        if (!draft || draft.kind !== 'a') { draft = { kind: 'a', c: [gx, gy] }; paint(); return; }
        if (!draft.s) { draft.s = [gx, gy]; draft.r = Math.hypot(gx - draft.c[0], gy - draft.c[1]); if (draft.r < 0.2) { draft.s = null; } paint(); return; }
        const op = arcFromDraft(gx, gy);
        draft = null;
        if (op) { push(); def.ops.push(op); }
        changed();
        return;
      }
      // Linie, Rechteck, Kreis: ziehen oder zweimal tippen
      if (draft && draft.kind === 'tap1' && draft.tool === tool) { draft.b = [gx, gy]; draft.second = true; return; }
      draft = { kind: 'shape', tool, a: [gx, gy], b: [gx, gy], moved: false };
    }
    function arcFromDraft(x, y) {
      const [cx, cy] = draft.c;
      if (!draft.s) return null;
      const a0 = angDeg(cx, cy, draft.s[0], draft.s[1]);
      let a1 = angDeg(cx, cy, x, y);
      while (a1 <= a0) a1 += 360;
      return ['a', cx, cy, R2(draft.r), R2(a0), R2(a1)];
    }
    function shapeOp(t, a, b) {
      const [x0, y0] = a, [x1, y1] = b;
      if (t === 'l') return [dashed ? 'd' : 'l', x0, y0, x1, y1];
      if (t === 'r') return ['r', Math.min(x0, x1), Math.min(y0, y1), R2(Math.abs(x1 - x0)), R2(Math.abs(y1 - y0)), fill];
      if (t === 'c') return ['c', x0, y0, Math.max(0.3, R2(Math.hypot(x1 - x0, y1 - y0))), fill];
      return null;
    }
    function move(sx, sy, pressed) {
      const [x, y] = toMm(sx, sy);
      if (!pressed || !draft) {
        // Schwebezeiger (Maus/Stift) und Vorschau beim zweiten Tippen
        if (tool === 'erase' || tool === 'select') hover = { x, y };
        else { const [gx, gy, sn] = snap(x, y, tool === 'pin' ? { grid: 5, objects: false } : {}); hover = { x: gx, y: gy, snap: sn }; }
        if (draft && draft.kind === 'tap1') draft.preview = shapeOp(draft.tool, draft.a, [hover.x, hover.y]);
        if (draft && draft.kind === 'pl' && draft.pts.length) draft.preview = ['p', [...draft.pts, hover.x, hover.y], false, false];
        if (draft && draft.kind === 'a' && draft.s) draft.preview = arcFromDraft(hover.x, hover.y);
        else if (draft && draft.kind === 'a') draft.preview = ['c', draft.c[0], draft.c[1], Math.max(0.2, Math.hypot(hover.x - draft.c[0], hover.y - draft.c[1])), false];
        paint();
        return;
      }
      if (draft.kind === 'handle') {
        const one = def.ops[draft.i];
        if (!draft.pushed) { push(); draft.pushed = true; }
        const [gx, gy, sn] = snap(x, y, { skip: new Set(['o' + draft.i]) });
        setHandle(one, draft.h, gx, gy); roundOp(one);
        hover = { x: gx, y: gy, snap: sn };
        paint();
      } else if (draft.kind === 'move') {
        const dx = Math.round((x - draft.a[0]) / grid) * grid, dy = Math.round((y - draft.a[1]) / grid) * grid;
        if (dx === draft.last[0] && dy === draft.last[1]) return;
        if (!draft.pushed) { push(); draft.pushed = true; }
        const ddx = dx - draft.last[0], ddy = dy - draft.last[1];
        draft.last = [dx, dy]; draft.moved = true;
        for (const k of sel) {
          const i = +k.slice(1);
          if (k[0] === 'o') moveOp(def.ops[i], ddx, ddy);
          else { def.pins[i][0] = R2(def.pins[i][0] + ddx); def.pins[i][1] = R2(def.pins[i][1] + ddy); }
        }
        paint();
      } else if (draft.kind === 'box') { draft.b = [x, y]; paint(); }
      else if (draft.kind === 'erase') { hover = { x, y }; if (eraseAt(x, y)) draft.any = true; paint(); }
      else if (draft.kind === 'free') { const r = draft.raw; if (Math.hypot(r[r.length - 2] - x, r[r.length - 1] - y) > 0.15) r.push(R2(x), R2(y)); paint(); }
      else if (draft.kind === 'shape' || (draft.kind === 'tap1' && draft.second)) {
        const [gx, gy, sn] = snap(x, y);
        draft.b = [gx, gy]; hover = { x: gx, y: gy, snap: sn };
        if (Math.hypot(gx - draft.a[0], gy - draft.a[1]) > 0.01) draft.moved = true;
        draft.preview = shapeOp(draft.tool, draft.a, draft.b);
        paint();
      }
    }
    function upAt(sx, sy, cancelled) {
      if (!draft) return;
      const d = draft;
      if (cancelled) { draft = d.kind === 'pl' || d.kind === 'a' || d.kind === 'tap1' ? d : null; paint(); return; }
      if (d.kind === 'handle') { draft = null; changed(); return; }
      if (d.kind === 'move') { draft = null; changed(); return; }
      if (d.kind === 'box') {
        const x0 = Math.min(d.a[0], d.b[0]), x1 = Math.max(d.a[0], d.b[0]), y0 = Math.min(d.a[1], d.b[1]), y1 = Math.max(d.a[1], d.b[1]);
        if (x1 - x0 > 0.5 || y1 - y0 > 0.5) {
          def.ops.forEach((op, i) => { const b = opBox(op); if (b.x0 >= x0 && b.x1 <= x1 && b.y0 >= y0 && b.y1 <= y1) sel.add('o' + i); });
          def.pins.forEach(([px, py], i) => { if (px >= x0 && px <= x1 && py >= y0 && py <= y1) sel.add('p' + i); });
        }
        draft = null; changed(); return;
      }
      if (d.kind === 'erase') { if (!d.any) undo.pop(); draft = null; changed(); return; }
      if (d.kind === 'free') {
        draft = null;
        const p = rdp(d.raw, Math.max(0.12, 1.2 / view.s));
        if (p.length >= 4) { push(); def.ops.push(p.length === 4 ? ['l', ...p] : ['p', p, false, false]); }
        changed(); return;
      }
      if (d.kind === 'shape') {
        if (!d.moved) { draft = { kind: 'tap1', tool: d.tool, a: d.a }; paint(); return; } // erster Tipp – jetzt zweiten Punkt antippen
        finishShape(d);
        return;
      }
      if (d.kind === 'tap1' && d.second) finishShape(d);
    }
    function finishShape(d) {
      draft = null;
      const op = shapeOp(d.tool, d.a, d.b);
      const empty = !op || (op[0] === 'r' && (!op[3] || !op[4])) || ((op[0] === 'l' || op[0] === 'd') && op[1] === op[3] && op[2] === op[4]);
      if (!empty) { push(); def.ops.push(op); }
      changed();
    }
    async function addText(x, y) {
      const t = await prompt('Text im Bauteil', '', { placeholder: 'z. B. M, 3~, A1, ⏚', okLabel: 'Setzen' });
      if (!t) return;
      push();
      def.ops.push(['t', x, y, t, textSize, 'center']);
      sel = new Set(['o' + (def.ops.length - 1)]);
      setTool('select');
    }
    async function editText(i) {
      const op = def.ops[i];
      const t = await prompt('Text ändern', op[3], { okLabel: 'Übernehmen' });
      if (t == null || t === op[3]) return;
      push(); op[3] = t || ' '; changed();
    }

    // ------------------------------------------------ Tastatur
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
      if (mod && k === 'a') { e.preventDefault(); setTool('select'); sel = new Set([...def.ops.map((_, i) => 'o' + i), ...def.pins.map((_, i) => 'p' + i)]); changed(); return; }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); return; }
      if (k === 'escape') { e.preventDefault(); if (draft && draft.kind === 'pl') finishPoly(false); else if (draft) { draft = null; paint(); } else if (sel.size) { sel = new Set(); changed(); } return; }
      if (k === 'enter' && draft && draft.kind === 'pl') { finishPoly(false); return; }
      const map = { v: 'select', l: 'l', p: 'pl', r: 'r', c: 'c', a: 'a', f: 'free', t: 't', k: 'pin', e: 'erase' };
      if (!mod && map[k]) { setTool(map[k]); return; }
      if (sel.size && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
        e.preventDefault(); push();
        const dx = k === 'arrowleft' ? -grid : k === 'arrowright' ? grid : 0, dy = k === 'arrowup' ? -grid : k === 'arrowdown' ? grid : 0;
        for (const kk of sel) { const i = +kk.slice(1); if (kk[0] === 'o') moveOp(def.ops[i], dx, dy); else { def.pins[i][0] = R2(def.pins[i][0] + dx); def.pins[i][1] = R2(def.pins[i][1] + dy); } }
        changed();
      }
    };
    document.addEventListener('keydown', onKey);
    const onResize = () => { resize(); paint(); };
    window.addEventListener('resize', onResize);

    // ------------------------------------------------ Speichern / Schließen
    function save() {
      if (draft && draft.kind === 'pl') finishPoly(false);
      const name = nameInp.value.trim();
      if (!name) { nameInp.focus(); toast('Bitte einen Namen für das Bauteil eingeben'); return; }
      if (!def.ops.length) { toast('Bitte zuerst etwas zeichnen'); return; }
      if (!def.pins.length) toast('Hinweis: Das Bauteil hat keine Anschlusspunkte – Leitungen können nicht angeschlossen werden.', { ms: 4000 });
      Object.assign(def, { name, prefix: prefix.value.trim().replace(/^-/, '').toUpperCase(), val: val.value.trim(), kind: kindSel.value || undefined });
      close({ action: 'save', def, applyAll: applyAll.checked });
    }
    function close(v) {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      root.classList.remove('show');
      setTimeout(() => root.remove(), 180);
      resolve(v);
    }

    // Start
    setTimeout(() => { resize(); fit(); setTool('select'); changed(); }, 30);
  });
}

