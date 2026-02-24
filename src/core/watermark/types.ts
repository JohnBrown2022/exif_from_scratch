export type TopologyWatermarkSeedMode = 'file_md5' | 'manual';

export type TopologyWatermarkPositionMode = 'auto' | 'manual';

export type TopologyWatermarkSettings = {
  enabled: boolean;
  seedMode: TopologyWatermarkSeedMode;
  manualSeed: string;
  positionMode: TopologyWatermarkPositionMode;
  x: number;
  y: number;
  size: number;
  density: number;
  noise: number;
  alpha: number;
};

export type TopologyWatermarkRenderOptions = Omit<TopologyWatermarkSettings, 'seedMode' | 'manualSeed'> & {
  seed: string;
};

export const DEFAULT_TOPOLOGY_WATERMARK_SETTINGS: TopologyWatermarkSettings = {
  enabled: false,
  seedMode: 'file_md5',
  manualSeed: '',
  positionMode: 'auto',
  x: 0.85,
  y: 0.85,
  size: 0.18,
  density: 12,
  noise: 1.5,
  alpha: 0.45,
};

