import { clamp } from '../utils/clamp';

export type TopologyMountainStampParams = {
  seed: string;
  sizePx: number;
  density: number;
  noise: number;
  alpha: number;
};

type RandomFn = () => number;

type GeoDna = {
  sunSide: 1 | -1;
  sunHeight: number;
  sunSize: number;
  bgSeed: number;
  bgPeaks: number;
  bgHeight: number;
  fgSeed: number;
  fgPeaks: number;
  fgHeight: number;
  birdX: number;
  birdY: number;
  boatX: number;
  waterLines: number;
};

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) as number;
  };
}

function sfc32(a: number, b: number, c: number, d: number): RandomFn {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function parseDna(seedString: string): { random: RandomFn; geoDna: GeoDna } {
  const seed = xmur3(seedString);
  const random = sfc32(seed(), seed(), seed(), seed());

  const geoDna: GeoDna = {
    sunSide: random() > 0.5 ? 1 : -1,
    sunHeight: 0.15 + random() * 0.2,
    sunSize: 0.1 + random() * 0.08,
    bgSeed: random() * 100,
    bgPeaks: Math.floor(random() * 2) + 1,
    bgHeight: 0.4 + random() * 0.1,
    fgSeed: random() * 100,
    fgPeaks: Math.floor(random() * 2) + 2,
    fgHeight: 0.25 + random() * 0.1,
    birdX: (random() - 0.5) * 0.8,
    birdY: -0.5 + random() * 0.3,
    boatX: (random() - 0.5) * 0.6,
    waterLines: Math.floor(random() * 5) + 5,
  };

  return { random, geoDna };
}

type Point = { x: number; y: number };

function generateRidgePoints(
  startX: number,
  endX: number,
  peakCount: number,
  maxH: number,
  yBase: number,
  seedOffset: number,
  opts: { step: number; microNoiseFreq: number; microNoiseAmp: number },
): Point[] {
  const localRandom = sfc32(seedOffset, seedOffset * 2, seedOffset * 3, seedOffset * 4);
  const span = endX - startX;
  const seg = span / Math.max(1, peakCount);

  const peaks: Array<{ x: number; y: number; w: number }> = [];
  for (let i = 0; i < peakCount; i++) {
    peaks.push({
      x: startX + seg * i + seg * 0.5 + (localRandom() - 0.5) * seg * 0.5,
      y: yBase - maxH * (0.6 + localRandom() * 0.4),
      w: seg * (0.8 + localRandom() * 0.6),
    });
  }

  const points: Point[] = [];
  const step = Math.max(1, Math.round(opts.step));
  for (let x = startX; x <= endX; x += step) {
    let maxY = yBase;
    for (const p of peaks) {
      const dist = Math.abs(x - p.x);
      if (dist < p.w) {
        const n = dist / p.w;
        const h = (yBase - p.y) * Math.pow(1 - n * n, 2);
        const currentY = yBase - h;
        if (currentY < maxY) maxY = currentY;
      }
    }

    const microNoise = Math.sin(x * opts.microNoiseFreq + seedOffset) * opts.microNoiseAmp;
    maxY += microNoise * ((yBase - maxY) / Math.max(1, maxH));

    points.push({ x, y: maxY });
  }
  return points;
}

function clearSilhouette(ctx: CanvasRenderingContext2D, points: Point[], yBase: number, extendY: number) {
  if (points.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(points[0].x, yBase + extendY);
  for (const pt of points) ctx.lineTo(pt.x, pt.y);
  ctx.lineTo(points[points.length - 1].x, yBase + extendY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTopographicMountain(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  yBase: number,
  numLines: number,
  noiseLevel: number,
  alpha: number,
  opts: { distortFreq: number; distortAmp: number; occludeBeforeDraw: boolean; extendY: number },
) {
  if (points.length === 0) return;

  if (opts.occludeBeforeDraw) {
    clearSilhouette(ctx, points, yBase, opts.extendY);
  }

  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineJoin = 'round';

  const lines = Math.max(1, Math.round(numLines));
  for (let i = 0; i <= lines; i++) {
    const t = i / lines;
    const easeT = Math.pow(t, 1.2);

    ctx.beginPath();
    for (let j = 0; j < points.length; j++) {
      const pt = points[j];

      let currentY = pt.y * (1 - easeT) + yBase * easeT;

      if (noiseLevel > 0 && i < lines) {
        const wave = Math.sin(pt.x * opts.distortFreq + t * 15) * Math.sin(t * Math.PI);
        currentY += wave * noiseLevel * opts.distortAmp;
      }

      if (j === 0) ctx.moveTo(pt.x, currentY);
      else ctx.lineTo(pt.x, currentY);
    }
    ctx.stroke();
  }
}

function cacheKey(params: TopologyMountainStampParams & { size: number }): string {
  const noise = clamp(params.noise, 0, 3);
  const alpha = clamp(params.alpha, 0, 1);
  const density = Math.max(1, Math.round(params.density));
  return `${params.seed}|${params.size}|${density}|${noise.toFixed(3)}|${alpha.toFixed(3)}`;
}

const stampCache = new Map<string, HTMLCanvasElement>();

export function renderTopologyMountainStamp(params: TopologyMountainStampParams): HTMLCanvasElement {
  const size = Math.max(1, Math.round(params.sizePx));
  const key = cacheKey({ ...params, size });
  const cached = stampCache.get(key);
  if (cached) return cached;

  if (stampCache.size > 32) stampCache.clear();

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { random, geoDna } = parseDna(params.seed || 'default');

  const alpha = clamp(params.alpha, 0, 1);
  const strataCount = Math.max(1, Math.round(params.density));
  const noiseLevel = clamp(params.noise, 0, 3);

  const minDim = Math.min(canvas.width, canvas.height);
  const radius = minDim * 0.4;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const scale = radius / 480;
  const step = Math.max(1, Math.round(4 * scale));
  const microNoiseAmp = Math.max(1, 4 * scale);
  const microNoiseFreq = scale === 0 ? 0.05 : 0.05 / scale;
  const distortFreq = scale === 0 ? 0.04 : 0.04 / scale;
  const distortAmp = Math.max(2, 8 * scale);
  const ringOffset = Math.max(2, Math.round(10 * scale));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();

  // Sun / moon
  const sX = geoDna.sunSide * radius * 0.4;
  const sY = -radius + radius * geoDna.sunHeight;
  const sR = radius * geoDna.sunSize;

  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
  ctx.lineWidth = Math.max(0.8, 2 * scale);

  const sunLines = 12;
  for (let i = 0; i <= sunLines; i++) {
    const h = -sR + sR * 2 * (i / sunLines);
    const halfChord = Math.sqrt(Math.max(0, sR * sR - h * h));
    ctx.beginPath();
    ctx.moveTo(sX - halfChord, sY + h);
    ctx.lineTo(sX + halfChord, sY + h);
    ctx.stroke();
  }

  // Background mountains
  const yBaseBg = radius * 0.1;
  const ptsBg = generateRidgePoints(
    -radius - 20 * scale,
    radius + 20 * scale,
    geoDna.bgPeaks,
    radius * geoDna.bgHeight,
    yBaseBg,
    geoDna.bgSeed,
    { step, microNoiseAmp, microNoiseFreq },
  );
  ctx.lineWidth = Math.max(0.5, 1 * scale);
  drawTopographicMountain(ctx, ptsBg, yBaseBg, strataCount, noiseLevel * 0.5, alpha * 0.5, {
    distortFreq,
    distortAmp,
    occludeBeforeDraw: false,
    extendY: radius,
  });

  // Foreground mountains
  const yBaseFg = radius * 0.45;
  const ptsFg = generateRidgePoints(
    -radius - 20 * scale,
    radius + 20 * scale,
    geoDna.fgPeaks,
    radius * geoDna.fgHeight,
    yBaseFg,
    geoDna.fgSeed,
    { step, microNoiseAmp, microNoiseFreq },
  );
  ctx.lineWidth = Math.max(0.8, 2 * scale);
  drawTopographicMountain(ctx, ptsFg, yBaseFg, strataCount, noiseLevel, alpha, {
    distortFreq,
    distortAmp,
    occludeBeforeDraw: true,
    extendY: radius,
  });

  // Water surface
  const waterStartY = yBaseFg + radius * 0.05;
  const waterEndY = radius;
  ctx.lineWidth = Math.max(0.8, 2 * scale);
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
  for (let i = 0; i < geoDna.waterLines; i++) {
    const progress = i / geoDna.waterLines;
    const y = waterStartY + Math.pow(progress, 1.2) * (waterEndY - waterStartY);
    const lineW = radius * (1.2 - progress * 0.4) * (0.8 + random() * 0.2);
    ctx.beginPath();
    ctx.moveTo(-lineW / 2, y);
    ctx.lineTo(lineW / 2, y);
    ctx.stroke();
  }

  // Boat + birds
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = Math.max(1, 3 * scale);

  const boatHalf = Math.max(3, 8 * scale);
  const boatSail = Math.max(4, 8 * scale);
  const bX = radius * geoDna.boatX;
  const bY = yBaseFg + radius * 0.1;
  ctx.beginPath();
  ctx.moveTo(bX - boatHalf, bY);
  ctx.quadraticCurveTo(bX, bY + boatHalf * 0.5, bX + boatHalf, bY);
  ctx.moveTo(bX + boatHalf * 0.25, bY);
  ctx.lineTo(bX + boatHalf * 0.25, bY - boatSail);
  ctx.lineTo(bX - boatHalf * 0.4, bY - boatSail * 0.25);
  ctx.stroke();

  const birdsCount = Math.floor(random() * 2) + 2;
  const birdWing = Math.max(3, 6 * scale);
  const birdJitterX = Math.max(6, 40 * scale);
  const birdJitterY = Math.max(4, 20 * scale);
  for (let i = 0; i < birdsCount; i++) {
    const brdX = radius * geoDna.birdX + (random() - 0.5) * birdJitterX;
    const brdY = radius * geoDna.birdY + (random() - 0.5) * birdJitterY;

    ctx.beginPath();
    ctx.moveTo(brdX - birdWing, brdY - birdWing * 0.65);
    ctx.quadraticCurveTo(brdX - birdWing * 0.5, brdY, brdX, brdY);
    ctx.quadraticCurveTo(brdX + birdWing * 0.5, brdY, brdX + birdWing, brdY - birdWing * 0.8);
    ctx.stroke();
  }

  ctx.restore();

  // Outer rings
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, 4 * scale);
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius + ringOffset, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.8, 2 * scale);
  ctx.stroke();
  ctx.restore();

  stampCache.set(key, canvas);
  return canvas;
}
