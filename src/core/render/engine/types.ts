import type { ExifData } from '../../exif/types';
import type { MakerLogo } from '../../brand/makerLogo';
import type { ImageDrawMode, Rect } from '../templates';

export type ScaleModel = {
  designWidth: number;
  min: number;
  max: number;
};

export type Dimension =
  | number
  | {
      designPx: number;
      minPx?: number;
      maxPx?: number;
      round?: 'round' | 'floor' | 'ceil';
    };

export type LayoutSpec =
  | {
      kind: 'photo_only';
      photoDrawMode?: ImageDrawMode;
      photoCornerRadius?: Dimension;
    }
  | {
      kind: 'photo_plus_footer';
      footerHeight: Dimension;
      photoDrawMode?: ImageDrawMode;
      photoCornerRadius?: Dimension;
    };

export type ZoneGridSpec = {
  cols: number;
  rows: number;
  padding?: Dimension;
};

export type ZoneSpec = {
  grid?: ZoneGridSpec;
};

export type GridPlacement = {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
};

export type ConditionSpec = {
  hideWhenEmpty?: boolean;
  showWhenMakerLogoPresent?: boolean;
  showWhenMakerLogoMissing?: boolean;
  showWhenPalettePresent?: boolean;
};

export type TextBinding =
  | { kind: 'cameraName'; fallback?: string }
  | { kind: 'lensName'; fallback?: string }
  | { kind: 'dateTime'; fallback?: string }
  | { kind: 'makeUpper'; fallback?: string }
  | { kind: 'settings'; joinWith?: string; fallback?: string }
  | { kind: 'literal'; value: string };

export type FontFamily = 'sans' | 'mono';

export type TextStyle = {
  font?: FontFamily;
  weight?: number;
  size?: Dimension;
  color?: string;
  opacity?: number;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
};

export type LogoStyle = {
  style?: 'color' | 'mono';
  monoColor?: string;
  opacity?: number;
  maxWidth?: Dimension;
  maxHeight?: Dimension;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
};

export type RectStyle = {
  fill: string;
  opacity?: number;
  radius?: Dimension;
};

export type DividerStyle = {
  color: string;
  opacity?: number;
  thickness?: Dimension;
};

export type RectElement = {
  id: string;
  type: 'rect';
  layer?: 'backdrop' | 'overlay';
  zone: string;
  grid?: GridPlacement;
  style: RectStyle;
  condition?: ConditionSpec;
};

export type DividerElement = {
  id: string;
  type: 'divider';
  layer?: 'backdrop' | 'overlay';
  zone: string;
  grid?: GridPlacement;
  orientation?: 'horizontal' | 'vertical';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  style: DividerStyle;
  condition?: ConditionSpec;
};

export type TextElement = {
  id: string;
  type: 'text';
  layer?: 'backdrop' | 'overlay';
  zone: string;
  grid?: GridPlacement;
  bind: TextBinding;
  style: TextStyle;
  condition?: ConditionSpec;
  editable?: {
    visible?: boolean;
  };
};

export type MakerLogoElement = {
  id: string;
  type: 'maker_logo';
  layer?: 'backdrop' | 'overlay';
  zone: string;
  grid?: GridPlacement;
  style: LogoStyle;
  condition?: ConditionSpec;
  editable?: {
    visible?: boolean;
    logoStyle?: boolean;
    monoColor?: boolean;
  };
};

export type SwatchesElement = {
  id: string;
  type: 'swatches';
  layer?: 'backdrop' | 'overlay';
  zone: string;
  grid?: GridPlacement;
  count?: number;
  style?: {
    radius?: Dimension;
    gap?: Dimension;
    opacity?: number;
    stroke?: string;
  };
  condition?: ConditionSpec;
};

export type StackElement = {
  id: string;
  type: 'stack';
  layer?: 'backdrop' | 'overlay';
  zone: string;
  grid?: GridPlacement;
  direction?: 'vertical' | 'horizontal';
  gap?: Dimension;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
  children: ElementSpec[];
  condition?: ConditionSpec;
};

export type ElementSpec =
  | RectElement
  | DividerElement
  | TextElement
  | MakerLogoElement
  | SwatchesElement
  | StackElement;

export type TemplateRequirements = {
  palette?: boolean;
  makerLogo?: boolean;
};

export type TemplateJson = {
  id: string;
  name: string;
  description: string;
  scaleModel: ScaleModel;
  layout: LayoutSpec;
  zones?: Record<string, ZoneSpec>;
  requirements?: TemplateRequirements;
  elements: ElementSpec[];
};

export type ComputedLayout = {
  canvasWidth: number;
  canvasHeight: number;
  photoRect: Rect;
  zones: Record<string, Rect>;
  photoDrawMode: ImageDrawMode;
  photoCornerRadius?: number;
  scale: number;
};

export type EngineContext = {
  width: number;
  height: number;
  exif: ExifData;
  makerLogo?: MakerLogo | null;
  palette?: string[];
  scale: number;
  zones: Record<string, { rect: Rect; grid: { cols: number; rows: number; padding: number } }>;
};
