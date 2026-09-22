'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type ChipTone = 'neutral' | 'sage' | 'info' | 'warn' | 'danger';

export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  tone?: ChipTone;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/* Phase 3 — « rien de plein » : les tons colorent le TEXTE, jamais un aplat. */
const TONE: Record<ChipTone, string> = {
  neutral: 'text-[color:var(--lkv-text-primary)]',
  sage: 'text-[color:var(--lkv-success)]',
  info: 'text-[color:var(--lkv-info)]',
  warn: 'text-[color:var(--lkv-warning-dark)]',
  danger: 'text-[color:var(--lkv-danger-dark)]',
};

/**
 * Chip — pilule canonique de sélection, filtre ou action compacte (Phase 2, Lot 6).
 * Cible ≥ 32 px ; 44 px pour une action isolée sans état de sélection.
 */
export function Chip({
  selected,
  onClick,
  icon,
  tone = 'neutral',
  disabled = false,
  children,
  className,
}: ChipProps) {
  const interactive = typeof onClick === 'function';
  const selectable = interactive && selected !== undefined;
  const actionOnly = interactive && !selectable;

  const classes = cn(
    'inline-flex touch-manipulation select-none items-center justify-center gap-[6px] rounded-full border px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-medium transition-colors',
    actionOnly ? 'min-h-[var(--lkv-touch-min)]' : 'min-h-[var(--control-height-xs)]',
    interactive &&
      'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] motion-reduce:transition-none',
    interactive &&
      !disabled &&
      'active:scale-[var(--motion-press-scale)] motion-reduce:active:scale-100',
    disabled && 'pointer-events-none opacity-[var(--opacity-disabled)]',
    'border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] shadow-[var(--btn-rim)]',
    selected
      ? 'bg-[color:var(--btn-tint-action)] font-bold text-[color:var(--lkv-action)]'
      : cn('bg-[color:var(--btn-tint)]', TONE[tone]),
    className
  );

  const content = (
    <>
      {icon && (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center">
          {icon}
        </span>
      )}
      {children}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        {...(selectable ? { 'aria-pressed': selected } : {})}
        disabled={disabled}
        onClick={onClick}
        className={classes}
      >
        {content}
      </button>
    );
  }

  return <span className={classes}>{content}</span>;
}

export default Chip;
