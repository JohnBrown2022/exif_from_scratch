import ui from '../../ui/ui.module.css';
import { Accordion } from '../../ui/Accordion';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import {
  buildWatermarkFields,
  getBuiltinTemplateJson,
  loadTemplateOverride,
  normalizeHexColor,
  saveTemplateOverride,
  setElementOverride,
  WATERMARK_TEMPLATES,
  type ElementSpec,
  type ExifData,
  type TemplateId,
} from '../../../core';

import { flattenElements, getElementLabel } from './templateUtils';

type Props = {
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  onTemplateOverridesChange: () => void;
  hasSelection: boolean;
  exif: ExifData | null;
  exifError: string | null;
  isReadingExif: boolean;
};

function canToggleVisible(el: ElementSpec, allowAll: boolean): boolean {
  if (allowAll) return true;
  if (el.type === 'text') return Boolean(el.editable?.visible);
  if (el.type === 'maker_logo') return Boolean(el.editable?.visible);
  return false;
}

export function TemplateTab({
  templateId,
  onTemplateChange,
  onTemplateOverridesChange,
  hasSelection,
  exif,
  exifError,
  isReadingExif,
}: Props) {
  const templateJson = getBuiltinTemplateJson(templateId);
  const isCustomedTemplate = templateId === 'customed';
  const override = loadTemplateOverride(templateId);
  const elementOverrides = override?.elements ?? {};

  const flatElements = templateJson ? flattenElements(templateJson.elements) : [];
  const toggleable = flatElements.filter(({ el }) => canToggleVisible(el, isCustomedTemplate));

  const editableLiteralTexts = flatElements
    .map(({ el, depth }) => ({ el, depth }))
    .filter(({ el }) => el.type === 'text' && el.bind.kind === 'literal' && (isCustomedTemplate || el.editable?.text));

  const makerLogoElements = flatElements
    .map(({ el }) => el)
    .filter((el): el is Extract<ElementSpec, { type: 'maker_logo' }> => el.type === 'maker_logo');

  const fields = exif ? buildWatermarkFields(exif) : null;

  return (
    <>
      <Field label="模板">
        <select className={ui.control} value={templateId} onChange={(e) => onTemplateChange(e.target.value as TemplateId)}>
          {WATERMARK_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </Field>

      {isCustomedTemplate ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>
            自定义模式 <Badge tone="brand">customed</Badge>
          </div>
          <div className={ui.hint}>该模板允许修改所有元素，可能导致遮挡；可随时重置。</div>
        </div>
      ) : null}

      <div className={ui.section}>
        <div className={ui.sectionTitle}>文案（Level 1）</div>
        <div className={ui.hint}>仅对模板中的固定文案（literal）生效；设置保存在本机浏览器。</div>
        {editableLiteralTexts.length === 0 ? <div className={ui.hint}>此模板没有可覆盖的固定文案。</div> : null}
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

      {makerLogoElements.length ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>品牌 Logo（Level 1）</div>
          {makerLogoElements.map((el) => {
            const ov = elementOverrides[el.id] ?? {};

            const defaultStyle = el.style.style ?? 'color';
            const currentStyle = (ov.logoStyle ?? defaultStyle) as 'color' | 'mono';

            const defaultMonoColor = normalizeHexColor(el.style.monoColor, '#FFFFFF');
            const currentMonoColor = normalizeHexColor(ov.monoColor, defaultMonoColor);

            const canToggle = canToggleVisible(el, isCustomedTemplate);
            const canStyle = isCustomedTemplate || Boolean(el.editable?.logoStyle);
            const canMonoColor = isCustomedTemplate || Boolean(el.editable?.monoColor);

            return (
              <div key={el.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {canToggle ? (
                  <label className={ui.field} style={{ gap: 8 }}>
                    <div className={ui.labelRow}>
                      <div className={ui.label}>{getElementLabel(el)}</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={ov.visible !== false}
                        onChange={(e) => {
                          setElementOverride(templateId, el.id, { visible: e.target.checked ? undefined : false });
                          onTemplateOverridesChange();
                        }}
                      />
                      <span>显示</span>
                    </label>
                  </label>
                ) : null}

                {canStyle ? (
                  <Field label="风格">
                    <select
                      className={ui.control}
                      value={currentStyle}
                      onChange={(e) => {
                        const next = e.target.value as 'color' | 'mono';
                        setElementOverride(templateId, el.id, { logoStyle: next === defaultStyle ? undefined : next });
                        onTemplateOverridesChange();
                      }}
                    >
                      <option value="color">彩色</option>
                      <option value="mono">单色</option>
                    </select>
                  </Field>
                ) : null}

                {currentStyle === 'mono' && canMonoColor ? (
                  <Field label="单色颜色">
                    <input
                      className={ui.colorInput}
                      type="color"
                      value={currentMonoColor}
                      onChange={(e) => {
                        const next = normalizeHexColor(e.target.value, '#FFFFFF');
                        setElementOverride(templateId, el.id, {
                          monoColor: next === defaultMonoColor ? undefined : next,
                        });
                        onTemplateOverridesChange();
                      }}
                    />
                  </Field>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {toggleable.length ? (
        <Accordion title="高级：元素开关（显示/隐藏）" defaultOpen={false}>
          <div className={ui.hint}>用于关闭某些行/Logo/装饰元素。自定义模板支持更多元素开关。</div>

          {toggleable.map(({ el, depth }) => {
            const ov = elementOverrides[el.id] ?? {};
            const prefix = depth > 0 ? '↳ '.repeat(depth) : '';
            const label = `${prefix}${getElementLabel(el)} · ${el.type}`;

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

          <div className={ui.buttonRow}>
            <Button
              type="button"
              onClick={() => {
                if (!window.confirm('重置当前模板的所有本地设置？')) return;
                saveTemplateOverride(templateId, null);
                onTemplateOverridesChange();
              }}
            >
              重置当前模板设置
            </Button>
          </div>
        </Accordion>
      ) : (
        <div className={ui.hint}>此模板没有可开关的元素。</div>
      )}

      {hasSelection ? (
        <Accordion title="查看本次 EXIF 信息" defaultOpen={false}>
          {isReadingExif ? <div className={ui.hint}>读取 EXIF…</div> : null}
          {exifError ? <div className={ui.error}>EXIF 读取失败：{exifError}</div> : null}
          {fields?.camera ? <div style={{ fontSize: 12 }}>{fields.camera}</div> : null}
          {fields?.lens ? <div style={{ fontSize: 12 }}>{fields.lens}</div> : null}
          {fields?.settings ? <div style={{ fontSize: 12 }}>{fields.settings}</div> : null}
          {fields?.date ? <div style={{ fontSize: 12 }}>{fields.date}</div> : null}
          {!fields?.camera && !fields?.lens && !fields?.settings && !fields?.date && !isReadingExif ? (
            <div style={{ fontSize: 12 }}>无可用 EXIF 字段（仍可导出）</div>
          ) : null}
        </Accordion>
      ) : null}
    </>
  );
}

