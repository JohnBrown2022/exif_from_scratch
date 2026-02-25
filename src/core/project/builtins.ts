import type { TemplateId } from '../render/templates';
import { getTemplateById } from '../render/templates';
import { fitText, roundRectPath } from '../render/draw';
import { clamp } from '../utils/clamp';
import { resolveTextBinding } from '../render/engine/bindings';
import { rectFromBox } from '../render/engine/box';
import { rectFromGrid, resolveGrid } from '../render/engine/grid';
import { computeScale, resolveDimension } from '../render/engine/values';
import type {
  BoxSpec,
  ConditionSpec,
  Dimension,
  DividerStyle,
  GridPlacement,
  LogoStyle,
  RectStyle,
  ScaleModel,
  TextBinding,
  TextStyle,
} from '../render/engine/types';
import { EXIF_FIELD_KINDS, type ExifFieldKind } from '../render/engine/overrides';
import { renderTopologyMountainStamp } from '../watermark/topologyMountain';

import type { CompiledNode, RenderEnv } from './types';
import { registerNodeType, type NodeTypeDef } from './registry';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

type PlacementProps = {
  zone?: string;
  grid?: GridPlacement;
  box?: BoxSpec;
};

function sanitizeZone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function sanitizeGridPlacement(value: unknown): GridPlacement | undefined {
  if (!isRecord(value)) return undefined;
  const col = asFiniteNumber(value.col);
  const colSpan = asFiniteNumber(value.colSpan);
  const row = asFiniteNumber(value.row);
  const rowSpan = asFiniteNumber(value.rowSpan);
  if (typeof col !== 'number' || typeof colSpan !== 'number' || typeof row !== 'number' || typeof rowSpan !== 'number') return undefined;
  return { col, colSpan, row, rowSpan };
}

function sanitizeCondition(value: unknown): ConditionSpec | undefined {
  if (!isRecord(value)) return undefined;
  const out: ConditionSpec = {};
  if (value.hideWhenEmpty === true) out.hideWhenEmpty = true;
  if (value.showWhenMakerLogoPresent === true) out.showWhenMakerLogoPresent = true;
  if (value.showWhenMakerLogoMissing === true) out.showWhenMakerLogoMissing = true;
  if (value.showWhenPalettePresent === true) out.showWhenPalettePresent = true;
  return Object.keys(out).length ? out : undefined;
}

function shouldRenderByCondition(condition: ConditionSpec | undefined, env: RenderEnv): boolean {
  if (!condition) return true;
  if (condition.showWhenMakerLogoPresent && !env.makerLogo) return false;
  if (condition.showWhenMakerLogoMissing && env.makerLogo) return false;
  if (condition.showWhenPalettePresent && (!env.palette || env.palette.length === 0)) return false;
  return true;
}

function resolveScale(env: RenderEnv, scaleModel: ScaleModel | undefined): number {
  if (env.template) return env.template.scale;
  const model: ScaleModel = scaleModel ?? { designWidth: 1000, min: 0.75, max: 1.15, basis: 'width' };
  return computeScale(env.imageRect.width, env.imageRect.height, model);
}

function canvasRect(env: RenderEnv): { x: number; y: number; width: number; height: number } {
  return { x: 0, y: 0, width: env.canvas.width, height: env.canvas.height };
}

function resolvePlacementRect(env: RenderEnv, scale: number, placement: PlacementProps): { x: number; y: number; width: number; height: number } {
  const zoneId = placement.zone ?? 'canvas';
  const base =
    env.template?.zones?.[zoneId] ??
    (zoneId === 'photo' ? env.photoRect : zoneId === 'image' ? env.imageRect : canvasRect(env));
  const placementRect = placement.box ? rectFromBox(base, placement.box, scale) : { ...base };
  if (!placement.grid) return placementRect;
  const gridSpec = env.template?.json.zones?.[zoneId]?.grid;
  const resolved = resolveGrid(placementRect, gridSpec, scale);
  return rectFromGrid(resolved, placement.grid);
}

function applyHiddenFieldsToBinding(
  bind: Extract<TextBinding, { kind: 'concat' }>,
  hidden: Set<ExifFieldKind>,
): Extract<TextBinding, { kind: 'concat' }> {
  const filter = (part: TextBinding): TextBinding | null => {
    if (part.kind === 'concat') {
      return applyHiddenFieldsToBinding(part, hidden);
    }
    if (part.kind === 'literal') return part;
    return hidden.has(part.kind as ExifFieldKind) ? null : part;
  };

  const nextParts = (bind.parts ?? []).map(filter).filter((part): part is TextBinding => Boolean(part));
  return { ...bind, parts: nextParts };
}

function applyOpacity(ctx: CanvasRenderingContext2D, opacity: number | undefined) {
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) return;
  ctx.globalAlpha *= clamp(opacity, 0, 1);
}

