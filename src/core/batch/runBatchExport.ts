import type { ExportOptions } from '../export/exportWatermarked';
import { exportWatermarkedImage } from '../export/exportWatermarked';

import type { BatchJob } from './types';

export type BatchUpdate = {
  jobs: BatchJob[];
  running: boolean;
  completed: number;
  total: number;
};

export async function runBatchExport(
  jobs: BatchJob[],
  options: ExportOptions,
  onUpdate: (update: BatchUpdate) => void,
  onExported: (result: { blob: Blob; filename: string }, job: BatchJob) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<BatchJob[]> {
  const next = jobs.map((job) => ({ ...job }));
  const total = next.length;
  let completed = 0;

  const update = (running: boolean) => {
    onUpdate({ jobs: next.map((j) => ({ ...j })), running, completed, total });
  };

  update(true);

  for (let index = 0; index < next.length; index++) {
    if (signal?.aborted) break;

    const job = next[index]!;
    job.status = 'processing';
    job.error = null;
    update(true);

    try {
      const { blob, filename } = await exportWatermarkedImage(job.file, options);
      await onExported({ blob, filename }, job);
      job.status = 'success';
      job.filename = filename;
      job.error = null;
      completed += 1;
      update(true);
    } catch (err) {
      job.status = 'error';
      job.filename = null;
      job.error = err instanceof Error ? err.message : 'Unknown export error';
      completed += 1;
      update(true);
    }
  }

  if (signal?.aborted) {
    for (const job of next) {
      if (job.status === 'queued' || job.status === 'processing') {
        job.status = 'canceled';
        job.error = null;
        job.filename = null;
      }
    }
  }

  update(false);
  return next;
}
