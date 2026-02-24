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

  return (
    <>
      <div className={ui.section}>
        <div className={ui.sectionTitle}>布局（Level 2）</div>
        <div className={ui.hint}>基于 12 列栅格编辑位置（col/row/跨度）与对齐方式。</div>
        {isCustomedTemplate ? (
          <div style={{ marginTop: 8 }}>
            <Badge tone="brand">customed</Badge> <span className={ui.muted}>支持更多元素类型</span>
          </div>
        ) : null}
      </div>

      <Accordion title="进入布局编辑（高级）" defaultOpen={false}>
        <Field label="搜索元素" hint="按 label / id / type 过滤">
          <input className={ui.control} value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>

        <div className={ui.buttonRow}>
          <Button
            type="button"
            onClick={() => {
              if (!window.confirm('重置当前模板的所有本地设置？')) return;
              // Reset all overrides for this template
              saveTemplateOverride(templateId, null);
              onTemplateOverridesChange();
            }}
          >
            重置当前模板设置
          </Button>
        </div>

        {byZone.length === 0 ? <div className={ui.hint}>没有匹配的元素。</div> : null}

        {byZone.map(([zone, elements]) => (
          <div key={zone} className={ui.section}>
            <div className={ui.sectionTitle}>Zone: {zone}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {elements.map((el) => {
                const ov = elementOverrides[el.id] ?? {};
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

                const label = `${getElementLabel(el)} · ${el.type}`;

                const colMax = cols;
                const rowMax = rows;
                const colSpanMax = Math.max(1, cols - currentGrid.col + 1);
                const rowSpanMax = Math.max(1, rows - currentGrid.row + 1);

                return (
                  <div key={el.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12 }}>{label}</div>
                      <span className={ui.muted}>({el.id})</span>
                    </div>

                    <div className={ui.grid2}>
                      <Field label="col">
                        <input
                          className={ui.control}
                          type="number"
                          min={1}
                          max={colMax}
                          value={currentGrid.col}
                          onChange={(e) => {
                            const col = clampInt(Number(e.target.value), 1, cols);
                            const colSpan = clampInt(currentGrid.colSpan, 1, Math.max(1, cols - col + 1));
                            setElementOverride(templateId, el.id, { grid: { ...currentGrid, col, colSpan } });
                            onTemplateOverridesChange();
                          }}
                        />
                      </Field>
                      <Field label="colSpan">
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
                      <Field label="row">
                        <input
                          className={ui.control}
                          type="number"
                          min={1}
                          max={rowMax}
                          value={currentGrid.row}
                          onChange={(e) => {
                            const row = clampInt(Number(e.target.value), 1, rows);
                            const rowSpan = clampInt(currentGrid.rowSpan, 1, Math.max(1, rows - row + 1));
                            setElementOverride(templateId, el.id, { grid: { ...currentGrid, row, rowSpan } });
                            onTemplateOverridesChange();
                          }}
                        />
                      </Field>
                      <Field label="rowSpan">
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

                    {el.type === 'text' || el.type === 'maker_logo' || el.type === 'stack' ? (
                      <div className={ui.grid2}>
                        <Field label="align">
                          <select
                            className={ui.control}
                            value={currentAlign}
                            onChange={(e) => {
                              const next = e.target.value as 'left' | 'center' | 'right';
                              setElementOverride(templateId, el.id, { align: next === defaultAlign ? undefined : next });
                              onTemplateOverridesChange();
                            }}
                          >
                            <option value="left">left</option>
                            <option value="center">center</option>
                            <option value="right">right</option>
                          </select>
                        </Field>
                        <Field label="vAlign">
                          <select
                            className={ui.control}
                            value={currentVAlign}
                            onChange={(e) => {
                              const next = e.target.value as 'top' | 'middle' | 'bottom';
                              setElementOverride(templateId, el.id, { vAlign: next === defaultVAlign ? undefined : next });
                              onTemplateOverridesChange();
                            }}
                          >
                            <option value="top">top</option>
                            <option value="middle">middle</option>
                            <option value="bottom">bottom</option>
                          </select>
                        </Field>
                      </div>
                    ) : null}

                    <div className={ui.buttonRow}>
                      <Button
                        type="button"
                        onClick={() => {
                          clearElementOverride(templateId, el.id);
                          onTemplateOverridesChange();
                        }}
                      >
                        重置该元素
                      </Button>
                      <span className={ui.muted}>grid: {cols}×{rows}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Accordion>
    </>
  );
}
