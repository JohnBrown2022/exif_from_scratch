import type { CompiledNode, RenderEnv } from './types';

export type SettingsField =
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number; default: number }
  | { kind: 'toggle'; key: string; label: string; default: boolean }
  | { kind: 'select'; key: string; label: string; options: Array<{ value: string; label: string }>; default: string }
  | { kind: 'text'; key: string; label: string; placeholder?: string; default: string };

export type NodeTypeDef = {
  type: string;
  meta: { name: string; description: string; icon?: string };
  fields?: SettingsField[];
  defaultProps?: Record<string, unknown>;
  sanitizeProps?: (raw: unknown) => Record<string, unknown>;
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

