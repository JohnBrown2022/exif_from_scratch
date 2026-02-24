import type { ButtonHTMLAttributes } from 'react';

import styles from './ui.module.css';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({ variant = 'ghost', className, ...props }: ButtonProps) {
  const variantClass =
    variant === 'primary' ? styles.buttonPrimary : variant === 'danger' ? styles.buttonDanger : undefined;
  const merged = [styles.button, variantClass, className].filter(Boolean).join(' ');
  return <button className={merged} {...props} />;
}

