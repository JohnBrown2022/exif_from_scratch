import type { ExifData } from '../exif/types';
import { readExif } from '../exif/readExif';
import { readRotation } from '../exif/readRotation';
import { inferMakerLogoKey, loadMakerLogo } from '../brand/makerLogo';
import { fingerprintMd5Hex } from '../fingerprint/md5';
import { decodeImage } from '../image/decodeImage';
import { renderWatermark } from '../render/renderer';
import { getTemplateById, type TemplateId } from '../render/templates';
import type { TopologyWatermarkSettings } from '../watermark/types';
import { sanitizeFilenameSegment, stripFileExtension } from '../utils/filename';

export type ExportFormat = 'png' | 'jpeg';

export type JpegBackgroundMode = 'color' | 'blur';

export type ExportOptions = {
  format: ExportFormat;
  jpegQuality: number;
  maxEdge: number | 'original';
  templateId: TemplateId;
  jpegBackground: string;
  jpegBackgroundMode: JpegBackgroundMode;
  blurRadius: number;
  topologyWatermark?: TopologyWatermarkSettings;
};

function getOutputSize(width: number, height: number, maxEdge: number | 'original') {
  if (maxEdge === 'original') return { width, height };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to export image blob'));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

function extensionFor(format: ExportFormat): string {
  return format === 'png' ? 'png' : 'jpg';
}

export async function exportWatermarkedImage(
  file: File,
  options: ExportOptions,
): Promise<{ blob: Blob; filename: string; exif: ExifData; exifError: string | null }> {
  const fallbackSeed = `${file.name}:${file.size}:${file.lastModified}`;

  const md5Promise =
    options.topologyWatermark?.enabled && options.topologyWatermark.seedMode === 'file_md5'
      ? fingerprintMd5Hex(file).catch(() => null)
      : Promise.resolve(null);

  const [decoded, exifResult, rotation] = await Promise.all([
    decodeImage(file),
    readExif(file),
    readRotation(file),
  ]);

  try {
    const makerKey = inferMakerLogoKey(exifResult.exif);
    const makerLogo = makerKey ? await loadMakerLogo(makerKey) : null;

    const orientedWidth =
      rotation?.canvas && rotation.dimensionSwapped ? decoded.height : decoded.width;
    const orientedHeight =
      rotation?.canvas && rotation.dimensionSwapped ? decoded.width : decoded.height;

    const { width: outW, height: outH } = getOutputSize(orientedWidth, orientedHeight, options.maxEdge);
    const canvas = document.createElement('canvas');

    const mime = options.format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = options.format === 'jpeg' ? options.jpegQuality : undefined;
    const background = options.format === 'jpeg' ? options.jpegBackground : undefined;
    const backgroundMode = options.format === 'jpeg' ? options.jpegBackgroundMode : undefined;
    const blurRadius = options.format === 'jpeg' ? options.blurRadius : undefined;
    const template = getTemplateById(options.templateId);

    const fileMd5 = await md5Promise;

    renderWatermark({
      canvas,
      image: decoded.source,
      imageWidth: decoded.width,
      imageHeight: decoded.height,
      outputWidth: outW,
      outputHeight: outH,
      exif: exifResult.exif,
      template,
      background,
      backgroundMode,
      blurRadius,
      rotation,
      makerLogo,
      topologyWatermark: options.topologyWatermark ?? null,
      seeds: { fileMd5, fallback: fallbackSeed },
    });

    const blob = await canvasToBlob(canvas, mime, quality);

    const base = sanitizeFilenameSegment(stripFileExtension(file.name) || 'export');
    const filename = `${base}_wm_${options.templateId}.${extensionFor(options.format)}`;

    return { blob, filename, exif: exifResult.exif, exifError: exifResult.error };
  } finally {
    decoded.close();
  }
}
