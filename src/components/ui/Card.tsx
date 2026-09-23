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
  sage: 'border-[color:var(--lkv-secondary)]',
  warn: 'border-[color:var(--lkv-warning)]',
  danger: 'border-[color:var(--lkv-danger)]',
  info: 'border-[color:var(--lkv-info)]',
};

/* Phase 3 — TOUTES les cartes partagent le MÊME verre neutre (aucun aplat). */
const GLASS = 'lkv-glass';

const VARIANT: Record<CardVariant, string> = {
  standard: `${GLASS} rounded-[var(--lkv-radius-card)] p-[var(--space-5)]`,
  interactive: `${GLASS} rounded-[var(--lkv-radius-card)] p-[var(--space-5)] cursor-pointer transition-transform duration-[var(--motion-control-duration)] ease-[var(--motion-ease-standard)] hover:brightness-[1.04] active:scale-[0.99] motion-reduce:transition-none`,
  featured: `${GLASS} rounded-[var(--lkv-radius-card)] p-[var(--space-5)] shadow-[var(--elevation-3)]`,
  compact: `${GLASS} rounded-[var(--lkv-radius-md)] p-[var(--space-3)]`,
};

/**
 * Card — primitive canonique (Phase 2, Lot 3).
 * Phase 3 : toutes les variantes sont du liquid glass ; les tons ne colorent
 * que le liseré. Le contenu détermine la structure interne.
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
        selected && 'ring-2 ring-[color:var(--glass-rim)] shadow-[var(--glass-specular)]',
        className
      )}
    >
      {children}
    </Component>
  );
}

export default Card;
