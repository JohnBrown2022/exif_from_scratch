import type { CompiledNode, Rect, RenderEnv, RenderNodeJson } from './types';

type FieldRule = { key: string; equals: string | boolean };

type SettingsFieldBase = {
  key: string;
  label: string;
  hint?: string;
  showWhen?: FieldRule;
  disabledWhen?: FieldRule;
};

export type SettingsField =
  | (SettingsFieldBase & { kind: 'slider'; min: number; max: number; step: number; default: number })
  | (SettingsFieldBase & { kind: 'toggle'; default: boolean })
  | (SettingsFieldBase & { kind: 'select'; options: Array<{ value: string; label: string }>; default: string })
  | (SettingsFieldBase & { kind: 'text'; placeholder?: string; default: string });

export type NodeTypeDef = {
  type: string;
  meta: { name: string; description: string; icon?: string };
  fields?: SettingsField[];
  defaultProps?: Record<string, unknown>;
  sanitizeProps?: (raw: unknown) => Record<string, unknown>;
  resolveRect?: (input: { node: RenderNodeJson; props: Record<string, unknown>; env: RenderEnv }) => Rect | null;
  render: (ctx: CanvasRenderingContext2D, node: CompiledNode, env: RenderEnv) => void | Promise<void>;
  requirements?: {
    palette?: boolean;
    makerLogo?: boolean;
  };
};

const nodeRegistry = new Map<string, NodeTypeDef>();

export function registerNodeType(def: NodeTypeDef) {
  nodeRegistry.set(def.type, def);
}

export function getNodeType(type: string): NodeTypeDef | null {
  return nodeRegistry.get(type) ?? null;
}

export function listNodeTypes(): NodeTypeDef[] {
  return Array.from(nodeRegistry.values());
}
