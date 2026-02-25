import { clamp } from '../utils/clamp';

import type { Anchor, Length, NodeLayout, Rect } from './types';

export type LayoutEnv = { canvas: { width: number; height: number }; imageRect: Rect; photoRect: Rect };

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

function parsePercent(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed.endsWith('%')) return null;
  const num = Number.parseFloat(trimmed.slice(0, -1));
  if (!Number.isFinite(num)) return null;
  return num / 100;
}

export function resolveLength(value: Length, reference: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const pct = parsePercent(value);
    if (pct !== null) return reference * pct;
    const asNum = Number.parseFloat(value);
    if (Number.isFinite(asNum)) return asNum;
  }
  return 0;
}

function anchorPoint(anchor: Anchor, box: Rect): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height;

  switch (anchor) {
    case 'top-left':
      return { x: left, y: top };
    case 'top':
      return { x: cx, y: top };
    case 'top-right':
      return { x: right, y: top };
    case 'left':
      return { x: left, y: cy };
    case 'center':
      return { x: cx, y: cy };
    case 'right':
      return { x: right, y: cy };
    case 'bottom-left':
      return { x: left, y: bottom };
    case 'bottom':
      return { x: cx, y: bottom };
    case 'bottom-right':
      return { x: right, y: bottom };
    default: {
      const neverAnchor: never = anchor;
      void neverAnchor;
      return { x: cx, y: cy };
    }
  }
}

function defaultRectFor(relativeTo: 'canvas' | 'image' | 'photo', env: LayoutEnv): Rect {
  if (relativeTo === 'photo') return env.photoRect;
  if (relativeTo === 'image') return env.imageRect;
  return rect(0, 0, env.canvas.width, env.canvas.height);
}

export function resolveNodeRect(layout: NodeLayout | undefined, env: LayoutEnv): Rect {
  if (!layout) return rect(0, 0, env.canvas.width, env.canvas.height);

  const relativeTo = layout.relativeTo ?? 'canvas';
  const base = defaultRectFor(relativeTo, env);

  if (layout.kind === 'rect') {
    const x = base.x + resolveLength(layout.x, base.width);
    const y = base.y + resolveLength(layout.y, base.height);
    const w = resolveLength(layout.width, base.width);
    const h = resolveLength(layout.height, base.height);
    return rect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  const w = resolveLength(layout.width, base.width);
  const h = resolveLength(layout.height, base.height);
  const point = anchorPoint(layout.anchor, base);
  const ox = resolveLength(layout.offsetX, base.width);
  const oy = resolveLength(layout.offsetY, base.height);

  let x = point.x + ox;
  let y = point.y + oy;

  // Place rect with the anchor point at (x, y)
  if (layout.anchor.includes('right')) x -= w;
  else if (layout.anchor === 'top' || layout.anchor === 'center' || layout.anchor === 'bottom') x -= w / 2;

  if (layout.anchor.includes('bottom')) y -= h;
  else if (layout.anchor === 'left' || layout.anchor === 'center' || layout.anchor === 'right') y -= h / 2;

  // Clamp a little to avoid accidental huge offsets
  const xClamped = clamp(x, base.x - base.width * 2, base.x + base.width * 3);
  const yClamped = clamp(y, base.y - base.height * 2, base.y + base.height * 3);

  return rect(Math.round(xClamped), Math.round(yClamped), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
