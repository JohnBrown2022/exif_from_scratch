import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateThumbnailUrl } from '../utils/generateThumbnail';

export type ImageItem = {
  id: string;
  file: File;
  url: string;
  thumbnailUrl: string | null;
};

export type ImportProgress = {
  isImporting: boolean;
  total: number;
  processed: number;
  currentBatch: number;
  totalBatches: number;
};

const ADD_BATCH_SIZE = 48;
const THUMBNAIL_BATCH_SIZE = 8;
const THUMBNAIL_SIZE = 96;

function waitNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function isSupportedImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/.test(name);
}

export function useImages() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    isImporting: false,
    total: 0,
    processed: 0,
    currentBatch: 0,
    totalBatches: 0,
  });
  const imagesRef = useRef<ImageItem[]>([]);
  const isMountedRef = useRef(true);
  const thumbnailPendingRef = useRef(new Set<string>());
  const importVersionRef = useRef(0);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.url);
        if (image.thumbnailUrl) URL.revokeObjectURL(image.thumbnailUrl);
      }
    };
  }, []);

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (images.length === 0) return 0;
      return clampInt(prev, 0, images.length - 1);
    });
  }, [images.length]);

  const revokeImage = useCallback((image: ImageItem) => {
    URL.revokeObjectURL(image.url);
    if (image.thumbnailUrl) URL.revokeObjectURL(image.thumbnailUrl);
  }, []);

  const createImageItems = useCallback((files: File[]) => {
    return files.map((file) => ({
      id: createId(),
      file,
      url: URL.createObjectURL(file),
      thumbnailUrl: null as string | null,
    }));
  }, []);

  const updateImageThumbnail = useCallback((id: string, thumbnailUrl: string | null) => {
    setImages((prev) => {
      const index = prev.findIndex((im) => im.id === id);
      if (index < 0) {
        if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
        return prev;
      }

      const target = prev[index];
      if (target.thumbnailUrl) {
        if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
        return prev;
      }

      const next = [...prev];
      next[index] = { ...target, thumbnailUrl };
      return next;
    });
  }, []);

  const generateThumbnails = useCallback(
    async (items: ImageItem[]) => {
      for (let i = 0; i < items.length; i += THUMBNAIL_BATCH_SIZE) {
        const chunk = items.slice(i, i + THUMBNAIL_BATCH_SIZE);

        await Promise.all(
          chunk.map(async (image) => {
            if (thumbnailPendingRef.current.has(image.id)) return;
            thumbnailPendingRef.current.add(image.id);
            let thumbnailUrl: string | null = null;

            try {
              thumbnailUrl = await generateThumbnailUrl(image.file, THUMBNAIL_SIZE);
            } catch {
              thumbnailUrl = null;
            } finally {
              thumbnailPendingRef.current.delete(image.id);
            }

            if (!isMountedRef.current) {
              if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
              return;
            }

            if (thumbnailUrl) updateImageThumbnail(image.id, thumbnailUrl);
          }),
        );

        await waitNextFrame();
      }
    },
    [updateImageThumbnail],
  );

  function addFiles(nextFiles: FileList | File[]) {
    const next = Array.from(nextFiles).filter(isSupportedImageFile);
    if (next.length === 0) return;

    const wasEmpty = imagesRef.current.length === 0;
    let cursor = 0;
    const version = ++importVersionRef.current;
    const totalBatches = Math.ceil(next.length / ADD_BATCH_SIZE);
    let currentBatch = 0;
    let processed = 0;

    setImportProgress({
      isImporting: true,
      total: next.length,
      processed: 0,
      currentBatch: 0,
      totalBatches,
    });

    const appendBatch = () => {
      if (importVersionRef.current !== version) return;
      const batch = next.slice(cursor, cursor + ADD_BATCH_SIZE);
      const imageItems = createImageItems(batch);
      cursor += batch.length;
      currentBatch += 1;
      processed += batch.length;
      if (imageItems.length === 0) {
        if (importVersionRef.current === version) {
          setImportProgress({
            isImporting: false,
            total: next.length,
            processed: next.length,
            currentBatch: totalBatches,
            totalBatches,
          });
        }
        if (wasEmpty) setSelectedIndex(0);
        return;
      }

      setImages((prev) => [...prev, ...imageItems]);
      void generateThumbnails(imageItems);
      setImportProgress({
        isImporting: true,
        total: next.length,
        processed,
        currentBatch: Math.min(totalBatches, currentBatch),
        totalBatches,
      });

      if (cursor < next.length) {
        requestAnimationFrame(appendBatch);
      } else if (wasEmpty) {
        setSelectedIndex(0);
        if (importVersionRef.current === version) {
          setImportProgress({
            isImporting: false,
            total: next.length,
            processed: next.length,
            currentBatch: totalBatches,
            totalBatches,
          });
        }
      }
    };

    requestAnimationFrame(appendBatch);
  }

  function removeSelected() {
    const target = imagesRef.current[selectedIndex];
    if (!target) return;
    revokeImage(target);
    setImages((prev) => {
      const targetIndex = prev.findIndex((im) => im.id === target.id);
      if (targetIndex < 0) return prev;

      const next = prev.filter((im) => im.id !== target.id);
      if (next.length === 0) {
        setSelectedIndex(0);
      } else {
        const nextIndex = Math.min(targetIndex, next.length - 1);
        setSelectedIndex(nextIndex);
      }
      return next;
    });
  }

  function clearAll() {
    importVersionRef.current++;
    for (const image of imagesRef.current) revokeImage(image);
    setImportProgress({
      isImporting: false,
      total: 0,
      processed: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
    setImages([]);
    setSelectedIndex(0);
  }

  const selected = useMemo(() => images[selectedIndex] ?? null, [images, selectedIndex]);

  return {
    images,
    selectedIndex,
    setSelectedIndex,
    selected,
    importProgress,
    addFiles,
    removeSelected,
    clearAll,
  };
}
