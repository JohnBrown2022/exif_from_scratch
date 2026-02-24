import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

import styles from './ui.module.css';

export type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  right?: ReactNode;
  children: ReactNode;
};

export function Field({ label, hint, error, right, children }: FieldProps) {
  const reactId = useId();
  const fallbackControlId = `field-${reactId}`;

  let controlId: string | null = null;
  if (isValidElement(children)) {
    const existingId = (children.props as { id?: unknown }).id;
    controlId = typeof existingId === 'string' ? existingId : fallbackControlId;
  }

  const hintId = controlId ? `${controlId}-hint` : undefined;
  const errorId = controlId ? `${controlId}-error` : undefined;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  let control = children;
  if (controlId && isValidElement(children)) {
    const props = children.props as { id?: unknown; ['aria-describedby']?: unknown; ['aria-invalid']?: unknown };
    const existingDescribedBy = typeof props['aria-describedby'] === 'string' ? props['aria-describedby'] : '';
    const mergedDescribedBy = [existingDescribedBy, describedBy].filter(Boolean).join(' ') || undefined;

    control = cloneElement(children as ReactElement, {
      id: controlId,
      ...(mergedDescribedBy ? { 'aria-describedby': mergedDescribedBy } : null),
      ...(error ? { 'aria-invalid': true } : null),
    });
  }

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        {controlId ? (
          <label className={styles.label} htmlFor={controlId}>
            {label}
          </label>
        ) : (
          <div className={styles.label}>{label}</div>
        )}
        {right}
      </div>
      {control}
      {error ? (
        <div className={styles.error} id={errorId}>
          {error}
        </div>
      ) : hint ? (
        <div className={styles.hint} id={hintId}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
