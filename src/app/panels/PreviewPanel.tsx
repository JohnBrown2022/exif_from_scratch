import { useEffect, useMemo, useRef, useState } from 'react';
import ui from './Panels.module.css';
import {
  decodeImage,
  getTemplateById,
  inferMakerLogoKey,
  loadMakerLogo,
  readRotation,
  renderWatermark,
  type CanvasRotation,
  type DecodedImage,
  type ExifData,
  type ExportFormat,
  type JpegBackgroundMode,
  type TemplateId,
} from '../../core';

type Props = {
  file: File | null;
  templateId: TemplateId;
  renderRevision: number;
  exif: ExifData | null;
  exifError: string | null;
  isReadingExif: boolean;
  jpegBackground: string;
  jpegBackgroundMode: JpegBackgroundMode;
  blurRadius: number;
  exportFormat: ExportFormat;
};

function getPreviewSize(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

type LoadedImage = {
  decoded: DecodedImage;
  rotation: CanvasRotation | null;
  orientedWidth: number;
  orientedHeight: number;
};

export default function PreviewPanel({
  file,
  templateId,
  renderRevision,
  exif,
  exifError,
  isReadingExif,
  jpegBackground,
  jpegBackgroundMode,
  blurRadius,
  exportFormat,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const isRendering = isDecoding || isDrawing;
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [makerLogo, setMakerLogo] = useState<Awaited<ReturnType<typeof loadMakerLogo>>>(null);

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

      setIsDecoding(true);
      const [nextDecoded, rotation] = await Promise.all([decodeImage(file), readRotation(file)]);
      decoded = nextDecoded;

      try {
        if (cancelled) return;

        const orientedWidth =
          rotation?.canvas && rotation.dimensionSwapped ? decoded.height : decoded.width;
        const orientedHeight =
          rotation?.canvas && rotation.dimensionSwapped ? decoded.width : decoded.height;

        setLoaded({ decoded, rotation, orientedWidth, orientedHeight });
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
    if (!loaded) return () => { };

    setIsDrawing(true);
    setRenderError(null);

    try {
      const previewSize = getPreviewSize(loaded.orientedWidth, loaded.orientedHeight, 1200);
      const template = getTemplateById(templateId);

      renderWatermark({
        canvas,
        image: loaded.decoded.source,
        imageWidth: loaded.decoded.width,
        imageHeight: loaded.decoded.height,
        outputWidth: previewSize.width,
        outputHeight: previewSize.height,
        exif: exif ?? {},
        template,
        background: exportFormat === 'jpeg' ? jpegBackground : undefined,
        backgroundMode: exportFormat === 'jpeg' ? jpegBackgroundMode : undefined,
        blurRadius: exportFormat === 'jpeg' ? blurRadius : undefined,
        rotation: loaded.rotation,
        makerLogo,
      });
    } catch (err) {
      if (!cancelled) setRenderError(err instanceof Error ? err.message : '预览渲染失败');
    } finally {
      if (!cancelled) setIsDrawing(false);
    }

    return () => {
      cancelled = true;
    };
  }, [blurRadius, exif, exportFormat, file, jpegBackground, jpegBackgroundMode, loaded, makerLogo, renderRevision, templateId]);

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
