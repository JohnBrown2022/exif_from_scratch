import type { ExifData } from '../exif/types';
import type { CanvasRotation } from '../exif/readRotation';
import type { MakerLogo } from '../brand/makerLogo';

export type ProjectVersion = '2.0';

export type Length = number | `${number}%`;

export type Anchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export type NodeLayout =
  | {
      kind: 'rect';
      relativeTo?: 'canvas' | 'photo';
      x: Length;
      y: Length;
      width: Length;
      height: Length;
    }
  | {
      kind: 'anchor';
      relativeTo?: 'canvas' | 'photo';
      anchor: Anchor;
      offsetX: Length;
      offsetY: Length;
      width: Length;
      height: Length;
    };

export type NodeClip = 'none' | 'photo';

export type RenderNodeJson = {
  id: string;
  type: string;
  enabled?: boolean;
  layout?: NodeLayout;
  clip?: NodeClip;
  props: Record<string, unknown>;
};

export type CanvasBackground =
  | { mode: 'none' }
  | { mode: 'color'; color: string }
  | { mode: 'blur'; blurRadius: number; darken?: number };

export type CanvasSpec =
  | {
      mode: 'template';
      templateId: string;
      background?: CanvasBackground;
    }
  | {
      mode: 'fixed_size';
      width: number;
      height: number;
      background?: CanvasBackground;
    };

export type ProjectJsonV2 = {
  version: ProjectVersion;
  canvas: CanvasSpec;
  nodes: RenderNodeJson[];
};

export type Rect = { x: number; y: number; width: number; height: number };

export type RenderEnvInput = {
  canvas: { width: number; height: number };
  image: {
    source: CanvasImageSource;
    width: number;
    height: number;
    rotation?: CanvasRotation | null;
  };
  exif: ExifData;
  makerLogo?: MakerLogo | null;
  seeds?: {
    fileMd5?: string | null;
    fallback: string;
  };
};

export type RenderEnv = RenderEnvInput & {
  imageRect: Rect;
  photoRect: Rect;
  imageDrawMode: 'contain' | 'cover';
  photoCornerRadius?: number;
  palette?: string[];
};

export type CompiledNode = {
  id: string;
  type: string;
  enabled: boolean;
  clip: NodeClip;
  rect: Rect;
  props: Record<string, unknown>;
};

export type CompiledProject = {
  version: ProjectVersion;
  canvas: { width: number; height: number; background: CanvasBackground };
  nodes: CompiledNode[];
};
