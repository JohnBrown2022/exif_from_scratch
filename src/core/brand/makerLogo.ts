import type { ExifData } from '../exif/types';
import { decodeImage } from '../image/decodeImage';

export type MakerLogo = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

const STORAGE_PREFIX = 'makerLogo:';

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

function sanitizeKey(input: string): string | null {
  const key = input
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');
  return key.length ? key : null;
}

export function inferMakerLogoKey(exif: ExifData): string | null {
  const make = normalize(exif.make);
  const model = normalize(exif.model);
  const combined = `${make} ${model}`.trim();
  if (!combined) return null;

  if (combined.includes('CANON')) return 'canon';
  if (combined.includes('NIKON')) return 'nikon';
  if (combined.includes('SONY')) return 'sony';
  if (combined.includes('FUJI')) return 'fujifilm';
  if (combined.includes('LEICA')) return 'leica';
  if (combined.includes('PANASONIC')) return 'panasonic';
  if (combined.includes('LUMIX')) return 'lumix';
  if (combined.includes('OLYMPUS') || combined.includes('OM SYSTEM') || combined.includes('OM DIGITAL')) return 'olympus';
  if (combined.includes('SIGMA')) return 'sigma';
  if (combined.includes('DJI')) return 'dji';
  if (combined.includes('HASSELBLAD')) return 'hasselblad';
  if (combined.includes('RICOH')) return 'ricoh';
  if (combined.includes('APPLE')) return 'apple';
  if (combined.includes('HUAWEI')) return 'huawei';
  if (combined.includes('XIAOMI') || combined.includes('REDMI')) return 'xiaomi';
  if (combined.includes('SAMSUNG')) return 'samsung';

  const fallback = sanitizeKey(exif.make ?? '');
  return fallback;
}

export function getMakerLogoDataUrl(key: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

const makerLogoCache = new Map<string, { dataUrl: string; logo: MakerLogo }>();
const makerLogoPending = new Map<string, Promise<MakerLogo | null>>();

export function setMakerLogoDataUrl(key: string, dataUrl: string) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, dataUrl);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to save logo');
  }
  makerLogoCache.delete(key);
  makerLogoPending.delete(key);
}

export function clearMakerLogoDataUrl(key: string) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to clear logo');
  }
  makerLogoCache.delete(key);
  makerLogoPending.delete(key);
}

async function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load logo'));
  });

  return image;
}

export async function loadMakerLogo(key: string): Promise<MakerLogo | null> {
  const dataUrl = getMakerLogoDataUrl(key);
  if (!dataUrl) {
    makerLogoCache.delete(key);
    return null;
  }

  const cached = makerLogoCache.get(key);
  if (cached && cached.dataUrl === dataUrl) return cached.logo;

  const pending = makerLogoPending.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const image = await loadHtmlImage(dataUrl);
    const logo: MakerLogo = {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
    makerLogoCache.set(key, { dataUrl, logo });
    return logo;
  })()
    .catch(() => {
      makerLogoCache.delete(key);
      return null;
    })
    .finally(() => {
      makerLogoPending.delete(key);
    });

  makerLogoPending.set(key, promise);
  return promise;
}

export async function rasterizeLogoFileToPngDataUrl(
  file: File,
  options?: { maxHeight?: number; maxWidth?: number },
): Promise<string> {
  const decoded = await decodeImage(file);
  try {
    const maxHeight = options?.maxHeight ?? 140;
    const maxWidth = options?.maxWidth ?? 600;
    const scale = Math.min(maxHeight / decoded.height, maxWidth / decoded.width, 1);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);

    return canvas.toDataURL('image/png');
  } finally {
    decoded.close();
  }
}
