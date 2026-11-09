// Werkzeug-Aktionen: jede Berührung erzeugt eine Aktion mit move/end/cancel/drawLive.
import { uid, round2, getSettings } from './util.js';
import { drawStroke, drawText, strokeHit, geom, textAt, checkboxAt, pointInPoly, textHeight, getImage } from './ink.js';
import { recognize } from './shapes.js';

// ---------------------------------------------------------------- Stift, Textmarker, Formen, Lernband
class InkAction {
  constructor(ed, pt, toolName) {
    this.ed = ed;
    this.tool = toolName;
    const hit = ed.hitPage(pt.sx, pt.sy, 0);
    if (!hit) { this.dead = true; return; }
    this.L = hit.L;
    this.page = hit.L.page;
    const ts = ed.toolState;
    let t, c, w;
    if (toolName === 'marker') { t = 'marker'; c = ts.marker.colors[ts.marker.ci]; w = ts.marker.widths[ts.marker.wi]; }
    else if (toolName === 'tape') { t = 'tape'; c = ts.tape.colors[ts.tape.ci]; w = ts.tape.widths[ts.tape.wi]; }
    else if (toolName === 'shape') { t = 'ball'; c = ts.pen.colors[ts.pen.ci]; w = ts.pen.widths[ts.pen.wi]; }
    else { t = ts.pen.type; c = ts.pen.colors[ts.pen.ci]; w = ts.pen.widths[ts.pen.wi]; }
    this.stroke = { id: uid(), t, c, w, pts: [], sim: pt.type !== 'pen' };
    if (t === 'rainbow') this.stroke.h0 = Math.floor(Math.random() * 360);
    this.ruler = ed.ruler.visible ? ed.ruler.edgeNear(pt.sx, pt.sy) : null;
    if (this.ruler || (toolName === 'marker' && ts.marker.straight)) this.straight = true;
    this.t0 = pt.t;
    this.x0 = pt.sx; this.y0 = pt.sy;
    this.travel = 0;
    this.anchor = { x: pt.sx, y: pt.sy };
    this.add(pt);
    this.armHold();
  }

  add(pt) {
    let sx = pt.sx, sy = pt.sy;
    if (this.ruler) [sx, sy] = this.ed.ruler.project(this.ruler, sx, sy);
    const { x, y } = this.ed.toPage(this.L, sx, sy);
    const pts = this.stroke.pts;
    const n = pts.length;
    if (this.straight && n >= 6) {
      // gerade Linie: nur Endpunkt verschieben
      pts[3] = round2(x); pts[4] = round2(y); pts[5] = round2(pt.p);
      return;
    }
    if (n) {
      const dx = x - pts[n - 3], dy = y - pts[n - 2];
      const min = 0.6 / this.ed.view.s;
      if (dx * dx + dy * dy < min * min) { pts[n - 1] = round2(Math.max(pts[n - 1], pt.p)); return; }
    }
    pts.push(round2(x), round2(y), round2(pt.p));
  }

  armHold() {
    clearTimeout(this.holdT);
    if (this.shaped || this.dead) return;
    const st = getSettings();
    if (this.tool === 'tape' || this.stroke.t === 'rainbow') return;
    if (!st.holdShape && this.tool !== 'shape') return;
    this.holdT = setTimeout(() => this.snapShape(), 520);
  }

  snapShape() {
    if (this.dead || this.shaped || this.straight) return;
    const r = recognize(this.stroke.pts, { lineOnly: this.tool === 'marker' });
    if (!r) return;
    this.stroke.pts = r.pts;
    this.stroke.sh = true;
    this.shaped = r.kind;
    this.ed.requestLive();
  }

  move(list) {
    if (this.dead) return;
    for (const pt of list) {
      this.travel = Math.max(this.travel, Math.hypot(pt.sx - this.x0, pt.sy - this.y0));
      if (this.shaped) {
        if (this.shaped === 'line') {
          const { x, y } = this.ed.toPage(this.L, pt.sx, pt.sy);
          this.stroke.pts[3] = round2(x); this.stroke.pts[4] = round2(y);
        }
        continue;
      }
      this.add(pt);
      if (Math.hypot(pt.sx - this.anchor.x, pt.sy - this.anchor.y) > 5) {
        this.anchor = { x: pt.sx, y: pt.sy };
        this.armHold();
      }
    }
  }

