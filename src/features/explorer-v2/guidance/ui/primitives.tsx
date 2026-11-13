'use client';

/**
 * Lot N01 — Primitives partagées des surfaces de guidage.
 *
 * Aucune dépendance de données : uniquement des tokens `--lkv-*`, des cibles
 * tactiles ≥ 44 px et des libellés accessibles en français.
 */

import React from 'react';
import { XpIcon, type XpIconName } from '../../ui/XpIcon';
import styles from './guidanceUi.module.css';

export type GuidanceTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function GuidanceEyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export function GuidanceBadge({
  children,
  tone = 'neutral',
  icon,
  onDark = false,
}: {
  children: React.ReactNode;
  tone?: GuidanceTone;
  icon?: XpIconName | string;
  onDark?: boolean;
}) {
  return (
    <span
      className={cx(styles.badge, onDark && styles.pillOnDark)}
      data-tone={tone}
    >
      {icon ? <XpIcon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function GuidancePanel({
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

export function GuidancePanelHeader({
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
        {eyebrow ? <GuidanceEyebrow>{eyebrow}</GuidanceEyebrow> : null}
        <h2 className={styles.title} id={id}>
          {title}
        </h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export const GuidanceButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    fullWidth?: boolean;
  }
>(function GuidanceButton(
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

export function GuidanceIconButton({
  label,
  icon,
  size = 18,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: XpIconName | string;
  size?: number;
}) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      {...rest}
    >
      <XpIcon name={icon} size={size} />
    </button>
  );
}

export function GuidanceLinkButton({
  label,
  hint,
  icon = 'up',
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  label: string;
  hint?: string | null;
  icon?: XpIconName | string;
}) {
  return (
    <a className={styles.linkButton} {...rest}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {hint ? <span className={styles.switchHint}>{hint}</span> : null}
      </span>
      <XpIcon name={icon} size={16} />
    </a>
  );
}

export function GuidanceSwitch({
  label,
  hint,
  checked,
  onToggle,
  disabled = false,
}: {
  label: string;
  hint?: string | null;
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.switchRow}
      onClick={() => onToggle(!checked)}
      disabled={disabled}
    >
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {hint ? <span className={styles.switchHint}>{hint}</span> : null}
      </span>
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchKnob} />
      </span>
    </button>
  );
}

export interface GuidanceSegmentOption<T extends string> {
  value: T;
  label: string;
  hint?: string | null;
  disabled?: boolean;
}

export function GuidanceSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly GuidanceSegmentOption<T>[];
  onChange: (next: T) => void;
  className?: string;
}) {
  const enabled = options.filter((option) => !option.disabled);
  const move = (direction: -1 | 1) => {
    if (enabled.length === 0) return;
    const index = enabled.findIndex((option) => option.value === value);
    const next = enabled[(index + direction + enabled.length) % enabled.length];
    if (next) onChange(next.value);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    }
  };

  return (
    <div
      className={cx(styles.segmented, className)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.label}
          title={option.hint ?? option.label}
          className={styles.segment}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function GuidanceStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export function GuidanceSpinner({ label }: { label?: string }) {
  return (
    <>
      <span className={styles.spinner} aria-hidden="true" />
      {label ? <span className={styles.srOnly}>{label}</span> : null}
    </>
  );
}

export function GuidanceEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.emptyState} role="status">
      <XpIcon name="info" size={18} />
      <span>{children}</span>
    </div>
  );
}

/** Formate un temps restant estimé pour la liste « À venir ». */
export function formatEtaLabel(etaSeconds: number | null | undefined): string | null {
  if (typeof etaSeconds !== 'number' || !Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return null;
  }
  if (etaSeconds < 60) return 'moins d’1 min';
  const minutes = Math.round(etaSeconds / 60);
  if (minutes < 60) return `≈ ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `≈ ${hours} h` : `≈ ${hours} h ${String(remainder).padStart(2, '0')}`;
}

export const POI_KIND_LABEL: Readonly<Record<string, string>> = {
  summit: 'Sommet',
  water: 'Point d’eau',
  refuge: 'Refuge',
  bivouac: 'Bivouac',
  viewpoint: 'Point de vue',
  danger: 'Danger',
  access: 'Accès',
  friend: 'Contact',
  trail: 'Sentier',
  highlight: 'Highlight',
  waypoint: 'Repère',
};

export const POI_KIND_ICON: Readonly<Record<string, XpIconName>> = {
  summit: 'mtn',
  water: 'drop',
  refuge: 'house',
  bivouac: 'tent',
  viewpoint: 'eye',
  danger: 'alert',
  access: 'route',
  friend: 'users',
  trail: 'hike',
  highlight: 'star',
  waypoint: 'pin',
};

export function poiIcon(kind: string): XpIconName {
  return POI_KIND_ICON[kind] ?? 'pin';
}

export function poiLabel(kind: string): string {
  return POI_KIND_LABEL[kind] ?? 'Repère';
}
