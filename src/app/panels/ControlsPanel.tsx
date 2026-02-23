import { useRef, useState } from 'react';
import ui from './Panels.module.css';
import {
  buildWatermarkFields,
  clearMakerLogoDataUrl,
  getMakerLogoDataUrl,
  inferMakerLogoKey,
  rasterizeLogoFileToPngDataUrl,
  setMakerLogoDataUrl,
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
  onMakerLogoChanged: () => void;
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
  onMakerLogoChanged,
}: Props) {
  const makerLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [makerLogoError, setMakerLogoError] = useState<string | null>(null);

  const fields = exif ? buildWatermarkFields(exif) : null;
  const failedCount = batchState
    ? batchState.jobs.filter((job) => job.status === 'error').length
    : 0;

  const makerKey = exif ? inferMakerLogoKey(exif) : null;
  const makerLogoDataUrl = makerKey ? getMakerLogoDataUrl(makerKey) : null;
  const hasMakerLogo = Boolean(makerLogoDataUrl);

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

            {makerKey ? (
              <>
                <div className={ui.exifTitle} style={{ marginTop: 12 }}>
                  厂商 Logo（可选）
                </div>
                <div className={ui.exifLine}>
                  Key：{makerKey}（{hasMakerLogo ? '已设置' : '未设置'}）
                </div>
                <div className={ui.buttonRow} style={{ marginTop: 10 }}>
                  <button
                    className={ui.ghostButton}
                    type="button"
                    onClick={() => makerLogoInputRef.current?.click()}
                    disabled={isExporting}
                  >
                    上传 Logo
                  </button>
                  <button
                    className={ui.ghostButton}
                    type="button"
                    onClick={() => {
                      try {
                        clearMakerLogoDataUrl(makerKey);
                        setMakerLogoError(null);
                        onMakerLogoChanged();
                      } catch (err) {
                        setMakerLogoError(err instanceof Error ? err.message : 'Logo 清除失败');
                      }
                    }}
                    disabled={!hasMakerLogo || isExporting}
                  >
                    清除
                  </button>
                </div>
                <input
                  ref={makerLogoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = '';
                    if (!file) return;

                    setMakerLogoError(null);
                    rasterizeLogoFileToPngDataUrl(file)
                      .then((dataUrl) => {
                        try {
                          setMakerLogoDataUrl(makerKey, dataUrl);
                          onMakerLogoChanged();
                        } catch (err) {
                          setMakerLogoError(err instanceof Error ? err.message : 'Logo 保存失败');
                        }
                      })
                      .catch((err) => {
                        setMakerLogoError(err instanceof Error ? err.message : 'Logo 处理失败');
                      });
                  }}
                />
                {makerLogoError ? <div className={ui.exifError}>Logo 失败：{makerLogoError}</div> : null}
                <div className={ui.hint} style={{ marginTop: 8 }}>
                  Logo 仅保存在浏览器本地，不会上传/不会进 git；素材版权/商标请自行确认。
                </div>
              </>
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
