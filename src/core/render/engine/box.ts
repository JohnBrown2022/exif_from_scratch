import type { Rect } from '../templates';

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

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  };
}

