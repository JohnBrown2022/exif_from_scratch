import exifr from 'exifr';

export type CanvasRotation = {
  rad: number;
  scaleX: number;
  scaleY: number;
  dimensionSwapped: boolean;
  canvas: boolean;
};

export async function readRotation(file: Blob): Promise<CanvasRotation | null> {
  try {
    const rotation = (await exifr.rotation(file)) as Partial<CanvasRotation> | undefined;
    if (!rotation) return null;

    return {
      rad: typeof rotation.rad === 'number' ? rotation.rad : 0,
      scaleX: typeof rotation.scaleX === 'number' ? rotation.scaleX : 1,
      scaleY: typeof rotation.scaleY === 'number' ? rotation.scaleY : 1,
      dimensionSwapped: Boolean(rotation.dimensionSwapped),
      canvas: Boolean(rotation.canvas),
    };
  } catch {
    return null;
  }
}

