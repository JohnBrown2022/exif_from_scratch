import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './App.module.css';
import ImageListPanel from './panels/ImageListPanel';
import PreviewPanel from './panels/PreviewPanel';
import InspectorPanel from './panels/InspectorPanel/InspectorPanel';
import { useExportController } from './hooks/useExportController';
import { useImages } from './hooks/useImages';
import { useSelectedExif } from './hooks/useSelectedExif';
import type { PresetPayload } from './hooks/usePresetSlots';
import {
  DEFAULT_TOPOLOGY_WATERMARK_SETTINGS,
  createLegacyProjectV2,
  fingerprintMd5Hex,
  getTopologyAutoAnchor,
  type ExportFormat,
  type JpegBackgroundMode,
  type ProjectJsonV2,
  type TemplateId,
  type TopologyWatermarkSettings,
} from '../core';
import { loadTemplateOverride, saveTemplateOverride } from '../core/render/engine/overrides';
import { useTopologyWatermarkSettings } from './hooks/useTopologyWatermarkSettings';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { images, selectedIndex, setSelectedIndex, selected, addFiles, removeSelected, clearAll } = useImages();
  const selectedFile = selected?.file ?? null;
  const selectedFileKey = useMemo(
    () => (selectedFile ? `${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}` : null),
    [selectedFile],
  );

  const [templateRenderRevision, setTemplateRenderRevision] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg');
  const [jpegQuality, setJpegQuality] = useState<number>(0.92);
  const [maxEdge, setMaxEdge] = useState<number | 'original'>('original');
  const [jpegBackground, setJpegBackground] = useState<string>('#000000');
  const [jpegBackgroundMode, setJpegBackgroundMode] = useState<JpegBackgroundMode>('color');
  const [blurRadius, setBlurRadius] = useState<number>(30);

  const [swUpdateReady, setSwUpdateReady] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        if (cancelled) return;
        setSwRegistration(reg);

        if (reg.waiting) setSwUpdateReady(true);

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;

          worker.addEventListener('statechange', () => {
            if (cancelled) return;
            if (worker.state !== 'installed') return;
            if (!navigator.serviceWorker.controller) return;
            setSwUpdateReady(true);
          });
        });
      })
      .catch(() => {
        // Ignore SW registration errors (unsupported env / private mode).
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const { settings: persistedTopologyWatermarkSettings, setSettings: setPersistedTopologyWatermarkSettings } =
    useTopologyWatermarkSettings();

  const [project, setProject] = useState<ProjectJsonV2>(() =>
    createLegacyProjectV2({
      templateId: 'bottom_bar',
      topologyWatermark: persistedTopologyWatermarkSettings,
    }),
  );

  const templateId = useMemo(() => (project.canvas.mode === 'template' ? (project.canvas.templateId as TemplateId) : 'bottom_bar'), [project.canvas]);

  const topologyWatermarkSettings = useMemo<TopologyWatermarkSettings>(() => {
    if (!Array.isArray(project.nodes)) return DEFAULT_TOPOLOGY_WATERMARK_SETTINGS;
    const base = DEFAULT_TOPOLOGY_WATERMARK_SETTINGS;
    const node = project.nodes.find((n) => n.id === 'topology_mountain' && n.type === 'plugin/topology_mountain');
    const props = node && typeof node.props === 'object' && node.props ? (node.props as Record<string, unknown>) : {};
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const asFiniteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
    const asEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => {
      if (typeof value !== 'string') return undefined;
      return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
    };

    return {
      enabled: node?.enabled === true,
      seedMode: asEnum(props.seedMode, ['file_md5', 'manual'] as const) ?? base.seedMode,
      manualSeed: typeof props.manualSeed === 'string' ? props.manualSeed : base.manualSeed,
      positionMode: asEnum(props.positionMode, ['auto', 'manual'] as const) ?? base.positionMode,
      x: clamp(asFiniteNumber(props.x) ?? base.x, 0, 1),
      y: clamp(asFiniteNumber(props.y) ?? base.y, 0, 1),
      size: clamp(asFiniteNumber(props.size) ?? base.size, 0, 1),
      density: clamp(Math.round(asFiniteNumber(props.density) ?? base.density), 4, 24),
      noise: clamp(asFiniteNumber(props.noise) ?? base.noise, 0, 3),
      alpha: clamp(asFiniteNumber(props.alpha) ?? base.alpha, 0, 1),
    };
  }, [project.nodes]);

  const updateTopologyWatermarkSettings = (patch: Partial<TopologyWatermarkSettings>) => {
    setProject((prev) => {
      const nodes = Array.isArray(prev.nodes) ? prev.nodes : [];
      const template = prev.canvas.mode === 'template' ? (prev.canvas.templateId as TemplateId) : 'bottom_bar';
      const autoAnchor = getTopologyAutoAnchor(template);

      const nextNodes = nodes.map((node) => {
        if (node.id !== 'topology_mountain' || node.type !== 'plugin/topology_mountain') return node;
        const { enabled, ...propPatch } = patch;
        const nextEnabled = typeof enabled === 'boolean' ? enabled : node.enabled;
        return {
          ...node,
          ...(typeof enabled === 'boolean' ? { enabled: nextEnabled } : null),
          props: {
            ...(typeof node.props === 'object' && node.props ? node.props : {}),
            ...propPatch,
            autoAnchor,
          },
        };
      });

      return { ...prev, nodes: nextNodes };
    });
  };

  useEffect(() => {
    const same =
      persistedTopologyWatermarkSettings.enabled === topologyWatermarkSettings.enabled &&
      persistedTopologyWatermarkSettings.seedMode === topologyWatermarkSettings.seedMode &&
      persistedTopologyWatermarkSettings.manualSeed === topologyWatermarkSettings.manualSeed &&
      persistedTopologyWatermarkSettings.positionMode === topologyWatermarkSettings.positionMode &&
      persistedTopologyWatermarkSettings.x === topologyWatermarkSettings.x &&
      persistedTopologyWatermarkSettings.y === topologyWatermarkSettings.y &&
      persistedTopologyWatermarkSettings.size === topologyWatermarkSettings.size &&
      persistedTopologyWatermarkSettings.density === topologyWatermarkSettings.density &&
      persistedTopologyWatermarkSettings.noise === topologyWatermarkSettings.noise &&
      persistedTopologyWatermarkSettings.alpha === topologyWatermarkSettings.alpha;

    if (same) return;
    setPersistedTopologyWatermarkSettings(topologyWatermarkSettings);
  }, [persistedTopologyWatermarkSettings, setPersistedTopologyWatermarkSettings, topologyWatermarkSettings]);

  const [topologyMd5, setTopologyMd5] = useState<string | null>(null);
  const [topologyMd5Error, setTopologyMd5Error] = useState<string | null>(null);
  const [isComputingTopologyMd5, setIsComputingTopologyMd5] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setTopologyMd5(null);
    setTopologyMd5Error(null);
    setIsComputingTopologyMd5(false);

    if (!selectedFile) return () => { };
    if (topologyWatermarkSettings.seedMode !== 'file_md5') return () => { };

    setIsComputingTopologyMd5(true);

    fingerprintMd5Hex(selectedFile)
      .then((value) => {
        if (cancelled) return;
        setTopologyMd5(value);
        setTopologyMd5Error(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setTopologyMd5(null);
        setTopologyMd5Error(err instanceof Error ? err.message : 'MD5 计算失败');
      })
      .finally(() => {
        if (cancelled) return;
        setIsComputingTopologyMd5(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, selectedFileKey, topologyWatermarkSettings.seedMode]);

  const { exif: selectedExif, exifError: selectedExifError, isReadingExif } = useSelectedExif(selectedFile);

  const presetPayload = useMemo<PresetPayload>(
    () => {
      void templateRenderRevision;
      return {
        templateId,
        exportFormat,
        jpegQuality,
        maxEdge,
        jpegBackground,
        jpegBackgroundMode,
        blurRadius,
        topologyWatermark: topologyWatermarkSettings,
        templateOverrides: loadTemplateOverride(templateId),
        project,
      };
    },
    [
      blurRadius,
      exportFormat,
      jpegBackground,
      jpegBackgroundMode,
      jpegQuality,
      maxEdge,
      project,
      templateId,
      topologyWatermarkSettings,
      templateRenderRevision, // re-read overrides when they change
    ],
  );

  const applyPresetPayload = (payload: PresetPayload) => {
    const nextProject =
      payload.project && payload.project.version === '2.0'
        ? payload.project
        : createLegacyProjectV2({
            templateId: payload.templateId,
            topologyWatermark: payload.topologyWatermark,
          });

    setProject(nextProject);
    setExportFormat(payload.exportFormat);
    setJpegQuality(payload.jpegQuality);
    setMaxEdge(payload.maxEdge);
    setJpegBackground(payload.jpegBackground);
    setJpegBackgroundMode(payload.jpegBackgroundMode);
    setBlurRadius(payload.blurRadius);
    // Restore template overrides
    saveTemplateOverride(payload.templateId, payload.templateOverrides ?? null);
    setTemplateRenderRevision((prev) => prev + 1);
  };

  const exportController = useExportController({
    images,
    selectedFile,
    options: {
      format: exportFormat,
      jpegQuality,
      maxEdge,
      project,
      jpegBackground,
      jpegBackgroundMode,
      blurRadius,
    },
  });

  const title = useMemo(() => {
    const count = images.length;
    if (count === 0) return 'EXIF 水印（纯本地）';
    return `EXIF 水印（${count} 张）`;
  }, [images.length]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.title}>{title}</div>
          <div className={styles.subtitle}>图片不上传；导出不包含 EXIF 元数据</div>
        </div>

        <div className={styles.headerActions}>
          {swUpdateReady ? (
            <button
              className={styles.updateButton}
              type="button"
              onClick={() => {
                const waiting = swRegistration?.waiting;
                if (!waiting) return;
                waiting.postMessage({ type: 'SKIP_WAITING' });
              }}
            >
              有更新 · 刷新
            </button>
          ) : null}
          <button className={styles.primaryButton} type="button" onClick={openFilePicker}>
            导入图片
          </button>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              if (!event.target.files) return;
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.panel}>
          <ImageListPanel
            images={images}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onImport={openFilePicker}
            onRemoveSelected={removeSelected}
            onClearAll={clearAll}
            onFilesDropped={(dropped) => addFiles(dropped)}
          />
        </section>

        <section className={styles.panel}>
          <PreviewPanel
            file={selectedFile}
            project={project}
            renderRevision={templateRenderRevision}
            exif={selectedExif}
            exifError={selectedExifError}
            isReadingExif={isReadingExif}
            jpegBackground={jpegBackground}
            jpegBackgroundMode={jpegBackgroundMode}
            blurRadius={blurRadius}
            exportFormat={exportFormat}
            seeds={{ fileMd5: topologyMd5, fallback: selectedFileKey ?? 'default' }}
          />
        </section>

        <section className={`${styles.panel} ${styles.inspectorPanel}`}>
          <InspectorPanel
            templateId={templateId}
            onTemplateOverridesChange={() => setTemplateRenderRevision((prev) => prev + 1)}
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            jpegQuality={jpegQuality}
            onJpegQualityChange={setJpegQuality}
            maxEdge={maxEdge}
            onMaxEdgeChange={setMaxEdge}
            jpegBackground={jpegBackground}
            onJpegBackgroundChange={setJpegBackground}
            jpegBackgroundMode={jpegBackgroundMode}
            onJpegBackgroundModeChange={setJpegBackgroundMode}
            blurRadius={blurRadius}
            onBlurRadiusChange={setBlurRadius}
            topologyWatermarkSettings={topologyWatermarkSettings}
            onTopologyWatermarkSettingsChange={updateTopologyWatermarkSettings}
            topologyMd5={topologyMd5}
            topologyMd5Error={topologyMd5Error}
            isComputingTopologyMd5={isComputingTopologyMd5}
            project={project}
            onProjectChange={setProject}
            presetPayload={presetPayload}
            onApplyPresetPayload={applyPresetPayload}
            hasSelection={Boolean(selectedFile)}
            imagesCount={images.length}
            isExporting={exportController.isExporting}
            exportStatus={exportController.exportStatus}
            onExportSelected={exportController.exportSelected}
            onExportAll={exportController.exportAll}
            batchState={exportController.batchState}
            onCancelBatch={exportController.cancelBatch}
            onRetryFailed={exportController.retryFailed}
            exif={selectedExif}
            exifError={selectedExifError}
            isReadingExif={isReadingExif}
          />
        </section>
      </main>
    </div>
  );
}
