import ui from '../../ui/ui.module.css';
import { Field } from '../../ui/Field';
import { Button } from '../../ui/Button';
import type { BatchUpdate } from '../../../core';
import { useAppSettings } from '../../state/appSettings';
import { PresetSlots } from './PresetSlots';

type Props = {
  hasSelection: boolean;
  imagesCount: number;
  isExporting: boolean;
  exportStatus: string | null;
  onExportSelected: () => void;
  onExportAll: () => void;
  batchState: BatchUpdate | null;
  onCancelBatch: () => void;
  onRetryFailed: () => void;
};

export function ExportTab({
  hasSelection,
  imagesCount,
  isExporting,
  exportStatus,
  onExportSelected,
  onExportAll,
  batchState,
  onCancelBatch,
  onRetryFailed,
}: Props) {
  const { state: settings, actions: settingsActions, presetPayload } = useAppSettings();
  const { exportFormat, jpegQuality, maxEdge } = settings;

  const failedCount = batchState ? batchState.jobs.filter((job) => job.status === 'error').length : 0;
  const total = batchState?.total ?? 0;
  const completed = batchState?.completed ?? 0;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      {/* ─── 输出设置 ─── */}
      <Field label="格式">
        <select className={ui.control} value={exportFormat} onChange={(e) => settingsActions.setExportFormat(e.target.value as typeof exportFormat)}>
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
            if (raw === 'original') settingsActions.setMaxEdge('original');
            else settingsActions.setMaxEdge(Number(raw));
          }}
        >
          <option value="original">原尺寸</option>
          <option value="4096">最长边 4096</option>
          <option value="2048">最长边 2048</option>
        </select>
      </Field>

      {exportFormat === 'jpeg' ? (
        <Field label={`JPEG 质量（${Math.round(jpegQuality * 100)}）`}>
          <input
            className={ui.range}
            type="range"
            min={60}
            max={95}
            step={1}
            value={Math.round(jpegQuality * 100)}
            onChange={(e) => settingsActions.setJpegQuality(Number(e.target.value) / 100)}
          />
        </Field>
      ) : null}

      <div className={ui.hint} style={{ marginTop: 4 }}>导出图片默认不包含 EXIF 元数据。</div>

      {/* ─── 导出操作 ─── */}
      <div className={ui.buttonRow} style={{ marginTop: 8 }}>
        <Button type="button" variant="primary" disabled={!hasSelection || isExporting} onClick={onExportSelected}>
          导出当前
        </Button>
        <Button type="button" disabled={imagesCount === 0 || isExporting} onClick={onExportAll}>
          导出全部
        </Button>
      </div>

      {!hasSelection ? <div className={ui.hint}>先在左侧选择一张图片</div> : null}
      {exportStatus ? <div className={ui.hint}>{exportStatus}</div> : null}

      {/* ─── 批量进度（条件显示） ─── */}
      {batchState?.running ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>批量进行中</div>
          <div className={ui.hint}>
            {completed}/{total} · {progressPct}%
          </div>
          <div style={{ marginTop: 8 }}>
            <progress value={completed} max={Math.max(1, total)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 10 }} className={ui.buttonRow}>
            <Button type="button" variant="danger" onClick={onCancelBatch}>
              取消批量
            </Button>
          </div>
          <div className={ui.hint}>批量导出会触发多文件下载，请提前允许。</div>
        </div>
      ) : null}

      {batchState && !batchState.running && failedCount > 0 ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>失败项</div>
          <div className={ui.buttonRow}>
            <Button type="button" disabled={isExporting} onClick={onRetryFailed}>
              重试失败（{failedCount}）
            </Button>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, marginTop: 8 }}>
            {batchState.jobs
              .filter((job) => job.status === 'error')
              .slice(0, 6)
              .map((job) => (
                <li key={job.id} style={{ fontSize: 12 }}>
                  <span>{job.file.name}</span>
                  <span className={ui.muted}> · {job.error}</span>
                </li>
              ))}
          </ul>
          {failedCount > 6 ? <div className={ui.hint}>仅显示前 6 条</div> : null}
        </div>
      ) : null}

      {/* ─── 预设槽位 ─── */}
      <PresetSlots currentPayload={presetPayload} onApplyPayload={settingsActions.applyPresetPayload} />
    </>
  );
}
