import type { MakerLogo } from '../brand/makerLogo';
import type { ExifData } from '../exif/types';

import { getBuiltinTemplateJson } from './engine/builtins';
import { createWatermarkTemplateFromDefinition } from './engine/wrapTemplate';

export type TemplateId =
  | 'classic_footer'
  | 'customed'
  | 'ezmark_card'
  | 'picseal_banner'
  | 'lightroom_footer'
  | 'monitor_bar'
  | 'shot_on'
  | 'cinemascope'
  | 'bottom_bar'
  | 'info_block'
  | 'film'
  | 'minimal_corner';

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

function builtin(id: TemplateId): WatermarkTemplate {
  const json = getBuiltinTemplateJson(id);
  if (!json) throw new Error(`Builtin template "${id}" not found`);
  return createWatermarkTemplateFromDefinition(json);
}

export const WATERMARK_TEMPLATES: WatermarkTemplate[] = [
  builtin('classic_footer'),
  builtin('customed'),
  builtin('ezmark_card'),
  builtin('picseal_banner'),
  builtin('lightroom_footer'),
  builtin('monitor_bar'),
  builtin('shot_on'),
  builtin('cinemascope'),
  builtin('bottom_bar'),
  builtin('info_block'),
  builtin('film'),
  builtin('minimal_corner'),
];

export function getTemplateById(id: TemplateId): WatermarkTemplate {
  const found = WATERMARK_TEMPLATES.find((template) => template.id === id);
  return found ?? WATERMARK_TEMPLATES[0]!;
}
