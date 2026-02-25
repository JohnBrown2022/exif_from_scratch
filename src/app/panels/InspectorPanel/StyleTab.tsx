import { useMemo, useState } from 'react';

import ui from '../../ui/ui.module.css';
import { Accordion } from '../../ui/Accordion';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import {
    buildWatermarkFields,
    clearElementOverride,
    getBuiltinTemplateJson,
    isNativeV2TemplateId,
    loadTemplateOverride,
    saveTemplateOverride,
    setElementOverride,
    type ElementSpec,
    type ExifData,
    type ExportFormat,
    type ExifFieldKind,
    type GridOverride,
    type JpegBackgroundMode,
    type TemplateId,
    type TopologyWatermarkSettings,
} from '../../../core';

import { clampInt, flattenElements, getElementLabel } from './templateUtils';

// ─── Helpers ───────────────────────────────────────────────

function canToggleVisible(el: ElementSpec, allowAll: boolean): boolean {
    if (allowAll) return true;
    if (el.type === 'text') return Boolean(el.editable?.visible);
    if (el.type === 'maker_logo') return Boolean(el.editable?.visible);
    return false;
}

function isLayoutMovable(el: ElementSpec): boolean {
    return el.type === 'text' || el.type === 'maker_logo' || el.type === 'stack';
}

function templateHasBackground(templateId: TemplateId): boolean {
    const json = getBuiltinTemplateJson(templateId);
    if (!json) return false;
    return json.layout.kind === 'photo_plus_footer';
}

const ALIGN_LABELS: Record<string, string> = { left: '左对齐', center: '居中', right: '右对齐' };
const VALIGN_LABELS: Record<string, string> = { top: '顶部', middle: '居中', bottom: '底部' };

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

type TextBinding = Extract<ElementSpec, { type: 'text' }>['bind'];

