import type { ExifData } from '../exif/types';
import type { CanvasRotation } from '../exif/readRotation';
import type { MakerLogo } from '../brand/makerLogo';
import type { TopologyWatermarkSettings } from '../watermark/types';
import type { WatermarkTemplate } from './templates';

import { createLegacyProjectV2 } from '../project/legacyAdapter';
import { renderProject } from '../project/pipeline';

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
  topologyWatermark?: TopologyWatermarkSettings | null;
  seeds?: {
    fileMd5?: string | null;
    fallback?: string;
  };
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
  seeds,
}: RenderRequest) {
  const baseWidth = Math.max(1, Math.round(outputWidth));
  const baseHeight = Math.max(1, Math.round(outputHeight));

  const project = createLegacyProjectV2({
    templateId: template.id,
    background,
    backgroundMode,
    blurRadius,
    topologyWatermark,
  });

  renderProject({
    canvas,
    project,
    env: {
      canvas: { width: baseWidth, height: baseHeight },
      image: { source: image, width: imageWidth, height: imageHeight, rotation },
      exif,
      makerLogo,
      seeds: { fileMd5: seeds?.fileMd5 ?? null, fallback: seeds?.fallback ?? 'default' },
    },
    baseWidth,
    baseHeight,
  });
}
