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
    case 'literal':
      return bind.value;
    default: {
      const neverBind: never = bind;
      throw new Error(`Unsupported binding kind: ${(neverBind as { kind?: string }).kind ?? 'unknown'}`);
    }
  }
}
