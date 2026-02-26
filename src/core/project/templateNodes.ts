import type { TemplateId } from '../render/templates';

import type { RenderNodeJson } from './types';
import { getNativeTemplateNodeBundle } from './nativeTemplates';

export type TopologyAutoAnchor = 'top-right' | 'bottom-right';

export function getTopologyAutoAnchor(templateId: TemplateId): TopologyAutoAnchor {
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

export type TemplateNodeBundle = {
  kind: 'legacy' | 'native';
  backdropNodes: RenderNodeJson[];
  overlayNodes: RenderNodeJson[];
};

function legacyBundle(templateId: TemplateId): TemplateNodeBundle {
  return {
    kind: 'legacy',
    backdropNodes: [{ id: 'tpl_backdrop', type: 'legacy/template_layer', props: { templateId, layer: 'backdrop' } }],
    overlayNodes: [{ id: 'tpl_overlay', type: 'legacy/template_layer', props: { templateId, layer: 'overlay' } }],
  };
}

export function getTemplateNodeBundle(templateId: TemplateId): TemplateNodeBundle {
  const native = getNativeTemplateNodeBundle(templateId);
  if (!native) return legacyBundle(templateId);
  return { kind: 'native', backdropNodes: native.backdropNodes, overlayNodes: native.overlayNodes };
}
