// Stromlaufplan-Editor: Blätter mit Schriftfeld, Bauteile nach IEC 60617, Verdrahtung im Raster,
// automatische BMK, Kontaktspiegel & Querverweise, Prüfung, Stückliste, Netzliste, PDF/SVG/PNG.
import { el, uid, clamp, debounce, safeFileName, dateStamp, getSettings, saveSettings } from './util.js';
import { icon } from './icons.js';
import { toast, dialog, menu, prompt, confirm, progress, closePopover, toggle } from './ui.js';
import { openSymbolEditor } from './symed.js';
import { SYMBOLS, CATEGORIES, INSTALL_CATEGORIES, CABINET_CATEGORIES, cab, xf, partPins, partBox, isVertical, drawSymbol, getSym, registerCustom, unregisterCustom, allSymbols } from './schem-symbols.js';
import * as store from './store.js';
import { buildPdf } from './pdfio.js';
import { offerFile } from './editor-ui.js';

export const SHEET_SIZES = { A4: { w: 297, h: 210, cols: 8, rows: 4, label: 'A4 quer' }, A3: { w: 420, h: 297, cols: 10, rows: 6, label: 'A3 quer' } };
const GRID = 5;
const LW = 0.35;
const INK = '#16161a';
const SEL = '#6a5cff';
const FRAME = '#16161a';

export function newSheetData(size = 'A4', title = 'Blatt 1') {
  return { size, parts: [], wires: [], texts: [], ink: [], walls: [], meta: { title, date: new Date().toLocaleDateString('de-DE'), rev: '' } };
}

const snap = (v, g = GRID) => Math.round(v / g) * g;
const round1 = (v) => Math.round(v * 10) / 10;
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const key = (x, y) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
const same = (ax, ay, bx, by) => Math.abs(ax - bx) < 0.01 && Math.abs(ay - by) < 0.01;
const onSeg = (px, py, ax, ay, bx, by) => {
  if (Math.abs(ay - by) < 0.01) return Math.abs(py - ay) < 0.01 && px > Math.min(ax, bx) + 0.01 && px < Math.max(ax, bx) - 0.01;
  if (Math.abs(ax - bx) < 0.01) return Math.abs(px - ax) < 0.01 && py > Math.min(ay, by) + 0.01 && py < Math.max(ay, by) - 0.01;
  return false;
};
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** Linienzug aufräumen: doppelte und gerade Zwischenpunkte entfernen. */
function simplify(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i], y = pts[i + 1], n = out.length;
    if (n >= 2 && same(out[n - 2], out[n - 1], x, y)) continue;
    if (n >= 4) {
      const ax = out[n - 4], ay = out[n - 3], bx = out[n - 2], by = out[n - 1];
      if ((Math.abs(ax - bx) < 0.01 && Math.abs(bx - x) < 0.01) || (Math.abs(ay - by) < 0.01 && Math.abs(by - y) < 0.01)) { out[n - 2] = x; out[n - 1] = y; continue; }
    }
    out.push(x, y);
  }
  return out;
}

/** Endpunkt eines Leitungszugs verschieben und rechtwinklig halten („Gummiband“). */
function moveEnd(pts, atStart, nx, ny) {
  let p = pts.slice();
  if (!atStart) { const r = []; for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]); p = r; }
  const [x0, y0, x1, y1] = p;
  const horiz = Math.abs(y0 - y1) < 0.01;
  if (p.length === 4) {
    // zwei Punkte: Ecke einfügen
    if (horiz) p = [nx, ny, x1, ny, x1, y1]; else p = [nx, ny, nx, y1, x1, y1];
  } else {
    p[0] = nx; p[1] = ny;
    if (horiz) p[3] = ny; else p[2] = nx;
  }
  p = simplify(p);
  if (!atStart) { const r = []; for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]); p = r; }
  return p;
}

/** L-förmige Verbindung von (ax,ay) nach (bx,by). */
function lRoute(ax, ay, bx, by, vertFirst) {
  if (same(ax, ay, bx, by)) return [];
  if (Math.abs(ax - bx) < 0.01 || Math.abs(ay - by) < 0.01) return [bx, by];
  return vertFirst ? [ax, by, bx, by] : [bx, ay, bx, by];
}

// ---------------------------------------------------------------- Stifte (Canvas / SVG)
class CanvasPen {
  constructor(ctx, minLw) { this.ctx = ctx; this.lw = Math.max(LW, minLw || 0); }
  line(x1, y1, x2, y2, color, dash) {
    const c = this.ctx;
    c.strokeStyle = color; c.lineWidth = this.lw;
    if (dash) c.setLineDash([1.2, 1]);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    if (dash) c.setLineDash([]);
  }
  poly(pts, close, fill, stroke, lw) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    if (close) c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = lw || this.lw; c.stroke(); }
  }
  circle(cx, cy, r, fill, stroke) {
    const c = this.ctx;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = this.lw; c.stroke(); }
  }
  text(x, y, s, size, align, color, base = 'alphabetic', bold, rot) {
    const c = this.ctx;
    if (rot) { c.save(); c.translate(x, y); c.rotate(-Math.PI / 2); x = 0; y = 0; }
    c.font = `${bold ? '600 ' : ''}${size}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    c.textAlign = align || 'left'; c.textBaseline = base; c.fillStyle = color;
    c.fillText(s, x, y);
    if (rot) c.restore();
  }
}

class SvgPen {
  constructor() { this.out = []; }
  esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  f(n) { return Math.round(n * 100) / 100; }
  line(x1, y1, x2, y2, color, dash) { this.out.push(`<line x1="${this.f(x1)}" y1="${this.f(y1)}" x2="${this.f(x2)}" y2="${this.f(y2)}" stroke="${color}" stroke-width="${LW}"${dash ? ' stroke-dasharray="1.2 1"' : ''}/>`); }
  poly(pts, close, fill, stroke, lw) {
    const p = []; for (let i = 0; i < pts.length; i += 2) p.push(`${this.f(pts[i])},${this.f(pts[i + 1])}`);
    this.out.push(`<${close ? 'polygon' : 'polyline'} points="${p.join(' ')}" fill="${fill || 'none'}" stroke="${stroke || 'none'}" stroke-width="${lw || LW}" stroke-linejoin="round" stroke-linecap="round"/>`);
  }
  circle(cx, cy, r, fill, stroke) { this.out.push(`<circle cx="${this.f(cx)}" cy="${this.f(cy)}" r="${this.f(r)}" fill="${fill || 'none'}" stroke="${stroke || 'none'}" stroke-width="${LW}"/>`); }
  text(x, y, s, size, align, color, base = 'alphabetic', bold, rot) {
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    const dy = base === 'middle' ? ' dominant-baseline="central"' : '';
    this.out.push(`<text x="${this.f(x)}" y="${this.f(y)}" font-size="${size}" font-family="Arial, Helvetica, sans-serif"${bold ? ' font-weight="600"' : ''} text-anchor="${anchor}"${dy}${rot ? ` transform="rotate(-90 ${this.f(x)} ${this.f(y)})"` : ''} fill="${color}">${this.esc(s)}</text>`);
  }
  svg(w, h) { return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>${this.out.join('')}</svg>`; }
}

// ---------------------------------------------------------------- Auswertung
/**
 * Verbindungen, Verbindungspunkte, Netze, Kontaktnummern, Querverweise und Prüfung über alle Blätter.
 */
export function analyze(sheets) {
  const parent = new Map();
  const find = (a) => { let r = a; while (parent.has(r) && parent.get(r) !== r) r = parent.get(r); let c = a; while (c !== r) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
  const union = (a, b) => { if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const touch = (a) => { if (!parent.has(a)) parent.set(a, a); };
  const junctions = sheets.map(() => []);
  const pinInfo = []; // {s, part, pin, node}
  const dangling = sheets.map(() => []);

  sheets.forEach((sh, s) => {
    const P = (x, y) => `${s}|${key(x, y)}`;
    const ends = new Map(); // key -> count of wire ends
    const pinsAt = new Map();
    const points = []; // Punkte, die T-Abzweige bilden können
    for (const w of sh.wires) {
      const p = w.pts;
      for (let i = 0; i + 2 < p.length; i += 2) union(P(p[i], p[i + 1]), P(p[i + 2], p[i + 3]));
      if (p.length >= 2) touch(P(p[0], p[1]));
      for (const [x, y] of [[p[0], p[1]], [p[p.length - 2], p[p.length - 1]]]) {
        const k = key(x, y);
        ends.set(k, (ends.get(k) || 0) + 1);
        points.push([x, y]);
      }
    }
    for (const part of sh.parts) {
      const sym = getSym(part.type);
      if (!sym) continue;
      for (const pin of partPins(part)) {
        const node = `pin:${part.id}:${pin.i}`;
        union(node, P(pin.x, pin.y));
        const k = key(pin.x, pin.y);
        pinsAt.set(k, (pinsAt.get(k) || 0) + 1);
        points.push([pin.x, pin.y]);
        pinInfo.push({ s, part, pin, node, k });
      }
      if (sym.kind === 'net' && part.ref) union(`net:${part.ref.trim()}`, `pin:${part.id}:0`);
      if (sym.kind === 'gnd') union(`net:${sym.net}`, `pin:${part.id}:0`);
    }
    // T-Abzweige: Endpunkt/Anschluss liegt mitten auf einem Leitungsabschnitt
    const through = new Map();
    for (const w of sh.wires) {
      const p = w.pts;
      for (let i = 0; i + 2 < p.length; i += 2) {
        for (const [x, y] of points) {
          if (onSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3])) {
            union(P(x, y), P(p[i], p[i + 1]));
            const k = key(x, y);
            through.set(k, (through.get(k) || 0) + 2);
          }
        }
      }
    }
    // Verbindungspunkte (nur an Enden/T – nie an bloßen Kreuzungen)
    const seen = new Set();
    for (const [x, y] of points) {
      const k = key(x, y);
      if (seen.has(k)) continue;
      seen.add(k);
      const deg = (ends.get(k) || 0) + (pinsAt.get(k) || 0) + (through.get(k) || 0);
      if (deg >= 3 && (ends.get(k) || 0) > 0) junctions[s].push([x, y]);
      if ((ends.get(k) || 0) === 1 && !(pinsAt.get(k)) && !(through.get(k))) dangling[s].push([x, y]);
    }
    // Anschlüsse ohne Verbindung
    for (const pi of pinInfo.filter((q) => q.s === s)) {
      pi.connected = (ends.get(pi.k) || 0) + (through.get(pi.k) || 0) > 0 || (pinsAt.get(pi.k) || 0) > 1;
    }
  });

  // Netze
  const groups = new Map();
  for (const pi of pinInfo) {
    const r = find(pi.node);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(pi);
  }
  const netName = new Map();
  for (const k of parent.keys()) if (k.startsWith('net:')) { const r = find(k); if (!netName.has(r)) netName.set(r, k.slice(4)); }
  let auto = 0;
  const nets = [];
  for (const [r, list] of groups) {
    const real = list.filter((q) => !['net', 'gnd'].includes(getSym(q.part.type).kind));
    if (!real.length) continue;
    const name = netName.get(r) || `N${++auto}`;
    nets.push({ name, pins: real });
    for (const q of list) q.net = name;
  }

  // Kontaktspiegel & Querverweise
  const col = (sh, x) => {
    const S = SHEET_SIZES[sh.size] || SHEET_SIZES.A4;
    const x0 = 10, cw = (S.w - 15) / S.cols;
    return clamp(Math.floor((x - x0) / cw) + 1, 1, S.cols);
  };
  const loc = (s, part) => `${s + 1}.${col(sheets[s], part.x)}`;
  const coils = new Map();
  const contacts = new Map();
  sheets.forEach((sh, s) => {
    for (const part of sh.parts) {
      const sym = getSym(part.type);
      const ref = (part.ref || '').trim();
      if (!sym || !ref) continue;
      if (sym.kind === 'coil') coils.set(ref, { s, part, loc: loc(s, part) });
      if (['no', 'nc', 'co'].includes(sym.kind)) {
        if (!contacts.has(ref)) contacts.set(ref, []);
        contacts.get(ref).push({ s, part, kind: sym.kind, loc: loc(s, part) });
      }
    }
  });
  const pinLabels = new Map(); // part.id -> [Beschriftungen]
  const mirror = new Map(); // coil part.id -> [{label, loc, kind}]
  const xref = new Map(); // contact part.id -> loc der Spule
  for (const [ref, list] of contacts) {
    list.sort((a, b) => a.s - b.s || a.part.x - b.part.x || a.part.y - b.part.y);
    list.forEach((c, i) => {
      const n = i + 1;
      const labels = c.kind === 'no' ? [`${n}3`, `${n}4`] : c.kind === 'nc' ? [`${n}1`, `${n}2`] : [`${n}1`, `${n}2`, `${n}4`];
      pinLabels.set(c.part.id, labels);
      const coil = coils.get(ref);
      if (coil) {
        xref.set(c.part.id, coil.loc);
        if (!mirror.has(coil.part.id)) mirror.set(coil.part.id, []);
        mirror.get(coil.part.id).push({ label: labels.join('-'), loc: c.loc, kind: c.kind, part: c.part });
      }
    });
  }
  for (const [, c] of coils) pinLabels.set(c.part.id, ['A1', 'A2']);
  // Eigene Anschlussbezeichnungen (z. B. geänderte Kontaktnummern) haben Vorrang
  for (const sh of sheets) for (const part of sh.parts) {
    if (!Array.isArray(part.pl) || !part.pl.some(Boolean)) continue;
    const auto = pinLabels.get(part.id) || [];
    pinLabels.set(part.id, partPins(part).map((pin, i) => part.pl[i] || auto[i] || ''));
  }
  // Kontaktspiegel mit den tatsächlichen Nummern
  for (const [, list] of mirror) for (const e of list) if (e.part) e.label = (pinLabels.get(e.part.id) || []).filter(Boolean).join('-');

  // Prüfung
  const issues = [];
  const refCount = new Map();
  sheets.forEach((sh, s) => {
    for (const part of sh.parts) {
      const sym = getSym(part.type);
      if (!sym) continue;
      const ref = (part.ref || '').trim();
      const quiet = sym.kind === 'deco' || String(sym.cat).startsWith('Installation');
      if (sym.kind !== 'net' && sym.kind !== 'gnd' && !quiet) {
        if (!ref) issues.push({ s, part, text: `${sym.name} ohne Betriebsmittelkennzeichen (BMK)` });
        else if (!['no', 'nc', 'co'].includes(sym.kind)) {
          const k = ref.toLowerCase();
          if (refCount.has(k)) issues.push({ s, part, text: `BMK ${ref} ist doppelt vergeben` });
          refCount.set(k, true);
        }
      }
      if (['no', 'nc', 'co'].includes(sym.kind) && !sym.own && ref && !coils.has(ref) && /^-?[KQ]/i.test(ref)) {
        issues.push({ s, part, text: `Kontakt ${ref}: keine passende Spule gefunden` });
      }
    }
  });
  for (const pi of pinInfo) {
    if (!pi.connected && !['net', 'gnd'].includes(getSym(pi.part.type).kind) && !String(getSym(pi.part.type).cat).startsWith('Installation')) issues.push({ s: pi.s, part: pi.part, text: `${pi.part.ref || getSym(pi.part.type).name}: Anschluss ${pinLabels.get(pi.part.id)?.[pi.pin.i] || pi.pin.name || pi.pin.i + 1} ist nicht verbunden` });
  }
  dangling.forEach((list, s) => list.forEach(([x, y]) => issues.push({ s, at: [x, y], text: 'Offenes Leitungsende' })));
  return { junctions, nets, pinLabels, mirror, xref, issues, loc };
}

