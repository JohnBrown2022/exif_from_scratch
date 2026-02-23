import ui from './Panels.module.css';

export type ExportFormat = 'png' | 'jpeg';

type Props = {
  exportFormat: ExportFormat;
  onExportFormatChange: (format: ExportFormat) => void;
  jpegQuality: number;
  onJpegQualityChange: (quality: number) => void;
  hasSelection: boolean;
};

export default function ControlsPanel({
  exportFormat,
  onExportFormatChange,
  jpegQuality,
  onJpegQualityChange,
  hasSelection,
}: Props) {
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

        {exportFormat === 'jpeg' ? (
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
        ) : null}

        <button className={ui.primaryButton} type="button" disabled={!hasSelection}>
          导出（M2 实现）
        </button>

        {!hasSelection ? <div className={ui.hint}>先在左侧选择一张图片</div> : null}
      </div>
    </div>
  );
}

