import ui from './Panels.module.css';
import {
  buildWatermarkFields,
  getBuiltinTemplateJson,
  loadTemplateOverride,
  normalizeHexColor,
  saveTemplateOverride,
  setElementOverride,
  WATERMARK_TEMPLATES,
  type BatchUpdate,
  type ElementSpec,
  type ExifData,
  type MakerLogoElement,
  type TemplateId,
  type TextElement,
} from '../../core';

export type ExportFormat = 'png' | 'jpeg';

type EditableItem =
  | { type: 'text'; el: TextElement }
  | { type: 'maker_logo'; el: MakerLogoElement };

function collectEditableItems(elements: ElementSpec[]): EditableItem[] {
  const items: EditableItem[] = [];

  const walk = (els: ElementSpec[]) => {
    for (const el of els) {
      if (el.type === 'stack') {
        walk(el.children);
        continue;
      }

      if (el.type === 'text' && (el.editable?.visible || el.editable?.text)) {
        items.push({ type: 'text', el });
        continue;
      }

      if (
        el.type === 'maker_logo' &&
        (el.editable?.visible || el.editable?.logoStyle || el.editable?.monoColor)
      ) {
        items.push({ type: 'maker_logo', el });
      }
    }
  };

  walk(elements);
  return items;
}

type Props = {
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  onTemplateOverridesChange: () => void;
  exportFormat: ExportFormat;
  onExportFormatChange: (format: ExportFormat) => void;
  jpegQuality: number;
  onJpegQualityChange: (quality: number) => void;
  maxEdge: number | 'original';
  onMaxEdgeChange: (maxEdge: number | 'original') => void;
  jpegBackground: string;
  onJpegBackgroundChange: (color: string) => void;
  hasSelection: boolean;
  imagesCount: number;
  isExporting: boolean;
  exportStatus: string | null;
  onExportSelected: () => void;
  onExportAll: () => void;
  batchState: BatchUpdate | null;
  onCancelBatch: () => void;
  onRetryFailed: () => void;
  exif: ExifData | null;
  exifError: string | null;
  isReadingExif: boolean;
};

