import type { TemplateId } from '../render/templates';
import type { TopologyWatermarkSettings } from '../watermark/types';

import type { CanvasBackground, ProjectJsonV2, RenderNodeJson } from './types';
import { getTemplateNodeBundle, getTopologyAutoAnchor } from './templateNodes';

function backgroundFromLegacy(input: {
  background?: string;
  backgroundMode?: 'color' | 'blur';
  blurRadius?: number;
}): CanvasBackground {
  const background = input.background;
  if (!background) return { mode: 'none' };
  if (input.backgroundMode === 'blur') {
    return { mode: 'blur', blurRadius: Math.max(1, Math.round(input.blurRadius ?? 30)), darken: 0.15 };
  }
  return { mode: 'color', color: background };
}

export function createLegacyProjectV2(input: {
  templateId: TemplateId;
  background?: string;
  backgroundMode?: 'color' | 'blur';
  blurRadius?: number;
  topologyWatermark?: TopologyWatermarkSettings | null;
}): ProjectJsonV2 {
  const nodes: RenderNodeJson[] = [];
  const template = getTemplateNodeBundle(input.templateId);

  nodes.push(...template.backdropNodes);

  nodes.push({
    id: 'photo',
    type: 'core/image',
    props: {},
  });

  const wm = input.topologyWatermark;
  nodes.push({
    id: 'topology_mountain',
    type: 'plugin/topology_mountain',
    enabled: Boolean(wm?.enabled),
    clip: 'photo',
    props: {
      seedMode: wm?.seedMode ?? 'file_md5',
      manualSeed: wm?.manualSeed ?? '',
      positionMode: wm?.positionMode ?? 'auto',
      x: wm?.x ?? 0.85,
      y: wm?.y ?? 0.85,
      size: wm?.size ?? 0.18,
      density: wm?.density ?? 12,
      noise: wm?.noise ?? 1.5,
      alpha: wm?.alpha ?? 0.45,
      autoAnchor: getTopologyAutoAnchor(input.templateId),
    },
  });

  nodes.push(...template.overlayNodes);

  return {
    version: '2.0',
    canvas: {
      mode: 'template',
      templateId: input.templateId,
      background: backgroundFromLegacy({
        background: input.background,
        backgroundMode: input.backgroundMode,
        blurRadius: input.blurRadius,
      }),
    },
    nodes,
  };
}
