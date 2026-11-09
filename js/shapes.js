// Formerkennung: „Zeichnen und halten“ macht aus einer Skizze eine saubere Form.
import { distToSeg } from './ink.js';

function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const a = pts[0], b = pts[pts.length - 1];
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const l = rdp(pts.slice(0, idx + 1), eps);
    const r = rdp(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [a, b];
}

function angleAt(p, a, b) {
  const v1x = a[0] - p[0], v1y = a[1] - p[1], v2x = b[0] - p[0], v2y = b[1] - p[1];
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1;
  return Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180 / Math.PI;
}

const flat = (list) => {
  const out = [];
  for (const [x, y] of list) out.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100, 0.5);
  return out;
};

/** Nimmt Punkte [x,y,p,...] und liefert eine Form {kind, pts} oder null. */
export function recognize(raw, { lineOnly = false } = {}) {
  const pts = [];
  for (let i = 0; i < raw.length; i += 3) pts.push([raw[i], raw[i + 1]]);
  if (pts.length < 2) return null;
  let L = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (i) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    x0 = Math.min(x0, pts[i][0]); x1 = Math.max(x1, pts[i][0]);
    y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]);
  }
  const D = Math.hypot(x1 - x0, y1 - y0);
  if (L < 12 || D < 8) return null;
  const s = pts[0], e = pts[pts.length - 1];
  const d = Math.hypot(e[0] - s[0], e[1] - s[1]);

  // Gerade Linie
  if (lineOnly || d / L > 0.86) {
    let a = s, b = e;
    // fast waagerecht/senkrecht einrasten
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    const snap = Math.round(ang / 90) * 90;
    if (Math.abs(ang - snap) < 4) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const r = snap * Math.PI / 180;
      b = [a[0] + Math.cos(r) * len, a[1] + Math.sin(r) * len];
    }
    return { kind: 'line', pts: flat([a, b]) };
  }

  const closed = d < Math.max(0.22 * L, 0.18 * D);
  if (!closed) {
    // Offene Polylinie (z. B. Winkel, Pfeilspitze)
    const poly = rdp(pts, 0.06 * D);
    if (poly.length >= 3 && poly.length <= 5) return { kind: 'polyline', pts: flat(poly) };
    return null;
  }

  // Ellipse über Hauptachsen (PCA)
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { const dx = p[0] - cx, dy = p[1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const c = Math.cos(-theta), sn = Math.sin(-theta);
  let rx0 = Infinity, rx1 = -Infinity, ry0 = Infinity, ry1 = -Infinity;
  const rot = pts.map((p) => {
    const dx = p[0] - cx, dy = p[1] - cy;
    const X = dx * c - dy * sn, Y = dx * sn + dy * c;
    rx0 = Math.min(rx0, X); rx1 = Math.max(rx1, X); ry0 = Math.min(ry0, Y); ry1 = Math.max(ry1, Y);
    return [X, Y];
  });
  const ex = (rx0 + rx1) / 2, ey = (ry0 + ry1) / 2;
  let rx = (rx1 - rx0) / 2, ry = (ry1 - ry0) / 2;
  let err = 0;
  for (const [X, Y] of rot) err += Math.abs(Math.hypot((X - ex) / (rx || 1), (Y - ey) / (ry || 1)) - 1);
  err /= rot.length;

  // Vieleck
  let poly = rdp(pts, 0.075 * D);
  if (poly.length > 2 && Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 0.25 * D) poly.pop();
  // Startpunkt liegt oft mitten auf einer Kante
  if (poly.length > 3 && angleAt(poly[0], poly[poly.length - 1], poly[1]) > 150) poly.shift();
  const nV = poly.length;
  const sharpCorners = nV >= 3 && nV <= 6 && poly.every((p, i) => angleAt(p, poly[(i - 1 + nV) % nV], poly[(i + 1) % nV]) < 140);

  if (sharpCorners && (err > 0.075 || nV === 3)) {
    if (nV === 4) {
      // Rechteck, wenn Kanten fast achsparallel sind
      const axis = poly.every((p, i) => {
        const q = poly[(i + 1) % 4];
        const a = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI) % 90;
        return a < 14 || a > 76;
      });
      if (axis) {
        const xs = poly.map((p) => p[0]).sort((a, b) => a - b), ys = poly.map((p) => p[1]).sort((a, b) => a - b);
        const l = (xs[0] + xs[1]) / 2, r = (xs[2] + xs[3]) / 2, t = (ys[0] + ys[1]) / 2, b = (ys[2] + ys[3]) / 2;
        return { kind: 'rect', pts: flat([[l, t], [r, t], [r, b], [l, b], [l, t]]) };
      }
    }
    return { kind: 'polygon', pts: flat([...poly, poly[0]]) };
  }
  if (err < 0.16) {
    if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.16) { rx = ry = (rx + ry) / 2; }
    const out = [];
    const ct = Math.cos(theta), st = Math.sin(theta);
    const N = 72;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const X = ex + Math.cos(a) * rx, Y = ey + Math.sin(a) * ry;
      out.push([cx + X * ct - Y * st, cy + X * st + Y * ct]);
    }
    return { kind: rx === ry ? 'circle' : 'ellipse', pts: flat(out) };
  }
  return null;
}
