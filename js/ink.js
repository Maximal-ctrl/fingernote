// Darstellung: Papier, Linien-Vorlagen, Striche, Texte, Bilder.
// Alle Koordinaten sind Seiten-Einheiten (eine A4-Seite ist 1000 breit, 1414 hoch).

import * as db from './db.js';
import { clamp } from './util.js';

export const PAGE_W = 1000;
export const A4_H = 1414;

export const PAPERS = {
  white: { bg: '#ffffff', line: 'rgba(60,95,140,0.22)', strong: 'rgba(60,95,140,0.42)', label: 'Weiß' },
  cream: { bg: '#fbf6e8', line: 'rgba(130,105,60,0.22)', strong: 'rgba(130,105,60,0.42)', label: 'Creme' },
  gray: { bg: '#eef0f3', line: 'rgba(60,80,110,0.20)', strong: 'rgba(60,80,110,0.40)', label: 'Grau' },
  dark: { bg: '#24262b', line: 'rgba(255,255,255,0.13)', strong: 'rgba(255,255,255,0.30)', label: 'Dunkel' },
};

export const TEMPLATES = {
  blank: 'Blanko',
  lined: 'Liniert',
  grid: 'Kariert',
  dots: 'Punktiert',
  cornell: 'Cornell',
  music: 'Notenpapier',
};

export const FORMATS = {
  portrait: { label: 'A4 Hochformat', w: PAGE_W, h: A4_H },
  landscape: { label: 'A4 Querformat', w: A4_H, h: PAGE_W },
  endless: { label: 'Endlos', w: PAGE_W, h: A4_H, endless: true },
};

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const fontStr = (size, bold, italic) => `${italic ? 'italic ' : ''}${bold ? '600' : '400'} ${size}px ${FONT}`;

