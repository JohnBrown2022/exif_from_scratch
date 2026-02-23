export function stripFileExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  if (index <= 0) return filename;
  return filename.slice(0, index);
}

export function sanitizeFilenameSegment(input: string): string {
  return input
    .trim()
    .replaceAll(/[\\/:*?"<>|]+/g, '-')
    .replaceAll(/\s+/g, ' ')
    .slice(0, 80);
}

