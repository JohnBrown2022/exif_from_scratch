import { clamp } from '../utils/clamp';
import type { MakerLogo } from '../brand/makerLogo';
import type { ExifData } from '../exif/types';
import {
  buildWatermarkFields,
  formatAperture,
  formatCameraName,
  formatDateTime,
  formatFocalLength,
  formatISO,
  formatLensName,
  formatShutterSeconds,
} from '../exif/format';
import { fitText, rgba, roundRectPath } from './draw';

export type TemplateId =
  | 'classic_footer'
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

function setFontMono(ctx: CanvasRenderingContext2D, weight: number, sizePx: number) {
  ctx.font = `${weight} ${Math.round(sizePx)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`;
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

function buildSettingsParts(exif: ExifData): string[] {
  return [
    formatFocalLength(exif.focalLengthMm),
    formatAperture(exif.apertureFNumber),
    formatShutterSeconds(exif.exposureTimeSeconds),
    formatISO(exif.iso),
  ].filter((part): part is string => Boolean(part));
}

function formatMakeShort(exif: ExifData): string | null {
  const make = exif.make?.trim();
  if (!make) return null;
  return make.replaceAll(/\s+/g, ' ').toUpperCase();
}

function getFooterScale(width: number): number {
  return clamp(width / 1200, 0.75, 1.1);
}

function drawFooterDivider(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y);
  ctx.lineTo(x + 0.5, y + h);
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawMakerLogo(
  ctx: CanvasRenderingContext2D,
  logo: MakerLogo,
  anchorX: number,
  anchorY: number,
  maxWidth: number,
  maxHeight: number,
  options?: {
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    opacity?: number;
  },
): { width: number; height: number } {
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
  const width = Math.max(1, Math.round(logo.width * scale));
  const height = Math.max(1, Math.round(logo.height * scale));

  let x = anchorX;
  if (options?.align === 'center') x -= width / 2;
  if (options?.align === 'right') x -= width;

  let y = anchorY;
  if (options?.valign === 'middle') y -= height / 2;
  if (options?.valign === 'bottom') y -= height;

  ctx.save();
  if (typeof options?.opacity === 'number') ctx.globalAlpha *= clamp(options.opacity, 0, 1);
  ctx.drawImage(logo.source, Math.round(x), Math.round(y), width, height);
  ctx.restore();

  return { width, height };
}

const classicFooter: WatermarkTemplate = {
  id: 'classic_footer',
  name: '经典白底栏',
  description: '图 + 白色底栏（左右信息 + 中间品牌标记）。',
  getLayout: ({ baseWidth, baseHeight }) => {
    const scale = getFooterScale(baseWidth);
    const footerHeight = Math.round(clamp(60 * scale, 52, 86));
    return {
      canvasWidth: baseWidth,
      canvasHeight: baseHeight + footerHeight,
      imageRect: { x: 0, y: 0, width: baseWidth, height: baseHeight },
      imageDrawMode: 'contain',
    };
  },
  render: (ctx, input) => {
    const { width, height, exif, imageRect, makerLogo } = input;
    const footerY = imageRect.y + imageRect.height;
    const footerHeight = height - footerY;
    const scale = getFooterScale(width);
    const padding = Math.round(12 * scale);

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillRect(0, footerY, width, footerHeight);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, footerY, width, 1);

    const camera = formatCameraName(exif) ?? '相机';
    const lens = formatLensName(exif);
    const make = formatMakeShort(exif) ?? 'EXIF';

    const titleSize = clamp(20 * scale, 14, 22);
    const subSize = clamp(13 * scale, 10, 16);
    const metaSize = clamp(14 * scale, 11, 16);

    // Left group
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    setFont(ctx, 750, titleSize);
    const leftTop = footerY + Math.round((footerHeight - (titleSize + subSize + 6 * scale)) / 2);
    const leftMax = Math.round(width * 0.44);
    ctx.fillStyle = 'rgba(20,20,22,0.92)';
    ctx.fillText(fitText(ctx, camera, leftMax), padding, leftTop);

    if (lens) {
      setFont(ctx, 650, subSize);
      ctx.fillStyle = 'rgba(60,60,66,0.62)';
      ctx.fillText(fitText(ctx, lens, leftMax), padding, Math.round(leftTop + titleSize + 6 * scale));
    }

    // Right group
    const parts = buildSettingsParts(exif);
    const rightText = parts.length ? parts.join(' | ') : '—';
    setFont(ctx, 700, metaSize);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(20,20,22,0.9)';
    const rightMax = Math.round(width * 0.44);
    const rightTop = footerY + Math.round((footerHeight - metaSize) / 2);
    ctx.fillText(fitText(ctx, rightText, rightMax), width - padding, rightTop);

    // Center brand marker (only if there is space)
    const centerY = footerY + footerHeight / 2;
    if (makerLogo) {
      drawMakerLogo(ctx, makerLogo, width / 2, centerY, Math.round(width * 0.18), Math.round(footerHeight * 0.38), {
        align: 'center',
        valign: 'middle',
        opacity: 0.55,
      });
    } else {
      const centerTop = footerY + Math.round((footerHeight - metaSize) / 2);
      ctx.textAlign = 'center';
      setFont(ctx, 700, clamp(12 * scale, 10, 14));
      ctx.fillStyle = 'rgba(20,20,22,0.46)';
      ctx.fillText(make, width / 2, centerTop + 1);
    }

    ctx.restore();
  },
};

