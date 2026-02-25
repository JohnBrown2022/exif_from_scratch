import type { TemplateId } from '../render/templates';
import { getTemplateById } from '../render/templates';
import { roundRectPath } from '../render/draw';
import { clamp } from '../utils/clamp';
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

function applyOpacity(ctx: CanvasRenderingContext2D, opacity: number | undefined) {
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) return;
  ctx.globalAlpha *= clamp(opacity, 0, 1);
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

type TopologyNodeProps = {
  seed: string;
  positionMode: 'auto' | 'manual';
  x: number;
  y: number;
  size: number;
  autoAnchor?: 'top-right' | 'bottom-right';
  alpha: number;
  density: number;
  noise: number;
};

function sanitizeTopologyProps(raw: unknown): TopologyNodeProps | null {
  if (!isRecord(raw)) return null;
  const seed = typeof raw.seed === 'string' ? raw.seed : '';
  const positionMode = asEnum(raw.positionMode, ['auto', 'manual'] as const) ?? 'auto';
  const x = clamp(asFiniteNumber(raw.x) ?? 0.85, 0, 1);
  const y = clamp(asFiniteNumber(raw.y) ?? 0.85, 0, 1);
  const size = clamp(asFiniteNumber(raw.size) ?? 0.18, 0, 1);
  const autoAnchor = asEnum(raw.autoAnchor, ['top-right', 'bottom-right'] as const);
  const alpha = clamp(asFiniteNumber(raw.alpha) ?? 0.45, 0, 1);
  const density = clamp(Math.round(asFiniteNumber(raw.density) ?? 12), 4, 24);
  const noise = clamp(asFiniteNumber(raw.noise) ?? 1.5, 0, 3);
  if (!seed.trim()) return null;
  return { seed, positionMode, x, y, size, autoAnchor, alpha, density, noise };
}

const topologyMountain: NodeTypeDef = {
  type: 'plugin/topology_mountain',
  meta: { name: '山水徽', description: '生成式艺术印章（拓扑山水）。' },
  sanitizeProps: (raw) =>
    sanitizeTopologyProps(raw) ?? {
      seed: 'default',
      positionMode: 'auto',
      x: 0.85,
      y: 0.85,
      size: 0.18,
      autoAnchor: 'bottom-right',
      alpha: 0.45,
      density: 12,
      noise: 1.5,
    },
  render: (ctx2d, node: CompiledNode) => {
    const props = node.props as unknown as TopologyNodeProps;
    const sizePx = Math.max(1, Math.round(Math.min(node.rect.width, node.rect.height)));
    if (sizePx <= 1) return;

    const stamp = renderTopologyMountainStamp({
      seed: props.seed,
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
  registerNodeType(topologyMountain);
}