// ---------------------------------------------------------------- Blatt zeichnen
function drawWall(pen, w, isSel) {
    const c = isSel ? SEL : '#55555e';
    if (!w.kind || w.kind === 'wall') { pen.poly(w.pts, false, null, c, w.t || 2.4); return; }
    const [ax, ay, bx, by] = w.pts;
    if (w.kind === 'plate') {
      const x0 = Math.min(ax, bx), y0 = Math.min(ay, by), x1 = Math.max(ax, bx), y1 = Math.max(ay, by);
      pen.poly([x0, y0, x1, y0, x1, y1, x0, y1], true, '#f3f4f6', isSel ? SEL : '#6c707a', 0.5);
      const r = Math.min(3, (x1 - x0) * 0.02);
      for (const [hx, hy] of [[x0 + 4 * r, y0 + 4 * r], [x1 - 4 * r, y0 + 4 * r], [x0 + 4 * r, y1 - 4 * r], [x1 - 4 * r, y1 - 4 * r]]) pen.circle(hx, hy, r, '#ffffff', '#9aa0a8');
      if (w.label) pen.text(x0, y1 + 3.2, w.label, 2.2, 'left', '#6c707a');
      return;
    }
    // Hutschiene / Kabelkanal: Band entlang einer Geraden
    const horiz = Math.abs(ay - by) <= Math.abs(ax - bx);
    const t = w.t || 7;
    const x0 = horiz ? Math.min(ax, bx) : ax - t / 2, x1 = horiz ? Math.max(ax, bx) : ax + t / 2;
    const y0 = horiz ? ay - t / 2 : Math.min(ay, by), y1 = horiz ? ay + t / 2 : Math.max(ay, by);
    const len = horiz ? x1 - x0 : y1 - y0;
    const k = w.k || 0.2;
    if (w.kind === 'rail') {
      pen.poly([x0, y0, x1, y0, x1, y1, x0, y1], true, '#c3c8cf', isSel ? SEL : '#7d838c', 0.3);
      const e = t * 0.14;
      if (horiz) { pen.line(x0, y0 + e, x1, y0 + e, '#8d939c'); pen.line(x0, y1 - e, x1, y1 - e, '#8d939c'); }
      else { pen.line(x0 + e, y0, x0 + e, y1, '#8d939c'); pen.line(x1 - e, y0, x1 - e, y1, '#8d939c'); }
      // Langlöcher 15 × 5,2 mm im Raster 25 mm
      const sl = 15 * k, sw = 5.2 * k, pitch = 25 * k;
      for (let d = pitch / 2; d + sl / 2 < len; d += pitch) {
        const cx = horiz ? x0 + d : (x0 + x1) / 2, cy = horiz ? (y0 + y1) / 2 : y0 + d;
        const hw = horiz ? sl / 2 : sw / 2, hh = horiz ? sw / 2 : sl / 2;
        pen.poly([cx - hw, cy - hh, cx + hw, cy - hh, cx + hw, cy + hh, cx - hw, cy + hh], true, '#ffffff', '#8d939c', 0.2);
      }
    } else {
      pen.poly([x0, y0, x1, y0, x1, y1, x0, y1], true, '#a9aeb6', isSel ? SEL : '#6c707a', 0.3);
      const step = 12.5 * k, fin = t * 0.22;
      for (let d = step; d < len; d += step) {
        if (horiz) { pen.line(x0 + d, y0, x0 + d, y0 + fin, '#7d838c'); pen.line(x0 + d, y1, x0 + d, y1 - fin, '#7d838c'); }
        else { pen.line(x0, y0 + d, x0 + fin, y0 + d, '#7d838c'); pen.line(x1, y0 + d, x1 - fin, y0 + d, '#7d838c'); }
      }
      if (w.label && len > 30) pen.text((x0 + x1) / 2, (y0 + y1) / 2, w.label, Math.min(2.4, t * 0.45), 'center', '#3d424d', 'middle', false, !horiz);
    }
  }

function renderSheetWallsOnly(pen, w) { drawWall(pen, w, true); }

export function renderSheet(pen, sheets, idx, A, meta = {}, opt = {}) {
  const sh = sheets[idx];
  const S = SHEET_SIZES[sh.size] || SHEET_SIZES.A4;
  const { sel, hover } = opt;
  // Rahmen mit Spalteneinteilung
  const x0 = 10, y0 = 5, x1 = S.w - 5, y1 = S.h - 5, cw = (x1 - x0) / S.cols;
  pen.poly([x0, y0, x1, y0, x1, y1, x0, y1], true, null, FRAME, 0.5);
  pen.line(x0, y0 + 5, x1, y0 + 5, FRAME);
  for (let c = 0; c < S.cols; c++) {
    if (c) pen.line(x0 + c * cw, y0, x0 + c * cw, y0 + 5, FRAME);
    pen.text(x0 + c * cw + cw / 2, y0 + 3.7, String(c + 1), 3, 'center', FRAME);
  }
  // Zeileneinteilung links und rechts (A, B, C …) – Koordinatensystem nach DIN EN 61082
  const ry0 = y0 + 5, rh = (y1 - ry0) / S.rows;
  pen.line(x0 + 5, ry0, x0 + 5, y1, FRAME);
  pen.line(x1 - 5, ry0, x1 - 5, y1 - 22, FRAME);
  for (let r = 0; r < S.rows; r++) {
    const yy = ry0 + r * rh;
    if (r) { pen.line(x0, yy, x0 + 5, yy, FRAME); if (yy < y1 - 22) pen.line(x1 - 5, yy, x1, yy, FRAME); }
    const L = String.fromCharCode(65 + r);
    pen.text(x0 + 2.5, yy + rh / 2 + 1.1, L, 3, 'center', FRAME);
    if (yy + rh / 2 < y1 - 24) pen.text(x1 - 2.5, yy + rh / 2 + 1.1, L, 3, 'center', FRAME);
  }
  // Schriftfeld
  const tw = 130, th = 22, tx = x1 - tw, ty = y1 - th;
  pen.poly([tx, ty, x1, ty, x1, y1, tx, y1], true, '#ffffff', FRAME, 0.5);
  pen.line(tx + 80, ty, tx + 80, y1, FRAME);
  pen.line(tx, ty + 11, x1, ty + 11, FRAME);
  pen.line(tx + 80, ty + 5.5, x1, ty + 5.5, FRAME);
  pen.line(tx + 80, ty + 16.5, x1, ty + 16.5, FRAME);
  const lab = (x, y, t) => pen.text(x, y, t, 1.8, 'left', '#6c6c75');
  lab(tx + 1.5, ty + 2.6, 'Projekt'); pen.text(tx + 1.5, ty + 8.8, meta.project || '', 3.6, 'left', INK, 'alphabetic', true);
  lab(tx + 1.5, ty + 13.6, 'Blatt / Funktion'); pen.text(tx + 1.5, ty + 19.6, sh.meta.title || '', 3.6, 'left', INK, 'alphabetic', true);
  lab(tx + 81.5, ty + 2.2, 'Zeichner'); pen.text(tx + 81.5, ty + 4.8, meta.author || '', 2.4, 'left', INK);
  lab(tx + 81.5, ty + 7.7, 'Datum'); pen.text(tx + 81.5, ty + 10.3, sh.meta.date || '', 2.4, 'left', INK);
  lab(tx + 81.5, ty + 13.2, 'Firma / Schule'); pen.text(tx + 81.5, ty + 15.8, meta.company || '', 2.4, 'left', INK);
  lab(tx + 81.5, ty + 18.7, 'Blatt'); pen.text(tx + 81.5, ty + 21.3, `${idx + 1} von ${sheets.length}${sh.meta.rev ? '   Rev. ' + sh.meta.rev : ''}${sh.meta.scale ? '   M ' + sh.meta.scale : ''}`, 2.4, 'left', INK);

  // Wände (Installationsplan)
  const order = { plate: 0, duct: 1, rail: 2 };
  for (const w of [...(sh.walls || [])].sort((a, b) => (order[a.kind] ?? 3) - (order[b.kind] ?? 3))) drawWall(pen, w, sel && sel.walls && sel.walls.has(w.id));

  // Leitungen
  for (const w of sh.wires) {
    const c = sel && sel.wires.has(w.id) ? SEL : INK;
    pen.poly(w.pts, false, null, c);
    // Aderzahl (Schrägstriche) und Leitungsbezeichnung am längsten Abschnitt
    if (w.n || w.label) {
      let best = 0, bl = -1;
      for (let i = 0; i + 2 < w.pts.length; i += 2) { const l = Math.hypot(w.pts[i + 2] - w.pts[i], w.pts[i + 3] - w.pts[i + 1]); if (l > bl) { bl = l; best = i; } }
      const ax = w.pts[best], ay = w.pts[best + 1], bx = w.pts[best + 2], by = w.pts[best + 3];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, horiz = Math.abs(ay - by) < 0.01;
      const n = Math.min(w.n || 0, 7);
      for (let k = 0; k < n; k++) {
        const o = (k - (n - 1) / 2) * 1.4;
        if (horiz) pen.line(mx + o - 0.9, my + 1.6, mx + o + 0.9, my - 1.6, c);
        else pen.line(mx - 1.6, my + o + 0.9, mx + 1.6, my + o - 0.9, c);
      }
      if (w.label) pen.text(horiz ? mx : mx + 2.4, horiz ? my - 2.6 : my + 1, w.label, 2.2, horiz ? 'center' : 'left', c);
    }
  }
  for (const [x, y] of A.junctions[idx] || []) pen.circle(x, y, 0.75, INK, null);

  // Bauteile
  for (const part of sh.parts) {
    const sym = getSym(part.type);
    if (!sym) continue;
    const isSel = sel && sel.parts.has(part.id);
    const c = isSel ? SEL : INK;
    drawSymbol(pen, part, c);
    const box = partBox(part);
    if (sym.kind === 'net') {
      const pins = partPins(part);
      const right = (part.rot || 0) % 4 !== 2;
      pen.text(pins[0].x + (right ? 1.6 : -1.6), pins[0].y - 1, part.ref || '?', 3, right ? 'left' : 'right', c, 'alphabetic', true);
      continue;
    }
    if (opt.edit && part.lock) {
      // kleines Schloss
      const lx = box.x1 + 0.5, ly = box.y0 - 0.5;
      pen.poly([lx - 1.2, ly, lx + 1.2, ly, lx + 1.2, ly + 1.8, lx - 1.2, ly + 1.8], true, '#9a9aa3', null);
      pen.poly([lx - 0.75, ly, lx - 0.75, ly - 0.9, lx + 0.75, ly - 0.9, lx + 0.75, ly], false, null, '#9a9aa3');
    }
    if (sym.kind === 'gnd' || sym.kind === 'deco') continue;
    if (sym.kind === 'cab') {
      const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
      const narrow = bw < bh * 0.45;
      const fs = Math.max(0.9, Math.min(3, (narrow ? bh : bw) * 0.09, (narrow ? bw : bh) * 0.45));
      const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
      const dark = ['#3b4048', '#2f333a', '#1f2329', '#2f8a46', '#1d4fa0'].includes(sym.ops[0][5]);
      const tc = isSel ? SEL : dark ? '#ffffff' : '#16161a';
      if (sym.din && bw < 12) {
        // schmale Hutschienengeräte: BMK senkrecht über dem Gerät (wie im Aufbauplan üblich)
        if (part.ref) pen.text(cx + 0.6, box.y0 - 0.8, part.ref, Math.min(1.9, Math.max(1, bw * 0.55)), 'left', isSel ? SEL : '#16161a', 'alphabetic', true, true);
      } else {
        if (part.ref) pen.text(cx, cy - (narrow ? 0 : fs * 0.3), part.ref, fs, 'center', tc, 'middle', true, narrow);
        if (part.val && !narrow && bh > fs * 4) pen.text(cx, cy + fs * 1.1, part.val, fs * 0.75, 'center', tc, 'middle');
      }
      continue;
    }
    if (String(sym.cat).startsWith('Installation') && !part.showRef) {
      if (part.val) pen.text(box.x1 + 1, box.y0 - 0.6, part.val, 2.2, 'left', c);
      continue;
    }
    const vert = isVertical(part);
    const lines = [];
    if (part.ref) lines.push([part.ref, true]);
    if (part.val) lines.push([part.val, false]);
    const xr = A.xref.get(part.id);
    if (xr) lines.push([`/${xr}`, false]);
    if (vert) {
      let y = (box.y0 + box.y1) / 2 - (lines.length - 1) * 1.7 + 1;
      for (const [t, b] of lines) { pen.text(box.x0 - 1.8, y, t, b ? 3 : 2.5, 'right', c, 'alphabetic', b); y += 3.4; }
    } else {
      let y = box.y0 - 1.6 - (lines.length - 1) * 3.2;
      for (const [t, b] of lines) { pen.text((box.x0 + box.x1) / 2, y, t, b ? 3 : 2.5, 'center', c, 'alphabetic', b); y += 3.2; }
    }
    // Anschlussbezeichnungen (Kontakte, Spulen)
    const pl = A.pinLabels.get(part.id);
    if (pl) {
      partPins(part).forEach((pin, i) => {
        if (!pl[i]) return;
        const up = pin.y < part.y;
        pen.text(pin.x + 1, pin.y + (up ? 3 : -1.2), pl[i], 1.9, 'left', '#6c6c75');
      });
    }
    // Kontaktspiegel unter der Spule
    const m = A.mirror.get(part.id);
    if (m) {
      let y = box.y1 + 4 + (vert ? 4 : 0);
      const x = vert ? box.x0 - 1.8 - 18 : box.x0;
      for (const e of m) {
        pen.text(x, y, `${e.kind === 'no' ? '⊸' : e.kind === 'nc' ? '⊷' : '⇋'} ${e.label}  /${e.loc}`, 2.2, 'left', '#4b4b55');
        y += 2.8;
      }
    }
  }
  // Texte
  for (const t of sh.texts) {
    const c = sel && sel.texts.has(t.id) ? SEL : INK;
    String(t.text).split('\n').forEach((ln, i) => pen.text(t.x, t.y + i * t.size * 1.25, ln, t.size, 'left', c));
  }
  for (const k of sh.ink || []) {
    const c = sel && sel.ink && sel.ink.has(k.id) ? SEL : k.c || '#1f5eff';
    if (k.pts.length === 2) pen.circle(k.pts[0], k.pts[1], (k.w || 0.5) / 2, c, null);
    else pen.poly(k.pts, false, null, c, k.w || 0.5);
  }
  if (hover) pen.circle(hover[0], hover[1], 1.3, null, SEL);
}

/** Position des Schriftfelds (zum Antippen). */
export function titleRect(sh) {
  const S = SHEET_SIZES[sh.size] || SHEET_SIZES.A4;
  return { x0: S.w - 5 - 130, y0: S.h - 5 - 22, x1: S.w - 5, y1: S.h - 5 };
}

