import { useMemo, useRef, useState } from 'react';
import styles from './App.module.css';
import ControlsPanel, { type ExportFormat } from './panels/ControlsPanel';
import ImageListPanel from './panels/ImageListPanel';
import PreviewPanel from './panels/PreviewPanel';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg');
  const [jpegQuality, setJpegQuality] = useState<number>(0.92);

  const selectedFile = files[selectedIndex] ?? null;

  const title = useMemo(() => {
    const count = files.length;
    if (count === 0) return 'EXIF 水印（纯本地）';
    return `EXIF 水印（${count} 张）`;
  }, [files.length]);

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

    setFiles((prev) => {
      const merged = [...prev, ...next];
      return merged;
    });
    setSelectedIndex((prev) => (files.length === 0 ? 0 : prev));
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
            files={files}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onImport={openFilePicker}
            onFilesDropped={(dropped) => addFiles(dropped)}
          />
        </section>

        <section className={styles.panel}>
          <PreviewPanel file={selectedFile} />
        </section>

        <section className={styles.panel}>
          <ControlsPanel
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            jpegQuality={jpegQuality}
            onJpegQualityChange={setJpegQuality}
            hasSelection={Boolean(selectedFile)}
          />
        </section>
      </main>
    </div>
  );
}
