import type { ExifData } from '../exif/types';
import { decodeImage } from '../image/decodeImage';

export type MakerLogo = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

const STORAGE_PREFIX = 'makerLogo:';

const BUILTIN_LOGO_URLS: Record<string, string> = {
  apple: new URL('../../assets/maker/apple.svg', import.meta.url).toString(),
  canon: new URL('../../assets/maker/canon.svg', import.meta.url).toString(),
  dji: new URL('../../assets/maker/dji.svg', import.meta.url).toString(),
  fujifilm: new URL('../../assets/maker/fujifilm.svg', import.meta.url).toString(),
  huawei: new URL('../../assets/maker/huawei.svg', import.meta.url).toString(),
  insta360: new URL('../../assets/maker/insta360.svg', import.meta.url).toString(),
  leica: new URL('../../assets/maker/leica.svg', import.meta.url).toString(),
  lumix: new URL('../../assets/maker/lumix.svg', import.meta.url).toString(),
  nikon: new URL('../../assets/maker/nikon.svg', import.meta.url).toString(),
  olympus: new URL('../../assets/maker/olympus.svg', import.meta.url).toString(),
  panasonic: new URL('../../assets/maker/panasonic.svg', import.meta.url).toString(),
  ricoh: new URL('../../assets/maker/ricoh.svg', import.meta.url).toString(),
  samsung: new URL('../../assets/maker/samsung.svg', import.meta.url).toString(),
  sigma: new URL('../../assets/maker/sigma.svg', import.meta.url).toString(),
  sony: new URL('../../assets/maker/sony.svg', import.meta.url).toString(),
  unknown: new URL('../../assets/maker/unknown.svg', import.meta.url).toString(),
  xiaomi: new URL('../../assets/maker/xiaomi.svg', import.meta.url).toString(),
};

function getBuiltinLogoUrl(key: string): string | null {
  return BUILTIN_LOGO_URLS[key] ?? null;
}

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

const makerLogoCache = new Map<string, { src: string; logo: MakerLogo }>();
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
  image.crossOrigin = 'anonymous';
  image.src = src;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load logo'));
  });

  return image;
}

export async function loadMakerLogo(key: string): Promise<MakerLogo | null> {
  const src = getMakerLogoDataUrl(key) ?? getBuiltinLogoUrl(key);
  if (!src) {
    makerLogoCache.delete(key);
    return null;
  }

  const cached = makerLogoCache.get(key);
  if (cached && cached.src === src) return cached.logo;

  const pending = makerLogoPending.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const image = await loadHtmlImage(src);
    const logo: MakerLogo = {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
    makerLogoCache.set(key, { src, logo });
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
