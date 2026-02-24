import type { Dimension, ScaleModel } from './types';

export function computeScale(baseWidth: number, baseHeight: number, model: ScaleModel): number {
  const width = Number.isFinite(baseWidth) ? baseWidth : 0;
  const height = Number.isFinite(baseHeight) ? baseHeight : 0;
  const basis = model.basis ?? 'width';

  const numerator = basis === 'minEdge' ? Math.min(width, height || width) : width;
  if (!Number.isFinite(numerator) || numerator <= 0) return 1;

  // Return raw scale — per-dimension minPx/maxPx provide fine-grained clamping.
  return numerator / model.designWidth;
}

export function resolveDimension(value: Dimension | undefined, scale: number, fallback: number): number {
  if (typeof value === 'number') return value;
  if (!value) return fallback;

  let px = value.designPx * scale;
  if (typeof value.minPx === 'number') px = Math.max(value.minPx, px);
  if (typeof value.maxPx === 'number') px = Math.min(value.maxPx, px);

  const round = value.round ?? 'round';
  if (round === 'floor') return Math.floor(px);
  if (round === 'ceil') return Math.ceil(px);
  return Math.round(px);
}
