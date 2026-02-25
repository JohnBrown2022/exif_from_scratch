import type { TemplateId } from '../render/templates';

import type { RenderNodeJson } from './types';

import bottomBarV2Raw from './defs/bottom_bar.v2.json';
import cinemascopeV2Raw from './defs/cinemascope.v2.json';
import classicFooterV2Raw from './defs/classic_footer.v2.json';
import customedV2Raw from './defs/customed.v2.json';
import ezmarkCardV2Raw from './defs/ezmark_card.v2.json';
import filmV2Raw from './defs/film.v2.json';
import infoBlockV2Raw from './defs/info_block.v2.json';
import lightroomFooterV2Raw from './defs/lightroom_footer.v2.json';
import minimalCornerV2Raw from './defs/minimal_corner.v2.json';
import monitorBarV2Raw from './defs/monitor_bar.v2.json';
import picsealBannerV2Raw from './defs/picseal_banner.v2.json';
import shotOnV2Raw from './defs/shot_on.v2.json';

export type NativeTemplateNodeBundle = {
  backdropNodes: RenderNodeJson[];
  overlayNodes: RenderNodeJson[];
};

type NativeTemplateDef = {
  templateId: TemplateId;
} & NativeTemplateNodeBundle;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizeNodes(value: unknown): RenderNodeJson[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (n): n is RenderNodeJson => isRecord(n) && typeof n.id === 'string' && typeof n.type === 'string' && isRecord(n.props),
  );
}

function parseNativeTemplateDef(raw: unknown): NativeTemplateDef | null {
  if (!isRecord(raw)) return null;
  const templateId = raw.templateId;
  if (typeof templateId !== 'string' || templateId.trim().length === 0) return null;
  const overlayNodes = Array.isArray(raw.overlayNodes) ? raw.overlayNodes : raw.nodes;
  const backdropNodes = raw.backdropNodes;
  // Built-ins are trusted; ensure minimal shape.
  return {
    templateId: templateId as TemplateId,
    backdropNodes: sanitizeNodes(backdropNodes),
    overlayNodes: sanitizeNodes(overlayNodes),
  };
}

const NATIVE_TEMPLATES: Partial<Record<TemplateId, NativeTemplateDef>> = {
  classic_footer: parseNativeTemplateDef(classicFooterV2Raw) ?? undefined,
  customed: parseNativeTemplateDef(customedV2Raw) ?? undefined,
  ezmark_card: parseNativeTemplateDef(ezmarkCardV2Raw) ?? undefined,
  picseal_banner: parseNativeTemplateDef(picsealBannerV2Raw) ?? undefined,
  lightroom_footer: parseNativeTemplateDef(lightroomFooterV2Raw) ?? undefined,
  monitor_bar: parseNativeTemplateDef(monitorBarV2Raw) ?? undefined,
  shot_on: parseNativeTemplateDef(shotOnV2Raw) ?? undefined,
  cinemascope: parseNativeTemplateDef(cinemascopeV2Raw) ?? undefined,
  bottom_bar: parseNativeTemplateDef(bottomBarV2Raw) ?? undefined,
  info_block: parseNativeTemplateDef(infoBlockV2Raw) ?? undefined,
  film: parseNativeTemplateDef(filmV2Raw) ?? undefined,
  minimal_corner: parseNativeTemplateDef(minimalCornerV2Raw) ?? undefined,
};

export function isNativeV2TemplateId(templateId: TemplateId): boolean {
  return Boolean(NATIVE_TEMPLATES[templateId]);
}

export function getNativeTemplateNodeBundle(templateId: TemplateId): NativeTemplateNodeBundle | null {
  const def = NATIVE_TEMPLATES[templateId];
  if (!def) return null;
  return cloneJson({ backdropNodes: def.backdropNodes, overlayNodes: def.overlayNodes });
}