function applyShadow(
  ctx2d: CanvasRenderingContext2D,
  shadow: { color: string; blur?: Dimension; offsetX?: Dimension; offsetY?: Dimension } | undefined,
  scale: number,
) {
  if (!shadow) return;
  if (!shadow.color) return;
  ctx2d.shadowColor = shadow.color;
  ctx2d.shadowBlur = Math.max(0, resolveDimension(shadow.blur, scale, 0));
  ctx2d.shadowOffsetX = resolveDimension(shadow.offsetX, scale, 0);
  ctx2d.shadowOffsetY = resolveDimension(shadow.offsetY, scale, 0);
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

function computeAnchorX(rect: { x: number; width: number }, align: 'left' | 'center' | 'right'): number {
  if (align === 'left') return rect.x;
  if (align === 'right') return rect.x + rect.width;
  return rect.x + rect.width / 2;
}

function computeAnchorY(rect: { y: number; height: number }, vAlign: 'top' | 'middle' | 'bottom'): number {
  if (vAlign === 'top') return rect.y;
  if (vAlign === 'bottom') return rect.y + rect.height;
  return rect.y + rect.height / 2;
}

function shouldApplyRotation(rotation: RenderEnv['image']['rotation']): rotation is NonNullable<RenderEnv['image']['rotation']> {
  return Boolean(
    rotation?.canvas &&
      (rotation.rad !== 0 || rotation.scaleX !== 1 || rotation.scaleY !== 1 || rotation.dimensionSwapped),
  );
}

function getOrientedSize(
  imageWidth: number,
  imageHeight: number,
  rotation: RenderEnv['image']['rotation'],
): { width: number; height: number } {
  if (shouldApplyRotation(rotation) && rotation.dimensionSwapped) {
    return { width: imageHeight, height: imageWidth };
  }
  return { width: imageWidth, height: imageHeight };
}

function drawImageInRect(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  rotation: RenderEnv['image']['rotation'],
  options: { rect: { x: number; y: number; width: number; height: number }; mode: 'contain' | 'cover'; cornerRadius?: number },
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

type TemplateLayerProps = { templateId: TemplateId; layer: 'backdrop' | 'overlay' };

function sanitizeTemplateLayerProps(raw: unknown): TemplateLayerProps | null {
  if (!isRecord(raw)) return null;
  const templateId = raw.templateId;
  const layer = asEnum(raw.layer, ['backdrop', 'overlay'] as const);
  if (typeof templateId !== 'string' || !layer) return null;
  return { templateId: templateId as TemplateId, layer };
}

const legacyTemplateLayer: NodeTypeDef = {
  type: 'legacy/template_layer',
  meta: { name: '模板层', description: '兼容旧模板引擎（过渡阶段使用）。' },
  sanitizeProps: (raw) => sanitizeTemplateLayerProps(raw) ?? { templateId: 'bottom_bar', layer: 'overlay' },
  render: (ctx2d, node, env) => {
    const props = node.props as unknown as TemplateLayerProps;
    const template = getTemplateById(props.templateId);
    const inputBase = {
      width: env.canvas.width,
      height: env.canvas.height,
      exif: env.exif,
      imageRect: env.imageRect,
      makerLogo: env.makerLogo,
    } as const;

    if (props.layer === 'backdrop') {
      template.renderBackdrop?.(ctx2d, inputBase);
      return;
    }

    template.render(ctx2d, { ...inputBase, palette: env.palette });
  },
};

type ImageNodeProps = { fit?: 'contain' | 'cover'; cornerRadiusPx?: number };

function sanitizeImageNodeProps(raw: unknown): ImageNodeProps {
  if (!isRecord(raw)) return {};
  const fit = asEnum(raw.fit, ['contain', 'cover'] as const);
  const cornerRadiusPx = asFiniteNumber(raw.cornerRadiusPx);
  return {
    ...(fit ? { fit } : null),
    ...(typeof cornerRadiusPx === 'number' ? { cornerRadiusPx } : null),
  };
}

const coreImage: NodeTypeDef = {
  type: 'core/image',
  meta: { name: '照片', description: '原始照片层。' },
  sanitizeProps: sanitizeImageNodeProps,
  resolveRect: ({ env }) => env.imageRect,
  render: (ctx2d, node, env) => {
    const props = node.props as unknown as ImageNodeProps;
    const fit = props.fit ?? env.imageDrawMode;
    const cornerRadius = props.cornerRadiusPx ?? env.photoCornerRadius;
    drawImageInRect(ctx2d, env.image.source, env.image.width, env.image.height, env.image.rotation, {
      rect: node.rect,
      mode: fit,
      cornerRadius,
    });
  },
};

type CoreTextNodeProps = PlacementProps & {
  bind: TextBinding;
  style?: TextStyle;
  condition?: ConditionSpec;
  hideWhenEmpty?: boolean;
  hiddenFields?: ExifFieldKind[];
  scaleModel?: ScaleModel;
};

function sanitizeCoreTextNodeProps(raw: unknown): CoreTextNodeProps {
  if (!isRecord(raw)) return { bind: { kind: 'literal', value: '' } };
  const bind =
    isRecord(raw.bind) && typeof raw.bind.kind === 'string' ? (raw.bind as TextBinding) : ({ kind: 'literal', value: '' } as const);
  const style = isRecord(raw.style) ? (raw.style as TextStyle) : undefined;
  const condition = sanitizeCondition(raw.condition);
  const hideWhenEmpty = raw.hideWhenEmpty === true ? true : undefined;
  const scaleModel = isRecord(raw.scaleModel) ? (raw.scaleModel as ScaleModel) : undefined;
  const zone = sanitizeZone(raw.zone);
  const grid = sanitizeGridPlacement(raw.grid);
  const box = isRecord(raw.box) ? (raw.box as BoxSpec) : undefined;
  const hiddenFields = Array.isArray(raw.hiddenFields)
    ? raw.hiddenFields
        .filter((v): v is string => typeof v === 'string')
        .map((v) => asEnum(v, EXIF_FIELD_KINDS))
        .filter((v): v is ExifFieldKind => Boolean(v))
    : [];

  return {
    ...(zone ? { zone } : null),
    ...(grid ? { grid } : null),
    ...(box ? { box } : null),
    bind,
    style,
    condition,
    hideWhenEmpty,
    ...(hiddenFields.length ? { hiddenFields: Array.from(new Set(hiddenFields)) } : null),
    scaleModel,
  };
}

const coreText: NodeTypeDef = {
  type: 'core/text',
  meta: { name: '文字', description: '基础文字元素（支持 EXIF 绑定）。' },
  sanitizeProps: (raw) => sanitizeCoreTextNodeProps(raw) as unknown as Record<string, unknown>,
  resolveRect: ({ env, props }) => {
    const p = props as unknown as CoreTextNodeProps;
    const scale = resolveScale(env, p.scaleModel);
    return resolvePlacementRect(env, scale, p);
  },
  render: (ctx2d, node, env) => {
    const props = node.props as unknown as CoreTextNodeProps;
    if (!shouldRenderByCondition(props.condition, env)) return;
    const style = props.style ?? {};
    let bind = props.bind;
    if (bind.kind === 'concat' && Array.isArray(props.hiddenFields) && props.hiddenFields.length) {
      bind = applyHiddenFieldsToBinding(bind, new Set(props.hiddenFields));
    }
    const text = resolveTextBinding(env.exif, bind);
    const shouldHideWhenEmpty = props.hideWhenEmpty || props.condition?.hideWhenEmpty;
    if (shouldHideWhenEmpty && (!text || !text.trim().length)) return;

    const scale = resolveScale(env, props.scaleModel);

    ctx2d.save();
    applyOpacity(ctx2d, style.opacity);
    applyShadow(ctx2d, style.shadow, scale);

    const fontFamily = style.font ?? 'sans';
    const fontWeight = style.weight ?? 600;
    const fontSize = resolveSize(style.size, scale, 14);
    setFont(ctx2d, fontFamily, fontWeight, fontSize);

    const align = style.align ?? 'left';
    const vAlign = style.vAlign ?? 'top';

    ctx2d.textAlign = align;
    ctx2d.textBaseline = vAlign === 'top' ? 'top' : vAlign === 'bottom' ? 'bottom' : 'middle';
    ctx2d.fillStyle = style.color ?? 'rgba(255,255,255,0.92)';

    const maxWidth = Math.max(1, Math.round(node.rect.width));
    const fitted = fitText(ctx2d, text ?? '', maxWidth);
    ctx2d.fillText(fitted, computeAnchorX(node.rect, align), computeAnchorY(node.rect, vAlign));

    ctx2d.restore();
  },
};

type TextStackItem = {
  id: string;
  label?: string;
  enabled?: boolean;
  bind: TextBinding;
  style: TextStyle;
  hideWhenEmpty?: boolean;
  hiddenFields?: ExifFieldKind[];
};

type CoreTextStackProps = {
  zone?: string;
  grid?: GridPlacement;
  relativeTo?: 'canvas' | 'image' | 'photo';
  scaleModel?: ScaleModel;
  box?: BoxSpec;
  direction?: 'vertical' | 'horizontal';
  gap?: Dimension;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
  items: TextStackItem[];
};

function sanitizeTextStackItems(value: unknown): TextStackItem[] {
  if (!Array.isArray(value)) return [];
  const out: TextStackItem[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    if (typeof raw.id !== 'string' || raw.id.trim().length === 0) continue;
    const label = typeof raw.label === 'string' && raw.label.trim().length ? raw.label.trim() : undefined;
    const enabled = raw.enabled === false ? false : undefined;
    const bind = isRecord(raw.bind) && typeof raw.bind.kind === 'string' ? (raw.bind as TextBinding) : null;
    const style = isRecord(raw.style) ? (raw.style as TextStyle) : null;
    if (!bind || !style) continue;
    const hiddenFields = Array.isArray(raw.hiddenFields)
      ? raw.hiddenFields
          .filter((v): v is string => typeof v === 'string')
          .map((v) => asEnum(v, EXIF_FIELD_KINDS))
          .filter((v): v is ExifFieldKind => Boolean(v))
      : [];

    out.push({
      id: raw.id,
      ...(label ? { label } : null),
      ...(enabled === false ? { enabled: false } : null),
      bind,
      style,
      ...(raw.hideWhenEmpty === true ? { hideWhenEmpty: true } : null),
      ...(hiddenFields.length ? { hiddenFields: Array.from(new Set(hiddenFields)) } : null),
    });
  }
  return out;
}

function sanitizeCoreTextStackProps(raw: unknown): CoreTextStackProps {
  const record = isRecord(raw) ? raw : {};
  const zone = sanitizeZone(record.zone);
  const grid = sanitizeGridPlacement(record.grid);
  const relativeTo = asEnum(record.relativeTo, ['canvas', 'image', 'photo'] as const);
  const direction = asEnum(record.direction, ['vertical', 'horizontal'] as const);
  const align = asEnum(record.align, ['left', 'center', 'right'] as const);
  const vAlign = asEnum(record.vAlign, ['top', 'middle', 'bottom'] as const);
  const scaleModel = isRecord(record.scaleModel) ? (record.scaleModel as ScaleModel) : undefined;
  const box = isRecord(record.box) ? (record.box as BoxSpec) : undefined;
  const gap = (typeof record.gap === 'number' || isRecord(record.gap)) ? (record.gap as Dimension) : undefined;
  const items = sanitizeTextStackItems(record.items);
  return {
    ...(zone ? { zone } : null),
    ...(grid ? { grid } : null),
    ...(relativeTo ? { relativeTo } : null),
    ...(scaleModel ? { scaleModel } : null),
    ...(box ? { box } : null),
    ...(direction ? { direction } : null),
    ...(gap ? { gap } : null),
    ...(align ? { align } : null),
    ...(vAlign ? { vAlign } : null),
    items,
  };
}

const coreTextStack: NodeTypeDef = {
  type: 'core/text_stack',
  meta: { name: '文字堆栈', description: '在一个盒子内按顺序堆叠多行文字（支持 EXIF 绑定）。' },
  sanitizeProps: (raw) => sanitizeCoreTextStackProps(raw) as unknown as Record<string, unknown>,
  resolveRect: ({ env, props }) => {
    const p = props as unknown as CoreTextStackProps;
    const scale = resolveScale(env, p.scaleModel);
    if (p.zone || p.grid) {
      return resolvePlacementRect(env, scale, p);
    }
    const relativeTo = p.relativeTo ?? 'image';
    const base =
      relativeTo === 'photo'
        ? env.photoRect
        : relativeTo === 'image'
          ? env.imageRect
          : { x: 0, y: 0, width: env.canvas.width, height: env.canvas.height };
    return rectFromBox(base, p.box, scale);
  },
  render: (ctx2d, node, env) => {
    const p = node.props as unknown as CoreTextStackProps;
    const items = Array.isArray(p.items) ? p.items : [];
    if (!items.length) return;

    const scale = resolveScale(env, p.scaleModel);

    const direction = p.direction ?? 'vertical';
    const gap = Math.max(0, resolveDimension(p.gap, scale, 8));
    const align = p.align ?? 'left';
    const vAlign = p.vAlign ?? 'top';

    const visible = items
      .map((item) => {
        if (item.enabled === false) return null;
        let bind = item.bind;
        if (bind.kind === 'concat' && Array.isArray(item.hiddenFields) && item.hiddenFields.length) {
          const hidden = new Set(item.hiddenFields);
          bind = applyHiddenFieldsToBinding(bind, hidden);
        }

        const text = resolveTextBinding(env.exif, bind);
        if (item.hideWhenEmpty && (!text || !text.trim().length)) return null;
        return { item, text: text ?? '' };
      })
      .filter((v): v is { item: TextStackItem; text: string } => Boolean(v));
    if (!visible.length) return;

    if (direction === 'horizontal') {
      const count = visible.length;
      const totalGap = gap * Math.max(0, count - 1);
      const baseChildWidth = Math.max(1, Math.round((node.rect.width - totalGap) / Math.max(1, count)));

      let x = node.rect.x;
      for (let i = 0; i < visible.length; i++) {
        const { item, text } = visible[i]!;
        const isLast = i === visible.length - 1;
        const remaining = node.rect.x + node.rect.width - x;
        const width = isLast ? Math.max(1, remaining) : Math.max(1, Math.min(baseChildWidth, remaining));
        const box = { x, y: node.rect.y, width, height: node.rect.height };
        const style = item.style ?? {};

        ctx2d.save();
        applyOpacity(ctx2d, style.opacity);
        applyShadow(ctx2d, style.shadow, scale);

        const fontFamily = style.font ?? 'sans';
        const fontWeight = style.weight ?? 600;
        const fontSize = resolveSize(style.size, scale, 14);
        setFont(ctx2d, fontFamily, fontWeight, fontSize);

        const itemAlign = style.align ?? align;
        const itemVAlign = style.vAlign ?? 'top';

        ctx2d.textAlign = itemAlign;
        ctx2d.textBaseline = itemVAlign === 'top' ? 'top' : itemVAlign === 'bottom' ? 'bottom' : 'middle';
        ctx2d.fillStyle = style.color ?? 'rgba(255,255,255,0.92)';

        const fitted = fitText(ctx2d, text, Math.max(1, Math.round(box.width)));
        ctx2d.fillText(fitted, computeAnchorX(box, itemAlign), computeAnchorY(box, itemVAlign));
        ctx2d.restore();

        x += width + gap;
      }
      return;
    }

    const heights: number[] = [];
    for (const { item } of visible) {
      const style = item.style ?? {};
      const fontSize = resolveSize(style.size, scale, 14);
      const lineHeight = style.lineHeight ?? 1.25;
      heights.push(Math.round(fontSize * lineHeight));
    }

    const totalHeight = heights.reduce((sum, h) => sum + h, 0) + gap * (heights.length - 1);
    let y = node.rect.y;
    if (vAlign === 'middle') y = node.rect.y + Math.round((node.rect.height - totalHeight) / 2);
    if (vAlign === 'bottom') y = node.rect.y + node.rect.height - totalHeight;

    for (let i = 0; i < visible.length; i++) {
      const { item, text } = visible[i]!;
      const h = heights[i]!;
      const box = { x: node.rect.x, y, width: node.rect.width, height: h };
      const style = item.style ?? {};

      ctx2d.save();
      applyOpacity(ctx2d, style.opacity);
      applyShadow(ctx2d, style.shadow, scale);

      const fontFamily = style.font ?? 'sans';
      const fontWeight = style.weight ?? 600;
      const fontSize = resolveSize(style.size, scale, 14);
      setFont(ctx2d, fontFamily, fontWeight, fontSize);

      const itemAlign = style.align ?? align;
      const itemVAlign = style.vAlign ?? 'top';

      ctx2d.textAlign = itemAlign;
      ctx2d.textBaseline = itemVAlign === 'top' ? 'top' : itemVAlign === 'bottom' ? 'bottom' : 'middle';
      ctx2d.fillStyle = style.color ?? 'rgba(255,255,255,0.92)';

      const fitted = fitText(ctx2d, text, Math.max(1, Math.round(box.width)));
      ctx2d.fillText(fitted, computeAnchorX(box, itemAlign), computeAnchorY(box, itemVAlign));
      ctx2d.restore();

      y += h + gap;
    }
  },
};

type CoreRectProps = PlacementProps & {
  style: RectStyle;
  condition?: ConditionSpec;
  scaleModel?: ScaleModel;
};

function sanitizeCoreRectProps(raw: unknown): CoreRectProps {
  if (!isRecord(raw)) return { style: { fill: 'transparent' } };
  const style = isRecord(raw.style) ? (raw.style as RectStyle) : { fill: 'transparent' };
  const condition = sanitizeCondition(raw.condition);
  const scaleModel = isRecord(raw.scaleModel) ? (raw.scaleModel as ScaleModel) : undefined;
  const zone = sanitizeZone(raw.zone);
  const grid = sanitizeGridPlacement(raw.grid);
  const box = isRecord(raw.box) ? (raw.box as BoxSpec) : undefined;

  return {
    ...(zone ? { zone } : null),
    ...(grid ? { grid } : null),
    ...(box ? { box } : null),
    style,
    condition,
    scaleModel,
  };
}

function resolveRectFill(
  ctx2d: CanvasRenderingContext2D,
  fill: RectStyle['fill'],
  box: { x: number; y: number; width: number; height: number },
): string | CanvasGradient {
  if (typeof fill === 'string') return fill;
  if (!fill || typeof fill !== 'object' || fill.kind !== 'linear') return 'transparent';

  const x0 = box.x + box.width * fill.x0;
  const y0 = box.y + box.height * fill.y0;
  const x1 = box.x + box.width * fill.x1;
  const y1 = box.y + box.height * fill.y1;
  const gradient = ctx2d.createLinearGradient(x0, y0, x1, y1);
  for (const stop of fill.stops ?? []) {
    if (typeof stop.offset !== 'number' || !Number.isFinite(stop.offset)) continue;
    if (typeof stop.color !== 'string') continue;
    gradient.addColorStop(clamp(stop.offset, 0, 1), stop.color);
  }
  return gradient;
}

const coreRect: NodeTypeDef = {
  type: 'core/rect',
  meta: { name: '矩形', description: '基础矩形元素（支持圆角/描边/阴影）。' },
  sanitizeProps: (raw) => sanitizeCoreRectProps(raw) as unknown as Record<string, unknown>,
  resolveRect: ({ env, props }) => {
    const p = props as unknown as CoreRectProps;
    const scale = resolveScale(env, p.scaleModel);
    return resolvePlacementRect(env, scale, p);
  },
  render: (ctx2d, node, env) => {
    const props = node.props as unknown as CoreRectProps;
    if (!shouldRenderByCondition(props.condition, env)) return;
    const style = props.style;

    const scale = resolveScale(env, props.scaleModel);

    ctx2d.save();
    applyOpacity(ctx2d, style.opacity);
    applyShadow(ctx2d, style.shadow, scale);

    const radius = resolveDimension(style.radius, scale, 0);
    const fill = resolveRectFill(ctx2d, style.fill, node.rect);
    const stroke = style.stroke;
    const strokeWidth = Math.max(1, resolveDimension(style.strokeWidth, scale, 1));

    if (radius > 0) {
      roundRectPath(ctx2d, node.rect.x, node.rect.y, node.rect.width, node.rect.height, radius);
      ctx2d.fillStyle = fill;
      ctx2d.fill();
      if (stroke) {
        ctx2d.lineWidth = strokeWidth;
        ctx2d.strokeStyle = stroke;
        ctx2d.stroke();
      }
    } else {
      ctx2d.fillStyle = fill;
      ctx2d.fillRect(node.rect.x, node.rect.y, node.rect.width, node.rect.height);
      if (stroke) {
        ctx2d.lineWidth = strokeWidth;
        ctx2d.strokeStyle = stroke;
        ctx2d.strokeRect(
          node.rect.x + strokeWidth / 2,
          node.rect.y + strokeWidth / 2,
          node.rect.width - strokeWidth,
          node.rect.height - strokeWidth,
        );
      }
    }

    ctx2d.restore();
  },
};

type CoreMakerLogoProps = PlacementProps & {
  style?: LogoStyle;
  condition?: ConditionSpec;
  scaleModel?: ScaleModel;
};

function sanitizeCoreMakerLogoProps(raw: unknown): CoreMakerLogoProps {
  if (!isRecord(raw)) return {};
  const style = isRecord(raw.style) ? (raw.style as LogoStyle) : undefined;
  const condition = sanitizeCondition(raw.condition);
  const scaleModel = isRecord(raw.scaleModel) ? (raw.scaleModel as ScaleModel) : undefined;
  const zone = sanitizeZone(raw.zone);
  const grid = sanitizeGridPlacement(raw.grid);
  const box = isRecord(raw.box) ? (raw.box as BoxSpec) : undefined;
  return {
    ...(zone ? { zone } : null),
    ...(grid ? { grid } : null),
    ...(box ? { box } : null),
    style,
    condition,
    scaleModel,
  };
}

const monoLogoCache = new Map<string, HTMLCanvasElement>();

function getLogoSrcId(logo: RenderEnv['makerLogo']): string {
  if (!logo) return 'logo';
  const source = logo.source;
  if (source && typeof source === 'object' && 'src' in source) {
    const src = (source as { src?: unknown }).src;
    if (typeof src === 'string') return src;
  }
  return 'logo';
}

function makeMonoLogoCanvas(
  logo: NonNullable<RenderEnv['makerLogo']>,
  width: number,
  height: number,
  color: string,
): HTMLCanvasElement {
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

const coreMakerLogo: NodeTypeDef = {
  type: 'core/maker_logo',
  meta: { name: '厂商 Logo', description: '相机厂商 Logo（支持彩色/单色）。' },
  sanitizeProps: (raw) => sanitizeCoreMakerLogoProps(raw) as unknown as Record<string, unknown>,
  resolveRect: ({ env, props }) => {
    const p = props as unknown as CoreMakerLogoProps;
    const scale = resolveScale(env, p.scaleModel);
    return resolvePlacementRect(env, scale, p);
  },
  render: (ctx2d, node, env) => {
    const props = node.props as unknown as CoreMakerLogoProps;
    if (!shouldRenderByCondition(props.condition, env)) return;
    const logo = env.makerLogo;
    if (!logo) return;

    const scale = resolveScale(env, props.scaleModel);

    const style = props.style ?? {};

    // Never allow the logo to exceed its placement box; otherwise wide logos can overlap other elements.
    const maxW = Math.min(node.rect.width, resolveDimension(style.maxWidth, scale, node.rect.width));
    const maxH = Math.min(node.rect.height, resolveDimension(style.maxHeight, scale, node.rect.height));
    if (maxW <= 0 || maxH <= 0) return;

    const imageScale = Math.min(maxW / logo.width, maxH / logo.height, 1);
    const drawW = Math.max(1, Math.round(logo.width * imageScale));
    const drawH = Math.max(1, Math.round(logo.height * imageScale));

    const align = style.align ?? 'left';
    const vAlign = style.vAlign ?? 'top';
    const anchorX = computeAnchorX(node.rect, align);
    const anchorY = computeAnchorY(node.rect, vAlign);

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
  },
};

type CoreDividerProps = PlacementProps & {
  orientation?: 'horizontal' | 'vertical';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  style: DividerStyle;
  condition?: ConditionSpec;
  scaleModel?: ScaleModel;
};

function sanitizeCoreDividerProps(raw: unknown): CoreDividerProps {
  if (!isRecord(raw)) return { style: { color: 'rgba(255,255,255,0.22)', thickness: 1 } };
  const style = isRecord(raw.style) ? (raw.style as DividerStyle) : ({ color: 'rgba(255,255,255,0.22)', thickness: 1 } as DividerStyle);
  const orientation = asEnum(raw.orientation, ['horizontal', 'vertical'] as const);
  const position = asEnum(raw.position, ['top', 'bottom', 'left', 'right', 'center'] as const);
  const condition = sanitizeCondition(raw.condition);
  const scaleModel = isRecord(raw.scaleModel) ? (raw.scaleModel as ScaleModel) : undefined;
  const zone = sanitizeZone(raw.zone);
  const grid = sanitizeGridPlacement(raw.grid);
  const box = isRecord(raw.box) ? (raw.box as BoxSpec) : undefined;

  return {
    ...(zone ? { zone } : null),
    ...(grid ? { grid } : null),
    ...(box ? { box } : null),
    ...(orientation ? { orientation } : null),
    ...(position ? { position } : null),
    style,
    condition,
    scaleModel,
  };
}

const coreDivider: NodeTypeDef = {
  type: 'core/divider',
  meta: { name: '分隔线', description: '水平/竖直分隔线（支持位置/厚度/透明度）。' },
  sanitizeProps: (raw) => sanitizeCoreDividerProps(raw) as unknown as Record<string, unknown>,
  resolveRect: ({ env, props }) => {
    const p = props as unknown as CoreDividerProps;
    const scale = resolveScale(env, p.scaleModel);
    const zoneBox = resolvePlacementRect(env, scale, p);
    if (p.grid) return zoneBox;

    const orientation = p.orientation ?? 'horizontal';
    const thickness = Math.max(1, resolveDimension(p.style.thickness, scale, 1));

    if (orientation === 'horizontal') {
      const position = p.position ?? 'top';
      const y =
        position === 'bottom'
          ? zoneBox.y + zoneBox.height - thickness
          : position === 'center'
            ? zoneBox.y + Math.round((zoneBox.height - thickness) / 2)
            : zoneBox.y;
      return { x: zoneBox.x, y: Math.round(y), width: zoneBox.width, height: Math.round(thickness) };
    }

    const position = p.position ?? 'left';
    const x =
      position === 'right'
        ? zoneBox.x + zoneBox.width - thickness
        : position === 'center'
          ? zoneBox.x + Math.round((zoneBox.width - thickness) / 2)
          : zoneBox.x;
    return { x: Math.round(x), y: zoneBox.y, width: Math.round(thickness), height: zoneBox.height };
  },
  render: (ctx2d, node, env) => {
    const props = node.props as unknown as CoreDividerProps;
    if (!shouldRenderByCondition(props.condition, env)) return;

    ctx2d.save();
    applyOpacity(ctx2d, props.style.opacity);
    ctx2d.fillStyle = props.style.color;
    ctx2d.fillRect(node.rect.x, node.rect.y, node.rect.width, node.rect.height);
    ctx2d.restore();
  },
};

type CoreSwatchesProps = PlacementProps & {
  count?: number;
  style?: {
    radius?: Dimension;
    gap?: Dimension;
    opacity?: number;
    stroke?: string;
  };
  condition?: ConditionSpec;
  scaleModel?: ScaleModel;
};

function sanitizeCoreSwatchesProps(raw: unknown): CoreSwatchesProps {
  if (!isRecord(raw)) return {};
  const count = asFiniteNumber(raw.count);
  const style = isRecord(raw.style) ? (raw.style as CoreSwatchesProps['style']) : undefined;
  const condition = sanitizeCondition(raw.condition);
  const scaleModel = isRecord(raw.scaleModel) ? (raw.scaleModel as ScaleModel) : undefined;
  const zone = sanitizeZone(raw.zone);
  const grid = sanitizeGridPlacement(raw.grid);
  const box = isRecord(raw.box) ? (raw.box as BoxSpec) : undefined;

  return {
    ...(zone ? { zone } : null),
    ...(grid ? { grid } : null),
    ...(box ? { box } : null),
    ...(typeof count === 'number' ? { count } : null),
    ...(style ? { style } : null),
    condition,
    scaleModel,
  };
}

const coreSwatches: NodeTypeDef = {
  type: 'core/swatches',
  meta: { name: '色卡', description: '从照片提取的主色圆点（Palette）。' },
  sanitizeProps: (raw) => sanitizeCoreSwatchesProps(raw) as unknown as Record<string, unknown>,
  resolveRect: ({ env, props }) => {
    const p = props as unknown as CoreSwatchesProps;
    const scale = resolveScale(env, p.scaleModel);
    return resolvePlacementRect(env, scale, p);
  },
  render: (ctx2d, node, env) => {
    const props = node.props as unknown as CoreSwatchesProps;
    if (!shouldRenderByCondition(props.condition, env)) return;

    const palette = env.palette ?? [];
    if (!palette.length) return;

    const scale = resolveScale(env, props.scaleModel);

    const count = clamp(Math.round(props.count ?? 4), 1, 10);
    const colors = palette.slice(0, count);
    if (!colors.length) return;

    const radius = resolveDimension(props.style?.radius, scale, 7);
    const gap = resolveDimension(props.style?.gap, scale, 8);
    const stroke = props.style?.stroke ?? 'rgba(0,0,0,0.12)';

    const total = colors.length * radius * 2 + (colors.length - 1) * gap;
    const startX = node.rect.x + node.rect.width - total;
    const y = node.rect.y;

    ctx2d.save();
    applyOpacity(ctx2d, props.style?.opacity);

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
  },
};

type TopologyNodeProps = {
  seed?: string;
  seedMode: 'file_md5' | 'manual';
  manualSeed: string;
  positionMode: 'auto' | 'manual';
  x: number;
  y: number;
  size: number;
  autoAnchor?: 'top-right' | 'bottom-right';
  alpha: number;
  density: number;
  noise: number;
};

function sanitizeTopologyProps(raw: unknown): TopologyNodeProps {
  const record = isRecord(raw) ? raw : {};

  const seedRaw = typeof record.seed === 'string' ? record.seed.trim() : '';
  const seed = seedRaw.length ? seedRaw : undefined;

  const seedMode = asEnum(record.seedMode, ['file_md5', 'manual'] as const) ?? 'file_md5';
  const manualSeed = typeof record.manualSeed === 'string' ? record.manualSeed : '';

  const positionMode = asEnum(record.positionMode, ['auto', 'manual'] as const) ?? 'auto';
  const x = clamp(asFiniteNumber(record.x) ?? 0.85, 0, 1);
  const y = clamp(asFiniteNumber(record.y) ?? 0.85, 0, 1);
  const size = clamp(asFiniteNumber(record.size) ?? 0.18, 0, 1);
  const autoAnchor = asEnum(record.autoAnchor, ['top-right', 'bottom-right'] as const);
  const alpha = clamp(asFiniteNumber(record.alpha) ?? 0.45, 0, 1);
  const density = clamp(Math.round(asFiniteNumber(record.density) ?? 12), 4, 24);
  const noise = clamp(asFiniteNumber(record.noise) ?? 1.5, 0, 3);

  return { seed, seedMode, manualSeed, positionMode, x, y, size, autoAnchor, alpha, density, noise };
}

function computeTopologyRect(env: RenderEnv, input: TopologyNodeProps): { x: number; y: number; width: number; height: number } {
  const shortEdge = Math.max(1, Math.min(env.photoRect.width, env.photoRect.height));
  const rawSizePx = shortEdge * clamp(input.size, 0, 1);
  const stampSize = Math.max(1, Math.round(clamp(rawSizePx, Math.min(24, shortEdge), shortEdge)));
  const half = stampSize / 2;

  const minX = env.photoRect.x + half;
  const maxX = env.photoRect.x + env.photoRect.width - half;
  const minY = env.photoRect.y + half;
  const maxY = env.photoRect.y + env.photoRect.height - half;

  let cx = env.photoRect.x + env.photoRect.width / 2;
  let cy = env.photoRect.y + env.photoRect.height / 2;

  if (input.positionMode === 'manual') {
    const rx = clamp(input.x, 0, 1);
    const ry = clamp(input.y, 0, 1);
    cx = env.photoRect.x + rx * env.photoRect.width;
    cy = env.photoRect.y + ry * env.photoRect.height;
  } else {
    const anchor = input.autoAnchor ?? 'bottom-right';
    const margin = Math.max(8, stampSize * 0.12);
    const right = env.photoRect.x + env.photoRect.width - margin - half;
    const top = env.photoRect.y + margin + half;
    const bottom = env.photoRect.y + env.photoRect.height - margin - half;
    cx = right;
    cy = anchor === 'top-right' ? top : bottom;
  }

  if (minX <= maxX) cx = clamp(cx, minX, maxX);
  if (minY <= maxY) cy = clamp(cy, minY, maxY);

  return { x: Math.round(cx - half), y: Math.round(cy - half), width: stampSize, height: stampSize };
}

function resolveTopologySeed(props: TopologyNodeProps, env: RenderEnv): string {
  if (props.seed && props.seed.trim().length) return props.seed.trim();

  const fallback = env.seeds?.fallback ?? 'default';
  const fileMd5 = env.seeds?.fileMd5?.trim() || '';

  if (props.seedMode === 'manual') {
    const manual = props.manualSeed.trim();
    return manual || fileMd5 || fallback;
  }

  return fileMd5 || fallback;
}

const topologyMountain: NodeTypeDef = {
  type: 'plugin/topology_mountain',
  meta: { name: '山水徽', description: '生成式艺术印章（拓扑山水）。' },
  fields: [
    {
      kind: 'select',
      key: 'seedMode',
      label: '种子',
      options: [
        { value: 'file_md5', label: '按照片（TOPOLOGY_ID）' },
        { value: 'manual', label: '手动' },
      ],
      default: 'file_md5',
    },
    {
      kind: 'text',
      key: 'manualSeed',
      label: '手动种子',
      placeholder: '留空则回退 TOPOLOGY_ID',
      default: '',
      showWhen: { key: 'seedMode', equals: 'manual' },
    },
    {
      kind: 'select',
      key: 'positionMode',
      label: '位置',
      options: [
        { value: 'auto', label: '自动（避让模板）' },
        { value: 'manual', label: '手动' },
      ],
      default: 'auto',
    },
    { kind: 'slider', key: 'size', label: '大小', min: 0.08, max: 0.5, step: 0.01, default: 0.18, hint: '相对照片短边' },
    { kind: 'slider', key: 'x', label: 'X', min: 0, max: 1, step: 0.01, default: 0.85, showWhen: { key: 'positionMode', equals: 'manual' } },
    { kind: 'slider', key: 'y', label: 'Y', min: 0, max: 1, step: 0.01, default: 0.85, showWhen: { key: 'positionMode', equals: 'manual' } },
    { kind: 'slider', key: 'density', label: '排线密度', min: 4, max: 24, step: 1, default: 12 },
    { kind: 'slider', key: 'noise', label: '岩层扭曲', min: 0, max: 3, step: 0.1, default: 1.5 },
    { kind: 'slider', key: 'alpha', label: '透明度', min: 0.1, max: 1, step: 0.05, default: 0.45 },
  ],
  defaultProps: {
    seedMode: 'file_md5',
    manualSeed: '',
    positionMode: 'auto',
    x: 0.85,
    y: 0.85,
    size: 0.18,
    autoAnchor: 'bottom-right',
    alpha: 0.45,
    density: 12,
    noise: 1.5,
  },
  sanitizeProps: sanitizeTopologyProps,
  resolveRect: ({ env, props }) => computeTopologyRect(env, props as TopologyNodeProps),
  render: (ctx2d, node: CompiledNode, env) => {
    const props = node.props as unknown as TopologyNodeProps;
    const seed = resolveTopologySeed(props, env);
    const sizePx = Math.max(1, Math.round(Math.min(node.rect.width, node.rect.height)));
    if (sizePx <= 1) return;

    const stamp = renderTopologyMountainStamp({
      seed,
      sizePx,
      density: props.density,
      noise: props.noise,
      alpha: props.alpha,
    });

    ctx2d.save();
    applyOpacity(ctx2d, 1);
    ctx2d.drawImage(stamp, node.rect.x, node.rect.y, node.rect.width, node.rect.height);
    ctx2d.restore();
  },
};

export function registerBuiltinNodeTypes() {
  registerNodeType(legacyTemplateLayer);
  registerNodeType(coreImage);
  registerNodeType(coreText);
  registerNodeType(coreTextStack);
  registerNodeType(coreRect);
  registerNodeType(coreDivider);
  registerNodeType(coreMakerLogo);
  registerNodeType(coreSwatches);
  registerNodeType(topologyMountain);
}
