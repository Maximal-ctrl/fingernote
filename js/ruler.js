// Lineal: liegt über der Seite, mit einem Finger verschieben, mit zwei Fingern drehen.
// Striche, die an einer Kante beginnen, werden an der Kante entlang geführt.

export class Ruler {
  constructor(ed, el) {
    this.ed = ed;
    this.el = el;
    this.label = el.querySelector('.ruler-angle');
    this.visible = false;
    this.len = 1200;
    this.h = 84;
    this.cx = 0; this.cy = 0;
    this.angle = 0;
    this.placed = false;
    this.g = null;
  }

  toggle() { if (this.visible) this.hide(); else this.show(); }

  show() {
    if (!this.placed) { this.cx = this.ed.W / 2; this.cy = this.ed.H * 0.55; this.placed = true; }
    this.visible = true;
    this.el.hidden = false;
    this.update();
    this.ed.ui.updateRuler();
  }

  hide() {
    this.visible = false;
    this.el.hidden = true;
    this.ed.ui.updateRuler();
  }

  update() {
    this.len = Math.max(900, Math.hypot(this.ed.W, this.ed.H) * 1.2);
    const s = this.el.style;
    s.width = this.len + 'px';
    s.height = this.h + 'px';
    s.transform = `translate(${this.cx - this.len / 2}px, ${this.cy - this.h / 2}px) rotate(${this.angle}deg)`;
    let a = Math.round(this.angle) % 180;
    if (a < 0) a += 180;
    if (a > 90) a = 180 - a;
    this.label.textContent = a + '°';
  }

  local(sx, sy) {
    const a = (-this.angle * Math.PI) / 180;
    const dx = sx - this.cx, dy = sy - this.cy;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
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

  project(edge, sx, sy) {
    const [lx] = this.local(sx, sy);
    const ly = edge === 'top' ? -this.h / 2 - 1.5 : this.h / 2 + 1.5;
    const a = (this.angle * Math.PI) / 180;
    return [this.cx + lx * Math.cos(a) - ly * Math.sin(a), this.cy + lx * Math.sin(a) + ly * Math.cos(a)];
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
      for (let target = -360; target <= 360; target += 45) if (Math.abs(a - target) < 3) a = target;
      this.angle = a;
      this.cx = g.cx + (cur[0].sx + cur[1].sx) / 2 - g.mx;
      this.cy = g.cy + (cur[0].sy + cur[1].sy) / 2 - g.my;
    }
    this.update();
  }
}
