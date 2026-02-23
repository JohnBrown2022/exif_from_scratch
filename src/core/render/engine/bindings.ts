import type { ExifData } from '../../exif/types';
import {
  formatCameraName,
  formatDateTime,
  formatAperture,
  formatFocalLength,
  formatISO,
  formatLensName,
  formatShutterSeconds,
} from '../../exif/format';

import type { TextBinding } from './types';

function normalizeMakeUpper(exif: ExifData): string | null {
  const make = exif.make?.trim();
  if (!make) return null;
  return make.replaceAll(/\s+/g, ' ').toUpperCase();
}

function buildSettingsParts(exif: ExifData): string[] {
  return [
    formatFocalLength(exif.focalLengthMm),
    formatAperture(exif.apertureFNumber),
    formatShutterSeconds(exif.exposureTimeSeconds),
    formatISO(exif.iso),
  ].filter((part): part is string => Boolean(part));
}

export function resolveTextBinding(exif: ExifData, bind: TextBinding): string | null {
  switch (bind.kind) {
    case 'cameraName':
      return formatCameraName(exif) ?? bind.fallback ?? null;
    case 'lensName':
      return formatLensName(exif) ?? bind.fallback ?? null;
    case 'dateTime':
      return formatDateTime(exif.takenAt) ?? bind.fallback ?? null;
    case 'makeUpper':
      return normalizeMakeUpper(exif) ?? bind.fallback ?? null;
    case 'settings': {
      const joinWith = bind.joinWith ?? ' · ';
      const parts = buildSettingsParts(exif);
      if (!parts.length) return bind.fallback ?? null;
      return parts.join(joinWith);
    }
    case 'focalLength':
      return formatFocalLength(exif.focalLengthMm) ?? bind.fallback ?? null;
    case 'aperture':
      return formatAperture(exif.apertureFNumber) ?? bind.fallback ?? null;
    case 'shutter':
      return formatShutterSeconds(exif.exposureTimeSeconds) ?? bind.fallback ?? null;
    case 'iso':
      return formatISO(exif.iso) ?? bind.fallback ?? null;
    case 'concat': {
      const joinWith = bind.joinWith ?? '';
      const parts = (bind.parts ?? [])
        .map((part) => resolveTextBinding(exif, part))
        .filter((part): part is string => Boolean(part && part.trim().length > 0));
      if (!parts.length) return bind.fallback ?? null;
      const joined = parts.join(joinWith);
      return joined.trim().length ? joined : bind.fallback ?? null;
    }
    case 'literal':
      return bind.value;
    default: {
      const neverBind: never = bind;
      throw new Error(`Unsupported binding kind: ${(neverBind as { kind?: string }).kind ?? 'unknown'}`);
    }
  }
}
