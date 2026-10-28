'use client';

import React from 'react';
import { XpIcon } from '../ui/XpIcon';

/** Blocs de contenu de la feuille — grammaire de la maquette (03_ECRANS.md). */

export type Tone = 'ink' | 'water' | 'warn' | 'bad' | 'good' | 'muted';

export function XpEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="xp-eyebrow">{children}</div>;
}

export function XpCardRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="xp-cards" role="list" tabIndex={0} aria-label="Suggestions">
      {children}
    </div>
  );
}

export function XpCard({
  title,
  sub,
  initial,
  icon,
  badge,
  tone = 'ink',
  wide,
  onClick,
  ariaLabel,
}: {
  title: string;
  sub?: string | null;
  initial?: string;
  icon?: string;
  badge?: { label: string; tone?: Tone };
  tone?: Tone;
  wide?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const content = (
    <>
      <span className="xp-card-thumb" data-tone={tone} aria-hidden="true">
        {icon ? <XpIcon name={icon} size={17} /> : (initial ?? title.slice(0, 1)).toUpperCase()}
      </span>
      <span className="xp-card-text">
        <span className="xp-card-title">{title}</span>
        {sub ? <span className="xp-card-sub">{sub}</span> : null}
      </span>
      {badge ? (
        <span className="xp-badge" data-tone={badge.tone ?? 'good'}>
          {badge.label}
        </span>
      ) : null}
    </>
  );

  const className = wide ? 'xp-card xp-card-wide' : 'xp-card';
  if (!onClick) {
    return (
      <div className={className} role="listitem">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      role="listitem"
      onClick={onClick}
      aria-label={ariaLabel ?? title}
    >
      {content}
    </button>
  );
}

export function XpRows({ children }: { children: React.ReactNode }) {
  return <div className="xp-rows">{children}</div>;
}

export function XpRow({
  icon,
  tone = 'ink',
  title,
  sub,
  badge,
  onClick,
  trailing,
  ariaLabel,
}: {
  icon?: string;
  tone?: Tone;
  title: string;
  sub?: string | null;
  badge?: { label: string; tone?: Tone };
  onClick?: () => void;
  trailing?: React.ReactNode;
  ariaLabel?: string;
}) {
  const content = (
    <>
      {icon ? (
        <span className="xp-row-ico" data-tone={tone} aria-hidden="true">
          <XpIcon name={icon} size={15} />
        </span>
      ) : null}
      <span className="xp-row-text">
        <span className="xp-row-title">{title}</span>
        {sub ? <span className="xp-row-sub">{sub}</span> : null}
      </span>
      {badge ? (
        <span className="xp-badge" data-tone={badge.tone ?? 'good'}>
          {badge.label}
        </span>
      ) : null}
      {trailing}
    </>
  );

  if (!onClick) {
    return <div className="xp-row">{content}</div>;
  }
  return (
    <button type="button" className="xp-row" onClick={onClick} aria-label={ariaLabel ?? title}>
      {content}
    </button>
  );
}

export function XpMetrics({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="xp-metrics">
      {items.map((item) => (
        <div className="xp-metric" key={item.label}>
          <div className="xp-metric-label">{item.label}</div>
          <div className="xp-metric-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function XpEmpty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="xp-empty" role="status">
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  );
}

export function XpChips({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="xp-chiprow" role="group" aria-label={ariaLabel} tabIndex={0}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="xp-chip"
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function XpAvatars({
  initials,
  children,
}: {
  initials: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="xp-avatars">
      <span className="xp-avatar-stack" aria-hidden="true">
        {initials.slice(0, 4).map((initial, index) => (
          <span className="xp-avatar" key={`${initial}-${index}`}>
            {initial}
          </span>
        ))}
      </span>
      <span>{children}</span>
    </div>
  );
}
