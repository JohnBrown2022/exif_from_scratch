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
  const imagesByIdRef = useRef<Map<string, ImageItem>>(new Map());
  const isMountedRef = useRef(true);
  const thumbnailPendingRef = useRef(new Set<string>());
  const thumbnailQueuedRef = useRef(new Set<string>());
  const highPriorityThumbnailQueueRef = useRef<string[]>([]);
  const normalPriorityThumbnailQueueRef = useRef<string[]>([]);
  const importVersionRef = useRef(0);
  const isThumbnailWorkerRunningRef = useRef(false);

  useEffect(() => {
    imagesRef.current = images;
    const byId = new Map<string, ImageItem>();
    for (const image of images) byId.set(image.id, image);
    imagesByIdRef.current = byId;
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

  const drainThumbnailQueue = useCallback(async () => {
    if (isThumbnailWorkerRunningRef.current) return;
    isThumbnailWorkerRunningRef.current = true;

    try {
      while (highPriorityThumbnailQueueRef.current.length > 0 || normalPriorityThumbnailQueueRef.current.length > 0) {
        const highChunk = highPriorityThumbnailQueueRef.current.splice(0, THUMBNAIL_BATCH_SIZE);
        const lowRemain = Math.max(0, THUMBNAIL_BATCH_SIZE - highChunk.length);
        const lowChunk = normalPriorityThumbnailQueueRef.current.splice(0, lowRemain);
        const batchIds = [...highChunk, ...lowChunk];

        batchIds.forEach((id) => {
          if (thumbnailQueuedRef.current.has(id)) return;
          thumbnailQueuedRef.current.add(id);
        });

        const batchItems = batchIds
          .map((id) => imagesByIdRef.current.get(id))
          .filter((item): item is ImageItem => Boolean(item));

        await Promise.all(
          batchItems.map(async (image) => {
            if (thumbnailPendingRef.current.has(image.id)) return;
            thumbnailPendingRef.current.add(image.id);
            let thumbnailUrl: string | null = null;

            try {
              thumbnailUrl = await generateThumbnailUrl(image.file, THUMBNAIL_SIZE);
            } catch {
              thumbnailUrl = null;
            } finally {
              thumbnailPendingRef.current.delete(image.id);
              thumbnailQueuedRef.current.delete(image.id);
            }

            if (!isMountedRef.current) {
              if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
              return;
            }

            if (!thumbnailUrl) return;
            const latest = imagesByIdRef.current.get(image.id);
            if (latest?.thumbnailUrl) {
              URL.revokeObjectURL(thumbnailUrl);
              return;
            }
            updateImageThumbnail(image.id, thumbnailUrl);
          }),
        );

        batchIds.forEach((id) => {
          const isStillQueued = highPriorityThumbnailQueueRef.current.includes(id) || normalPriorityThumbnailQueueRef.current.includes(id);
          if (!isStillQueued) {
            thumbnailQueuedRef.current.delete(id);
          }
        });

        await waitNextFrame();
      }
    } finally {
      isThumbnailWorkerRunningRef.current = false;
    }
  }, [updateImageThumbnail]);

  const enqueueThumbnails = useCallback((ids: string[], highPriority: boolean) => {
    if (ids.length === 0) return;
    const target = highPriority ? highPriorityThumbnailQueueRef.current : normalPriorityThumbnailQueueRef.current;
    const other = highPriority ? normalPriorityThumbnailQueueRef.current : highPriorityThumbnailQueueRef.current;
    const toAppend: string[] = [];
    const toPrepend: string[] = [];

    for (const id of ids) {
      const image = imagesByIdRef.current.get(id);
      if (!image || image.thumbnailUrl) continue;

      if (thumbnailQueuedRef.current.has(id) || thumbnailPendingRef.current.has(id)) {
        if (highPriority) {
          const idx = other.indexOf(id);
          if (idx >= 0) {
            other.splice(idx, 1);
            toPrepend.push(id);
          }
        }
        continue;
      }

      if (highPriority) {
        toPrepend.push(id);
      } else {
        toAppend.push(id);
      }
    }

    if (toPrepend.length > 0) {
      for (let i = toPrepend.length - 1; i >= 0; i -= 1) {
        target.unshift(toPrepend[i]);
      }
    }
    if (toAppend.length > 0) {
      target.push(...toAppend);
    }

    if (toPrepend.length > 0 || toAppend.length > 0) {
      void drainThumbnailQueue();
    }
  }, [drainThumbnailQueue]);

  const requestVisibleThumbnails = useCallback(
    (start: number, end: number) => {
      const total = imagesRef.current.length;
      if (total === 0) return;
      const safeStart = Math.max(0, Math.min(total, start));
      const safeEnd = Math.max(safeStart, Math.min(total, end));
      if (safeStart >= safeEnd) return;

      const ids = imagesRef.current.slice(safeStart, safeEnd).map((image) => image.id);
      enqueueThumbnails(ids, true);
    },
    [enqueueThumbnails],
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
      void enqueueThumbnails(imageItems.map((image) => image.id), false);
      setImportProgress({
        isImporting: true,
        total: next.length,
        processed,
        currentBatch: Math.min(totalBatches, currentBatch),
        totalBatches,
      });

      if (cursor < next.length) {
        requestAnimationFrame(appendBatch);
      } else {
        if (wasEmpty) {
          setSelectedIndex(0);
        }
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
    thumbnailQueuedRef.current.clear();
    highPriorityThumbnailQueueRef.current.length = 0;
    normalPriorityThumbnailQueueRef.current.length = 0;
    thumbnailPendingRef.current.clear();
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
    requestVisibleThumbnails,
    addFiles,
    removeSelected,
    clearAll,
  };
}
