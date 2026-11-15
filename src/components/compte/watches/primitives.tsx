'use client';

/**
 * Lot D03-UI — primitives accessibles de la surface montres.
 *
 * Cibles ≥ 44 px, focus visible, contrastes par tokens et aucun état masqué :
 * un `Notice` d'erreur porte `role="alert"`, les chargements `role="status"`.
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';

export function Card({
  children,
  className,
  as: Tag = 'div',
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag className={['lkv-watch__card', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="lkv-watch__section" aria-label={title}>
      <div className="lkv-watch__section-head">
        <div>
          <h2 className="lkv-watch__section-title">{title}</h2>
          {hint ? <p className="lkv-watch__hint">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export type PillTone = 'neutral' | 'ok' | 'warning' | 'error' | 'info';

export function StatusPill({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  title?: string;
}) {
  return (
    <span className="lkv-watch__pill" data-tone={tone} title={title}>
      {children}
    </span>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'ok' | 'warning' | 'error';
  children: React.ReactNode;
}) {
  const Icon =
    tone === 'error' || tone === 'warning'
      ? AlertTriangle
      : tone === 'ok'
        ? CheckCircle2
        : Info;
  return (
    <div
      className="lkv-watch__notice"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="lkv-watch__empty">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Chargement des montres…' }: { label?: string }) {
  return (
    <div className="lkv-watch__loading" role="status">
      <Loader2 size={18} className="lkv-watch__spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="lkv-watch__error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="lkv-watch__btn" onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

export function Progress({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      className="lkv-watch__progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <span style={{ transform: `scaleX(${clamped / 100})` }} />
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="lkv-watch__stat">
      <dt>{label}</dt>
      <dd>
        {value}
        {hint ? <small>{hint}</small> : null}
      </dd>
    </div>
  );
}

export function Button({
  children,
  variant = 'secondary',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button
      type="button"
      className="lkv-watch__btn"
      data-variant={variant}
      {...rest}
    >
      {children}
    </button>
  );
}
