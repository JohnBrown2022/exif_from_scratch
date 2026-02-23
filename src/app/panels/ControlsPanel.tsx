import ui from './Panels.module.css';
import {
  buildWatermarkFields,
  WATERMARK_TEMPLATES,
  type BatchUpdate,
  type ExifData,
  type TemplateId,
} from '../../core';

export type ExportFormat = 'png' | 'jpeg';

type Props = {
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
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
