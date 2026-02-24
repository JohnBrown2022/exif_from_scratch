import { useEffect, useMemo, useRef, useState } from 'react';

import {
  downloadBlob,
  exportWatermarkedImage,
  runBatchExport,
  type BatchJob,
  type BatchUpdate,
  type ExportFormat,
  type TemplateId,
  type TopologyWatermarkSettings,
} from '../../core';

import type { ImageItem } from './useImages';

export type ExportControllerOptions = {
  format: ExportFormat;
  jpegQuality: number;
  maxEdge: number | 'original';
  templateId: TemplateId;
  jpegBackground: string;
  jpegBackgroundMode: 'color' | 'blur';
  blurRadius: number;
  topologyWatermark: TopologyWatermarkSettings;
};

function createBatchJobs(targetImages: Array<{ id: string; file: File }>): BatchJob[] {
  return targetImages.map((image) => ({
    id: image.id,
    file: image.file,
    status: 'queued',
    error: null,
    filename: null,
  }));
}

export function useExportController(input: {
  images: ImageItem[];
  selectedFile: File | null;
  options: ExportControllerOptions;
}) {
  const { images, selectedFile, options } = input;

  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [batchState, setBatchState] = useState<BatchUpdate | null>(null);

  const batchAbortRef = useRef<AbortController | null>(null);
  const imagesRef = useRef<ImageItem[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const failedCount = useMemo(
    () => (batchState ? batchState.jobs.filter((job) => job.status === 'error').length : 0),
    [batchState],
  );

  async function exportSelected() {
    if (!selectedFile || isExporting) return;

    setIsExporting(true);
    setExportStatus(null);

    try {
      const { blob, filename, exifError } = await exportWatermarkedImage(selectedFile, options);
      downloadBlob(blob, filename);
      setExportStatus(exifError ? `导出完成（EXIF 解析失败：${exifError}）` : '导出完成');
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  }

  async function exportBatch(targetImages: Array<{ id: string; file: File }>, doneMessage: string) {
    if (targetImages.length === 0 || isExporting) return;

    const controller = new AbortController();
    batchAbortRef.current = controller;

    setIsExporting(true);
    setExportStatus(null);

    const jobs = createBatchJobs(targetImages);

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
      imagesRef.current.map((im) => ({ id: im.id, file: im.file })),
      '批量导出完成',
    );
  }

  function cancelBatch() {
    batchAbortRef.current?.abort();
  }

  async function retryFailed() {
    if (!batchState || batchState.running || failedCount === 0) return;
    const retryJobs = batchState.jobs.filter((job) => job.status === 'error');
    await exportBatch(
      retryJobs.map((job) => ({ id: job.id, file: job.file })),
      '失败项导出完成',
    );
  }

  return {
    isExporting,
    exportStatus,
    batchState,
    failedCount,
    exportSelected,
    exportAll,
    cancelBatch,
    retryFailed,
  };
}
