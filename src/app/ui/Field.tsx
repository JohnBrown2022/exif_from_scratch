import type { ReactNode } from 'react';

import styles from './ui.module.css';

export type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  right?: ReactNode;
  children: ReactNode;
};

export function Field({ label, hint, error, right, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <div className={styles.label}>{label}</div>
        {right}
      </div>
      {children}
      {error ? <div className={styles.error}>{error}</div> : hint ? <div className={styles.hint}>{hint}</div> : null}
    </div>
  );
}
