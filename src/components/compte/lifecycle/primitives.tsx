'use client';

/**
 * Lot A02 — primitives accessibles de la surface « cycle de vie ».
 *
 * Cibles ≥ 44 px, focus visible, fermeture Échap, restitution du focus et
 * verrouillage du défilement : mêmes règles que les drawers Compte.
 */

import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          (element.offsetWidth > 0 ||
            element.offsetHeight > 0 ||
            element.getClientRects().length > 0)
      );
      if (focusable.length === 0) return;
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="lkv-life__scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="lkv-life__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="lkv-life__grabber" aria-hidden="true" />
        <header className="lkv-life__sheet-head">
          <div className="lkv-life__header-copy">
            <h2 className="lkv-life__title" id={titleId}>
              {title}
            </h2>
            {subtitle ? <p className="lkv-life__sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="lkv-life__iconbtn" onClick={onClose} aria-label="Fermer">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="lkv-life__sheet-body">{children}</div>
        {footer ? <footer className="lkv-life__sheet-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="lkv-life__section" aria-label={title}>
      <div className="lkv-life__sectionhead">
        <h3 className="lkv-life__sectiontitle">{title}</h3>
        {hint ? <p className="lkv-life__hint">{hint}</p> : null}
      </div>
      {children}
    </section>
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
    <div className="lkv-life__stat">
      <dt>{label}</dt>
      <dd>
        {value}
        {hint ? <small> {hint}</small> : null}
      </dd>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <dl className="lkv-life__stats">{children}</dl>;
}

export function Chip({
  children,
  tone,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  tone?: 'accent';
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  if (!onClick) {
    return (
      <span className="lkv-life__chip" data-tone={tone} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="lkv-life__chip"
      data-tone={tone}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
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
    tone === 'error'
      ? AlertTriangle
      : tone === 'ok'
        ? CheckCircle2
        : tone === 'warning'
          ? AlertTriangle
          : Info;
  return (
    <div className="lkv-life__notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={15} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function Segmented<T extends string>({
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
    <div className="lkv-life__seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function LoadingLine({ label = 'Chargement…' }: { label?: string }) {
  return (
    <span className="lkv-life__inline-loading" role="status">
      <span className="lkv-life__spinner" aria-hidden="true" />
      {label}
    </span>
  );
}
