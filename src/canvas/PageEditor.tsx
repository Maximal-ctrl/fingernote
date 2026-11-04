import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { PAGE_MIN_H, PAGE_W, type Block, type Notebook, type Page, type Paper, type Stroke } from '../db/db';
import { addAsset, loadPageContent, savePageContent, stashPending, trashPage, updateNotebook, updatePage, type ContentChange } from '../db/repo';
import { settings } from '../lib/store';
import { uid } from '../lib/ids';
import { htmlToText, dateFmt, timeFmt } from '../lib/text';
import { PEN_COLORS } from '../lib/palette';
import { toast } from '../ui/ui';
import { Toolbar } from './Toolbar';
import { ImageBlockView, PdfBlockView, TextBlockView } from './blocks';
import { InkRenderer, renderFullPage, type Active, type View } from './renderer';
import { hitsStroke, strokeBox, strokeInLasso, translateStroke, unionBox, type Box, type Pt } from './ink';
import { paperClass } from './paper';
import { ensureParagraphSeparator } from './textCommands';
import { importPdf, PdfImportError } from '../lib/importPdf';
import { navigate, pagePath } from '../lib/router';

interface Doc { blocks: Block[]; strokes: Stroke[] }
interface Sel { strokes: Set<string>; blocks: Set<string> }

const MARGIN = 24;
const r1 = (n: number) => Math.round(n * 10) / 10;
let lastZoom = 0; // Zoom bleibt beim Seitenwechsel erhalten
let clip: Doc | null = null; // interne Zwischenablage für Lasso-Auswahl

/** Alle offenen Editoren speichern sofort (z. B. bevor die Tag-Übersicht direkt in die DB schreibt). */
export const flushers = new Set<() => Promise<void>>();
export const flushAll = () => Promise.all([...flushers].map((f) => f()));

const isEditing = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
};

