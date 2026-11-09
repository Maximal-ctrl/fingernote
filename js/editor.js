// Editor: Seitenansicht, Zoom/Scrollen, Eingabe (Finger, Apple Pencil, Maus), Verlauf, Speichern.
import { uid, clamp, round2, debounce, getSettings, saveSettings, el } from './util.js';
import * as ink from './ink.js';
import * as store from './store.js';
import { createAction, FINGER_TOOLS } from './tools.js';
import { EditorUI } from './editor-ui.js';
import { Ruler } from './ruler.js';
import { toast, closePopover } from './ui.js';

const GAP = 36;
const MAX_S = 8;

export const DEFAULT_TOOLS = {
  pen: { type: 'pen', colors: ['#1d1d1f', '#1f5eff', '#e5383b', '#139a52', '#8b3dff', '#f08c00'], ci: 0, widths: [1.6, 2.8, 5], wi: 1 },
  marker: { colors: ['#ffe14d', '#7ee08a', '#7cc4ff', '#ff94c6', '#ffb35c'], ci: 0, widths: [12, 20, 32], wi: 1, straight: false },
  eraser: { mode: 'stroke', markerOnly: false, sizes: [8, 18, 36], si: 1 },
  tape: { colors: ['#f6c945', '#8fd3c7', '#b9a6f5', '#f4a3a3'], ci: 0, widths: [22, 34, 50], wi: 1 },
  text: { size: 20 },
};

