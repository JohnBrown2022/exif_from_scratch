import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './App.module.css';
import ImageListPanel from './panels/ImageListPanel';
import PreviewPanel from './panels/PreviewPanel';
import InspectorPanel from './panels/InspectorPanel/InspectorPanel';
import { useExportController } from './hooks/useExportController';
import { useImages } from './hooks/useImages';
import { useSelectedExif } from './hooks/useSelectedExif';
import type { PresetPayload } from './hooks/usePresetSlots';
import { fingerprintMd5Hex, type ExportFormat, type JpegBackgroundMode, type TemplateId, type TopologyWatermarkRenderOptions, type TopologyWatermarkSettings } from '../core';
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

  const [templateId, setTemplateId] = useState<TemplateId>('bottom_bar');
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

  const { settings: topologyWatermarkSettings, setSettings: setTopologyWatermarkSettings } = useTopologyWatermarkSettings();
  const updateTopologyWatermarkSettings = (patch: Partial<TopologyWatermarkSettings>) => {
    setTopologyWatermarkSettings((prev) => ({ ...prev, ...patch }));
  };

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

  const topologyWatermarkRender = useMemo<TopologyWatermarkRenderOptions | null>(() => {
    if (!topologyWatermarkSettings.enabled) return null;

    const manualSeed = topologyWatermarkSettings.manualSeed.trim();
    const seed =
      topologyWatermarkSettings.seedMode === 'manual'
        ? manualSeed || topologyMd5 || selectedFileKey || 'default'
        : topologyMd5 || selectedFileKey || 'default';

    return {
      enabled: true,
      seed,
      positionMode: topologyWatermarkSettings.positionMode,
      x: topologyWatermarkSettings.x,
      y: topologyWatermarkSettings.y,
      size: topologyWatermarkSettings.size,
      density: topologyWatermarkSettings.density,
      noise: topologyWatermarkSettings.noise,
      alpha: topologyWatermarkSettings.alpha,
    };
  }, [selectedFileKey, topologyMd5, topologyWatermarkSettings]);

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
      };
    },
    [
      blurRadius,
      exportFormat,
      jpegBackground,
      jpegBackgroundMode,
      jpegQuality,
      maxEdge,
      templateId,
      topologyWatermarkSettings,
      templateRenderRevision, // re-read overrides when they change
    ],
  );

  const applyPresetPayload = (payload: PresetPayload) => {
    setTemplateId(payload.templateId);
    setExportFormat(payload.exportFormat);
    setJpegQuality(payload.jpegQuality);
    setMaxEdge(payload.maxEdge);
    setJpegBackground(payload.jpegBackground);
    setJpegBackgroundMode(payload.jpegBackgroundMode);
    setBlurRadius(payload.blurRadius);
    setTopologyWatermarkSettings(payload.topologyWatermark);
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
      templateId,
      jpegBackground,
      jpegBackgroundMode,
      blurRadius,
      topologyWatermark: topologyWatermarkSettings,
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
            templateId={templateId}
            renderRevision={templateRenderRevision}
            exif={selectedExif}
            exifError={selectedExifError}
            isReadingExif={isReadingExif}
            jpegBackground={jpegBackground}
            jpegBackgroundMode={jpegBackgroundMode}
            blurRadius={blurRadius}
            exportFormat={exportFormat}
            topologyWatermark={topologyWatermarkRender}
          />
        </section>

        <section className={styles.panel}>
          <InspectorPanel
            templateId={templateId}
            onTemplateChange={setTemplateId}
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