// ---------------------------------------------------------------- Papier
export function drawPaper(ctx, page, vis) {
  const P = PAPERS[page.paper] || PAPERS.white;
  const W = page.w, H = page.h;
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);
  if (page.bg) {
    const img = getImage(page.bg);
    if (img) ctx.drawImage(img, 0, 0, W, H);
    return; // PDF-/Bildseiten ohne Linien
  }
  const y0 = vis ? Math.max(0, vis.y0) : 0;
  const y1 = vis ? Math.min(H, vis.y1) : H;
  const x0 = vis ? Math.max(0, vis.x0) : 0;
  const x1 = vis ? Math.min(W, vis.x1) : W;
  // Linien nie dünner als ca. ein Bildpunkt (kleine Vorschaubilder)
  const k = ctx.getTransform ? Math.abs(ctx.getTransform().a) || 1 : 1;
  const lw = (w) => Math.max(w, 0.85 / k);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = lw(1);
  switch (page.template) {
    case 'lined': {
      const sp = 34, top = 120;
      ctx.beginPath();
      for (let y = top + Math.max(0, Math.ceil((y0 - top) / sp)) * sp; y <= Math.min(y1, H - 40); y += sp) {
        ctx.moveTo(0, y); ctx.lineTo(W, y);
      }
      ctx.stroke();
      break;
    }
    case 'grid': {
      const sp = 25, ox = (W % sp) / 2, oy = (H % sp) / 2;
      ctx.lineWidth = lw(0.8);
      ctx.beginPath();
      for (let x = ox + Math.max(0, Math.floor((x0 - ox) / sp)) * sp; x <= x1; x += sp) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let y = oy + Math.max(0, Math.floor((y0 - oy) / sp)) * sp; y <= y1; y += sp) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.stroke();
      break;
    }
    case 'dots': {
      const sp = 25, ox = (W % sp) / 2, oy = (H % sp) / 2;
      ctx.fillStyle = P.strong;
      const dr = Math.max(1.5, 0.7 / k);
      ctx.beginPath();
      for (let y = oy + Math.max(0, Math.floor((y0 - oy) / sp)) * sp; y <= y1; y += sp) {
        for (let x = ox + Math.max(0, Math.floor((x0 - ox) / sp)) * sp; x <= x1; x += sp) {
          ctx.moveTo(x + dr, y); ctx.arc(x, y, dr, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      break;
    }
    case 'cornell': {
      const sp = 34, top = 140, cue = Math.round(W * 0.28), sum = H - 270;
      ctx.beginPath();
      for (let y = top + sp; y < sum; y += sp) { if (y >= y0 - sp && y <= y1 + sp) { ctx.moveTo(0, y); ctx.lineTo(W, y); } }
      ctx.stroke();
      ctx.strokeStyle = P.strong;
      ctx.lineWidth = lw(1.6);
      ctx.beginPath();
      ctx.moveTo(0, top); ctx.lineTo(W, top);
      ctx.moveTo(cue, top); ctx.lineTo(cue, sum);
      ctx.moveTo(0, sum); ctx.lineTo(W, sum);
      ctx.stroke();
      break;
    }
    case 'music': {
      const gap = 10, staff = gap * 4, period = 105, top = 110, mx = 60;
      ctx.strokeStyle = P.strong;
      ctx.lineWidth = lw(1);
      ctx.beginPath();
      for (let s = top; s + staff <= H - 60; s += period) {
        if (s + staff < y0 || s > y1) continue;
        for (let i = 0; i < 5; i++) { const y = s + i * gap; ctx.moveTo(mx, y); ctx.lineTo(W - mx, y); }
      }
      ctx.stroke();
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------- Bilder
const imgCache = new Map(); // blobId -> {img, p}
let imageLoaded = null;
export function onImageLoaded(fn) { imageLoaded = fn; }

function loadImage(id) {
  return db.get('blobs', id).then(async (rec) => {
    if (!rec) return null;
    const blob = new Blob([rec.data], { type: rec.type || 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch (e) { await new Promise((r) => { img.onload = r; img.onerror = r; }); }
    return img;
  }).catch(() => null);
}

export function getImage(id) {
  let e = imgCache.get(id);
  if (!e) {
    e = { img: null, p: null };
    imgCache.set(id, e);
    e.p = loadImage(id).then((img) => { e.img = img; if (imageLoaded) imageLoaded(id); return img; });
  } else {
    // LRU: zuletzt benutzt ans Ende
    imgCache.delete(id); imgCache.set(id, e);
  }
  if (imgCache.size > 40) {
    const oldest = imgCache.keys().next().value;
    const o = imgCache.get(oldest);
    if (o && o.img && o.img.src) URL.revokeObjectURL(o.img.src);
    imgCache.delete(oldest);
  }
  return e.img;
}

export async function ensureImages(page) {
  const ids = [];
  if (page.bg) ids.push(page.bg);
  for (const im of page.images || []) ids.push(im.blob);
  await Promise.all(ids.map((id) => { getImage(id); return imgCache.get(id).p; }));
}

// ---------------------------------------------------------------- Strich-Geometrie
const geomCache = new WeakMap();
export function geom(s) {
  let g = geomCache.get(s);
  if (!g) { g = buildGeom(s); geomCache.set(s, g); }
  return g;
}

function bboxOf(pts, pad) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

export function strokeBBox(s) { return geom(s).bbox; }

function centerPath(pts, sharp) {
  const p = new Path2D();
  const n = pts.length / 3;
  if (n === 0) return p;
  p.moveTo(pts[0], pts[1]);
  if (n === 1) { p.lineTo(pts[0] + 0.01, pts[1]); return p; }
  if (sharp || n === 2) {
    for (let i = 1; i < n; i++) p.lineTo(pts[i * 3], pts[i * 3 + 1]);
    return p;
  }
  for (let i = 1; i < n - 1; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1];
    const nx = pts[i * 3 + 3], ny = pts[i * 3 + 4];
    p.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  p.lineTo(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1]);
  return p;
}

function penRadii(s) {
  const pts = s.pts, n = pts.length / 3, half = s.w / 2;
  const r = new Float32Array(n);
  if (s.sh) { r.fill(half); return r; }
  if (!s.sim) {
    for (let i = 0; i < n; i++) r[i] = half * (0.35 + clamp(pts[i * 3 + 2], 0, 1));
    // Pencil liefert beim Aufsetzen oft Druck 0 – erste Punkte glätten
    if (n > 2 && r[0] < r[1] * 0.6) r[0] = r[1] * 0.7;
  } else {
    // Finger/Maus: Druck aus Geschwindigkeit simulieren (schnell = dünner)
    let p = 0.65;
    for (let i = 0; i < n; i++) {
      const d = i ? Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2]) : 0;
      const target = clamp(1 - d / (s.w * 5), 0.2, 1);
      p += (target - p) * 0.3;
      r[i] = half * (0.6 + 0.55 * p);
    }
    const T = Math.min(4, Math.floor(n / 3));
    for (let i = 0; i < T; i++) {
      const f = 0.55 + 0.45 * (i / T);
      r[i] *= f; r[n - 1 - i] *= f;
    }
  }
  for (let i = 0; i < n; i++) if (r[i] < half * 0.25) r[i] = half * 0.25;
  return r;
}

/** Mittellinie als geglättete Kurve abtasten (für variable Strichbreite). */
function sampleSpine(pts, rad, step, sharp) {
  const n = pts.length / 3;
  const xs = [pts[0]], ys = [pts[1]], rs = [rad[0]];
  if (n === 1) return { xs, ys, rs };
  const lin = (ax, ay, ar, bx, by, br) => {
    const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let j = 1; j <= k; j++) { const t = j / k; xs.push(ax + (bx - ax) * t); ys.push(ay + (by - ay) * t); rs.push(ar + (br - ar) * t); }
  };
  if (n === 2 || sharp) {
    for (let i = 1; i < n; i++) lin(pts[i * 3 - 3], pts[i * 3 - 2], rad[i - 1], pts[i * 3], pts[i * 3 + 1], rad[i]);
    return { xs, ys, rs };
  }
  let sx = pts[0], sy = pts[1], sr = rad[0];
  for (let i = 1; i < n - 1; i++) {
    const cx = pts[i * 3], cy = pts[i * 3 + 1], cr = rad[i];
    let ex, ey, er;
    if (i === n - 2) { ex = pts[i * 3 + 3]; ey = pts[i * 3 + 4]; er = rad[i + 1]; }
    else { ex = (cx + pts[i * 3 + 3]) / 2; ey = (cy + pts[i * 3 + 4]) / 2; er = (cr + rad[i + 1]) / 2; }
    const len = Math.hypot(cx - sx, cy - sy) + Math.hypot(ex - cx, ey - cy);
    const k = Math.max(1, Math.ceil(len / step));
    for (let j = 1; j <= k; j++) {
      const t = j / k, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      xs.push(a * sx + b * cx + c * ex);
      ys.push(a * sy + b * cy + c * ey);
      rs.push(a * sr + b * cr + c * er);
    }
    sx = ex; sy = ey; sr = er;
  }
  return { xs, ys, rs };
}

function buildGeom(s) {
  const g = { bbox: bboxOf(s.pts, s.w * (s.t === 'pen' ? 0.8 : 0.55) + 1) };
  if (s.t === 'pen' || s.t === 'rainbow') {
    const rad = s.t === 'pen' ? penRadii(s) : new Float32Array(s.pts.length / 3).fill(s.w / 2);
    const sp = sampleSpine(s.pts, rad, Math.max(1.2, s.w * 0.45), s.sh);
    const m = sp.xs.length;
    const runs = [];
    if (m === 1) {
      const p = new Path2D(); p.moveTo(sp.xs[0], sp.ys[0]); p.lineTo(sp.xs[0] + 0.01, sp.ys[0]);
      runs.push({ w: sp.rs[0] * 2, path: p, c: s.c });
    } else if (s.t === 'pen') {
      const Q = Math.max(0.08, s.w * 0.06);
      let cur = null;
      for (let i = 0; i < m - 1; i++) {
        const w = Math.max(Q, Math.round((sp.rs[i] + sp.rs[i + 1]) / Q) * Q);
        if (!cur || cur.w !== w) { cur = { w, path: new Path2D() }; cur.path.moveTo(sp.xs[i], sp.ys[i]); runs.push(cur); }
        cur.path.lineTo(sp.xs[i + 1], sp.ys[i + 1]);
      }
    } else {
      // Regenbogen: Farbe wandert entlang des Strichs
      let cur = null, len = 0;
      const h0 = s.h0 || 0;
      for (let i = 0; i < m - 1; i++) {
        len += Math.hypot(sp.xs[i + 1] - sp.xs[i], sp.ys[i + 1] - sp.ys[i]);
        const hue = Math.round(((h0 + len * 0.9) % 360) / 12) * 12;
        if (!cur || cur.hue !== hue) { cur = { hue, c: `hsl(${hue} 85% 52%)`, path: new Path2D(), w: s.w }; cur.path.moveTo(sp.xs[i], sp.ys[i]); runs.push(cur); }
        cur.path.lineTo(sp.xs[i + 1], sp.ys[i + 1]);
      }
    }
    g.runs = runs;
  } else {
    g.path = centerPath(s.pts, s.sh);
  }
  return g;
}

export function drawStroke(ctx, s) {
  const g = geom(s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (s.t) {
    case 'pen':
      ctx.strokeStyle = s.c;
      for (const r of g.runs) { ctx.lineWidth = r.w; ctx.stroke(r.path); }
      break;
    case 'rainbow':
      for (const r of g.runs) { ctx.strokeStyle = r.c || s.c; ctx.lineWidth = r.w; ctx.stroke(r.path); }
      break;
    case 'marker':
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = s.c;
      ctx.lineWidth = s.w;
      ctx.stroke(g.path);
      ctx.globalAlpha = 1;
      break;
    case 'tape':
      if (s.open) {
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = s.c;
        ctx.lineWidth = s.w;
        ctx.lineCap = 'butt';
        ctx.stroke(g.path);
        ctx.globalAlpha = 1;
      } else {
        ctx.lineCap = 'butt';
        ctx.strokeStyle = s.c;
        ctx.lineWidth = s.w;
        ctx.stroke(g.path);
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = s.w * 0.42;
        ctx.stroke(g.path);
        ctx.globalAlpha = 1;
      }
      break;
    default: // 'ball' (Fineliner) und Formen
      ctx.strokeStyle = s.c;
      ctx.lineWidth = s.w;
      ctx.stroke(g.path);
  }
}

// ---------------------------------------------------------------- Text (mit einfachem Markdown)
const measureCtx = document.createElement('canvas').getContext('2d');
const layoutCache = new WeakMap();

function inlineTokens(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|~~[^~]+~~|==[^=]+==|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith('**')) out.push({ text: t.slice(2, -2), bold: true });
    else if (t.startsWith('~~')) out.push({ text: t.slice(2, -2), strike: true });
    else if (t.startsWith('==')) out.push({ text: t.slice(2, -2), hl: true });
    else out.push({ text: t.slice(1, -1), italic: true });
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function layoutText(t) {
  let L = layoutCache.get(t);
  if (L) return L;
  const base = t.size;
  const maxW = Math.max(40, t.w);
  const lines = [];
  const checks = [];
  let y = 0;
  (t.text || '').split('\n').forEach((raw, idx) => {
    let s = base, bold = false, indent = 0, deco = null, text = raw, m;
    if ((m = raw.match(/^(#{1,3})\s+(.*)$/))) { s = base * [1.7, 1.35, 1.15][m[1].length - 1]; bold = true; text = m[2]; }
    else if ((m = raw.match(/^(\s*)[-*]\s+\[([ xX])\]\s?(.*)$/))) { indent = base * 1.55 + m[1].length * base * 0.4; deco = { type: 'check', checked: m[2] !== ' ' }; text = m[3]; }
    else if ((m = raw.match(/^(\s*)[-*•]\s+(.*)$/))) { indent = base * 1.2 + m[1].length * base * 0.4; deco = { type: 'bullet' }; text = m[2]; }
    else if ((m = raw.match(/^(\s*)(\d+)[.)]\s+(.*)$/))) { indent = base * 1.7 + m[1].length * base * 0.4; deco = { type: 'num', label: m[2] + '.' }; text = m[3]; }
    const lh = s * 1.38;
    const done = deco && deco.type === 'check' && deco.checked;
    const toks = inlineTokens(text);
    let x = indent, runs = [], first = true;
    const paraTop = y;
    const pushLine = () => {
      lines.push({ y: y + s * 1.0, runs, deco: first ? deco : null, size: s, indent, done });
      first = false; y += lh; runs = []; x = indent;
    };
    const add = (txt, font, tok, ww) => {
      const last = runs[runs.length - 1];
      if (last && last.font === font && !!last.strike === !!tok.strike && !!last.hl === !!tok.hl && last.x + last.w === x) {
        last.text += txt; last.w += ww;
      } else runs.push({ x, text: txt, font, w: ww, strike: tok.strike || done, hl: tok.hl });
      x += ww;
    };
    for (const tok of toks) {
      const font = fontStr(s, bold || tok.bold, tok.italic);
      measureCtx.font = font;
      for (const w of tok.text.split(/(\s+)/)) {
        if (!w) continue;
        const space = /^\s+$/.test(w);
        if (space && x === indent && runs.length) continue;
        let ww = measureCtx.measureText(w).width;
        if (!space && x + ww > maxW && x > indent) pushLine();
        if (!space && ww > maxW - indent) {
          // Sehr langes Wort zeichenweise umbrechen
          let chunk = '';
          for (const ch of w) {
            const cw = measureCtx.measureText(chunk + ch).width;
            if (x + cw > maxW && chunk) { add(chunk, font, tok, measureCtx.measureText(chunk).width); pushLine(); chunk = ch; }
            else chunk += ch;
          }
          if (chunk) add(chunk, font, tok, measureCtx.measureText(chunk).width);
          continue;
        }
        add(w, font, tok, ww);
      }
    }
    pushLine();
    if (deco && deco.type === 'check') {
      const bs = base * 0.92;
      checks.push({ x: indent - base * 1.35, y: paraTop + (s * 1.38 - bs) / 2, s: bs, src: idx });
    }
  });
  L = { lines, height: Math.max(y, base * 1.38), checks };
  layoutCache.set(t, L);
  return L;
}

export function textHeight(t) { return layoutText(t).height; }

export function drawText(ctx, t, paperDark) {
  const L = layoutText(t);
  const col = t.c || (paperDark ? '#f2f2f2' : '#1d1d1f');
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.textBaseline = 'alphabetic';
  for (const line of L.lines) {
    const d = line.deco, s = line.size;
    ctx.fillStyle = col;
    if (d) {
      if (d.type === 'bullet') {
        ctx.beginPath();
        ctx.arc(line.indent - s * 0.62, line.y - s * 0.33, s * 0.13, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'num') {
        ctx.font = fontStr(s, false, false);
        ctx.textAlign = 'right';
        ctx.fillText(d.label, line.indent - s * 0.35, line.y);
        ctx.textAlign = 'left';
      }
    }
    ctx.globalAlpha = line.done ? 0.5 : 1;
    for (const r of line.runs) {
      if (r.hl) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.55)';
        ctx.fillRect(r.x - 1, line.y - s * 0.95, r.w + 2, s * 1.22);
        ctx.fillStyle = col;
      }
      ctx.font = r.font;
      ctx.fillText(r.text, r.x, line.y);
      if (r.strike) {
        ctx.fillRect(r.x, line.y - s * 0.32, r.w, Math.max(0.8, s * 0.07));
      }
    }
    ctx.globalAlpha = 1;
  }
  for (const c of L.checks) {
    const checked = /\[[xX]\]/.test((t.text.split('\n')[c.src]) || '');
    ctx.lineWidth = Math.max(1, c.s * 0.1);
    ctx.strokeStyle = col;
    roundRect(ctx, c.x, c.y, c.s, c.s, c.s * 0.25);
    if (checked) {
      ctx.fillStyle = '#0d8f80';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = c.s * 0.14;
      ctx.beginPath();
      ctx.moveTo(c.x + c.s * 0.24, c.y + c.s * 0.52);
      ctx.lineTo(c.x + c.s * 0.43, c.y + c.s * 0.72);
      ctx.lineTo(c.x + c.s * 0.77, c.y + c.s * 0.3);
      ctx.stroke();
    } else ctx.stroke();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- Seite komplett
const isect = (b, v) => !v || !(b.x1 < v.x0 || b.x0 > v.x1 || b.y1 < v.y0 || b.y0 > v.y1);

/**
 * Inhalt einer Seite zeichnen (ctx bereits auf Seitenkoordinaten transformiert).
 * opts.skip: Set von IDs, die nicht gezeichnet werden (z. B. gerade verschobene Auswahl)
 * opts.hideTape: Lernband weglassen (Export)
 * opts.vis: sichtbarer Bereich in Seiten-Einheiten (Culling)
 * opts.editing: ID der Textbox, die gerade bearbeitet wird
 */
export function drawContent(ctx, page, opts = {}) {
  const { skip, hideTape, vis, editing } = opts;
  const dark = page.paper === 'dark';
  for (const im of page.images) {
    if (skip && skip.has(im.id)) continue;
    if (!isect({ x0: im.x, y0: im.y, x1: im.x + im.w, y1: im.y + im.h }, vis)) continue;
    const img = getImage(im.blob);
    if (img) ctx.drawImage(img, im.x, im.y, im.w, im.h);
    else { ctx.fillStyle = 'rgba(128,128,128,0.15)'; ctx.fillRect(im.x, im.y, im.w, im.h); }
  }
  for (const s of page.strokes) {
    if (s.t !== 'marker' || (skip && skip.has(s.id))) continue;
    if (isect(geom(s).bbox, vis)) drawStroke(ctx, s);
  }
  for (const t of page.texts) {
    if ((skip && skip.has(t.id)) || t.id === editing) continue;
    if (isect({ x0: t.x - 30, y0: t.y - 10, x1: t.x + t.w + 10, y1: t.y + textHeight(t) + 10 }, vis)) drawText(ctx, t, dark);
  }
  for (const s of page.strokes) {
    if (s.t === 'marker' || s.t === 'tape' || (skip && skip.has(s.id))) continue;
    if (isect(geom(s).bbox, vis)) drawStroke(ctx, s);
  }
  if (!hideTape) {
    for (const s of page.strokes) {
      if (s.t !== 'tape' || (skip && skip.has(s.id))) continue;
      if (isect(geom(s).bbox, vis)) drawStroke(ctx, s);
    }
  }
}

/** Komplette Seite in einen Canvas zeichnen (Vorschaubild, Zwischenspeicher, Export). */
export function renderPageToCanvas(canvas, page, scale, opts = {}) {
  const w = Math.max(1, Math.round(page.w * scale));
  const h = Math.max(1, Math.round(page.h * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(w / page.w, 0, 0, h / page.h, 0, 0);
  drawPaper(ctx, page);
  drawContent(ctx, page, opts);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------- Treffer-Tests
export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function strokeHit(s, x, y, r) {
  const b = geom(s).bbox;
  if (x < b.x0 - r || x > b.x1 + r || y < b.y0 - r || y > b.y1 + r) return false;
  const pts = s.pts, n = pts.length / 3, rr = r + s.w / 2;
  if (n === 1) return Math.hypot(pts[0] - x, pts[1] - y) <= rr;
  for (let i = 1; i < n; i++) {
    if (distToSeg(x, y, pts[i * 3 - 3], pts[i * 3 - 2], pts[i * 3], pts[i * 3 + 1]) <= rr) return true;
  }
  return false;
}

export function textAt(page, x, y) {
  for (let i = page.texts.length - 1; i >= 0; i--) {
    const t = page.texts[i];
    if (x >= t.x - 8 && x <= t.x + t.w + 8 && y >= t.y - 8 && y <= t.y + textHeight(t) + 8) return t;
  }
  return null;
}

export function checkboxAt(t, x, y) {
  const L = layoutText(t);
  for (const c of L.checks) {
    const pad = c.s * 0.4;
    if (x >= t.x + c.x - pad && x <= t.x + c.x + c.s + pad && y >= t.y + c.y - pad && y <= t.y + c.y + c.s + pad) return c;
  }
  return null;
}

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
