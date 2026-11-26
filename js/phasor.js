// Zeigerdiagramm für Drehstrom: Stern (mit N-Leiterstrom) und Dreieck (Leiterströme aus Strangströmen).
// Jeder Strom bekommt Betrag und Phasenwinkel φ (+ induktiv / − kapazitiv) – per Schieberegler vor- und zurückschieben.
// Bezug: U1 zeigt nach oben (90°), U2 bei −30°, U3 bei 210° (Rechtsdrehfeld).
import { el, uid, round2 } from './util.js';
import { dialog, segmented, toggle } from './ui.js';
import { MM } from './ink.js';

const RAD = Math.PI / 180;
const pol = (r, deg) => [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const subv = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mag = (a) => Math.hypot(a[0], a[1]);
const angOf = (a) => { let d = Math.atan2(a[1], a[0]) / RAD; if (d < 0) d += 360; return d; };
export const fmt = (v, n = 2) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(n).replace('.', ',');
const kind = (phi) => (Math.abs(phi) < 0.5 ? 'ohmsch' : phi > 0 ? 'induktiv' : 'kapazitiv');

const STAR_U = [90, -30, 210];
const DELTA_U = [120, 0, 240];

/** Berechnet alle Zeiger. st = { mode, I:[3], phi:[3] } → { arrows, res, max } (Einheiten: A) */
export function compute(st, { construct = true, volts = true } = {}) {
  const arrows = [];
  const res = [];
  const C = ['L1', 'L2', 'L3'];
  let cur, max = 0;
  if (st.mode === 'star') {
    cur = st.I.map((I, k) => pol(I, STAR_U[k] - st.phi[k]));
    const N = cur.reduce(add, [0, 0]);
    max = Math.max(...cur.map(mag), mag(N), 0.001);
    if (volts) STAR_U.forEach((a, k) => arrows.push({ a: [0, 0], b: pol(max * 1.18, a), c: 'U', w: 'thin', label: `U${k + 1}N` }));
    cur.forEach((v, k) => arrows.push({ a: [0, 0], b: v, c: C[k], w: 'bold', label: `I${k + 1}` }));
    if (construct && mag(N) > 1e-6) {
      const p1 = cur[0], p2 = add(cur[0], cur[1]);
      arrows.push({ a: p1, b: p2, c: 'L2', w: 'thin' });
      arrows.push({ a: p2, b: N, c: 'L3', w: 'thin' });
    }
    if (mag(N) > 1e-6) arrows.push({ a: [0, 0], b: N, c: 'N', w: 'bold', label: 'IN' });
    st.I.forEach((I, k) => res.push(`I${k + 1} = ${fmt(I)} A, φ = ${fmt(st.phi[k], 0)}° (${kind(st.phi[k])})`));
    res.push(`IN = ${fmt(mag(N))} A  ∠ ${fmt(mag(N) > 1e-6 ? angOf(N) : 0, 1)}°`);
  } else {
    const strand = st.I.map((I, k) => pol(I, DELTA_U[k] - st.phi[k])); // I12, I23, I31
    const line = [subv(strand[0], strand[2]), subv(strand[1], strand[0]), subv(strand[2], strand[1])];
    max = Math.max(...strand.map(mag), ...line.map(mag), 0.001);
    const SN = ['12', '23', '31'];
    if (volts) DELTA_U.forEach((a, k) => arrows.push({ a: [0, 0], b: pol(max * 1.18, a), c: 'U', w: 'thin', label: `U${SN[k]}` }));
    strand.forEach((v, k) => arrows.push({ a: [0, 0], b: v, c: C[k], w: 'mid', label: `I${SN[k]}` }));
    if (construct) {
      // I1 = I12 − I31: an die Spitze von I12 den Zeiger −I31 setzen usw.
      const minus = [2, 0, 1];
      line.forEach((v, k) => arrows.push({ a: strand[k], b: v, c: C[minus[k]], w: 'thin' }));
    }
    line.forEach((v, k) => arrows.push({ a: [0, 0], b: v, c: 'N' + k, w: 'bold', label: `I${k + 1}` }));
    st.I.forEach((I, k) => res.push(`I${SN[k]} = ${fmt(I)} A, φ = ${fmt(st.phi[k], 0)}° (${kind(st.phi[k])})`));
    line.forEach((v, k) => res.push(`I${k + 1} = ${fmt(mag(v))} A  ∠ ${fmt(angOf(v), 1)}°`));
  }
  return { arrows, res, max };
}

function colors(dark) {
  return { L1: '#9a5b2e', L2: dark ? '#f2f2f2' : '#1d1d1f', L3: '#8e8e93', N: '#1f5eff', N0: '#1f5eff', N1: '#e5383b', N2: '#139a52', U: dark ? '#8a93a3' : '#9aa4b2' };
}
const WIDTH = { thin: 1.3, mid: 2, bold: 2.8 };

function niceScale(max) {
  const raw = max / 6; // längster Zeiger etwa 6 cm
  const steps = [1, 2, 2.5, 5];
  let e = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  for (;;) { for (const s of steps) if (s * e >= raw) return s * e; e *= 10; }
}

/** Dialog öffnen. Rückgabe: Promise<{strokes, texts}|null>, Ursprung ox/oy in Seitenkoordinaten. */
export async function phasorDialog(ox, oy, dark) {
  const st = { mode: 'star', I: [10, 6, 8], phi: [0, 30, -45] };
  const opt = { construct: true, volts: true, text: true, scale: 0, autoScale: true };
  const prev = el('div', { class: 'ph-prev' });
  const out = el('div', { class: 'ph-res' });
  const rows = el('div', { class: 'ph-rows' });
  const scaleInp = el('input', { class: 'inp ph-num', type: 'number', min: '0.01', step: 'any' });
  const NAMES = { star: ['L1 – I1', 'L2 – I2', 'L3 – I3'], delta: ['Strang 1-2', 'Strang 2-3', 'Strang 3-1'] };

  const redraw = () => {
    const r = compute(st, opt);
    if (opt.autoScale) { opt.scale = niceScale(r.max); scaleInp.value = String(opt.scale); }
    // Vorschau als SVG
    const S = 130 / (r.max * 1.3 || 1);
    const C = colors(false);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-150 -150 300 300');
    const mk = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); svg.append(n); return n; };
    mk('circle', { cx: 0, cy: 0, r: 2.5, fill: '#888' });
    for (const ar of r.arrows) {
      const x0 = ar.a[0] * S, y0 = -ar.a[1] * S, x1 = ar.b[0] * S, y1 = -ar.b[1] * S;
      const col = C[ar.c];
      const w = WIDTH[ar.w];
      mk('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: col, 'stroke-width': w, 'stroke-dasharray': ar.c === 'U' || ar.w === 'thin' ? '5 4' : '', 'stroke-linecap': 'round' });
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L > 6) {
        const ux = (x1 - x0) / L, uy = (y1 - y0) / L, h = Math.min(10, L * 0.4);
        const p = (s) => [x1 - ux * h + s * -uy * h * 0.45, y1 - uy * h + s * ux * h * 0.45];
        mk('path', { d: `M${x1} ${y1}L${p(1)}L${p(-1)}Z`, fill: col });
      }
      if (ar.label) {
        const t = mk('text', { x: x1 + (L ? (x1 - x0) / L : 0) * 12, y: y1 + (L ? (y1 - y0) / L : 0) * 12 + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: col });
        t.textContent = ar.label;
      }
    }
    prev.replaceChildren(svg);
    out.replaceChildren(...r.res.map((s, i) => el('div', { class: i === r.res.length - 1 && st.mode === 'star' ? 'strong' : '' }, s)));
  };

  const buildRows = () => {
    rows.replaceChildren();
    for (let k = 0; k < 3; k++) {
      const iInp = el('input', { class: 'inp ph-num', type: 'number', min: '0', step: '0.1', value: String(st.I[k]) });
      const pNum = el('input', { class: 'inp ph-num', type: 'number', min: '-90', max: '90', step: '1', value: String(st.phi[k]) });
      const slider = el('input', { type: 'range', min: '-90', max: '90', step: '1', value: String(st.phi[k]), class: 'ph-slider' });
      const kindL = el('span', { class: 'ph-kind' }, kind(st.phi[k]));
      const setPhi = (v) => { v = Math.max(-90, Math.min(90, +v || 0)); st.phi[k] = v; slider.value = v; pNum.value = v; kindL.textContent = kind(v); redraw(); };
      iInp.addEventListener('input', () => { st.I[k] = Math.max(0, parseFloat(String(iInp.value).replace(',', '.')) || 0); redraw(); });
      slider.addEventListener('input', () => setPhi(slider.value));
      pNum.addEventListener('input', () => setPhi(pNum.value));
      rows.append(el('div', { class: 'ph-row' },
        el('b', null, NAMES[st.mode][k]),
        el('label', null, 'I ', iInp, ' A'),
        el('label', { class: 'ph-phi' }, 'φ ', pNum, '°', kindL),
        el('div', { class: 'ph-slide' }, el('span', null, 'kap.'), slider, el('span', null, 'ind.'))));
    }
  };

  scaleInp.addEventListener('input', () => { const v = parseFloat(String(scaleInp.value).replace(',', '.')); if (v > 0) { opt.scale = v; opt.autoScale = false; } });
  const body = el('div', { class: 'phasor' },
    el('div', { class: 'ph-top' },
      segmented([['star', 'Stern (mit N)'], ['delta', 'Dreieck']], st.mode, (v) => { st.mode = v; buildRows(); redraw(); }),
      el('span', { class: 'ph-hint' }, 'φ > 0: induktiv (Strom eilt nach) · φ < 0: kapazitiv (Strom eilt vor)')),
    el('div', { class: 'ph-main' }, el('div', { class: 'ph-left' }, rows, out), prev),
    el('div', { class: 'ph-opts' },
      el('label', null, toggle(opt.volts, (v) => { opt.volts = v; redraw(); }), ' Spannungszeiger'),
      el('label', null, toggle(opt.construct, (v) => { opt.construct = v; redraw(); }), ' Konstruktion (Zeiger aneinander)'),
      el('label', null, toggle(opt.text, (v) => { opt.text = v; }), ' Werte als Text'),
      el('label', null, 'Maßstab: 1 cm ≙ ', scaleInp, ' A')));
  buildRows();
  redraw();

  const ok = await dialog({ title: 'Zeigerdiagramm (Drehstrom)', body, wide: true, cls: 'ph-dlg', buttons: [{ label: 'Abbrechen', value: false }, { label: 'Einfügen', primary: true, value: true }], dismissValue: false });
  if (!ok) return null;
  return toPage(st, opt, ox, oy, dark);
}

