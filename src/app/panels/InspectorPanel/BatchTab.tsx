import ui from '../../ui/ui.module.css';
import { Button } from '../../ui/Button';
import type { BatchUpdate } from '../../../core';

type Props = {
  batchState: BatchUpdate | null;
  isExporting: boolean;
  onCancelBatch: () => void;
  onRetryFailed: () => void;
};

export function BatchTab({ batchState, isExporting, onCancelBatch, onRetryFailed }: Props) {
  const failedCount = batchState ? batchState.jobs.filter((job) => job.status === 'error').length : 0;
  const total = batchState?.total ?? 0;
  const completed = batchState?.completed ?? 0;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <div className={ui.section}>
        <div className={ui.sectionTitle}>批量</div>
        <div className={ui.hint}>批量导出会触发浏览器多文件下载，请提前允许。</div>
      </div>

      {!batchState ? <div className={ui.hint}>尚未开始批量导出。</div> : null}

      {batchState?.running ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>进行中</div>
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
        </div>
      ) : null}

      {batchState && !batchState.running && failedCount > 0 ? (
        <div className={ui.section}>
          <div className={ui.sectionTitle}>失败项</div>
          <div className={ui.hint}>失败项可重试，仍会逐张下载。</div>
          <div className={ui.buttonRow}>
            <Button type="button" disabled={isExporting} onClick={onRetryFailed}>
              重试失败（{failedCount}）
            </Button>
          </div>
          <div style={{ marginTop: 10 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {batchState.jobs
                .filter((job) => job.status === 'error')
                .slice(0, 6)
                .map((job) => (
                  <li key={job.id}>
                    <span>{job.file.name}</span>
                    <span className={ui.muted}> · {job.error}</span>
                  </li>
                ))}
            </ul>
            {failedCount > 6 ? <div className={ui.hint}>仅显示前 6 条失败原因</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

