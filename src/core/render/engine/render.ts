import type { MakerLogo } from '../../brand/makerLogo';
import type { ExifData } from '../../exif/types';
import { clamp } from '../../utils/clamp';
import { fitText, roundRectPath } from '../draw';
import type { Rect } from '../templates';

import { resolveTextBinding } from './bindings';
import { rectFromGrid, resolveGrid } from './grid';
import type {
  ConditionSpec,
  Dimension,
  ElementSpec,
  EngineContext,
  LogoStyle,
  RectElement,
  StackElement,
  TemplateJson,
  TextElement,
} from './types';
import { resolveDimension } from './values';

function rectCenterX(r: Rect): number {
  return r.x + r.width / 2;
}

function rectCenterY(r: Rect): number {
  return r.y + r.height / 2;
}

function applyOpacity(ctx: CanvasRenderingContext2D, opacity: number | undefined) {
  if (typeof opacity !== 'number') return;
  ctx.globalAlpha *= clamp(opacity, 0, 1);
}

function setFont(ctx: CanvasRenderingContext2D, family: 'sans' | 'mono', weight: number, sizePx: number) {
  const base =
    family === 'mono'
      ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
      : "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial";
  ctx.font = `${Math.round(weight)} ${Math.round(sizePx)}px ${base}`;
}

function resolveSize(size: Dimension | undefined, scale: number, fallback: number): number {
  return Math.max(1, resolveDimension(size, scale, fallback));
}

function shouldRenderByCondition(condition: ConditionSpec | undefined, ctx: EngineContext): boolean {
  if (!condition) return true;
  if (condition.showWhenMakerLogoPresent && !ctx.makerLogo) return false;
  if (condition.showWhenMakerLogoMissing && ctx.makerLogo) return false;
  if (condition.showWhenPalettePresent && (!ctx.palette || ctx.palette.length === 0)) return false;
  return true;
}

function isElementVisible(el: ElementSpec, ctx: EngineContext): boolean {
  if (!shouldRenderByCondition(el.condition, ctx)) return false;

  if (el.type === 'text') {
    const text = resolveTextBinding(ctx.exif, el.bind);
    if (el.condition?.hideWhenEmpty && (!text || !text.trim().length)) return false;
  }

  if (el.type === 'maker_logo') {
    if (!ctx.makerLogo) return false;
  }

  if (el.type === 'swatches') {
    if (!ctx.palette || ctx.palette.length === 0) return false;
  }

  return true;
}

const monoLogoCache = new Map<string, HTMLCanvasElement>();

function getLogoSrcId(logo: MakerLogo): string {
  const source = logo.source;
  if (source && typeof source === 'object' && 'src' in source) {
    const src = (source as { src?: unknown }).src;
    if (typeof src === 'string') return src;
  }
  return 'logo';
}

