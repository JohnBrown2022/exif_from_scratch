export async function generateThumbnailUrl(
  file: File,
  maxSize = 96,
  quality = 0.8,
): Promise<string> {
  if (!('createImageBitmap' in window)) return URL.createObjectURL(file);

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return URL.createObjectURL(file);
    }

    context.drawImage(bitmap, 0, 0, width, height);

    if (canvas instanceof OffscreenCanvas) {
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
      if (!blob) return URL.createObjectURL(file);
      return URL.createObjectURL(blob);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (!value) {
            reject(new Error('Failed to generate thumbnail blob'));
            return;
          }
          resolve(value);
        },
        'image/webp',
        quality,
      );
    });

    return URL.createObjectURL(blob);
  } finally {
    if (bitmap) bitmap.close();
  }
}
