import { useEffect, useMemo, useState } from 'react';

import ui from '../../ui/ui.module.css';
import { Accordion } from '../../ui/Accordion';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import {
  EXIF_FIELD_KINDS,
  ensureBuiltinNodeTypesRegistered,
  getBuiltinTemplateJson,
  getNodeType,
  listNodeTypes,
  replaceProjectTemplate,
  WATERMARK_TEMPLATES,
  type ExifFieldKind,
  type ProjectJsonV2,
  type RenderNodeJson,
  type TemplateId,
  type TemplateJson,
} from '../../../core';

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

type TextBindingJson = {
  kind: string;
  parts?: TextBindingJson[];
  value?: string;
  joinWith?: string;
  fallback?: string;
};

function isTextBindingJson(value: unknown): value is TextBindingJson {
  return isRecord(value) && typeof value.kind === 'string';
}

function listExifFieldKinds(bind: TextBindingJson): ExifFieldKind[] {
  if (bind.kind === 'concat') {
    const parts = Array.isArray(bind.parts) ? bind.parts : [];
    return parts.flatMap(listExifFieldKinds);
  }
  if (bind.kind === 'literal') return [];
  return (EXIF_FIELD_KINDS as readonly string[]).includes(bind.kind) ? [bind.kind as ExifFieldKind] : [];
}

function uniqueStable<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

const EXIF_FIELD_LABELS: Record<ExifFieldKind, string> = {
  cameraName: '相机',
  lensName: '镜头',
  dateTime: '日期',
  makeUpper: '厂商',
  settings: '参数',
  focalLength: '焦距',
  aperture: '光圈',
  shutter: '快门',
  iso: 'ISO',
};

function truncateLabel(value: string, maxLen: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1))}…`;
}

function formatLabelList(items: string[], maxItems: number): string {
  const trimmed = items.map((v) => v.trim()).filter(Boolean);
  if (trimmed.length <= maxItems) return trimmed.join(' / ');
  return `${trimmed.slice(0, maxItems).join(' / ')}…`;
}

type TemplateNodeMeta = {
  layer: 'backdrop' | 'overlay';
  elementId: string | null;
};

function extractTemplateNodeMeta(nodeId: string, templateId: TemplateId): TemplateNodeMeta | null {
  const backdropPrefix = `tpl_backdrop_${templateId}`;
  if (nodeId === backdropPrefix) return { layer: 'backdrop', elementId: null };
  if (nodeId.startsWith(`${backdropPrefix}_`)) {
    const elementId = nodeId.slice(`${backdropPrefix}_`.length);
    return { layer: 'backdrop', elementId: elementId.length ? elementId : null };
  }

  const overlayPrefix = `tpl_overlay_${templateId}`;
  if (nodeId === overlayPrefix) return { layer: 'overlay', elementId: null };
  if (nodeId.startsWith(`${overlayPrefix}_`)) {
    const elementId = nodeId.slice(`${overlayPrefix}_`.length);
    return { layer: 'overlay', elementId: elementId.length ? elementId : null };
  }

  return null;
}

function getTemplateElementLabel(template: TemplateJson | null, elementId: string | null): string | null {
  if (!template || !elementId) return null;
  const el = template.elements.find((candidate) => candidate.id === elementId);
  if (!el) return null;
  const label = 'label' in el ? el.label : null;
  if (typeof label === 'string' && label.trim().length) return label.trim();
  if (typeof el.id === 'string' && el.id.trim().length) return el.id.trim();
  return null;
}

function toBaseId(type: string): string {
  const last = type.split('/').filter(Boolean).pop() ?? type;
  return last.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
}

function createUniqueNodeId(project: ProjectJsonV2, base: string): string {
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const existing = new Set(nodes.map((n) => n.id));
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}_${Math.random().toString(16).slice(2, 8)}`;
}

function defaultClipForNodeType(type: string): RenderNodeJson['clip'] {
  if (type === 'plugin/topology_mountain') return 'photo';
  return 'none';
}

