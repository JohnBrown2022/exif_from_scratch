import type { ExifData } from './types';

type WatermarkFields = {
  camera: string | null;
  lens: string | null;
  settings: string | null;
  date: string | null;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateTime(value: Date | undefined): string | null {
  if (!value) return null;
  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  const hours = pad2(value.getHours());
  const minutes = pad2(value.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatCameraName(exif: ExifData): string | null {
  const make = exif.make?.trim();
  const model = exif.model?.trim();
  if (!make && !model) return null;
  if (!make) return model ?? null;
  if (!model) return make;

  const lowerMake = make.toLowerCase();
  const lowerModel = model.toLowerCase();

  // If model already contains the full make string, just use model
  if (lowerModel.includes(lowerMake)) return model;

  // If model already contains the first word (brand name) of make,
  // e.g. Make="NIKON CORPORATION", Model="NIKON Z5" → just "NIKON Z5"
  const brandWord = lowerMake.split(/\s+/)[0];
  if (brandWord && lowerModel.startsWith(brandWord)) return model;

  return `${make} ${model}`;
}

export function formatLensName(exif: ExifData): string | null {
  const lens = exif.lensModel?.trim();
  return lens && lens.length > 0 ? lens : null;
}

export function formatFocalLength(value: number | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return `${rounded}mm`;
}

export function formatAperture(value: number | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `f/${rounded}`;
}

export function formatShutterSeconds(value: number | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  if (value >= 1) {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded}s`;
  }
  const denom = Math.round(1 / value);
  if (!Number.isFinite(denom) || denom <= 0) return null;
  return `1/${denom}s`;
}

export function formatISO(value: number | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return `ISO ${rounded}`;
}

export function formatSettingsLine(exif: ExifData): string | null {
  const parts = [
    formatFocalLength(exif.focalLengthMm),
    formatAperture(exif.apertureFNumber),
    formatShutterSeconds(exif.exposureTimeSeconds),
    formatISO(exif.iso),
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) return null;
  return parts.join(' · ');
}

export function buildWatermarkFields(exif: ExifData): WatermarkFields {
  const camera = formatCameraName(exif);
  const lens = formatLensName(exif);
  const settings = formatSettingsLine(exif);
  const date = formatDateTime(exif.takenAt);

  return {
    camera,
    lens,
    settings,
    date,
  };
}

