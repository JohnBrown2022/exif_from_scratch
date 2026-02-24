import type { ElementSpec } from '../../../core';

export type FlatElement = { el: ElementSpec; depth: number };

export function flattenElements(elements: ElementSpec[], depth = 0): FlatElement[] {
  const out: FlatElement[] = [];
  for (const el of elements) {
    out.push({ el, depth });
    if (el.type === 'stack') out.push(...flattenElements(el.children, depth + 1));
  }
  return out;
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function getElementLabel(el: ElementSpec): string {
  if (el.type === 'text' || el.type === 'maker_logo') return el.label ?? el.id;
  return el.id;
}

