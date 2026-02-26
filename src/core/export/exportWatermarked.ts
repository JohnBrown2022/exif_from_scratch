import type { ExifData } from '../exif/types';
import { readExif } from '../exif/readExif';
import { readRotation } from '../exif/readRotation';
import { inferMakerLogoKey, loadMakerLogo } from '../brand/makerLogo';
import { fingerprintMd5Hex } from '../fingerprint/md5';
import { decodeImage } from '../image/decodeImage';
import { renderProject } from '../project/pipeline';
import type { CanvasBackground, ProjectJsonV2 } from '../project/types';
import { sanitizeFilenameSegment, stripFileExtension } from '../utils/filename';

export type ExportFormat = 'png' | 'jpeg';

export type JpegBackgroundMode = 'color' | 'blur';

export type ExportOptions = {
  format: ExportFormat;
  jpegQuality: number;
  maxEdge: number | 'original';
  project: ProjectJsonV2;
  jpegBackground: string;
  jpegBackgroundMode: JpegBackgroundMode;
  blurRadius: number;
};

function shouldComputeTopologyMd5(project: ProjectJsonV2): boolean {
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const node = nodes.find((n) => n.id === 'topology_mountain' && n.type === 'plugin/topology_mountain');
  if (!node) return false;
  if (node.enabled === false) return false;
  const props = typeof node.props === 'object' && node.props ? (node.props as Record<string, unknown>) : {};
  const seedMode = props.seedMode;
  return seedMode === 'file_md5' || seedMode === undefined;
}

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

  const md5Promise = shouldComputeTopologyMd5(options.project) ? fingerprintMd5Hex(file).catch(() => null) : Promise.resolve(null);

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

    const fileMd5 = await md5Promise;

    const background: CanvasBackground =
      options.format === 'jpeg'
        ? options.jpegBackgroundMode === 'blur'
          ? { mode: 'blur', blurRadius: options.blurRadius, darken: 0.15 }
          : { mode: 'color', color: options.jpegBackground }
        : { mode: 'none' };

    const projectToRender: ProjectJsonV2 = { ...options.project, canvas: { ...options.project.canvas, background } };

    renderProject({
      canvas,
      project: projectToRender,
      env: {
        canvas: { width: outW, height: outH },
        image: { source: decoded.source, width: decoded.width, height: decoded.height, rotation },
        exif: exifResult.exif,
        makerLogo,
        seeds: { fileMd5, fallback: fallbackSeed },
      },
      baseWidth: outW,
      baseHeight: outH,
    });

    const blob = await canvasToBlob(canvas, mime, quality);

    const base = sanitizeFilenameSegment(stripFileExtension(file.name) || 'export');
    const templateId = options.project.canvas.mode === 'template' ? options.project.canvas.templateId : 'project';
    const filename = `${base}_wm_${templateId}.${extensionFor(options.format)}`;

    return { blob, filename, exif: exifResult.exif, exifError: exifResult.error };
  } finally {
    decoded.close();
  }
}
