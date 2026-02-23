import { clamp } from '../utils/clamp';

type Rect = { x: number; y: number; width: number; height: number };

function toHexByte(value: number): string {
  const hex = clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return hex;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function colorDistanceSq(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function extractPaletteFromCanvasArea(
  sourceCanvas: HTMLCanvasElement,
  rect: Rect,
  count = 4,
): string[] {
  const sampleSize = 72;
  const sx = clamp(Math.round(rect.x), 0, Math.max(0, sourceCanvas.width - 1));
  const sy = clamp(Math.round(rect.y), 0, Math.max(0, sourceCanvas.height - 1));
  const sw = clamp(Math.round(rect.width), 1, sourceCanvas.width - sx);
  const sh = clamp(Math.round(rect.height), 1, sourceCanvas.height - sy);

  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, sampleSize, sampleSize);
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  } catch {
    return [];
  }

  const data = imageData.data;
  const buckets = new Map<number, number>();

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 180) continue;

    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luminance < 14 || luminance > 245) continue;

    const qr = r >> 3;
    const qg = g >> 3;
    const qb = b >> 3;
    const key = (qr << 10) | (qg << 5) | qb;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const ranked = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  const picked: Array<[number, number, number]> = [];
  const hex: string[] = [];

  const minDistSq = 42 * 42;

  for (const [key] of ranked) {
    if (hex.length >= count) break;
    const qr = (key >> 10) & 31;
    const qg = (key >> 5) & 31;
    const qb = key & 31;

    const r = qr * 8 + 4;
    const g = qg * 8 + 4;
    const b = qb * 8 + 4;
    const candidate: [number, number, number] = [r, g, b];

    if (picked.some((prev) => colorDistanceSq(prev, candidate) < minDistSq)) continue;

    picked.push(candidate);
    hex.push(rgbToHex(r, g, b));
  }

  return hex;
}

