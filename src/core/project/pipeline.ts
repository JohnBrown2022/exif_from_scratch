import type { CanvasRotation } from '../exif/readRotation';
import { extractPaletteFromCanvasArea } from '../image/palette';
import { clamp } from '../utils/clamp';
import { roundRectPath } from '../render/draw';
import type { TemplateId, WatermarkTemplate } from '../render/templates';
import { getTemplateById } from '../render/templates';

import { resolveNodeRect, type LayoutEnv } from './layout';
import { registerBuiltinNodeTypes } from './builtins';
import { getNodeType } from './registry';
import type { CanvasBackground, CompiledNode, CompiledProject, ProjectJsonV2, Rect, RenderEnv, RenderEnvInput } from './types';

let builtinsRegistered = false;
function ensureBuiltins() {
  if (builtinsRegistered) return;
  registerBuiltinNodeTypes();
  builtinsRegistered = true;
}

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

function defaultLayout(baseWidth: number, baseHeight: number) {
  return {
    canvasWidth: baseWidth,
    canvasHeight: baseHeight,
    imageRect: rect(0, 0, baseWidth, baseHeight),
    imageDrawMode: 'contain' as const,
    imageCornerRadius: undefined as number | undefined,
  };
}

function shouldApplyRotation(rotation: CanvasRotation | null | undefined): rotation is CanvasRotation {
  return Boolean(
    rotation?.canvas &&
      (rotation.rad !== 0 || rotation.scaleX !== 1 || rotation.scaleY !== 1 || rotation.dimensionSwapped),
  );
}

function getOrientedSize(
  imageWidth: number,
  imageHeight: number,
  rotation: CanvasRotation | null | undefined,
): { width: number; height: number } {
  if (shouldApplyRotation(rotation) && rotation.dimensionSwapped) {
    return { width: imageHeight, height: imageWidth };
  }
  return { width: imageWidth, height: imageHeight };
}

function computeImageDrawRect(
  imageWidth: number,
  imageHeight: number,
  rotation: CanvasRotation | null | undefined,
  rectBox: Rect,
  mode: 'contain' | 'cover',
): Rect {
  const oriented = getOrientedSize(imageWidth, imageHeight, rotation);
  const scale =
    mode === 'cover'
      ? Math.max(rectBox.width / oriented.width, rectBox.height / oriented.height)
      : Math.min(rectBox.width / oriented.width, rectBox.height / oriented.height);

  const drawWidth = oriented.width * scale;
  const drawHeight = oriented.height * scale;

  const cx = rectBox.x + rectBox.width / 2;
  const cy = rectBox.y + rectBox.height / 2;

  return { x: cx - drawWidth / 2, y: cy - drawHeight / 2, width: drawWidth, height: drawHeight };
}

