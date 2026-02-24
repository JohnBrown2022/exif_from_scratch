import { useEffect, useState } from 'react';

import { readExif, type ExifData } from '../../core';

export function useSelectedExif(selectedFile: File | null) {
  const [exif, setExif] = useState<ExifData | null>(null);
  const [exifError, setExifError] = useState<string | null>(null);
  const [isReadingExif, setIsReadingExif] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedFile) {
        setExif(null);
        setExifError(null);
        setIsReadingExif(false);
        return;
      }

      setExif(null);
      setExifError(null);
      setIsReadingExif(true);
      const result = await readExif(selectedFile);
      if (cancelled) return;

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
