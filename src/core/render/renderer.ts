import type { ExifData } from '../exif/types';
import type { CanvasRotation } from '../exif/readRotation';
import { extractPaletteFromCanvasArea } from '../image/palette';
import type { MakerLogo } from '../brand/makerLogo';
import { clamp } from '../utils/clamp';
import type { TopologyWatermarkRenderOptions } from '../watermark/types';
import { renderTopologyMountainStamp } from '../watermark/topologyMountain';
import { roundRectPath } from './draw';
import type { ImageDrawMode, Rect, TemplateId, TemplateLayout, WatermarkTemplate } from './templates';

type DrawImageOptions = {
  rect: Rect;
  mode: ImageDrawMode;
  cornerRadius?: number;
};

function shouldApplyRotation(rotation: CanvasRotation | null | undefined): rotation is CanvasRotation {
  return Boolean(
    rotation?.canvas &&
    (rotation.rad !== 0 || rotation.scaleX !== 1 || rotation.scaleY !== 1 || rotation.dimensionSwapped),
  );
}

function getOrientedSize(
  imageWidth: number,
  imageHeight: number,
  rotation: CanvasRotation | null | undefined,
): { width: number; height: number } {
  if (shouldApplyRotation(rotation) && rotation.dimensionSwapped) {
    return { width: imageHeight, height: imageWidth };
  }
  return { width: imageWidth, height: imageHeight };
}

function defaultLayout(baseWidth: number, baseHeight: number): TemplateLayout {
  return {
    canvasWidth: baseWidth,
    canvasHeight: baseHeight,
    imageRect: { x: 0, y: 0, width: baseWidth, height: baseHeight },
    imageDrawMode: 'contain',
  };
}

function drawImageInRect(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  rotation: CanvasRotation | null | undefined,
  options: DrawImageOptions,
) {
  const { rect, mode, cornerRadius } = options;
  const applyRotation = shouldApplyRotation(rotation);
  const oriented = getOrientedSize(imageWidth, imageHeight, rotation);

  const scale =
    mode === 'cover'
      ? Math.max(rect.width / oriented.width, rect.height / oriented.height)
      : Math.min(rect.width / oriented.width, rect.height / oriented.height);

  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  ctx.save();
  if (cornerRadius && cornerRadius > 0) {
    roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, cornerRadius);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
  }

  ctx.translate(cx, cy);
  if (applyRotation && rotation) {
    ctx.rotate(rotation.rad);
    ctx.scale(rotation.scaleX, rotation.scaleY);
  }

  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function computeImageDrawRect(
  imageWidth: number,
  imageHeight: number,
  rotation: CanvasRotation | null | undefined,
  rect: Rect,
  mode: ImageDrawMode,
): Rect {
  const oriented = getOrientedSize(imageWidth, imageHeight, rotation);
  const scale =
    mode === 'cover'
      ? Math.max(rect.width / oriented.width, rect.height / oriented.height)
      : Math.min(rect.width / oriented.width, rect.height / oriented.height);

  const drawWidth = oriented.width * scale;
  const drawHeight = oriented.height * scale;

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  return { x: cx - drawWidth / 2, y: cy - drawHeight / 2, width: drawWidth, height: drawHeight };
}

function shouldDrawTopologyWatermark(wm: TopologyWatermarkRenderOptions | null | undefined): wm is TopologyWatermarkRenderOptions {
  return Boolean(wm?.enabled && wm.seed && wm.alpha > 0 && wm.size > 0);
}

function getTopologyWatermarkAnchor(templateId: TemplateId): 'top-right' | 'bottom-right' {
  switch (templateId) {
    case 'bottom_bar':
    case 'monitor_bar':
    case 'shot_on':
    case 'film':
    case 'lightroom_footer':
    case 'minimal_corner':
      return 'top-right';
    default:
      return 'bottom-right';
  }
}