function listExifFieldKinds(bind: TextBinding): ExifFieldKind[] {
    if (bind.kind === 'concat') return (bind.parts ?? []).flatMap(listExifFieldKinds);
    if (bind.kind === 'literal') return [];
    return [bind.kind as ExifFieldKind];
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

// ─── Types ─────────────────────────────────────────────────

type Props = {
    templateId: TemplateId;
    onTemplateOverridesChange: () => void;
    hasSelection: boolean;
    exif: ExifData | null;
    exifError: string | null;
    isReadingExif: boolean;
    exportFormat: ExportFormat;
    jpegBackground: string;
    onJpegBackgroundChange: (color: string) => void;
    jpegBackgroundMode: JpegBackgroundMode;
    onJpegBackgroundModeChange: (mode: JpegBackgroundMode) => void;
    blurRadius: number;
    onBlurRadiusChange: (radius: number) => void;

    topologyWatermarkSettings: TopologyWatermarkSettings;
    onTopologyWatermarkSettingsChange: (patch: Partial<TopologyWatermarkSettings>) => void;
    topologyMd5: string | null;
    topologyMd5Error: string | null;
    isComputingTopologyMd5: boolean;
};

// ─── Sub-components ────────────────────────────────────────

function ExifCard({ exif, exifError, isReadingExif }: { exif: ExifData | null; exifError: string | null; isReadingExif: boolean }) {
    const fields = exif ? buildWatermarkFields(exif) : null;

    if (isReadingExif) return <div className={ui.hint}>读取 EXIF…</div>;
    if (exifError) return <div className={ui.error}>EXIF 读取失败：{exifError}</div>;
    if (!fields?.camera && !fields?.lens && !fields?.settings && !fields?.date) {
        return <div className={ui.hint}>无可用 EXIF 字段（仍可导出）</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
            {fields.camera ? <div style={{ fontWeight: 600 }}>{fields.camera}</div> : null}
            {fields.lens ? <div className={ui.muted}>{fields.lens}</div> : null}
            {fields.settings ? <div className={ui.muted}>{fields.settings}</div> : null}
            {fields.date ? <div className={ui.muted}>{fields.date}</div> : null}
        </div>
    );
}

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
        el.type === 'text' ? el.style.align ?? 'left' : el.type === 'maker_logo' ? el.style.align ?? 'left' : el.type === 'stack' ? el.align ?? 'left' : 'left';
    const defaultVAlign =
        el.type === 'text' ? el.style.vAlign ?? 'top' : el.type === 'maker_logo' ? el.style.vAlign ?? 'top' : el.type === 'stack' ? el.vAlign ?? 'top' : 'top';

    const currentAlign = (ov.align ?? defaultAlign) as 'left' | 'center' | 'right';
    const currentVAlign = (ov.vAlign ?? defaultVAlign) as 'top' | 'middle' | 'bottom';

    const colSpanMax = Math.max(1, cols - currentGrid.col + 1);
    const rowSpanMax = Math.max(1, rows - currentGrid.row + 1);

    const hasOverride = ov.grid || ov.align || ov.vAlign;
    const label = getElementLabel(el);
    const typeLabel = el.type === 'text' ? '文本' : el.type === 'maker_logo' ? 'Logo' : el.type === 'stack' ? '堆叠组' : el.type;

    return (
        <div style={{ paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
                    <span className={ui.muted} style={{ fontSize: 11, marginLeft: 6 }}>{typeLabel}</span>
                </div>
                {hasOverride ? (
                    <button
                        type="button"
                        style={{ fontSize: 11, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px 4px' }}
                        title="重置该元素"
                        onClick={() => { clearElementOverride(templateId, el.id); onTemplateOverridesChange(); }}
                    >
                        ↺ 重置
                    </button>
                ) : null}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <Field label="起始列">
                    <input className={ui.control} type="number" min={1} max={cols} value={currentGrid.col}
                        onChange={(e) => {
                            const col = clampInt(Number(e.target.value), 1, cols);
                            const colSpan = clampInt(currentGrid.colSpan, 1, Math.max(1, cols - col + 1));
                            setElementOverride(templateId, el.id, { grid: { ...currentGrid, col, colSpan } });
                            onTemplateOverridesChange();
                        }} />
                </Field>
                <Field label="跨越列数">
                    <input className={ui.control} type="number" min={1} max={colSpanMax} value={currentGrid.colSpan}
                        onChange={(e) => {
                            const colSpan = clampInt(Number(e.target.value), 1, Math.max(1, cols - currentGrid.col + 1));
                            setElementOverride(templateId, el.id, { grid: { ...currentGrid, colSpan } });
                            onTemplateOverridesChange();
                        }} />
                </Field>
                <Field label="起始行">
                    <input className={ui.control} type="number" min={1} max={rows} value={currentGrid.row}
                        onChange={(e) => {
                            const row = clampInt(Number(e.target.value), 1, rows);
                            const rowSpan = clampInt(currentGrid.rowSpan, 1, Math.max(1, rows - row + 1));
                            setElementOverride(templateId, el.id, { grid: { ...currentGrid, row, rowSpan } });
                            onTemplateOverridesChange();
                        }} />
                </Field>
                <Field label="跨越行数">
                    <input className={ui.control} type="number" min={1} max={rowSpanMax} value={currentGrid.rowSpan}
                        onChange={(e) => {
                            const rowSpan = clampInt(Number(e.target.value), 1, Math.max(1, rows - currentGrid.row + 1));
                            setElementOverride(templateId, el.id, { grid: { ...currentGrid, rowSpan } });
                            onTemplateOverridesChange();
                        }} />
                </Field>
            </div>

            {el.type === 'text' || el.type === 'maker_logo' || el.type === 'stack' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Field label="水平对齐">
                        <select className={ui.control} value={currentAlign}
                            onChange={(e) => {
                                const next = e.target.value as 'left' | 'center' | 'right';
                                setElementOverride(templateId, el.id, { align: next === defaultAlign ? undefined : next });
                                onTemplateOverridesChange();
                            }}>
                            {Object.entries(ALIGN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Field>
                    <Field label="垂直对齐">
                        <select className={ui.control} value={currentVAlign}
                            onChange={(e) => {
                                const next = e.target.value as 'top' | 'middle' | 'bottom';
                                setElementOverride(templateId, el.id, { vAlign: next === defaultVAlign ? undefined : next });
                                onTemplateOverridesChange();
                            }}>
                            {Object.entries(VALIGN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Field>
                </div>
            ) : null}
        </div>
    );
}

// ─── Main ──────────────────────────────────────────────────

export function StyleTab({
    templateId,
    onTemplateOverridesChange,
    hasSelection,
    exif,
    exifError,
    isReadingExif,
    exportFormat,
    jpegBackground,
    onJpegBackgroundChange,
    jpegBackgroundMode,
    onJpegBackgroundModeChange,
    blurRadius,
    onBlurRadiusChange,
    topologyWatermarkSettings,
    onTopologyWatermarkSettingsChange,
    topologyMd5,
    topologyMd5Error,
    isComputingTopologyMd5,
}: Props) {
    const templateJson = getBuiltinTemplateJson(templateId);
    const isCustomedTemplate = templateId === 'customed';
    const override = loadTemplateOverride(templateId);
    const elementOverrides = override?.elements ?? {};

    const flatElements = useMemo(() => (templateJson ? flattenElements(templateJson.elements) : []), [templateJson]);
    const toggleable = flatElements.filter(({ el }) => canToggleVisible(el, isCustomedTemplate));

    const editableLiteralTexts = flatElements
        .filter(({ el }) => el.type === 'text' && el.bind.kind === 'literal' && (isCustomedTemplate || el.editable?.text));

    const [query, setQuery] = useState('');
    const isNativeV2Template = isNativeV2TemplateId(templateId);

    const layoutElements = useMemo(() => {
        if (!templateJson) return [];
        return isCustomedTemplate ? templateJson.elements : templateJson.elements.filter(isLayoutMovable);
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

    const overriddenCount = Object.keys(elementOverrides).length;
    const hasBgArea = templateHasBackground(templateId);
    const showBgControls = exportFormat === 'jpeg' && hasBgArea;

    const concatFieldControls = useMemo(() => {
        return flatElements
            .map(({ el }) => el)
            .filter(
                (el): el is Extract<ElementSpec, { type: 'text' }> =>
                    el.type === 'text' && el.bind.kind === 'concat' && canToggleVisible(el, isCustomedTemplate),
            )
            .map((el) => ({
                el,
                fields: uniqueStable(listExifFieldKinds(el.bind)).filter((kind) => Boolean(EXIF_FIELD_LABELS[kind])),
            }))
            .filter((item) => item.fields.length >= 2);
    }, [flatElements, isCustomedTemplate]);

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
            <div className={ui.hint}>模板切换与图层编辑已合并到「图层」Tab。</div>

            {isCustomedTemplate ? (
                <div style={{ marginTop: 4 }}>
                    <Badge tone="brand">自定义模式</Badge>
                    <div className={ui.hint}>该模板允许修改所有元素，可随时重置。</div>
                </div>
            ) : null}

            {/* ─── EXIF 信息 ─── */}
            {hasSelection ? (
                <div className={ui.section}>
                    <div className={ui.sectionTitle}>EXIF 信息</div>
                    <ExifCard exif={exif} exifError={exifError} isReadingExif={isReadingExif} />
                </div>
            ) : null}

            {/* ─── 背景（仅 JPEG + 有留白的模板） ─── */}
            {showBgControls ? (
                <div className={ui.section}>
                    <div className={ui.sectionTitle}>背景</div>
                    <Field label="模式">
                        <select className={ui.control} value={jpegBackgroundMode} onChange={(e) => onJpegBackgroundModeChange(e.target.value as JpegBackgroundMode)}>
                            <option value="color">纯色</option>
                            <option value="blur">照片边缘模糊</option>
                        </select>
                    </Field>
                    {jpegBackgroundMode === 'color' ? (
                        <Field label="背景色">
                            <input className={ui.colorInput} type="color" value={jpegBackground} onChange={(e) => onJpegBackgroundChange(e.target.value)} />
                        </Field>
                    ) : (
                        <Field label={`模糊强度（${blurRadius}）`}>
                            <input className={ui.range} type="range" min={5} max={80} step={1} value={blurRadius} onChange={(e) => onBlurRadiusChange(Number(e.target.value))} />
                        </Field>
                    )}
                </div>
            ) : null}

            {/* ─── 拓扑水印 ─── */}
            <div className={ui.section}>
                <div className={ui.sectionTitle}>拓扑水印</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <input
                        type="checkbox"
                        checked={topologyWatermarkSettings.enabled}
                        onChange={(e) => onTopologyWatermarkSettingsChange({ enabled: e.target.checked })}
                    />
                    <span>启用</span>
                </label>
                <div className={ui.hint}>仅作用于照片区域，位于模板元素下方。</div>

                <Field label="种子模式">
                    <select
                        className={ui.control}
                        value={topologyWatermarkSettings.seedMode}
                        disabled={!topologyWatermarkSettings.enabled}
                        onChange={(e) => onTopologyWatermarkSettingsChange({ seedMode: e.target.value as TopologyWatermarkSettings['seedMode'] })}
                    >
                        <option value="file_md5">使用图片 MD5</option>
                        <option value="manual">自定义</option>
                    </select>
                </Field>

                {topologyWatermarkSettings.seedMode === 'manual' ? (
                    <Field label="自定义 Seed" hint="任意字符串；留空则回退到图片 ID">
                        <input
                            className={ui.control}
                            value={topologyWatermarkSettings.manualSeed}
                            disabled={!topologyWatermarkSettings.enabled}
                            onChange={(e) => onTopologyWatermarkSettingsChange({ manualSeed: e.target.value })}
                            placeholder="例如：a3f9b2c1d4e5…"
                        />
                    </Field>
                ) : topologyIdHint ? (
                    <div className={ui.hint}>{topologyIdHint}</div>
                ) : null}

                <Field label="位置">
                    <select
                        className={ui.control}
                        value={topologyWatermarkSettings.positionMode}
                        disabled={!topologyWatermarkSettings.enabled}
                        onChange={(e) =>
                            onTopologyWatermarkSettingsChange({ positionMode: e.target.value as TopologyWatermarkSettings['positionMode'] })
                        }
                    >
                        <option value="auto">自动（避让模板）</option>
                        <option value="manual">手动</option>
                    </select>
                </Field>

                <Field label={`大小（${Math.round(topologyWatermarkSettings.size * 100)}%）`} hint="相对照片短边">
                    <input
                        className={ui.range}
                        type="range"
                        min={0.08}
                        max={0.5}
                        step={0.01}
                        value={topologyWatermarkSettings.size}
                        disabled={!topologyWatermarkSettings.enabled}
                        onChange={(e) => onTopologyWatermarkSettingsChange({ size: Number(e.target.value) })}
                    />
                </Field>

                {topologyWatermarkSettings.positionMode === 'manual' ? (
                    <>
                        <Field label={`X（${Math.round(topologyWatermarkSettings.x * 100)}%）`}>
                            <input
                                className={ui.range}
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={topologyWatermarkSettings.x}
                                disabled={!topologyWatermarkSettings.enabled}
                                onChange={(e) => onTopologyWatermarkSettingsChange({ x: Number(e.target.value) })}
                            />
                        </Field>
                        <Field label={`Y（${Math.round(topologyWatermarkSettings.y * 100)}%）`}>
                            <input
                                className={ui.range}
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={topologyWatermarkSettings.y}
                                disabled={!topologyWatermarkSettings.enabled}
                                onChange={(e) => onTopologyWatermarkSettingsChange({ y: Number(e.target.value) })}
                            />
                        </Field>
                    </>
                ) : null}

                <Accordion title="高级参数" defaultOpen={false}>
                    <Field label={`排线密度（${topologyWatermarkSettings.density}）`}>
                        <input
                            className={ui.range}
                            type="range"
                            min={4}
                            max={24}
                            step={1}
                            value={topologyWatermarkSettings.density}
                            disabled={!topologyWatermarkSettings.enabled}
                            onChange={(e) => onTopologyWatermarkSettingsChange({ density: Number(e.target.value) })}
                        />
                    </Field>
                    <Field label={`岩层扭曲（${topologyWatermarkSettings.noise.toFixed(1)}）`}>
                        <input
                            className={ui.range}
                            type="range"
                            min={0}
                            max={3}
                            step={0.1}
                            value={topologyWatermarkSettings.noise}
                            disabled={!topologyWatermarkSettings.enabled}
                            onChange={(e) => onTopologyWatermarkSettingsChange({ noise: Number(e.target.value) })}
                        />
                    </Field>
                    <Field label={`透明度（${topologyWatermarkSettings.alpha.toFixed(2)}）`}>
                        <input
                            className={ui.range}
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={topologyWatermarkSettings.alpha}
                            disabled={!topologyWatermarkSettings.enabled}
                            onChange={(e) => onTopologyWatermarkSettingsChange({ alpha: Number(e.target.value) })}
                        />
                    </Field>
                </Accordion>
            </div>

            {isNativeV2Template ? (
                <div className={ui.hint} style={{ marginTop: 8 }}>
                    该模板已迁移到 V2 图层系统：可在「图层」Tab 中查看图层；下面的“文案/组合字段/元素开关/布局微调”属于旧引擎配置，暂不适用。
                </div>
            ) : null}

            {/* ─── 文案覆盖（Legacy） ─── */}
            {!isNativeV2Template && editableLiteralTexts.length > 0 ? (
                <div className={ui.section}>
                    <div className={ui.sectionTitle}>文案</div>
                    <div className={ui.hint}>覆盖模板中的固定文字，保存在本机浏览器。</div>
                    {editableLiteralTexts.map(({ el, depth }) => {
                        if (el.type !== 'text' || el.bind.kind !== 'literal') return null;
                        const ov = elementOverrides[el.id] ?? {};
                        const prefix = depth > 0 ? '↳ '.repeat(depth) : '';
                        const label = `${prefix}${getElementLabel(el)}`;
                        const defaultText = el.bind.value;
                        const currentText = typeof ov.text === 'string' ? ov.text : defaultText;

                        return (
                            <Field key={el.id} label={label}>
                                <input
                                    className={ui.control}
                                    type="text"
                                    value={currentText}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        setElementOverride(templateId, el.id, { text: next === defaultText ? undefined : next });
                                        onTemplateOverridesChange();
                                    }}
                                />
                            </Field>
                        );
                    })}
                </div>
            ) : null}

            {/* ─── 组合字段（拆分控制 / Legacy） ─── */}
            {!isNativeV2Template && concatFieldControls.length > 0 ? (
                <Accordion title={`组合字段（可分别控制）`} defaultOpen={false}>
                    <div className={ui.hint}>适用于“镜头/参数/日期”等组合行；隐藏某一项时仍保持原来的对齐与样式。</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {concatFieldControls.map(({ el, fields }) => {
                            const hidden = new Set(elementOverrides[el.id]?.hiddenFields ?? []);
                            return (
                                <div key={el.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>{getElementLabel(el)}</span>
                                        <span className={ui.muted} style={{ fontSize: 11 }}>
                                            ({el.id})
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                        {fields.map((kind) => {
                                            const label = EXIF_FIELD_LABELS[kind] ?? kind;
                                            const checked = !hidden.has(kind);
                                            return (
                                                <label key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            const nextHidden = new Set(hidden);
                                                            if (e.target.checked) nextHidden.delete(kind);
                                                            else nextHidden.add(kind);
                                                            const asArray = Array.from(nextHidden);
                                                            setElementOverride(templateId, el.id, { hiddenFields: asArray.length ? asArray : undefined });
                                                            onTemplateOverridesChange();
                                                        }}
                                                    />
                                                    <span>{label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Accordion>
            ) : null}

            {/* ─── 元素开关（Legacy） ─── */}
            {!isNativeV2Template && toggleable.length > 0 ? (
                <Accordion title={`元素开关（${toggleable.length}）`} defaultOpen={false}>
                    <div className={ui.hint}>显示/隐藏水印元素。</div>
                    {toggleable.map(({ el, depth }) => {
                        const ov = elementOverrides[el.id] ?? {};
                        const prefix = depth > 0 ? '↳ '.repeat(depth) : '';
                        const label = `${prefix}${getElementLabel(el)}`;
                        const isVisible = ov.visible !== false;
                        const isLogo = el.type === 'maker_logo';
                        const canEditLogoStyle = isLogo && el.editable?.logoStyle;
                        const canEditMonoColor = isLogo && el.editable?.monoColor;
                        const currentLogoStyle = (ov.logoStyle ?? (isLogo ? el.style.style : undefined)) ?? 'color';
                        const currentMonoColor = ov.monoColor ?? (isLogo ? el.style.monoColor : undefined) ?? '#FFFFFF';

                        return (
                            <div key={el.id}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                                    <input
                                        type="checkbox"
                                        checked={isVisible}
                                        onChange={(e) => {
                                            setElementOverride(templateId, el.id, { visible: e.target.checked ? undefined : false });
                                            onTemplateOverridesChange();
                                        }}
                                    />
                                    <span>{label}</span>
                                </label>

                                {isLogo && isVisible && (canEditLogoStyle || canEditMonoColor) ? (
                                    <div style={{ display: 'flex', gap: 8, marginLeft: 28, marginTop: 4, marginBottom: 4 }}>
                                        {canEditLogoStyle ? (
                                            <Field label="风格">
                                                <select className={ui.control} value={currentLogoStyle}
                                                    onChange={(e) => {
                                                        const next = e.target.value as 'color' | 'mono';
                                                        setElementOverride(templateId, el.id, { logoStyle: next });
                                                        onTemplateOverridesChange();
                                                    }}>
                                                    <option value="color">彩色</option>
                                                    <option value="mono">单色</option>
                                                </select>
                                            </Field>
                                        ) : null}
                                        {canEditMonoColor && currentLogoStyle === 'mono' ? (
                                            <Field label="单色颜色">
                                                <input className={ui.control} type="color" value={currentMonoColor}
                                                    onChange={(e) => {
                                                        setElementOverride(templateId, el.id, { monoColor: e.target.value });
                                                        onTemplateOverridesChange();
                                                    }} />
                                            </Field>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </Accordion>
            ) : null}

            {/* ─── 布局微调（Legacy） ─── */}
            {!isNativeV2Template && templateJson && layoutElements.length > 0 ? (
                <Accordion title={`布局微调（${layoutElements.length}）`} defaultOpen={false}>
                    <div className={ui.hint}>
                        调整元素在栅格中的位置与对齐。
                        {overriddenCount > 0 ? ` 已修改 ${overriddenCount} 个` : ''}
                    </div>

                    {layoutElements.length > 4 ? (
                        <Field label="搜索" hint="按名称 / 类型过滤">
                            <input className={ui.control} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入关键字…" />
                        </Field>
                    ) : null}

                    {overriddenCount > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={() => {
                                    if (!window.confirm('重置当前模板的所有自定义设置？')) return;
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
            ) : null}
        </>
    );
}
