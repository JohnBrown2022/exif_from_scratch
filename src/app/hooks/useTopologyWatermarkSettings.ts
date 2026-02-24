import { useEffect, useState } from 'react';

import { DEFAULT_TOPOLOGY_WATERMARK_SETTINGS, type TopologyWatermarkSettings } from '../../core';

const STORAGE_KEY = 'topologyWatermarkSettings:v1';

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

function sanitizeSettings(raw: unknown): TopologyWatermarkSettings {
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

function loadSettingsFromStorage(): TopologyWatermarkSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TOPOLOGY_WATERMARK_SETTINGS;
    return sanitizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_TOPOLOGY_WATERMARK_SETTINGS;
  }
}

export function useTopologyWatermarkSettings() {
  const [settings, setSettings] = useState<TopologyWatermarkSettings>(() => loadSettingsFromStorage());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors (quota/private mode).
    }
  }, [settings]);

  return { settings, setSettings };
}

