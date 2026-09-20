'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type CardVariant = 'standard' | 'interactive' | 'featured' | 'compact';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  as?: 'div' | 'article' | 'section';
  selected?: boolean;
}

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
  as: Component = 'div',
  selected = false,
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
      data-variant={variant}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        VARIANT[variant],
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
