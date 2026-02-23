import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './App.module.css';
import ControlsPanel, { type ExportFormat } from './panels/ControlsPanel';
import ImageListPanel from './panels/ImageListPanel';
import PreviewPanel from './panels/PreviewPanel';
import {
  downloadBlob,
  exportWatermarkedImage,
  readExif,
  runBatchExport,
  type BatchUpdate,
  type BatchJob,
  type ExifData,
  type TemplateId,
} from '../core';

type ImageItem = {
  id: string;
  file: File;
  url: string;
};

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const [templateId, setTemplateId] = useState<TemplateId>('bottom_bar');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg');
  const [jpegQuality, setJpegQuality] = useState<number>(0.92);
  const [maxEdge, setMaxEdge] = useState<number | 'original'>('original');
  const [jpegBackground, setJpegBackground] = useState<string>('#000000');

  const [selectedExif, setSelectedExif] = useState<ExifData | null>(null);
  const [selectedExifError, setSelectedExifError] = useState<string | null>(null);
  const [isReadingExif, setIsReadingExif] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const [batchState, setBatchState] = useState<BatchUpdate | null>(null);

  const batchAbortRef = useRef<AbortController | null>(null);
  const imagesRef = useRef<ImageItem[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
    };
  }, []);

  const selected = images[selectedIndex] ?? null;
  const selectedFile = selected?.file ?? null;

  const title = useMemo(() => {
    const count = images.length;
    if (count === 0) return 'EXIF 水印（纯本地）';
    return `EXIF 水印（${count} 张）`;
  }, [images.length]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function addFiles(nextFiles: FileList | File[]) {
    const next = Array.from(nextFiles).filter((file) => {
      if (file.type.startsWith('image/')) return true;
      const name = file.name.toLowerCase();
      return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/.test(name);
    });
    if (next.length === 0) return;

    const wasEmpty = images.length === 0;
    setImages((prev) => {
      const merged = [
        ...prev,
        ...next.map((file) => ({ id: createId(), file, url: URL.createObjectURL(file) })),
      ];
      return merged;
    });

    if (wasEmpty) setSelectedIndex(0);
  }

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (images.length === 0) return 0;
      return Math.max(0, Math.min(prev, images.length - 1));
    });
  }, [images.length]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedFile) {
        setSelectedExif(null);
        setSelectedExifError(null);
        return;
      }

      setIsReadingExif(true);
      const result = await readExif(selectedFile);
      if (cancelled) return;

      setSelectedExif(result.exif);
      setSelectedExifError(result.error);
      setIsReadingExif(false);
    }

    run().catch((err) => {
      if (cancelled) return;
      setSelectedExif(null);
      setSelectedExifError(err instanceof Error ? err.message : 'Unknown EXIF error');
      setIsReadingExif(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  async function exportSelected() {
    if (!selectedFile || isExporting) return;

    setIsExporting(true);
    setExportStatus(null);

    try {
      const { blob, filename, exifError } = await exportWatermarkedImage(selectedFile, {
        format: exportFormat,
        jpegQuality,
        maxEdge,
        templateId,
        jpegBackground,
      });
      downloadBlob(blob, filename);
      setExportStatus(exifError ? `导出完成（EXIF 解析失败：${exifError}）` : '导出完成');
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  }

  function createBatchJobs(targetImages: Array<{ id: string; file: File }>): BatchJob[] {
    return targetImages.map((image) => ({
      id: image.id,
      file: image.file,
      status: 'queued',
      error: null,
      filename: null,
    }));
  }

  async function exportBatch(targetImages: Array<{ id: string; file: File }>, doneMessage: string) {
    if (targetImages.length === 0 || isExporting) return;

    const controller = new AbortController();
    batchAbortRef.current = controller;

    setIsExporting(true);
    setExportStatus(null);

    const jobs = createBatchJobs(targetImages);

    const options = {
      format: exportFormat,
      jpegQuality,
      maxEdge,
      templateId,
      jpegBackground,
    } as const;

    await runBatchExport(
      jobs,
      options,
      (update) => setBatchState(update),
      async ({ blob, filename }) => {
        downloadBlob(blob, filename);
        await new Promise((r) => setTimeout(r, 120));
      },
      controller.signal,
    );

    setExportStatus(controller.signal.aborted ? '已取消批量导出' : doneMessage);
    setIsExporting(false);
  }

  async function exportAll() {
    await exportBatch(
      images.map((image) => ({ id: image.id, file: image.file })),
      '批量导出完成（逐张下载）',
    );
  }

  function cancelBatch() {
    batchAbortRef.current?.abort();
  }

  async function retryFailed() {
    if (!batchState || batchState.running) return;
    const failedJobs = batchState.jobs.filter((job) => job.status === 'error');
    if (failedJobs.length === 0) return;
    await exportBatch(
      failedJobs.map((job) => ({ id: job.id, file: job.file })),
      '已重试失败项（逐张下载）',
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.title}>{title}</div>
          <div className={styles.subtitle}>图片不上传；导出不包含 EXIF 元数据</div>
        </div>

        <div className={styles.headerActions}>
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
            onFilesDropped={(dropped) => addFiles(dropped)}
          />
        </section>

        <section className={styles.panel}>
          <PreviewPanel
            file={selectedFile}
            templateId={templateId}
            exif={selectedExif}
            exifError={selectedExifError}
            isReadingExif={isReadingExif}
            jpegBackground={jpegBackground}
            exportFormat={exportFormat}
          />
        </section>

        <section className={styles.panel}>
          <ControlsPanel
            templateId={templateId}
            onTemplateChange={setTemplateId}
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            jpegQuality={jpegQuality}
            onJpegQualityChange={setJpegQuality}
            maxEdge={maxEdge}
            onMaxEdgeChange={setMaxEdge}
            jpegBackground={jpegBackground}
            onJpegBackgroundChange={setJpegBackground}
            hasSelection={Boolean(selectedFile)}
            imagesCount={images.length}
            isExporting={isExporting}
            exportStatus={exportStatus}
            onExportSelected={exportSelected}
            onExportAll={exportAll}
            batchState={batchState}
            onCancelBatch={cancelBatch}
            onRetryFailed={retryFailed}
            exif={selectedExif}
            exifError={selectedExifError}
            isReadingExif={isReadingExif}
          />
        </section>
      </main>
    </div>
  );
}
