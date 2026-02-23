import { clamp } from '../utils/clamp';
import type { ExifData } from '../exif/types';
import { buildWatermarkFields } from '../exif/format';
import { fitText, rgba, roundRectPath } from './draw';

export type TemplateId = 'bottom_bar' | 'info_block' | 'film' | 'minimal_corner';

export type WatermarkTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  render: (ctx: CanvasRenderingContext2D, input: TemplateRenderInput) => void;
};

export type TemplateRenderInput = {
  width: number;
  height: number;
  exif: ExifData;
};

function getLines(exif: ExifData): string[] {
  const fields = buildWatermarkFields(exif);
  const primary = fields.camera;
  const secondary = [fields.lens, fields.settings].filter((v): v is string => Boolean(v)).join(' · ');
  const tertiary = fields.date;

  const lines = [primary, secondary || null, tertiary].filter(
    (v): v is string => Boolean(v && v.trim().length > 0),
  );

  return lines.length > 0 ? lines : ['无 EXIF'];
}

function setFont(ctx: CanvasRenderingContext2D, weight: number, sizePx: number) {
  ctx.font = `${weight} ${Math.round(sizePx)}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial`;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  maxWidth: number,
  baseSize: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const lineHeight = Math.round(baseSize * 1.25);
  lines.forEach((line, idx) => {
    const size = idx === 0 ? baseSize * 1.05 : baseSize * 0.92;
    const weight = idx === 0 ? 650 : 500;
    setFont(ctx, weight, size);
    const fitted = fitText(ctx, line, maxWidth);
    ctx.fillText(fitted, x, y + idx * lineHeight);
  });
}

const bottomBar: WatermarkTemplate = {
  id: 'bottom_bar',
  name: '底部黑条',
  description: '信息集中展示，适合大多数照片。',
  render: (ctx, input) => {
    const { width, height } = input;
    const lines = getLines(input.exif);

    const base = clamp(Math.min(width, height) * 0.028, 14, 34);
    const barHeight = clamp(height * 0.14, 88, 220);
    const padding = Math.round(barHeight * 0.18);
    const left = padding;
    const top = height - barHeight + padding;
    const rightPadding = padding;
    const maxWidth = width - left - rightPadding;

    ctx.save();
    ctx.fillStyle = rgba({ r: 0, g: 0, b: 0, a: 0.55 });
    ctx.fillRect(0, height - barHeight, width, barHeight);

    drawLines(ctx, lines.slice(0, 3), left, top, maxWidth, base, rgba({ r: 255, g: 255, b: 255, a: 0.94 }));
    ctx.restore();
  },
};

const infoBlock: WatermarkTemplate = {
  id: 'info_block',
  name: '左下角信息块',
  description: '更克制的背景块，遮挡更少。',
  render: (ctx, input) => {
    const { width, height } = input;
    const lines = getLines(input.exif);

    const base = clamp(Math.min(width, height) * 0.026, 13, 30);
    const margin = clamp(Math.min(width, height) * 0.03, 16, 44);
    const padding = clamp(base * 0.9, 10, 24);
    const radius = clamp(base * 0.9, 10, 22);

    const maxWidth = Math.min(width * 0.62, 720);
    const lineHeight = Math.round(base * 1.25);
    const contentHeight = lines.slice(0, 4).length * lineHeight;
    const blockWidth = maxWidth;
    const blockHeight = contentHeight + padding * 2;
    const x = margin;
    const y = height - margin - blockHeight;

    ctx.save();
    roundRectPath(ctx, x, y, blockWidth, blockHeight, radius);
    ctx.fillStyle = rgba({ r: 0, g: 0, b: 0, a: 0.42 });
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255, a: 0.16 });
    ctx.stroke();

    drawLines(
      ctx,
      lines.slice(0, 4),
      x + padding,
      y + padding,
      blockWidth - padding * 2,
      base,
      rgba({ r: 255, g: 255, b: 255, a: 0.94 }),
    );
    ctx.restore();
  },
};

const film: WatermarkTemplate = {
  id: 'film',
  name: '胶片风',
  description: '白色边框 + 底部信息条。',
  render: (ctx, input) => {
    const { width, height } = input;
    const lines = getLines(input.exif);

    const base = clamp(Math.min(width, height) * 0.024, 12, 28);
    const frame = clamp(Math.min(width, height) * 0.02, 14, 48);
    const barHeight = clamp(height * 0.18, 110, 280);

    ctx.save();
    // White frame
    ctx.lineWidth = frame;
    ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255, a: 0.92 });
    ctx.strokeRect(frame / 2, frame / 2, width - frame, height - frame);

    // Bottom strip
    ctx.fillStyle = rgba({ r: 255, g: 255, b: 255, a: 0.9 });
    ctx.fillRect(0, height - barHeight, width, barHeight);

    const padding = clamp(base * 1.25, 14, 34);
    ctx.fillStyle = rgba({ r: 0, g: 0, b: 0, a: 0.85 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    setFont(ctx, 650, base * 1.05);
    const first = fitText(ctx, lines[0] ?? '', width - padding * 2);
    ctx.fillText(first, padding, height - barHeight + padding);

    setFont(ctx, 500, base * 0.92);
    const rest = lines.slice(1, 3).join(' · ');
    if (rest) {
      const fitted = fitText(ctx, rest, width - padding * 2);
      ctx.fillText(fitted, padding, height - barHeight + padding + Math.round(base * 1.35));
    }

    ctx.restore();
  },
};

const minimalCorner: WatermarkTemplate = {
  id: 'minimal_corner',
  name: '极简角标',
  description: '不画背景，仅文字与轻微阴影。',
  render: (ctx, input) => {
    const { width, height } = input;
    const lines = getLines(input.exif);
    const base = clamp(Math.min(width, height) * 0.024, 12, 26);
    const margin = clamp(Math.min(width, height) * 0.03, 16, 44);

    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = rgba({ r: 0, g: 0, b: 0, a: 0.55 });
    ctx.shadowBlur = base * 0.9;
    ctx.shadowOffsetY = base * 0.25;

    const maxWidth = width - margin * 2;
    const x = width - margin;
    let y = height - margin;

    const toDraw = lines.slice(0, 3).reverse();
    toDraw.forEach((line, idx) => {
      const size = idx === 0 ? base * 0.92 : base * 0.82;
      const weight = idx === 0 ? 650 : 500;
      setFont(ctx, weight, size);
      const fitted = fitText(ctx, line, maxWidth);
      ctx.fillStyle = rgba({ r: 255, g: 255, b: 255, a: 0.92 });
      ctx.fillText(fitted, x, y);
      y -= Math.round(base * 1.18);
    });

    ctx.restore();
  },
};

export const WATERMARK_TEMPLATES: WatermarkTemplate[] = [bottomBar, infoBlock, film, minimalCorner];

export function getTemplateById(id: TemplateId): WatermarkTemplate {
  const found = WATERMARK_TEMPLATES.find((template) => template.id === id);
  return found ?? WATERMARK_TEMPLATES[0]!;
}

