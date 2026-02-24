import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import {
  DEFAULT_TOPOLOGY_WATERMARK_SETTINGS,
  type ExportFormat,
  type JpegBackgroundMode,
  type TemplateId,
  type TopologyWatermarkSettings,
} from '../../core';
import type { PresetPayload } from '../hooks/usePresetSlots';
import { loadTemplateOverride, saveTemplateOverride } from '../../core/render/engine/overrides';

type AppSettingsState = {
  templateId: TemplateId;
  templateRenderRevision: number;

  exportFormat: ExportFormat;
  jpegQuality: number;
  maxEdge: number | 'original';
  jpegBackground: string;
  jpegBackgroundMode: JpegBackgroundMode;
  blurRadius: number;

  topologyWatermark: TopologyWatermarkSettings;
};

type Action =
  | { type: 'SET_TEMPLATE'; templateId: TemplateId }
  | { type: 'BUMP_TEMPLATE_RENDER_REVISION' }
  | { type: 'SET_EXPORT_FORMAT'; exportFormat: ExportFormat }
  | { type: 'SET_JPEG_QUALITY'; jpegQuality: number }
  | { type: 'SET_MAX_EDGE'; maxEdge: number | 'original' }
  | { type: 'SET_JPEG_BACKGROUND'; jpegBackground: string }
  | { type: 'SET_JPEG_BACKGROUND_MODE'; jpegBackgroundMode: JpegBackgroundMode }
  | { type: 'SET_BLUR_RADIUS'; blurRadius: number }
  | { type: 'PATCH_TOPOLOGY_WATERMARK'; patch: Partial<TopologyWatermarkSettings> }
  | { type: 'APPLY_PRESET_PAYLOAD'; payload: PresetPayload };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function sanitizeTopologySettings(raw: unknown): TopologyWatermarkSettings {
  const base = DEFAULT_TOPOLOGY_WATERMARK_SETTINGS;
  if (!raw || typeof raw !== 'object') return base;
  const record = raw as Record<string, unknown>;

  const enabled = record.enabled === true;
  const seedMode = record.seedMode === 'manual' ? 'manual' : 'file_md5';
  const manualSeed = typeof record.manualSeed === 'string' ? record.manualSeed : base.manualSeed;
  const positionMode = record.positionMode === 'manual' ? 'manual' : 'auto';

  const x = clamp(typeof record.x === 'number' ? record.x : base.x, 0, 1);
  const y = clamp(typeof record.y === 'number' ? record.y : base.y, 0, 1);
  const size = clamp(typeof record.size === 'number' ? record.size : base.size, 0, 1);
  const density = clamp(Math.round(typeof record.density === 'number' ? record.density : base.density), 4, 24);
  const noise = clamp(typeof record.noise === 'number' ? record.noise : base.noise, 0, 3);
  const alpha = clamp(typeof record.alpha === 'number' ? record.alpha : base.alpha, 0, 1);

  return { enabled, seedMode, manualSeed, positionMode, x, y, size, density, noise, alpha };
}

const STORAGE_KEY = 'appSettings:v2';

function loadInitialState(): AppSettingsState {
  const base: AppSettingsState = {
    templateId: 'bottom_bar',
    templateRenderRevision: 0,
    exportFormat: 'jpeg',
    jpegQuality: 0.92,
    maxEdge: 'original',
    jpegBackground: '#000000',
    jpegBackgroundMode: 'color',
    blurRadius: 30,
    topologyWatermark: DEFAULT_TOPOLOGY_WATERMARK_SETTINGS,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return base;
    const record = parsed as Record<string, unknown>;

    const templateId = (typeof record.templateId === 'string' ? record.templateId : base.templateId) as TemplateId;
    const exportFormat = record.exportFormat === 'png' ? 'png' : 'jpeg';
    const jpegQuality = clamp(typeof record.jpegQuality === 'number' ? record.jpegQuality : base.jpegQuality, 0.6, 0.95);
    const maxEdge = record.maxEdge === 'original' ? 'original' : typeof record.maxEdge === 'number' ? record.maxEdge : base.maxEdge;
    const jpegBackground = typeof record.jpegBackground === 'string' ? record.jpegBackground : base.jpegBackground;
    const jpegBackgroundMode = record.jpegBackgroundMode === 'blur' ? 'blur' : 'color';
    const blurRadius = clamp(typeof record.blurRadius === 'number' ? record.blurRadius : base.blurRadius, 1, 200);
    const topologyWatermark = sanitizeTopologySettings(record.topologyWatermark);

    return {
      ...base,
      templateId,
      exportFormat,
      jpegQuality,
      maxEdge,
      jpegBackground,
      jpegBackgroundMode,
      blurRadius,
      topologyWatermark,
    };
  } catch {
    return base;
  }
}

