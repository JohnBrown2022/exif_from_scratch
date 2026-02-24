import { clamp } from '../utils/clamp';

import { renderTopologyMountainStamp } from './topologyMountain';

export type SettingsField =
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number; default: number }
  | { kind: 'toggle'; key: string; label: string; default: boolean }
  | { kind: 'select'; key: string; label: string; options: Array<{ value: string; label: string }>; default: string }
  | { kind: 'text'; key: string; label: string; placeholder?: string; default: string };

export type ArtWatermarkPlugin = {
  id: string;
  name: string;
  description: string;
  defaultSettings: Record<string, unknown>;
  settingsSchema: SettingsField[];
  renderStamp: (input: { seed: string; sizePx: number; alpha: number; settings: Record<string, unknown> }) => CanvasImageSource;
};

const registry = new Map<string, ArtWatermarkPlugin>();

export function registerArtWatermark(plugin: ArtWatermarkPlugin) {
  registry.set(plugin.id, plugin);
}

export function getArtWatermark(id: string): ArtWatermarkPlugin | null {
  return registry.get(id) ?? null;
}

export function listArtWatermarks(): ArtWatermarkPlugin[] {
  return Array.from(registry.values());
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// ─── Built-in plugins ───────────────────────────────────────

const topologyMountainPlugin: ArtWatermarkPlugin = {
  id: 'topology_mountain',
  name: '山水徽',
  description: '基于照片生成可复现的山水印章。',
  defaultSettings: {
    density: 12,
    noise: 1.5,
  },
  settingsSchema: [
    { kind: 'slider', key: 'density', label: '线条密度', min: 4, max: 24, step: 1, default: 12 },
    { kind: 'slider', key: 'noise', label: '随机变形', min: 0, max: 3, step: 0.1, default: 1.5 },
  ],
  renderStamp: ({ seed, sizePx, alpha, settings }) => {
    const density = clamp(Math.round(numberOr(settings.density, 12)), 4, 24);
    const noise = clamp(numberOr(settings.noise, 1.5), 0, 3);
    return renderTopologyMountainStamp({
      seed,
      sizePx,
      density,
      noise,
      alpha: clamp(alpha, 0, 1),
    });
  },
};

registerArtWatermark(topologyMountainPlugin);

