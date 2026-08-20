'use client';
import styles from './MaterielGrid.module.css';

export function MaterielGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
