import type { MakerLogo } from '../brand/makerLogo';
import type { ExifData } from '../exif/types';

import { listBuiltinTemplateJson } from './engine/builtins';
import { createWatermarkTemplateFromDefinition } from './engine/wrapTemplate';

export type TemplateId = string;

export type Rect = { x: number; y: number; width: number; height: number };

export type ImageDrawMode = 'contain' | 'cover';

export type TemplateLayoutInput = {
  baseWidth: number;
  baseHeight: number;
};

export type TemplateLayout = {
  canvasWidth: number;
  canvasHeight: number;
  imageRect: Rect;
  imageDrawMode?: ImageDrawMode;
  imageCornerRadius?: number;
};

export type WatermarkTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  needsPalette?: boolean;
  getLayout?: (input: TemplateLayoutInput) => TemplateLayout;
  renderBackdrop?: (ctx: CanvasRenderingContext2D, input: TemplateRenderInput) => void;
  render: (ctx: CanvasRenderingContext2D, input: TemplateRenderInput) => void;
};

export type TemplateRenderInput = {
  width: number;
  height: number;
  exif: ExifData;
  imageRect: Rect;
  palette?: string[];
  makerLogo?: MakerLogo | null;
};

export const WATERMARK_TEMPLATES: WatermarkTemplate[] = listBuiltinTemplateJson().map((json) =>
  createWatermarkTemplateFromDefinition(json),
);

export function getTemplateById(id: TemplateId): WatermarkTemplate {
  const found = WATERMARK_TEMPLATES.find((template) => template.id === id);
  return found ?? WATERMARK_TEMPLATES[0]!;
}
