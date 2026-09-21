'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Switch — primitive canonique de bascule binaire (Phase 2, Lot 6).
 * Rôle `switch`, clavier natif Espace/Entrée, focus visible, cible ≥ 44 px,
 * couleurs/rayon/motion pilotés par les tokens.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  id,
  className,
  'aria-label': ariaLabel,
}: SwitchProps) {
  const generatedId = React.useId();
  const controlId = id ?? `switch-${generatedId}`;
  const labelId = `${controlId}-label`;
  const hasLabel = label !== undefined && label !== null;

  const toggle = () => {
    if (!disabled) onCheckedChange(!checked);
  };

  return (
    <div
      className={cn(
        'flex min-h-[var(--lkv-touch-min)] items-center gap-[var(--space-3)]',
        className
      )}
    >
      {hasLabel && (
        <span
          id={labelId}
          onClick={toggle}
          className={cn(
            'select-none text-[length:var(--lkv-text-body-sm)] font-medium leading-[var(--leading-snug)] text-[color:var(--lkv-text-primary)]',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          )}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        id={controlId}
        role="switch"
        aria-checked={checked}
        aria-label={hasLabel ? undefined : ariaLabel}
        aria-labelledby={hasLabel ? labelId : undefined}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          'relative inline-flex min-h-[var(--lkv-touch-min)] min-w-[var(--lkv-touch-min)] shrink-0 touch-manipulation select-none items-center justify-center rounded-[var(--lkv-radius-full)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]',
          disabled && 'pointer-events-none opacity-[var(--opacity-disabled)]'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-flex h-[28px] w-[48px] items-center rounded-[var(--lkv-radius-full)] border transition-colors duration-[var(--motion-control-duration)] ease-[var(--motion-ease-standard)] motion-reduce:transition-none',
            checked
              ? 'border-transparent bg-[color:var(--lkv-action)]'
              : 'border-[color:var(--lkv-border-strong)] bg-[color:var(--lkv-surface-muted)]'
          )}
        >
          <span
            className={cn(
              'pointer-events-none absolute top-1/2 block h-[22px] w-[22px] -translate-y-1/2 rounded-[var(--lkv-radius-full)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] shadow-elevation-1 transition-transform duration-[var(--motion-control-duration)] ease-[var(--motion-ease-decelerate)] motion-reduce:transition-none',
              checked ? 'translate-x-[24px]' : 'translate-x-[2px]'
            )}
          />
        </span>
      </button>
    </div>
  );
}

export default Switch;