function insertNodeBeforeTemplateOverlay(nodes: RenderNodeJson[], node: RenderNodeJson): RenderNodeJson[] {
  const overlayIndexById = nodes.findIndex((n) => typeof n.id === 'string' && n.id.startsWith('tpl_overlay'));
  if (overlayIndexById >= 0) return [...nodes.slice(0, overlayIndexById), node, ...nodes.slice(overlayIndexById)];

  const overlayIndex = nodes.findIndex((n) => {
    if (n.type !== 'legacy/template_layer') return false;
    if (!isRecord(n.props)) return false;
    return n.props.layer === 'overlay';
  });
  if (overlayIndex < 0) return [...nodes, node];
  return [...nodes.slice(0, overlayIndex), node, ...nodes.slice(overlayIndex)];
}

function moveNode(project: ProjectJsonV2, nodeId: string, direction: -1 | 1): ProjectJsonV2 {
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const visibleNodes = nodes.filter(isVisibleNode);
  const visiblePos = visibleNodes.findIndex((n) => n.id === nodeId);
  if (visiblePos < 0) return project;

  const targetPos = visiblePos + direction;
  if (targetPos < 0 || targetPos >= visibleNodes.length) return project;

  const reorderedVisible = visibleNodes.slice();
  const [moved] = reorderedVisible.splice(visiblePos, 1);
  reorderedVisible.splice(targetPos, 0, moved);

  let visibleCursor = 0;
  const next = nodes.map((node) => (isVisibleNode(node) ? reorderedVisible[visibleCursor++]! : node));
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

function setNodeProps(project: ProjectJsonV2, nodeId: string, nextProps: Record<string, unknown>): ProjectJsonV2 {
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  return {
    ...project,
    nodes: nodes.map((node) => (node.id === nodeId ? { ...node, props: nextProps } : node)),
  };
}

export function LayersTab({ project, onProjectChange, hasSelection, topologyMd5, topologyMd5Error, isComputingTopologyMd5 }: Props) {
  ensureBuiltinNodeTypesRegistered();

  const templateId = project.canvas.mode === 'template' ? (project.canvas.templateId as TemplateId) : null;
  const templateJson = useMemo(() => (templateId ? getBuiltinTemplateJson(templateId) : null), [templateId]);
  const templateMeta = useMemo(() => (templateId ? WATERMARK_TEMPLATES.find((t) => t.id === templateId) ?? null : null), [templateId]);
  const visibleNodes = useMemo(() => (Array.isArray(project.nodes) ? project.nodes.filter(isVisibleNode) : []), [project.nodes]);
  const pluginNodeTypes = useMemo(() => listNodeTypes().filter((t) => t.type.startsWith('plugin/')), []);
  const [newPluginType, setNewPluginType] = useState<string>(() => pluginNodeTypes[0]?.type ?? 'plugin/topology_mountain');

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
  const selectedIsText = selected?.type === 'core/text';
  const selectedIsTextStack = selected?.type === 'core/text_stack';

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

  const textStackItems = useMemo(() => {
    if (!selectedIsTextStack) return [];
    const props = selected && isRecord(selected.props) ? selected.props : {};
    const items = Array.isArray(props.items) ? props.items : [];
    return items
      .map((raw, index) => ({ raw, index }))
      .filter(({ raw }) => isRecord(raw) && typeof raw.id === 'string' && raw.id.trim().length);
  }, [selected, selectedIsTextStack]);

  function patchSelectedTextNode(updater: (prev: Record<string, unknown>) => Record<string, unknown>) {
    if (!selected) return;
    onProjectChange((prevProject) => {
      const nodes = Array.isArray(prevProject.nodes) ? prevProject.nodes : [];
      const node = nodes.find((n) => n.id === selected.id);
      if (!node || node.type !== 'core/text') return prevProject;
      const props = isRecord(node.props) ? node.props : {};
      const next = updater(props);
      const cleaned: Record<string, unknown> = { ...next };
      if (Array.isArray(cleaned.hiddenFields) && cleaned.hiddenFields.length === 0) delete cleaned.hiddenFields;
      return setNodeProps(prevProject, selected.id, cleaned);
    });
  }

  function patchTextStackItem(index: number, updater: (prev: Record<string, unknown>) => Record<string, unknown>) {
    if (!selected) return;
    onProjectChange((prevProject) => {
      const nodes = Array.isArray(prevProject.nodes) ? prevProject.nodes : [];
      const node = nodes.find((n) => n.id === selected.id);
      if (!node || node.type !== 'core/text_stack') return prevProject;
      const props = isRecord(node.props) ? node.props : {};
      const items = Array.isArray(props.items) ? props.items : [];
      const nextItems = items.map((raw, i) => {
        if (i !== index) return raw;
        if (!isRecord(raw)) return raw;
        const next = updater(raw);
        const cleaned: Record<string, unknown> = { ...next };
        if (cleaned.enabled !== false) delete cleaned.enabled;
        if (Array.isArray(cleaned.hiddenFields) && cleaned.hiddenFields.length === 0) delete cleaned.hiddenFields;
        if (typeof cleaned.label !== 'string' || cleaned.label.trim().length === 0) delete cleaned.label;
        return cleaned;
      });
      return patchNodeProps(prevProject, selected.id, { items: nextItems });
    });
  }

  function handleAddPluginLayer() {
    const type = newPluginType;
    let createdId: string | null = null;
    onProjectChange((prev) => {
      const def = getNodeType(type);
      const baseId = toBaseId(type);
      const id = createUniqueNodeId(prev, baseId);
      createdId = id;

      const nextNode: RenderNodeJson = {
        id,
        type,
        clip: defaultClipForNodeType(type),
        props: def?.defaultProps ?? {},
      };
      const nextNodes = insertNodeBeforeTemplateOverlay(Array.isArray(prev.nodes) ? prev.nodes : [], nextNode);
      return { ...prev, nodes: nextNodes };
    });
    if (createdId) setSelectedNodeId(createdId);
  }

  function handleDeleteSelectedLayer() {
    if (!selectedNodeId) return;
    const nodeId = selectedNodeId;
    onProjectChange((prev) => {
      const nextNodes = (Array.isArray(prev.nodes) ? prev.nodes : []).filter((n) => n.id !== nodeId);
      return { ...prev, nodes: nextNodes };
    });
  }

  return (
    <>
      <div className={ui.section}>
        <div className={ui.sectionTitle}>图层</div>
        <div className={ui.hint}>此处展示可编辑图层（模板元素 / 插件 / 基础元素）。名称会尽量从模板源码与 EXIF 绑定推导，避免反复点开确认。</div>
      </div>

      <div className={ui.section}>
        <div className={ui.sectionTitle}>模板</div>
        {templateId ? (
          <>
            <Field label="模板" hint="切换模板会替换模板图层，但会保留你新增的插件/自定义图层。">
              <select
                className={ui.control}
                value={templateId}
                onChange={(e) => {
                  const next = e.target.value as TemplateId;
                  onProjectChange((prev) => replaceProjectTemplate(prev, next));
                }}
              >
                {WATERMARK_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            {templateMeta?.description ? <div className={ui.hint}>{templateMeta.description}</div> : null}
          </>
        ) : (
          <div className={ui.hint}>
            当前画布：<span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>fixed_size</span>
          </div>
        )}
      </div>

      <div className={ui.section}>
        <div className={ui.sectionTitle}>图层列表</div>
        {visibleNodes.length === 0 ? <div className={ui.hint}>暂无可编辑图层</div> : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <select
            className={ui.control}
            value={newPluginType}
            onChange={(e) => setNewPluginType(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
            disabled={pluginNodeTypes.length === 0}
          >
            {pluginNodeTypes.map((t) => (
              <option key={t.type} value={t.type}>
                {t.meta.name}
              </option>
            ))}
          </select>
          <Button type="button" onClick={handleAddPluginLayer} disabled={pluginNodeTypes.length === 0} title="添加插件图层">
            +
          </Button>
          <Button type="button" onClick={handleDeleteSelectedLayer} disabled={!selectedNodeId} title="删除选中图层">
            删除
          </Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibleNodes.map((node, index) => {
            const def = getNodeType(node.type);
            const baseName = def?.meta.name ?? node.type;
            const meta = templateId ? extractTemplateNodeMeta(node.id, templateId) : null;
            const templateLabel = meta ? getTemplateElementLabel(templateJson, meta.elementId) : null;

            let name = baseName;
            if (node.type === 'core/text' && isRecord(node.props)) {
              const rawBind = node.props.bind;
              if (isTextBindingJson(rawBind)) {
                if (rawBind.kind === 'literal') {
                  const value = typeof rawBind.value === 'string' ? rawBind.value : '';
                  name = value.trim().length ? `固定文案（${truncateLabel(value, 14)}）` : '固定文案';
                } else if (rawBind.kind === 'concat') {
                  const kinds = uniqueStable(listExifFieldKinds(rawBind)).filter((kind) => Boolean(EXIF_FIELD_LABELS[kind]));
                  const labels = kinds.map((k) => EXIF_FIELD_LABELS[k] ?? k);
                  name = labels.length ? `组合字段（${formatLabelList(labels, 3)}）` : '组合字段';
                } else if ((EXIF_FIELD_KINDS as readonly string[]).includes(rawBind.kind)) {
                  name = EXIF_FIELD_LABELS[rawBind.kind as ExifFieldKind] ?? baseName;
                }
              }
            } else if (node.type === 'core/text_stack' && isRecord(node.props)) {
              const rawItems = node.props.items;
              const items = Array.isArray(rawItems) ? rawItems.filter((v): v is Record<string, unknown> => isRecord(v)) : [];
              const labels = items
                .map((item) => {
                  if (typeof item.label === 'string' && item.label.trim().length) return item.label.trim();
                  const bind = isTextBindingJson(item.bind) ? (item.bind as TextBindingJson) : null;
                  if (!bind) return null;
                  if (bind.kind === 'literal') {
                    const value = typeof bind.value === 'string' ? bind.value : '';
                    return value.trim().length ? truncateLabel(value, 12) : '固定文案';
                  }
                  if (bind.kind === 'concat') {
                    const kinds = uniqueStable(listExifFieldKinds(bind)).filter((kind) => Boolean(EXIF_FIELD_LABELS[kind]));
                    const exifLabels = kinds.map((k) => EXIF_FIELD_LABELS[k] ?? k);
                    return exifLabels.length ? `组合（${formatLabelList(exifLabels, 2)}）` : '组合字段';
                  }
                  if ((EXIF_FIELD_KINDS as readonly string[]).includes(bind.kind)) {
                    return EXIF_FIELD_LABELS[bind.kind as ExifFieldKind] ?? null;
                  }
                  return null;
                })
                .filter((v): v is string => Boolean(v));
              if (labels.length) name = `${baseName}（${formatLabelList(uniqueStable(labels), 4)}）`;
            } else if (templateLabel) {
              name = templateLabel;
            }

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
                        {node.type} · {node.id}
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

          {selectedIsTextStack ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className={ui.hint}>编辑堆栈内的每一行：开关/固定文案/组合字段拆分。</div>

              {textStackItems.map(({ raw, index }) => {
                const item = raw as Record<string, unknown>;
                const itemId = String(item.id);
                const label = typeof item.label === 'string' && item.label.trim().length ? item.label.trim() : itemId;
                const enabled = item.enabled !== false;
                const bind = isTextBindingJson(item.bind) ? (item.bind as TextBindingJson) : null;
                const hidden = new Set(Array.isArray(item.hiddenFields) ? (item.hiddenFields as ExifFieldKind[]) : []);

                const fields =
                  bind && bind.kind === 'concat'
                    ? uniqueStable(listExifFieldKinds(bind)).filter((kind) => Boolean(EXIF_FIELD_LABELS[kind]))
                    : [];

                return (
                  <div
                    key={`${itemId}:${index}`}
                    style={{
                      padding: '10px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </div>
                        <div className={ui.hint} style={{ margin: 0 }}>
                          {itemId}
                          {bind ? ` · ${bind.kind}` : ''}
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => patchTextStackItem(index, (prev) => ({ ...prev, enabled: e.target.checked ? undefined : false }))}
                        />
                        <span>显示</span>
                      </label>
                    </div>

                    {bind && bind.kind === 'literal' ? (
                      <div style={{ marginTop: 10 }}>
                        <Field label="固定文案">
                          <input
                            className={ui.control}
                            type="text"
                            value={typeof bind.value === 'string' ? bind.value : ''}
                            disabled={!enabled || !selectedEnabled}
                            onChange={(e) =>
                              patchTextStackItem(index, (prev) => ({
                                ...prev,
                                bind: { ...(isRecord(prev.bind) ? prev.bind : {}), kind: 'literal', value: e.target.value },
                              }))
                            }
                          />
                        </Field>
                      </div>
                    ) : null}

                    {bind && bind.kind === 'concat' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                        <Field label="分隔符" hint="用于组合字段的连接符。">
                          <input
                            className={ui.control}
                            type="text"
                            value={typeof bind.joinWith === 'string' ? bind.joinWith : ''}
                            disabled={!enabled || !selectedEnabled}
                            onChange={(e) =>
                              patchTextStackItem(index, (prev) => ({
                                ...prev,
                                bind: { ...(isRecord(prev.bind) ? prev.bind : {}), kind: 'concat', joinWith: e.target.value },
                              }))
                            }
                          />
                        </Field>

                        {fields.length >= 2 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                              组合字段
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                              {fields.map((kind) => {
                                const checked = !hidden.has(kind);
                                return (
                                  <label key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!enabled || !selectedEnabled}
                                      onChange={(e) => {
                                        patchTextStackItem(index, (prev) => {
                                          const prevHidden = new Set(
                                            Array.isArray(prev.hiddenFields) ? (prev.hiddenFields as ExifFieldKind[]) : [],
                                          );
                                          if (e.target.checked) prevHidden.delete(kind);
                                          else prevHidden.add(kind);
                                          const asArray = Array.from(prevHidden);
                                          return { ...prev, hiddenFields: asArray.length ? asArray : undefined };
                                        });
                                      }}
                                    />
                                    <span>{EXIF_FIELD_LABELS[kind] ?? kind}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {selectedIsText ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className={ui.hint}>编辑该文本：固定文案/组合字段拆分。</div>

              {(() => {
                const props = selected && isRecord(selected.props) ? selected.props : {};
                const bind = isTextBindingJson(props.bind) ? (props.bind as TextBindingJson) : null;
                const hidden = new Set(Array.isArray(props.hiddenFields) ? (props.hiddenFields as ExifFieldKind[]) : []);
                const fields =
                  bind && bind.kind === 'concat'
                    ? uniqueStable(listExifFieldKinds(bind)).filter((kind) => Boolean(EXIF_FIELD_LABELS[kind]))
                    : [];

                return (
                  <>
                    {bind && bind.kind === 'literal' ? (
                      <Field label="固定文案">
                        <input
                          className={ui.control}
                          type="text"
                          value={typeof bind.value === 'string' ? bind.value : ''}
                          disabled={!selectedEnabled}
                          onChange={(e) =>
                            patchSelectedTextNode((prev) => ({
                              ...prev,
                              bind: { ...(isRecord(prev.bind) ? prev.bind : {}), kind: 'literal', value: e.target.value },
                            }))
                          }
                        />
                      </Field>
                    ) : null}

                    {bind && bind.kind === 'concat' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Field label="分隔符" hint="用于组合字段的连接符。">
                          <input
                            className={ui.control}
                            type="text"
                            value={typeof bind.joinWith === 'string' ? bind.joinWith : ''}
                            disabled={!selectedEnabled}
                            onChange={(e) =>
                              patchSelectedTextNode((prev) => ({
                                ...prev,
                                bind: { ...(isRecord(prev.bind) ? prev.bind : {}), kind: 'concat', joinWith: e.target.value },
                              }))
                            }
                          />
                        </Field>

                        {fields.length >= 2 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                              组合字段
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                              {fields.map((kind) => {
                                const checked = !hidden.has(kind);
                                return (
                                  <label key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!selectedEnabled}
                                      onChange={(e) => {
                                        patchSelectedTextNode((prev) => {
                                          const prevHidden = new Set(Array.isArray(prev.hiddenFields) ? (prev.hiddenFields as ExifFieldKind[]) : []);
                                          if (e.target.checked) prevHidden.delete(kind);
                                          else prevHidden.add(kind);
                                          const asArray = Array.from(prevHidden);
                                          return { ...prev, hiddenFields: asArray.length ? asArray : undefined };
                                        });
                                      }}
                                    />
                                    <span>{EXIF_FIELD_LABELS[kind] ?? kind}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : null}

          {basicFields.length ? (
            <SettingsFieldsForm
              fields={basicFields}
              value={isRecord(selected.props) ? selected.props : {}}
              disabled={!selectedEnabled}
              onPatch={(patch) => onProjectChange((prev) => patchNodeProps(prev, selected.id, patch))}
            />
          ) : selectedIsTextStack || selectedIsText ? null : (
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
