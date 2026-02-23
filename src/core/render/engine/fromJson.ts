import type { TemplateJson } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid template JSON: "${key}" must be a non-empty string`);
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid template JSON: "${key}" must be a finite number`);
  }
  return value;
}

export function parseTemplateJson(value: unknown): TemplateJson {
  if (!isRecord(value)) throw new Error('Invalid template JSON: root must be an object');

  // Minimal validation (built-ins are trusted, but keep guardrails)
  requireString(value, 'id');
  requireString(value, 'name');
  requireString(value, 'description');

  const scaleModel = value.scaleModel;
  if (!isRecord(scaleModel)) throw new Error('Invalid template JSON: "scaleModel" must be an object');
  requireNumber(scaleModel, 'designWidth');
  requireNumber(scaleModel, 'min');
  requireNumber(scaleModel, 'max');

  const layout = value.layout;
  if (!isRecord(layout) || typeof layout.kind !== 'string') {
    throw new Error('Invalid template JSON: "layout.kind" must be a string');
  }

  const elements = value.elements;
  if (!Array.isArray(elements)) throw new Error('Invalid template JSON: "elements" must be an array');

  return value as unknown as TemplateJson;
}

