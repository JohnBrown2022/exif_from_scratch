import type { TemplateId } from '../render/templates';

import { getTemplateNodeBundle, getTopologyAutoAnchor } from './templateNodes';
import type { ProjectJsonV2, RenderNodeJson } from './types';

function isTemplateNode(node: RenderNodeJson): boolean {
  if (node.type === 'legacy/template_layer') return true;
  if (node.id.startsWith('tpl_backdrop')) return true;
  if (node.id.startsWith('tpl_overlay')) return true;
  return false;
}

function ensurePhotoNode(nodes: RenderNodeJson[]): RenderNodeJson[] {
  const hasPhoto = nodes.some((n) => n.type === 'core/image');
  if (hasPhoto) return nodes;
  return [{ id: 'photo', type: 'core/image', props: {} }, ...nodes];
}

function patchTopologyAutoAnchor(nodes: RenderNodeJson[], templateId: TemplateId): RenderNodeJson[] {
  const autoAnchor = getTopologyAutoAnchor(templateId);
  return nodes.map((node) => {
    if (node.id !== 'topology_mountain' || node.type !== 'plugin/topology_mountain') return node;
    return { ...node, props: { ...node.props, autoAnchor } };
  });
}

export function replaceProjectTemplate(project: ProjectJsonV2, templateId: TemplateId): ProjectJsonV2 {
  if (project.canvas.mode !== 'template') return project;

  const bundle = getTemplateNodeBundle(templateId);
  const preserved = ensurePhotoNode(project.nodes.filter((node) => !isTemplateNode(node)));
  const patched = patchTopologyAutoAnchor(preserved, templateId);

  return {
    ...project,
    canvas: { ...project.canvas, templateId },
    nodes: [...bundle.backdropNodes, ...patched, ...bundle.overlayNodes],
  };
}