/** Zeiger als Striche (mit Pfeilspitze) und Beschriftung als Text in Seitenkoordinaten. */
export function toPage(st, opt, ox, oy, dark) {
  const r = compute(st, opt);
  const unit = (MM * 10) / (opt.scale || niceScale(r.max)); // Seiten-Einheiten pro Ampere
  const C = colors(dark);
  const strokes = [], texts = [];
  const P = (v) => [ox + v[0] * unit, oy - v[1] * unit];
  for (const ar of r.arrows) {
    const [x0, y0] = P(ar.a), [x1, y1] = P(ar.b);
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 2) continue;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, h = Math.min(MM * 3, L * 0.35);
    const wl = [x1 - ux * h - uy * h * 0.42, y1 - uy * h + ux * h * 0.42];
    const wr = [x1 - ux * h + uy * h * 0.42, y1 - uy * h - ux * h * 0.42];
    const pts = [x0, y0, x1, y1, ...wl, x1, y1, ...wr];
    const out = [];
    for (let i = 0; i < pts.length; i += 2) out.push(round2(pts[i]), round2(pts[i + 1]), 0.5);
    strokes.push({ id: uid(), t: 'ball', c: C[ar.c], w: WIDTH[ar.w], pts: out, sh: true });
    if (ar.label) {
      const size = 17;
      texts.push({ id: uid(), x: round2(x1 + ux * 16 - 14), y: round2(y1 + uy * 16 - size * 0.7), w: 70, size, c: C[ar.c], text: ar.label });
    }
  }
  if (opt.text) {
    const size = 16;
    let maxY = oy;
    for (const s of strokes) for (let i = 1; i < s.pts.length; i += 3) maxY = Math.max(maxY, s.pts[i]);
    texts.push({ id: uid(), x: round2(ox - 150), y: round2(maxY + 30), w: 420, size, c: dark ? '#f2f2f2' : '#1d1d1f',
      text: (st.mode === 'star' ? 'Sternschaltung\n' : 'Dreieckschaltung\n') + r.res.join('\n') + `\nMaßstab: 1 cm ≙ ${fmt(opt.scale || niceScale(r.max), 2)} A` });
  }
  return { strokes, texts };
}