const ezmarkCard: WatermarkTemplate = {
  id: 'ezmark_card',
  name: 'EZMark 卡片',
  description: '圆角卡片 + 白色信息条 + 色卡（主色提取）。',
  needsPalette: true,
  getLayout: ({ baseWidth, baseHeight }) => {
    const scale = clamp(baseWidth / 900, 0.75, 1.15);
    const outer = Math.round(clamp(18 * scale, 12, 30));
    const footerHeight = Math.round(clamp(112 * scale, 90, 190));
    const canvasWidth = baseWidth + outer * 2;
    const canvasHeight = baseHeight + footerHeight + outer * 2;
    const radius = Math.round(clamp(18 * scale, 14, 28));
    return {
      canvasWidth,
      canvasHeight,
      imageRect: { x: outer, y: outer, width: baseWidth, height: baseHeight },
      imageDrawMode: 'contain',
      imageCornerRadius: radius,
    };
  },
  renderBackdrop: (ctx, input) => {
    const { imageRect, height } = input;
    const footerY = imageRect.y + imageRect.height;
    const footerHeight = height - footerY - imageRect.y;
    const cardX = imageRect.x;
    const cardY = imageRect.y;
    const cardW = imageRect.width;
    const cardH = imageRect.height + footerHeight;
    const radius = clamp(Math.min(cardW, cardH) * 0.02, 14, 28);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = Math.max(10, radius * 1.1);
    ctx.shadowOffsetY = Math.max(6, radius * 0.45);
    roundRectPath(ctx, cardX, cardY, cardW, cardH, radius);
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fill();
    ctx.restore();
  },
  render: (ctx, input) => {
    const { exif, imageRect, height, palette, makerLogo } = input;
    const footerY = imageRect.y + imageRect.height;
    const footerHeight = height - footerY - imageRect.y;
    const scale = clamp(imageRect.width / 900, 0.75, 1.15);
    const padding = Math.round(clamp(16 * scale, 12, 22));

    // Divider between image and footer
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(imageRect.x, footerY, imageRect.width, 1);

    const camera = formatCameraName(exif) ?? '相机';
    const taken = formatDateTime(exif.takenAt);
    const make = formatMakeShort(exif);
    const parts = buildSettingsParts(exif);

    const titleSize = clamp(18 * scale, 14, 22);
    const subSize = clamp(12 * scale, 10, 15);

    const leftX = imageRect.x + padding;
    const rightX = imageRect.x + imageRect.width - padding;
    const baseTop = footerY + padding;

    // Left column
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    setFont(ctx, 750, titleSize);
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillText(fitText(ctx, camera, imageRect.width * 0.54), leftX, baseTop);

    if (taken) {
      setFont(ctx, 650, subSize);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillText(fitText(ctx, taken, imageRect.width * 0.54), leftX, baseTop + Math.round(titleSize + 6 * scale));
    }

    // Right block: make label + divider + settings + swatches
    const settingsText = parts.length ? parts.join('  ') : '—';

    // Make label (acts as logo)
    let labelWidth = 0;
    if (makerLogo) {
      const drawn = drawMakerLogo(
        ctx,
        makerLogo,
        rightX,
        baseTop + Math.round(2 * scale),
        Math.round(140 * scale),
        Math.round(22 * scale),
        { align: 'right', valign: 'top', opacity: 0.82 },
      );
      labelWidth = drawn.width;
    } else if (make) {
      setFont(ctx, 800, clamp(12 * scale, 10, 14));
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.textAlign = 'right';
      ctx.fillText(make, rightX, baseTop + 1);
      labelWidth = ctx.measureText(make).width;
    }

    if (labelWidth > 0) {
      drawFooterDivider(ctx, Math.round(rightX - labelWidth - 10 * scale), baseTop - 2, Math.round(44 * scale));
    }

    // Settings row
    ctx.textAlign = 'right';
    setFont(ctx, 650, subSize);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillText(fitText(ctx, settingsText, imageRect.width * 0.46), rightX, baseTop + Math.round(20 * scale));

    // Swatches
    const swatches = (palette ?? []).slice(0, 4);
    if (swatches.length) {
      const r = Math.round(clamp(7 * scale, 6, 9));
      const gap = Math.round(clamp(8 * scale, 6, 12));
      let x = rightX - (swatches.length * r * 2 + (swatches.length - 1) * gap);
      const y = footerY + footerHeight - padding - r * 2;

      for (const color of swatches) {
        ctx.beginPath();
        ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
        x += r * 2 + gap;
      }
    }

    ctx.restore();
  },
};

