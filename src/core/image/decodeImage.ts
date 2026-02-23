export type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeWithCreateImageBitmap(file: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file);
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  };
}

async function decodeWithHtmlImage(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to decode image'));
  });

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

export async function decodeImage(file: Blob): Promise<DecodedImage> {
  if ('createImageBitmap' in window) {
    try {
      return await decodeWithCreateImageBitmap(file);
    } catch {
      return await decodeWithHtmlImage(file);
    }
  }

  return await decodeWithHtmlImage(file);
}
