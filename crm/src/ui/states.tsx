import type { ReactNode } from 'react';
import s from './crm.module.css';
import { cx } from './cx';
import { Label } from './card';

/** Squelette de chargement : jamais d'écran blanc. */
export function Skeleton({ height = 14, width = '100%' }: { height?: number; width?: string | number }) {
  return <span className={s.skeleton} style={{ height, width, display: 'block' }} aria-hidden="true" />;
}

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className={s.visuallyHidden}>Chargement en cours…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={s.row} style={{ cursor: 'default' }}>
          <Skeleton height={10} width={10} />
          <div className={s.rowMain}>
            <Skeleton height={13} width={`${60 + ((i * 7) % 30)}%`} />
            <Skeleton height={11} width={`${40 + ((i * 11) % 30)}%`} />
          </div>
          <Skeleton height={20} width={84} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className={cx(s.card, s.pad)} aria-busy="true">
      <div className={s.colGap}>
        <Skeleton height={12} width="30%" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height={12} width={`${90 - i * 12}%`} />
        ))}
      </div>
    </div>
  );
}

/** État vide : ce qui apparaîtra, et comment le faire apparaître. */
export function EmptyState({
  title,
  children,
  action
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={s.empty} role="status">
      <span className={s.emptyTitle}>{title}</span>
      {children ? <span className={s.muted}>{children}</span> : null}
      {action}
    </div>
  );
}

/** Bandeau d'information (cause, règle, avertissement). */
export function Banner({
  tone = 'warn',
  title,
  children
}: {
  tone?: 'warn' | 'danger' | 'info';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx(s.banner, tone === 'danger' && s.bannerDanger, tone === 'info' && s.bannerInfo)} role="note">
      <span className={s.colGapSm}>
        {title ? <Label>{title}</Label> : null}
        <span>{children}</span>
      </span>
    </div>
  );
}
