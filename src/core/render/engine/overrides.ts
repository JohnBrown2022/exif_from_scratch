import { clamp } from '../../utils/clamp';

export type ElementOverride = {
  visible?: boolean;
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

export function loadTemplateOverride(templateId: string): TemplateOverride | null {
  try {
    const raw = localStorage.getItem(storageKey(templateId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as TemplateOverride;
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

  if (next.visible !== false) delete next.visible;
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
