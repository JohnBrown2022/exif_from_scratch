import type { Rect } from '../templates';

import { clamp } from '../../utils/clamp';

import type { BoxSpec } from './types';
import { resolveDimension } from './values';

export function rectFromBox(base: Rect, box: BoxSpec | undefined, scale: number): Rect {
  if (!box) return { ...base };

  const left = typeof box.left !== 'undefined' ? resolveDimension(box.left, scale, 0) : undefined;
  const right = typeof box.right !== 'undefined' ? resolveDimension(box.right, scale, 0) : undefined;
  const top = typeof box.top !== 'undefined' ? resolveDimension(box.top, scale, 0) : undefined;
  const bottom = typeof box.bottom !== 'undefined' ? resolveDimension(box.bottom, scale, 0) : undefined;
  const widthValue =
    typeof box.width !== 'undefined' ? resolveDimension(box.width, scale, Math.max(0, base.width)) : undefined;
  const heightValue =
    typeof box.height !== 'undefined' ? resolveDimension(box.height, scale, Math.max(0, base.height)) : undefined;

  let x = base.x;
  let width = base.width;

  if (typeof widthValue === 'number') {
    width = widthValue;
    if (typeof left === 'number') x = base.x + left;
    else if (typeof right === 'number') x = base.x + base.width - right - width;
    else x = base.x + (base.width - width) / 2;
  } else {
    const resolvedLeft = typeof left === 'number' ? left : 0;
    const resolvedRight = typeof right === 'number' ? right : 0;
    x = base.x + resolvedLeft;
    width = base.width - resolvedLeft - resolvedRight;
  }

  let y = base.y;
  let height = base.height;

  if (typeof heightValue === 'number') {
    height = heightValue;
    if (typeof top === 'number') y = base.y + top;
    else if (typeof bottom === 'number') y = base.y + base.height - bottom - height;
    else y = base.y + (base.height - height) / 2;
  } else {
    const resolvedTop = typeof top === 'number' ? top : 0;
    const resolvedBottom = typeof bottom === 'number' ? bottom : 0;
    y = base.y + resolvedTop;
    height = base.height - resolvedTop - resolvedBottom;
  }

  let nextX = x;
  let nextY = y;
  let nextWidth = Math.max(0, width);
  let nextHeight = Math.max(0, height);

  // Keep boxes within the base rect. This prevents templates from placing fixed-size overlays entirely
  // out of bounds on very small preview sizes.
  if (nextWidth > base.width) {
    nextWidth = Math.max(0, base.width);
    nextX = base.x;
  } else {
    nextX = clamp(nextX, base.x, base.x + base.width - nextWidth);
  }

  if (nextHeight > base.height) {
    nextHeight = Math.max(0, base.height);
    nextY = base.y;
  } else {
    nextY = clamp(nextY, base.y, base.y + base.height - nextHeight);
  }

  return {
    x: Math.round(nextX),
    y: Math.round(nextY),
    width: Math.max(0, Math.round(nextWidth)),
    height: Math.max(0, Math.round(nextHeight)),
  };
}
