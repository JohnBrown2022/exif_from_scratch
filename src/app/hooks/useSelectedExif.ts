import { useEffect, useState } from 'react';

import { readExif, type ExifData } from '../../core';

type ExifResult = Awaited<ReturnType<typeof readExif>>;

const EXIF_CACHE_LIMIT = 24;
const cachedExif = new Map<string, ExifResult>();
const inFlightExif = new Map<string, Promise<ExifResult>>();

function getFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function setCachedExif(fileKey: string, value: ExifResult) {
  cachedExif.set(fileKey, value);
  if (cachedExif.size <= EXIF_CACHE_LIMIT) return;

  const oldest = cachedExif.keys().next().value;
  if (oldest) cachedExif.delete(oldest);
}

export function useSelectedExif(selectedFile: File | null) {
  const [exif, setExif] = useState<ExifData | null>(null);
  const [exifError, setExifError] = useState<string | null>(null);
  const [isReadingExif, setIsReadingExif] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fileKey = selectedFile ? getFileKey(selectedFile) : null;

    async function run() {
      if (!selectedFile) {
        setExif(null);
        setExifError(null);
        setIsReadingExif(false);
        return;
      }

      if (fileKey && cachedExif.has(fileKey)) {
        const cached = cachedExif.get(fileKey);
        if (!cached) return;
        setExif(cached.exif);
        setExifError(cached.error);
        setIsReadingExif(false);
        return;
      }

      setExif(null);
      setExifError(null);
      setIsReadingExif(true);
      const runRead = inFlightExif.get(fileKey || '');

      if (runRead) {
        const result = await runRead;
        if (cancelled) return;
        setExif(result.exif);
        setExifError(result.error);
        setIsReadingExif(false);
        return;
      }

      const request = readExif(selectedFile).finally(() => {
        if (fileKey) inFlightExif.delete(fileKey);
      });
      inFlightExif.set(fileKey || '', request);

      const result = await request;
      if (cancelled) return;
      setCachedExif(fileKey || '', result);
      setExif(result.exif);
      setExifError(result.error);
      setIsReadingExif(false);
    }

    run().catch((err) => {
      if (cancelled) return;
      setExif(null);
      setExifError(err instanceof Error ? err.message : 'Unknown EXIF error');
      setIsReadingExif(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  return { exif, exifError, isReadingExif };
}
