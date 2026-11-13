import type { HTMLAttributes, ReactNode } from 'react';
import s from './crm.module.css';
import { cx } from './cx';

/** Surface carte : verre clair, rayon 18, ombre encre. */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx(s.card, className)} {...rest}>
      {children}
    </div>
  );
}

/** Surface atténuée (sauge pâle) pour les blocs de contexte et de message. */
export function CardSoft({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx(s.cardSoft, className)} {...rest}>
      {children}
    </div>
  );
}

/** Titre de section en capitales espacées. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx(s.label, className)}>{children}</span>;
}