function drawImageInRect(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  rotation: CanvasRotation | null | undefined,
  options: { rect: Rect; mode: 'contain' | 'cover'; cornerRadius?: number },
) {
  const { rect: rectBox, mode, cornerRadius } = options;
  const applyRotation = shouldApplyRotation(rotation);
  const oriented = getOrientedSize(imageWidth, imageHeight, rotation);

  const scale =
    mode === 'cover'
      ? Math.max(rectBox.width / oriented.width, rectBox.height / oriented.height)
      : Math.min(rectBox.width / oriented.width, rectBox.height / oriented.height);

  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;

  const cx = rectBox.x + rectBox.width / 2;
  const cy = rectBox.y + rectBox.height / 2;

  ctx.save();
  if (cornerRadius && cornerRadius > 0) {
    roundRectPath(ctx, rectBox.x, rectBox.y, rectBox.width, rectBox.height, cornerRadius);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(rectBox.x, rectBox.y, rectBox.width, rectBox.height);
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

function normalizeBackground(raw: CanvasBackground | undefined): CanvasBackground {
  if (!raw) return { mode: 'none' };
  if (raw.mode === 'color') return { mode: 'color', color: raw.color || '#000000' };
  if (raw.mode === 'blur') return { mode: 'blur', blurRadius: clamp(raw.blurRadius ?? 30, 1, 200), darken: raw.darken };
  return { mode: 'none' };
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  input: {
    canvasWidth: number;
    canvasHeight: number;
    background: CanvasBackground;
    image: CanvasImageSource;
    imageWidth: number;
    imageHeight: number;
    rotation?: CanvasRotation | null;
  },
) {
  const { background } = input;
  if (background.mode === 'none') return;

  if (background.mode === 'color') {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, input.canvasWidth, input.canvasHeight);
    return;
  }

  // Blur mode: draw the image covering the full canvas with blur filter.
  const blurPx = Math.max(1, Math.round(background.blurRadius * (input.canvasWidth / 1200)));
  ctx.save();
  ctx.filter = `blur(${blurPx}px)`;
  // Draw image covering entire canvas as background
  drawImageInRect(ctx, input.image, input.imageWidth, input.imageHeight, input.rotation, {
    rect: { x: -blurPx, y: -blurPx, width: input.canvasWidth + blurPx * 2, height: input.canvasHeight + blurPx * 2 },
    mode: 'cover',
  });
  ctx.filter = 'none';
  ctx.restore();

  const darken = typeof background.darken === 'number' ? clamp(background.darken, 0, 1) : 0.15;
  if (darken > 0) {
    ctx.fillStyle = `rgba(0,0,0,${darken})`;
    ctx.fillRect(0, 0, input.canvasWidth, input.canvasHeight);
  }
}

function clipToPhoto(ctx: CanvasRenderingContext2D, env: RenderEnv) {
  ctx.save();

  // Clip to the photo placement rect (respect corner radius if present)
  if (env.photoCornerRadius && env.photoCornerRadius > 0) {
    roundRectPath(ctx, env.imageRect.x, env.imageRect.y, env.imageRect.width, env.imageRect.height, env.photoCornerRadius);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(env.imageRect.x, env.imageRect.y, env.imageRect.width, env.imageRect.height);
    ctx.clip();
  }

  // If the image is contained, clip to the actual drawn photo rect
  if (env.imageDrawMode === 'contain') {
    ctx.beginPath();
    ctx.rect(env.photoRect.x, env.photoRect.y, env.photoRect.width, env.photoRect.height);
    ctx.clip();
  }
}

function computeTopologyRect(env: RenderEnv, input: { size: number; positionMode: 'auto' | 'manual'; x: number; y: number; autoAnchor?: 'top-right' | 'bottom-right' }): Rect {
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

  return rect(Math.round(cx - half), Math.round(cy - half), stampSize, stampSize);
}

export type RenderProjectRequest = {
  canvas: HTMLCanvasElement;
  project: ProjectJsonV2;
  env: RenderEnvInput;
  baseWidth: number;
  baseHeight: number;
};

export function compileProject(request: Omit<RenderProjectRequest, 'canvas'>): { project: CompiledProject; env: RenderEnv; template: WatermarkTemplate | null } {
  ensureBuiltins();

  const background = normalizeBackground(request.project.canvas.background);

  let canvasWidth = request.baseWidth;
  let canvasHeight = request.baseHeight;
  let imageRect = rect(0, 0, request.baseWidth, request.baseHeight);
  let imageDrawMode: 'contain' | 'cover' = 'contain';
  let cornerRadius: number | undefined = undefined;
  let template: WatermarkTemplate | null = null;

  if (request.project.canvas.mode === 'fixed_size') {
    canvasWidth = Math.max(1, Math.round(request.project.canvas.width));
    canvasHeight = Math.max(1, Math.round(request.project.canvas.height));
    imageRect = rect(0, 0, canvasWidth, canvasHeight);
    imageDrawMode = 'contain';
  } else if (request.project.canvas.mode === 'template') {
    const templateId = request.project.canvas.templateId as TemplateId;
    template = getTemplateById(templateId);
    const layout = template.getLayout ? template.getLayout({ baseWidth: request.baseWidth, baseHeight: request.baseHeight }) : defaultLayout(request.baseWidth, request.baseHeight);
    canvasWidth = Math.max(1, Math.round(layout.canvasWidth));
    canvasHeight = Math.max(1, Math.round(layout.canvasHeight));
    imageRect = layout.imageRect;
    imageDrawMode = layout.imageDrawMode ?? 'contain';
    cornerRadius = layout.imageCornerRadius;
  }

  const photoRect = imageDrawMode === 'contain'
    ? computeImageDrawRect(request.env.image.width, request.env.image.height, request.env.image.rotation, imageRect, imageDrawMode)
    : imageRect;

  const env: RenderEnv = {
    ...request.env,
    canvas: { width: canvasWidth, height: canvasHeight },
    imageRect,
    photoRect,
    imageDrawMode,
    photoCornerRadius: cornerRadius,
  };

  const layoutEnv: LayoutEnv = { canvas: env.canvas, photoRect: env.photoRect };

  const compiledNodes: CompiledNode[] = [];
  for (const node of request.project.nodes) {
    const enabled = node.enabled !== false;
    const clip = node.clip ?? 'none';
    const def = getNodeType(node.type);
    if (!def) continue;

    const props = def.sanitizeProps ? def.sanitizeProps(node.props) : (isPlainRecord(node.props) ? node.props : {});

    let rectBox = resolveNodeRect(node.layout, layoutEnv);

    // Special: core image defaults to the template-computed imageRect if no layout is provided.
    if (node.type === 'core/image' && !node.layout) {
      rectBox = env.imageRect;
    }

    // Special: topology stamp rect depends on env + size + positionMode
    if (node.type === 'plugin/topology_mountain') {
      const positionMode = (props as Record<string, unknown>).positionMode === 'manual' ? 'manual' : 'auto';
      rectBox = computeTopologyRect(env, {
        size: typeof (props as Record<string, unknown>).size === 'number' ? ((props as Record<string, unknown>).size as number) : 0.18,
        positionMode,
        x: typeof (props as Record<string, unknown>).x === 'number' ? ((props as Record<string, unknown>).x as number) : 0.85,
        y: typeof (props as Record<string, unknown>).y === 'number' ? ((props as Record<string, unknown>).y as number) : 0.85,
        autoAnchor: (props as Record<string, unknown>).autoAnchor === 'top-right' ? 'top-right' : (props as Record<string, unknown>).autoAnchor === 'bottom-right' ? 'bottom-right' : undefined,
      });
    }

    compiledNodes.push({
      id: node.id,
      type: node.type,
      enabled,
      clip,
      rect: rectBox,
      props,
    });
  }

  return {
    template,
    env,
    project: {
      version: '2.0',
      canvas: { width: canvasWidth, height: canvasHeight, background },
      nodes: compiledNodes,
    },
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function renderProject(request: RenderProjectRequest) {
  ensureBuiltins();

  const { project: compiled, env: baseEnv, template } = compileProject({
    project: request.project,
    env: request.env,
    baseWidth: request.baseWidth,
    baseHeight: request.baseHeight,
  });

  request.canvas.width = Math.max(1, Math.round(compiled.canvas.width));
  request.canvas.height = Math.max(1, Math.round(compiled.canvas.height));

  const ctx = request.canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, request.canvas.width, request.canvas.height);

  // Background
  drawBackground(ctx, {
    canvasWidth: request.canvas.width,
    canvasHeight: request.canvas.height,
    background: compiled.canvas.background,
    image: baseEnv.image.source,
    imageWidth: baseEnv.image.width,
    imageHeight: baseEnv.image.height,
    rotation: baseEnv.image.rotation,
  });

  // Palette: compute once after the photo is drawn if the template asks for it.
  const paletteNeeded = Boolean(template?.needsPalette);

  // Render nodes in order
  const env: RenderEnv = { ...baseEnv };

  for (const node of compiled.nodes) {
    if (!node.enabled) continue;
    const def = getNodeType(node.type);
    if (!def) continue;

    if (node.clip === 'photo') {
      clipToPhoto(ctx, env);
    }

    def.render(ctx, node, env);

    if (node.clip === 'photo') {
      ctx.restore();
    }

    if (node.type === 'core/image' && paletteNeeded && !env.palette) {
      env.palette = extractPaletteFromCanvasArea(request.canvas, env.imageRect, 6);
    }
  }

  ctx.restore();
}
