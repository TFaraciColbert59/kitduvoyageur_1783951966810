'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { initials } from './format';

export const CARD_CLASS =
  'g1 border border-[color:var(--glass-rim)] rounded-[var(--lkv-radius-card)]';

export function RankingsCard({
  children,
  className = '',
  as: Component = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div';
}) {
  return <Component className={`${CARD_CLASS} ${className}`}>{children}</Component>;
}

export function PanelTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-[var(--space-4)]">
      {eyebrow && (
        <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--glass-label-tertiary)]">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-1 font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--glass-label)]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 max-w-prose text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--glass-label-secondary)]">
          {description}
        </p>
      )}
    </div>
  );
}

export function RankingAvatar({
  name,
  avatarUrl,
  size = 40,
}: {
  name: string;
  avatarUrl: string | null;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] font-semibold text-[color:var(--glass-label)]"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
    >
      {avatarUrl ? (
        <AppImage
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-h-[44px] rounded-full px-3 text-[length:var(--lkv-text-caption)] font-semibold transition-[transform,background-color] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
              active
                ? 'bg-[color:var(--g3-bg)] text-[color:var(--g3-text)]'
                : 'text-[color:var(--glass-label-secondary)] hover:bg-[color:var(--lkv-hover-surface)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
}: {
  value: number;
  max?: number;
  label: string;
}) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.max(0, Math.min(safeMax, value))}
      className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--lkv-field-bg)]"
    >
      <div
        className="h-full rounded-full bg-[color:var(--lkv-secondary)] transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--lkv-radius-tile)] border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-[var(--space-3)]">
      <div className="flex items-center gap-2 text-[color:var(--glass-label-tertiary)]">
        {icon}
        <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <p className="mt-1 font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--glass-label)]">
        {value}
      </p>
      {detail && (
        <p className="mt-0.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
          {detail}
        </p>
      )}
    </div>
  );
}

export function InlineNotice({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'privacy' | 'warning';
}) {
  const toneClass =
    tone === 'privacy'
      ? 'border-[color:var(--lkv-secondary)]/35'
      : tone === 'warning'
        ? 'border-[color:var(--lkv-secondary)]/40'
        : 'border-[color:var(--glass-rim)]';
  return (
    <p
      className={`rounded-[var(--lkv-radius-tile)] border bg-[color:var(--g2-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--glass-label-secondary)] ${toneClass}`}
    >
      {children}
    </p>
  );
}

export function RankingsEmpty({
  title,
  description,
  icon = 'compass',
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  icon?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  const action = actionLabel ? (
    actionHref ? (
      <Link href={actionHref} className="mt-4 inline-flex">
        <Button variant="secondary" size="md">
          {actionLabel}
        </Button>
      </Link>
    ) : onAction ? (
      <Button variant="secondary" size="md" onClick={onAction} className="mt-4">
        {actionLabel}
      </Button>
    ) : null
  ) : null;

  return (
    <div className="flex flex-col items-center justify-center px-[var(--space-4)] py-[var(--space-7)] text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] text-[color:var(--glass-label-secondary)]">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--glass-label)]">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--glass-label-secondary)]">
        {description}
      </p>
      {action}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-[var(--space-4)] py-[var(--space-6)] text-center">
      <Icon name="alert-triangle" size={24} className="text-[color:var(--lkv-danger)]" />
      <p className="mt-2 text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--glass-label)]">
        {message}
      </p>
      <Button variant="secondary" size="md" onClick={onRetry} className="mt-3">
        Réessayer
      </Button>
    </div>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? '1' : rank === 2 ? '2' : rank === 3 ? '3' : null;
  return (
    <span
      aria-label={`Rang ${rank}`}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[length:var(--lkv-text-caption)] font-bold ${
        medal
          ? 'border-[color:var(--lkv-secondary)]/45 bg-[color:var(--lkv-secondary)]/15 text-[color:var(--lkv-secondary-subtle)]'
          : 'border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] text-[color:var(--glass-label-secondary)]'
      }`}
    >
      {rank}
    </span>
  );
}

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-[44px] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--glass-bg-medium)] px-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-medium normal-case tracking-normal text-[color:var(--glass-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] [&_option]:bg-[color:var(--lkv-surface-card)] [&_option]:text-[color:var(--lkv-text-primary)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
