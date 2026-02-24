import type { ReactNode } from 'react';

import styles from './ui.module.css';

export type BadgeProps = {
  tone?: 'default' | 'brand' | 'danger';
  children: ReactNode;
};

export function Badge({ tone = 'default', children }: BadgeProps) {
  const toneClass = tone === 'brand' ? styles.badgeBrand : tone === 'danger' ? styles.badgeDanger : undefined;
  const cls = [styles.badge, toneClass].filter(Boolean).join(' ');
  return <span className={cls}>{children}</span>;
}

