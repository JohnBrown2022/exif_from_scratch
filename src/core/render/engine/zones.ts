import type { Rect } from '../templates';

import { rectFromBox } from './box';
import type { TemplateJson } from './types';

export function computeTemplateZones(
  template: TemplateJson,
  baseZones: Record<string, Rect>,
  scale: number,
): Record<string, Rect> {
  const zones: Record<string, Rect> = { ...baseZones };
  const specs = template.zones ?? {};

  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const [zoneId, spec] of Object.entries(specs)) {
      if (zones[zoneId]) continue;
      const rectSpec = spec.rect;
      if (!rectSpec) continue;
      const base = zones[rectSpec.of];
      if (!base) continue;
      zones[zoneId] = rectFromBox(base, rectSpec.inset, scale);
      changed = true;
    }
    if (!changed) break;
  }

  return zones;
}

