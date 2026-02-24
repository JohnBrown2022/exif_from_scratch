import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_TOPOLOGY_WATERMARK_SETTINGS,
  WATERMARK_TEMPLATES,
  type ExportFormat,
  type JpegBackgroundMode,
  type TemplateId,
  type TopologyWatermarkSettings,
} from '../../core';
import type { TemplateOverride } from '../../core/render/engine/overrides';

export type PresetPayload = {
  templateId: TemplateId;
  exportFormat: ExportFormat;
  jpegQuality: number;
  maxEdge: number | 'original';
  jpegBackground: string;
  jpegBackgroundMode: JpegBackgroundMode;
  blurRadius: number;
  topologyWatermark: TopologyWatermarkSettings;
  templateOverrides?: TemplateOverride | null;
};

export type PresetSlot = {
  name: string;
  updatedAt: string;
  payload: PresetPayload;
};

type PresetSlotsV1 = {
  version: 1;
  slots: Array<PresetSlot | null>;
};

const STORAGE_KEY = 'presetSlots:v1';
const SLOTS_COUNT = 10;
const ALLOWED_TEMPLATE_IDS = WATERMARK_TEMPLATES.map((t) => t.id);

const DEFAULT_PAYLOAD: PresetPayload = {
  templateId: 'bottom_bar',
  exportFormat: 'jpeg',
  jpegQuality: 0.92,
  maxEdge: 'original',
  jpegBackground: '#000000',
  jpegBackgroundMode: 'color',
  blurRadius: 30,
  topologyWatermark: DEFAULT_TOPOLOGY_WATERMARK_SETTINGS,
  templateOverrides: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function sanitizeTemplateId(input: unknown): TemplateId {
  const id = asEnum(input, ALLOWED_TEMPLATE_IDS);
  return id ?? DEFAULT_PAYLOAD.templateId;
}

function sanitizeTopologyWatermarkSettings(raw: unknown): TopologyWatermarkSettings {
  const base = DEFAULT_TOPOLOGY_WATERMARK_SETTINGS;
  if (!isRecord(raw)) return base;

  const enabled = raw.enabled === true;
  const seedMode = asEnum(raw.seedMode, ['file_md5', 'manual'] as const) ?? base.seedMode;
  const manualSeed = typeof raw.manualSeed === 'string' ? raw.manualSeed : base.manualSeed;
  const positionMode = asEnum(raw.positionMode, ['auto', 'manual'] as const) ?? base.positionMode;

  const x = clamp(asFiniteNumber(raw.x) ?? base.x, 0, 1);
  const y = clamp(asFiniteNumber(raw.y) ?? base.y, 0, 1);
  const size = clamp(asFiniteNumber(raw.size) ?? base.size, 0, 1);
  const density = clamp(Math.round(asFiniteNumber(raw.density) ?? base.density), 4, 24);
  const noise = clamp(asFiniteNumber(raw.noise) ?? base.noise, 0, 3);
  const alpha = clamp(asFiniteNumber(raw.alpha) ?? base.alpha, 0, 1);

  return {
    enabled,
    seedMode,
    manualSeed,
    positionMode,
    x,
    y,
    size,
    density,
    noise,
    alpha,
  };
}

function sanitizePayload(raw: unknown): PresetPayload {
  const base = DEFAULT_PAYLOAD;
  if (!isRecord(raw)) return base;

  const templateId = sanitizeTemplateId(raw.templateId);
  const exportFormat = asEnum(raw.exportFormat, ['jpeg', 'png'] as const) ?? base.exportFormat;
  const jpegQuality = clamp(asFiniteNumber(raw.jpegQuality) ?? base.jpegQuality, 0.6, 0.95);

  const maxEdgeRaw = raw.maxEdge;
  const maxEdgeAllowed = [2048, 4096] as const;
  const maxEdge =
    maxEdgeRaw === 'original'
      ? ('original' as const)
      : typeof maxEdgeRaw === 'number' && (maxEdgeAllowed as readonly number[]).includes(maxEdgeRaw)
        ? maxEdgeRaw
        : base.maxEdge;

  const jpegBackground = typeof raw.jpegBackground === 'string' ? raw.jpegBackground : base.jpegBackground;
  const jpegBackgroundMode = asEnum(raw.jpegBackgroundMode, ['color', 'blur'] as const) ?? base.jpegBackgroundMode;
  const blurRadius = clamp(asFiniteNumber(raw.blurRadius) ?? base.blurRadius, 5, 80);
  const topologyWatermark = sanitizeTopologyWatermarkSettings(raw.topologyWatermark);

  // templateOverrides is an opaque blob — we pass through whatever was saved.
  // The overrides system already sanitizes on load via loadTemplateOverride.
  const templateOverrides = isRecord(raw.templateOverrides) ? (raw.templateOverrides as TemplateOverride) : null;

  return {
    templateId,
    exportFormat,
    jpegQuality,
    maxEdge,
    jpegBackground,
    jpegBackgroundMode,
    blurRadius,
    topologyWatermark,
    templateOverrides,
  };
}

function slotLabel(index: number): string {
  return `槽位 ${index + 1}`;
}

function sanitizeSlot(index: number, raw: unknown): PresetSlot | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : slotLabel(index);
  const updatedAtRaw = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
  const updatedAt = updatedAtRaw && Number.isFinite(Date.parse(updatedAtRaw)) ? updatedAtRaw : new Date().toISOString();
  const payload = sanitizePayload(raw.payload);
  return { name, updatedAt, payload };
}

