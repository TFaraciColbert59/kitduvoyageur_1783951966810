import React from 'react';
import styles from './media-sharing.module.css';

export function LockedState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.stateCard} role="status" data-state="locked">
      <span className={styles.stateIcon} aria-hidden="true">
        ⌁
      </span>
      <div>
        <h3 className={styles.stateTitle}>{title}</h3>
        <p className={styles.stateMessage}>{message}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className={styles.stateCard} role="status" data-state="empty">
      <span className={styles.stateIcon} aria-hidden="true">
        ○
      </span>
      <div>
        <h3 className={styles.stateTitle}>{title}</h3>
        <p className={styles.stateMessage}>{message}</p>
      </div>
    </div>
  );
}

export function ErrorState({
  title = 'Impossible de charger cette vue',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.stateCard} role="alert" data-state="error">
      <span className={styles.stateIcon} aria-hidden="true">
        !
      </span>
      <div>
        <h3 className={styles.stateTitle}>{title}</h3>
        <p className={styles.stateMessage}>{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className={styles.secondaryButton} onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
      {hint ? <span className={styles.statHint}>{hint}</span> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      {action ? <div className={styles.sectionAction}>{action}</div> : null}
    </div>
  );
}
