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
};

export function Tabs<T extends string>({ value, items, onChange }: TabsProps<T>) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Inspector tabs">
      {items.map((tab) => {
        const active = tab.id === value;
        const cls = [styles.tab, active ? styles.tabActive : undefined].filter(Boolean).join(' ');
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cls}
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

