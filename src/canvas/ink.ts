import { getStroke } from 'perfect-freehand';
import type { ShapeKind, Stroke } from '../db/db';

export type Pt = [number, number];

/** Polylinien einer Form in Seitenkoordinaten. */
export function shapePolylines(shape: ShapeKind, x1: number, y1: number, x2: number, y2: number, width = 2): Pt[][] {
  switch (shape) {
    case 'line':
      return [[[x1, y1], [x2, y2]]];
    case 'rect':
      return [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]];
    case 'ellipse': {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      const pts: Pt[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
      return [pts];
    }
    case 'arrow': {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const len = Math.min(Math.hypot(x2 - x1, y2 - y1) * 0.4, 14 + width * 3);
      const a1 = ang + Math.PI * 0.85, a2 = ang - Math.PI * 0.85;
      return [
        [[x1, y1], [x2, y2]],
        [[x2 + Math.cos(a1) * len, y2 + Math.sin(a1) * len], [x2, y2], [x2 + Math.cos(a2) * len, y2 + Math.sin(a2) * len]],
      ];
    }
  }
}

export function strokePolylines(s: Stroke): Pt[][] {
  if (s.tool === 'shape' && s.shape) {
    const [x1, y1, , x2, y2] = s.points;
    return shapePolylines(s.shape, x1, y1, x2, y2, s.width);
  }
  const pts: Pt[] = [];
  for (let i = 0; i < s.points.length; i += 3) pts.push([s.points[i], s.points[i + 1]]);
  return [pts];
}

const pathCache = new WeakMap<Stroke, Path2D>();

function outlinePath(points: number[], width: number, opts: { pressure: boolean; highlighter: boolean; complete: boolean }) {
  const input: [number, number, number][] = [];
  for (let i = 0; i < points.length; i += 3) input.push([points[i], points[i + 1], points[i + 2]]);
  const outline = getStroke(input, {
    size: width,
    thinning: opts.highlighter ? 0 : opts.pressure ? 0.6 : 0.45,
    smoothing: 0.5,
    streamline: opts.highlighter ? 0.6 : 0.45,
    simulatePressure: !opts.highlighter && !opts.pressure,
    last: opts.complete,
    start: { cap: !opts.highlighter, taper: 0 },
    end: { cap: !opts.highlighter, taper: 0 },
  });
  const path = new Path2D();
  if (!outline.length) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length - 1; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[i + 1];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

function shapePath(s: Stroke) {
  const path = new Path2D();
  for (const line of strokePolylines(s)) {
    line.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  }
  return path;
}

export function pathFor(s: Stroke, complete = true): Path2D {
  if (complete) {
    const hit = pathCache.get(s);
    if (hit) return hit;
  }
  const p = s.tool === 'shape'
    ? shapePath(s)
    : outlinePath(s.points, s.width, { pressure: !!s.pressure, highlighter: s.tool === 'highlighter', complete });
  if (complete) pathCache.set(s, p);
  return p;
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, complete = true) {
  const path = pathFor(s, complete);
  if (s.tool === 'shape') {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  } else {
    ctx.fillStyle = s.color;
    ctx.fill(path);
  }
}

export interface Box { x: number; y: number; w: number; h: number }

const boxCache = new WeakMap<Stroke, Box>();
export function strokeBox(s: Stroke): Box {
  const hit = boxCache.get(s);
  if (hit) return hit;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const line of strokePolylines(s)) {
    for (const [x, y] of line) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const pad = s.width / 2;
  const box = { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  boxCache.set(s, box);
  return box;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Trifft der Radierer (Kreis) den Strich? */
export function hitsStroke(s: Stroke, x: number, y: number, r: number): boolean {
  const b = strokeBox(s);
  if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) return false;
  const tol = r + s.width / 2;
  for (const line of strokePolylines(s)) {
    if (line.length === 1 && Math.hypot(line[0][0] - x, line[0][1] - y) <= tol) return true;
    for (let i = 1; i < line.length; i++) {
      if (distToSegment(x, y, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]) <= tol) return true;
    }
  }
  return false;
}

export function pointInPolygon(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Ein Strich gilt als umkreist, wenn mehr als die Hälfte seiner Punkte im Lasso liegt. */
export function strokeInLasso(s: Stroke, poly: Pt[]): boolean {
  let n = 0, inside = 0;
  for (const line of strokePolylines(s)) {
    for (const [x, y] of line) {
      n++;
      if (pointInPolygon(x, y, poly)) inside++;
    }
  }
  return n > 0 && inside / n > 0.5;
}

export function translateStroke(s: Stroke, dx: number, dy: number): Stroke {
  const points = s.points.slice();
  for (let i = 0; i < points.length; i += 3) {
    points[i] = Math.round((points[i] + dx) * 10) / 10;
    points[i + 1] = Math.round((points[i + 1] + dy) * 10) / 10;
  }
  return { ...s, points };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