function reducer(state: AppSettingsState, action: Action): AppSettingsState {
  switch (action.type) {
    case 'SET_TEMPLATE':
      return { ...state, templateId: action.templateId };
    case 'BUMP_TEMPLATE_RENDER_REVISION':
      return { ...state, templateRenderRevision: state.templateRenderRevision + 1 };
    case 'SET_EXPORT_FORMAT':
      return { ...state, exportFormat: action.exportFormat };
    case 'SET_JPEG_QUALITY':
      return { ...state, jpegQuality: action.jpegQuality };
    case 'SET_MAX_EDGE':
      return { ...state, maxEdge: action.maxEdge };
    case 'SET_JPEG_BACKGROUND':
      return { ...state, jpegBackground: action.jpegBackground };
    case 'SET_JPEG_BACKGROUND_MODE':
      return { ...state, jpegBackgroundMode: action.jpegBackgroundMode };
    case 'SET_BLUR_RADIUS':
      return { ...state, blurRadius: action.blurRadius };
    case 'PATCH_TOPOLOGY_WATERMARK':
      return { ...state, topologyWatermark: { ...state.topologyWatermark, ...action.patch } };
    case 'APPLY_PRESET_PAYLOAD':
      return {
        ...state,
        templateId: action.payload.templateId,
        exportFormat: action.payload.exportFormat,
        jpegQuality: action.payload.jpegQuality,
        maxEdge: action.payload.maxEdge,
        jpegBackground: action.payload.jpegBackground,
        jpegBackgroundMode: action.payload.jpegBackgroundMode,
        blurRadius: action.payload.blurRadius,
        topologyWatermark: action.payload.topologyWatermark,
        templateRenderRevision: state.templateRenderRevision + 1,
      };
    default: {
      const neverAction: never = action;
      void neverAction;
      return state;
    }
  }
}

type AppSettingsContextValue = {
  state: AppSettingsState;
  presetPayload: PresetPayload;
  actions: {
    setTemplateId: (templateId: TemplateId) => void;
    bumpTemplateRenderRevision: () => void;
    setExportFormat: (exportFormat: ExportFormat) => void;
    setJpegQuality: (jpegQuality: number) => void;
    setMaxEdge: (maxEdge: number | 'original') => void;
    setJpegBackground: (jpegBackground: string) => void;
    setJpegBackgroundMode: (jpegBackgroundMode: JpegBackgroundMode) => void;
    setBlurRadius: (blurRadius: number) => void;
    patchTopologyWatermark: (patch: Partial<TopologyWatermarkSettings>) => void;
    applyPresetPayload: (payload: PresetPayload) => void;
  };
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  const presetPayload = useMemo<PresetPayload>(() => {
    void state.templateRenderRevision;
    return {
      templateId: state.templateId,
      exportFormat: state.exportFormat,
      jpegQuality: state.jpegQuality,
      maxEdge: state.maxEdge,
      jpegBackground: state.jpegBackground,
      jpegBackgroundMode: state.jpegBackgroundMode,
      blurRadius: state.blurRadius,
      topologyWatermark: state.topologyWatermark,
      templateOverrides: loadTemplateOverride(state.templateId),
    };
  }, [
    state.blurRadius,
    state.exportFormat,
    state.jpegBackground,
    state.jpegBackgroundMode,
    state.jpegQuality,
    state.maxEdge,
    state.templateId,
    state.templateRenderRevision,
    state.topologyWatermark,
  ]);

  useEffect(() => {
    try {
      const toSave = {
        templateId: state.templateId,
        exportFormat: state.exportFormat,
        jpegQuality: state.jpegQuality,
        maxEdge: state.maxEdge,
        jpegBackground: state.jpegBackground,
        jpegBackgroundMode: state.jpegBackgroundMode,
        blurRadius: state.blurRadius,
        topologyWatermark: state.topologyWatermark,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Ignore storage errors (quota/private mode).
    }
  }, [
    state.blurRadius,
    state.exportFormat,
    state.jpegBackground,
    state.jpegBackgroundMode,
    state.jpegQuality,
    state.maxEdge,
    state.templateId,
    state.topologyWatermark,
  ]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      state,
      presetPayload,
      actions: {
        setTemplateId: (templateId) => dispatch({ type: 'SET_TEMPLATE', templateId }),
        bumpTemplateRenderRevision: () => dispatch({ type: 'BUMP_TEMPLATE_RENDER_REVISION' }),
        setExportFormat: (exportFormat) => dispatch({ type: 'SET_EXPORT_FORMAT', exportFormat }),
        setJpegQuality: (jpegQuality) => dispatch({ type: 'SET_JPEG_QUALITY', jpegQuality }),
        setMaxEdge: (maxEdge) => dispatch({ type: 'SET_MAX_EDGE', maxEdge }),
        setJpegBackground: (jpegBackground) => dispatch({ type: 'SET_JPEG_BACKGROUND', jpegBackground }),
        setJpegBackgroundMode: (jpegBackgroundMode) => dispatch({ type: 'SET_JPEG_BACKGROUND_MODE', jpegBackgroundMode }),
        setBlurRadius: (blurRadius) => dispatch({ type: 'SET_BLUR_RADIUS', blurRadius }),
        patchTopologyWatermark: (patch) => dispatch({ type: 'PATCH_TOPOLOGY_WATERMARK', patch }),
        applyPresetPayload: (payload) => {
          saveTemplateOverride(payload.templateId, payload.templateOverrides ?? null);
          dispatch({ type: 'APPLY_PRESET_PAYLOAD', payload });
        },
      },
    }),
    [presetPayload, state],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const value = useContext(AppSettingsContext);
  if (!value) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return value;
}

