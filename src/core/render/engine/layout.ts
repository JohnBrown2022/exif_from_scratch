import type { Rect, TemplateLayout } from '../templates';
import type { ComputedLayout, LayoutSpec, ScaleModel } from './types';
import { computeScale, resolveDimension } from './values';

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

export function computeLayout(
  layout: LayoutSpec,
  scaleModel: ScaleModel,
  baseWidth: number,
  baseHeight: number,
): ComputedLayout {
  const photoDrawMode = layout.photoDrawMode ?? 'contain';
  const scale = computeScale(baseWidth, baseHeight, scaleModel);
  const photoCornerRadius = resolveDimension(layout.photoCornerRadius, scale, 0);

  if (layout.kind === 'photo_only') {
    const canvasWidth = baseWidth;
    const canvasHeight = baseHeight;
    const photoRect = rect(0, 0, baseWidth, baseHeight);
    return {
      canvasWidth,
      canvasHeight,
      photoRect,
      zones: {
        canvas: rect(0, 0, canvasWidth, canvasHeight),
        content: rect(0, 0, canvasWidth, canvasHeight),
        photo: photoRect,
      },
      photoDrawMode,
      photoCornerRadius: photoCornerRadius > 0 ? photoCornerRadius : undefined,
      scale,
    };
  }

  if (layout.kind === 'photo_plus_footer') {
    const outer = Math.max(0, resolveDimension(layout.outerPadding, scale, 0));
    const footerHeight = resolveDimension(layout.footerHeight, scale, 0);
    const canvasWidth = baseWidth + outer * 2;
    const canvasHeight = baseHeight + footerHeight + outer * 2;
    const photoRect = rect(outer, outer, baseWidth, baseHeight);
    const footerRect = rect(outer, outer + baseHeight, baseWidth, footerHeight);
    const contentRect = rect(outer, outer, baseWidth, baseHeight + footerHeight);
    return {
      canvasWidth,
      canvasHeight,
      photoRect,
      zones: {
        canvas: rect(0, 0, canvasWidth, canvasHeight),
        content: contentRect,
        photo: photoRect,
        footer: footerRect,
      },
      photoDrawMode,
      photoCornerRadius: photoCornerRadius > 0 ? photoCornerRadius : undefined,
      scale,
    };
  }

  if (layout.kind === 'fixed_ratio') {
    const ratio = layout.ratio;
    if (!Number.isFinite(ratio) || ratio <= 0) throw new Error(`Invalid fixed_ratio layout: ratio must be > 0`);

    const canvasWidth = baseWidth;
    const canvasHeight = Math.max(1, Math.round(baseWidth / ratio));
    const photoRect = rect(0, 0, canvasWidth, canvasHeight);
    return {
      canvasWidth,
      canvasHeight,
      photoRect,
      zones: {
        canvas: rect(0, 0, canvasWidth, canvasHeight),
        content: rect(0, 0, canvasWidth, canvasHeight),
        photo: photoRect,
      },
      photoDrawMode: layout.photoDrawMode ?? 'cover',
      photoCornerRadius: photoCornerRadius > 0 ? photoCornerRadius : undefined,
      scale,
    };
  }

  // Exhaustive check
  const neverLayout: never = layout;
  throw new Error(`Unsupported layout kind: ${(neverLayout as { kind?: string }).kind ?? 'unknown'}`);
}

export function toTemplateLayout(computed: ComputedLayout): TemplateLayout {
  return {
    canvasWidth: computed.canvasWidth,
    canvasHeight: computed.canvasHeight,
    imageRect: computed.photoRect,
    imageDrawMode: computed.photoDrawMode,
    imageCornerRadius: computed.photoCornerRadius,
  };
}
