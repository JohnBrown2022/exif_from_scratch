export type BatchJobStatus = 'queued' | 'processing' | 'success' | 'error' | 'canceled';

export type BatchJob = {
  id: string;
  file: File;
  status: BatchJobStatus;
  error: string | null;
  filename: string | null;
};

