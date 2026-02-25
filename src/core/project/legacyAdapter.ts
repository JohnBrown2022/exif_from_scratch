import type { TemplateId } from '../render/templates';
import type { TopologyWatermarkRenderOptions } from '../watermark/types';

import type { CanvasBackground, ProjectJsonV2, RenderNodeJson } from './types';

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

function getLegacyTopologyAutoAnchor(templateId: TemplateId): 'top-right' | 'bottom-right' {
  switch (templateId) {
    case 'bottom_bar':
    case 'monitor_bar':
    case 'shot_on':
    case 'film':
    case 'lightroom_footer':
    case 'minimal_corner':
      return 'top-right';
    default:
      return 'bottom-right';
  }
}

function shouldIncludeTopology(wm: TopologyWatermarkRenderOptions | null | undefined): wm is TopologyWatermarkRenderOptions {
  return Boolean(wm?.enabled && wm.seed && wm.alpha > 0 && wm.size > 0);
}

export function createLegacyProjectV2(input: {
  templateId: TemplateId;
  background?: string;
  backgroundMode?: 'color' | 'blur';
  blurRadius?: number;
  topologyWatermark?: TopologyWatermarkRenderOptions | null;
}): ProjectJsonV2 {
  const nodes: RenderNodeJson[] = [];

  nodes.push({
    id: 'template_backdrop',
    type: 'legacy/template_layer',
    props: { templateId: input.templateId, layer: 'backdrop' },
  });

  nodes.push({
    id: 'photo',
    type: 'core/image',
    props: {},
  });

  if (shouldIncludeTopology(input.topologyWatermark)) {
    nodes.push({
      id: 'topology_mountain',
      type: 'plugin/topology_mountain',
      clip: 'photo',
      props: {
        seed: input.topologyWatermark.seed,
        positionMode: input.topologyWatermark.positionMode,
        x: input.topologyWatermark.x,
        y: input.topologyWatermark.y,
        size: input.topologyWatermark.size,
        density: input.topologyWatermark.density,
        noise: input.topologyWatermark.noise,
        alpha: input.topologyWatermark.alpha,
        autoAnchor: getLegacyTopologyAutoAnchor(input.templateId),
      },
    });
  }

  nodes.push({
    id: 'template_overlay',
    type: 'legacy/template_layer',
    props: { templateId: input.templateId, layer: 'overlay' },
  });

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