export function PageEditor({ page, notebook, q }: { page: Page; notebook: Notebook; q?: string }) {
  const tool = settings.use((s) => s.tool);
  const penOnly = settings.use((s) => s.penOnly);

  /* ---------- Dokument, Verlauf, Speichern ---------- */

  const [doc, setDocState] = useState<Doc | null>(null);
  const docRef = useRef<Doc | null>(null);
  const hist = useRef({ past: [] as Doc[], future: [] as Doc[] });
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const saved = useRef({ blocks: new Map<string, Block>(), strokes: new Map<string, Stroke>() });
  const saveTimer = useRef<number | undefined>(undefined);

  const inflight = useRef<ContentChange[]>([]);

  /** Nimmt alle ungespeicherten Änderungen als Diff und markiert sie als gespeichert. */
  const takeChange = useCallback((): ContentChange | null => {
    const d = docRef.current;
    if (!d) return null;
    const s = saved.current;
    const putBlocks = d.blocks.filter((b) => s.blocks.get(b.id) !== b);
    const putStrokes = d.strokes.filter((x) => s.strokes.get(x.id) !== x);
    const liveB = new Set(d.blocks.map((b) => b.id));
    const liveS = new Set(d.strokes.map((x) => x.id));
    const delBlocks = [...s.blocks.keys()].filter((id) => !liveB.has(id));
    const delStrokes = [...s.strokes.keys()].filter((id) => !liveS.has(id));
    if (!putBlocks.length && !putStrokes.length && !delBlocks.length && !delStrokes.length) return null;
    saved.current = { blocks: new Map(d.blocks.map((b) => [b.id, b])), strokes: new Map(d.strokes.map((x) => [x.id, x])) };
    return { putBlocks, delBlocks, putStrokes, delStrokes };
  }, []);

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    const change = takeChange();
    if (!change) return;
    inflight.current.push(change);
    try {
      await savePageContent(page.id, change);
    } catch (e) {
      console.error(e);
      toast('Speichern fehlgeschlagen. Ist der Speicher voll?', 'error');
      return;
    }
    inflight.current = inflight.current.filter((c) => c !== change);
    if (!inflight.current.length) stashPending(page.id, []);
  }, [page.id, takeChange]);

  /** Tab wird geschlossen/neu geladen: alles Offene synchron sichern, beim nächsten Start nachholen. */
  const stash = useCallback(() => {
    const change = takeChange();
    if (change) inflight.current.push(change);
    stashPending(page.id, inflight.current);
    if (change) void savePageContent(page.id, change);
  }, [page.id, takeChange]);

  const setDoc = useCallback((d: Doc) => {
    docRef.current = d;
    setDocState(d);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), 250);
  }, [flush]);

  const commit = useCallback((next: Doc, prev: Doc = docRef.current!) => {
    const h = hist.current;
    h.past.push(prev);
    if (h.past.length > 150) h.past.shift();
    h.future = [];
    setDoc(next);
    bump();
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), 60);
  }, [setDoc, flush]);

  const [sel, setSel] = useState<Sel | null>(null);

  const undo = useCallback(() => {
    const h = hist.current;
    const prev = h.past.pop();
    if (!prev || !docRef.current) return;
    h.future.push(docRef.current);
    setSel(null);
    setDoc(prev);
    bump();
  }, [setDoc]);
  const redo = useCallback(() => {
    const h = hist.current;
    const next = h.future.pop();
    if (!next || !docRef.current) return;
    h.past.push(docRef.current);
    setSel(null);
    setDoc(next);
    bump();
  }, [setDoc]);

  const load = useCallback(async () => {
    const c = await loadPageContent(page.id);
    saved.current = { blocks: new Map(c.blocks.map((b) => [b.id, b])), strokes: new Map(c.strokes.map((s) => [s.id, s])) };
    docRef.current = c;
    setDocState(c);
  }, [page.id]);

  useEffect(() => {
    ensureParagraphSeparator();
    void load();
    flushers.add(flush);
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    const onExternal = (e: Event) => {
      if ((e as CustomEvent).detail?.pageId === page.id) {
        hist.current = { past: [], future: [] };
        void load();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', stash);
    window.addEventListener('fn:external-change', onExternal);
    return () => {
      void flush();
      flushers.delete(flush);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', stash);
      window.removeEventListener('fn:external-change', onExternal);
    };
  }, [page.id, load, flush, stash]);

  /* ---------- Layout, Zoom ---------- */

  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [zoom, setZoomState] = useState(lastZoom || 1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const anchor = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);

  const fitZoom = (w: number) => Math.min(1.25, Math.max(0.3, (w - MARGIN * 2) / PAGE_W));

  useLayoutEffect(() => {
    const el = stageRef.current!;
    const ro = new ResizeObserver(() => {
      setStage({ w: el.clientWidth, h: el.clientHeight });
      if (!lastZoom) {
        lastZoom = Math.min(1, fitZoom(el.clientWidth));
        setZoomState(lastZoom);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setZoomAt = useCallback((z: number, cx?: number, cy?: number) => {
    const nz = Math.min(4, Math.max(0.3, z));
    const r = pageRef.current?.getBoundingClientRect();
    const sr = stageRef.current?.getBoundingClientRect();
    if (r && sr) {
      const x = cx ?? sr.left + sr.width / 2;
      const y = cy ?? sr.top + sr.height / 2;
      anchor.current = { px: (x - r.left) / zoomRef.current, py: (y - r.top) / zoomRef.current, cx: x, cy: y };
    }
    lastZoom = nz;
    setZoomState(nz);
  }, []);

  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const r = pageRef.current!.getBoundingClientRect();
    const sc = scrollRef.current!;
    sc.scrollLeft += r.left + a.px * zoom - a.cx;
    sc.scrollTop += r.top + a.py * zoom - a.cy;
  }, [zoom]);

  // Strg + Mausrad / Trackpad-Pinch
  useEffect(() => {
    const sc = scrollRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomAt(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, [setZoomAt]);

  /* ---------- Höhen & Seitenmaße ---------- */

  const heights = useRef(new Map<string, number>());
  const [hv, setHv] = useState(0);
  const onHeight = useCallback((id: string, h: number) => {
    if (heights.current.get(id) !== h) {
      heights.current.set(id, h);
      setHv((x) => x + 1);
    }
  }, []);

  const blockBox = useCallback((b: Block): Box => ({
    x: b.x, y: b.y, w: b.w, h: b.kind === 'text' ? heights.current.get(b.id) ?? 40 : b.h ?? 100,
  }), []);

  const pdfBlock = doc?.blocks.find((b) => b.kind === 'pdf');
  const pageH = useMemo(() => {
    if (!doc) return PAGE_MIN_H;
    let bottom = 0;
    for (const b of doc.blocks) if (b.kind !== 'pdf') bottom = Math.max(bottom, b.y + blockBox(b).h);
    for (const s of doc.strokes) { const bx = strokeBox(s); bottom = Math.max(bottom, bx.y + bx.h); }
    const base = pdfBlock ? pdfBlock.y + (pdfBlock.h ?? PAGE_MIN_H) : PAGE_MIN_H;
    return Math.max(base, Math.ceil((bottom + (pdfBlock ? 80 : 500)) / 100) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, hv, pdfBlock, blockBox]);

  const pageLeft = Math.max(MARGIN, (stage.w - PAGE_W * zoom) / 2);
  const sizerW = Math.max(stage.w, PAGE_W * zoom + MARGIN * 2);
  const sizerH = pageH * zoom + MARGIN * 2 + 40;

  /* ---------- Tinte zeichnen ---------- */

  const inkRef = useRef<HTMLCanvasElement>(null);
  const hlRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<InkRenderer | null>(null);
  const activeRef = useRef<Active>(null);
  const baseDirty = useRef(true);
  const raf = useRef(0);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const selRef = useRef(sel);
  selRef.current = sel;

  const view = useCallback((): View | null => {
    const st = stageRef.current, pg = pageRef.current;
    if (!st || !pg) return null;
    const sr = st.getBoundingClientRect(), pr = pg.getBoundingClientRect();
    return { dpr: window.devicePixelRatio || 1, zoom: zoomRef.current, ox: pr.left - sr.left, oy: pr.top - sr.top, w: sr.width, h: sr.height };
  }, []);

  const requestDraw = useCallback((base = false) => {
    if (base) baseDirty.current = true;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const v = view();
      const d = docRef.current;
      if (!v || !d || !inkRef.current || !hlRef.current) return;
      if (!renderer.current) renderer.current = new InkRenderer(inkRef.current, hlRef.current);
      if (baseDirty.current) {
        const dr = dragRef.current;
        renderer.current.renderBase(d.strokes, v, dr && selRef.current ? selRef.current.strokes : new Set(), dr?.dx ?? 0, dr?.dy ?? 0);
        baseDirty.current = false;
      }
      renderer.current.frame(v, activeRef.current);
    });
  }, [view]);

  useLayoutEffect(() => { requestDraw(true); }, [doc, zoom, stage, drag, pageH, pageLeft, requestDraw]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const toPage = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const r = pageRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / zoomRef.current, (e.clientY - r.top) / zoomRef.current];
  }, []);

  /* ---------- Gesten (zwei Finger: zoomen & schieben) ---------- */

  const touches = useRef(new Map<number, Pt>());
  const gesture = useRef<{ d0: number; z0: number; mid: Pt } | null>(null);
  const drawing = useRef<null | { mode: 'stroke' | 'erase' | 'shape' | 'lasso'; id: number; before?: Doc; origin?: Pt; changed?: boolean }>(null);

  const cancelDrawing = () => {
    if (drawing.current?.mode === 'erase' && drawing.current.changed && drawing.current.before) setDoc(drawing.current.before);
    drawing.current = null;
    activeRef.current = null;
    requestDraw();
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.current.size === 2) {
      cancelDrawing();
      const [a, b] = [...touches.current.values()];
      gesture.current = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: zoomRef.current, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    }
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, [e.clientX, e.clientY]);
    const g = gesture.current;
    if (!g || touches.current.size < 2) return;
    const [a, b] = [...touches.current.values()];
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    scrollRef.current!.scrollLeft -= mid[0] - g.mid[0];
    scrollRef.current!.scrollTop -= mid[1] - g.mid[1];
    g.mid = mid;
    const z = g.z0 * (d / g.d0);
    if (Math.abs(z - zoomRef.current) > 0.01) setZoomAt(z, mid[0], mid[1]);
  };
  const onStagePointerUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) gesture.current = null;
  };

  /* ---------- Eingabe auf der Zeichenebene ---------- */

  const eraseAt = (x: number, y: number) => {
    const d = docRef.current!;
    const st = settings.get();
    const r = st.eraserSize / 2;
    const keep = d.strokes.filter((s) => (st.eraserHlOnly && s.tool !== 'highlighter') || !hitsStroke(s, x, y, r));
    if (keep.length !== d.strokes.length) {
      drawing.current!.changed = true;
      docRef.current = { ...d, strokes: keep };
      setDocState(docRef.current);
    }
  };

  const onInputDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = settings.get();
    if (e.pointerType === 'pen' && !st.penSeen) {
      settings.set({ penSeen: true, penOnly: true });
      toast('Stift erkannt: Ab jetzt zeichnet nur der Stift, mit dem Finger scrollst du. Änderbar in den Einstellungen.');
    }
    if (e.pointerType === 'touch' && (settings.get().penOnly || gesture.current || touches.current.size > 1)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drawing.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toPage(e);
    const pressure = e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 0.5;
    if (tool === 'pen' || tool === 'highlighter') {
      const stroke: Stroke = {
        id: uid(), pageId: page.id, tool,
        color: tool === 'pen' ? st.penColor : st.hlColor,
        width: tool === 'pen' ? st.penWidth : st.hlWidth,
        points: [r1(x), r1(y), pressure], pressure: e.pointerType === 'pen',
      };
      activeRef.current = { kind: 'stroke', stroke };
      drawing.current = { mode: 'stroke', id: e.pointerId };
    } else if (tool === 'eraser') {
      drawing.current = { mode: 'erase', id: e.pointerId, before: docRef.current!, changed: false };
      activeRef.current = { kind: 'eraser', x, y, r: st.eraserSize / 2 };
      eraseAt(x, y);
    } else if (tool === 'shape') {
      const stroke: Stroke = { id: uid(), pageId: page.id, tool: 'shape', shape: st.shape, color: st.shapeColor, width: st.shapeWidth, points: [r1(x), r1(y), 0.5, r1(x), r1(y), 0.5] };
      activeRef.current = { kind: 'stroke', stroke };
      drawing.current = { mode: 'shape', id: e.pointerId, origin: [x, y] };
    } else if (tool === 'lasso') {
      setSel(null);
      activeRef.current = { kind: 'lasso', pts: [[x, y]] };
      drawing.current = { mode: 'lasso', id: e.pointerId };
    }
    requestDraw();
  };

  const onInputMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dr = drawing.current;
    if (!dr) {
      if (tool === 'eraser' && e.pointerType !== 'touch') {
        const [x, y] = toPage(e);
        activeRef.current = { kind: 'eraser', x, y, r: settings.get().eraserSize / 2 };
        requestDraw();
      }
      return;
    }
    if (e.pointerId !== dr.id) return;
    const evs = (e.nativeEvent.getCoalescedEvents?.() ?? []).length ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    const a = activeRef.current;
    if (dr.mode === 'stroke' && a?.kind === 'stroke') {
      const pts = a.stroke.points;
      for (const ev of evs) {
        const [x, y] = toPage(ev);
        const lx = pts[pts.length - 3], ly = pts[pts.length - 2];
        if (Math.hypot(x - lx, y - ly) * zoomRef.current < 0.8) continue;
        pts.push(r1(x), r1(y), e.pointerType === 'pen' ? Math.max(0.05, ev.pressure || 0.5) : 0.5);
      }
    } else if (dr.mode === 'erase') {
      for (const ev of evs) {
        const [x, y] = toPage(ev);
        eraseAt(x, y);
        activeRef.current = { kind: 'eraser', x, y, r: settings.get().eraserSize / 2 };
      }
    } else if (dr.mode === 'shape' && a?.kind === 'stroke') {
      let [x, y] = toPage(e);
      const [ox, oy] = dr.origin!;
      if (e.shiftKey) {
        if (a.stroke.shape === 'rect' || a.stroke.shape === 'ellipse') {
          const m = Math.max(Math.abs(x - ox), Math.abs(y - oy));
          x = ox + Math.sign(x - ox || 1) * m;
          y = oy + Math.sign(y - oy || 1) * m;
        } else {
          const ang = Math.round(Math.atan2(y - oy, x - ox) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(x - ox, y - oy);
          x = ox + Math.cos(ang) * len;
          y = oy + Math.sin(ang) * len;
        }
      }
      a.stroke = { ...a.stroke, points: [r1(ox), r1(oy), 0.5, r1(x), r1(y), 0.5] };
    } else if (dr.mode === 'lasso' && a?.kind === 'lasso') {
      for (const ev of evs) a.pts.push(toPage(ev));
    }
    requestDraw();
  };

  const onInputUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const dr = drawing.current;
    if (!dr || e.pointerId !== dr.id) return;
    drawing.current = null;
    const a = activeRef.current;
    const d = docRef.current!;
    if ((dr.mode === 'stroke' || dr.mode === 'shape') && a?.kind === 'stroke') {
      const s = a.stroke;
      if (dr.mode === 'stroke' && s.points.length === 3) s.points.push(s.points[0] + 0.1, s.points[1] + 0.1, s.points[2]);
      const tooSmall = dr.mode === 'shape' && Math.hypot(s.points[3] - s.points[0], s.points[4] - s.points[1]) < 3;
      if (!tooSmall) commit({ ...d, strokes: [...d.strokes, { ...s }] });
    } else if (dr.mode === 'erase' && dr.changed && dr.before) {
      commit(d, dr.before);
    } else if (dr.mode === 'lasso' && a?.kind === 'lasso' && a.pts.length > 2) {
      const poly = a.pts;
      const strokes = new Set(d.strokes.filter((s) => strokeInLasso(s, poly)).map((s) => s.id));
      const blocks = new Set(
        d.blocks.filter((b) => b.kind !== 'pdf').filter((b) => {
          const bx = blockBox(b);
          return pointInPoly(bx.x + bx.w / 2, bx.y + Math.min(bx.h / 2, 30), poly);
        }).map((b) => b.id),
      );
      setSel(strokes.size || blocks.size ? { strokes, blocks } : null);
    }
    activeRef.current = tool === 'eraser' && e.pointerType !== 'touch' ? activeRef.current : null;
    requestDraw(true);
  };

  const onInputCancel = () => cancelDrawing();
  const onInputLeave = () => {
    if (!drawing.current && activeRef.current?.kind === 'eraser') {
      activeRef.current = null;
      requestDraw();
    }
  };

  /* ---------- Auswahl verschieben, Blöcke ändern ---------- */

  const selBox = useMemo(() => {
    if (!sel || !doc) return null;
    const boxes: Box[] = [];
    for (const s of doc.strokes) if (sel.strokes.has(s.id)) boxes.push(strokeBox(s));
    for (const b of doc.blocks) if (sel.blocks.has(b.id)) boxes.push(blockBox(b));
    return unionBox(boxes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, doc, hv, blockBox]);

  const startDrag = useCallback((e: React.PointerEvent, selection: Sel) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSel(selection);
    selRef.current = selection;
    const [sx, sy] = toPage(e);
    let dx = 0, dy = 0;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const [x, y] = toPage(ev);
      dx = x - sx;
      dy = y - sy;
      setDrag({ dx, dy });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      const d = docRef.current!;
      commit({
        strokes: d.strokes.map((s) => (selection.strokes.has(s.id) ? translateStroke(s, dx, dy) : s)),
        blocks: d.blocks.map((b) => (selection.blocks.has(b.id) ? { ...b, x: Math.max(0, r1(b.x + dx)), y: Math.max(0, r1(b.y + dy)) } : b)),
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [toPage, commit]);

  const startResize = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const before = docRef.current!;
    const b0 = before.blocks.find((b) => b.id === id)!;
    const sx = e.clientX;
    const ratio = b0.h && b0.w ? b0.h / b0.w : 1;
    let changed = false;
    const move = (ev: PointerEvent) => {
      const w = Math.max(b0.kind === 'text' ? 120 : 40, Math.min(PAGE_W - b0.x, b0.w + (ev.clientX - sx) / zoomRef.current));
      const d = docRef.current!;
      changed = true;
      docRef.current = { ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, w: r1(w), h: b.kind === 'image' ? r1(w * ratio) : b.h } : b)) };
      setDocState(docRef.current);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (changed) commit(docRef.current!, before);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [commit]);

  const deleteSelection = useCallback(() => {
    const s = selRef.current;
    const d = docRef.current;
    if (!s || !d) return;
    commit({ strokes: d.strokes.filter((x) => !s.strokes.has(x.id)), blocks: d.blocks.filter((b) => !s.blocks.has(b.id)) });
    setSel(null);
  }, [commit]);

  const pasteDoc = useCallback((src: Doc, offset = 24) => {
    const d = docRef.current!;
    const strokes = src.strokes.map((s) => ({ ...translateStroke(s, offset, offset), id: uid(), pageId: page.id }));
    const blocks = src.blocks.map((b) => ({ ...b, id: uid(), pageId: page.id, x: b.x + offset, y: b.y + offset }));
    commit({ strokes: [...d.strokes, ...strokes], blocks: [...d.blocks, ...blocks] });
    settings.set({ tool: 'lasso' });
    setSel({ strokes: new Set(strokes.map((s) => s.id)), blocks: new Set(blocks.map((b) => b.id)) });
  }, [commit, page.id]);

  const selectedDoc = (): Doc | null => {
    const s = selRef.current, d = docRef.current;
    if (!s || !d) return null;
    return { strokes: d.strokes.filter((x) => s.strokes.has(x.id)), blocks: d.blocks.filter((b) => s.blocks.has(b.id)) };
  };

  const recolor = (color: string) => {
    const s = selRef.current, d = docRef.current;
    if (!s || !d) return;
    commit({ ...d, strokes: d.strokes.map((x) => (s.strokes.has(x.id) && x.tool !== 'highlighter' ? { ...x, color } : x)) });
  };

  /* ---------- Text ---------- */

  const [focusId, setFocusId] = useState<string | null>(null);
  const focusSnap = useRef<{ id: string; html: string; doc: Doc } | null>(null);

  const onPaperClick = (e: React.MouseEvent) => {
    if (tool !== 'type' || !docRef.current) return;
    if (selRef.current) {
      setSel(null);
      return;
    }
    const [x, y] = toPage(e);
    const w = Math.max(160, Math.min(520, PAGE_W - x - 16));
    const bx = Math.max(8, Math.min(x - 4, PAGE_W - w - 8));
    const block: Block = { id: uid(), pageId: page.id, kind: 'text', x: r1(bx), y: r1(Math.max(0, y - 14)), w, html: '' };
    setDoc({ ...docRef.current, blocks: [...docRef.current.blocks, block] });
    setFocusId(block.id);
  };

  const onTextChange = useCallback((id: string, html: string) => {
    const d = docRef.current!;
    setDoc({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, html } : b)) });
  }, [setDoc]);

  const onFocusIn = useCallback((id: string) => {
    const d = docRef.current!;
    focusSnap.current = { id, html: d.blocks.find((b) => b.id === id)?.html ?? '', doc: d };
    setSel(null);
    setFocusId(null);
  }, []);

  const onFocusOut = useCallback((id: string, html: string) => {
    const snap = focusSnap.current?.id === id ? focusSnap.current : null;
    focusSnap.current = null;
    const d = docRef.current;
    if (!d) return;
    const empty = !htmlToText(html) && !/data-tag|<img/i.test(html);
    if (empty) {
      const next = { ...d, blocks: d.blocks.filter((b) => b.id !== id) };
      if (snap && htmlToText(snap.html)) commit(next, snap.doc);
      else setDoc(next);
    } else if (snap && snap.html !== html) {
      hist.current.past.push(snap.doc);
      hist.current.future = [];
      bump();
    }
    void flush();
  }, [commit, setDoc, flush]);

  const deleteBlock = useCallback((id: string) => {
    focusSnap.current = null;
    const d = docRef.current!;
    commit({ ...d, blocks: d.blocks.filter((b) => b.id !== id) });
  }, [commit]);

  const onTextMoveStart = useCallback((id: string, e: React.PointerEvent) => {
    startDrag(e, { strokes: new Set(), blocks: new Set([id]) });
  }, [startDrag]);

  /* ---------- Bilder ---------- */

  const insertImage = useCallback(async (file: File, at?: Pt) => {
    if (!file.type.startsWith('image/')) {
      toast('Das ist kein Bild.', 'error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast('Bilder bis 25 MB, bitte verkleinern.', 'error');
      return;
    }
    let w = 400, h = 300;
    try {
      const bmp = await createImageBitmap(file);
      w = Math.min(600, bmp.width);
      h = (bmp.height / bmp.width) * w;
      bmp.close();
    } catch {
      toast('Das Bild ließ sich nicht lesen.', 'error');
      return;
    }
    const assetId = await addAsset(file, file.name);
    let pos = at;
    if (!pos) {
      const v = view();
      pos = v ? [(-v.ox + v.w / 2) / v.zoom - w / 2, (-v.oy + v.h / 3) / v.zoom] : [80, 160];
    }
    const x = Math.max(0, Math.min(pos[0], PAGE_W - w));
    const block: Block = { id: uid(), pageId: page.id, kind: 'image', x: r1(x), y: r1(Math.max(0, pos[1])), w: r1(w), h: r1(h), assetId };
    const d = docRef.current!;
    commit({ ...d, blocks: [...d.blocks, block] });
    settings.set({ tool: 'type' });
    setSel({ strokes: new Set(), blocks: new Set([block.id]) });
  }, [commit, page.id, view]);

  const onPasteImage = useCallback((file: File, near: Block) => {
    void insertImage(file, [near.x, near.y + (heights.current.get(near.id) ?? 40) + 8]);
  }, [insertImage]);

  const onImageDown = useCallback((id: string, e: React.PointerEvent) => {
    startDrag(e, { strokes: new Set(), blocks: new Set([id]) });
  }, [startDrag]);

  /* ---------- Tastatur, Einfügen, Ablegen ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); setZoomAt(zoomRef.current * 1.2); return; }
      if (mod && e.key === '-') { e.preventDefault(); setZoomAt(zoomRef.current / 1.2); return; }
      if (mod && e.key === '0') { e.preventDefault(); setZoomAt(1); return; }
      if (isEditing() || document.querySelector('.overlay')) return;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && k === 'a') {
        e.preventDefault();
        const d = docRef.current!;
        settings.set({ tool: 'lasso' });
        setSel({ strokes: new Set(d.strokes.map((s) => s.id)), blocks: new Set(d.blocks.filter((b) => b.kind !== 'pdf').map((b) => b.id)) });
        return;
      }
      if (mod && (k === 'c' || k === 'x')) {
        const sd = selectedDoc();
        if (sd) { clip = sd; if (k === 'x') deleteSelection(); toast(k === 'x' ? 'Ausgeschnitten.' : 'Kopiert.'); }
        return;
      }
      if (mod && k === 'd') { e.preventDefault(); const sd = selectedDoc(); if (sd) pasteDoc(sd); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current) { e.preventDefault(); deleteSelection(); return; }
      if (e.key === 'Escape') { setSel(null); return; }
      if (mod || e.altKey) return;
      const map: Record<string, typeof tool> = { t: 'type', v: 'type', p: 'pen', h: 'highlighter', e: 'eraser', l: 'lasso', s: 'shape' };
      if (map[k]) { settings.set({ tool: map[k] }); setSel(null); }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isEditing() || document.querySelector('.overlay')) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (file) { e.preventDefault(); void insertImage(file); return; }
      if (clip) { e.preventDefault(); pasteDoc(clip); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, deleteSelection, pasteDoc, insertImage, setZoomAt]);

  const onDrop = async (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    e.preventDefault();
    const at = toPage(e);
    for (const f of files) {
      if (f.type.startsWith('image/')) await insertImage(f, at);
      else if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        try {
          toast('PDF wird importiert …');
          const r = await importPdf(f, { notebookId: notebook.id }, () => {});
          toast(`${r.pages} Seiten als neuer Abschnitt importiert.`);
          navigate(pagePath(r.notebookId, r.pageId));
        } catch (err) {
          toast(err instanceof PdfImportError ? err.message : 'PDF-Import fehlgeschlagen.', 'error');
        }
      }
    }
  };

  /* ---------- Suchtreffer markieren ---------- */

  useEffect(() => {
    const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HL = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!q || !doc || !reg || !HL) return;
    const t = setTimeout(() => {
      const needle = q.toLocaleLowerCase('de-DE');
      const ranges: Range[] = [];
      pageRef.current?.querySelectorAll('.tb-content').forEach((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = (n.nodeValue || '').toLocaleLowerCase('de-DE');
          for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) {
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + needle.length);
            ranges.push(r);
          }
        }
      });
      reg.set('fn-search', new HL(...ranges));
      ranges[0]?.startContainer.parentElement?.scrollIntoView({ block: 'center' });
    }, 80);
    return () => { clearTimeout(t); reg.delete('fn-search'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, doc === null]);

  /* ---------- Drucken ---------- */

  const [printImgs, setPrintImgs] = useState<{ ink: string; hl: string } | null>(null);
  const print = () => {
    const d = docRef.current;
    if (!d) return;
    setPrintImgs({ ink: renderFullPage(d.strokes, PAGE_W, pageH, 2, 'ink'), hl: renderFullPage(d.strokes, PAGE_W, pageH, 2, 'hl') });
  };
  useEffect(() => {
    if (!printImgs) return;
    const done = () => setPrintImgs(null);
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 120);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printImgs]);

  /* ---------- Render ---------- */

  const onPaper = (p: Paper, asDefault: boolean) => {
    void updatePage(page.id, { paper: p });
    if (asDefault) void updateNotebook(notebook.id, { paper: p });
  };

  const deletePage = async () => {
    await flush();
    await trashPage(page.id);
    toast('Seite liegt im Papierkorb.', 'info', { label: 'Rückgängig', run: () => void import('../db/repo').then((m) => m.restorePage(page.id)) });
  };

  const interactiveText = tool === 'type';
  const empty = doc && !doc.blocks.length && !doc.strokes.length;
  const moving = drag && sel;

  return (
    <div className="editor">
      <Toolbar
        canUndo={hist.current.past.length > 0}
        canRedo={hist.current.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        zoom={zoom}
        onZoom={(z) => setZoomAt(z)}
        onFit={() => setZoomAt(fitZoom(stage.w))}
        onInsertImage={(f) => void insertImage(f)}
        paper={page.paper}
        onPaper={onPaper}
        onPrint={print}
        onDeletePage={deletePage}
        isPdf={!!pdfBlock}
      />
      <div
        className={`stage tool-${tool}`}
        ref={stageRef}
        onPointerDownCapture={onStagePointerDown}
        onPointerMoveCapture={onStagePointerMove}
        onPointerUpCapture={onStagePointerUp}
        onPointerCancelCapture={onStagePointerUp}
        onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="stage-scroll" ref={scrollRef} onScroll={() => requestDraw(true)}>
          <div className="page-sizer" style={{ width: sizerW, height: sizerH }}>
            <div
              ref={pageRef}
              className={`page page-c-${page.paper.color}`}
              style={{ width: PAGE_W, height: pageH, left: pageLeft, top: MARGIN, transform: `scale(${zoom})` }}
            >
              <div className={paperClass(pdfBlock ? "blank" : page.paper.type, page.paper.color)} onClick={onPaperClick} data-testid="paper" />
              <PageTitle page={page} />
              {doc?.blocks.map((b) => {
                const off = moving && sel!.blocks.has(b.id) ? { transform: `translate(${drag!.dx}px, ${drag!.dy}px)` } : undefined;
                return (
                  <div key={b.id} className="block-slot" style={off}>
                    {b.kind === 'pdf' && <PdfBlockView block={b} zoom={zoom} />}
                    {b.kind === 'image' && <ImageBlockView block={b} selected={!!sel?.blocks.has(b.id)} interactive={interactiveText} onPointerDown={onImageDown} onResizeStart={startResize} />}
                    {b.kind === 'text' && (
                      <TextBlockView
                        block={b}
                        autoFocus={focusId === b.id}
                        selected={!!sel?.blocks.has(b.id)}
                        interactive={interactiveText}
                        onChange={onTextChange}
                        onFocusIn={onFocusIn}
                        onFocusOut={onFocusOut}
                        onMoveStart={onTextMoveStart}
                        onResizeStart={startResize}
                        onDelete={deleteBlock}
                        onHeight={onHeight}
                        onPasteImage={onPasteImage}
                      />
                    )}
                  </div>
                );
              })}
              {empty && !page.title && !pdfBlock && (
                <p className="page-hint" aria-hidden>Klick irgendwo hin und tipp los, oder nimm den Stift (P) und schreib frei.</p>
              )}
              {tool !== 'type' && (
                <div
                  className="input-layer"
                  style={{ touchAction: penOnly ? 'pan-x pan-y' : 'none' }}
                  onPointerDown={onInputDown}
                  onPointerMove={onInputMove}
                  onPointerUp={onInputUp}
                  onPointerCancel={onInputCancel}
                  onPointerLeave={onInputLeave}
                  aria-label="Zeichenfläche"
                />
              )}
              {selBox && sel && (
                <div
                  className="sel-box"
                  style={{ left: selBox.x - 6, top: selBox.y - 6, width: selBox.w + 12, height: selBox.h + 12, transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined }}
                  onPointerDown={(e) => startDrag(e, sel)}
                >
                  <div className="sel-actions" style={{ transform: `scale(${1 / zoom})` }} onPointerDown={(e) => e.stopPropagation()}>
                    {sel.strokes.size > 0 && PEN_COLORS.slice(0, 6).map((c) => (
                      <button key={c.id} type="button" className="swatch swatch-sm" style={{ background: c.id }} aria-label={`Auswahl ${c.name} färben`} title={c.name} onClick={() => recolor(c.id)} />
                    ))}
                    <button type="button" className="icon-btn" aria-label="Duplizieren" title="Duplizieren (Strg D)" onClick={() => { const sd = selectedDoc(); if (sd) pasteDoc(sd); }}><Copy size={16} /></button>
                    <button type="button" className="icon-btn danger" aria-label="Auswahl löschen" title="Löschen (Entf)" onClick={deleteSelection}><Trash2 size={16} /></button>
                  </div>
                </div>
              )}
              {printImgs && (
                <>
                  <img className="print-ink print-hl" src={printImgs.hl} alt="" />
                  <img className="print-ink" src={printImgs.ink} alt="" />
                </>
              )}
            </div>
          </div>
        </div>
        <canvas ref={hlRef} className={`ink-layer ink-hl ${page.paper.color === 'dark' ? 'on-dark' : ''}`} aria-hidden />
        <canvas ref={inkRef} className="ink-layer" aria-hidden />
        {!doc && <div className="stage-loading">Seite wird geladen …</div>}
      </div>
    </div>
  );
}

function pointInPoly(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function PageTitle({ page }: { page: Page }) {
  const [title, setTitle] = useState(page.title);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setTitle(page.title), [page.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const created = new Date(page.createdAt);
  return (
    <div className="page-title">
      <input
        value={title}
        placeholder="Seitentitel"
        aria-label="Seitentitel"
        maxLength={140}
        onChange={(e) => {
          const v = e.target.value;
          setTitle(v);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void updatePage(page.id, { title: v }), 250);
        }}
        onBlur={() => { window.clearTimeout(timer.current); if (title !== page.title) void updatePage(page.id, { title }); }}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
      />
      <div className="page-date">{dateFmt.format(created)} · {timeFmt.format(created)}</div>
    </div>
  );
}
