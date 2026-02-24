import { parseTemplateJson } from './fromJson';
import type { TemplateJson } from './types';

type JsonModule = { default?: unknown };

const rawModules = import.meta.glob('../defs/*.json', { eager: true }) as Record<string, JsonModule>;

const builtinTemplates: Record<string, TemplateJson> = {};
for (const mod of Object.values(rawModules)) {
  const raw = typeof mod === 'object' && mod && 'default' in mod ? mod.default : mod;
  const parsed = parseTemplateJson(raw);
  builtinTemplates[parsed.id] = parsed;
}

export function getBuiltinTemplateJson(id: string): TemplateJson | null {
  return builtinTemplates[id] ?? null;
}

export function listBuiltinTemplateJson(): TemplateJson[] {
  return Object.values(builtinTemplates).sort((a, b) => a.name.localeCompare(b.name));
}