  end(pt) {
    clearTimeout(this.holdT);
    if (this.dead) return;
    const ed = this.ed;
    // Kurzes Antippen: Lernband umschalten oder Checkbox abhaken statt Punkt setzen
    if (this.travel < 4 && pt.t - this.t0 < 350) {
      const { x, y } = ed.toPage(this.L, pt.sx, pt.sy);
      if (ed.tapContent(this.L, x, y)) return;
      if (this.tool === 'tape' || this.tool === 'marker') return;
    }
    if (this.tool === 'shape' && !this.shaped) {
      const r = recognize(this.stroke.pts);
      if (r) { this.stroke.pts = r.pts; this.stroke.sh = true; }
    }
    if (this.straight) this.stroke.sh = true;
    if (!this.stroke.pts.length) return;
    ed.addStroke(this.page, this.stroke);
  }

  cancel() { clearTimeout(this.holdT); this.dead = true; }
  small() { return this.travel < 12; }

  drawLive(ctx) {
    if (this.dead || !this.stroke.pts.length) return;
    this.ed.pageTransform(ctx, this.L, true);
    drawStroke(ctx, { ...this.stroke });
  }
}

// ---------------------------------------------------------------- Radierer
function densify(pts, step) {
  const out = [pts[0], pts[1], pts[2]];
  for (let i = 3; i < pts.length; i += 3) {
    const ax = pts[i - 3], ay = pts[i - 2], ap = pts[i - 1], bx = pts[i], by = pts[i + 1], bp = pts[i + 2];
    const d = Math.hypot(bx - ax, by - ay);
    const k = Math.ceil(d / step);
    for (let j = 1; j < k; j++) { const t = j / k; out.push(ax + (bx - ax) * t, ay + (by - ay) * t, ap + (bp - ap) * t); }
    out.push(bx, by, bp);
  }
  return out;
}

function splitStroke(s, x, y, r) {
  const pts = densify(s.pts, Math.max(0.8, r / 3));
  const rr = r + s.w * 0.35;
  const parts = [];
  let cur = [];
  for (let i = 0; i < pts.length; i += 3) {
    if (Math.hypot(pts[i] - x, pts[i + 1] - y) <= rr) {
      if (cur.length >= 6) parts.push(cur);
      cur = [];
    } else cur.push(round2(pts[i]), round2(pts[i + 1]), pts[i + 2]);
  }
  if (cur.length >= 6) parts.push(cur);
  return parts.map((p) => ({ ...s, id: uid(), pts: p }));
}

class EraseAction {
  constructor(ed, pt) {
    this.ed = ed;
    const hit = ed.hitPage(pt.sx, pt.sy, 40);
    if (!hit) { this.dead = true; return; }
    this.L = hit.L;
    this.page = hit.L.page;
    this.before = ed.snap(this.page);
    this.changed = false;
    this.last = ed.toPage(this.L, pt.sx, pt.sy);
    this.eraseAt(this.last.x, this.last.y);
  }

  radius() {
    const es = this.ed.toolState.eraser;
    return es.sizes[es.si] / this.ed.view.s;
  }

  eraseAt(x, y) {
    const es = this.ed.toolState.eraser;
    const r = this.radius();
    const page = this.page;
    let changed = false;
    const out = [];
    for (const s of page.strokes) {
      if (es.markerOnly && s.t !== 'marker') { out.push(s); continue; }
      if (!strokeHit(s, x, y, r)) { out.push(s); continue; }
      changed = true;
      if (es.mode === 'pixel') out.push(...splitStroke(s, x, y, r));
    }
    if (changed) {
      page.strokes = out;
      this.changed = true;
      this.ed.contentChanged(page, true);
    }
  }

