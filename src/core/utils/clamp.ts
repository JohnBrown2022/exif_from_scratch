export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value === Infinity) return max;
  if (value === -Infinity) return min;
  return Math.min(max, Math.max(min, value));
}
