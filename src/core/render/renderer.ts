import type { ExifData } from '../exif/types';
import type { CanvasRotation } from '../exif/readRotation';
import { extractPaletteFromCanvasArea } from '../image/palette';
import { roundRectPath } from './draw';
import type { ImageDrawMode, Rect, TemplateLayout, WatermarkTemplate } from './templates';

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
  rotation?: CanvasRotation | null;
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
  rotation,
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
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const imageRect = layout.imageRect;

  const renderInputBase = {
    width: canvas.width,
    height: canvas.height,
    exif,
    imageRect,
  } as const;

  template.renderBackdrop?.(ctx, renderInputBase);

  drawImageInRect(ctx, image, imageWidth, imageHeight, rotation, {
    rect: imageRect,
    mode: layout.imageDrawMode ?? 'contain',
    cornerRadius: layout.imageCornerRadius,
  });

  const palette = template.needsPalette ? extractPaletteFromCanvasArea(canvas, imageRect, 6) : undefined;

  template.render(ctx, { ...renderInputBase, palette });
  ctx.restore();
}
