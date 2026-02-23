import { clamp } from '../../utils/clamp';

import type { GridPlacement, ZoneGridSpec } from './types';
import { resolveDimension } from './values';
import type { Rect } from '../templates';

export type ResolvedGrid = {
  cols: number;
  rows: number;
  padding: number;
  innerRect: Rect;
  cellWidth: number;
  cellHeight: number;
};

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

export function resolveGrid(zoneRect: Rect, spec: ZoneGridSpec | undefined, scale: number): ResolvedGrid {
  const colsRaw = spec?.cols ?? 12;
  const rowsRaw = spec?.rows ?? 12;
  const cols = clamp(Math.round(colsRaw), 1, 48);
  const rows = clamp(Math.round(rowsRaw), 1, 48);
  const padding = Math.max(0, resolveDimension(spec?.padding, scale, 0));

  const innerRect = rect(
    zoneRect.x + padding,
    zoneRect.y + padding,
    Math.max(1, zoneRect.width - padding * 2),
    Math.max(1, zoneRect.height - padding * 2),
  );

  return {
    cols,
    rows,
    padding,
    innerRect,
    cellWidth: innerRect.width / cols,
    cellHeight: innerRect.height / rows,
  };
}

export function rectFromGrid(grid: ResolvedGrid, placement: GridPlacement | undefined): Rect {
  if (!placement) return grid.innerRect;
  const col = clamp(Math.round(placement.col), 1, grid.cols);
  const row = clamp(Math.round(placement.row), 1, grid.rows);
  const colSpan = clamp(Math.round(placement.colSpan), 1, grid.cols - col + 1);
  const rowSpan = clamp(Math.round(placement.rowSpan), 1, grid.rows - row + 1);

  const x = grid.innerRect.x + (col - 1) * grid.cellWidth;
  const y = grid.innerRect.y + (row - 1) * grid.cellHeight;
  const width = colSpan * grid.cellWidth;
  const height = rowSpan * grid.cellHeight;

  return rect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

