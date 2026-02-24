import ui from '../../ui/ui.module.css';
import { Field } from '../../ui/Field';
import { Button } from '../../ui/Button';
import { getBuiltinTemplateJson, type ExportFormat, type JpegBackgroundMode, type TemplateId } from '../../../core';

/** Returns true if the template has background area outside the photo (footer, padding, etc.) */
function templateHasBackground(templateId: TemplateId): boolean {
  const json = getBuiltinTemplateJson(templateId);
  if (!json) return false;
  return json.layout.kind === 'photo_plus_footer';
}

type Props = {
  exportFormat: ExportFormat;
  onExportFormatChange: (format: ExportFormat) => void;
  jpegQuality: number;
  onJpegQualityChange: (quality: number) => void;
  maxEdge: number | 'original';
  onMaxEdgeChange: (maxEdge: number | 'original') => void;
  jpegBackground: string;
  onJpegBackgroundChange: (color: string) => void;
  jpegBackgroundMode: JpegBackgroundMode;
  onJpegBackgroundModeChange: (mode: JpegBackgroundMode) => void;
  blurRadius: number;
  onBlurRadiusChange: (radius: number) => void;
  templateId: TemplateId;
  hasSelection: boolean;
  imagesCount: number;
  isExporting: boolean;
  exportStatus: string | null;
  onExportSelected: () => void;
  onExportAll: () => void;
};

export function ExportTab({
  exportFormat,
  onExportFormatChange,
  jpegQuality,
  onJpegQualityChange,
  maxEdge,
  onMaxEdgeChange,
  jpegBackground,
  onJpegBackgroundChange,
  jpegBackgroundMode,
  onJpegBackgroundModeChange,
  blurRadius,
  onBlurRadiusChange,
  templateId,
  hasSelection,
  imagesCount,
  isExporting,
  exportStatus,
  onExportSelected,
  onExportAll,
}: Props) {
  const hasBgArea = templateHasBackground(templateId);

  return (
    <>
      <div className={ui.section}>
        <div className={ui.sectionTitle}>导出</div>
        <div className={ui.hint}>导出图片默认不包含 EXIF 元数据。</div>
      </div>

      <Field label="格式">
        <select
          className={ui.control}
          value={exportFormat}
          onChange={(e) => onExportFormatChange(e.target.value as ExportFormat)}
        >
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
        </select>
      </Field>

      <Field label="导出尺寸">
        <select
          className={ui.control}
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
      </Field>

      {exportFormat === 'jpeg' ? (
        <>
          <Field
            label={`JPEG quality（${Math.round(jpegQuality * 100)}）`}
            hint="批量导出建议不超过 95。"
          >
            <input
              className={ui.range}
              type="range"
              min={60}
              max={95}
              step={1}
              value={Math.round(jpegQuality * 100)}
              onChange={(e) => onJpegQualityChange(Number(e.target.value) / 100)}
            />
          </Field>

          <Field label="JPEG 背景模式">
            <select
              className={ui.control}
              value={jpegBackgroundMode}
              onChange={(e) => onJpegBackgroundModeChange(e.target.value as JpegBackgroundMode)}
            >
              <option value="color">纯色填充</option>
              <option value="blur">照片边缘模糊扩展</option>
            </select>
          </Field>

          {jpegBackgroundMode === 'blur' && !hasBgArea ? (
            <div className={ui.hint} style={{ color: 'rgba(255,200,50,0.85)' }}>
              ⚠ 当前模板没有边框/留白区域，模糊背景效果不可见。请切换到带底栏的模板（如 Classic Footer、EZMark Card 等）。
            </div>
          ) : null}

          {jpegBackgroundMode === 'color' ? (
            <Field label="背景色">
              <input
                className={ui.colorInput}
                type="color"
                value={jpegBackground}
                onChange={(e) => onJpegBackgroundChange(e.target.value)}
              />
            </Field>
          ) : (
            <Field label={`模糊强度（${blurRadius}）`} hint="数值越大模糊越明显。">
              <input
                className={ui.range}
                type="range"
                min={5}
                max={80}
                step={1}
                value={blurRadius}
                onChange={(e) => onBlurRadiusChange(Number(e.target.value))}
              />
            </Field>
          )}
        </>
      ) : null}

      <div className={ui.buttonRow}>
        <Button type="button" variant="primary" disabled={!hasSelection || isExporting} onClick={onExportSelected}>
          导出当前
        </Button>
        <Button type="button" disabled={imagesCount === 0 || isExporting} onClick={onExportAll}>
          导出全部
        </Button>
      </div>

      {!hasSelection ? <div className={ui.hint}>先在左侧选择一张图片</div> : null}
      {exportStatus ? <div className={ui.hint}>{exportStatus}</div> : null}
    </>
  );
}
