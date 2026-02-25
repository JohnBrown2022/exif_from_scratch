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
  registerNodeType(topologyMountain);
}
