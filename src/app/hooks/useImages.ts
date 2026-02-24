import { useEffect, useMemo, useRef, useState } from 'react';

export type ImageItem = {
  id: string;
  file: File;
  url: string;
};

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
  const imagesRef = useRef<ImageItem[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
    };
  }, []);

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (images.length === 0) return 0;
      return clampInt(prev, 0, images.length - 1);
    });
  }, [images.length]);

  function addFiles(nextFiles: FileList | File[]) {
    const next = Array.from(nextFiles).filter(isSupportedImageFile);
    if (next.length === 0) return;

    const wasEmpty = imagesRef.current.length === 0;
    setImages((prev) => [
      ...prev,
      ...next.map((file) => ({ id: createId(), file, url: URL.createObjectURL(file) })),
    ]);
    if (wasEmpty) setSelectedIndex(0);
  }

  function removeSelected() {
    const target = imagesRef.current[selectedIndex];
    if (!target) return;
    URL.revokeObjectURL(target.url);
    setImages((prev) => prev.filter((im) => im.id !== target.id));
  }

  function clearAll() {
    for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
    setImages([]);
    setSelectedIndex(0);
  }

  const selected = useMemo(() => images[selectedIndex] ?? null, [images, selectedIndex]);

  return {
    images,
    selectedIndex,
    setSelectedIndex,
    selected,
    addFiles,
    removeSelected,
    clearAll,
  };
}

