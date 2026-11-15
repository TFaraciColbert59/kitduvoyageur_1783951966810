'use client';

import React from 'react';
import { EmptyState } from '@/components/ui';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export function HeatmapCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`g1 rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border-color)] p-4 shadow-sm ${className}`}
      style={{ background: 'var(--glass-subtle-fill)' }}
    >
      {children}
    </section>
  );
}

export function HeatmapStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border-color)] px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[length:var(--lkv-text-title-sm)] font-bold leading-none text-[color:var(--lkv-text-primary)]">
        {value}
      </dd>
      {hint && (
        <p className="mt-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
          {hint}
        </p>
      )}
    </div>
  );
}

export function HeatmapSectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
        {children}
      </h3>
      {hint && (
        <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
          {hint}
        </span>
      )}
    </div>
  );
}

export function HeatmapPrivacyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border-color)] bg-[var(--lkv-forest-50)] px-3 py-2 text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
      {children}
    </p>
  );
}

export function HeatmapSignInPrompt({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      actionLabel="Se connecter"
      actionHref="/connexion?next=%2Fheatmaps"
      icon={undefined}
    />
  );
}

export function HeatmapRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex justify-center py-2">
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

export function HeatmapInlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-semibold text-[color:var(--lkv-forest-800)] underline decoration-[color:var(--lkv-forest-300)] underline-offset-2"
    >
      {children}
    </Link>
  );
}
