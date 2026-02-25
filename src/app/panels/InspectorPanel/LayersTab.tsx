import { useEffect, useMemo, useState } from 'react';

import ui from '../../ui/ui.module.css';
import { Accordion } from '../../ui/Accordion';
import { Button } from '../../ui/Button';
import { ensureBuiltinNodeTypesRegistered, getNodeType, type ProjectJsonV2, type RenderNodeJson } from '../../../core';

import { SettingsFieldsForm } from './SettingsFieldsForm';

type Props = {
  project: ProjectJsonV2;
  onProjectChange: (updater: (prev: ProjectJsonV2) => ProjectJsonV2) => void;
  hasSelection: boolean;
  topologyMd5: string | null;
  topologyMd5Error: string | null;
  isComputingTopologyMd5: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVisibleNode(node: RenderNodeJson): boolean {
  if (node.type === 'legacy/template_layer') return false;
  if (node.type === 'core/image') return false;
  return true;
}

function isNodeEnabled(node: RenderNodeJson): boolean {
  return node.enabled !== false;
}

function moveNode(project: ProjectJsonV2, nodeId: string, direction: -1 | 1): ProjectJsonV2 {
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const currentIndex = nodes.findIndex((n) => n.id === nodeId);
  if (currentIndex < 0) return project;

  const visibleIndices = nodes.map((n, i) => (isVisibleNode(n) ? i : null)).filter((i): i is number => typeof i === 'number');
  const visiblePos = visibleIndices.indexOf(currentIndex);
  if (visiblePos < 0) return project;

  const targetPos = visiblePos + direction;
  if (targetPos < 0 || targetPos >= visibleIndices.length) return project;

  const targetIndex = visibleIndices[targetPos]!;
  const next = nodes.slice();
  const tmp = next[currentIndex]!;
  next[currentIndex] = next[targetIndex]!;
  next[targetIndex] = tmp;
  return { ...project, nodes: next };
}

function setNodeEnabled(project: ProjectJsonV2, nodeId: string, enabled: boolean): ProjectJsonV2 {
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  return {
    ...project,
    nodes: nodes.map((node) => (node.id === nodeId ? { ...node, enabled } : node)),
  };
}

function patchNodeProps(project: ProjectJsonV2, nodeId: string, patch: Record<string, unknown>): ProjectJsonV2 {
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  return {
    ...project,
    nodes: nodes.map((node) =>
      node.id === nodeId ? { ...node, props: { ...(isRecord(node.props) ? node.props : {}), ...patch } } : node,
    ),
  };
}

export function LayersTab({ project, onProjectChange, hasSelection, topologyMd5, topologyMd5Error, isComputingTopologyMd5 }: Props) {
  ensureBuiltinNodeTypesRegistered();

  const templateId = project.canvas.mode === 'template' ? project.canvas.templateId : 'fixed_size';
  const visibleNodes = useMemo(() => (Array.isArray(project.nodes) ? project.nodes.filter(isVisibleNode) : []), [project.nodes]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => visibleNodes[0]?.id ?? null);

  useEffect(() => {
    if (visibleNodes.length === 0) {
      if (selectedNodeId !== null) setSelectedNodeId(null);
      return;
    }
    const exists = visibleNodes.some((n) => n.id === selectedNodeId);
    if (!exists) setSelectedNodeId(visibleNodes[0]!.id);
  }, [selectedNodeId, visibleNodes]);

  const selected = useMemo(() => visibleNodes.find((n) => n.id === selectedNodeId) ?? null, [selectedNodeId, visibleNodes]);
  const selectedDef = useMemo(() => (selected ? getNodeType(selected.type) : null), [selected]);
  const selectedFields = useMemo(() => selectedDef?.fields ?? [], [selectedDef]);
  const selectedEnabled = selected ? isNodeEnabled(selected) : false;

  const topologyIdHint = useMemo(() => {
    if (!selected) return null;
    if (selected.type !== 'plugin/topology_mountain') return null;
    const seedMode = isRecord(selected.props) ? selected.props.seedMode : undefined;
    if (seedMode !== 'file_md5' && seedMode !== undefined) return null;
    if (!hasSelection) return '选择图片后生成 TOPOLOGY_ID';
    if (isComputingTopologyMd5) return 'TOPOLOGY_ID 计算中…';
    if (topologyMd5Error) return `TOPOLOGY_ID 计算失败：${topologyMd5Error}`;
    if (topologyMd5) return `TOPOLOGY_ID: ${topologyMd5.slice(0, 8).toUpperCase()}`;
    return 'TOPOLOGY_ID 未就绪';
  }, [hasSelection, isComputingTopologyMd5, selected, topologyMd5, topologyMd5Error]);

  const basicKeys = useMemo(() => new Set(['seedMode', 'manualSeed', 'positionMode', 'size', 'x', 'y']), []);
  const basicFields = useMemo(
    () => (selected?.type === 'plugin/topology_mountain' ? selectedFields.filter((f) => basicKeys.has(f.key)) : selectedFields),
    [basicKeys, selected?.type, selectedFields],
  );
  const advancedFields = useMemo(
    () => (selected?.type === 'plugin/topology_mountain' ? selectedFields.filter((f) => !basicKeys.has(f.key)) : []),
    [basicKeys, selected?.type, selectedFields],
  );

  return (
    <>
      <div className={ui.section}>
        <div className={ui.sectionTitle}>图层</div>
        <div className={ui.hint}>当前仍以旧模板引擎为主；此处先实现“插件图层”管理与动态属性面板。</div>
      </div>

      <div className={ui.section}>
        <div className={ui.sectionTitle}>模板</div>
        <div className={ui.hint}>
          当前模板：<span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{templateId}</span>（legacy）
        </div>
      </div>

      <div className={ui.section}>
        <div className={ui.sectionTitle}>插件图层</div>
        {visibleNodes.length === 0 ? <div className={ui.hint}>暂无插件图层</div> : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibleNodes.map((node, index) => {
            const def = getNodeType(node.type);
            const name = def?.meta.name ?? node.type;
            const active = node.id === selectedNodeId;
            const enabled = isNodeEnabled(node);

            return (
              <div
                key={node.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.06)',
                  background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
              >
                <button
                  type="button"
                  style={{ all: 'unset', cursor: 'pointer', flex: 1 }}
                  onClick={() => setSelectedNodeId(node.id)}
                  title={node.type}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => onProjectChange((prev) => setNodeEnabled(prev, node.id, e.target.checked))}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{name}</div>
                      <div className={ui.hint} style={{ margin: 0 }}>
                        {node.type}
                      </div>
                    </div>
                  </div>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onProjectChange((prev) => moveNode(prev, node.id, -1))}
                    title="上移"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    disabled={index === visibleNodes.length - 1}
                    onClick={() => onProjectChange((prev) => moveNode(prev, node.id, 1))}
                    title="下移"
                  >
                    ↓
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>{selectedDef?.meta.name ?? '属性'}</div>
          {selectedDef?.meta.description ? <div className={ui.hint}>{selectedDef.meta.description}</div> : null}
          {topologyIdHint ? <div className={ui.hint}>{topologyIdHint}</div> : null}

          {basicFields.length ? (
            <SettingsFieldsForm
              fields={basicFields}
              value={isRecord(selected.props) ? selected.props : {}}
              disabled={!selectedEnabled}
              onPatch={(patch) => onProjectChange((prev) => patchNodeProps(prev, selected.id, patch))}
            />
          ) : (
            <div className={ui.hint}>该图层暂无可编辑字段。</div>
          )}

          {advancedFields.length ? (
            <Accordion title="高级参数" defaultOpen={false}>
              <SettingsFieldsForm
                fields={advancedFields}
                value={isRecord(selected.props) ? selected.props : {}}
                disabled={!selectedEnabled}
                onPatch={(patch) => onProjectChange((prev) => patchNodeProps(prev, selected.id, patch))}
              />
            </Accordion>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
