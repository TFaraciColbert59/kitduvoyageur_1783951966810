'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export interface ListItemProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  metadata?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  selected?: boolean;
  disabled?: boolean;
  as?: 'li' | 'div';
}

/**
 * ListItem — pattern canonique des lignes récurrentes (Phase 2, Lot 3).
 * Leading · titre · sous-titre/métadonnées · valeur/action · chevron.
 */
export function ListItem({
  leading,
  title,
  subtitle,
  metadata,
  trailing,
  chevron = false,
  selected = false,
  disabled = false,
  as: Component = 'li',
  className,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  ...props
}: ListItemProps) {
  const actionable = Boolean(onClick) && !disabled;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
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
      aria-disabled={disabled || undefined}
      aria-current={selected || undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex min-h-[var(--control-height-md)] w-full items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] px-[var(--space-3)] py-[var(--space-2)]',
        'text-left transition-colors duration-[var(--motion-press-duration)] ease-[var(--motion-ease-standard)] motion-reduce:transition-none',
        actionable &&
          'cursor-pointer hover:bg-[color:var(--lkv-hover-surface)] active:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]',
        selected && 'bg-[color:var(--lkv-hover-surface)]',
        disabled && 'pointer-events-none opacity-[var(--opacity-disabled)]',
        className
      )}
    >
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[length:var(--lkv-text-body)] font-medium text-[color:var(--lkv-text-primary)]">
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            {subtitle}
          </span>
        )}
      </span>
      {metadata && (
        <span className="shrink-0 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          {metadata}
        </span>
      )}
      {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
      {chevron && (
        <Icon
          name="ChevronRightIcon"
          size={16}
          className="shrink-0 text-[color:var(--lkv-text-muted)]"
        />
      )}
    </Component>
  );
}

export default ListItem;
