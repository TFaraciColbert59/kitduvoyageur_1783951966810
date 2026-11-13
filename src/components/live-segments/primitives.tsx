'use client';

/**
 * Lot S03-UI — primitives des surfaces Live Segments.
 *
 * Tokens `--lkv-*` uniquement, cibles tactiles ≥ 44 px, focus visible.
 * Aucune dépendance de données : les composants reçoivent des valeurs du
 * snapshot déjà calculées par le contrat.
 */

import React from 'react';
import { XpIcon, type XpIconName } from '@/features/explorer-v2/ui/XpIcon';
import type {
  LiveSegmentSnapshot,
  LiveSegmentState,
  SignalQuality,
} from '@/features/live-segments';
import {
  clampRatio,
  formatPercent,
  signalPresentation,
  statePresentation,
  type LiveSegmentTone,
} from './format';
import styles from './live-segments.module.css';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function LiveSegmentEyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export function LiveSegmentBadge({
  children,
  tone = 'neutral',
  icon,
  onDark = false,
}: {
  children: React.ReactNode;
  tone?: LiveSegmentTone;
  icon?: XpIconName | string;
  onDark?: boolean;
}) {
  return (
    <span className={cx(styles.badge, onDark && styles.badgeOnDark)} data-tone={tone}>
      {icon ? <XpIcon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function LiveSegmentPanel({
  as = 'section',
  children,
  className,
  ariaLabel,
  ariaLabelledBy,
  testId,
}: {
  as?: 'section' | 'div' | 'article';
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  testId?: string;
}) {
  const Tag = as;
  return (
    <Tag
      className={cx(styles.panel, className)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-testid={testId}
    >
      {children}
    </Tag>
  );
}

export function LiveSegmentHeader({
  eyebrow,
  title,
  subtitle,
  action,
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className={styles.panelHeader}>
      <div className={styles.headingBlock}>
        {eyebrow ? <LiveSegmentEyebrow>{eyebrow}</LiveSegmentEyebrow> : null}
        <h2 className={styles.title} id={id}>
          {title}
        </h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export const LiveSegmentButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    fullWidth?: boolean;
  }
>(function LiveSegmentButton(
  { variant = 'primary', fullWidth = false, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, className)}
      data-variant={variant}
      data-full={fullWidth ? 'true' : undefined}
      {...rest}
    />
  );
});

export function LiveSegmentIconButton({
  label,
  icon,
  size = 18,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: XpIconName | string;
  size?: number;
}) {
  return (
    <button
      type="button"
      className={cx(styles.iconButton, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <XpIcon name={icon} size={size} />
    </button>
  );
}

export function LiveSegmentProgress({
  ratio,
  label,
  valueText,
  tone = 'success',
}: {
  ratio: number;
  label: string;
  valueText?: string;
  tone?: LiveSegmentTone;
}) {
  const safeRatio = clampRatio(ratio);
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeRatio * 100)}
      aria-valuetext={valueText ?? formatPercent(safeRatio)}
      data-tone={tone}
    >
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${safeRatio * 100}%` }} />
      </div>
      <span className={styles.progressValue}>{valueText ?? formatPercent(safeRatio)}</span>
    </div>
  );
}

export function LiveSegmentStat({
  label,
  value,
  hint,
  tone = 'neutral',
  align = 'start',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string | null;
  tone?: LiveSegmentTone;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <div className={styles.stat} data-tone={tone} data-align={align}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {hint ? <span className={styles.statHint}>{hint}</span> : null}
    </div>
  );
}

export function LiveSegmentStateBadge({
  state,
  onDark = false,
}: {
  state: LiveSegmentState;
  onDark?: boolean;
}) {
  const presentation = statePresentation(state);
  return (
    <LiveSegmentBadge tone={presentation.tone} icon={presentation.icon} onDark={onDark}>
      {presentation.label}
    </LiveSegmentBadge>
  );
}

export function LiveSegmentSignalBadge({
  quality,
  onDark = false,
}: {
  quality: SignalQuality;
  onDark?: boolean;
}) {
  const presentation = signalPresentation(quality);
  return (
    <LiveSegmentBadge
      tone={presentation.tone}
      icon={quality === 'good' ? 'gauge' : quality === 'degraded' ? 'alert' : 'offline'}
      onDark={onDark}
    >
      {presentation.label}
    </LiveSegmentBadge>
  );
}

export function LiveSegmentEmpty({
  title,
  description,
  icon = 'route',
  action,
}: {
  title: string;
  description: string;
  icon?: XpIconName | string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.empty} role="status">
      <span className={styles.emptyIcon} aria-hidden="true">
        <XpIcon name={icon} size={22} />
      </span>
      <div className={styles.headingBlock}>
        <p className={styles.emptyTitle}>{title}</p>
        <p className={styles.subtitle}>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function LiveSegmentSpinner({ label = 'Chargement des segments' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function snapshotRemainingLabel(snapshot: LiveSegmentSnapshot): string {
  return `${Math.max(0, snapshot.totalDistanceM - snapshot.distanceCoveredM).toFixed(0)} m restants`;
}
