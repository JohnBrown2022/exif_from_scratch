import exifr from 'exifr';

import type { ExifData } from './types';

type ReadExifResult = {
  exif: ExifData;
  error: string | null;
};

const PICK_TAGS = [
  'Make',
  'Model',
  'LensModel',
  'FocalLength',
  'FNumber',
  'ExposureTime',
  'ISO',
  'DateTimeOriginal',
  'CreateDate',
  'Orientation',
] as const;

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function asFiniteInteger(value: unknown): number | undefined {
  const num = asFiniteNumber(value);
  if (num === undefined) return undefined;
  const int = Math.round(num);
  return Number.isFinite(int) ? int : undefined;
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  return undefined;
}

export async function readExif(file: Blob): Promise<ReadExifResult> {
  try {
    const output = (await exifr.parse(file, {
      pick: [...PICK_TAGS],
      translateValues: false,
      reviveValues: true,
    })) as Record<string, unknown> | null;

    if (!output) return { exif: {}, error: null };

    const takenAt = asDate(output.DateTimeOriginal) ?? asDate(output.CreateDate);

    const exif: ExifData = {
      make: asNonEmptyString(output.Make),
      model: asNonEmptyString(output.Model),
      lensModel: asNonEmptyString(output.LensModel),
      focalLengthMm: asFiniteNumber(output.FocalLength),
      apertureFNumber: asFiniteNumber(output.FNumber),
      exposureTimeSeconds: asFiniteNumber(output.ExposureTime),
      iso: asFiniteNumber(output.ISO),
      takenAt,
      orientation: asFiniteInteger(output.Orientation),
    };

    return { exif, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown EXIF parsing error';
    return { exif: {}, error: message };
  }
}