const picsealBanner: WatermarkTemplate = {
  id: 'picseal_banner',
  name: 'Picseal 横幅',
  description: '底部横幅（两列 + 竖分隔线 + 右侧品牌标记）。',
  getLayout: ({ baseWidth, baseHeight }) => {
    const scale = clamp(baseWidth / 1000, 0.75, 1.15);
    const footerHeight = Math.round(clamp(86 * scale, 70, 120));
    return {
      canvasWidth: baseWidth,
      canvasHeight: baseHeight + footerHeight,
      imageRect: { x: 0, y: 0, width: baseWidth, height: baseHeight },
      imageDrawMode: 'contain',
    };
  },
  render: (ctx, input) => {
    const { exif, imageRect, width, height, makerLogo } = input;
    const footerY = imageRect.y + imageRect.height;
    const footerHeight = height - footerY;
    const scale = clamp(width / 1000, 0.75, 1.15);
    const padding = Math.round(clamp(20 * scale, 14, 28));

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillRect(0, footerY, width, footerHeight);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, footerY, width, 1);

    const camera = formatCameraName(exif) ?? '相机';
    const date = formatDateTime(exif.takenAt);
    const lens = formatLensName(exif) ?? '镜头';
    const settings = buildSettingsParts(exif).join(' · ');
    const make = formatMakeShort(exif) ?? 'EXIF';

    const titleSize = clamp(18 * scale, 14, 22);
    const subSize = clamp(12 * scale, 10, 15);

    const centerX = width / 2;

    // Split line
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    const splitH = Math.round(clamp(42 * scale, 34, 58));
    ctx.fillRect(Math.round(centerX), footerY + Math.round((footerHeight - splitH) / 2), 2, splitH);

    // Left column
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    setFont(ctx, 800, titleSize);
    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    ctx.fillText(fitText(ctx, camera, width * 0.44), padding, footerY + padding);

    if (date) {
      setFont(ctx, 650, subSize);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillText(fitText(ctx, date, width * 0.44), padding, footerY + padding + Math.round(titleSize + 6 * scale));
    }

    // Right column
    const rightX = Math.round(centerX + padding);
    setFont(ctx, 800, titleSize);
    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    ctx.fillText(fitText(ctx, lens, width * 0.36), rightX, footerY + padding);

    setFont(ctx, 650, subSize);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillText(fitText(ctx, settings || '—', width * 0.36), rightX, footerY + padding + Math.round(titleSize + 6 * scale));

    // Brand marker at far right
    const brandX = width - padding;
    const brandY = footerY + footerHeight / 2;
    if (makerLogo) {
      drawMakerLogo(ctx, makerLogo, brandX, brandY, Math.round(width * 0.2), Math.round(footerHeight * 0.62), {
        align: 'right',
        valign: 'middle',
        opacity: 0.26,
      });
    } else {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      setFont(ctx, 900, clamp(22 * scale, 18, 28));
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillText(make, brandX, brandY);
    }

    ctx.restore();
  },
};

