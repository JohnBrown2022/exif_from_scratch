import { useId, useMemo, useRef } from 'react';

import styles from './ui.module.css';

export type TabItem<T extends string> = {
  id: T;
  label: string;
  badge?: string | number;
};

export type TabsProps<T extends string> = {
  value: T;
  items: Array<TabItem<T>>;
  onChange: (id: T) => void;
  idPrefix?: string;
  ariaLabel?: string;
};

export function Tabs<T extends string>({ value, items, onChange, idPrefix, ariaLabel = 'Tabs' }: TabsProps<T>) {
  const reactId = useId();
  const prefix = idPrefix ?? reactId;
  const ids = useMemo(() => items.map((t) => t.id), [items]);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function tabDomId(id: T): string {
    return `tab-${prefix}-${id}`;
  }

  function panelDomId(id: T): string {
    return `panel-${prefix}-${id}`;
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
      {items.map((tab) => {
        const active = tab.id === value;
        const cls = [styles.tab, active ? styles.tabActive : undefined].filter(Boolean).join(' ');
        const index = ids.indexOf(tab.id);
        const tabId = tabDomId(tab.id);
        const panelId = panelDomId(tab.id);

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId}
            aria-controls={panelId}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={cls}
            ref={(el) => {
              buttonRefs.current[String(tab.id)] = el;
            }}
            onKeyDown={(e) => {
              if (ids.length <= 1) return;
              if (index < 0) return;

              const focus = (nextId: T) => {
                const el = buttonRefs.current[String(nextId)];
                el?.focus();
              };

              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const nextId = ids[(index + 1) % ids.length]!;
                onChange(nextId);
                focus(nextId);
                return;
              }

              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const nextId = ids[(index - 1 + ids.length) % ids.length]!;
                onChange(nextId);
                focus(nextId);
                return;
              }

              if (e.key === 'Home') {
                e.preventDefault();
                const nextId = ids[0]!;
                onChange(nextId);
                focus(nextId);
                return;
              }

              if (e.key === 'End') {
                e.preventDefault();
                const nextId = ids[ids.length - 1]!;
                onChange(nextId);
                focus(nextId);
              }
            }}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {typeof tab.badge !== 'undefined' ? <span className={styles.muted}> · {tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
