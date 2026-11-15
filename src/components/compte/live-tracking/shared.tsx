'use client';

import React from 'react';

import Button from '@/components/ui/Button';

export function PanelCard({
  children,
  className = '',
  'aria-labelledby': labelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`g1 rounded-2xl border border-[color:var(--glass-rim)] p-5 shadow-md ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--glass-secondary)]">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-1 text-[20px] font-semibold leading-tight text-[color:var(--glass-label)]"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--glass-secondary)]">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export type ChipTone = 'live' | 'neutral' | 'warning' | 'danger';

const CHIP_TONE: Record<ChipTone, string> = {
  live: 'bg-[var(--lkv-action-soft)] text-[color:var(--lkv-action)]',
  neutral: 'bg-[var(--lkv-surface-muted)] text-[color:var(--glass-secondary)]',
  warning: 'bg-[var(--lkv-warning-bg)] text-[color:var(--lkv-warning-dark)]',
  danger: 'bg-[var(--lkv-danger-bg)] text-[color:var(--lkv-danger-dark)]',
};

export function Chip({
  tone = 'neutral',
  children,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CHIP_TONE[tone]}`}
    >
      {tone === 'live' ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

export function Switch({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-11 items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[14px] font-medium text-[color:var(--glass-label)]">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-[color:var(--glass-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-[color:var(--glass-rim)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
          checked ? 'bg-[color:var(--lkv-action)]' : 'bg-[var(--lkv-disabled-bg)]'
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-[color:var(--lkv-danger)] bg-[var(--lkv-danger-bg)] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-[13px] leading-relaxed text-[color:var(--lkv-danger-dark)]">
        <span aria-hidden className="mr-1.5">
          ⚠️
        </span>
        {message}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