const lightroomFooter: WatermarkTemplate = {
  id: 'lightroom_footer',
  name: 'Lightroom 底栏',
  description: '底部三段信息（左参数 / 中机身镜头 / 右日期）。',
  render: (ctx, input) => {
    const { width, height, exif } = input;
    const scale = clamp(Math.min(width, height) / 1400, 0.75, 1.15);
    const barHeight = Math.round(clamp(86 * scale, 64, 140));
    const y = height - barHeight;
    const padding = Math.round(clamp(18 * scale, 14, 28));
    const fontSize = clamp(15 * scale, 12, 18);

    const settings = buildSettingsParts(exif).join('  ');
    const camera = formatCameraName(exif);
    const lens = formatLensName(exif);
    const center = [camera, lens].filter((v): v is string => Boolean(v)).join(' · ') || '—';
    const date = formatDateTime(exif.takenAt) || '';

    ctx.save();
    // subtle gradient bar
    const g = ctx.createLinearGradient(0, y, 0, height);
    g.addColorStop(0, 'rgba(0,0,0,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, width, barHeight);

    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    setFont(ctx, 650, fontSize);

    const midY = y + barHeight / 2 + 1;
    const max = Math.round(width * 0.32);

    // left
    ctx.textAlign = 'left';
    ctx.fillText(fitText(ctx, settings || '—', max), padding, midY);

    // center
    ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, center, Math.round(width * 0.46)), width / 2, midY);

    // right
    ctx.textAlign = 'right';
    ctx.fillText(fitText(ctx, date, max), width - padding, midY);

    ctx.restore();
  },
};

const monitorBar: WatermarkTemplate = {
  id: 'monitor_bar',
  name: 'Monitor 底栏',
  description: '均分显示核心参数（偏极简显示器风格）。',
  render: (ctx, input) => {
    const { width, height, exif } = input;
    const scale = clamp(Math.min(width, height) / 1400, 0.75, 1.15);
    const barHeight = Math.round(clamp(66 * scale, 50, 110));
    const y = height - barHeight;
    const fontSize = clamp(15 * scale, 12, 18);

    const items = buildSettingsParts(exif);
    const visible = items.length ? items : ['—'];

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, y, width, barHeight);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textBaseline = 'middle';
    setFontMono(ctx, 700, fontSize);

    const midY = y + barHeight / 2 + 1;
    const n = visible.length;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * width;
      ctx.textAlign = 'center';
      ctx.fillText(visible[i]!, x, midY);
    }
    ctx.restore();
  },
};

const shotOn: WatermarkTemplate = {
  id: 'shot_on',
  name: 'Shot on',
  description: '底部标语 + 参数（适合社交分享）。',
  render: (ctx, input) => {
    const { width, height, exif } = input;
    const scale = clamp(Math.min(width, height) / 1400, 0.75, 1.15);
    const barHeight = Math.round(clamp(84 * scale, 64, 140));
    const y = height - barHeight;
    const padding = Math.round(clamp(18 * scale, 14, 28));
    const titleSize = clamp(18 * scale, 14, 22);
    const subSize = clamp(12 * scale, 10, 16);

    const camera = formatCameraName(exif) ?? 'Unknown Camera';
    const settings = buildSettingsParts(exif).join(' · ');

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.46)';
    ctx.fillRect(0, y, width, barHeight);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    setFont(ctx, 850, titleSize);
    ctx.fillText(fitText(ctx, `SHOT ON ${camera}`, width - padding * 2), padding, y + padding);

    if (settings) {
      setFont(ctx, 650, subSize);
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillText(fitText(ctx, settings, width - padding * 2), padding, y + padding + Math.round(titleSize + 8 * scale));
    }

    ctx.restore();
  },
};

const cinemascope: WatermarkTemplate = {
  id: 'cinemascope',
  name: 'Cinemascope',
  description: '电影宽银幕（2.39:1，cover 裁切）。',
  getLayout: ({ baseWidth }) => {
    const targetH = Math.max(1, Math.round(baseWidth / 2.39));
    return {
      canvasWidth: baseWidth,
      canvasHeight: targetH,
      imageRect: { x: 0, y: 0, width: baseWidth, height: targetH },
      imageDrawMode: 'cover',
    };
  },
  render: (ctx) => {
    // Intentionally minimal: the draw mode + ratio is the effect.
    void ctx;
  },
};

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

export const WATERMARK_TEMPLATES: WatermarkTemplate[] = [
  classicFooter,
  ezmarkCard,
  picsealBanner,
  lightroomFooter,
  monitorBar,
  shotOn,
  cinemascope,
  bottomBar,
  infoBlock,
  film,
  minimalCorner,
];

export function getTemplateById(id: TemplateId): WatermarkTemplate {
  const found = WATERMARK_TEMPLATES.find((template) => template.id === id);
  return found ?? WATERMARK_TEMPLATES[0]!;
}
