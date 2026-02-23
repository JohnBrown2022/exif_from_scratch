import classicFooterRaw from '../defs/classic_footer.json';

import { parseTemplateJson } from './fromJson';
import type { TemplateJson } from './types';

const builtinTemplates: Record<string, TemplateJson> = {
  classic_footer: parseTemplateJson(classicFooterRaw),
};

export function getBuiltinTemplateJson(id: string): TemplateJson | null {
  return builtinTemplates[id] ?? null;
}

export function listBuiltinTemplateJson(): TemplateJson[] {
  return Object.values(builtinTemplates);
}

