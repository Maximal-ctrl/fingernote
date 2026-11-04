import type { Stroke } from '../db/db';
import { drawStroke, strokeBox, type Box, type Pt } from './ink';

export interface View {
  dpr: number;
  zoom: number;
  ox: number; // CSS-Pixel: Seitenursprung relativ zur Bühne
  oy: number;
  w: number; // Bühnengröße in CSS-Pixeln
  h: number;
}

export type Active =
  | { kind: 'stroke'; stroke: Stroke }
  | { kind: 'lasso'; pts: Pt[] }
  | { kind: 'eraser'; x: number; y: number; r: number }
  | null;

function ensureSize(c: HTMLCanvasElement | OffscreenCanvas, w: number, h: number) {
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
}

function setView(ctx: CanvasRenderingContext2D, v: View) {
  ctx.setTransform(v.dpr * v.zoom, 0, 0, v.dpr * v.zoom, v.ox * v.dpr, v.oy * v.dpr);
}

function visible(b: Box, v: View) {
  const x0 = -v.ox / v.zoom, y0 = -v.oy / v.zoom;
  const x1 = x0 + v.w / v.zoom, y1 = y0 + v.h / v.zoom;
  return !(b.x > x1 || b.y > y1 || b.x + b.w < x0 || b.y + b.h < y0);
}

/**
 * Zwei Ebenen über der Seite: Marker (mit mix-blend-mode multiply, Text bleibt lesbar) und Tinte.
 * Fertige Striche liegen in einem Zwischenspeicher, pro Frame kommt nur der aktive Strich dazu.
 */
export class InkRenderer {
  private baseInk = document.createElement('canvas');
  private baseHl = document.createElement('canvas');
  constructor(private ink: HTMLCanvasElement, private hl: HTMLCanvasElement) {}

  renderBase(strokes: Stroke[], v: View, moved: Set<string>, dx: number, dy: number) {
    const W = Math.round(v.w * v.dpr), H = Math.round(v.h * v.dpr);
    for (const c of [this.baseInk, this.baseHl, this.ink, this.hl]) ensureSize(c, W, H);
    const ci = this.baseInk.getContext('2d')!;
    const ch = this.baseHl.getContext('2d')!;
    for (const ctx of [ci, ch]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      setView(ctx, v);
    }
    for (const s of strokes) {
      const isMoved = moved.has(s.id);
      const b = strokeBox(s);
      if (!visible(isMoved ? { ...b, x: b.x + dx, y: b.y + dy } : b, v)) continue;
      const ctx = s.tool === 'highlighter' ? ch : ci;
      if (isMoved) {
        ctx.save();
        ctx.translate(dx, dy);
        drawStroke(ctx, s);
        ctx.restore();
      } else drawStroke(ctx, s);
    }
  }

  frame(v: View, active: Active) {
    const W = this.ink.width, H = this.ink.height;
    const ci = this.ink.getContext('2d')!;
    const ch = this.hl.getContext('2d')!;
    ci.setTransform(1, 0, 0, 1, 0, 0);
    ci.clearRect(0, 0, W, H);
    ci.drawImage(this.baseInk, 0, 0);
    ch.setTransform(1, 0, 0, 1, 0, 0);
    ch.clearRect(0, 0, W, H);
    ch.drawImage(this.baseHl, 0, 0);
    if (!active) return;
    if (active.kind === 'stroke') {
      const ctx = active.stroke.tool === 'highlighter' ? ch : ci;
      setView(ctx, v);
      drawStroke(ctx, active.stroke, false);
    } else if (active.kind === 'lasso') {
      setView(ci, v);
      ci.lineWidth = 1.5 / v.zoom;
      ci.setLineDash([6 / v.zoom, 5 / v.zoom]);
      ci.strokeStyle = getComputedStyle(this.ink).getPropertyValue('--accent') || '#3b5bdb';
      ci.fillStyle = 'rgba(120,140,200,0.08)';
      ci.beginPath();
      active.pts.forEach(([x, y], i) => (i ? ci.lineTo(x, y) : ci.moveTo(x, y)));
      ci.closePath();
      ci.fill();
      ci.stroke();
      ci.setLineDash([]);
    } else if (active.kind === 'eraser') {
      setView(ci, v);
      ci.lineWidth = 1.5 / v.zoom;
      ci.strokeStyle = 'rgba(100,100,110,0.9)';
      ci.fillStyle = 'rgba(255,255,255,0.35)';
      ci.beginPath();
      ci.arc(active.x, active.y, active.r, 0, Math.PI * 2);
      ci.fill();
      ci.stroke();
    }
  }
}

/** Ganze Seite als Bild (für Druck/PDF). */
export function renderFullPage(strokes: Stroke[], width: number, height: number, scale: number, tool: 'ink' | 'hl'): string {
  const c = document.createElement('canvas');
  c.width = Math.round(width * scale);
  c.height = Math.round(height * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  for (const s of strokes) if ((s.tool === 'highlighter') === (tool === 'hl')) drawStroke(ctx, s);
  return c.toDataURL('image/png');
}
