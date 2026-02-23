import { useEffect, useMemo, useRef, useState } from 'react';
import ui from './Panels.module.css';
import {
  decodeImage,
  getTemplateById,
  inferMakerLogoKey,
  loadMakerLogo,
  readRotation,
  renderWatermark,
  type ExifData,
  type ExportFormat,
  type TemplateId,
} from '../../core';

type Props = {
  file: File | null;
  templateId: TemplateId;
  exif: ExifData | null;
  exifError: string | null;
  isReadingExif: boolean;
  jpegBackground: string;
  exportFormat: ExportFormat;
  makerLogoRevision?: number;
};

function getPreviewSize(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export default function PreviewPanel({
  file,
  templateId,
  exif,
  exifError,
  isReadingExif,
  jpegBackground,
  exportFormat,
  makerLogoRevision,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const subtitle = useMemo(() => {
    if (!file) return '选择一张图片开始';
    if (isReadingExif) return '正在读取 EXIF…';
    if (exifError) return `EXIF 读取失败：${exifError}`;
    return 'Canvas 水印预览';
  }, [exifError, file, isReadingExif]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      setRenderError(null);

      if (!file) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      setIsRendering(true);
      const [decoded, rotation] = await Promise.all([decodeImage(file), readRotation(file)]);

      try {
        if (cancelled) return;

        const makerKey = exif ? inferMakerLogoKey(exif) : null;
        const makerLogo = makerKey ? await loadMakerLogo(makerKey) : null;
        if (cancelled) return;

        const orientedWidth =
          rotation?.canvas && rotation.dimensionSwapped ? decoded.height : decoded.width;
        const orientedHeight =
          rotation?.canvas && rotation.dimensionSwapped ? decoded.width : decoded.height;

        const previewSize = getPreviewSize(orientedWidth, orientedHeight, 1200);
        const template = getTemplateById(templateId);

        renderWatermark({
          canvas,
          image: decoded.source,
          imageWidth: decoded.width,
          imageHeight: decoded.height,
          outputWidth: previewSize.width,
          outputHeight: previewSize.height,
          exif: exif ?? {},
          template,
          background: exportFormat === 'jpeg' ? jpegBackground : undefined,
          rotation,
          makerLogo,
        });
      } finally {
        decoded.close();
        if (!cancelled) setIsRendering(false);
      }
    }

    run().catch((err) => {
      if (cancelled) return;
      setIsRendering(false);
      setRenderError(err instanceof Error ? err.message : '预览渲染失败');
    });

    return () => {
      cancelled = true;
    };
  }, [exif, exportFormat, file, jpegBackground, templateId, makerLogoRevision]);

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
