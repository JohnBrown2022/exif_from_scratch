import { useMemo, useState } from 'react';

import ui from '../../ui/ui.module.css';
import { Accordion } from '../../ui/Accordion';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import {
  clearElementOverride,
  getBuiltinTemplateJson,
  loadTemplateOverride,
  saveTemplateOverride,
  setElementOverride,
  type ElementSpec,
  type GridOverride,
  type TemplateId,
} from '../../../core';

import { clampInt, getElementLabel } from './templateUtils';

type Props = {
  templateId: TemplateId;
  onTemplateOverridesChange: () => void;
};

function isLayoutMovable(el: ElementSpec): boolean {
  return el.type === 'text' || el.type === 'maker_logo' || el.type === 'stack';
}

const ALIGN_LABELS: Record<string, string> = {
  left: '左对齐',
  center: '居中',
  right: '右对齐',
};

const VALIGN_LABELS: Record<string, string> = {
  top: '顶部',
  middle: '居中',
  bottom: '底部',
};

function ElementCard({
  el,
  templateId,
  elementOverrides,
  templateJson,
  onTemplateOverridesChange,
}: {
  el: ElementSpec;
  templateId: TemplateId;
  elementOverrides: Record<string, Record<string, unknown>>;
  templateJson: { zones?: Record<string, { grid?: { cols?: number; rows?: number } }> };
  onTemplateOverridesChange: () => void;
}) {
  const ov = (elementOverrides[el.id] ?? {}) as { grid?: GridOverride; align?: string; vAlign?: string };
  const zoneGrid = templateJson.zones?.[el.zone]?.grid;
  const cols = clampInt(zoneGrid?.cols ?? 12, 1, 48);
  const rows = clampInt(zoneGrid?.rows ?? 12, 1, 48);

  const defaultGrid: GridOverride = el.grid ?? { col: 1, colSpan: cols, row: 1, rowSpan: rows };
  const currentGrid: GridOverride = ov.grid ?? defaultGrid;

  const defaultAlign =
    el.type === 'text'
      ? el.style.align ?? 'left'
      : el.type === 'maker_logo'
        ? el.style.align ?? 'left'
        : el.type === 'stack'
          ? el.align ?? 'left'
          : 'left';
  const defaultVAlign =
    el.type === 'text'
      ? el.style.vAlign ?? 'top'
      : el.type === 'maker_logo'
        ? el.style.vAlign ?? 'top'
        : el.type === 'stack'
          ? el.vAlign ?? 'top'
          : 'top';

  const currentAlign = (ov.align ?? defaultAlign) as 'left' | 'center' | 'right';
  const currentVAlign = (ov.vAlign ?? defaultVAlign) as 'top' | 'middle' | 'bottom';

  const colSpanMax = Math.max(1, cols - currentGrid.col + 1);
  const rowSpanMax = Math.max(1, rows - currentGrid.row + 1);

  const hasOverride = ov.grid || ov.align || ov.vAlign;

  const label = getElementLabel(el);
  const typeLabel = el.type === 'text' ? '文本' : el.type === 'maker_logo' ? '品牌 Logo' : el.type === 'stack' ? '堆叠组' : el.type;

  return (
    <div style={{ paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
          <span className={ui.muted} style={{ fontSize: 11, marginLeft: 6 }}>{typeLabel}</span>
        </div>
        {hasOverride ? (
          <button
            type="button"
            style={{
              fontSize: 11,
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
            title="重置该元素"
            onClick={() => {
              clearElementOverride(templateId, el.id);
              onTemplateOverridesChange();
            }}
          >
            ↺ 重置
          </button>
        ) : null}
      </div>

      {/* Position: col + row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <Field label="起始列">
          <input
            className={ui.control}
            type="number"
            min={1}
            max={cols}
            value={currentGrid.col}
            onChange={(e) => {
              const col = clampInt(Number(e.target.value), 1, cols);
              const colSpan = clampInt(currentGrid.colSpan, 1, Math.max(1, cols - col + 1));
              setElementOverride(templateId, el.id, { grid: { ...currentGrid, col, colSpan } });
              onTemplateOverridesChange();
            }}
          />
        </Field>
        <Field label="跨越列数">
          <input
            className={ui.control}
            type="number"
            min={1}
            max={colSpanMax}
            value={currentGrid.colSpan}
            onChange={(e) => {
              const colSpan = clampInt(Number(e.target.value), 1, Math.max(1, cols - currentGrid.col + 1));
              setElementOverride(templateId, el.id, { grid: { ...currentGrid, colSpan } });
              onTemplateOverridesChange();
            }}
          />
        </Field>
        <Field label="起始行">
          <input
            className={ui.control}
            type="number"
            min={1}
            max={rows}
            value={currentGrid.row}
            onChange={(e) => {
              const row = clampInt(Number(e.target.value), 1, rows);
              const rowSpan = clampInt(currentGrid.rowSpan, 1, Math.max(1, rows - row + 1));
              setElementOverride(templateId, el.id, { grid: { ...currentGrid, row, rowSpan } });
              onTemplateOverridesChange();
            }}
          />
        </Field>
        <Field label="跨越行数">
          <input
            className={ui.control}
            type="number"
            min={1}
            max={rowSpanMax}
            value={currentGrid.rowSpan}
            onChange={(e) => {
              const rowSpan = clampInt(Number(e.target.value), 1, Math.max(1, rows - currentGrid.row + 1));
              setElementOverride(templateId, el.id, { grid: { ...currentGrid, rowSpan } });
              onTemplateOverridesChange();
            }}
          />
        </Field>
      </div>

      {/* Alignment */}
      {el.type === 'text' || el.type === 'maker_logo' || el.type === 'stack' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Field label="水平对齐">
            <select
              className={ui.control}
              value={currentAlign}
              onChange={(e) => {
                const next = e.target.value as 'left' | 'center' | 'right';
                setElementOverride(templateId, el.id, { align: next === defaultAlign ? undefined : next });
                onTemplateOverridesChange();
              }}
            >
              {Object.entries(ALIGN_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="垂直对齐">
            <select
              className={ui.control}
              value={currentVAlign}
              onChange={(e) => {
                const next = e.target.value as 'top' | 'middle' | 'bottom';
                setElementOverride(templateId, el.id, { vAlign: next === defaultVAlign ? undefined : next });
                onTemplateOverridesChange();
              }}
            >
              {Object.entries(VALIGN_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}
    </div>
  );
}

export function LayoutTab({ templateId, onTemplateOverridesChange }: Props) {
  const templateJson = getBuiltinTemplateJson(templateId);
  const isCustomedTemplate = templateId === 'customed';
  const override = loadTemplateOverride(templateId);
  const elementOverrides = override?.elements ?? {};

  const [query, setQuery] = useState('');

  const layoutElements = useMemo(() => {
    if (!templateJson) return [];
    if (isCustomedTemplate) return templateJson.elements;
    return templateJson.elements.filter(isLayoutMovable);
  }, [isCustomedTemplate, templateJson]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return layoutElements;
    return layoutElements.filter((el) => {
      const label = getElementLabel(el).toLowerCase();
      return label.includes(q) || el.id.toLowerCase().includes(q) || el.type.toLowerCase().includes(q);
    });
  }, [layoutElements, query]);

  const byZone = useMemo(() => {
    const map = new Map<string, ElementSpec[]>();
    for (const el of filtered) {
      const list = map.get(el.zone) ?? [];
      list.push(el);
      map.set(el.zone, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (!templateJson) return <div className={ui.hint}>找不到模板定义。</div>;

  const totalElements = layoutElements.length;
  const overriddenCount = Object.keys(elementOverrides).length;

  return (
    <>
      <div className={ui.section}>
        <div className={ui.sectionTitle}>布局自定义</div>
        <div className={ui.hint}>
          调整水印元素在模板栅格中的位置与对齐方式。
          共 {totalElements} 个可编辑元素{overriddenCount > 0 ? `，已修改 ${overriddenCount} 个` : ''}。
        </div>
        {isCustomedTemplate ? (
          <div style={{ marginTop: 8 }}>
            <Badge tone="brand">自定义模板</Badge>
          </div>
        ) : null}
      </div>

      <Accordion title={`元素编辑器（${filtered.length} 项）`} defaultOpen={false}>
        {layoutElements.length > 4 ? (
          <Field label="搜索" hint="按名称 / 类型过滤">
            <input className={ui.control} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入关键字…" />
          </Field>
        ) : null}

        {overriddenCount > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (!window.confirm('重置当前模板的所有自定义布局？')) return;
                saveTemplateOverride(templateId, null);
                onTemplateOverridesChange();
              }}
            >
              全部重置
            </Button>
          </div>
        ) : null}

        {byZone.length === 0 ? <div className={ui.hint}>没有匹配的元素。</div> : null}

        {byZone.map(([zone, elements]) => (
          <div key={zone}>
            {byZone.length > 1 ? (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                区域：{zone}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {elements.map((el) => (
                <ElementCard
                  key={el.id}
                  el={el}
                  templateId={templateId}
                  elementOverrides={elementOverrides}
                  templateJson={templateJson}
                  onTemplateOverridesChange={onTemplateOverridesChange}
                />
              ))}
            </div>
          </div>
        ))}
      </Accordion>
    </>
  );
}
