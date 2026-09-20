'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type CardVariant = 'standard' | 'interactive' | 'featured' | 'compact';
export type CardTone = 'neutral' | 'sage' | 'warn' | 'danger' | 'info';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  tone?: CardTone;
  as?: 'div' | 'article' | 'section';
  selected?: boolean;
  /** Raccourci a11y : id du titre qui nomme la carte. */
  ariaLabelledBy?: string;
}

const TONE: Record<CardTone, string> = {
  neutral: '',
  sage: 'border-[color:var(--lkv-secondary)]/30 bg-[color:var(--lkv-secondary-subtle)]',
  warn: 'border-[color:var(--lkv-warning)]/40 bg-[color:var(--lkv-warning-bg)]',
  danger: 'border-[color:var(--lkv-danger)]/40 bg-[color:var(--lkv-danger-bg)]',
  info: 'border-[color:var(--lkv-info)]/40 bg-[color:var(--lkv-info-bg)]',
};

const VARIANT: Record<CardVariant, string> = {
  standard:
    'bg-[color:var(--lkv-surface-card)] border border-[color:var(--lkv-border)] rounded-[var(--lkv-radius-card)] p-[var(--space-5)] shadow-[var(--elevation-1)]',
  interactive:
    'bg-[color:var(--lkv-surface-card)] border border-[color:var(--lkv-border)] rounded-[var(--lkv-radius-card)] p-[var(--space-5)] shadow-[var(--elevation-1)] cursor-pointer transition-transform duration-[var(--motion-control-duration)] ease-[var(--motion-ease-standard)] hover:shadow-[var(--elevation-2)] active:scale-[0.99] motion-reduce:transition-none',
  featured:
    'bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] rounded-[var(--lkv-radius-card)] p-[var(--space-5)] shadow-[var(--elevation-3)] backdrop-blur-[var(--blur-lg)]',
  compact:
    'bg-[color:var(--lkv-surface-card)] border border-[color:var(--lkv-border-subtle)] rounded-[var(--lkv-radius-md)] p-[var(--space-3)]',
};

/**
 * Card — primitive canonique (Phase 2, Lot 3).
 * Surfaces calmes et lisibles : le verre n'est pas appliqué par défaut
 * (`featured` seulement). Le contenu détermine la structure interne.
 */
export function Card({
  variant = 'standard',
  tone = 'neutral',
  as: Component = 'div',
  selected = false,
  ariaLabelledBy,
  className,
  children,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  ...props
}: CardProps) {
  const actionable = Boolean(onClick);
  const interactive = variant === 'interactive' || actionable;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (
      !event.defaultPrevented &&
      actionable &&
      event.target === event.currentTarget &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  return (
    <Component
      {...props}
      role={role ?? (actionable ? 'button' : undefined)}
      tabIndex={tabIndex ?? (actionable ? 0 : undefined)}
      aria-pressed={selected || undefined}
      aria-labelledby={ariaLabelledBy}
      data-variant={variant}
      data-tone={tone}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        VARIANT[variant],
        TONE[tone],
        interactive &&
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]',
        selected && 'ring-2 ring-[color:var(--lkv-action)]',
        className
      )}
    >
      {children}
    </Component>
  );
}

export default Card;