// ---------------------------------------------------------------- Editor
export class SchematicEditor {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('schematic');
    this.isOpen = false;
    this.view = { x: 0, y: 0, s: 3 };
    this.tool = 'select';
    this.sel = { parts: new Set(), wires: new Set(), texts: new Set() };
    this.hist = [];
    this.redoStack = [];
    this.pointers = new Map();
    this.clip = null;
    this.saveSoon = debounce(() => this.save(), 600);
    this.build();
    window.addEventListener('resize', () => { if (this.isOpen) this.resize(); });
    document.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && this.isOpen) this.saveSoon.flush(); });
  }

  // ------------------------------------------------------------ Aufbau
  build() {
    const r = this.root;
    r.innerHTML = `
      <canvas class="sch-canvas"></canvas>
      <aside class="sch-lib glass" hidden>
        <div class="side-head"><span class="side-title">Bauteile</span><button class="ib sm" data-a="closelib" aria-label="Schließen">${icon('x')}</button></div>
        <label class="search sch-search">${icon('search')}<input type="search" placeholder="Suchen, z. B. Schütz" autocomplete="off"></label>
        <div class="sch-lib-list"></div>
      </aside>
      <div class="ed-top">
        <div class="ed-bars">
          <div class="float-bar glass ed-left">
            <button class="ib" data-a="back" title="Zur Bibliothek" aria-label="Zur Bibliothek">${icon('back')}</button>
            <button class="ib" data-a="lib" title="Bauteile" aria-label="Bauteile">${icon('grid')}</button>
            <div class="ed-titles">
              <button class="ed-title" data-a="rename"><span class="t"></span><span class="save-state"></span></button>
              <button class="chapter-chip" data-a="sheets"><span class="dot"></span><span class="cn"></span>${icon('chevronDown')}</button>
            </div>
          </div>
          <div class="float-bar glass ed-tools" role="toolbar"></div>
          <div class="float-bar glass ed-right">
            <button class="ib" data-a="undo" title="Rückgängig">${icon('undo')}</button>
            <button class="ib" data-a="redo" title="Wiederholen">${icon('redo')}</button>
            <button class="ib" data-a="fit" title="Ganzes Blatt">${icon('fit')}</button>
            <button class="ib" data-a="export" title="Exportieren">${icon('share')}</button>
            <button class="ib" data-a="more" title="Mehr">${icon('more')}</button>
          </div>
        </div>
        <div class="ed-ctx"><div class="float-bar glass ctx-inner"></div></div>
      </div>
      <button class="pg-ind glass" data-a="sheets"></button>`;
    this.toolsEl = r.querySelector('.ed-tools');
    this.canvas = r.querySelector('.sch-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctxInner = r.querySelector('.ctx-inner');
    this.lib = r.querySelector('.sch-lib');
    this.libList = r.querySelector('.sch-lib-list');
    this.pgInd = r.querySelector('.pg-ind');
    r.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a],[data-tool]');
      if (!b || !r.contains(b)) return;
      if (b.dataset.tool) { this.setTool(b.dataset.tool); return; }
      this.action(b.dataset.a, b);
    });
    r.querySelector('.sch-search input').addEventListener('input', (e) => this.fillLib(e.target.value));
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e, true));
    c.addEventListener('pointerleave', () => { this.hover = null; this.ghostAt = this.tool === 'place' ? this.ghostAt : null; this.draw(); });
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    const stop = (e) => e.preventDefault();
    c.addEventListener('touchstart', stop, { passive: false });
    c.addEventListener('touchmove', stop, { passive: false });
    c.addEventListener('contextmenu', stop);
    this.fillLib('');
  }

  buildTools() {
    const inst = this.kind === 'install';
    const cabm = this.kind === 'cabinet';
    const T = (k, ic, t) => `<button class="tb" data-tool="${k}" title="${t}" aria-label="${t}">${icon(ic)}</button>`;
    const A = (k, ic, t) => `<button class="tb" data-a="${k}" title="${t}" aria-label="${t}">${icon(ic)}</button>`;
    this.toolsEl.innerHTML = [
      T('select', 'cursor', 'Auswählen & verschieben (V)'),
      T('lasso', 'lasso', 'Lasso-Auswahl (L)'),
      cabm ? T('plate', 'layout', 'Montageplatte aufziehen') : T('wire', 'wire', inst ? 'Leitung ziehen (W)' : 'Verdrahten (W)'),
      cabm ? T('rail', 'rail', 'Hutschiene ziehen') : inst ? T('wall', 'layout', 'Wand zeichnen') : A('netlabel', 'tag', 'Potential setzen (L1, N, PE, +24V …)'),
      cabm ? T('duct', 'duct', 'Kabelkanal ziehen') : null,
      T('draw', 'pen', 'Stift – frei zeichnen (P)'),
      T('erase', 'eraser', 'Radierer für Freihand (E)'),
      T('text', 'text', 'Text (T)'),
      '<span class="tb-sep"></span>',
      A('rotate', 'rotate', 'Drehen (R)'),
      A('mirror', 'flip', 'Spiegeln (X)'),
      A('lock', 'lock', 'Sperren / Entsperren'),
      A('delete', 'trash', 'Löschen (Entf)'),
      '<span class="tb-sep"></span>',
      cabm ? null : A('check', 'checkCircle', 'Plan prüfen'),
    ].filter(Boolean).join('');
  }

  fillLib(q) {
    const list = this.libList;
    list.innerHTML = '';
    const s = q.trim().toLowerCase();
    const syn = { schütz: 'relais spule kontakt', lampe: 'leuchte', erde: 'masse pe schutzleiter', taster: 'taster', klemme: 'klemme', quelle: 'batterie spannung' };
    const cats = this.kind === 'install' ? INSTALL_CATEGORIES : this.kind === 'cabinet' ? CABINET_CATEGORIES : CATEGORIES;
    for (const cat of cats) {
      if (cat === 'Eigene Bauteile' && !s) {
        // eigene Bauteile + Baukasten
        list.append(el('div', { class: 'nav-h' }, cat));
        const grid = el('div', { class: 'sym-grid' });
        const add = el('button', { class: 'sym-tile add', title: 'Eigenes Bauteil erstellen', html: `${icon('plus')}<span>${this.kind === 'cabinet' ? 'Neues Gerät' : 'Neues Bauteil'}</span>` });
        add.addEventListener('click', () => (this.kind === 'cabinet' ? this.deviceEditor() : this.symbolEditor()));
        grid.append(add);
        for (const [k, v] of Object.entries(allSymbols()).filter(([, v]) => v.custom && (v.kind === 'cab') === (this.kind === 'cabinet'))) {
          const b = el('button', { class: `sym-tile ${this.placeType === k && this.tool === 'place' ? 'on' : ''}`, title: v.name }, symbolPreview(k), el('span', null, v.name));
          b.addEventListener('click', () => this.startPlace(k));
          const ed = el('button', { class: 'sym-edit', 'aria-label': 'Bearbeiten', html: icon('pencil') });
          ed.addEventListener('click', (e) => { e.stopPropagation(); if (v.kind === 'cab') this.deviceEditor(v); else this.symbolEditor(v); });
          b.append(ed);
          grid.append(b);
        }
        list.append(grid);
        continue;
      }
      const items = Object.entries(allSymbols()).filter(([k, v]) => v.cat === cat && (!s || `${v.name} ${v.prefix} ${k} ${cat}`.toLowerCase().includes(s) || Object.entries(syn).some(([a, b]) => s.includes(a) && b.split(' ').some((w) => v.name.toLowerCase().includes(w)))));
      if (!items.length) continue;
      list.append(el('div', { class: 'nav-h' }, cat));
      const grid = el('div', { class: 'sym-grid' });
      for (const [k, v] of items) {
        const b = el('button', { class: `sym-tile ${this.placeType === k && this.tool === 'place' ? 'on' : ''}`, title: v.name }, symbolPreview(k), el('span', null, v.name));
        b.addEventListener('click', () => this.startPlace(k));
        if (v.kind !== 'cab' && v.ops) {
          const ed = el('button', { class: 'sym-edit', title: 'Als eigenes Bauteil bearbeiten', 'aria-label': 'Bearbeiten', html: icon('pencil') });
          ed.addEventListener('click', (e) => { e.stopPropagation(); this.symbolEditor(v.custom ? v : { ...v, custom: false }); });
          b.append(ed);
        }
        grid.append(b);
      }
      list.append(grid);
    }
    if (!list.children.length) list.append(el('div', { class: 'side-empty' }, 'Kein Bauteil gefunden'));
  }

  // ------------------------------------------------------------ Öffnen / Speichern
  async open(nbId, pageId) {
    const data = await store.loadNotebook(nbId);
    if (!data) { toast('Plan nicht gefunden.'); return false; }
    this.nb = data.nb;
    this.pages = data.pages;
    for (const p of this.pages) if (!p.sch) p.sch = newSheetData(this.nb.schSize || 'A4', 'Blatt');
    this.nb.schMeta = this.nb.schMeta || { project: this.nb.name, author: '', company: '' };
    this.kind = this.nb.mode === 'install' ? 'install' : this.nb.mode === 'cabinet' ? 'cabinet' : 'schematic';
    this.cabK = 1 / (this.nb.cabScale || 5);
    for (const p of this.pages) { p.sch.ink = p.sch.ink || []; p.sch.walls = p.sch.walls || []; }
    // eigene Bauteile: Bibliothek des Kontos + im Plan gespeicherte Kopien
    registerCustom(getSettings().schCustom || []);
    registerCustom(this.nb.schSymbols || []);
    this.buildTools();
    this.idx = Math.max(0, this.pages.findIndex((p) => p.id === pageId));
    this.isOpen = true;
    this.root.hidden = false;
    this.hist = []; this.redoStack = [];
    this.clearSel();
    this.setTool('select');
    this.root.querySelector('.ed-title .t').textContent = this.nb.name;
    this.resize();
    this.fit();
    this.refreshSheet();
    this.setSave('saved');
    if (!this.sheets().some((s) => s.parts.length) && this.W > 700) setTimeout(() => { this.toggleLib(true); this.fit(); }, 300);
    return true;
  }

  async close() {
    this.saveSoon.cancel();
    await this.save();
    await this.makeThumb();
    this.isOpen = false;
    this.root.hidden = true;
    this.toggleLib(false);
    closePopover();
  }

  sheets() { return this.pages.map((p) => p.sch); }
  get sh() { return this.pages[this.idx].sch; }

  setSave(s) {
    const e = this.root.querySelector('.save-state');
    e.textContent = { saving: 'Speichert …', saved: 'Gespeichert', dirty: '', error: 'Nicht gespeichert!' }[s] || '';
    e.className = 'save-state ' + s;
  }

  async save() {
    if (!this.nb) return;
    const nb = this.nb;
    nb.pages = this.pages.map((p) => p.id);
    nb.updated = Date.now();
    nb.idx = this.pages.map((p) => [p.id, [p.sch.meta.title, ...p.sch.parts.map((x) => `${x.ref || ''} ${x.val || ''} ${x.note || ''} ${getSym(x.type)?.name || ''}`), ...p.sch.texts.map((t) => t.text)].join('\n')]);
    this.setSave('saving');
    try {
      await store.savePages(nb, this.pages, this.removed || []);
      this.removed = [];
      this.setSave('saved');
    } catch (e) { console.error(e); this.setSave('error'); toast('Speichern fehlgeschlagen.'); }
  }

  async makeThumb() {
    try {
      const c = document.createElement('canvas');
      this.renderTo(c, 0, 300 / (SHEET_SIZES[this.pages[0].sch.size] || SHEET_SIZES.A4).w);
      this.nb.thumb = c.toDataURL('image/jpeg', 0.8);
      await store.saveItem(this.nb);
    } catch (e) { console.warn(e); }
  }

  /** Änderung: vorher Zustand merken, dann speichern und neu zeichnen. */
  commit(before) {
    this.hist.push(before);
    if (this.hist.length > 150) this.hist.shift();
    this.redoStack = [];
    this.A = null;
    this.setSave('dirty');
    this.saveSoon();
    this.draw();
    this.updateCtx();
  }
  snap() { return JSON.stringify({ idx: this.idx, sch: this.sh }); }
  restore(json) {
    const o = JSON.parse(json);
    this.idx = Math.min(o.idx, this.pages.length - 1);
    this.pages[this.idx].sch = o.sch;
    this.clearSel();
    this.A = null;
    this.saveSoon();
    this.refreshSheet();
  }
  undo() { const s = this.hist.pop(); if (!s) { toast('Nichts zum Rückgängigmachen'); return; } this.redoStack.push(this.snap()); this.restore(s); }
  redo() { const s = this.redoStack.pop(); if (!s) { toast('Nichts zum Wiederholen'); return; } this.hist.push(this.snap()); this.restore(s); }

  analysis() { if (!this.A) this.A = analyze(this.sheets()); return this.A; }

  // ------------------------------------------------------------ Ansicht
  resize() {
    const r = this.root.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.rect = this.canvas.getBoundingClientRect();
    this.draw();
  }

  fit() {
    const S = SHEET_SIZES[this.sh.size] || SHEET_SIZES.A4;
    const top = this.topInset(), bottom = 60;
    const left = this.lib && !this.lib.hidden ? this.lib.getBoundingClientRect().right - this.root.getBoundingClientRect().left + 12 : 20;
    const s = Math.min((this.W - left - 20) / S.w, (this.H - top - bottom) / S.h);
    this.view = { s, x: left + (this.W - left - 20 - S.w * s) / 2, y: top + (this.H - top - bottom - S.h * s) / 2 };
    this.draw();
  }

  topInset() {
    const b = this.root.querySelector('.ed-ctx').getBoundingClientRect();
    return Math.max(20, b.bottom - this.root.getBoundingClientRect().top + 10);
  }

  toWorld(sx, sy) { return [(sx - this.view.x) / this.view.s, (sy - this.view.y) / this.view.s]; }

  draw() {
    if (!this.isOpen || this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); });
  }

  paint() {
    const c = this.ctx, d = this.dpr, v = this.view;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'light' || document.documentElement.getAttribute('data-theme') === 'dark';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = dark ? '#26262b' : '#e7e7ea';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const S = SHEET_SIZES[this.sh.size] || SHEET_SIZES.A4;
    c.setTransform(d * v.s, 0, 0, d * v.s, d * v.x, d * v.y);
    c.shadowColor = 'rgba(0,0,0,.15)'; c.shadowBlur = 12 * d; c.shadowOffsetY = 2 * d;
    c.fillStyle = '#fff'; c.fillRect(0, 0, S.w, S.h);
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    // Raster
    if (v.s > 1.6) {
      c.fillStyle = 'rgba(60,80,120,.28)';
      const r = Math.max(0.18, 0.7 / v.s);
      const [wx0, wy0] = this.toWorld(0, 0), [wx1, wy1] = this.toWorld(this.W, this.H);
      for (let y = Math.max(GRID, snap(wy0)); y <= Math.min(S.h - GRID, wy1); y += GRID) for (let x = Math.max(GRID, snap(wx0)); x <= Math.min(S.w - GRID, wx1); x += GRID) c.fillRect(x - r / 2, y - r / 2, r, r);
    }
    const pen = new CanvasPen(c, 1 / v.s);
    renderSheet(pen, this.sheets(), this.idx, this.analysis(), this.nb.schMeta, { sel: this.sel, hover: this.hover, edit: true });
    // Vorschau: Bauteil platzieren
    if (this.tool === 'place' && this.ghostAt) {
      c.globalAlpha = 0.55;
      drawSymbol(pen, { type: this.placeType, x: this.ghostAt[0], y: this.ghostAt[1], rot: this.placeRot, mir: this.placeMir, k: getSym(this.placeType)?.kind === 'cab' ? this.cabK : 1 }, SEL);
      c.globalAlpha = 1;
    }
    // Vorschau: Leitung
    if (this.draft) {
      const p = this.draftPts();
      if (p.length >= 4) pen.poly(p, false, null, this.draft.wall ? 'rgba(85,85,94,.6)' : SEL, this.draft.wall ? (this.wallT || 4.8) : Math.max(0.5, 2 / v.s));
      c.fillStyle = SEL;
      for (let i = 0; i < p.length; i += 2) { c.beginPath(); c.arc(p[i], p[i + 1], Math.max(0.5, 2.5 / v.s), 0, 7); c.fill(); }
    }
    if (this.shapeDraft) {
      renderSheetWallsOnly(pen, this.shapeDraft);
    }
    // Freihand in Arbeit
    if (this.inkDraft) {
      const k = this.inkDraft;
      if (k.pts.length === 2) pen.circle(k.pts[0], k.pts[1], k.w / 2, k.c, null); else pen.poly(k.pts, false, null, k.c, k.w);
    }
    // Radierer-Kreis
    if (this.tool === 'erase' && this.eraserAt && this.drag) {
      c.strokeStyle = 'rgba(90,90,90,.7)'; c.lineWidth = 1 / v.s;
      c.beginPath(); c.arc(this.eraserAt[0], this.eraserAt[1], this.eraserAt[2], 0, 7); c.stroke();
    }
    // Lasso
    if (this.lassoPts && this.lassoPts.length >= 4) {
      const L = this.lassoPts;
      c.beginPath(); c.moveTo(L[0], L[1]); for (let i = 2; i < L.length; i += 2) c.lineTo(L[i], L[i + 1]); c.closePath();
      c.fillStyle = 'rgba(106,92,255,.08)'; c.fill();
      c.setLineDash([2 / v.s, 2 / v.s]); c.strokeStyle = SEL; c.lineWidth = 1.2 / v.s; c.stroke(); c.setLineDash([]);
    }
    // Auswahlrahmen (Lasso: zum Verschieben hineintippen)
    if (this.tool === 'lasso' && this.selCount() && !this.lassoPts) {
      const b = this.selBox();
      if (b) { c.setLineDash([2 / v.s, 1.5 / v.s]); c.strokeStyle = SEL; c.lineWidth = 1 / v.s; c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.setLineDash([]); }
    }
    // Rahmenauswahl
    if (this.band) {
      const [ax, ay, bx, by] = this.band;
      c.setLineDash([2 / v.s, 2 / v.s]);
      c.strokeStyle = SEL; c.lineWidth = 1 / v.s;
      c.fillStyle = 'rgba(106,92,255,.08)';
      c.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      c.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      c.setLineDash([]);
    }
    // Hervorhebung aus der Prüfung
    if (this.flashAt && performance.now() - this.flashAt.t < 2500) {
      c.strokeStyle = '#e5484d'; c.lineWidth = 2 / v.s;
      c.beginPath(); c.arc(this.flashAt.x, this.flashAt.y, 9, 0, 7); c.stroke();
      this.draw();
    }
    this.pgInd.textContent = `Blatt ${this.idx + 1} / ${this.pages.length} · ${Math.round(v.s / 3 * 100)} %`;
  }

  renderTo(canvas, idx, k) {
    const sh = this.pages[idx].sch;
    const S = SHEET_SIZES[sh.size] || SHEET_SIZES.A4;
    canvas.width = Math.round(S.w * k); canvas.height = Math.round(S.h * k);
    const c = canvas.getContext('2d');
    c.setTransform(k, 0, 0, k, 0, 0);
    c.fillStyle = '#fff'; c.fillRect(0, 0, S.w, S.h);
    renderSheet(new CanvasPen(c, 0.9 / k), this.sheets(), idx, this.analysis(), this.nb.schMeta, {});
    return canvas;
  }

  // ------------------------------------------------------------ Werkzeuge
  setTool(t) {
    if (this.draft && t !== 'wire') this.finishWire();
    this.tool = t;
    this.root.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    this.canvas.style.cursor = ['wire', 'wall', 'draw'].includes(t) ? 'crosshair' : t === 'place' ? 'copy' : 'default';
    if (t !== 'lasso' && t !== 'select') this.clearSel();
    if (t !== 'place') this.ghostAt = null;
    this.fillLib(this.root.querySelector('.sch-search input').value || '');
    this.updateCtx();
    this.draw();
  }

  startPlace(type) {
    this.placeType = type;
    this.placeRot = getSym(type).kind === 'net' ? 0 : 0;
    this.placeMir = false;
    this.clearSel();
    this.setTool('place');
    if (window.innerWidth < 900) this.toggleLib(false);
    toast(`${getSym(type).name}: auf das Blatt tippen`);
  }

  toggleLib(force) {
    const open = force != null ? force : this.lib.hidden;
    this.lib.hidden = !open;
    this.lib.style.top = this.topInset() - 4 + 'px';
    this.root.querySelector('[data-a="lib"]').classList.toggle('on', open);
  }

  clearSel() { this.sel = { parts: new Set(), wires: new Set(), texts: new Set(), ink: new Set(), walls: new Set() }; this.updateCtx(); }
  selCount() { const s = this.sel; return s.parts.size + s.wires.size + s.texts.size + s.ink.size + s.walls.size; }

  updateCtx() {
    const box = this.ctxInner;
    if (!box) return;
    box.innerHTML = '';
    const btn = (label, run, cls = '') => el('button', { class: `ctx-btn ${cls}`, onclick: run }, label);
    const hint = (t) => el('span', { class: 'ctx-hint' }, t);
    const sep = () => el('span', { class: 'ctx-sep' });
    if (this.tool === 'place') {
      box.append(hint(`Platzieren: ${getSym(this.placeType).name}`), sep(),
        btn('Drehen', () => { this.placeRot = ((this.placeRot || 0) + 1) % 4; this.draw(); }),
        btn('Spiegeln', () => { this.placeMir = !this.placeMir; this.draw(); }),
        btn('Fertig', () => this.setTool('select'), 'primary'));
    } else if (this.tool === 'wire') {
      box.append(hint(this.draft ? 'Ecken antippen – auf einem Anschluss endet die Leitung' : 'Startpunkt antippen · oder mit dem Stift von Anschluss zu Anschluss ziehen'));
      if (this.draft) box.append(sep(), btn('Richtung wechseln', () => { this.vertFirst = !this.vertFirst; this.draw(); }), btn('Fertig', () => this.finishWire(), 'primary'), btn('Abbrechen', () => { this.draft = null; this.updateCtx(); this.draw(); }));
    } else if (this.tool === 'text') {
      box.append(hint('Auf das Blatt tippen, um einen Text zu setzen'));
    } else if (this.tool === 'lasso') {
      box.append(hint('Einkreisen zum Auswählen – danach ziehen zum Verschieben'));
      if (this.selCount()) box.append(sep(), btn('Auswahl aufheben', () => { this.clearSel(); this.draw(); }));
    } else if (this.tool === 'draw' || this.tool === 'erase') {
      const ink = this.inkStyle();
      box.append(hint(this.tool === 'draw' ? 'Frei zeichnen und notieren' : 'Über Freihand-Striche wischen'), sep());
      for (const c of ['#1f5eff', '#e5383b', '#139a52', '#16161a', '#f08c00', '#ffd400']) {
        const b = el('button', { class: `csw ${ink.c === c ? 'on' : ''}`, style: { '--c': c }, 'aria-label': 'Farbe' });
        b.addEventListener('click', () => { this.setInk({ c }); this.setTool('draw'); });
        box.append(b);
      }
      box.append(sep());
      [[0.35, 'fein'], [0.6, 'mittel'], [1.2, 'dick'], [4, 'Marker']].forEach(([w, l]) => box.append(btn(l, () => { this.setInk({ w }); this.setTool('draw'); }, ink.w === w ? 'on' : '')));
    } else if (this.tool === 'rail' || this.tool === 'duct' || this.tool === 'plate') {
      if (this.tool === 'plate') box.append(hint('Montageplatte: Ecke zu Ecke ziehen'));
      if (this.tool === 'rail') box.append(hint('Hutschiene ziehen'), sep(), btn('TS35', () => { this.railW = 35; this.updateCtx(); }, (this.railW || 35) === 35 ? 'on' : ''), btn('TS15', () => { this.railW = 15; this.updateCtx(); }, this.railW === 15 ? 'on' : ''));
      if (this.tool === 'duct') { box.append(hint('Kabelkanal ziehen'), sep()); [25, 40, 60, 80].forEach((d) => box.append(btn(`${d} mm`, () => { this.ductW = d; this.updateCtx(); }, (this.ductW || 60) === d ? 'on' : ''))); }
    } else if (this.tool === 'wall') {
      box.append(hint('Wand: Start antippen, Ecken antippen, doppelt tippen beendet · oder ziehen'), sep(),
        btn('Außenwand', () => { this.wallT = 4.8; this.updateCtx(); }, (this.wallT || 4.8) === 4.8 ? 'on' : ''),
        btn('Innenwand', () => { this.wallT = 2.3; this.updateCtx(); }, this.wallT === 2.3 ? 'on' : ''));
      if (this.draft) box.append(sep(), btn('Fertig', () => this.finishWire(), 'primary'));
    } else if (this.selCount()) {
      const sel = this.selected();
      const locked = sel.parts.some((p) => p.lock) || sel.texts.some((t) => t.lock);
      box.append(hint(`${this.selCount()} ausgewählt${locked ? ' · gesperrt' : ''}`), sep());
      if (this.sel.parts.size === 1 && !this.sel.wires.size) box.append(btn('Eigenschaften', () => this.editProps()));
      if (this.sel.wires.size === 1 && !this.sel.parts.size) box.append(btn('Leitung …', () => this.editWire()));
      if (this.sel.texts.size === 1 && !this.sel.parts.size) box.append(btn('Text ändern', () => this.editText()));
      box.append(btn(locked ? 'Entsperren' : 'Sperren', () => this.lockSel(!locked)));
      if (!locked) box.append(btn('Drehen', () => this.rotateSel()), btn('Spiegeln', () => this.mirrorSel()));
      box.append(btn('Duplizieren', () => this.duplicate()), btn('Kopieren', () => this.copy()));
      if (!locked) box.append(btn('Löschen', () => this.deleteSel(), 'danger'));
    } else {
      box.append(hint('Antippen = auswählen · Ziehen = verschieben · Doppeltippen = Eigenschaften'));
      if (this.clip) box.append(sep(), btn('Einfügen', () => this.paste()));
    }
    const undo = this.root.querySelector('[data-a="undo"]'), redo = this.root.querySelector('[data-a="redo"]');
    if (undo) { undo.disabled = !this.hist.length; redo.disabled = !this.redoStack.length; }
  }

  async action(a, b) {
    switch (a) {
      case 'back': await this.app.closeEditor(); break;
      case 'lib': this.toggleLib(); break;
      case 'closelib': this.toggleLib(false); break;
      case 'rename': { const v = await prompt('Plan umbenennen', this.nb.name, { okLabel: 'Umbenennen' }); if (v) { this.nb.name = v; this.root.querySelector('.ed-title .t').textContent = v; this.saveSoon(); } break; }
      case 'sheets': this.sheetMenu(b); break;
      case 'netlabel': this.startPlace('net'); break;
      case 'rotate': if (this.tool === 'place') { this.placeRot = ((this.placeRot || 0) + 1) % 4; this.draw(); } else this.rotateSel(); break;
      case 'mirror': if (this.tool === 'place') { this.placeMir = !this.placeMir; this.draw(); } else this.mirrorSel(); break;
      case 'delete': this.deleteSel(); break;
      case 'lock': {
        if (!this.selCount()) { toast('Erst Bauteile auswählen, dann sperren'); break; }
        const sel = this.selected();
        this.lockSel(!(sel.parts.some((p) => p.lock) || sel.texts.some((t) => t.lock)));
        break;
      }
      case 'check': this.checkDialog(); break;
      case 'undo': this.undo(); break;
      case 'redo': this.redo(); break;
      case 'fit': this.fit(); break;
      case 'export': this.exportMenu(b); break;
      case 'more': this.moreMenu(b); break;
      default: break;
    }
  }

  // ------------------------------------------------------------ Blätter
  refreshSheet() {
    const chip = this.root.querySelector('.chapter-chip');
    chip.querySelector('.dot').style.background = '#6a5cff';
    chip.querySelector('.cn').textContent = `${this.idx + 1}: ${this.sh.meta.title || 'Blatt'}`;
    this.clearSel();
    this.draft = null;
    this.draw();
  }

  goSheet(i) { this.idx = clamp(i, 0, this.pages.length - 1); this.refreshSheet(); this.fit(); }

  sheetMenu(anchor) {
    const items = [{ title: 'Blätter' }];
    this.pages.forEach((p, i) => items.push({ label: `${i + 1}: ${p.sch.meta.title || 'Blatt'}`, icon: 'file', checked: i === this.idx, run: () => this.goSheet(i) }));
    items.push({ sep: true },
      { label: 'Neues Blatt', icon: 'plus', run: () => this.addSheet() },
      { label: 'Blatt duplizieren', icon: 'duplicate', run: () => this.addSheet(true) },
      { label: 'Schriftfeld bearbeiten …', icon: 'pencil', run: () => this.titleDialog() },
      { label: 'Blatt nach vorne', icon: 'arrowUp', disabled: this.idx === 0, run: () => this.moveSheet(-1) },
      { label: 'Blatt nach hinten', icon: 'arrowDown', disabled: this.idx === this.pages.length - 1, run: () => this.moveSheet(1) },
      { label: 'Blatt löschen', icon: 'trash', danger: true, disabled: this.pages.length < 2, run: () => this.deleteSheet() });
    menu(anchor, items);
  }

  addSheet(dup) {
    const ref = this.pages[this.idx];
    const p = store.newPage(this.nb.id, { template: 'blank', sec: ref.sec });
    p.sch = dup ? JSON.parse(JSON.stringify(ref.sch)) : newSheetData(ref.sch.size, `Blatt ${this.pages.length + 1}`);
    if (dup) {
      for (const x of [...p.sch.parts, ...p.sch.wires, ...p.sch.texts]) x.id = uid();
      p.sch.meta.title = (p.sch.meta.title || 'Blatt') + ' (Kopie)';
    }
    this.pages.splice(this.idx + 1, 0, p);
    this.A = null;
    this.saveSoon();
    this.goSheet(this.idx + 1);
    toast(`Blatt ${this.idx + 1} angelegt`);
  }

  moveSheet(d) {
    const j = this.idx + d;
    [this.pages[this.idx], this.pages[j]] = [this.pages[j], this.pages[this.idx]];
    this.idx = j; this.A = null; this.saveSoon(); this.refreshSheet();
  }

  async deleteSheet() {
    if (!(await confirm('Blatt löschen?', `„${this.sh.meta.title || 'Blatt'}“ wird gelöscht.`, 'Löschen', true))) return;
    const [p] = this.pages.splice(this.idx, 1);
    this.removed = [...(this.removed || []), p.id];
    this.hist = []; this.redoStack = [];
    this.A = null; this.saveSoon();
    this.goSheet(Math.min(this.idx, this.pages.length - 1));
  }

  async titleDialog() {
    const m = this.nb.schMeta, sm = this.sh.meta;
    const inp = (v, ph) => el('input', { class: 'inp', type: 'text', value: v || '', placeholder: ph || '' });
    const f = { project: inp(m.project), company: inp(m.company), author: inp(m.author), title: inp(sm.title), date: inp(sm.date), rev: inp(sm.rev, 'z. B. A'), scale: inp(sm.scale, this.kind === 'install' ? 'z. B. 1:50' : 'optional') };
    const sizeSel = el('select', { class: 'inp' }, Object.entries(SHEET_SIZES).map(([k, s]) => el('option', { value: k, selected: k === this.sh.size ? true : null }, s.label)));
    const fld = (l, n) => el('div', { class: 'field' }, el('div', { class: 'field-label' }, l), n);
    const r = await dialog({
      title: 'Schriftfeld', wide: true,
      body: el('div', { class: 'form-grid' },
        fld('Projekt (alle Blätter)', f.project), fld('Firma / Schule (alle Blätter)', f.company), fld('Zeichner (alle Blätter)', f.author),
        fld('Blatt / Funktion', f.title), fld('Datum', f.date), fld('Revision', f.rev), fld('Maßstab', f.scale), fld('Blattgröße', sizeSel)),
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Speichern', value: true, primary: true }],
    });
    if (!r) return;
    const before = this.snap();
    Object.assign(m, { project: f.project.value, company: f.company.value, author: f.author.value });
    Object.assign(sm, { title: f.title.value, date: f.date.value, rev: f.rev.value, scale: f.scale.value });
    this.sh.size = sizeSel.value;
    this.commit(before);
    this.refreshSheet();
    this.fit();
  }

  // ------------------------------------------------------------ Treffer
  hitPart(x, y) {
    const parts = this.sh.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const b = partBox(parts[i]);
      if (x >= b.x0 - 1.5 && x <= b.x1 + 1.5 && y >= b.y0 - 1.5 && y <= b.y1 + 1.5) return parts[i];
    }
    return null;
  }
  hitWire(x, y, tol) {
    for (let i = this.sh.wires.length - 1; i >= 0; i--) {
      const w = this.sh.wires[i], p = w.pts;
      for (let j = 0; j + 2 < p.length; j += 2) if (segDist(x, y, p[j], p[j + 1], p[j + 2], p[j + 3]) <= tol) return { w, seg: j / 2 };
    }
    return null;
  }
  hitText(x, y) {
    for (const t of this.sh.texts) {
      const lines = String(t.text).split('\n');
      const w = Math.max(...lines.map((l) => l.length)) * t.size * 0.55;
      if (x >= t.x - 1 && x <= t.x + w + 1 && y >= t.y - t.size && y <= t.y + lines.length * t.size * 1.25) return t;
    }
    return null;
  }
  /** Anschlusspunkt in der Nähe (Pins, Leitungsenden/-ecken). */
  snapTarget(x, y, tol) {
    let best = null, bd = tol;
    for (const part of this.sh.parts) for (const p of partPins(part)) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = [p.x, p.y]; } }
    for (const w of this.sh.wires) for (let i = 0; i < w.pts.length; i += 2) { const d = Math.hypot(w.pts[i] - x, w.pts[i + 1] - y); if (d < bd) { bd = d; best = [w.pts[i], w.pts[i + 1]]; } }
    return best;
  }
  isConnPoint(x, y) {
    if (this.sh.parts.some((p) => partPins(p).some((q) => same(q.x, q.y, x, y)))) return true;
    return this.sh.wires.some((w) => { const p = w.pts; for (let i = 0; i < p.length; i += 2) if (same(p[i], p[i + 1], x, y)) return true; for (let i = 0; i + 2 < p.length; i += 2) if (onSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3])) return true; return false; });
  }

  // ------------------------------------------------------------ Eingabe
  pt(e) { return { id: e.pointerId, sx: e.clientX - this.rect.left, sy: e.clientY - this.rect.top, type: e.pointerType || 'mouse', t: e.timeStamp }; }

  fingerPans() {
    const st = getSettings();
    return st.finger === 'pan' || (st.finger !== 'draw' && st.pencilSeen);
  }

  onDown(e) {
    e.preventDefault();
    closePopover();
    this.rect = this.canvas.getBoundingClientRect();
    const p = this.pt(e);
    try { this.canvas.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    this.pointers.set(p.id, { ...p, x0: p.sx, y0: p.sy });
    if (p.type === 'pen' && !getSettings().pencilSeen) saveSettings({ pencilSeen: true });
    const touches = [...this.pointers.values()].filter((q) => q.type === 'touch');
    if (p.type === 'touch') {
      if (touches.length === 1) this.tap = { t0: p.t, max: 1, moved: false };
      else if (this.tap) this.tap.max = Math.max(this.tap.max, touches.length);
    }
    if (touches.length >= 2) {
      // zwei Finger: bewegen und zoomen (angefangene Aktion verwerfen)
      if (this.drag && this.drag.before) this.restoreDrag();
      if (this.drag && this.drag.kind === 'ink') this.inkDraft = null;
      this.drag = null; this.band = null; this.lassoPts = null;
      if (this.draft && this.draft.dragging) this.draft = null;
      const [a, b] = touches;
      this.pinch = { d: Math.hypot(b.sx - a.sx, b.sy - a.sy) || 1, cx: (a.sx + b.sx) / 2, cy: (a.sy + b.sy) / 2, v: { ...this.view } };
      this.draw();
      return;
    }
    const [wx, wy] = this.toWorld(p.sx, p.sy);
    const tol = 9 / this.view.s;
    this.down = { ...p, wx, wy, moved: false };
    if (e.button === 1 || e.button === 2) { this.drag = { kind: 'pan', v: { ...this.view } }; return; }
    const finger = p.type === 'touch';
    const T = this.tool;

    // Platzieren: auf ein vorhandenes Bauteil drücken = es verschieben
    if (T === 'place') {
      const part = this.hitPart(wx, wy);
      if (part && !part.lock) { this.clearSel(); this.sel.parts.add(part.id); this.drag = { kind: 'move', before: this.snap(), orig: JSON.parse(JSON.stringify(this.sh)), placeTap: true }; return; }
      this.drag = { kind: 'tap' };
      return;
    }
    if (T === 'text') { this.drag = { kind: 'tap' }; return; }
    if (finger && this.fingerPans() && ['wire', 'wall', 'draw', 'erase', 'lasso', 'plate', 'rail', 'duct'].includes(T)) { this.drag = { kind: 'pan', v: { ...this.view } }; return; }
    if (T === 'wire' || T === 'wall') {
      const s = (T === 'wire' ? this.snapTarget(wx, wy, tol) : this.wallSnap(wx, wy, tol)) || [snap(wx, T === 'wall' ? 2.5 : GRID), snap(wy, T === 'wall' ? 2.5 : GRID)];
      this.drag = { kind: 'wire', start: s, wall: T === 'wall' };
      return;
    }
    if (T === 'plate' || T === 'rail' || T === 'duct') {
      const g = 1.25;
      this.drag = { kind: 'shape', shape: T, a: [snap(wx, g), snap(wy, g)] };
      this.shapeDraft = null;
      return;
    }
    if (T === 'draw') {
      this.inkDraft = { id: uid(), pts: [round1(wx), round1(wy)], ...this.inkStyle() };
      this.drag = { kind: 'ink' };
      this.draw();
      return;
    }
    if (T === 'erase') { this.drag = { kind: 'erase', before: this.snap(), hit: false }; this.eraseAt(wx, wy); return; }
    if (T === 'lasso') {
      const sb = this.selBox();
      if (sb && wx >= sb.x0 && wx <= sb.x1 && wy >= sb.y0 && wy <= sb.y1 && !this.selLocked()) {
        this.drag = { kind: 'move', before: this.snap(), orig: JSON.parse(JSON.stringify(this.sh)) };
        return;
      }
      this.lassoPts = [wx, wy];
      this.drag = { kind: 'lasso' };
      return;
    }
    // Auswählen
    const part = this.hitPart(wx, wy);
    const txt = !part && this.hitText(wx, wy);
    const wire = !part && !txt && this.hitWire(wx, wy, tol * 0.7);
    const ink = !part && !txt && !wire && this.hitInk(wx, wy, tol * 0.7);
    const wall = !part && !txt && !wire && !ink && this.hitWall(wx, wy, tol * 0.7);
    if (part || txt || ink || wall) {
      const it = part || txt || ink || wall;
      const which = part ? 'parts' : txt ? 'texts' : ink ? 'ink' : 'walls';
      if (!this.sel[which].has(it.id)) { if (!e.shiftKey) this.clearSel(); this.sel[which].add(it.id); }
      const dbl = part && this.lastTap && this.lastTap.id === it.id && e.timeStamp - this.lastTap.t < 380;
      this.lastTap = part ? { id: it.id, t: e.timeStamp } : null;
      if (this.selLocked()) this.drag = { kind: 'locked', dbl };
      else this.drag = { kind: 'move', before: this.snap(), orig: JSON.parse(JSON.stringify(this.sh)), dbl };
      this.updateCtx(); this.draw();
      return;
    }
    if (wire) {
      if (!this.sel.wires.has(wire.w.id) || this.selCount() > 1) { if (!e.shiftKey) this.clearSel(); this.sel.wires.add(wire.w.id); }
      this.drag = { kind: 'seg', before: this.snap(), wire: wire.w.id, seg: wire.seg, orig: wire.w.pts.slice() };
      this.updateCtx(); this.draw();
      return;
    }
    const tr = titleRect(this.sh);
    const inTitle = wx >= tr.x0 && wx <= tr.x1 && wy >= tr.y0 && wy <= tr.y1;
    if (finger) this.drag = { kind: 'pan', v: { ...this.view }, tapClear: true, title: inTitle };
    else this.drag = { kind: 'band', title: inTitle };
  }

  onMove(e) {
    const p = this.pt(e);
    const q = this.pointers.get(p.id);
    const [wx, wy] = this.toWorld(p.sx, p.sy);
    if (!q) {
      // Schweben (Maus/Pencil)
      if (this.tool === 'place') {
        this.ghostAt = [snap(wx), snap(wy)];
        if (this.kind === 'cabinet' && getSym(this.placeType)?.kind === 'cab') { const g = { type: this.placeType, x: snap(wx, 0.5), y: snap(wy, 0.5), k: this.cabK, rot: this.placeRot || 0 }; this.dock(g); this.ghostAt = [g.x, g.y]; }
        this.draw();
      }
      if (this.tool === 'wire' || this.tool === 'wall') {
        this.hover = this.tool === 'wire' ? this.snapTarget(wx, wy, 9 / this.view.s) : null;
        if (this.draft) this.draft.cursor = this.hover || [snap(wx, this.tool === 'wall' ? 2.5 : GRID), snap(wy, this.tool === 'wall' ? 2.5 : GRID)];
        this.draw();
      }
      return;
    }
    q.sx = p.sx; q.sy = p.sy;
    if (this.tap && Math.hypot(p.sx - q.x0, p.sy - q.y0) > 10) this.tap.moved = true;
    if (this.pinch) {
      const t = [...this.pointers.values()].filter((x) => x.type === 'touch');
      if (t.length < 2) return;
      const [a, b] = t;
      const P = this.pinch, d = Math.hypot(b.sx - a.sx, b.sy - a.sy) || 1;
      const s = clamp(P.v.s * (d / P.d), 0.6, 30);
      const cx = (a.sx + b.sx) / 2, cy = (a.sy + b.sy) / 2;
      this.view = { s, x: cx - ((P.cx - P.v.x) * s) / P.v.s, y: cy - ((P.cy - P.v.y) * s) / P.v.s };
      this.draw();
      return;
    }
    const D = this.down;
    if (!D || !this.drag) return;
    const dr = this.drag;
    if (dr.kind === 'ink') {
      const list = (e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e]).map((ev) => this.toWorld(ev.clientX - this.rect.left, ev.clientY - this.rect.top));
      const pts = this.inkDraft.pts;
      for (const [x, y] of list) if (Math.hypot(x - pts[pts.length - 2], y - pts[pts.length - 1]) > 0.25) pts.push(round1(x), round1(y));
      D.moved = true;
      this.draw();
      return;
    }
    if (dr.kind === 'erase') { this.eraseAt(wx, wy); return; }
    if (dr.kind === 'shape') { this.shapeDraft = this.makeShape(dr.shape, dr.a, [snap(wx, 1.25), snap(wy, 1.25)]); this.draw(); return; }
    if (!D.moved && Math.hypot(p.sx - D.sx, p.sy - D.sy) > 6) D.moved = true;
    if (!D.moved) return;
    if (dr.kind === 'pan') { this.view.x = dr.v.x + p.sx - D.sx; this.view.y = dr.v.y + p.sy - D.sy; this.draw(); return; }
    if (dr.kind === 'tap' && p.type === 'touch') { dr.kind = 'pan'; dr.v = { ...this.view }; return; }
    if (dr.kind === 'move') {
      const g = this.kind === 'cabinet' ? 0.5 : GRID;
      this.applyMove(dr.orig, snap(wx - D.wx, g), snap(wy - D.wy, g));
      if (this.kind === 'cabinet' && this.sel.parts.size === 1 && !this.sel.walls.size) { const part = this.sh.parts.find((x) => this.sel.parts.has(x.id)); if (part && getSym(part.type)?.kind === 'cab') this.dock(part); }
      this.draw();
      return;
    }
    if (dr.kind === 'seg') { this.applySeg(dr, snap(wx - D.wx), snap(wy - D.wy)); this.draw(); return; }
    if (dr.kind === 'band') { this.band = [D.wx, D.wy, wx, wy]; this.draw(); return; }
    if (dr.kind === 'lasso') { const L = this.lassoPts; if (Math.hypot(wx - L[L.length - 2], wy - L[L.length - 1]) > 0.8) L.push(wx, wy); this.draw(); return; }
    if (dr.kind === 'wire') {
      const g = dr.wall ? 2.5 : GRID;
      const tgt = (dr.wall ? this.wallSnap(wx, wy, 9 / this.view.s) : this.snapTarget(wx, wy, 9 / this.view.s)) || [snap(wx, g), snap(wy, g)];
      this.hover = dr.wall ? null : tgt;
      this.draft = { pts: [...dr.start], cursor: tgt, dragging: true, wall: dr.wall };
      this.draw();
    }
  }

  onUp(e, cancelled) {
    const p = this.pt(e);
    this.pointers.delete(p.id);
    // Zwei Finger tippen = Rückgängig, drei = Wiederholen (wie beim Schreiben)
    if (p.type === 'touch' && this.tap && ![...this.pointers.values()].some((x) => x.type === 'touch')) {
      const tp = this.tap; this.tap = null;
      if (!tp.moved && !cancelled && p.t - tp.t0 < 380 && tp.max >= 2 && getSettings().tapUndo !== false) {
        this.pinch = null; this.drag = null; this.down = null;
        if (tp.max === 2) { this.undo(); this.flash('Rückgängig'); } else { this.redo(); this.flash('Wiederholen'); }
        return;
      }
    }
    if (this.pinch) { if ([...this.pointers.values()].filter((x) => x.type === 'touch').length < 2) this.pinch = null; this.drag = null; this.down = null; return; }
    const D = this.down, dr = this.drag;
    this.down = null; this.drag = null;
    if (!D || !dr || cancelled) { this.band = null; this.lassoPts = null; this.inkDraft = null; this.draw(); return; }
    const [wx, wy] = this.toWorld(p.sx, p.sy);
    switch (dr.kind) {
      case 'pan':
        if (dr.tapClear && !D.moved) {
          if (dr.title) { this.titleDialog(); break; }
          this.clearSel(); this.draw();
        }
        break;
      case 'tap':
        if (D.moved) break;
        if (this.tool === 'place') this.placeAt(this.kind === 'cabinet' ? snap(wx, 0.5) : snap(wx), this.kind === 'cabinet' ? snap(wy, 0.5) : snap(wy));
        else if (this.tool === 'text') this.addText(snap(wx, 2.5), snap(wy, 2.5));
        break;
      case 'locked':
        if (D.moved) toast('Gesperrt – zum Verschieben erst entsperren'); else if (dr.dbl) this.editProps();
        break;
      case 'move':
        if (!D.moved) { if (dr.dbl) this.editProps(); break; }
        this.A = null;
        this.commit(dr.before);
        break;
      case 'seg':
        if (!D.moved) break;
        this.sh.wires = this.sh.wires.map((w) => (w.id === dr.wire ? { ...w, pts: simplify(w.pts) } : w));
        this.commit(dr.before);
        break;
      case 'ink': {
        const k = this.inkDraft;
        this.inkDraft = null;
        if (!k) break;
        const before = this.snap();
        this.sh.ink.push(k);
        this.commit(before);
        break;
      }
      case 'erase':
        if (dr.hit) this.commit(dr.before);
        break;
      case 'shape': {
        const sh = this.makeShape(dr.shape, dr.a, [snap(wx, 1.25), snap(wy, 1.25)]);
        this.shapeDraft = null;
        if (sh && (Math.abs(sh.pts[2] - sh.pts[0]) > 3 || Math.abs(sh.pts[3] - sh.pts[1]) > 3)) {
          const before = this.snap();
          this.sh.walls.push(sh);
          this.commit(before);
        } else this.draw();
        break;
      }
      case 'lasso': {
        const poly = this.lassoPts;
        this.lassoPts = null;
        if (!poly || poly.length < 6) { this.clearSel(); this.draw(); break; }
        if (!e.shiftKey) this.clearSel();
        const inside = (x, y) => pointInPoly(x, y, poly);
        for (const part of this.sh.parts) if (inside(part.x, part.y)) this.sel.parts.add(part.id);
        for (const w of this.sh.wires) { let all = true; for (let i = 0; i < w.pts.length; i += 2) if (!inside(w.pts[i], w.pts[i + 1])) all = false; if (all) this.sel.wires.add(w.id); }
        for (const w of this.sh.walls) { let all = true; for (let i = 0; i < w.pts.length; i += 2) if (!inside(w.pts[i], w.pts[i + 1])) all = false; if (all) this.sel.walls.add(w.id); }
        for (const t of this.sh.texts) if (inside(t.x, t.y)) this.sel.texts.add(t.id);
        for (const k of this.sh.ink) { let n = 0; for (let i = 0; i < k.pts.length; i += 2) if (inside(k.pts[i], k.pts[i + 1])) n++; if (n * 2 >= k.pts.length / 2) this.sel.ink.add(k.id); }
        this.updateCtx(); this.draw();
        break;
      }
      case 'band': {
        if (!D.moved) { if (dr.title) { this.titleDialog(); break; } this.clearSel(); this.draw(); break; }
        const [ax, ay, bx, by] = this.band;
        const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
        const inR = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
        if (!e.shiftKey) this.clearSel();
        for (const part of this.sh.parts) { const b = partBox(part); if (b.x0 >= x0 && b.x1 <= x1 && b.y0 >= y0 && b.y1 <= y1) this.sel.parts.add(part.id); }
        for (const w of this.sh.wires) { let all = true; for (let i = 0; i < w.pts.length; i += 2) if (!inR(w.pts[i], w.pts[i + 1])) all = false; if (all) this.sel.wires.add(w.id); }
        for (const w of this.sh.walls) { let all = true; for (let i = 0; i < w.pts.length; i += 2) if (!inR(w.pts[i], w.pts[i + 1])) all = false; if (all) this.sel.walls.add(w.id); }
        for (const t of this.sh.texts) if (inR(t.x, t.y)) this.sel.texts.add(t.id);
        for (const k of this.sh.ink) { let all = true; for (let i = 0; i < k.pts.length; i += 2) if (!inR(k.pts[i], k.pts[i + 1])) all = false; if (all) this.sel.ink.add(k.id); }
        this.band = null;
        this.updateCtx(); this.draw();
        break;
      }
      case 'wire': {
        const g = dr.wall ? 2.5 : GRID;
        const tgt = (dr.wall ? this.wallSnap(wx, wy, 9 / this.view.s) : this.snapTarget(wx, wy, 9 / this.view.s)) || [snap(wx, g), snap(wy, g)];
        if (D.moved) {
          const pts = simplify([...dr.start, ...lRoute(dr.start[0], dr.start[1], tgt[0], tgt[1], this.vertFirst)]);
          this.draft = null;
          if (pts.length >= 4) (dr.wall ? this.addWall(pts) : this.addWire(pts));
          this.draw();
        } else this.wireTap(tgt, dr.wall);
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------ Aufbauplan
  makeShape(kind, a, b) {
    const k = this.cabK;
    if (kind === 'plate') return { id: uid(), kind, pts: [a[0], a[1], b[0], b[1]], label: `Montageplatte ${Math.round(Math.abs(b[0] - a[0]) / k)} × ${Math.round(Math.abs(b[1] - a[1]) / k)} mm` };
    const horiz = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const real = kind === 'rail' ? (this.railW || 35) : (this.ductW || 60);
    const pts = horiz ? [a[0], a[1], b[0], a[1]] : [a[0], a[1], a[0], b[1]];
    return { id: uid(), kind, pts, t: real * k, k, label: kind === 'duct' ? `Kabelkanal ${real}` : `TS${real}` };
  }

  /** Gerät auf eine Hutschiene einrasten und an Nachbargeräte andocken. */
  dock(part) {
    const b0 = partBox(part);
    const h = b0.y1 - b0.y0, w = b0.x1 - b0.x0;
    let best = null, bd = Infinity;
    for (const r of this.sh.walls) {
      if (r.kind !== 'rail' || Math.abs(r.pts[1] - r.pts[3]) > 0.01) continue;
      const x0 = Math.min(r.pts[0], r.pts[2]), x1 = Math.max(r.pts[0], r.pts[2]);
      const d = Math.abs(part.y - r.pts[1]);
      if (part.x >= x0 - w / 2 && part.x <= x1 + w / 2 && d < h / 2 + r.t && d < bd) { bd = d; best = r; }
    }
    if (!best) return;
    part.y = best.pts[1];
    // an Nachbarn auf derselben Schiene andocken, ohne zu überlappen
    const others = this.sh.parts.filter((o) => o !== part && o.id !== part.id && getSym(o.type)?.kind === 'cab' && Math.abs(o.y - part.y) < 0.01).map(partBox);
    const tol = Math.max(1.5, 3 / this.view.s);
    const overlaps = (b) => others.some((ob) => b.x0 < ob.x1 - 0.01 && b.x1 > ob.x0 + 0.01);
    for (let round = 0; round < 4; round++) {
      const b = partBox(part);
      let best = null;
      for (const ob of others) {
        const hit = b.x0 < ob.x1 - 0.01 && b.x1 > ob.x0 + 0.01;
        for (const sh of [ob.x1 - b.x0, ob.x0 - b.x1]) {
          if (!hit && Math.abs(sh) > tol) continue;
          const nb = { ...b, x0: b.x0 + sh, x1: b.x1 + sh };
          if (overlaps(nb)) continue;
          if (!best || Math.abs(sh) < Math.abs(best)) best = sh;
        }
      }
      if (best == null || Math.abs(best) < 0.001) break;
      part.x += best;
    }
  }

  async deviceEditor(existing) {
    const inp = (v, ph, type = 'text') => el('input', { class: 'inp', type, value: v ?? '', placeholder: ph || '' });
    const name = inp(existing?.name, 'z. B. Frequenzumrichter'), w = inp(existing?.cw ?? 45, 'mm', 'number'), h = inp(existing?.ch ?? 90, 'mm', 'number');
    const prefix = inp(existing?.prefix ?? 'A', 'z. B. T, K, A'), val = inp(existing?.val, 'z. B. 24 V / 5 A, Artikelnummer');
    let color = existing?.fill || '#eef0f3';
    const colors = ['#eef0f3', '#d0d4d9', '#3b4048', '#ffffff', '#2f8a46', '#1d4fa0', '#ffd34d', '#e53935', '#c9ccd2', '#009999'];
    const sw = el('div', { class: 'swatch-row' }, colors.map((c) => { const b = el('button', { class: `cover-sw ${c === color ? 'on' : ''}`, type: 'button', style: { background: c } }); b.addEventListener('click', () => { color = c; sw.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); }); return b; }));
    const din = toggle(existing ? !!existing.dinT : true, () => {});
    const fld = (l, n, hint) => el('div', { class: 'field' }, el('div', { class: 'field-label' }, l), n, hint ? el('div', { class: 'field-hint' }, hint) : null);
    const buttons = [{ label: 'Abbrechen', value: null }];
    if (existing) buttons.push({ label: 'Löschen', value: 'del', danger: true });
    buttons.push({ label: 'Speichern', primary: true, value: () => (name.value.trim() && +w.value > 0 && +h.value > 0 ? 'save' : (toast('Name, Breite und Höhe angeben'), undefined)) });
    const r = await dialog({
      title: existing ? 'Gerät bearbeiten' : 'Eigenes Gerät', wide: true,
      body: el('div', null, el('p', { class: 'muted' }, 'Maße in Millimetern (Frontansicht). 1 TE = 17,5 mm. Das Gerät wird im Planmaßstab gezeichnet und rastet auf Hutschienen ein.'),
        el('div', { class: 'form-grid' }, fld('Name', name), fld('Kennbuchstabe (BMK)', prefix), fld('Breite (mm)', w), fld('Höhe (mm)', h), fld('Typ / Artikel', val)),
        fld('Farbe', sw), el('label', { class: 'row-toggle' }, el('span', null, 'Anschlussklemmen oben und unten zeichnen'), din)),
      buttons,
    });
    const list = (getSettings().schCustom || []).filter((c) => c.id !== existing?.id);
    if (r === 'del') { saveSettings({ schCustom: list }); unregisterCustom(existing.id); registerCustom(this.nb.schSymbols || []); this.fillLib(''); this.draw(); return; }
    if (r !== 'save') return;
    const def = { ...cab(name.value.trim(), +w.value, +h.value, prefix.value.trim().replace(/^-/, '').toUpperCase() || 'A', { din: din.checked, fill: color, val: val.value.trim() }), id: existing?.id || 'c_' + uid(), fill: color, dinT: din.checked };
    delete def.cat;
    saveSettings({ schCustom: [...list, def] });
    registerCustom([def]);
    if ((this.nb.schSymbols || []).some((c) => c.id === def.id)) this.nb.schSymbols = this.nb.schSymbols.map((c) => (c.id === def.id ? def : c));
    this.fillLib(''); this.saveSoon(); this.draw();
    toast(`„${def.name}“ gespeichert – unter „Eigene Bauteile“`);
  }

  // ------------------------------------------------------------ Freihand, Wände, Sperren
  inkStyle() { const st = getSettings().schInk || {}; return { c: st.c || '#1f5eff', w: st.w || 0.6 }; }
  setInk(patch) { saveSettings({ schInk: { ...this.inkStyle(), ...patch } }); this.updateCtx(); }

  eraseAt(x, y) {
    const r = Math.max(1.5, 12 / this.view.s);
    const before = this.sh.ink.length;
    this.sh.ink = this.sh.ink.filter((k) => {
      for (let i = 0; i < k.pts.length; i += 2) {
        const d = i + 2 < k.pts.length ? segDist(x, y, k.pts[i], k.pts[i + 1], k.pts[i + 2], k.pts[i + 3]) : Math.hypot(x - k.pts[i], y - k.pts[i + 1]);
        if (d <= r + (k.w || 0.5) / 2) return false;
      }
      return true;
    });
    if (this.sh.ink.length !== before) { if (this.drag) this.drag.hit = true; this.draw(); }
    this.eraserAt = [x, y, r];
    this.draw();
  }

  hitInk(x, y, tol) {
    for (let j = this.sh.ink.length - 1; j >= 0; j--) {
      const k = this.sh.ink[j];
      for (let i = 0; i + 2 < k.pts.length; i += 2) if (segDist(x, y, k.pts[i], k.pts[i + 1], k.pts[i + 2], k.pts[i + 3]) <= tol + (k.w || 0.5) / 2) return k;
      if (k.pts.length === 2 && Math.hypot(x - k.pts[0], y - k.pts[1]) <= tol) return k;
    }
    return null;
  }
  hitWall(x, y, tol) {
    for (let j = this.sh.walls.length - 1; j >= 0; j--) {
      const w = this.sh.walls[j];
      if (w.kind === 'plate') {
        const [ax, ay, bx, by] = w.pts;
        const edges = [[ax, ay, bx, ay], [bx, ay, bx, by], [bx, by, ax, by], [ax, by, ax, ay]];
        if (edges.some((e) => segDist(x, y, ...e) <= tol)) return w;
        continue;
      }
      for (let i = 0; i + 2 < w.pts.length; i += 2) if (segDist(x, y, w.pts[i], w.pts[i + 1], w.pts[i + 2], w.pts[i + 3]) <= tol + (w.t || 2.4) / 2) return w;
    }
    return null;
  }
  wallSnap(x, y, tol) {
    let best = null, bd = tol;
    for (const w of this.sh.walls) for (let i = 0; i < w.pts.length; i += 2) { const d = Math.hypot(w.pts[i] - x, w.pts[i + 1] - y); if (d < bd) { bd = d; best = [w.pts[i], w.pts[i + 1]]; } }
    return best;
  }
  addWall(pts) {
    const before = this.snap();
    this.sh.walls.push({ id: uid(), pts, t: this.wallT || 4.8 });
    this.commit(before);
  }

  selLocked() { const s = this.selected(); return s.parts.some((p) => p.lock) || s.texts.some((t) => t.lock); }
  selBox() {
    const s = this.selected();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const p of s.parts) { const b = partBox(p); add(b.x0, b.y0); add(b.x1, b.y1); }
    for (const w of [...s.wires, ...s.ink, ...s.walls]) for (let i = 0; i < w.pts.length; i += 2) add(w.pts[i], w.pts[i + 1]);
    for (const t of s.texts) { add(t.x, t.y - t.size); add(t.x + String(t.text).length * t.size * 0.5, t.y); }
    return x0 === Infinity ? null : { x0: x0 - 2, y0: y0 - 2, x1: x1 + 2, y1: y1 + 2 };
  }
  lockSel(lock) {
    const before = this.snap();
    for (const p of this.sh.parts) if (this.sel.parts.has(p.id)) p.lock = lock;
    for (const t of this.sh.texts) if (this.sel.texts.has(t.id)) t.lock = lock;
    this.commit(before);
    toast(lock ? 'Gesperrt – kann nicht mehr verschoben oder gelöscht werden' : 'Entsperrt');
  }

  flash(t) {
    let f = this.root.querySelector('.flash');
    if (!f) { f = el('div', { class: 'flash' }); this.root.append(f); }
    f.innerHTML = `${icon(t === 'Rückgängig' ? 'undo' : 'redo')}<span>${t}</span>`;
    f.hidden = false; f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
    clearTimeout(this.flashT); this.flashT = setTimeout(() => { f.hidden = true; }, 750);
  }

  async editWire() {
    const w = this.sh.wires.find((x) => this.sel.wires.has(x.id));
    if (!w) return;
    const n = el('input', { class: 'inp', type: 'number', min: '0', max: '7', value: w.n || '', placeholder: 'z. B. 3' });
    const label = el('input', { class: 'inp', type: 'text', value: w.label || '', placeholder: 'z. B. NYM-J 3×1,5' });
    const fld = (l, x, h) => el('div', { class: 'field' }, el('div', { class: 'field-label' }, l), x, h ? el('div', { class: 'field-hint' }, h) : null);
    const r = await dialog({ title: 'Leitung', body: el('div', { class: 'form-grid' }, fld('Aderzahl (Schrägstriche)', n, 'Im Installationsplan üblich, z. B. 3 für L, N, PE.'), fld('Bezeichnung', label)),
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Übernehmen', value: true, primary: true }] });
    if (!r) return;
    const before = this.snap();
    w.n = Math.max(0, Math.min(7, parseInt(n.value, 10) || 0));
    w.label = label.value.trim();
    this.commit(before);
  }

  restoreDrag() { const o = JSON.parse(this.drag.before); this.pages[this.idx].sch = o.sch; this.A = null; }

  onWheel(e) {
    e.preventDefault();
    const sx = e.clientX - this.rect.left, sy = e.clientY - this.rect.top;
    if (e.ctrlKey || e.metaKey) {
      const v = this.view, s = clamp(v.s * Math.exp(-e.deltaY * 0.01), 0.6, 30);
      this.view = { s, x: sx - ((sx - v.x) * s) / v.s, y: sy - ((sy - v.y) * s) / v.s };
    } else { this.view.x -= e.deltaX; this.view.y -= e.deltaY; }
    this.draw();
  }

  onKey(e) {
    if (!this.isOpen) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.querySelector('.dlg-back')) return;
    const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); this.redo(); return; }
    if (mod && k === 'c') { e.preventDefault(); this.copy(); return; }
    if (mod && k === 'v') { e.preventDefault(); this.paste(); return; }
    if (mod && k === 'd') { e.preventDefault(); this.duplicate(); return; }
    if (mod) return;
    if (k === 'escape') { if (this.draft) { this.draft = null; this.updateCtx(); this.draw(); } else this.setTool('select'); return; }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.deleteSel(); return; }
    if (k === 'r') { this.action('rotate'); return; }
    if (k === 'x') { this.action('mirror'); return; }
    if (k === 'w') this.setTool('wire');
    if (k === 'l') this.setTool('lasso');
    if (k === 'p') this.setTool('draw');
    if (k === 'e') this.setTool('erase');
    if (k === 'v') this.setTool('select');
    if (k === 't') this.setTool('text');
    if (k === 'enter' && this.draft) this.finishWire();
    if (k === '0') this.fit();
  }

  // ------------------------------------------------------------ Bearbeiten
  /** Verschieben mit „Gummiband“: angeschlossene Leitungen bleiben verbunden. */
  applyMove(orig, dx, dy) {
    const sel = this.sel;
    const sh = JSON.parse(JSON.stringify(orig));
    const pinMap = new Map(); // alter Pin-Key → neuer Punkt
    for (const part of sh.parts) {
      if (!sel.parts.has(part.id)) continue;
      for (const pin of partPins(part)) pinMap.set(key(pin.x, pin.y), [pin.x + dx, pin.y + dy]);
      part.x += dx; part.y += dy;
    }
    for (const t of sh.texts) if (sel.texts.has(t.id)) { t.x += dx; t.y += dy; }
    for (const k of sh.ink) if (sel.ink.has(k.id)) k.pts = k.pts.map((v, i) => v + (i % 2 ? dy : dx));
    for (const w of sh.walls) if (sel.walls.has(w.id)) w.pts = w.pts.map((v, i) => v + (i % 2 ? dy : dx));
    for (const w of sh.wires) {
      if (sel.wires.has(w.id)) { w.pts = w.pts.map((v, i) => v + (i % 2 ? dy : dx)); continue; }
      const n = w.pts.length;
      const a = pinMap.get(key(w.pts[0], w.pts[1])), b = pinMap.get(key(w.pts[n - 2], w.pts[n - 1]));
      if (a && b) { w.pts = w.pts.map((v, i) => v + (i % 2 ? dy : dx)); continue; }
      if (a) w.pts = moveEnd(w.pts, true, a[0], a[1]);
      if (b) w.pts = moveEnd(w.pts, false, b[0], b[1]);
    }
    this.pages[this.idx].sch = sh;
    this.A = null;
  }

  /** Leitungsabschnitt quer verschieben (Enden bleiben angeschlossen). */
  applySeg(dr, dx, dy) {
    let p = dr.orig.slice();
    const i = dr.seg * 2;
    const horiz = Math.abs(p[i + 1] - p[i + 3]) < 0.01;
    const lastSeg = i + 4 >= p.length;
    const firstSeg = i === 0;
    const mv = (j) => { if (horiz) p[j + 1] += dy; else p[j] += dx; };
    if (lastSeg) p.push(p[p.length - 2], p[p.length - 1]);
    if (firstSeg) { p.unshift(p[0], p[1]); }
    const k = firstSeg ? i + 2 : i;
    mv(k); mv(k + 2);
    const w = this.sh.wires.find((x) => x.id === dr.wire);
    if (w) w.pts = p;
    this.A = null;
  }

  nextRef(prefix) {
    let max = 0;
    const re = new RegExp(`^-?${prefix}(\\d+)$`, 'i');
    for (const sh of this.sheets()) for (const p of sh.parts) { const m = (p.ref || '').match(re); if (m) max = Math.max(max, +m[1]); }
    return `-${prefix}${max + 1}`;
  }

  placeAt(x, y) {
    const sym = getSym(this.placeType);
    const before = this.snap();
    let ref = '';
    const all = this.sheets().flatMap((x) => x.parts);
    const coilRefs = new Set(all.filter((x) => getSym(x.type)?.kind === 'coil').map((x) => x.ref));
    if (sym.kind === 'net') ref = this.lastNet || 'L1';
    else if (['no', 'nc', 'co'].includes(sym.kind) && !sym.own) ref = this.lastCoil || this.nextRef(sym.prefix);
    else if (sym.kind === 'coil') {
      // Kontakte, die schon vor ihrer Spule gesetzt wurden, bekommen jetzt ihre Spule
      const orphan = all.find((x) => ['no', 'nc', 'co'].includes(getSym(x.type)?.kind) && !getSym(x.type).own && x.ref && /^-?K/i.test(x.ref) && !coilRefs.has(x.ref));
      ref = orphan ? orphan.ref : this.nextRef(sym.prefix);
    } else if (sym.prefix) ref = this.nextRef(sym.prefix);
    const part = { id: uid(), type: this.placeType, x, y, rot: this.placeRot || 0, mir: !!this.placeMir, ref, val: sym.val || '', note: '' };
    if (sym.kind === 'cab') { part.k = this.cabK; part.x = x; part.y = y; this.dock(part); }
    if (sym.custom) {
      const list = (this.nb.schSymbols || []).filter((c) => c.id !== sym.id);
      const { custom, cat, ...def } = sym;
      this.nb.schSymbols = [...list, def];
    }
    if (sym.kind === 'coil') this.lastCoil = ref;
    this.sh.parts.push(part);
    this.commit(before);
    if (sym.kind === 'net') { this.sel.parts = new Set([part.id]); this.editProps(); }
  }

  wireTap(tgt, wall) {
    if (!this.draft) { this.draft = { pts: [...tgt], cursor: tgt, wall }; this.updateCtx(); this.draw(); return; }
    const pts = this.draft.pts;
    const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
    if (same(lx, ly, tgt[0], tgt[1])) { this.finishWire(); return; }
    pts.push(...lRoute(lx, ly, tgt[0], tgt[1], this.vertFirst));
    if (!this.draft.wall && pts.length >= 4 && this.isConnPoint(tgt[0], tgt[1])) { this.finishWire(); return; }
    this.updateCtx();
    this.draw();
  }

  draftPts() {
    const d = this.draft;
    if (!d) return [];
    const p = d.pts.slice();
    if (d.cursor) p.push(...lRoute(p[p.length - 2], p[p.length - 1], d.cursor[0], d.cursor[1], this.vertFirst));
    return p;
  }

  finishWire() {
    const d = this.draft;
    this.draft = null;
    if (d) { const pts = simplify(d.pts); if (pts.length >= 4) (d.wall ? this.addWall(pts) : this.addWire(pts)); }
    this.updateCtx();
    this.draw();
  }

  addWire(pts) {
    const before = this.snap();
    this.sh.wires.push({ id: uid(), pts });
    this.commit(before);
  }

  async addText(x, y, t) {
    const v = await prompt('Text', t ? t.text : '', { placeholder: 'z. B. Steuerstromkreis 24 V DC', okLabel: 'Setzen' });
    if (!v) return;
    const before = this.snap();
    if (t) t.text = v; else this.sh.texts.push({ id: uid(), x, y, text: v, size: 3.5 });
    this.commit(before);
  }
  editText() { const t = this.sh.texts.find((x) => this.sel.texts.has(x.id)); if (t) this.addText(t.x, t.y, t); }

  rotateSel() {
    if (!this.sel.parts.size) { toast('Bauteil auswählen, um es zu drehen'); return; }
    this.transformSel((p) => { p.rot = ((p.rot || 0) + 1) % 4; });
  }
  mirrorSel() {
    if (!this.sel.parts.size) { toast('Bauteil auswählen, um es zu spiegeln'); return; }
    this.transformSel((p) => { p.mir = !p.mir; });
  }
  transformSel(fn) {
    const before = this.snap();
    const sh = this.sh;
    const pinMap = new Map();
    for (const part of sh.parts) {
      if (!this.sel.parts.has(part.id) || part.lock) continue;
      const old = partPins(part);
      fn(part);
      partPins(part).forEach((np, i) => pinMap.set(key(old[i].x, old[i].y), [np.x, np.y]));
    }
    for (const w of sh.wires) {
      if (this.sel.wires.has(w.id)) continue;
      const n = w.pts.length;
      const a = pinMap.get(key(w.pts[0], w.pts[1])), b = pinMap.get(key(w.pts[n - 2], w.pts[n - 1]));
      if (a) w.pts = moveEnd(w.pts, true, a[0], a[1]);
      if (b) w.pts = moveEnd(w.pts, false, b[0], b[1]);
    }
    this.commit(before);
  }

  deleteSel() {
    if (!this.selCount()) { toast('Nichts ausgewählt'); return; }
    const before = this.snap();
    const s = this.sel;
    const kept = this.sh.parts.filter((p) => s.parts.has(p.id) && p.lock).length + this.sh.texts.filter((t) => s.texts.has(t.id) && t.lock).length;
    this.sh.parts = this.sh.parts.filter((p) => !s.parts.has(p.id) || p.lock);
    this.sh.wires = this.sh.wires.filter((w) => !s.wires.has(w.id));
    this.sh.texts = this.sh.texts.filter((t) => !s.texts.has(t.id) || t.lock);
    this.sh.ink = this.sh.ink.filter((k) => !s.ink.has(k.id));
    this.sh.walls = this.sh.walls.filter((w) => !s.walls.has(w.id));
    if (kept) toast(`${kept} gesperrte${kept === 1 ? 's Element' : ' Elemente'} nicht gelöscht`);
    this.clearSel();
    this.commit(before);
  }

  selected() {
    const s = this.sel, sh = this.sh;
    return { parts: sh.parts.filter((p) => s.parts.has(p.id)), wires: sh.wires.filter((w) => s.wires.has(w.id)), texts: sh.texts.filter((t) => s.texts.has(t.id)), ink: sh.ink.filter((k) => s.ink.has(k.id)), walls: sh.walls.filter((w) => s.walls.has(w.id)) };
  }
  copy() { if (!this.selCount()) return; this.clip = JSON.parse(JSON.stringify(this.selected())); toast('Kopiert'); this.updateCtx(); }
  paste(off = 10) {
    if (!this.clip) return;
    const before = this.snap();
    const c = JSON.parse(JSON.stringify(this.clip));
    this.clearSel();
    for (const p of c.parts) {
      p.id = uid(); p.x += off; p.y += off; p.lock = false;
      const sym = getSym(p.type);
      if (sym.prefix && !['no', 'nc', 'co'].includes(sym.kind) && sym.kind !== 'net') p.ref = this.nextRef(sym.prefix);
      this.sh.parts.push(p); this.sel.parts.add(p.id);
    }
    for (const w of c.wires) { w.id = uid(); w.pts = w.pts.map((v) => v + off); this.sh.wires.push(w); this.sel.wires.add(w.id); }
    for (const t of c.texts) { t.id = uid(); t.x += off; t.y += off; t.lock = false; this.sh.texts.push(t); this.sel.texts.add(t.id); }
    for (const k of c.ink || []) { k.id = uid(); k.pts = k.pts.map((v) => v + off); this.sh.ink.push(k); this.sel.ink.add(k.id); }
    for (const w of c.walls || []) { w.id = uid(); w.pts = w.pts.map((v) => v + off); this.sh.walls.push(w); this.sel.walls.add(w.id); }
    this.commit(before);
  }
  duplicate() { if (!this.selCount()) return; const keep = this.clip; this.copy(); this.paste(10); this.clip = keep; }

  async editProps() {
    const part = this.sh.parts.find((p) => this.sel.parts.has(p.id));
    if (!part) return;
    const sym = getSym(part.type);
    const inp = (v, ph) => el('input', { class: 'inp', type: 'text', value: v || '', placeholder: ph || '', autocomplete: 'off', autocapitalize: 'off' });
    const fld = (l, n, h) => el('div', { class: 'field' }, el('div', { class: 'field-label' }, l), n, h ? el('div', { class: 'field-hint' }, h) : null);
    if (sym.kind === 'net') {
      const f = inp(part.ref, 'L1, N, PE, +24V, 0V …');
      const quick = el('div', { class: 'swatch-row' }, ['L1', 'L2', 'L3', 'N', 'PE', '+24V', '0V', '+5V'].map((n) => el('button', { class: 'chip', type: 'button', onclick: () => { f.value = n; } }, n)));
      const r = await dialog({ title: 'Potential', body: el('div', null, fld('Name', f, 'Gleichnamige Potentiale sind verbunden – auch über Blätter hinweg.'), quick), buttons: [{ label: 'Abbrechen', value: null }, { label: 'Übernehmen', value: true, primary: true }], onOpen: () => setTimeout(() => f.select(), 60) });
      if (r) { const before = this.snap(); part.ref = f.value.trim() || part.ref; this.lastNet = part.ref; this.commit(before); }
      return;
    }
    const ref = inp(part.ref, `-${sym.prefix}1`), val = inp(part.val, 'z. B. 24 V DC, 10 kΩ'), note = inp(part.note, 'z. B. Hersteller, Artikelnummer');
    // Anschluss-/Kontaktnummern (leer = automatisch)
    const auto = this.analysis().pinLabels.get(part.id) || [];
    const pins = partPins(part);
    const pinInputs = pins.map((pin, i) => el('input', { class: 'inp pin-inp', type: 'text', value: (part.pl && part.pl[i]) || '', placeholder: auto[i] || sym.pins[i][2] || String(i + 1), autocomplete: 'off', autocapitalize: 'off' }));
    const pinBox = pins.length ? el('div', { class: 'field' }, el('div', { class: 'field-label' }, 'Anschluss- / Kontaktnummern'),
      el('div', { class: 'pin-row' }, pinInputs.map((x, i) => el('label', { class: 'pin-cell' }, el('small', null, `Anschluss ${i + 1}`), x))),
      el('div', { class: 'field-hint' }, 'Leer lassen = automatisch (z. B. 13-14 nach Reihenfolge). Eigene Nummern haben Vorrang.')) : null;
    const showRef = String(sym.cat).startsWith('Installation') ? el('label', { class: 'row-toggle' }, el('span', null, 'BMK im Plan anzeigen'), toggle(!!part.showRef, (v) => { part._showRef = v; })) : null;
    const r = await dialog({
      title: sym.name, wide: true,
      body: el('div', null, el('div', { class: 'form-grid' },
        fld('Betriebsmittelkennzeichen (BMK)', ref, ['no', 'nc', 'co'].includes(sym.kind) ? 'Gleiches BMK wie die Spule → Kontaktspiegel und Querverweis entstehen automatisch.' : ''),
        fld('Wert / Typ', val), fld('Bemerkung / Artikel', note)), pinBox, showRef),
      buttons: [{ label: 'Abbrechen', value: null }, ...(sym.kind !== 'cab' && sym.ops ? [{ label: 'Symbol zeichnen …', value: 'sym' }] : []), { label: 'Übernehmen', value: true, primary: true }],
      onOpen: () => setTimeout(() => ref.select(), 60),
    });
    if (r === 'sym') { this.symbolEditor(sym.custom ? sym : { ...sym, custom: false }, part); return; }
    if (!r) return;
    const before = this.snap();
    let rv = ref.value.trim();
    if (rv && !rv.startsWith('-') && /^[A-Za-z]/.test(rv)) rv = '-' + rv;
    Object.assign(part, { ref: rv, val: val.value.trim(), note: note.value.trim() });
    const pl = pinInputs.map((x) => x.value.trim());
    if (pl.some(Boolean)) part.pl = pl; else delete part.pl;
    if (part._showRef !== undefined) { part.showRef = part._showRef; delete part._showRef; }
    if (sym.kind === 'coil') this.lastCoil = rv;
    this.commit(before);
  }

  // ------------------------------------------------------------ Eigene Bauteile
  /**
   * Bauteil-Editor öffnen. existing: eigenes Bauteil (wird geändert) oder eingebautes (wird als Kopie gespeichert).
   * part: platziertes Bauteil, von dem aus bearbeitet wird (dann kann es direkt ersetzt werden).
   */
  async symbolEditor(existing, part = null) {
    const builtin = existing && !existing.custom;
    const copy = (o) => JSON.parse(JSON.stringify(o));
    const def = existing
      ? { id: builtin ? 'c_' + uid() : existing.id, name: builtin ? existing.name + ' (eigen)' : existing.name, prefix: existing.prefix || '', val: existing.val || '',
        kind: ['no', 'nc', 'co', 'coil'].includes(existing.kind) ? existing.kind : '', pins: copy(existing.pins || []), ops: copy(existing.ops || []) }
      : { id: 'c_' + uid(), name: '', prefix: 'X', val: '', kind: '', pins: [], ops: [] };
    const r = await openSymbolEditor({
      def, title: !existing ? 'Neues Bauteil' : builtin ? 'Bauteil bearbeiten (Kopie)' : 'Bauteil bearbeiten',
      canDelete: !!existing && !builtin, fromBuiltin: builtin ? existing.name : '', fromPart: !!part,
    });
    if (!r) return;
    const list = (getSettings().schCustom || []).filter((c) => c.id !== def.id);
    if (r.action === 'del') {
      saveSettings({ schCustom: list });
      unregisterCustom(def.id);
      registerCustom(this.nb.schSymbols || []);
      this.fillLib(''); this.draw();
      return;
    }
    const nd = r.def;
    if (!nd.kind) delete nd.kind;
    saveSettings({ schCustom: [...list, nd] });
    registerCustom([nd]);
    const before = this.snap();
    let changedPlan = false;
    if ((this.nb.schSymbols || []).some((c) => c.id === nd.id)) { this.nb.schSymbols = this.nb.schSymbols.map((c) => (c.id === nd.id ? nd : c)); changedPlan = true; }
    if (part && part.type !== nd.id) {
      // platziertes Bauteil (und auf Wunsch alle gleichen) durch das neue Symbol ersetzen
      const old = part.type;
      const targets = r.applyAll ? this.sheets().flatMap((x) => x.parts).filter((p) => p.type === old) : [part];
      for (const p of targets) { p.type = nd.id; if (p.pl && p.pl.length !== nd.pins.length) delete p.pl; }
      this.nb.schSymbols = [...(this.nb.schSymbols || []).filter((c) => c.id !== nd.id), nd];
      changedPlan = true;
    }
    this.A = null;
    this.fillLib('');
    if (changedPlan) this.commit(before); else { this.saveSoon(); this.draw(); }
    toast(`„${nd.name}“ gespeichert – unter „Eigene Bauteile“`);
  }

  // ------------------------------------------------------------ Prüfen
  checkDialog() {
    const A = analyze(this.sheets());
    const list = el('div', { class: 'issue-list' });
    if (!A.issues.length) list.append(el('div', { class: 'issue ok' }, el('span', { html: icon('check') }), el('span', null, 'Keine Probleme gefunden – alle Anschlüsse verbunden, keine doppelten BMK.')));
    A.issues.slice(0, 80).forEach((it) => {
      const b = el('button', { class: 'issue' }, el('span', { class: 'issue-dot' }), el('span', null, `Blatt ${it.s + 1}: ${it.text}`));
      b.addEventListener('click', () => {
        closeDlg && closeDlg(null);
        this.idx = it.s; this.refreshSheet();
        const [x, y] = it.part ? [it.part.x, it.part.y] : it.at;
        if (it.part) this.sel.parts.add(it.part.id);
        this.view = { s: Math.max(this.view.s, 5), x: 0, y: 0 };
        this.view.x = this.W / 2 - x * this.view.s; this.view.y = this.H / 2 - y * this.view.s;
        this.flashAt = { x, y, t: performance.now() };
        this.updateCtx(); this.draw();
      });
      list.append(b);
    });
    let closeDlg;
    dialog({
      title: A.issues.length ? `Prüfung: ${A.issues.length} Hinweis${A.issues.length === 1 ? '' : 'e'}` : 'Prüfung bestanden',
      wide: true,
      body: el('div', null, el('p', { class: 'muted' }, `${A.nets.length} Netze · ${this.sheets().reduce((s, x) => s + x.parts.length, 0)} Bauteile · ${this.pages.length} Blatt/Blätter`), list),
      buttons: [{ label: 'Schließen', value: true, primary: true }],
      onOpen: (box, c) => { closeDlg = c; },
    });
  }

  // ------------------------------------------------------------ Export
  exportMenu(anchor) {
    menu(anchor, [
      { title: 'Exportieren' },
      { label: 'PDF – alle Blätter', icon: 'pdf', run: () => this.exportPdf() },
      { label: 'SVG – dieses Blatt (Vektor)', icon: 'image', run: () => this.exportSvg() },
      { label: 'PNG – dieses Blatt', icon: 'image', run: () => this.exportPng() },
      { sep: true },
      { label: 'Stückliste (CSV)', icon: 'list', run: () => this.exportBom() },
      { label: 'Netzliste (CSV)', icon: 'network', run: () => this.exportNets() },
      { label: 'Klemmenplan (CSV)', icon: 'list', run: () => this.exportTerminals() },
    ]);
  }

  async exportPdf() {
    await this.save();
    const prog = progress('PDF wird erstellt');
    try {
      const imgs = [];
      const c = document.createElement('canvas');
      for (let i = 0; i < this.pages.length; i++) {
        prog.set(i / this.pages.length, `Blatt ${i + 1} von ${this.pages.length}`);
        const S = SHEET_SIZES[this.pages[i].sch.size] || SHEET_SIZES.A4;
        const k = Math.min(10, Math.sqrt(14e6 / (S.w * S.h)));
        this.renderTo(c, i, k);
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
        imgs.push({ bytes: new Uint8Array(await blob.arrayBuffer()), pxW: c.width, pxH: c.height, ptW: S.w * 2.8346, ptH: S.h * 2.8346 });
      }
      c.width = c.height = 0;
      prog.close();
      await offerFile(buildPdf(imgs, this.nb.name), `${safeFileName(this.nb.name)}.pdf`, 'PDF ist fertig');
    } catch (e) { console.error(e); prog.close(); toast('Export fehlgeschlagen.'); }
  }

  exportSvg() {
    const S = SHEET_SIZES[this.sh.size] || SHEET_SIZES.A4;
    const pen = new SvgPen();
    renderSheet(pen, this.sheets(), this.idx, this.analysis(), this.nb.schMeta, {});
    offerFile(new Blob([pen.svg(S.w, S.h)], { type: 'image/svg+xml' }), `${safeFileName(this.nb.name)} – Blatt ${this.idx + 1}.svg`, 'SVG ist fertig');
  }

  async exportPng() {
    const c = this.renderTo(document.createElement('canvas'), this.idx, 8);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    offerFile(blob, `${safeFileName(this.nb.name)} – Blatt ${this.idx + 1}.png`, 'Bild ist fertig');
  }

  csv(rows) {
    const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return new Blob(['﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  exportBom() {
    const groups = new Map();
    this.sheets().forEach((sh, s) => sh.parts.forEach((p) => {
      const sym = getSym(p.type);
      if (!sym || ['net', 'gnd'].includes(sym.kind) || (['no', 'nc', 'co'].includes(sym.kind) && !sym.own)) return;
      const k = `${p.type}|${p.val}|${p.note}`;
      if (!groups.has(k)) groups.set(k, { sym, val: p.val, note: p.note, refs: [] });
      groups.get(k).refs.push(p.ref || '?');
    }));
    const rows = [['Pos.', 'Menge', 'BMK', 'Benennung', 'Wert / Typ', 'Bemerkung / Artikel']];
    [...groups.values()].sort((a, b) => a.refs[0].localeCompare(b.refs[0], 'de', { numeric: true })).forEach((g, i) =>
      rows.push([i + 1, g.refs.length, g.refs.sort((a, b) => a.localeCompare(b, 'de', { numeric: true })).join(', '), g.sym.name, g.val, g.note]));
    offerFile(this.csv(rows), `${safeFileName(this.nb.name)} – Stückliste.csv`, 'Stückliste ist fertig');
  }

  exportNets() {
    const A = analyze(this.sheets());
    const rows = [['Netz', 'Anschlüsse', 'Anzahl']];
    for (const n of A.nets) {
      rows.push([n.name, n.pins.map((q) => `${q.part.ref || getSym(q.part.type).name}:${A.pinLabels.get(q.part.id)?.[q.pin.i] || q.pin.name || q.pin.i + 1}`).join(', '), n.pins.length]);
    }
    offerFile(this.csv(rows), `${safeFileName(this.nb.name)} – Netzliste.csv`, 'Netzliste ist fertig');
  }

  exportTerminals() {
    const A = analyze(this.sheets());
    const pinNet = new Map();
    for (const n of A.nets) for (const q of n.pins) pinNet.set(`${q.part.id}:${q.pin.i}`, n.name);
    const rows = [['Klemme', 'Potential oben/1', 'Potential unten/2', 'Blatt', 'Bemerkung']];
    this.sheets().forEach((sh, s) => sh.parts.filter((p) => p.type === 'terminal').forEach((p) => rows.push([p.ref, pinNet.get(`${p.id}:0`) || '', pinNet.get(`${p.id}:1`) || '', s + 1, p.note])));
    if (rows.length === 1) { toast('Keine Klemmen im Plan'); return; }
    offerFile(this.csv(rows), `${safeFileName(this.nb.name)} – Klemmenplan.csv`, 'Klemmenplan ist fertig');
  }

  moreMenu(anchor) {
    menu(anchor, [
      { label: 'Schriftfeld bearbeiten …', icon: 'pencil', run: () => this.titleDialog() },
      { label: 'Neues Blatt', icon: 'plus', run: () => this.addSheet() },
      { label: 'Plan prüfen', icon: 'checkCircle', run: () => this.checkDialog() },
      { sep: true },
      { label: 'Alles auswählen', icon: 'grid', run: () => { this.sh.parts.forEach((p) => this.sel.parts.add(p.id)); this.sh.wires.forEach((w) => this.sel.wires.add(w.id)); this.sh.texts.forEach((t) => this.sel.texts.add(t.id)); this.updateCtx(); this.draw(); } },
      { label: 'Hilfe', icon: 'info', run: () => schematicHelp() },
    ]);
  }
}

export function schematicHelp() {
  const rows = [
    ['Bauteile', 'Links „Bauteile“ öffnen, Symbol antippen, dann auf das Blatt tippen (mehrfach möglich)'],
    ['Verdrahten (W)', 'Startpunkt antippen, Ecken antippen – auf einem Anschluss endet die Leitung. Oder mit dem Stift von Anschluss zu Anschluss ziehen.'],
    ['Verschieben', 'Bauteil ziehen – angeschlossene Leitungen bleiben verbunden'],
    ['Leitung anpassen', 'Einen Leitungsabschnitt quer ziehen'],
    ['Mehrere auswählen', 'Mit Stift/Maus einen Rahmen ziehen'],
    ['Eigenschaften', 'Bauteil doppelt antippen: BMK, Wert, Bemerkung'],
    ['Kontaktspiegel', 'Kontakte mit gleichem BMK wie die Spule (z. B. -K1) bekommen automatisch Nummern (13-14, 21-22) und Querverweise (/Blatt.Spalte)'],
    ['Potentiale', 'L1, N, PE, +24V … setzen – gleichnamige Potentiale sind verbunden, auch über Blätter'],
    ['Verbindungspunkte', 'Entstehen nur an Enden und T-Abzweigen – Kreuzungen bleiben unverbunden'],
    ['Im Platzier-Modus', 'Auf ein vorhandenes Bauteil drücken und ziehen = verschieben'],
    ['Schloss', 'Auswählen → „Sperren“: Bauteil lässt sich nicht mehr verschieben, drehen oder löschen'],
    ['Lasso', 'Einkreisen, dann in den Rahmen tippen und ziehen'],
    ['Stift & Radierer', 'Frei in den Plan zeichnen und notieren – Radierer entfernt nur Freihand-Striche'],
    ['Kontaktnummern', 'Eigenschaften → Anschluss-/Kontaktnummern überschreiben (leer = automatisch)'],
    ['Schriftfeld', 'Unten rechts antippen zum Bearbeiten'],
    ['Eigene Bauteile', 'Bauteile → „Neues Bauteil“: zeichnen, Anschlüsse setzen, speichern'],
    ['Installationsplan', 'Wand-Werkzeug, Installationssymbole, Leitung auswählen → „Leitung …“ für Aderzahl'],
    ['Zwei Finger', 'Ziehen/spreizen = bewegen & zoomen · tippen = Rückgängig · drei Finger tippen = Wiederholen'],
    ['Tastatur', 'R drehen · X spiegeln · W verdrahten · L Lasso · P Stift · E Radierer · V auswählen · Entf löschen · ⌘Z/⌘C/⌘V/⌘D'],
  ];
  dialog({ title: 'Stromlaufplan – Hilfe', wide: true, body: el('div', { class: 'help-list' }, rows.map(([a, b]) => el('div', { class: 'help-row' }, el('span', { class: 'help-k' }, a), el('span', null, b)))), buttons: [{ label: 'Alles klar', value: true, primary: true }] });
}

function symbolPreview(type) {
  const c = document.createElement('canvas');
  const d = Math.min(window.devicePixelRatio || 1, 2), size = 46;
  c.width = c.height = size * d;
  c.style.width = c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  const part = { type, x: 0, y: 0, rot: 0, ref: getSym(type).kind === 'net' ? 'L1' : '' };
  const b = partBox(part);
  const k = Math.min((size - 8) / Math.max(1, b.x1 - b.x0), (size - 8) / Math.max(1, b.y1 - b.y0)) * d;
  ctx.setTransform(k, 0, 0, k, (size * d) / 2 - ((b.x0 + b.x1) / 2) * k, (size * d) / 2 - ((b.y0 + b.y1) / 2) * k);
  const pen = new CanvasPen(ctx, 1.4 * d / k);
  const color = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#16161a';
  drawSymbol(pen, part, color);
  if (getSym(type).kind === 'net') pen.text(1.6, -1, 'L1', 3, 'left', color, 'alphabetic', true);
  return c;
}
