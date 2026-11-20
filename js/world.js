// „Meine Welt“: alle Ordner und Bücher als Netzwerk rund um dich.
// Ziehen = bewegen, zwei Finger / Mausrad = zoomen, Antippen = öffnen.
import { el, clamp } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const c of kids) if (c) n.append(c);
  return n;
};
const RING = 200;

const ICON = {
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  pages: 'M7 3h11a2 2 0 012 2v12a2 2 0 01-2 2H7zM4 7v12a2 2 0 002 2h10',
  canvas: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM7 15c2-4 4 1 6-2s3-4 4-3',
};

export class World {
  constructor(handlers) {
    this.h = handlers; // { open(item), select(item|null, x, y), add(anchorEl) }
    this.el = el('div', { class: 'world' });
    this.view = null;
    this.bindGestures();
  }

  /** items: nicht gelöschte Ordner/Bücher, me: {name, color} */
  render(items, me) {
    const byParent = new Map();
    for (const it of items) {
      const k = it.parent || null;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(it);
    }
    for (const list of byParent.values()) list.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'de') : a.kind === 'folder' ? -1 : 1));
    // Gewicht = Anzahl Blätter im Teilbaum
    const weight = new Map();
    const w = (id) => {
      const kids = byParent.get(id) || [];
      const v = kids.length ? kids.reduce((s, k) => s + w(k.id), 0) : 1;
      weight.set(id, v);
      return v;
    };
    w(null);
    const nodes = [];
    const edges = [];
    let maxDepth = 0;
    const place = (parentId, depth, a0, a1, px, py) => {
      const kids = byParent.get(parentId) || [];
      const total = kids.reduce((s, k) => s + weight.get(k.id), 0) || 1;
      let a = a0;
      for (const k of kids) {
        const span = ((a1 - a0) * weight.get(k.id)) / total;
        const mid = a + span / 2;
        const r = depth * RING;
        const x = Math.cos(mid) * r, y = Math.sin(mid) * r;
        nodes.push({ it: k, x, y, depth });
        edges.push({ x0: px, y0: py, x1: x, y1: y, color: k.color, depth });
        maxDepth = Math.max(maxDepth, depth);
        place(k.id, depth + 1, a, a + span, x, y);
        a += span;
      }
    };
    place(null, 1, -Math.PI / 2, Math.PI * 1.5, 0, 0);

    const svg = sv('svg', { class: 'world-svg', width: '100%', height: '100%' });
    const defs = sv('defs');
    const g = sv('linearGradient', { id: 'wroot', x1: '0', y1: '1', x2: '1', y2: '0' },
      sv('stop', { offset: '0', 'stop-color': '#5b8cff' }), sv('stop', { offset: '.55', 'stop-color': '#8b5cf6' }), sv('stop', { offset: '1', 'stop-color': '#ff6fb1' }));
    const glow = sv('radialGradient', { id: 'wglow' }, sv('stop', { offset: '0', 'stop-color': '#8b5cf6', 'stop-opacity': '.35' }), sv('stop', { offset: '1', 'stop-color': '#8b5cf6', 'stop-opacity': '0' }));
    defs.append(g, glow);
    svg.append(defs);
    const layer = sv('g', { class: 'world-layer' });
    svg.append(layer);
    // Umlaufbahnen
    for (let d = 1; d <= Math.max(1, maxDepth); d++) layer.append(sv('circle', { cx: 0, cy: 0, r: d * RING, class: 'orbit' }));
    layer.append(sv('circle', { cx: 0, cy: 0, r: 150, fill: 'url(#wglow)' }));
    // Verbindungen
    for (const e of edges) {
      const mx = (e.x0 + e.x1) / 2, my = (e.y0 + e.y1) / 2;
      const bend = 0.12;
      const cx = mx - (e.y1 - e.y0) * bend, cy = my + (e.x1 - e.x0) * bend;
      layer.append(sv('path', { d: `M${e.x0} ${e.y0}Q${cx} ${cy} ${e.x1} ${e.y1}`, class: 'link', stroke: e.color || '#888' }));
    }
    // Mitte: du
    const root = sv('g', { class: 'wnode root', 'data-root': '1', transform: 'translate(0 0)' },
      sv('circle', { r: 48, fill: 'url(#wroot)' }),
      sv('text', { class: 'root-initial', y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, document.createTextNode(initials(me.name))),
      sv('text', { class: 'wlabel strong', y: 74, 'text-anchor': 'middle' }, document.createTextNode('Meine Welt')));
    layer.append(root);
    // Knoten
    for (const n of nodes) {
      const it = n.it;
      const folder = it.kind === 'folder';
      const grp = sv('g', { class: `wnode ${folder ? 'folder' : 'book'}`, 'data-id': it.id, transform: `translate(${n.x} ${n.y})` });
      if (folder) grp.append(sv('rect', { x: -30, y: -30, width: 60, height: 60, rx: 18, class: 'nbg', style: `--c:${it.color || '#64748b'}` }));
      else grp.append(sv('circle', { r: 30, class: 'nbg', style: `--c:${it.color || '#6a5cff'}` }));
      const ic = sv('g', { transform: 'translate(-12 -12)', class: 'nicon' }, sv('path', { d: folder ? ICON.folder : it.mode === 'canvas' ? ICON.canvas : ICON.pages }));
      grp.append(ic);
      if (it.fav) grp.append(sv('circle', { cx: 22, cy: -22, r: 7, class: 'nfav' }));
      grp.append(sv('text', { class: 'wlabel', y: 50, 'text-anchor': 'middle' }, document.createTextNode(short(it.name))));
      layer.append(grp);
    }
    if (!items.length) {
      layer.append(sv('text', { class: 'wlabel hint', y: 130, 'text-anchor': 'middle' }, document.createTextNode('Tippe auf „+ Neu“, um dein erstes Buch oder einen Ordner zu erstellen')));
    }
    this.el.replaceChildren(svg);
    this.svg = svg;
    this.layer = layer;
    this.extent = Math.max(1, maxDepth) * RING + 140;
    if (!this.view) requestAnimationFrame(() => this.fit());
    else this.apply();
  }

  fit() {
    const r = this.el.getBoundingClientRect();
    if (!r.width) return;
    const k = clamp(Math.min(r.width, r.height) / (this.extent * 2), 0.25, 1.4);
    this.view = { x: r.width / 2, y: r.height / 2 - 20, k };
    this.apply();
  }

  apply() {
    if (!this.layer || !this.view) return;
    const v = this.view;
    this.layer.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`);
  }

  zoomAt(x, y, f) {
    const v = this.view;
    const k = clamp(v.k * f, 0.15, 3);
    v.x = x - ((x - v.x) * k) / v.k;
    v.y = y - ((y - v.y) * k) / v.k;
    v.k = k;
    this.apply();
  }

  bindGestures() {
    const pts = new Map();
    let start = null, pinch = null;
    const pos = (e) => { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.view) return;
      try { this.el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      pts.set(e.pointerId, pos(e));
      if (pts.size === 1) start = { ...pos(e), vx: this.view.x, vy: this.view.y, moved: false, target: e.target, t: e.timeStamp };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, k: this.view.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: this.view.x, vy: this.view.y };
        if (start) start.moved = true;
      }
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = pos(e);
      pts.set(e.pointerId, p);
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const k = clamp(pinch.k * (d / pinch.d), 0.15, 3);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.view.k = k;
        this.view.x = cx - ((pinch.cx - pinch.vx) * k) / pinch.k;
        this.view.y = cy - ((pinch.cy - pinch.vy) * k) / pinch.k;
        this.apply();
      } else if (start) {
        const dx = p.x - start.x, dy = p.y - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 6) return;
        start.moved = true;
        this.view.x = start.vx + dx;
        this.view.y = start.vy + dy;
        this.apply();
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0 && start) {
        if (!start.moved && e.type === 'pointerup') {
          const node = start.target.closest && start.target.closest('.wnode');
          if (node && node.dataset.id) this.h.open(node.dataset.id, node);
          else if (node && node.dataset.root) this.h.root(node);
        }
        start = null;
      }
    };
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
    this.el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      if (e.ctrlKey || e.metaKey) this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01));
      else { this.view.x -= e.deltaX; this.view.y -= e.deltaY; this.apply(); }
    }, { passive: false });
    this.el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }
}

function initials(n) { return (n || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }
function short(s) { return s.length > 18 ? s.slice(0, 17) + '…' : s; }
