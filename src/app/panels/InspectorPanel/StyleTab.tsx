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
    loadTemplateOverride,
    saveTemplateOverride,
    setElementOverride,
    WATERMARK_TEMPLATES,
    type ElementSpec,
    type ExifData,
    type ExportFormat,
    type ExifFieldKind,
    type GridOverride,
    type JpegBackgroundMode,
    type TemplateId,
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
    onTemplateChange: (id: TemplateId) => void;
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
    onTemplateChange,
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

    const currentTemplate = WATERMARK_TEMPLATES.find((t) => t.id === templateId);

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

    return (
        <>
            {/* ─── 模板选择 ─── */}
            <Field label="模板">
                <select className={ui.control} value={templateId} onChange={(e) => onTemplateChange(e.target.value as TemplateId)}>
                    {WATERMARK_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </Field>
            {currentTemplate?.description ? (
                <div className={ui.hint}>{currentTemplate.description}</div>
            ) : null}

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

            {/* ─── 文案覆盖 ─── */}
            {editableLiteralTexts.length > 0 ? (
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

            {/* ─── 组合字段（拆分控制） ─── */}
            {concatFieldControls.length > 0 ? (
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

            {/* ─── 元素开关（折叠） ─── */}
            {toggleable.length > 0 ? (
                <Accordion title={`元素开关（${toggleable.length}）`} defaultOpen={false}>
                    <div className={ui.hint}>显示/隐藏水印元素。</div>
                    {toggleable.map(({ el, depth }) => {
                        const ov = elementOverrides[el.id] ?? {};
                        const prefix = depth > 0 ? '↳ '.repeat(depth) : '';
                        const label = `${prefix}${getElementLabel(el)}`;

                        return (
                            <label key={el.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                                <input
                                    type="checkbox"
                                    checked={ov.visible !== false}
                                    onChange={(e) => {
                                        setElementOverride(templateId, el.id, { visible: e.target.checked ? undefined : false });
                                        onTemplateOverridesChange();
                                    }}
                                />
                                <span>{label}</span>
                            </label>
                        );
                    })}
                </Accordion>
            ) : null}

            {/* ─── 布局微调（折叠） ─── */}
            {templateJson && layoutElements.length > 0 ? (
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
