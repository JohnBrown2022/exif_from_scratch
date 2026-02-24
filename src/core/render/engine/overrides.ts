import { clamp } from '../../utils/clamp';

export type GridOverride = {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
};

export type ElementOverride = {
  visible?: boolean;
  grid?: GridOverride;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
  logoStyle?: 'color' | 'mono';
  monoColor?: string;
  text?: string;
};

export type TemplateOverride = {
  elements?: Record<string, ElementOverride>;
};

const STORAGE_PREFIX = 'templateOverride:';

function storageKey(templateId: string): string {
  return `${STORAGE_PREFIX}${templateId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function sanitizeGridOverride(value: unknown): GridOverride | undefined {
  if (!isRecord(value)) return undefined;
  const col = asFiniteNumber(value.col);
  const colSpan = asFiniteNumber(value.colSpan);
  const row = asFiniteNumber(value.row);
  const rowSpan = asFiniteNumber(value.rowSpan);
  if (typeof col === 'undefined') return undefined;
  if (typeof colSpan === 'undefined') return undefined;
  if (typeof row === 'undefined') return undefined;
  if (typeof rowSpan === 'undefined') return undefined;
  return { col, colSpan, row, rowSpan };
}

function sanitizeElementOverride(value: unknown): ElementOverride | null {
  if (!isRecord(value)) return null;
  const next: ElementOverride = {};

  if (value.visible === false) next.visible = false;

  const grid = sanitizeGridOverride(value.grid);
  if (grid) next.grid = grid;

  const align = asEnum(value.align, ['left', 'center', 'right'] as const);
  if (align) next.align = align;

  const vAlign = asEnum(value.vAlign, ['top', 'middle', 'bottom'] as const);
  if (vAlign) next.vAlign = vAlign;

  const logoStyle = asEnum(value.logoStyle, ['color', 'mono'] as const);
  if (logoStyle) next.logoStyle = logoStyle;

  if (typeof value.monoColor === 'string') next.monoColor = value.monoColor;
  if (typeof value.text === 'string') next.text = value.text;

  return Object.keys(next).length ? next : null;
}

function sanitizeTemplateOverride(value: unknown): TemplateOverride | null {
  if (!isRecord(value)) return null;
  const rawElements = value.elements;
  if (!isRecord(rawElements)) return null;

  const elements: Record<string, ElementOverride> = {};
  for (const [id, raw] of Object.entries(rawElements)) {
    const ov = sanitizeElementOverride(raw);
    if (ov) elements[id] = ov;
  }

  if (Object.keys(elements).length === 0) return null;
  return { elements };
}

export function loadTemplateOverride(templateId: string): TemplateOverride | null {
  try {
    const raw = localStorage.getItem(storageKey(templateId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeTemplateOverride(parsed);
  } catch {
    return null;
  }
}

export function saveTemplateOverride(templateId: string, override: TemplateOverride | null) {
  try {
    if (!override) {
      localStorage.removeItem(storageKey(templateId));
      return;
    }
    localStorage.setItem(storageKey(templateId), JSON.stringify(override));
  } catch {
    // Ignore storage errors (quota/private mode).
  }
}

export function setElementOverride(
  templateId: string,
  elementId: string,
  patch: Partial<ElementOverride>,
) {
  const current = loadTemplateOverride(templateId) ?? {};
  const elements = { ...(current.elements ?? {}) };
  const prev = elements[elementId] ?? {};
  const next: ElementOverride = { ...prev, ...patch };

  if (typeof patch.grid !== 'undefined') {
    if (patch.grid) next.grid = { ...(prev.grid ?? ({} as GridOverride)), ...patch.grid };
    else next.grid = undefined;
  }

  if (next.visible !== false) delete next.visible;
  if (typeof next.grid === 'undefined') delete next.grid;
  if (typeof next.align === 'undefined') delete next.align;
  if (typeof next.vAlign === 'undefined') delete next.vAlign;
  if (typeof next.logoStyle === 'undefined') delete next.logoStyle;
  if (typeof next.monoColor === 'undefined') delete next.monoColor;
  if (typeof next.text === 'undefined') delete next.text;

  if (Object.keys(next).length === 0) {
    delete elements[elementId];
  } else {
    elements[elementId] = next;
  }

  if (Object.keys(elements).length === 0) {
    saveTemplateOverride(templateId, null);
    return;
  }

  saveTemplateOverride(templateId, { ...current, elements });
}

export function clearElementOverride(templateId: string, elementId: string) {
  const current = loadTemplateOverride(templateId);
  if (!current?.elements?.[elementId]) return;
  const elements = { ...current.elements };
  delete elements[elementId];
  if (Object.keys(elements).length === 0) {
    saveTemplateOverride(templateId, null);
    return;
  }
  saveTemplateOverride(templateId, { ...current, elements });
}

export function normalizeHexColor(input: string | undefined, fallback: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1]!;
    const g = raw[2]!;
    const b = raw[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function clampOpacity(opacity: number | undefined): number | undefined {
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) return undefined;
  return clamp(opacity, 0, 1);
}
