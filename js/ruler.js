// Lineal: liegt über der Seite, mit einem Finger verschieben, mit zwei Fingern drehen.
// Die Skala zeigt echte Seiten-Zentimeter (2 Kästchen = 1 cm) und passt sich beim Zoomen an.
// Die Null-Marke ist der Drehpunkt: Drehen um 120°/30° für Stern, Dreieck und Zeigerdiagramme.
// Striche, die an einer Kante beginnen, werden an der Kante entlang geführt.
import { el } from './util.js';
import { toast } from './ui.js';
import { MM } from './ink.js';

const SNAP = 14; // Fangradius in Bildschirmpunkten

export class Ruler {
  constructor(ed, elm) {
    this.ed = ed;
    this.el = elm;
    this.label = elm.querySelector('.ruler-angle');
    this.cv = document.createElement('canvas');
    this.cv.className = 'ruler-scale';
    elm.prepend(this.cv);
    this.visible = false;
    this.len = 1200;
    this.h = 104;
    this.cx = 0; this.cy = 0;
    this.angle = 0;
    this.edge = 'top';
    this.placed = false;
    this.g = null;
    this.lastEnd = null;
    this.paintKey = '';
    this.measuring = false; // Leiste: Zeichnen ↔ Messen
    this.snapEnds = true;   // beim Messen an Linienenden einrasten
    this.meas = null;       // { id, a:{x,y}, b:{x,y}|null } in Seitenkoordinaten
    const b = (txt, title, fn) => el('button', { class: 'rb', title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); fn(); } }, txt);
    this.modeDraw = b('✎ Zeichnen', 'Am Lineal zeichnen', () => this.setMeasuring(false));
    this.modeMeas = b('📏 Messen', 'Abstand zwischen zwei Punkten messen', () => this.setMeasuring(true));
    this.endsBtn = b('', 'Beim Messen an Linienenden einrasten', () => { this.snapEnds = !this.snapEnds; this.syncBar(); });
    this.endsBtn.classList.add('rb-ends');
    this.bar = el('div', { class: 'ruler-bar glass', hidden: true },
      el('span', { class: 'rb-seg' }, this.modeDraw, this.modeMeas),
      this.endsBtn,
      el('span', { class: 'rb-sep' }),
      b('↺ 120°', 'Um den Nullpunkt 120° nach links drehen', () => this.rotateBy(-120)),
      b('↺ 30°', 'Um den Nullpunkt 30° nach links drehen', () => this.rotateBy(-30)),
      b('0°', 'Waagerecht ausrichten', () => this.rotateBy(-this.angle)),
      b('↻ 30°', 'Um den Nullpunkt 30° nach rechts drehen', () => this.rotateBy(30)),
      b('↻ 120°', 'Um den Nullpunkt 120° nach rechts drehen', () => this.rotateBy(120)),
      el('span', { class: 'rb-sep' }),
      b('⤳ Ende', 'Nullpunkt an das Ende der letzten Linie setzen', () => this.toLastEnd()),
      b('⇅ Kante', 'Messkante wechseln (oben/unten)', () => { this.setEdge(this.edge === 'top' ? 'bottom' : 'top'); }));
    elm.parentNode.append(this.bar);
    this.syncBar();
  }

  syncBar() {
    this.modeDraw.classList.toggle('on', !this.measuring);
    this.modeMeas.classList.toggle('on', this.measuring);
    this.endsBtn.hidden = !this.measuring;
    this.endsBtn.textContent = this.snapEnds ? '◉ Enden: an' : '○ Enden: aus';
    this.endsBtn.classList.toggle('on', this.snapEnds);
  }

  setMeasuring(on) {
    this.measuring = on;
    if (!on) { this.meas = null; this.ed.hideMeasure(); }
    else toast('Messen: ersten Punkt antippen, dann den zweiten – oder von Punkt zu Punkt ziehen');
    this.syncBar();
    this.ed.requestLive();
  }

  /** Punkt zum Messen: rastet (wenn „Enden: an“) an Linienenden und Ecken ein. */
  snapPoint(L, sx, sy) {
    const p0 = this.ed.toPage(L, sx, sy);
    if (!this.snapEnds) return p0;
    let best = null, bd = 18;
    const test = (x, y) => {
      const s = this.ed.toScreen(L, x, y);
      const d = Math.hypot(s.sx - sx, s.sy - sy);
      if (d < bd) { bd = d; best = { x, y, snap: true }; }
    };
    for (const st of L.page.strokes) {
      const p = st.pts;
      if (!p || p.length < 3) continue;
      if (st.sh) { for (let i = 0; i < p.length; i += 3) test(p[i], p[i + 1]); } // Formen: alle Ecken
      else { test(p[0], p[1]); test(p[p.length - 3], p[p.length - 2]); }
    }
    return best || p0;
  }

  /** Messung auf die Live-Ebene zeichnen (Bildschirmkoordinaten). */
  drawMeasure(ctx) {
    const m = this.meas;
    const L = m && this.ed.layout.find((l) => l.page.id === m.id);
    if (!L) { this.ed.hideMeasure(); return; }
    const d = this.ed.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const A = this.ed.toScreen(L, m.a.x, m.a.y);
    const col = '#0a84ff';
    const dot = (P, snap) => {
      ctx.beginPath(); ctx.arc(P.sx, P.sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = snap ? '#30b158' : col; ctx.stroke();
      ctx.beginPath(); ctx.arc(P.sx, P.sy, 2, 0, Math.PI * 2); ctx.fillStyle = snap ? '#30b158' : col; ctx.fill();
    };
    // Beschriftung als Element über dem Lineal (sonst läge sie darunter)
    const pill = (x, y, main, sub) => this.ed.showMeasure(x, y, main, sub);
    if (!m.b) {
      dot(A, m.a.snap);
      pill(A.sx, A.sy, 'Punkt A', '2. Punkt antippen');
      return;
    }
    const B = this.ed.toScreen(L, m.b.x, m.b.y);
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = 2; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
    ctx.setLineDash([]);
    dot(A, m.a.snap); dot(B, m.b.snap);
    const dx = m.b.x - m.a.x, dy = m.b.y - m.a.y;
    const cm = Math.hypot(dx, dy) / MM / 10;
    let ang = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
    if (ang < 0) ang += 360;
    const f = (v) => v.toFixed(Math.abs(v) < 10 ? 2 : 1).replace('.', ',');
    const sub = `${ang}° · ↔ ${f(Math.abs(dx) / MM / 10)} · ↕ ${f(Math.abs(dy) / MM / 10)}`;
    const mx = (A.sx + B.sx) / 2, my = (A.sy + B.sy) / 2;
    pill(mx, my, `${f(cm)} cm`, sub);
  }

  toggle() { if (this.visible) this.hide(); else this.show(); }

  show() {
    if (!this.placed) { this.cx = this.ed.W / 2; this.cy = this.ed.H * 0.55; this.placed = true; }
    this.visible = true;
    this.el.hidden = false;
    this.bar.hidden = false;
    this.update();
    this.ed.ui.updateRuler();
  }

  hide() {
    this.visible = false;
    if (this.measuring) { this.measuring = false; this.meas = null; this.syncBar(); this.ed.hideMeasure(); this.ed.requestLive(); }
    this.el.hidden = true;
    this.bar.hidden = true;
    this.ed.ui.updateRuler();
  }

  /** Bildschirmpunkte pro Millimeter auf der Seite (abhängig vom Zoom). */
  pxmm() { return MM * this.ed.view.s; }

  update() {
    this.len = Math.max(900, Math.hypot(this.ed.W, this.ed.H) * 1.3);
    const s = this.el.style;
    s.width = this.len + 'px';
    s.height = this.h + 'px';
    s.transform = `translate(${this.cx - this.len / 2}px, ${this.cy - this.h / 2}px) rotate(${this.angle}deg)`;
    this.bar.style.top = (this.ed.topInset ? this.ed.topInset() : 70) + 8 + 'px';
    this.label.textContent = this.dirText(this.angle);
    this.paint();
  }

  /** Richtung als Winkel 0–359° (mathematisch, gegen den Uhrzeigersinn). */
  dirText(a) {
    let d = Math.round(-a) % 360;
    if (d < 0) d += 360;
    return d + '°';
  }

  /** Skala zeichnen – nur wenn sich Zoom oder Größe geändert hat. */
  paint() {
    if (!this.visible) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const pm = this.pxmm();
    const key = [this.len, this.h, pm.toFixed(4), dpr, this.edge].join('|');
    if (key === this.paintKey) return;
    this.paintKey = key;
    const W = this.len, H = this.h, c = this.cv;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + 'px'; c.style.height = H + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const mid = W / 2;
    // Teilung: mm, wenn genug Platz, sonst 5 mm / 1 cm / 5 cm
    let step = 1; // mm
    while (step * pm < 4.5) step = step === 1 ? 5 : step === 5 ? 10 : step * 5;
    // Beschriftung alle n cm, damit die Zahlen nicht zusammenstoßen
    let lab = 1;
    while (lab * 10 * pm < 26) lab = lab === 1 ? 2 : lab === 2 ? 5 : lab * 2;
    const n = Math.ceil(mid / (step * pm)) + 1;
    ctx.font = '600 11px -apple-system, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    for (const top of [true, false]) {
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -n; i <= n; i++) {
        const mm = i * step;
        const x = Math.round(mid + mm * pm) + 0.5;
        if (x < 0 || x > W) continue;
        const cm = mm % 10 === 0, half = mm % 5 === 0;
        const tl = cm ? 20 : half ? 13 : 8;
        if (top) { ctx.moveTo(x, 0); ctx.lineTo(x, tl); } else { ctx.moveTo(x, H); ctx.lineTo(x, H - tl); }
        if (cm && (Math.abs(mm / 10) % lab === 0)) {
          const t = String(Math.abs(mm / 10));
          ctx.fillText(t, x, top ? 32 : H - 24);
        }
      }
      ctx.stroke();
    }
    // Nullpunkt / Drehpunkt an der aktiven Kante
    const top = this.edge === 'top';
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    if (top) { ctx.moveTo(mid, 1); ctx.lineTo(mid - 7, 13); ctx.lineTo(mid + 7, 13); }
    else { ctx.moveTo(mid, H - 1); ctx.lineTo(mid - 7, H - 13); ctx.lineTo(mid + 7, H - 13); }
    ctx.closePath();
    ctx.fill();
  }

  local(sx, sy) {
    const a = (-this.angle * Math.PI) / 180;
    const dx = sx - this.cx, dy = sy - this.cy;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  }

  toScreen(lx, ly) {
    const a = (this.angle * Math.PI) / 180;
    return [this.cx + lx * Math.cos(a) - ly * Math.sin(a), this.cy + lx * Math.sin(a) + ly * Math.cos(a)];
  }

  hit(sx, sy) {
    const [lx, ly] = this.local(sx, sy);
    return Math.abs(lx) <= this.len / 2 && Math.abs(ly) <= this.h / 2;
  }

  edgeNear(sx, sy) {
    const [lx, ly] = this.local(sx, sy);
    if (Math.abs(lx) > this.len / 2 + 10) return null;
    if (Math.abs(ly + this.h / 2) < 26) return 'top';
    if (Math.abs(ly - this.h / 2) < 26) return 'bottom';
    return null;
  }

  edgeY(edge) { return edge === 'top' ? -this.h / 2 - 1.5 : this.h / 2 + 1.5; }

  project(edge, sx, sy) { return this.projectLx(edge, this.local(sx, sy)[0]); }
  projectLx(edge, lx) { return this.toScreen(lx, this.edgeY(edge)); }

  /** Kandidaten zum Einrasten entlang der Kante: Nullpunkt und Linienenden in der Nähe. */
  snapTargets(edge, L) {
    const out = [0];
    if (!L) return out;
    const ey = this.edgeY(edge);
    for (const st of L.page.strokes) {
      const p = st.pts;
      if (!p || p.length < 3) continue;
      for (const i of [0, p.length - 3]) {
        const s = this.ed.toScreen(L, p[i], p[i + 1]);
        const [lx, ly] = this.local(s.sx, s.sy);
        if (Math.abs(ly - ey) < SNAP) out.push(lx);
      }
    }
    return out;
  }

  /** Anfang eines Strichs an der Kante: rastet am Nullpunkt oder an Linienenden ein. */
  snapStart(edge, lx, L) {
    if (edge !== this.edge) this.setEdge(edge);
    this._targets = this.snapTargets(edge, L);
    let best = lx, bd = SNAP;
    for (const t of this._targets) { const d = Math.abs(t - lx); if (d < bd) { bd = d; best = t; } }
    return best;
  }

  /** Ende eines Strichs: an Linienenden/Nullpunkt, sonst auf ganze Millimeter. */
  snapEnd(edge, lx, l0) {
    for (const t of this._targets || []) if (t !== l0 && Math.abs(t - lx) < SNAP * 0.8) return t;
    const pm = this.pxmm();
    const unit = pm >= 2.5 ? pm : pm * 5; // 1 mm, bei kleinem Zoom 5 mm
    return l0 + Math.round((lx - l0) / unit) * unit;
  }

  setEdge(edge) {
    this.edge = edge;
    this.update();
  }

  /** Drehen um den Nullpunkt der aktiven Kante. */
  rotateBy(d) {
    if (!d) return;
    const [px, py] = this.projectLx(this.edge, 0);
    this.angle = Math.round((this.angle + d) * 1000) / 1000;
    this.angle = ((this.angle % 360) + 360) % 360;
    if (this.angle > 180) this.angle -= 360;
    this.placeZeroAt(px, py);
  }

  /** Lineal so verschieben, dass der Nullpunkt genau auf (sx, sy) liegt. */
  placeZeroAt(sx, sy) {
    const a = (this.angle * Math.PI) / 180, ly = this.edgeY(this.edge);
    this.cx = sx + ly * Math.sin(a);
    this.cy = sy - ly * Math.cos(a);
    this.update();
  }

  /** Nach einem Strich am Lineal: Endpunkt merken (für „⤳ Ende“, z. B. beim Dreieck). */
  noteLine(L, x0, y0, x1, y1) { this.lastEnd = { id: L.page.id, x: x1, y: y1, sx: x0, sy: y0 }; }

  toLastEnd() {
    const e = this.lastEnd;
    const L = e && this.ed.layout.find((l) => l.page.id === e.id);
    if (!L) { toast('Zuerst eine Linie am Lineal zeichnen'); return; }
    const s = this.ed.toScreen(L, e.x, e.y);
    this.placeZeroAt(s.sx, s.sy);
  }

  begin(touches) {
    const t = touches.slice(0, 2).map((p) => ({ id: p.id, sx: p.sx, sy: p.sy }));
    this.g = { t, cx: this.cx, cy: this.cy, angle: this.angle };
    if (t.length === 2) {
      this.g.ang0 = Math.atan2(t[1].sy - t[0].sy, t[1].sx - t[0].sx);
      this.g.mx = (t[0].sx + t[1].sx) / 2;
      this.g.my = (t[0].sy + t[1].sy) / 2;
    }
  }

  move(touches) {
    const g = this.g;
    if (!g) return;
    const cur = g.t.map((o) => touches.find((p) => p.id === o.id));
    if (cur.some((c) => !c)) { this.begin(touches); return; }
    if (cur.length === 1) {
      this.cx = g.cx + cur[0].sx - g.t[0].sx;
      this.cy = g.cy + cur[0].sy - g.t[0].sy;
    } else {
      const ang = Math.atan2(cur[1].sy - cur[0].sy, cur[1].sx - cur[0].sx);
      let a = g.angle + ((ang - g.ang0) * 180) / Math.PI;
      // rastet alle 15° ein (0, 30, 45, 60, 90, 120 …)
      for (let target = -360; target <= 360; target += 15) if (Math.abs(a - target) < 2.5) a = target;
      this.angle = a;
      this.cx = g.cx + (cur[0].sx + cur[1].sx) / 2 - g.mx;
      this.cy = g.cy + (cur[0].sy + cur[1].sy) / 2 - g.my;
    }
    this.update();
  }
}