export default function ControlsPanel({
  templateId,
  onTemplateChange,
  onTemplateOverridesChange,
  exportFormat,
  onExportFormatChange,
  jpegQuality,
  onJpegQualityChange,
  maxEdge,
  onMaxEdgeChange,
  jpegBackground,
  onJpegBackgroundChange,
  hasSelection,
  imagesCount,
  isExporting,
  exportStatus,
  onExportSelected,
  onExportAll,
  batchState,
  onCancelBatch,
  onRetryFailed,
  exif,
  exifError,
  isReadingExif,
}: Props) {
  const fields = exif ? buildWatermarkFields(exif) : null;
  const failedCount = batchState
    ? batchState.jobs.filter((job) => job.status === 'error').length
    : 0;

  const templateJson = getBuiltinTemplateJson(templateId);
  const override = loadTemplateOverride(templateId);
  const editableItems = templateJson ? collectEditableItems(templateJson.elements) : [];
  const elementOverrides = override?.elements ?? {};

  return (
    <div className={ui.panelRoot}>
      <div className={ui.panelHeader}>
        <div>
          <div className={ui.panelTitle}>导出</div>
          <div className={ui.panelSubtitle}>导出图片默认不包含 EXIF 元数据</div>
        </div>
      </div>

      <div className={ui.form}>
        <label className={ui.field}>
          <div className={ui.label}>模板</div>
          <select
            className={ui.select}
            value={templateId}
            onChange={(e) => onTemplateChange(e.target.value as TemplateId)}
          >
            {WATERMARK_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        {templateJson && editableItems.length ? (
          <div className={ui.exifBox}>
            <div className={ui.exifTitle}>模板编辑（Level 1）</div>
            <div className={ui.hint}>这些设置保存在浏览器本地（localStorage）。</div>

            {editableItems.map((item) => {
              if (item.type === 'text') {
                const el = item.el;
                const ov = elementOverrides[el.id] ?? {};
                const canToggle = Boolean(el.editable?.visible);
                const canEditText = Boolean(el.editable?.text && el.bind.kind === 'literal');
                const defaultText = el.bind.kind === 'literal' ? el.bind.value : '';
                const currentText = typeof ov.text === 'string' ? ov.text : defaultText;

                return (
                  <div key={el.id} className={ui.field}>
                    <div className={ui.label}>{el.label ?? el.id}</div>
                    {canToggle ? (
                      <label className={ui.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={ov.visible !== false}
                          onChange={(e) => {
                            setElementOverride(templateId, el.id, {
                              visible: e.target.checked ? undefined : false,
                            });
                            onTemplateOverridesChange();
                          }}
                        />
                        <span>显示</span>
                      </label>
                    ) : null}

                    {canEditText ? (
                      <input
                        className={ui.select}
                        type="text"
                        value={currentText}
                        onChange={(e) => {
                          const next = e.target.value;
                          setElementOverride(templateId, el.id, {
                            text: next === defaultText ? undefined : next,
                          });
                          onTemplateOverridesChange();
                        }}
                      />
                    ) : null}
                  </div>
                );
              }

              const el = item.el;
              const ov = elementOverrides[el.id] ?? {};
              const canToggle = Boolean(el.editable?.visible);
              const canStyle = Boolean(el.editable?.logoStyle);
              const canMonoColor = Boolean(el.editable?.monoColor);

              const defaultStyle = el.style.style ?? 'color';
              const currentStyle = (ov.logoStyle ?? defaultStyle) as 'color' | 'mono';
              const defaultMonoColor = normalizeHexColor(el.style.monoColor, '#FFFFFF');
              const currentMonoColor = normalizeHexColor(ov.monoColor, defaultMonoColor);

              return (
                <div key={el.id} className={ui.field}>
                  <div className={ui.label}>{el.label ?? el.id}</div>

                  {canToggle ? (
                    <label className={ui.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={ov.visible !== false}
                        onChange={(e) => {
                          setElementOverride(templateId, el.id, {
                            visible: e.target.checked ? undefined : false,
                          });
                          onTemplateOverridesChange();
                        }}
                      />
                      <span>显示</span>
                    </label>
                  ) : null}

                  {canStyle ? (
                    <label className={ui.field}>
                      <div className={ui.label}>风格</div>
                      <select
                        className={ui.select}
                        value={currentStyle}
                        onChange={(e) => {
                          const next = e.target.value as 'color' | 'mono';
                          setElementOverride(templateId, el.id, {
                            logoStyle: next === defaultStyle ? undefined : next,
                          });
                          onTemplateOverridesChange();
                        }}
                      >
                        <option value="color">彩色</option>
                        <option value="mono">单色</option>
                      </select>
                    </label>
                  ) : null}

                  {currentStyle === 'mono' && canMonoColor ? (
                    <label className={ui.field}>
                      <div className={ui.label}>单色颜色</div>
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
                    </label>
                  ) : null}
                </div>
              );
            })}

            <div className={ui.buttonRow}>
              <button
                className={ui.ghostButton}
                type="button"
                onClick={() => {
                  saveTemplateOverride(templateId, null);
                  onTemplateOverridesChange();
                }}
              >
                重置模板设置
              </button>
            </div>
          </div>
        ) : null}

        <label className={ui.field}>
          <div className={ui.label}>格式</div>
          <select
            className={ui.select}
            value={exportFormat}
            onChange={(e) => onExportFormatChange(e.target.value as ExportFormat)}
          >
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </label>

        <label className={ui.field}>
          <div className={ui.label}>导出尺寸</div>
          <select
            className={ui.select}
            value={String(maxEdge)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === 'original') onMaxEdgeChange('original');
              else onMaxEdgeChange(Number(raw));
            }}
          >
            <option value="original">原尺寸</option>
            <option value="4096">最长边 4096</option>
            <option value="2048">最长边 2048</option>
          </select>
        </label>

        {exportFormat === 'jpeg' ? (
          <>
            <label className={ui.field}>
              <div className={ui.label}>
                JPEG quality <span className={ui.muted}>{Math.round(jpegQuality * 100)}</span>
              </div>
              <input
                className={ui.range}
                type="range"
                min={60}
                max={95}
                step={1}
                value={Math.round(jpegQuality * 100)}
                onChange={(e) => onJpegQualityChange(Number(e.target.value) / 100)}
              />
            </label>

            <label className={ui.field}>
              <div className={ui.label}>JPEG 背景色</div>
              <input
                className={ui.colorInput}
                type="color"
                value={jpegBackground}
                onChange={(e) => onJpegBackgroundChange(e.target.value)}
              />
            </label>
          </>
        ) : null}

        <div className={ui.buttonRow}>
          <button
            className={ui.primaryButton}
            type="button"
            disabled={!hasSelection || isExporting}
            onClick={onExportSelected}
          >
            导出当前
          </button>
          <button
            className={ui.ghostButton}
            type="button"
            disabled={imagesCount === 0 || isExporting}
            onClick={onExportAll}
          >
            导出全部
          </button>
        </div>

        {batchState?.running ? (
          <div className={ui.buttonRow}>
            <button className={ui.dangerButton} type="button" onClick={onCancelBatch}>
              取消批量
            </button>
            <div className={ui.hint}>
              {batchState.completed}/{batchState.jobs.length}（请允许浏览器多文件下载）
            </div>
          </div>
        ) : batchState && failedCount > 0 ? (
          <div className={ui.buttonRow}>
            <button className={ui.ghostButton} type="button" onClick={onRetryFailed} disabled={isExporting}>
              重试失败（{failedCount}）
            </button>
            <div className={ui.hint}>失败项会再次逐张下载</div>
          </div>
        ) : null}

        {exportStatus ? <div className={ui.hint}>{exportStatus}</div> : null}

        {!hasSelection ? <div className={ui.hint}>先在左侧选择一张图片</div> : null}

        {hasSelection ? (
          <div className={ui.exifBox}>
            <div className={ui.exifTitle}>本次水印信息</div>
            {isReadingExif ? <div className={ui.exifLine}>读取 EXIF…</div> : null}
            {exifError ? <div className={ui.exifError}>EXIF 读取失败：{exifError}</div> : null}
            {fields?.camera ? <div className={ui.exifLine}>{fields.camera}</div> : null}
            {fields?.lens ? <div className={ui.exifLine}>{fields.lens}</div> : null}
            {fields?.settings ? <div className={ui.exifLine}>{fields.settings}</div> : null}
            {fields?.date ? <div className={ui.exifLine}>{fields.date}</div> : null}
            {!fields?.camera && !fields?.lens && !fields?.settings && !fields?.date && !isReadingExif ? (
              <div className={ui.exifLine}>无可用 EXIF 字段（仍可导出）</div>
            ) : null}
          </div>
        ) : null}

        {batchState && !batchState.running && failedCount > 0 ? (
          <div className={ui.errorList}>
            <div className={ui.exifTitle}>失败列表</div>
            <ul className={ui.errorItems}>
              {batchState.jobs
                .filter((job) => job.status === 'error')
                .slice(0, 6)
                .map((job) => (
                  <li key={job.id} className={ui.errorItem}>
                    <div className={ui.errorName}>{job.file.name}</div>
                    <div className={ui.errorMessage}>{job.error}</div>
                  </li>
                ))}
            </ul>
            {failedCount > 6 ? <div className={ui.hint}>仅显示前 6 条失败原因</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