  move(list) {
    if (this.dead) return;
    const r = this.radius();
    for (const pt of list) {
      const p = this.ed.toPage(this.L, pt.sx, pt.sy);
      const d = Math.hypot(p.x - this.last.x, p.y - this.last.y);
      const steps = Math.max(1, Math.ceil(d / (r * 0.5)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        this.eraseAt(this.last.x + (p.x - this.last.x) * t, this.last.y + (p.y - this.last.y) * t);
      }
      this.last = p;
    }
  }

  end() {
    if (this.dead || !this.changed) return;
    this.ed.pushContent(this.page, this.before);
  }

  cancel() { this.end(); }
  small() { return true; }

  drawLive() { /* Kreis zeichnet der Editor (Hover/Cursor) */ }
}

// ---------------------------------------------------------------- Lasso
class LassoAction {
  constructor(ed, pt) {
    this.ed = ed;
    const hit = ed.hitPage(pt.sx, pt.sy, 60);
    if (!hit) { this.dead = true; return; }
    this.L = hit.L;
    this.page = hit.L.page;
    const p = ed.toPage(this.L, pt.sx, pt.sy);
    this.poly = [p.x, p.y];
    this.t0 = pt.t;
    this.travel = 0;
    this.x0 = pt.sx; this.y0 = pt.sy;
    ed.clearSelection();
  }

  move(list) {
    if (this.dead) return;
    for (const pt of list) {
      this.travel = Math.max(this.travel, Math.hypot(pt.sx - this.x0, pt.sy - this.y0));
      const p = this.ed.toPage(this.L, pt.sx, pt.sy);
      const n = this.poly.length;
      if (Math.hypot(p.x - this.poly[n - 2], p.y - this.poly[n - 1]) * this.ed.view.s > 3) this.poly.push(p.x, p.y);
    }
  }