function makeMonoLogoCanvas(logo: MakerLogo, width: number, height: number, color: string): HTMLCanvasElement {
  const id = `${getLogoSrcId(logo)}|${width}x${height}|${color}`;
  const cached = monoLogoCache.get(id);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(logo.source, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';

  monoLogoCache.set(id, canvas);
  return canvas;
}

function computeAnchorX(rect: Rect, align: 'left' | 'center' | 'right'): number {
  if (align === 'left') return rect.x;
  if (align === 'right') return rect.x + rect.width;
  return rectCenterX(rect);
}

function computeAnchorY(rect: Rect, vAlign: 'top' | 'middle' | 'bottom'): number {
  if (vAlign === 'top') return rect.y;
  if (vAlign === 'bottom') return rect.y + rect.height;
  return rectCenterY(rect);
}

function drawTextElement(ctx2d: CanvasRenderingContext2D, el: TextElement, box: Rect, ctx: EngineContext): void {
  const text = resolveTextBinding(ctx.exif, el.bind);
  if (el.condition?.hideWhenEmpty && (!text || !text.trim().length)) return;

  ctx2d.save();
  applyOpacity(ctx2d, el.style.opacity);

  const fontFamily = el.style.font ?? 'sans';
  const fontWeight = el.style.weight ?? 600;
  const fontSize = resolveSize(el.style.size, ctx.scale, 14);
  setFont(ctx2d, fontFamily, fontWeight, fontSize);

  const align = el.style.align ?? 'left';
  const vAlign = el.style.vAlign ?? 'top';

  ctx2d.textAlign = align;
  ctx2d.textBaseline = vAlign === 'top' ? 'top' : vAlign === 'bottom' ? 'bottom' : 'middle';
  ctx2d.fillStyle = el.style.color ?? 'rgba(255,255,255,0.92)';

  const maxWidth = Math.max(1, Math.round(box.width));
  const fitted = fitText(ctx2d, text ?? '', maxWidth);
  ctx2d.fillText(fitted, computeAnchorX(box, align), computeAnchorY(box, vAlign));

  ctx2d.restore();
}

function drawRectElement(ctx2d: CanvasRenderingContext2D, el: RectElement, box: Rect, ctx: EngineContext): void {
  ctx2d.save();
  applyOpacity(ctx2d, el.style.opacity);

  const radius = resolveDimension(el.style.radius, ctx.scale, 0);
  if (radius > 0) {
    roundRectPath(ctx2d, box.x, box.y, box.width, box.height, radius);
    ctx2d.fillStyle = el.style.fill;
    ctx2d.fill();
  } else {
    ctx2d.fillStyle = el.style.fill;
    ctx2d.fillRect(box.x, box.y, box.width, box.height);
  }

  ctx2d.restore();
}

function drawDivider(ctx2d: CanvasRenderingContext2D, el: Extract<ElementSpec, { type: 'divider' }>, zoneBox: Rect, ctx: EngineContext) {
  const orientation = el.orientation ?? 'horizontal';
  const thickness = Math.max(1, resolveDimension(el.style.thickness, ctx.scale, 1));

  let box: Rect;
  if (el.grid) {
    box = zoneBox;
  } else if (orientation === 'horizontal') {
    const position = el.position ?? 'top';
    const y =
      position === 'bottom'
        ? zoneBox.y + zoneBox.height - thickness
        : position === 'center'
          ? zoneBox.y + Math.round((zoneBox.height - thickness) / 2)
          : zoneBox.y;
    box = { x: zoneBox.x, y, width: zoneBox.width, height: thickness };
  } else {
    const position = el.position ?? 'left';
    const x =
      position === 'right'
        ? zoneBox.x + zoneBox.width - thickness
        : position === 'center'
          ? zoneBox.x + Math.round((zoneBox.width - thickness) / 2)
          : zoneBox.x;
    box = { x, y: zoneBox.y, width: thickness, height: zoneBox.height };
  }

  ctx2d.save();
  applyOpacity(ctx2d, el.style.opacity);
  ctx2d.fillStyle = el.style.color;
  ctx2d.fillRect(box.x, box.y, box.width, box.height);
  ctx2d.restore();
}

function drawMakerLogo(ctx2d: CanvasRenderingContext2D, style: LogoStyle, box: Rect, ctx: EngineContext) {
  const logo = ctx.makerLogo;
  if (!logo) return;

  const maxW = resolveDimension(style.maxWidth, ctx.scale, box.width);
  const maxH = resolveDimension(style.maxHeight, ctx.scale, box.height);

  const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
  const drawW = Math.max(1, Math.round(logo.width * scale));
  const drawH = Math.max(1, Math.round(logo.height * scale));

  const align = style.align ?? 'left';
  const vAlign = style.vAlign ?? 'top';
  const anchorX = computeAnchorX(box, align);
  const anchorY = computeAnchorY(box, vAlign);

  let x = anchorX;
  if (align === 'center') x -= drawW / 2;
  if (align === 'right') x -= drawW;

  let y = anchorY;
  if (vAlign === 'middle') y -= drawH / 2;
  if (vAlign === 'bottom') y -= drawH;

  ctx2d.save();
  applyOpacity(ctx2d, style.opacity);

  if ((style.style ?? 'color') === 'mono') {
    const color = style.monoColor && style.monoColor.trim().length ? style.monoColor : '#ffffff';
    const mono = makeMonoLogoCanvas(logo, drawW, drawH, color);
    ctx2d.drawImage(mono, Math.round(x), Math.round(y), drawW, drawH);
  } else {
    ctx2d.drawImage(logo.source, Math.round(x), Math.round(y), drawW, drawH);
  }

  ctx2d.restore();
}

function drawSwatches(ctx2d: CanvasRenderingContext2D, el: Extract<ElementSpec, { type: 'swatches' }>, box: Rect, ctx: EngineContext) {
  const palette = ctx.palette ?? [];
  if (!palette.length) return;

  const count = clamp(el.count ?? 4, 1, 10);
  const colors = palette.slice(0, count);
  if (!colors.length) return;

  const radius = resolveDimension(el.style?.radius, ctx.scale, 7);
  const gap = resolveDimension(el.style?.gap, ctx.scale, 8);
  const stroke = el.style?.stroke ?? 'rgba(0,0,0,0.12)';

  const total = colors.length * radius * 2 + (colors.length - 1) * gap;
  const startX = box.x + box.width - total;
  const y = box.y;

  ctx2d.save();
  applyOpacity(ctx2d, el.style?.opacity);

  let x = startX;
  for (const color of colors) {
    ctx2d.beginPath();
    ctx2d.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
    ctx2d.fillStyle = color;
    ctx2d.fill();
    ctx2d.strokeStyle = stroke;
    ctx2d.lineWidth = 1;
    ctx2d.stroke();
    x += radius * 2 + gap;
  }

  ctx2d.restore();
}

function renderStack(ctx2d: CanvasRenderingContext2D, el: StackElement, box: Rect, ctx: EngineContext) {
  const direction = el.direction ?? 'vertical';
  const gap = resolveDimension(el.gap, ctx.scale, 8);
  const align = el.align ?? 'left';
  const vAlign = el.vAlign ?? 'top';

  const visibleChildren = el.children.filter((child) => isElementVisible(child, ctx));
  if (!visibleChildren.length) return;

  if (direction === 'horizontal') {
    // Not needed in current migrated templates; keep as simple left-to-right stack.
    let x = box.x;
    for (const child of visibleChildren) {
      const childBox = { x, y: box.y, width: box.width - (x - box.x), height: box.height };
      renderElement(ctx2d, child, childBox, ctx, { inheritedAlign: align, inheritedVAlign: vAlign });
      x += gap;
    }
    return;
  }

  // Vertical stack: compute intrinsic heights
  const heights: number[] = [];
  for (const child of visibleChildren) {
    if (child.type === 'text') {
      const fontSize = resolveSize(child.style.size, ctx.scale, 14);
      const lineHeight = child.style.lineHeight ?? 1.25;
      heights.push(Math.round(fontSize * lineHeight));
    } else if (child.type === 'maker_logo') {
      const maxH = resolveDimension(child.style.maxHeight, ctx.scale, box.height);
      heights.push(Math.max(1, Math.round(maxH)));
    } else if (child.type === 'swatches') {
      const r = resolveDimension(child.style?.radius, ctx.scale, 7);
      heights.push(Math.max(1, Math.round(r * 2)));
    } else {
      heights.push(Math.max(1, Math.round(box.height)));
    }
  }

  const totalHeight = heights.reduce((sum, h) => sum + h, 0) + gap * (heights.length - 1);
  let y = box.y;
  if (vAlign === 'middle') y = box.y + Math.round((box.height - totalHeight) / 2);
  if (vAlign === 'bottom') y = box.y + box.height - totalHeight;

  for (let i = 0; i < visibleChildren.length; i++) {
    const child = visibleChildren[i]!;
    const h = heights[i]!;
    const childBox = { x: box.x, y, width: box.width, height: h };
    renderElement(ctx2d, child, childBox, ctx, { inheritedAlign: align, inheritedVAlign: 'top' });
    y += h + gap;
  }
}

type InheritedAlignment = {
  inheritedAlign?: 'left' | 'center' | 'right';
  inheritedVAlign?: 'top' | 'middle' | 'bottom';
};

function renderElement(
  ctx2d: CanvasRenderingContext2D,
  el: ElementSpec,
  box: Rect,
  ctx: EngineContext,
  inherited?: InheritedAlignment,
) {
  if (!shouldRenderByCondition(el.condition, ctx)) return;

  switch (el.type) {
    case 'rect':
      drawRectElement(ctx2d, el, box, ctx);
      return;
    case 'divider':
      drawDivider(ctx2d, el, box, ctx);
      return;
    case 'text': {
      const next: TextElement = {
        ...el,
        style: {
          ...el.style,
          align: el.style.align ?? inherited?.inheritedAlign,
          vAlign: el.style.vAlign ?? inherited?.inheritedVAlign,
        },
      };
      drawTextElement(ctx2d, next, box, ctx);
      return;
    }
    case 'maker_logo': {
      const align = el.style.align ?? inherited?.inheritedAlign;
      const vAlign = el.style.vAlign ?? inherited?.inheritedVAlign;
      drawMakerLogo(ctx2d, { ...el.style, align, vAlign }, box, ctx);
      return;
    }
    case 'swatches':
      drawSwatches(ctx2d, el, box, ctx);
      return;
    case 'stack':
      renderStack(ctx2d, el, box, ctx);
      return;
    default: {
      const neverEl: never = el;
      void neverEl;
    }
  }
}

export type RenderLayerInput = {
  exif: ExifData;
  makerLogo?: MakerLogo | null;
  palette?: string[];
};

export function renderTemplateLayer(
  ctx2d: CanvasRenderingContext2D,
  template: TemplateJson,
  zones: Record<string, Rect>,
  scale: number,
  layer: 'backdrop' | 'overlay',
  input: RenderLayerInput,
) {
  const zoneContext: EngineContext['zones'] = {};
  for (const [zoneId, zoneRect] of Object.entries(zones)) {
    const gridSpec = template.zones?.[zoneId]?.grid;
    const resolved = resolveGrid(zoneRect, gridSpec, scale);
    zoneContext[zoneId] = { rect: zoneRect, grid: { cols: resolved.cols, rows: resolved.rows, padding: resolved.padding } };
  }

  const ctx: EngineContext = {
    width: zones.canvas?.width ?? 0,
    height: zones.canvas?.height ?? 0,
    exif: input.exif,
    makerLogo: input.makerLogo,
    palette: input.palette,
    scale,
    zones: zoneContext,
  };

  const elements = template.elements.filter((el) => (el.layer ?? 'overlay') === layer);

  for (const el of elements) {
    const zone = ctx.zones[el.zone];
    if (!zone) continue;
    const resolved = resolveGrid(zone.rect, template.zones?.[el.zone]?.grid, scale);
    const box = el.grid ? rectFromGrid(resolved, el.grid) : zone.rect;
    renderElement(ctx2d, el, box, ctx);
  }
}
