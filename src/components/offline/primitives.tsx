'use client';

/**
 * Lot N02-UI — Primitives partagées des écrans de paquets hors ligne.
 *
 * Aucun accès réseau, aucun stockage : uniquement du rendu et des formateurs.
 * Toutes les valeurs métier viennent du contrat `@/features/offline`.
 */

import React from 'react';
import { XpIcon, type XpIconName } from '@/features/explorer-v2/ui/XpIcon';
import type { OfflinePackStatus } from '@/features/offline';
import styles from './offlineUi.module.css';

export type OfflineTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const OFFLINE_STATUS_LABEL: Readonly<Record<OfflinePackStatus, string>> = {
  estimated: 'Estimé',
  queued: 'En attente',
  downloading: 'Téléchargement',
  paused: 'En pause',
  verifying: 'Vérification',
  available: 'Disponible hors ligne',
  degraded: 'Disponible, dégradé',
  corrupted: 'Corrompu',
  expired: 'Expiré',
  unavailable: 'Indisponible',
};

export const OFFLINE_STATUS_TONE: Readonly<Record<OfflinePackStatus, OfflineTone>> = {
  estimated: 'neutral',
  queued: 'info',
  downloading: 'info',
  paused: 'warning',
  verifying: 'info',
  available: 'success',
  degraded: 'warning',
  corrupted: 'danger',
  expired: 'warning',
  unavailable: 'neutral',
};

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!Number.isFinite(bytes) || (bytes ?? 0) <= 0) return '—';
  const value = bytes as number;
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
  }
  return `${(value / 1024 / 1024 / 1024).toFixed(2).replace('.', ',')} Go`;
}

export function formatCount(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fr-FR').format(value as number);
}

export function formatDate(ms: number | null | undefined): string {
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms as number));
}

export function formatDistanceM(distanceM: number): string {
  if (!Number.isFinite(distanceM) || distanceM < 0) return '—';
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`;
}

export function OfflineEyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export function OfflineBadge({
  children,
  tone = 'neutral',
  icon,
}: {
  children: React.ReactNode;
  tone?: OfflineTone;
  icon?: XpIconName | string;
}) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {icon ? <XpIcon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function OfflineStatusBadge({ status }: { status: OfflinePackStatus }) {
  return (
    <OfflineBadge tone={OFFLINE_STATUS_TONE[status]} icon="offline">
      {OFFLINE_STATUS_LABEL[status]}
    </OfflineBadge>
  );
}

export function OfflinePanel({
  as = 'section',
  children,
  className,
  ariaLabel,
  ariaLabelledBy,
}: {
  as?: 'section' | 'div' | 'article';
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}) {
  const Tag = as;
  return (
    <Tag
      className={cx(styles.panel, className)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </Tag>
  );
}

export function OfflinePanelHeader({
  eyebrow,
  title,
  subtitle,
  action,
  id,
  large = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  action?: React.ReactNode;
  id?: string;
  large?: boolean;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.headingBlock}>
        {eyebrow ? <OfflineEyebrow>{eyebrow}</OfflineEyebrow> : null}
        <h2 className={cx(styles.title, large && styles.titleLarge)} id={id}>
          {title}
        </h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export const OfflineButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    fullWidth?: boolean;
  }
>(function OfflineButton(
  { variant = 'primary', fullWidth = false, className, type = 'button', ...rest },
  ref
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

export function OfflineIconButton({
  label,
  icon,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: XpIconName | string;
}) {
  return (
    <button type="button" className={styles.iconButton} aria-label={label} title={label} {...rest}>
      <XpIcon name={icon} size={18} />
    </button>
  );
}

export function OfflineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}

export function OfflineProgress({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.max(0, Math.min(safeMax, Number.isFinite(value) ? value : 0));
  const percent = Math.round((safeValue / safeMax) * 100);
  return (
    <div className={styles.stackTight}>
      <div className={cx(styles.row, styles.between)}>
        <span className={styles.itemMeta}>{label}</span>
        <span className={styles.mono}>{percent} %</span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-valuetext={`${percent} %`}
      >
        <div className={styles.progressBar} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function OfflineNotice({
  children,
  tone = 'neutral',
  icon = 'info',
}: {
  children: React.ReactNode;
  tone?: OfflineTone;
  icon?: XpIconName | string;
}) {
  return (
    <div className={styles.notice} data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <XpIcon name={icon} size={16} />
      <span>{children}</span>
    </div>
  );
}

export function OfflineEmpty({
  title,
  hint,
  icon = 'offline',
}: {
  title: string;
  hint?: string;
  icon?: XpIconName | string;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.iconBubble}>
        <XpIcon name={icon} size={18} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {hint ? <p className={styles.emptyHint}>{hint}</p> : null}
    </div>
  );
}
