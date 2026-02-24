import { useMemo, useRef, useState } from 'react';
import styles from './App.module.css';
import ImageListPanel from './panels/ImageListPanel';
import PreviewPanel from './panels/PreviewPanel';
import InspectorPanel from './panels/InspectorPanel/InspectorPanel';
import { useExportController } from './hooks/useExportController';
import { useImages } from './hooks/useImages';
import { useSelectedExif } from './hooks/useSelectedExif';
import type { ExportFormat, JpegBackgroundMode, TemplateId } from '../core';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { images, selectedIndex, setSelectedIndex, selected, addFiles, removeSelected, clearAll } = useImages();
  const selectedFile = selected?.file ?? null;

  const [templateId, setTemplateId] = useState<TemplateId>('bottom_bar');
  const [templateRenderRevision, setTemplateRenderRevision] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg');
  const [jpegQuality, setJpegQuality] = useState<number>(0.92);
  const [maxEdge, setMaxEdge] = useState<number | 'original'>('original');
  const [jpegBackground, setJpegBackground] = useState<string>('#000000');
  const [jpegBackgroundMode, setJpegBackgroundMode] = useState<JpegBackgroundMode>('color');
  const [blurRadius, setBlurRadius] = useState<number>(30);

  const { exif: selectedExif, exifError: selectedExifError, isReadingExif } = useSelectedExif(selectedFile);
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
