import { useEffect, useMemo, useRef, useState } from 'react';
import ui from './Panels.module.css';
import {
  renderProject,
  decodeImage,
  inferMakerLogoKey,
  loadMakerLogo,
  readRotation,
  type CanvasBackground,
  type CanvasRotation,
  type DecodedImage,
  type ExifData,
  type ExportFormat,
  type JpegBackgroundMode,
  type ProjectJsonV2,
} from '../../core';

type Props = {
  file: File | null;
  project: ProjectJsonV2;
  renderRevision: number;
  exif: ExifData | null;
  exifError: string | null;
  isReadingExif: boolean;
  jpegBackground: string;
  jpegBackgroundMode: JpegBackgroundMode;
  blurRadius: number;
  exportFormat: ExportFormat;
  seeds: {
    fileMd5: string | null;
    fallback: string;
  };
};

function getPreviewSize(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function getFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

type LoadedImage = {
  fileKey: string;
  decoded: DecodedImage;
  rotation: CanvasRotation | null;
  orientedWidth: number;
  orientedHeight: number;
};

export default function PreviewPanel({
  file,
  project,
  renderRevision,
  exif,
  exifError,
  isReadingExif,
  jpegBackground,
  jpegBackgroundMode,
  blurRadius,
  exportFormat,
  seeds,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const isRendering = isDecoding || isDrawing;
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [makerLogo, setMakerLogo] = useState<Awaited<ReturnType<typeof loadMakerLogo>>>(null);

  const activeFileKey = useMemo(() => (file ? getFileKey(file) : null), [file]);

  const subtitle = useMemo(() => {
    if (!file) return '选择一张图片开始';
    if (isReadingExif) return '正在读取 EXIF…';
    if (exifError) return `EXIF 读取失败：${exifError}`;
    return 'Canvas 水印预览';
  }, [exifError, file, isReadingExif]);

  useEffect(() => {
    let cancelled = false;
    let decoded: DecodedImage | null = null;

    const canvas = canvasRef.current;
    setLoaded(null);
    setRenderError(null);
    setIsDrawing(false);

    if (!canvas) return () => { };

    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);

    async function run() {
      if (!file) {
        setIsDecoding(false);
        return;
      }

      const fileKey = getFileKey(file);
      setIsDecoding(true);
      const [nextDecoded, rotation] = await Promise.all([decodeImage(file), readRotation(file)]);
      decoded = nextDecoded;

      try {
        if (cancelled) return;

        const orientedWidth =
          rotation?.canvas && rotation.dimensionSwapped ? decoded.height : decoded.width;
        const orientedHeight =
          rotation?.canvas && rotation.dimensionSwapped ? decoded.width : decoded.height;

        setLoaded({ fileKey, decoded, rotation, orientedWidth, orientedHeight });
      } catch (err) {
        decoded.close();
        decoded = null;
        throw err;
      } finally {
        if (!cancelled) setIsDecoding(false);
      }
    }

    run().catch((err) => {
      if (cancelled) return;
      setIsDecoding(false);
      setRenderError(err instanceof Error ? err.message : '预览解码失败');
    });

    return () => {
      cancelled = true;
      decoded?.close();
    };
  }, [file]);

  const makerKey = useMemo(() => (exif ? inferMakerLogoKey(exif) : null), [exif]);

  useEffect(() => {
    let cancelled = false;

    setMakerLogo(null);
    if (!makerKey) return () => { };

    loadMakerLogo(makerKey)
      .then((logo) => {
        if (cancelled) return;
        setMakerLogo(logo);
      })
      .catch(() => {
        if (cancelled) return;
        setMakerLogo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [makerKey]);

  useEffect(() => {
    let cancelled = false;

    const canvas = canvasRef.current;
    if (!canvas) return () => { };
    if (!file) return () => { };
    if (!activeFileKey) return () => { };
    if (!loaded) return () => { };
    if (loaded.fileKey !== activeFileKey) return () => { };

    setIsDrawing(true);
    setRenderError(null);

    try {
      const previewSize = getPreviewSize(loaded.orientedWidth, loaded.orientedHeight, 1200);

      const background: CanvasBackground =
        exportFormat === 'jpeg'
          ? jpegBackgroundMode === 'blur'
            ? { mode: 'blur', blurRadius, darken: 0.15 }
            : { mode: 'color', color: jpegBackground }
          : { mode: 'none' };

      const projectToRender: ProjectJsonV2 = { ...project, canvas: { ...project.canvas, background } };

      renderProject({
        canvas,
        project: projectToRender,
        env: {
          canvas: { width: previewSize.width, height: previewSize.height },
          image: {
            source: loaded.decoded.source,
            width: loaded.decoded.width,
            height: loaded.decoded.height,
            rotation: loaded.rotation,
          },
          exif: exif ?? {},
          makerLogo,
          seeds,
        },
        baseWidth: previewSize.width,
        baseHeight: previewSize.height,
      });
    } catch (err) {
      if (!cancelled) setRenderError(err instanceof Error ? err.message : '预览渲染失败');
    } finally {
      if (!cancelled) setIsDrawing(false);
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeFileKey,
    blurRadius,
    exif,
    exportFormat,
    file,
    jpegBackground,
    jpegBackgroundMode,
    loaded,
    makerLogo,
    renderRevision,
    project,
    seeds,
  ]);

  return (
    <div className={ui.panelRoot}>
      <div className={ui.panelHeader}>
        <div>
          <div className={ui.panelTitle}>预览</div>
          <div className={ui.panelSubtitle}>{subtitle}</div>
        </div>
      </div>

      {!file ? <div className={ui.emptyState}>选择一张图片开始</div> : null}

      {file ? (
        <div className={ui.previewFrame}>
          <canvas className={ui.previewCanvas} ref={canvasRef} />
          {isRendering ? <div className={ui.previewOverlayTag}>渲染中…</div> : null}
          {renderError ? <div className={ui.previewOverlayError}>{renderError}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