  end(pt) {
    if (this.dead) return;
    const ed = this.ed, page = this.page;
    const ids = new Set();
    if (this.travel < 8) {
      // Antippen: einzelnes Element auswählen
      const { x, y } = ed.toPage(this.L, pt.sx, pt.sy);
      const tol = 10 / ed.view.s;
      for (let i = page.images.length - 1; i >= 0 && !ids.size; i--) {
        const im = page.images[i];
        if (x >= im.x && x <= im.x + im.w && y >= im.y && y <= im.y + im.h) ids.add(im.id);
      }
      if (!ids.size) { const t = textAt(page, x, y); if (t) ids.add(t.id); }
      if (!ids.size) for (let i = page.strokes.length - 1; i >= 0; i--) if (strokeHit(page.strokes[i], x, y, tol)) { ids.add(page.strokes[i].id); break; }
    } else {
      const poly = this.poly;
      for (const s of page.strokes) {
        const b = geom(s).bbox;
        if (!pointInPoly((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, poly)) {
          // mehrheitlich innen?
          let inside = 0, n = 0;
          for (let i = 0; i < s.pts.length; i += 3) { n++; if (pointInPoly(s.pts[i], s.pts[i + 1], poly)) inside++; }
          if (inside / n < 0.5) continue;
        }
        ids.add(s.id);
      }
      for (const t of page.texts) {
        const h = textHeight(t);
        if (pointInPoly(t.x + t.w / 2, t.y + h / 2, poly) || pointInPoly(t.x + 10, t.y + 10, poly)) ids.add(t.id);
      }
      for (const im of page.images) if (pointInPoly(im.x + im.w / 2, im.y + im.h / 2, poly)) ids.add(im.id);
    }
    if (ids.size) ed.setSelection(this.L, ids);
    else ed.requestLive();
  }

  cancel() { this.dead = true; this.ed.requestLive(); }
  small() { return this.travel < 12; }

  drawLive(ctx) {
    if (this.dead || this.poly.length < 4) return;
    const ed = this.ed;
    ed.pageTransform(ctx, this.L, false);
    const s = ed.view.s;
    ctx.beginPath();
    ctx.moveTo(this.poly[0], this.poly[1]);
    for (let i = 2; i < this.poly.length; i += 2) ctx.lineTo(this.poly[i], this.poly[i + 1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(13,143,128,0.07)';
    ctx.fill();
    ctx.setLineDash([6 / s, 5 / s]);
    ctx.lineWidth = 1.6 / s;
    ctx.strokeStyle = '#0d8f80';
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---------------------------------------------------------------- Auswahl verschieben / skalieren
class SelectionAction {
  constructor(ed, pt, mode) {
    this.ed = ed;
    this.mode = mode;
    this.sel = ed.selection;
    this.L = this.sel.L;
    this.start = ed.toPage(this.L, pt.sx, pt.sy);
    this.dx = 0; this.dy = 0; this.k = 1;
    this.travel = 0;
    this.x0 = pt.sx; this.y0 = pt.sy;
    ed.setSkip(this.L.page, this.sel.ids);
  }

  move(list) {
    const pt = list[list.length - 1];
    this.travel = Math.max(this.travel, Math.hypot(pt.sx - this.x0, pt.sy - this.y0));
    const p = this.ed.toPage(this.L, pt.sx, pt.sy);
    const b = this.sel.bbox;
    if (this.mode === 'move') { this.dx = p.x - this.start.x; this.dy = p.y - this.start.y; }
    else {
      const d0 = Math.hypot(this.start.x - b.x0, this.start.y - b.y0) || 1;
      const d1 = Math.hypot(p.x - b.x0, p.y - b.y0);
      this.k = Math.max(0.1, Math.min(10, d1 / d0));
    }
  }

  transformCtx(ctx) {
    const b = this.sel.bbox;
    ctx.translate(this.dx + b.x0, this.dy + b.y0);
    ctx.scale(this.k, this.k);
    ctx.translate(-b.x0, -b.y0);
  }

  end() {
    const ed = this.ed;
    ed.setSkip(null);
    if (this.travel < 3 || (Math.abs(this.dx) < 0.5 && Math.abs(this.dy) < 0.5 && Math.abs(this.k - 1) < 0.005)) { ed.requestRender(); return; }
    ed.transformSelection(this.dx, this.dy, this.k);
  }

  cancel() { this.ed.setSkip(null); this.ed.requestRender(); }
  small() { return this.travel < 12; }

  drawLive(ctx) {
    const ed = this.ed, page = this.L.page, ids = this.sel.ids;
    ed.pageTransform(ctx, this.L, true);
    this.transformCtx(ctx);
    for (const im of page.images) if (ids.has(im.id)) { const img = getImage(im.blob); if (img) ctx.drawImage(img, im.x, im.y, im.w, im.h); }
    for (const s of page.strokes) if (ids.has(s.id) && s.t === 'marker') drawStroke(ctx, s);
    for (const t of page.texts) if (ids.has(t.id)) drawText(ctx, t, page.paper === 'dark');
    for (const s of page.strokes) if (ids.has(s.id) && s.t !== 'marker') drawStroke(ctx, s);
  }
}

// ---------------------------------------------------------------- Laserpointer
class LaserAction {
  constructor(ed, pt) {
    this.ed = ed;
    ed.laser.push({ sx: pt.sx, sy: pt.sy, t: performance.now(), start: true });
    ed.animateLaser();
  }
  move(list) { for (const pt of list) this.ed.laser.push({ sx: pt.sx, sy: pt.sy, t: performance.now() }); this.ed.animateLaser(); }
  end() { this.ed.laserUp = performance.now(); this.ed.animateLaser(); }
  cancel() { this.end(); }
  small() { return true; }
  drawLive() { /* Editor zeichnet die Spur */ }
}

// ---------------------------------------------------------------- Tippen (Text-Werkzeug)
class TapAction {
  constructor(ed, pt) { this.ed = ed; this.x0 = pt.sx; this.y0 = pt.sy; this.travel = 0; this.t0 = pt.t; }
  move(list) { for (const pt of list) this.travel = Math.max(this.travel, Math.hypot(pt.sx - this.x0, pt.sy - this.y0)); }
  end(pt) { if (this.travel < 10) this.ed.textTap(pt.sx, pt.sy); }
  cancel() {}
  small() { return true; }
}

export function createAction(ed, toolName, pt) {
  const sel = ed.selection;
  if (sel) {
    const h = ed.selHit(pt.sx, pt.sy);
    if (h) return new SelectionAction(ed, pt, h);
  }
  switch (toolName) {
    case 'pen': case 'marker': case 'shape': case 'tape': return new InkAction(ed, pt, toolName);
    case 'eraser': return new EraseAction(ed, pt);
    case 'lasso': return new LassoAction(ed, pt);
    case 'laser': return new LaserAction(ed, pt);
    case 'text': return new TapAction(ed, pt);
    default: return null;
  }
}

export const FINGER_TOOLS = new Set(['pen', 'marker', 'shape', 'tape', 'eraser', 'lasso', 'laser']);