function defaultSlots(): Array<PresetSlot | null> {
  return Array.from({ length: SLOTS_COUNT }, () => null);
}

function sanitizeSlotsFile(raw: unknown): Array<PresetSlot | null> {
  if (!isRecord(raw)) return defaultSlots();
  if (raw.version !== 1) return defaultSlots();
  if (!Array.isArray(raw.slots)) return defaultSlots();

  const out: Array<PresetSlot | null> = [];
  for (let i = 0; i < SLOTS_COUNT; i++) {
    out.push(sanitizeSlot(i, raw.slots[i]));
  }
  return out;
}

function loadFromStorage(): Array<PresetSlot | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSlots();
    return sanitizeSlotsFile(JSON.parse(raw) as unknown);
  } catch {
    return defaultSlots();
  }
}

function buildSlotsFile(slots: Array<PresetSlot | null>): PresetSlotsV1 {
  const normalized = Array.from({ length: SLOTS_COUNT }, (_, i) => slots[i] ?? null);
  return { version: 1, slots: normalized };
}

export function usePresetSlots() {
  const [slots, setSlots] = useState<Array<PresetSlot | null>>(() => loadFromStorage());

  useEffect(() => {
    try {
      const file = buildSlotsFile(slots);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    } catch {
      // Ignore storage errors (quota/private mode).
    }
  }, [slots]);

  const filledCount = useMemo(() => slots.filter(Boolean).length, [slots]);

  function saveSlot(index: number, payload: PresetPayload) {
    setSlots((prev) => {
      const next = [...prev];
      const existing = next[index];
      const name = existing?.name ?? slotLabel(index);
      next[index] = { name, updatedAt: new Date().toISOString(), payload };
      return next;
    });
  }

  function renameSlot(index: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSlots((prev) => {
      const next = [...prev];
      const existing = next[index];
      if (!existing) return prev;
      next[index] = { ...existing, name: trimmed };
      return next;
    });
  }

  function clearSlot(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  function exportJson(): Blob {
    const file = buildSlotsFile(slots);
    return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  }

  async function importJson(file: File): Promise<{ imported: number; ignored: number }> {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const sourceSlotsLen = isRecord(parsed) && Array.isArray(parsed.slots) ? Math.min(SLOTS_COUNT, parsed.slots.length) : 0;

    const nextSlots = sanitizeSlotsFile(parsed);
    const imported = nextSlots.filter(Boolean).length;
    const ignored = Math.max(0, sourceSlotsLen - imported);
    setSlots(nextSlots);
    return { imported, ignored };
  }

  return {
    slots,
    filledCount,
    saveSlot,
    renameSlot,
    clearSlot,
    exportJson,
    importJson,
  };
}
