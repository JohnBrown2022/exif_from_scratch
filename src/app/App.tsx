import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './App.module.css';
import ImageListPanel from './panels/ImageListPanel';
import PreviewPanel from './panels/PreviewPanel';
import InspectorPanel from './panels/InspectorPanel/InspectorPanel';
import OnboardingPanel from './panels/OnboardingPanel';
import { useExportController } from './hooks/useExportController';
import { useImages } from './hooks/useImages';
import { useSelectedExif } from './hooks/useSelectedExif';
import { fingerprintMd5Hex, type TopologyWatermarkRenderOptions } from '../core';
import { AppSettingsProvider, useAppSettings } from './state/appSettings';

export default function App() {
  return (
    <AppSettingsProvider>
      <AppInner />
    </AppSettingsProvider>
  );
}

function AppInner() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { images, selectedIndex, setSelectedIndex, selected, addFiles, removeSelected, clearAll } = useImages();
  const selectedFile = selected?.file ?? null;
  const selectedFileKey = useMemo(
    () => (selectedFile ? `${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}` : null),
    [selectedFile],
  );

  const { state: settings } = useAppSettings();

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

  const [topologyMd5, setTopologyMd5] = useState<string | null>(null);
  const [topologyMd5Error, setTopologyMd5Error] = useState<string | null>(null);
  const [isComputingTopologyMd5, setIsComputingTopologyMd5] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setTopologyMd5(null);
    setTopologyMd5Error(null);
    setIsComputingTopologyMd5(false);

    if (!selectedFile) return () => { };
    if (settings.topologyWatermark.seedMode !== 'file_md5') return () => { };

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
  }, [selectedFile, selectedFileKey, settings.topologyWatermark.seedMode]);

  const topologyWatermarkRender = useMemo<TopologyWatermarkRenderOptions | null>(() => {
    if (!settings.topologyWatermark.enabled) return null;

    const manualSeed = settings.topologyWatermark.manualSeed.trim();
    const seed =
      settings.topologyWatermark.seedMode === 'manual'
        ? manualSeed || topologyMd5 || selectedFileKey || 'default'
        : topologyMd5 || selectedFileKey || 'default';

    return {
      enabled: true,
      seed,
      positionMode: settings.topologyWatermark.positionMode,
      x: settings.topologyWatermark.x,
      y: settings.topologyWatermark.y,
      size: settings.topologyWatermark.size,
      density: settings.topologyWatermark.density,
      noise: settings.topologyWatermark.noise,
      alpha: settings.topologyWatermark.alpha,
    };
  }, [selectedFileKey, settings.topologyWatermark, topologyMd5]);

  const { exif: selectedExif, exifError: selectedExifError, isReadingExif } = useSelectedExif(selectedFile);

  const exportController = useExportController({
    images,
    selectedFile,
    options: {
      format: settings.exportFormat,
      jpegQuality: settings.jpegQuality,
      maxEdge: settings.maxEdge,
      templateId: settings.templateId,
      jpegBackground: settings.jpegBackground,
      jpegBackgroundMode: settings.jpegBackgroundMode,
      blurRadius: settings.blurRadius,
      topologyWatermark: settings.topologyWatermark,
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

  const isEmpty = images.length === 0;

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

      <main className={`${styles.main} ${isEmpty ? styles.mainEmpty : ''}`}>
        {isEmpty ? (
          <section className={`${styles.panel} ${styles.panelEmpty}`}>
            <OnboardingPanel onPickFiles={openFilePicker} onFilesDropped={(files) => addFiles(files)} />
          </section>
        ) : (
          <>
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
                exif={selectedExif}
                exifError={selectedExifError}
                isReadingExif={isReadingExif}
                topologyWatermark={topologyWatermarkRender}
                isExporting={exportController.isExporting}
                onQuickExport={exportController.exportSelected}
              />
            </section>

            <section className={styles.panel}>
              <InspectorPanel
                topologyMd5={topologyMd5}
                topologyMd5Error={topologyMd5Error}
                isComputingTopologyMd5={isComputingTopologyMd5}
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
          </>
        )}
      </main>
    </div>
  );
}