function drawTopologyWatermark(
  ctx: CanvasRenderingContext2D,
  input: {
    templateId: TemplateId;
    imageDrawMode: ImageDrawMode;
    imageRect: Rect;
    photoRect: Rect;
    cornerRadius?: number;
    watermark: TopologyWatermarkRenderOptions;
  },
) {
  const { imageRect, photoRect, watermark } = input;

  const shortEdge = Math.max(1, Math.min(photoRect.width, photoRect.height));
  const rawSizePx = shortEdge * clamp(watermark.size, 0, 1);
  const stampSize = Math.max(1, Math.round(clamp(rawSizePx, Math.min(24, shortEdge), shortEdge)));
  if (stampSize <= 1) return;

  const half = stampSize / 2;
  const minX = photoRect.x + half;
  const maxX = photoRect.x + photoRect.width - half;
  const minY = photoRect.y + half;
  const maxY = photoRect.y + photoRect.height - half;

  let x = photoRect.x + photoRect.width / 2;
  let y = photoRect.y + photoRect.height / 2;

  if (watermark.positionMode === 'manual') {
    const rx = clamp(watermark.x, 0, 1);
    const ry = clamp(watermark.y, 0, 1);
    x = photoRect.x + rx * photoRect.width;
    y = photoRect.y + ry * photoRect.height;
  } else {
    const anchor = getTopologyWatermarkAnchor(input.templateId);
    const margin = Math.max(8, stampSize * 0.12);
    const right = photoRect.x + photoRect.width - margin - half;
    const top = photoRect.y + margin + half;
    const bottom = photoRect.y + photoRect.height - margin - half;

    x = right;
    y = anchor === 'top-right' ? top : bottom;
  }

  if (minX <= maxX) x = clamp(x, minX, maxX);
  if (minY <= maxY) y = clamp(y, minY, maxY);

  const stamp = renderTopologyMountainStamp({
    seed: watermark.seed,
    sizePx: stampSize,
    density: watermark.density,
    noise: watermark.noise,
    alpha: watermark.alpha,
  });

  ctx.save();
  if (input.cornerRadius && input.cornerRadius > 0) {
    roundRectPath(ctx, imageRect.x, imageRect.y, imageRect.width, imageRect.height, input.cornerRadius);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
    ctx.clip();
  }

  if (input.imageDrawMode === 'contain') {
    ctx.beginPath();
    ctx.rect(photoRect.x, photoRect.y, photoRect.width, photoRect.height);
    ctx.clip();
  }
  ctx.drawImage(stamp, x - half, y - half);
  ctx.restore();
}

export type RenderRequest = {
  canvas: HTMLCanvasElement;
  image: CanvasImageSource;
  imageWidth: number;
  imageHeight: number;
  outputWidth: number;
  outputHeight: number;
  exif: ExifData;
  template: WatermarkTemplate;
  background?: string;
  backgroundMode?: 'color' | 'blur';
  blurRadius?: number;
  rotation?: CanvasRotation | null;
  makerLogo?: MakerLogo | null;
  topologyWatermark?: TopologyWatermarkRenderOptions | null;
};

export function renderWatermark({
  canvas,
  image,
  imageWidth,
  imageHeight,
  outputWidth,
  outputHeight,
  exif,
  template,
  background,
  backgroundMode,
  blurRadius,
  rotation,
  makerLogo,
  topologyWatermark,
}: RenderRequest) {
  const baseWidth = Math.max(1, Math.round(outputWidth));
  const baseHeight = Math.max(1, Math.round(outputHeight));

  const layout = template.getLayout ? template.getLayout({ baseWidth, baseHeight }) : defaultLayout(baseWidth, baseHeight);

  canvas.width = Math.max(1, Math.round(layout.canvasWidth));
  canvas.height = Math.max(1, Math.round(layout.canvasHeight));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background: blur mode draws the image covering the full canvas with blur filter
  const useBlurBg = background && backgroundMode === 'blur';
  if (useBlurBg) {
    const blurPx = Math.max(1, Math.round((blurRadius ?? 30) * (canvas.width / 1200)));
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    // Draw image covering entire canvas as background
    drawImageInRect(ctx, image, imageWidth, imageHeight, rotation, {
      rect: { x: -blurPx, y: -blurPx, width: canvas.width + blurPx * 2, height: canvas.height + blurPx * 2 },
      mode: 'cover',
    });
    ctx.filter = 'none';
    ctx.restore();
    // Darken the blur slightly for contrast
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const imageRect = layout.imageRect;
  const imageDrawMode = layout.imageDrawMode ?? 'contain';

  const renderInputBase = {
    width: canvas.width,
    height: canvas.height,
    exif,
    imageRect,
    makerLogo,
  } as const;

  template.renderBackdrop?.(ctx, renderInputBase);

  drawImageInRect(ctx, image, imageWidth, imageHeight, rotation, {
    rect: imageRect,
    mode: imageDrawMode,
    cornerRadius: layout.imageCornerRadius,
  });

  const photoRect = imageDrawMode === 'contain' ? computeImageDrawRect(imageWidth, imageHeight, rotation, imageRect, imageDrawMode) : imageRect;

  const palette = template.needsPalette ? extractPaletteFromCanvasArea(canvas, imageRect, 6) : undefined;

  if (shouldDrawTopologyWatermark(topologyWatermark)) {
    drawTopologyWatermark(ctx, {
      templateId: template.id,
      imageDrawMode,
      imageRect,
      photoRect,
      cornerRadius: layout.imageCornerRadius,
      watermark: topologyWatermark,
    });
  }

  template.render(ctx, { ...renderInputBase, palette });
  ctx.restore();
}
