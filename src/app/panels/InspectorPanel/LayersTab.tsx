import { useMemo, useState } from 'react';

import ui from '../../ui/ui.module.css';
import { Accordion } from '../../ui/Accordion';
import { Field } from '../../ui/Field';
import type { TemplateId, TopologyWatermarkSettings } from '../../../core';
import { ensureBuiltinNodeTypesRegistered, getNodeType } from '../../../core';

import { SettingsFieldsForm } from './SettingsFieldsForm';

type LayerId = 'template' | 'photo' | 'topology_mountain';

type Props = {
  templateId: TemplateId;
  hasSelection: boolean;

  topologyWatermarkSettings: TopologyWatermarkSettings;
  onTopologyWatermarkSettingsChange: (patch: Partial<TopologyWatermarkSettings>) => void;
  topologyMd5: string | null;
  topologyMd5Error: string | null;
  isComputingTopologyMd5: boolean;
};

export function LayersTab({
  templateId,
  hasSelection,
  topologyWatermarkSettings,
  onTopologyWatermarkSettingsChange,
  topologyMd5,
  topologyMd5Error,
  isComputingTopologyMd5,
}: Props) {
  ensureBuiltinNodeTypesRegistered();

  const [layer, setLayer] = useState<LayerId>('topology_mountain');

  const topologyDef = useMemo(() => getNodeType('plugin/topology_mountain'), []);
  const topologyFields = topologyDef?.fields ?? [];
  const basicKeys = useMemo(() => new Set(['seedMode', 'manualSeed', 'positionMode', 'size', 'x', 'y']), []);
  const basicFields = useMemo(() => topologyFields.filter((f) => basicKeys.has(f.key)), [basicKeys, topologyFields]);
  const advancedFields = useMemo(() => topologyFields.filter((f) => !basicKeys.has(f.key)), [basicKeys, topologyFields]);

  const topologyIdHint = useMemo(() => {
    if (topologyWatermarkSettings.seedMode !== 'file_md5') return null;
    if (!hasSelection) return '选择图片后生成 TOPOLOGY_ID';
    if (isComputingTopologyMd5) return 'TOPOLOGY_ID 计算中…';
    if (topologyMd5Error) return `TOPOLOGY_ID 计算失败：${topologyMd5Error}`;
    if (topologyMd5) return `TOPOLOGY_ID: ${topologyMd5.slice(0, 8).toUpperCase()}`;
    return 'TOPOLOGY_ID 未就绪';
  }, [hasSelection, isComputingTopologyMd5, topologyMd5, topologyMd5Error, topologyWatermarkSettings.seedMode]);

  return (
    <>
      <div className={ui.section}>
        <div className={ui.sectionTitle}>图层（实验）</div>
        <div className={ui.hint}>当前仍以旧模板引擎为主；这里先把“模板 / 照片 / 插件水印”显式化。</div>
      </div>

      <Field label="选择图层">
        <select className={ui.control} value={layer} onChange={(e) => setLayer(e.target.value as LayerId)}>
          <option value="template">模板（{templateId}）</option>
          <option value="photo">照片</option>
          <option value="topology_mountain">山水徽（插件）</option>
        </select>
      </Field>

      {layer === 'template' ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>模板层</div>
          <div className={ui.hint}>当前仍由 `legacy/template_layer` 渲染（迁移中）。</div>
        </div>
      ) : null}

      {layer === 'photo' ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>照片层</div>
          <div className={ui.hint}>等同于 `core/image` 节点。</div>
        </div>
      ) : null}

      {layer === 'topology_mountain' ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>山水徽（拓扑水印）</div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={topologyWatermarkSettings.enabled}
              onChange={(e) => onTopologyWatermarkSettingsChange({ enabled: e.target.checked })}
            />
            <span>启用</span>
          </label>
          <div className={ui.hint}>仅作用于照片区域，位于模板元素下方。</div>

          {topologyIdHint ? <div className={ui.hint}>{topologyIdHint}</div> : null}

          {basicFields.length ? (
            <SettingsFieldsForm
              fields={basicFields}
              value={topologyWatermarkSettings as unknown as Record<string, unknown>}
              disabled={!topologyWatermarkSettings.enabled}
              onPatch={(patch) => onTopologyWatermarkSettingsChange(patch as Partial<TopologyWatermarkSettings>)}
            />
          ) : (
            <div className={ui.hint}>插件字段未注册（请检查 node registry）。</div>
          )}

          {advancedFields.length ? (
            <Accordion title="高级参数" defaultOpen={false}>
              <SettingsFieldsForm
                fields={advancedFields}
                value={topologyWatermarkSettings as unknown as Record<string, unknown>}
                disabled={!topologyWatermarkSettings.enabled}
                onPatch={(patch) => onTopologyWatermarkSettingsChange(patch as Partial<TopologyWatermarkSettings>)}
              />
            </Accordion>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

