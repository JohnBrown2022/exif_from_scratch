import type { ExifData } from '../exif/types';
import type { CanvasRotation } from '../exif/readRotation';
import type { WatermarkTemplate } from './templates';

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
  canvas.width = Math.max(1, Math.round(outputWidth));
  canvas.height = Math.max(1, Math.round(outputHeight));
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

  const shouldTransform = Boolean(
    rotation?.canvas &&
      (rotation.rad !== 0 || rotation.scaleX !== 1 || rotation.scaleY !== 1 || rotation.dimensionSwapped),
  );

  const orientedWidth = shouldTransform && rotation?.dimensionSwapped ? imageHeight : imageWidth;
  const orientedHeight = shouldTransform && rotation?.dimensionSwapped ? imageWidth : imageHeight;

  const scale = Math.min(canvas.width / orientedWidth, canvas.height / orientedHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (shouldTransform && rotation) {
    ctx.rotate(rotation.rad);
    ctx.scale(rotation.scaleX, rotation.scaleY);
  }
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  template.render(ctx, { width: canvas.width, height: canvas.height, exif });
  ctx.restore();
}