export class Editor {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('editor');
    this.ui = new EditorUI(this);
    this.stage = this.root.querySelector('.ed-stage');
    this.base = this.stage.querySelector('canvas.base');
    this.live = this.stage.querySelector('canvas.live');
    this.bctx = this.base.getContext('2d');
    this.lctx = this.live.getContext('2d');
    this.ta = this.stage.querySelector('.text-edit');
    this.ruler = new Ruler(this, this.stage.querySelector('.ruler'));
    this.view = { tx: 0, ty: 0, s: 1 };
    this.W = 0; this.H = 0; this.dpr = 1;
    this.rect = { left: 0, top: 0 };
    this.pages = [];
    this.layout = [];
    this.layoutById = new Map();
    this.caches = new Map();
    this.history = { undo: [], redo: [] };
    this.dirty = new Set();
    this.knownIds = new Set();
    this.pointers = new Map();
    this.ignored = new Set();
    this.mode = null;
    this.action = null;
    this.selection = null;
    this.clipboard = null;
    this.skip = null;
    this.skipPage = null;
    this.editing = null;
    this.laser = [];
    this.laserUp = 0;
    this.moving = false;
    this.lastPenT = -1e9;
    this.penDown = false;
    this.toolState = this.loadToolState();
    this.tool = 'pen';
    this.isOpen = false;
    this.scheduleSave = debounce(() => this.save(), 700);
    this.bindInput();
    this.bindText();
    window.addEventListener('resize', () => { if (this.isOpen) this.resize(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.ensureTextVisible());
    ink.onImageLoaded(() => {
      if (!this.isOpen) return;
      this.caches.forEach((c) => { c.ver = -1; });
      this.ui.invalidateThumbs();
      this.requestRender();
    });
    const flush = () => { if (this.isOpen) this.scheduleSave.flush(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    document.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') this.spaceDown = false; });
  }

  // ------------------------------------------------------------ Werkzeug-Einstellungen
  loadToolState() {
    const saved = getSettings().tools || {};
    const out = JSON.parse(JSON.stringify(DEFAULT_TOOLS));
    for (const k of Object.keys(out)) if (saved[k]) Object.assign(out[k], saved[k]);
    return out;
  }
  saveToolState() { saveSettings({ tools: this.toolState }); }

  setTool(name) {
    if (this.editing && name !== 'text') this.finishTextEdit();
    if (name !== 'lasso') this.clearSelection();
    this.tool = name;
    this.ui.refreshTool();
    this.requestLive();
  }

  fingerDraws() {
    const st = getSettings();
    return st.finger === 'draw' || (st.finger === 'auto' && !st.pencilSeen);
  }

  toggleFinger() {
    const draws = this.fingerDraws();
    saveSettings({ finger: draws ? 'pan' : 'draw' });
    this.ui.updateFinger();
    toast(draws ? 'Finger scrollt und zoomt – zeichnen mit dem Stift' : 'Finger zeichnet – mit zwei Fingern scrollen und zoomen');
  }

  notePencil() {
    const st = getSettings();
    if (st.pencilSeen) return;
    saveSettings({ pencilSeen: true });
    if (st.finger === 'auto') {
      this.ui.updateFinger();
      toast('Apple Pencil erkannt: Der Finger scrollt jetzt. Umschalten über das Hand-Symbol.', { ms: 4500 });
    }
  }

  // ------------------------------------------------------------ Öffnen / Schließen
  async open(nbId, pageId) {
    const data = await store.loadNotebook(nbId);
    if (!data) { toast('Notizbuch nicht gefunden.'); return false; }
    this.nb = data.nb;
    this.pages = data.pages;
    this.pages.forEach((p) => { p._v = 0; });
    this.knownIds = new Set(this.pages.map((p) => p.id));
    this.history = { undo: [], redo: [] };
    this.dirty.clear();
    this.changed = false;
    this.selection = null;
    this.clipboardPasteCount = 0;
    this.isOpen = true;
    this.root.hidden = false;
    this.ui.onOpen();
    this.relayout();
    this.resize();
    this.fit();
    if (pageId) {
      const i = this.pages.findIndex((p) => p.id === pageId);
      if (i >= 0) this.goToPage(i);
    }
    this.requestRender();
    return true;
  }

  async close() {
    this.finishTextEdit();
    this.clearSelection();
    this.cancelAll();
    this.scheduleSave.cancel();
    await this.save();
    if (this.changed || !this.nb.thumb) await this.makeThumb();
    this.isOpen = false;
    for (const c of this.caches.values()) { c.canvas.width = c.canvas.height = 0; }
    this.caches.clear();
    this.ui.onClose();
    this.ruler.hide();
    this.nb = null;
    this.pages = [];
    this.layout = [];
  }

  async makeThumb() {
    try {
      const p = this.pages[0];
      await ink.ensureImages(p);
      const c = document.createElement('canvas');
      ink.renderPageToCanvas(c, p, 300 / p.w);
      this.nb.thumb = c.toDataURL('image/jpeg', 0.72);
      c.width = c.height = 0;
      await store.saveItem(this.nb);
    } catch (e) { console.warn('Vorschaubild', e); }
  }

  // ------------------------------------------------------------ Speichern
  markDirty(page) { this.dirty.add(page); this.changed = true; this.ui.setSaveState('dirty'); this.scheduleSave(); }

  async save() {
    if (!this.nb) return;
    if (this.saving) { this.saveAgain = true; return this.saving; }
    const cur = new Set(this.pages.map((p) => p.id));
    for (const p of this.pages) if (!this.knownIds.has(p.id)) this.dirty.add(p);
    const removed = [...this.knownIds].filter((id) => !cur.has(id));
    const dirty = [...this.dirty].filter((p) => cur.has(p.id));
    if (!dirty.length && !removed.length && !this.nbDirty) { this.ui.setSaveState('saved'); return; }
    this.dirty.clear();
    this.nbDirty = false;
    const nb = this.nb;
    nb.pages = this.pages.map((p) => p.id);
    nb.updated = Date.now();
    nb.idx = store.buildIndex(this.pages);
    this.ui.setSaveState('saving');
    this.saving = (async () => {
      try {
        await store.savePages(nb, dirty, removed);
        this.knownIds = cur;
        this.ui.setSaveState('saved');
      } catch (e) {
        console.error(e);
        dirty.forEach((p) => this.dirty.add(p));
        this.nbDirty = true;
        this.ui.setSaveState('error');
        toast('Speichern fehlgeschlagen – bitte Speicherplatz prüfen.');
      }
    })();
    await this.saving;
    this.saving = null;
    if (this.saveAgain) { this.saveAgain = false; await this.save(); }
  }

  // ------------------------------------------------------------ Layout & Ansicht
  relayout() {
    let y = 0;
    this.maxW = 0;
    this.layout = this.pages.map((p) => {
      const L = { page: p, x: -p.w / 2, y };
      y += p.h + GAP;
      this.maxW = Math.max(this.maxW, p.w);
      return L;
    });
    this.contentH = Math.max(0, y - GAP);
    this.layoutById = new Map(this.layout.map((L) => [L.page.id, L]));
    if (this.selection) {
      const L = this.layoutById.get(this.selection.L.page.id);
      if (L) this.selection.L = L; else this.selection = null;
    }
    if (this.editing) {
      const L = this.layoutById.get(this.editing.L.page.id);
      if (L) this.editing.L = L;
    }
  }

  resize() {
    // War auf Seitenbreite gezoomt? Dann nach Drehen des iPads wieder einpassen.
    const wasFit = this.W && Math.abs(this.view.s / this.fitScale() - 1) < 0.02;
    const keepIdx = wasFit ? this.currentIndex() : -1;
    const r = this.stage.getBoundingClientRect();
    this.rect = r;
    this.W = r.width;
    this.H = r.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    for (const c of [this.base, this.live]) {
      c.width = Math.max(1, Math.round(this.W * this.dpr));
      c.height = Math.max(1, Math.round(this.H * this.dpr));
      c.style.width = this.W + 'px';
      c.style.height = this.H + 'px';
    }
    this.deskColor = getComputedStyle(this.root).getPropertyValue('--desk').trim() || '#e8e8e3';
    if (this.ruler.visible) this.ruler.update();
    if (keepIdx >= 0) {
      this.view.s = this.fitScale();
      this.view.tx = this.W / 2;
      const L = this.layout[keepIdx];
      if (L) this.view.ty = 18 - L.y * this.view.s;
    }
    this.clampView();
    this.requestRender();
  }

  themeChanged() { if (this.isOpen) this.resize(); }

  fitScale() { return clamp((this.W - 40) / (this.maxW || 1000), 0.15, 1.6); }
  minScale() { return Math.min(this.fitScale() * 0.3, 0.3); }

  fit() {
    const idx = this.currentIndex();
    this.view.s = this.fitScale();
    this.view.tx = this.W / 2;
    this.goToPage(idx);
  }

  goToPage(i) {
    const L = this.layout[clamp(i, 0, this.layout.length - 1)];
    if (!L) return;
    this.view.ty = 18 - L.y * this.view.s;
    this.clampView();
    this.requestRender();
  }

  clampView(v = this.view) {
    const s = v.s;
    const cw = this.maxW * s;
    if (cw <= this.W - 24) v.tx = this.W / 2;
    else v.tx = clamp(v.tx, this.W - 12 - (this.maxW / 2) * s, 12 + (this.maxW / 2) * s);
    const ch = this.contentH * s;
    const top = 18, bottom = 64;
    if (ch <= this.H - top - bottom) v.ty = top;
    else v.ty = clamp(v.ty, this.H - bottom - ch, top);
  }

  zoomAt(sx, sy, k) {
    const v = this.view;
    const s = clamp(v.s * k, this.minScale(), MAX_S);
    const wx = (sx - v.tx) / v.s, wy = (sy - v.ty) / v.s;
    v.s = s;
    v.tx = sx - wx * s;
    v.ty = sy - wy * s;
    this.clampView();
    this.setMoving();
    this.requestRender();
  }

  setMoving() {
    this.moving = true;
    clearTimeout(this.idleT);
    this.idleT = setTimeout(() => { this.moving = false; this.requestRender(); }, 140);
  }

  visible() {
    const { ty, s } = this.view;
    const out = [];
    for (const L of this.layout) {
      const y0 = ty + L.y * s, y1 = y0 + L.page.h * s;
      if (y1 < -40) continue;
      if (y0 > this.H + 40) break;
      out.push(L);
    }
    return out;
  }

  currentIndex() {
    if (!this.layout.length) return 0;
    const wy = (this.H * 0.4 - this.view.ty) / this.view.s;
    let best = 0, bd = Infinity;
    this.layout.forEach((L, i) => {
      const d = wy < L.y ? L.y - wy : wy > L.y + L.page.h ? wy - L.y - L.page.h : 0;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  currentLayout() { return this.layout[this.currentIndex()]; }

  // ------------------------------------------------------------ Koordinaten
  hitPage(sx, sy, margin = 0) {
    const { tx, ty, s } = this.view;
    const wx = (sx - tx) / s, wy = (sy - ty) / s;
    for (const L of this.layout) {
      const p = L.page;
      if (wy < L.y - margin) break;
      if (wx >= L.x - margin && wx <= L.x + p.w + margin && wy >= L.y - margin && wy <= L.y + p.h + margin) {
        return { L, x: wx - L.x, y: wy - L.y };
      }
    }
    return null;
  }

  toPage(L, sx, sy) {
    const { tx, ty, s } = this.view;
    return { x: (sx - tx) / s - L.x, y: (sy - ty) / s - L.y };
  }

  toScreen(L, x, y) {
    const { tx, ty, s } = this.view;
    return { sx: tx + (L.x + x) * s, sy: ty + (L.y + y) * s };
  }

  pageTransform(ctx, L, clip) {
    const { tx, ty, s } = this.view, d = this.dpr;
    ctx.setTransform(d * s, 0, 0, d * s, d * (tx + L.x * s), d * (ty + L.y * s));
    if (clip) { ctx.beginPath(); ctx.rect(0, 0, L.page.w, L.page.h); ctx.clip(); }
  }

  // ------------------------------------------------------------ Zeichnen
  requestRender() { this.needBase = true; this.needLive = true; this.schedule(); }
  requestLive() { this.needLive = true; this.schedule(); }
  schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.isOpen) return;
      if (this.needBase) { this.needBase = false; this.renderBase(); }
      if (this.needLive) { this.needLive = false; this.renderLive(); }
    });
  }

  capRes(p) { return Math.min(Math.sqrt(5.5e6 / (p.w * p.h)), 2048 / p.w); }

  buildCache(p, res) {
    let c = this.caches.get(p.id);
    if (!c) { c = { canvas: document.createElement('canvas') }; this.caches.set(p.id, c); }
    ink.renderPageToCanvas(c.canvas, p, res);
    c.res = c.canvas.width / p.w;
    c.ver = p._v || 0;
    c.w = p.w; c.h = p.h;
    this.evictCaches();
    return c;
  }

  touchCache(id) { const c = this.caches.get(id); if (c) { this.caches.delete(id); this.caches.set(id, c); } }

  evictCaches() {
    const vis = new Set(this.visible().map((L) => L.page.id));
    const max = Math.max(6, vis.size + 2);
    for (const [id, c] of this.caches) {
      if (this.caches.size <= max) break;
      if (vis.has(id)) continue;
      c.canvas.width = c.canvas.height = 0;
      this.caches.delete(id);
    }
  }

  cacheFresh(p) {
    const c = this.caches.get(p.id);
    return c && c.ver === (p._v || 0) && c.w === p.w && c.h === p.h ? c : null;
  }

  renderBase() {
    const ctx = this.bctx, d = this.dpr, { tx, ty, s } = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.deskColor;
    ctx.fillRect(0, 0, this.base.width, this.base.height);
    const want = s * d;
    for (const L of this.visible()) {
      const p = L.page;
      const x = tx + L.x * s, y = ty + L.y * s, w = p.w * s, h = p.h * s;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.045)';
      ctx.fillRect(x - 1.5, y + 1, w + 3, h + 4);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(x - 0.5, y, w + 1, h + 1.5);
      const special = this.skipPage === p || (this.editing && this.editing.L.page === p);
      let c = this.cacheFresh(p);
      if (!special && (this.moving || (c && c.res >= want * 0.98))) {
        if (!c) c = this.buildCache(p, Math.min(want, this.capRes(p)));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(c.canvas, Math.round(x * d), Math.round(y * d), Math.round(w * d), Math.round(h * d));
        this.touchCache(p.id);
        continue;
      }
      ctx.save();
      this.pageTransform(ctx, L, true);
      const vis = { x0: -x / s, y0: -y / s, x1: (this.W - x) / s, y1: (this.H - y) / s };
      ink.drawPaper(ctx, p, vis);
      ink.drawContent(ctx, p, { vis, skip: this.skipPage === p ? this.skip : null, editing: this.editing && this.editing.t.id });
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.moving) this.scheduleWarm();
    this.positionText();
    this.ui.viewChanged();
  }

  scheduleWarm() {
    clearTimeout(this.warmT);
    this.warmT = setTimeout(() => this.warmStep(), 280);
  }

  warmStep() {
    if (!this.isOpen || this.moving || this.mode) return;
    const want = this.view.s * this.dpr;
    for (const L of this.visible()) {
      const p = L.page;
      const target = Math.min(want, this.capRes(p));
      const c = this.cacheFresh(p);
      if (!c || c.res < target * 0.9 || c.res > target * 2.5) {
        this.buildCache(p, target);
        this.warmT = setTimeout(() => this.warmStep(), 50);
        return;
      }
    }
  }

  renderLive() {
    const ctx = this.lctx, d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.live.width, this.live.height);
    if (this.action && this.action.drawLive) {
      ctx.save();
      this.action.drawLive(ctx);
      ctx.restore();
    }
    this.drawSelectionBox(ctx);
    if (this.laser.length) this.drawLaser(ctx);
    if (this.hover) this.drawCursor(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    void d;
  }

  drawCursor(ctx) {
    const h = this.hover, d = this.dpr;
    const erasing = this.tool === 'eraser' || (this.action && this.action.constructor.name === 'EraseAction');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (erasing) {
      const es = this.toolState.eraser;
      const r = es.sizes[es.si];
      ctx.beginPath();
      ctx.arc(h.sx, h.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(128,128,128,0.12)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(90,90,90,0.7)';
      ctx.stroke();
    } else if (h.hover && (this.tool === 'pen' || this.tool === 'marker' || this.tool === 'shape')) {
      const ts = this.toolState;
      const t = this.tool === 'marker' ? ts.marker : ts.pen;
      const r = Math.max(1.5, (t.widths[t.wi] * this.view.s) / 2);
      ctx.beginPath();
      ctx.arc(h.sx, h.sy, r, 0, Math.PI * 2);
      ctx.globalAlpha = this.tool === 'marker' ? 0.5 : 0.8;
      ctx.fillStyle = t.colors[t.ci];
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawLaser(ctx) {
    const now = performance.now(), d = this.dpr, life = 900;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = this.laser;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (b.start) continue;
        const al = Math.max(0, 1 - (now - b.t) / life);
        if (al <= 0) continue;
        ctx.globalAlpha = pass ? al : al * 0.28;
        ctx.strokeStyle = pass ? '#ff5a4f' : '#ff3b30';
        ctx.lineWidth = pass ? 3.5 : 12;
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
    }
    const last = pts[pts.length - 1];
    if (last && this.action && this.action.constructor.name === 'LaserAction') {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath(); ctx.arc(last.sx, last.sy, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  animateLaser() {
    if (this.laserRaf) return;
    const step = () => {
      this.laserRaf = 0;
      const now = performance.now();
      while (this.laser.length && now - this.laser[0].t > 900) this.laser.shift();
      this.requestLive();
      if (this.laser.length) this.laserRaf = requestAnimationFrame(step);
    };
    this.laserRaf = requestAnimationFrame(step);
  }

  // ------------------------------------------------------------ Inhalt ändern
  bump(page) { page._v = (page._v || 0) + 1; }
  snap(page) { return { strokes: page.strokes, texts: page.texts, images: page.images }; }

  pushHistory(entry) {
    this.history.undo.push(entry);
    if (this.history.undo.length > 300) this.history.undo.shift();
    this.history.redo = [];
    this.ui.updateUndo();
  }

  contentChanged(page, render = true) {
    this.bump(page);
    this.markDirty(page);
    this.ui.pageChanged(page);
    if (render) this.requestRender();
  }

  pushContent(page, before) {
    this.pushHistory({ k: 'content', page, before, after: this.snap(page) });
    this.contentChanged(page, true);
    this.growEndless(page);
  }

  growEndless(page, bottom) {
    if (!page.endless) return false;
    if (bottom == null) {
      bottom = 0;
      for (const s of page.strokes) bottom = Math.max(bottom, ink.geom(s).bbox.y1);
      for (const t of page.texts) bottom = Math.max(bottom, t.y + ink.textHeight(t));
      for (const im of page.images) bottom = Math.max(bottom, im.y + im.h);
    }
    if (bottom > page.h - 260) {
      page.h = Math.ceil((bottom + 700) / 100) * 100;
      this.relayout();
      this.bump(page);
      this.markDirty(page);
      this.requestRender();
      this.ui.refreshSidebar();
      return true;
    }
    return false;
  }

  addStroke(page, stroke) {
    const before = this.snap(page);
    const prevV = page._v || 0;
    page.strokes = [...page.strokes, stroke];
    this.pushHistory({ k: 'content', page, before, after: this.snap(page) });
    this.bump(page);
    this.markDirty(page);
    this.ui.pageChanged(page);
    const grew = this.growEndless(page, ink.geom(stroke).bbox.y1);
    const hasTape = page.strokes.some((s) => s.t === 'tape' && !s.open && s !== stroke);
    if (grew || stroke.t === 'marker' || hasTape || this.needBase || this.moving || this.skipPage === page) {
      this.requestRender();
      return;
    }
    // schneller Weg: nur den neuen Strich ergänzen
    const L = this.layoutById.get(page.id);
    const ctx = this.bctx;
    ctx.save();
    this.pageTransform(ctx, L, true);
    ink.drawStroke(ctx, stroke);
    ctx.restore();
    const c = this.caches.get(page.id);
    if (c && c.ver === prevV && c.w === page.w && c.h === page.h) {
      const cx = c.canvas.getContext('2d');
      cx.setTransform(c.canvas.width / page.w, 0, 0, c.canvas.height / page.h, 0, 0);
      ink.drawStroke(cx, stroke);
      cx.setTransform(1, 0, 0, 1, 0, 0);
      c.ver = page._v;
    }
  }

  undo() {
    this.finishTextEdit();
    this.cancelAll();
    const e = this.history.undo.pop();
    if (!e) { toast('Nichts zum Rückgängigmachen'); return; }
    this.applyEntry(e, 'before');
    this.history.redo.push(e);
    this.ui.updateUndo();
    this.ui.flash('undo');
  }

  redo() {
    this.finishTextEdit();
    this.cancelAll();
    const e = this.history.redo.pop();
    if (!e) { toast('Nichts zum Wiederholen'); return; }
    this.applyEntry(e, 'after');
    this.history.undo.push(e);
    this.ui.updateUndo();
    this.ui.flash('redo');
  }

  applyEntry(e, which) {
    this.clearSelection();
    if (e.k === 'content') {
      const st = e[which];
      e.page.strokes = st.strokes;
      e.page.texts = st.texts;
      e.page.images = st.images;
      this.contentChanged(e.page, true);
    } else if (e.k === 'pages') {
      this.pages = e[which].slice();
      this.pagesChanged();
    } else if (e.k === 'props') {
      for (const it of e.items) { Object.assign(it.page, it[which]); this.contentChanged(it.page, false); }
      this.relayout();
      this.clampView();
      this.requestRender();
      this.ui.refreshSidebar();
    }
  }

  // ------------------------------------------------------------ Seiten
  pagesChanged() {
    this.relayout();
    this.clampView();
    this.nbDirty = true;
    this.changed = true;
    this.scheduleSave();
    this.ui.setSaveState('dirty');
    this.ui.refreshSidebar();
    this.requestRender();
  }

  setPages(next) {
    const before = this.pages.slice();
    this.pages = next;
    this.pushHistory({ k: 'pages', before, after: next.slice() });
    this.pagesChanged();
  }

  addPage(afterIdx = this.currentIndex(), opts = {}) {
    const ref = this.pages[afterIdx] || this.pages[this.pages.length - 1];
    const d = this.nb.defaults || {};
    let format = 'portrait';
    if (ref) format = ref.endless ? 'endless' : ref.w > ref.h ? 'landscape' : 'portrait';
    const template = opts.template || (ref && !ref.bg ? ref.template : d.template || 'lined');
    const paper = opts.paper || (ref ? ref.paper : d.paper || 'white');
    const p = store.newPage(this.nb.id, { template, paper, format: opts.format || format });
    p._v = 0;
    const next = this.pages.slice();
    next.splice(afterIdx + 1, 0, p);
    this.setPages(next);
    this.goToPage(afterIdx + 1);
    return p;
  }

  duplicatePage(i) {
    const src = this.pages[i];
    const copy = { ...src, id: uid(), bm: false, _v: 0 };
    const next = this.pages.slice();
    next.splice(i + 1, 0, copy);
    this.setPages(next);
    this.goToPage(i + 1);
  }

  deletePage(i) {
    if (this.pages.length <= 1) {
      // letzte Seite: nur leeren
      const p = this.pages[0];
      const before = this.snap(p);
      p.strokes = []; p.texts = []; p.images = [];
      this.pushContent(p, before);
      toast('Seite geleert', { action: { label: 'Rückgängig', run: () => this.undo() } });
      return;
    }
    const next = this.pages.slice();
    next.splice(i, 1);
    this.setPages(next);
    toast('Seite gelöscht', { action: { label: 'Rückgängig', run: () => this.undo() } });
  }

  movePage(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= this.pages.length) return;
    const next = this.pages.slice();
    [next[i], next[j]] = [next[j], next[i]];
    this.setPages(next);
    this.goToPage(j);
  }

  setPageProps(page, props) { this.setPagesProps([page], props); }

  setPagesProps(pages, props) {
    const items = pages.map((page) => {
      const before = {};
      for (const k of Object.keys(props)) before[k] = page[k];
      Object.assign(page, props);
      return { page, before, after: { ...props } };
    });
    this.pushHistory({ k: 'props', items });
    this.relayout();
    this.clampView();
    for (const it of items) this.contentChanged(it.page, false);
    this.requestRender();
    this.ui.refreshSidebar();
  }

  toggleBookmark(page) {
    page.bm = !page.bm;
    this.markDirty(page);
    this.ui.refreshSidebar();
    this.ui.updatePageIndicator();
    toast(page.bm ? 'Lesezeichen gesetzt' : 'Lesezeichen entfernt');
  }

  async insertPages(pageObjs, afterIdx = this.currentIndex()) {
    const objs = pageObjs.map((o) => ({ ...store.newPage(this.nb.id, { template: 'blank' }), ...o, _v: 0 }));
    const next = this.pages.slice();
    next.splice(afterIdx + 1, 0, ...objs);
    this.setPages(next);
    this.goToPage(afterIdx + 1);
  }

  // ------------------------------------------------------------ Auswahl
  selBBox(page, ids) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
    for (const s of page.strokes) if (ids.has(s.id)) { const b = ink.geom(s).bbox; add(b.x0, b.y0, b.x1, b.y1); }
    for (const t of page.texts) if (ids.has(t.id)) add(t.x, t.y, t.x + t.w, t.y + ink.textHeight(t));
    for (const im of page.images) if (ids.has(im.id)) add(im.x, im.y, im.x + im.w, im.y + im.h);
    if (x0 === Infinity) return null;
    const pad = 4;
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }

  setSelection(L, ids) {
    const bbox = this.selBBox(L.page, ids);
    if (!bbox) { this.clearSelection(); return; }
    this.selection = { L, ids, bbox };
    this.ui.selectionChanged();
    this.requestLive();
  }

  clearSelection() {
    if (!this.selection) return;
    this.selection = null;
    this.ui.selectionChanged();
    this.requestLive();
  }

  selScreenRect() {
    const sel = this.selection;
    if (!sel) return null;
    let b = sel.bbox;
    const a = this.action;
    if (a && a.sel === sel) {
      b = { x0: b.x0 + a.dx, y0: b.y0 + a.dy, x1: b.x0 + (b.x1 - b.x0) * a.k + a.dx, y1: b.y0 + (b.y1 - b.y0) * a.k + a.dy };
    }
    const p0 = this.toScreen(sel.L, b.x0, b.y0), p1 = this.toScreen(sel.L, b.x1, b.y1);
    return { x0: p0.sx, y0: p0.sy, x1: p1.sx, y1: p1.sy };
  }

  selHit(sx, sy) {
    const r = this.selScreenRect();
    if (!r) return null;
    if (Math.hypot(sx - r.x1, sy - r.y1) < 26) return 'scale';
    if (sx >= r.x0 - 10 && sx <= r.x1 + 10 && sy >= r.y0 - 10 && sy <= r.y1 + 10) return 'move';
    return null;
  }

  drawSelectionBox(ctx) {
    const r = this.selScreenRect();
    if (!r) return;
    const d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0d8f80';
    ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(r.x1, r.y1, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  setSkip(page, ids) {
    this.skipPage = page || null;
    this.skip = page ? ids : null;
    this.requestRender();
  }

  transformSelection(dx, dy, k) {
    const sel = this.selection;
    const page = sel.L.page, ids = sel.ids, b = sel.bbox;
    const before = this.snap(page);
    const fx = (x) => round2(b.x0 + (x - b.x0) * k + dx);
    const fy = (y) => round2(b.y0 + (y - b.y0) * k + dy);
    page.strokes = page.strokes.map((s) => {
      if (!ids.has(s.id)) return s;
      const pts = s.pts.slice();
      for (let i = 0; i < pts.length; i += 3) { pts[i] = fx(pts[i]); pts[i + 1] = fy(pts[i + 1]); }
      return { ...s, pts, w: round2(s.w * k) };
    });
    page.texts = page.texts.map((t) => (ids.has(t.id) ? { ...t, x: fx(t.x), y: fy(t.y), w: round2(t.w * k), size: round2(t.size * k) } : t));
    page.images = page.images.map((im) => (ids.has(im.id) ? { ...im, x: fx(im.x), y: fy(im.y), w: round2(im.w * k), h: round2(im.h * k) } : im));
    this.pushContent(page, before);
    sel.bbox = this.selBBox(page, ids);
    this.ui.selectionChanged();
  }

  selectedItems() {
    const sel = this.selection;
    if (!sel) return null;
    const p = sel.L.page;
    return {
      strokes: p.strokes.filter((s) => sel.ids.has(s.id)),
      texts: p.texts.filter((t) => sel.ids.has(t.id)),
      images: p.images.filter((i) => sel.ids.has(i.id)),
    };
  }

  deleteSelection() {
    const sel = this.selection;
    if (!sel) return;
    const page = sel.L.page, ids = sel.ids;
    const before = this.snap(page);
    page.strokes = page.strokes.filter((s) => !ids.has(s.id));
    page.texts = page.texts.filter((t) => !ids.has(t.id));
    page.images = page.images.filter((i) => !ids.has(i.id));
    this.clearSelection();
    this.pushContent(page, before);
  }

  copySelection() {
    const it = this.selectedItems();
    if (!it) return;
    this.clipboard = JSON.parse(JSON.stringify(it));
    this.clipboard.from = this.selection.L.page.id;
    this.clipboardPasteCount = 0;
    this.ui.refreshTool();
    toast('Kopiert');
  }

  cutSelection() { this.copySelection(); this.deleteSelection(); }

  insertItems(L, items, offset) {
    const page = L.page;
    const before = this.snap(page);
    const ids = new Set();
    const mv = (v) => round2(v + offset);
    const strokes = items.strokes.map((s) => {
      const pts = s.pts.slice();
      for (let i = 0; i < pts.length; i += 3) { pts[i] = mv(pts[i]); pts[i + 1] = mv(pts[i + 1]); }
      const n = { ...s, id: uid(), pts };
      ids.add(n.id);
      return n;
    });
    const texts = items.texts.map((t) => { const n = { ...t, id: uid(), x: mv(t.x), y: mv(t.y) }; ids.add(n.id); return n; });
    const images = items.images.map((im) => { const n = { ...im, id: uid(), x: mv(im.x), y: mv(im.y) }; ids.add(n.id); return n; });
    page.strokes = [...page.strokes, ...strokes];
    page.texts = [...page.texts, ...texts];
    page.images = [...page.images, ...images];
    this.pushContent(page, before);
    if (this.tool !== 'lasso') { this.tool = 'lasso'; this.ui.refreshTool(); }
    this.setSelection(L, ids);
  }

  duplicateSelection() {
    const it = this.selectedItems();
    if (!it) return;
    this.insertItems(this.selection.L, JSON.parse(JSON.stringify(it)), 24);
  }

  paste() {
    if (!this.clipboard) return;
    const L = this.currentLayout();
    this.clipboardPasteCount = (this.clipboardPasteCount || 0) + 1;
    const off = L.page.id === this.clipboard.from ? 24 * this.clipboardPasteCount : 0;
    this.insertItems(L, JSON.parse(JSON.stringify(this.clipboard)), off);
  }

  recolorSelection(color) {
    const sel = this.selection;
    if (!sel) return;
    const page = sel.L.page, ids = sel.ids;
    const before = this.snap(page);
    page.strokes = page.strokes.map((s) => (ids.has(s.id) && s.t !== 'rainbow' ? { ...s, c: color } : s));
    page.texts = page.texts.map((t) => (ids.has(t.id) ? { ...t, c: color === '#1d1d1f' ? null : color } : t));
    this.pushContent(page, before);
  }

  // ------------------------------------------------------------ Tippen auf Inhalte
  tapContent(L, x, y) {
    const page = L.page;
    for (let i = page.strokes.length - 1; i >= 0; i--) {
      const s = page.strokes[i];
      if (s.t === 'tape' && ink.strokeHit(s, x, y, 2)) {
        const before = this.snap(page);
        page.strokes = page.strokes.map((o) => (o === s ? { ...s, open: !s.open } : o));
        this.pushContent(page, before);
        return true;
      }
    }
    const t = ink.textAt(page, x, y);
    if (t && this.toggleCheckbox(L, t, x, y)) return true;
    return false;
  }

  toggleCheckbox(L, t, x, y) {
    const cb = ink.checkboxAt(t, x, y);
    if (!cb) return false;
    const page = L.page;
    const lines = t.text.split('\n');
    lines[cb.src] = lines[cb.src].replace(/\[([ xX])\]/, (m, c) => (c === ' ' ? '[x]' : '[ ]'));
    const before = this.snap(page);
    page.texts = page.texts.map((o) => (o === t ? { ...t, text: lines.join('\n') } : o));
    this.pushContent(page, before);
    return true;
  }

  setAllTapes(page, open) {
    const before = this.snap(page);
    let n = 0;
    page.strokes = page.strokes.map((s) => { if (s.t === 'tape' && !!s.open !== open) { n++; return { ...s, open }; } return s; });
    if (n) this.pushContent(page, before);
    return n;
  }

  onTap(sx, sy) {
    if (this.tool === 'text') { this.textTap(sx, sy); return; }
    if (this.selection && !this.selHit(sx, sy)) this.clearSelection();
    const hit = this.hitPage(sx, sy);
    if (hit) this.tapContent(hit.L, hit.x, hit.y);
  }

  // ------------------------------------------------------------ Text bearbeiten
  textColor() {
    const pen = this.toolState.pen;
    const c = pen.colors[pen.ci];
    return c === '#1d1d1f' ? null : c;
  }

  textTap(sx, sy) {
    const hit = this.hitPage(sx, sy);
    if (!hit) return;
    const { L, x, y } = hit;
    const page = L.page;
    const t = ink.textAt(page, x, y);
    if (t) {
      if (this.toggleCheckbox(L, t, x, y)) return;
      this.startTextEdit(L, t, false);
      return;
    }
    if (this.suppressTextTap) { this.suppressTextTap = false; return; }
    const size = this.toolState.text.size;
    let w = Math.min(640, page.w - x - 30);
    let x0 = x;
    if (w < 240) { w = 240; x0 = Math.max(20, page.w - 30 - w); }
    const nt = { id: uid(), x: round2(x0), y: round2(y - size * 0.75), w: round2(w), size, c: this.textColor(), text: '' };
    this.startTextEdit(L, nt, true);
  }

  bindText() {
    const ta = this.ta;
    ta.addEventListener('input', () => {
      if (!this.editing) return;
      this.editing.t = { ...this.editing.t, text: ta.value };
      this.positionText();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.finishTextEdit(); }
      if (e.key === 'Enter' && !e.shiftKey && this.editing) {
        // Listen automatisch fortsetzen
        const pos = ta.selectionStart;
        const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
        const line = ta.value.slice(lineStart, pos);
        const m = line.match(/^(\s*)([-*•]\s+\[[ xX]\]\s|[-*•]\s+|(\d+)[.)]\s+)/);
        if (m) {
          e.preventDefault();
          if (line.trim() === m[0].trim()) {
            // leerer Listenpunkt beendet die Liste
            ta.setRangeText('', lineStart, pos, 'end');
          } else {
            let prefix = m[1] + m[2];
            if (m[3]) prefix = m[1] + (parseInt(m[3], 10) + 1) + '. ';
            if (/\[[xX]\]/.test(prefix)) prefix = prefix.replace(/\[[xX]\]/, '[ ]');
            ta.setRangeText('\n' + prefix, pos, ta.selectionEnd, 'end');
          }
          ta.dispatchEvent(new Event('input'));
        }
      }
    });
    ta.addEventListener('blur', () => {
      // Kurz warten: Klick auf Formatierungsknöpfe soll den Text nicht schließen
      setTimeout(() => { if (this.editing && document.activeElement !== ta && !this.ui.textBarActive) this.finishTextEdit(); }, 150);
    });
  }

  startTextEdit(L, t, isNew) {
    this.finishTextEdit();
    if (this.tool !== 'text') { this.tool = 'text'; }
    this.editing = { L, t, orig: t, isNew, before: this.snap(L.page) };
    const ta = this.ta;
    ta.value = t.text;
    ta.hidden = false;
    this.positionText();
    this.requestRender();
    this.ui.refreshTool();
    ta.focus({ preventScroll: true });
    if (!isNew) ta.setSelectionRange(ta.value.length, ta.value.length);
    setTimeout(() => this.ensureTextVisible(), 350);
  }

  positionText() {
    const ed = this.editing;
    if (!ed) return;
    const { L, t } = ed;
    const s = this.view.s;
    const p = this.toScreen(L, t.x, t.y);
    const st = this.ta.style;
    st.left = p.sx + 'px';
    st.top = p.sy + 'px';
    st.width = Math.max(60, t.w * s) + 'px';
    st.fontSize = t.size * s + 'px';
    st.lineHeight = t.size * s * 1.38 + 'px';
    st.color = t.c || (L.page.paper === 'dark' ? '#f2f2f2' : '#1d1d1f');
    st.height = 'auto';
    st.height = Math.max(t.size * s * 1.38, this.ta.scrollHeight) + 'px';
  }

  ensureTextVisible() {
    if (!this.editing) return;
    const vv = window.visualViewport;
    const visibleH = vv ? vv.height - this.rect.top : this.H;
    const r = this.ta.getBoundingClientRect();
    const bottom = r.top - this.rect.top + Math.min(r.height, 160);
    if (bottom > visibleH - 30) {
      this.view.ty -= bottom - (visibleH - 30) + 20;
      this.clampView();
      this.requestRender();
    }
  }

  applyTextProps(props) {
    if (!this.editing) return;
    this.editing.t = { ...this.editing.t, ...props };
    this.positionText();
    this.ta.focus({ preventScroll: true });
  }

  wrapText(before, after = before) {
    const ta = this.ta;
    const a = ta.selectionStart, b = ta.selectionEnd;
    const sel = ta.value.slice(a, b) || 'Text';
    ta.setRangeText(before + sel + after, a, b, 'select');
    ta.dispatchEvent(new Event('input'));
    ta.focus({ preventScroll: true });
  }

  prefixLine(prefix) {
    const ta = this.ta;
    const pos = ta.selectionStart;
    const ls = ta.value.lastIndexOf('\n', pos - 1) + 1;
    const le = ta.value.indexOf('\n', pos);
    const line = ta.value.slice(ls, le < 0 ? undefined : le);
    const stripped = line.replace(/^(#{1,3}\s+|\s*[-*•]\s+\[[ xX]\]\s?|\s*[-*•]\s+|\s*\d+[.)]\s+)/, '');
    const has = line.startsWith(prefix);
    ta.setRangeText((has ? '' : prefix) + stripped, ls, le < 0 ? ta.value.length : le, 'end');
    ta.dispatchEvent(new Event('input'));
    ta.focus({ preventScroll: true });
  }

  finishTextEdit() {
    const ed = this.editing;
    if (!ed) return;
    this.editing = null;
    const ta = this.ta;
    ta.hidden = true;
    ta.blur();
    const page = ed.L.page;
    const text = ta.value.replace(/\s+$/, '');
    const t = { ...ed.t, text };
    let changed = false;
    if (!text.trim()) {
      if (!ed.isNew) { page.texts = page.texts.filter((o) => o.id !== t.id); changed = true; }
    } else if (ed.isNew) {
      page.texts = [...page.texts, t]; changed = true;
    } else if (text !== ed.orig.text || t.size !== ed.orig.size || t.c !== ed.orig.c || t.w !== ed.orig.w) {
      page.texts = page.texts.map((o) => (o.id === t.id ? t : o)); changed = true;
    }
    if (changed) this.pushContent(page, ed.before);
    else this.requestRender();
    this.ui.refreshTool();
  }

  // ------------------------------------------------------------ Bilder
  async insertImageFile(file) {
    const { blob, w, h } = await prepareImage(file);
    const id = await store.putBlob(blob);
    const L = this.currentLayout();
    const page = L.page;
    let iw = Math.min(520, page.w * 0.6, w);
    let ih = (iw * h) / w;
    if (ih > page.h * 0.6) { ih = page.h * 0.6; iw = (ih * w) / h; }
    const c = this.toPage(L, this.W / 2, this.H / 2);
    const x = clamp(c.x - iw / 2, 10, page.w - iw - 10);
    const y = clamp(c.y - ih / 2, 10, Math.max(10, page.h - ih - 10));
    const im = { id: uid(), blob: id, x: round2(x), y: round2(y), w: round2(iw), h: round2(ih) };
    const before = this.snap(page);
    page.images = [...page.images, im];
    this.pushContent(page, before);
    this.tool = 'lasso';
    this.ui.refreshTool();
    this.setSelection(L, new Set([im.id]));
    toast('Bild eingefügt – ziehen zum Verschieben, Ecke ziehen zum Skalieren');
  }

  // ------------------------------------------------------------ Eingabe
  bindInput() {
    const c = this.live;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e, false));
    c.addEventListener('pointercancel', (e) => this.onUp(e, true));
    c.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !this.pointers.has(e.pointerId)) { this.hover = null; this.requestLive(); } });
    const stop = (e) => e.preventDefault();
    c.addEventListener('touchstart', stop, { passive: false });
    c.addEventListener('touchmove', stop, { passive: false });
    c.addEventListener('contextmenu', stop);
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.stage.addEventListener('gesturestart', stop);
    this.stage.addEventListener('gesturechange', stop);
  }

  evPt(e) {
    return {
      id: e.pointerId,
      sx: e.clientX - this.rect.left,
      sy: e.clientY - this.rect.top,
      p: e.pointerType === 'pen' ? (e.pressure > 0 ? e.pressure : 0.3) : 0.5,
      type: e.pointerType || 'mouse',
      t: e.timeStamp,
    };
  }

  touchList() { return [...this.pointers.values()].filter((p) => p.type === 'touch'); }

  onDown(e) {
    e.preventDefault();
    // Tippen neben ein offenes Textfeld beendet nur die Bearbeitung
    this.suppressTextTap = !!this.editing;
    if (this.editing) this.finishTextEdit();
    closePopover();
    const pt = this.evPt(e);
    if (pt.type === 'touch') {
      if (this.penDown || pt.t - this.lastPenT < 350) { this.ignored.add(e.pointerId); return; }
      if (e.width && Math.max(e.width, e.height) > 120) { this.ignored.add(e.pointerId); return; }
    }
    try { this.live.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    this.pointers.set(e.pointerId, { ...pt, x0: pt.sx, y0: pt.sy, t0: pt.t });
    this.stopInertia();

    if (pt.type !== 'touch') {
      if (pt.type === 'pen') { this.penDown = true; this.notePencil(); }
      this.hover = pt;
      if (pt.type === 'mouse' && (e.button === 1 || e.button === 2 || this.spaceDown)) { this.beginPan(pt); return; }
      if (this.mode === 'tool' && this.toolByFinger) this.cancelTool();
      if (this.mode === 'pan' || this.mode === 'pinch') {
        // Handballen hat kurz vorher gescrollt → zurücksetzen
        if (this.gestureStartView && pt.t - this.gestureStartT < 600) { Object.assign(this.view, this.gestureStartView); this.requestRender(); }
        this.mode = null;
        for (const p of this.touchList()) { this.pointers.delete(p.id); this.ignored.add(p.id); }
      }
      if (this.mode === 'ruler') this.mode = null;
      this.beginTool(pt, e);
      return;
    }

    const touches = this.touchList();
    if (touches.length === 1) {
      this.tap = { t0: pt.t, max: 1, moved: false, x: pt.sx, y: pt.sy, pan: false };
      if (this.ruler.visible && this.ruler.hit(pt.sx, pt.sy)) { this.mode = 'ruler'; this.ruler.begin(touches); return; }
      if (this.selection && this.selHit(pt.sx, pt.sy)) { this.beginTool(pt, e); return; }
      if (this.fingerDraws() && FINGER_TOOLS.has(this.tool)) { this.beginTool(pt, e); return; }
      this.tap.pan = true;
      this.beginPan(pt);
      return;
    }
    if (this.tap) this.tap.max = Math.max(this.tap.max, touches.length);
    if (this.mode === 'tool' && this.toolByFinger) {
      if (pt.t - this.actionT0 < 300 || (this.action && this.action.small())) this.cancelTool();
      else this.endTool(this.pointers.get(this.toolPointer));
    }
    if (this.mode === 'ruler') { this.ruler.begin(touches); return; }
    this.beginPinch(touches);
  }

  onMove(e) {
    if (this.ignored.has(e.pointerId)) return;
    const p = this.pointers.get(e.pointerId);
    const pt = this.evPt(e);
    if (!p) {
      if (pt.type === 'pen' || pt.type === 'mouse') {
        this.hover = { ...pt, hover: true };
        this.requestLive();
      }
      return;
    }
    if (this.mode === 'tool' && e.pointerId === this.toolPointer && this.action) {
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      const pts = list && list.length ? list.map((ev) => this.evPt(ev)) : [pt];
      this.action.move(pts);
      this.hover = pt;
      this.requestLive();
    }
    p.sx = pt.sx; p.sy = pt.sy; p.t = pt.t;
    if (this.tap && Math.hypot(pt.sx - p.x0, pt.sy - p.y0) > 10) this.tap.moved = true;
    if (this.mode === 'pan' && e.pointerId === this.panPointer) this.panMove(pt);
    else if (this.mode === 'pinch') this.pinchMove();
    else if (this.mode === 'ruler') this.ruler.move(this.touchList());
  }

  onUp(e, cancelled) {
    if (this.ignored.delete(e.pointerId)) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const pt = this.evPt(e);
    this.pointers.delete(e.pointerId);
    if (pt.type === 'pen') { this.penDown = false; this.lastPenT = pt.t; }
    this.hover = null;

    if (this.mode === 'tool' && e.pointerId === this.toolPointer) {
      if (cancelled) this.cancelTool(); else this.endTool(pt);
    } else if (this.mode === 'pan' && e.pointerId === this.panPointer) {
      const rest = this.touchList();
      if (rest.length) this.beginPan(rest[0]); else this.endPan();
    } else if (this.mode === 'pinch') {
      const rest = this.touchList();
      if (rest.length >= 2) this.beginPinch(rest);
      else if (rest.length === 1) this.beginPan(rest[0]);
      else { this.mode = null; this.ui.updateZoomIndicator(); }
    } else if (this.mode === 'ruler') {
      const rest = this.touchList();
      if (rest.length) this.ruler.begin(rest); else this.mode = null;
    }

    if (pt.type === 'touch' && this.tap && this.touchList().length === 0) {
      const tp = this.tap;
      this.tap = null;
      if (!tp.moved && !cancelled && pt.t - tp.t0 < 380) {
        const st = getSettings();
        if (tp.max === 2 && st.tapUndo) this.undo();
        else if (tp.max === 3 && st.tapUndo) this.redo();
        else if (tp.max === 1 && tp.pan) this.onTap(tp.x, tp.y);
      }
    }
    this.requestLive();
  }

  beginTool(pt, e) {
    let name = this.tool;
    if (e && (e.buttons & 32 || e.button === 5)) name = 'eraser'; // Radierer-Taste mancher Stifte
    this.action = createAction(this, name, pt);
    if (!this.action) { this.mode = null; return; }
    this.mode = 'tool';
    this.toolPointer = pt.id;
    this.actionT0 = pt.t;
    this.toolByFinger = pt.type === 'touch';
    this.requestLive();
  }

  endTool(pt) {
    const a = this.action;
    this.action = null;
    this.mode = null;
    if (a) a.end(pt || {});
    this.requestLive();
  }

  cancelTool() {
    const a = this.action;
    this.action = null;
    this.mode = null;
    if (a) a.cancel();
    this.requestLive();
  }

  cancelAll() {
    if (this.mode === 'tool') this.cancelTool();
    this.mode = null;
    this.pointers.clear();
    this.ignored.clear();
    this.tap = null;
  }

  beginPan(pt) {
    this.mode = 'pan';
    this.panPointer = pt.id;
    this.panLast = { x: pt.sx, y: pt.sy };
    this.panActive = false;
    this.panOrigin = { x: pt.sx, y: pt.sy };
    this.gestureStartView = { ...this.view };
    this.gestureStartT = pt.t;
    this.vel = [];
  }

  panMove(pt) {
    if (!this.panActive) {
      if (Math.hypot(pt.sx - this.panOrigin.x, pt.sy - this.panOrigin.y) < 6) return;
      this.panActive = true;
      this.panLast = { x: pt.sx, y: pt.sy };
      return;
    }
    const dx = pt.sx - this.panLast.x, dy = pt.sy - this.panLast.y;
    this.panLast = { x: pt.sx, y: pt.sy };
    this.view.tx += dx;
    this.view.ty += dy;
    this.clampView();
    const now = performance.now();
    this.vel.push({ t: now, dx, dy });
    while (this.vel.length && now - this.vel[0].t > 90) this.vel.shift();
    this.setMoving();
    this.requestRender();
  }

  endPan() {
    this.mode = null;
    if (!this.panActive || !this.vel.length) return;
    const now = performance.now();
    const v = this.vel.filter((o) => now - o.t < 90);
    if (!v.length) return;
    const dt = Math.max(16, now - v[0].t);
    let vx = v.reduce((a, o) => a + o.dx, 0) / dt;
    let vy = v.reduce((a, o) => a + o.dy, 0) / dt;
    if (Math.hypot(vx, vy) < 0.25) return;
    let last = now;
    const step = (t) => {
      const dtt = Math.min(40, t - last);
      last = t;
      const f = Math.pow(0.9955, dtt);
      vx *= f; vy *= f;
      const ox = this.view.tx, oy = this.view.ty;
      this.view.tx += vx * dtt;
      this.view.ty += vy * dtt;
      this.clampView();
      if (this.view.tx === ox) vx = 0;
      if (this.view.ty === oy) vy = 0;
      this.setMoving();
      this.requestRender();
      if (Math.hypot(vx, vy) > 0.02) this.inertia = requestAnimationFrame(step);
      else this.inertia = 0;
    };
    this.inertia = requestAnimationFrame(step);
  }

  stopInertia() { if (this.inertia) { cancelAnimationFrame(this.inertia); this.inertia = 0; } }

  beginPinch(touches) {
    const [a, b] = touches;
    if (this.mode !== 'pan' && this.mode !== 'pinch') { this.gestureStartView = { ...this.view }; this.gestureStartT = a.t; }
    this.mode = 'pinch';
    this.pinch = {
      ids: [a.id, b.id],
      d0: Math.max(10, Math.hypot(b.sx - a.sx, b.sy - a.sy)),
      cx: (a.sx + b.sx) / 2, cy: (a.sy + b.sy) / 2,
      v0: { ...this.view },
    };
  }

  pinchMove() {
    const P = this.pinch;
    const a = this.pointers.get(P.ids[0]), b = this.pointers.get(P.ids[1]);
    if (!a || !b) return;
    const d = Math.max(10, Math.hypot(b.sx - a.sx, b.sy - a.sy));
    const cx = (a.sx + b.sx) / 2, cy = (a.sy + b.sy) / 2;
    const v0 = P.v0;
    let s = clamp(v0.s * (d / P.d0), this.minScale(), MAX_S);
    // Einrasten auf „Seitenbreite“
    const fs = this.fitScale();
    if (Math.abs(s / fs - 1) < 0.04) s = fs;
    const wx = (P.cx - v0.tx) / v0.s, wy = (P.cy - v0.ty) / v0.s;
    this.view.s = s;
    this.view.tx = cx - wx * s;
    this.view.ty = cy - wy * s;
    this.clampView();
    this.setMoving();
    this.requestRender();
    this.ui.updateZoomIndicator(true);
  }

  onWheel(e) {
    e.preventDefault();
    const sx = e.clientX - this.rect.left, sy = e.clientY - this.rect.top;
    if (e.ctrlKey || e.metaKey) {
      this.zoomAt(sx, sy, Math.exp(-e.deltaY * 0.01));
      this.ui.updateZoomIndicator(true);
    } else {
      const k = e.deltaMode === 1 ? 30 : 1;
      this.view.tx -= e.deltaX * k;
      this.view.ty -= e.deltaY * k;
      this.clampView();
      this.setMoving();
      this.requestRender();
    }
  }

  onKey(e) {
    if (!this.isOpen) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.querySelector('.dlg-back')) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); this.redo(); return; }
    if (mod && k === 'c') { e.preventDefault(); this.copySelection(); return; }
    if (mod && k === 'x') { e.preventDefault(); this.cutSelection(); return; }
    if (mod && k === 'v') { e.preventDefault(); this.paste(); return; }
    if (mod && k === 'd') { e.preventDefault(); this.duplicateSelection(); return; }
    if (mod) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selection) { e.preventDefault(); this.deleteSelection(); return; }
    if (e.code === 'Space') { this.spaceDown = true; e.preventDefault(); return; }
    const map = { p: 'pen', h: 'marker', e: 'eraser', l: 'lasso', s: 'shape', t: 'text', b: 'tape', z: 'laser' };
    if (map[k]) { this.setTool(map[k]); return; }
    if (k === 'r') { this.ruler.toggle(); return; }
    if (k === '+' || k === '=') this.zoomAt(this.W / 2, this.H / 2, 1.2);
    if (k === '-') this.zoomAt(this.W / 2, this.H / 2, 1 / 1.2);
    if (k === '0') { this.fit(); this.ui.updateZoomIndicator(); }
    if (e.key === 'PageDown') this.goToPage(this.currentIndex() + 1);
    if (e.key === 'PageUp') this.goToPage(this.currentIndex() - 1);
  }
}

async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let w = img.naturalWidth, h = img.naturalHeight;
    const max = 2400;
    const k = Math.min(1, max / Math.max(w, h));
    const png = file.type === 'image/png';
    if (k === 1 && (png || file.type === 'image/jpeg')) return { blob: file, w, h };
    w = Math.round(w * k); h = Math.round(h * k);
    const c = el('canvas', { width: w, height: h });
    const ctx = c.getContext('2d');
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.88));
    return { blob, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
