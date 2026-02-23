import type { WatermarkTemplate } from '../templates';

import { computeLayout, toTemplateLayout } from './layout';
import { parseTemplateJson } from './fromJson';
import { renderTemplateLayer } from './render';
import type { TemplateJson } from './types';

function splitLayers(template: TemplateJson) {
  const backdrop = template.elements.some((el) => (el.layer ?? 'overlay') === 'backdrop');
  return { hasBackdrop: backdrop };
}

export function createWatermarkTemplateFromJson(raw: unknown): WatermarkTemplate {
  const template = parseTemplateJson(raw);
  return createWatermarkTemplateFromDefinition(template);
}

export function createWatermarkTemplateFromDefinition(template: TemplateJson): WatermarkTemplate {
  const { hasBackdrop } = splitLayers(template);

  const watermarkTemplate: WatermarkTemplate = {
    id: template.id as WatermarkTemplate['id'],
    name: template.name,
    description: template.description,
    needsPalette: Boolean(template.requirements?.palette),
    getLayout: ({ baseWidth, baseHeight }) => {
      const computed = computeLayout(template.layout, template.scaleModel, baseWidth, baseHeight);
      return toTemplateLayout(computed);
    },
    renderBackdrop: hasBackdrop
      ? (ctx, input) => {
          const computed = computeLayout(template.layout, template.scaleModel, input.imageRect.width, input.imageRect.height);
          renderTemplateLayer(ctx, template, computed.zones, computed.scale, 'backdrop', {
            exif: input.exif,
            makerLogo: input.makerLogo,
            palette: input.palette,
          });
        }
      : undefined,
    render: (ctx, input) => {
      const computed = computeLayout(template.layout, template.scaleModel, input.imageRect.width, input.imageRect.height);
      renderTemplateLayer(ctx, template, computed.zones, computed.scale, 'overlay', {
        exif: input.exif,
        makerLogo: input.makerLogo,
        palette: input.palette,
      });
    },
  };

  return watermarkTemplate;
}
