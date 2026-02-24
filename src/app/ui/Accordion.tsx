import { useId, useState, type ReactNode } from 'react';

import styles from './ui.module.css';

export type AccordionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function Accordion({ title, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={styles.accordion}>
      <button
        type="button"
        className={styles.accordionSummary}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className={styles.muted}>{open ? '收起' : '展开'}</span>
      </button>
      {open ? (
        <div id={contentId} className={styles.accordionBody}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

