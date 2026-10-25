import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone';

export interface BadgeProps {
  tone?: BadgeTone;
  children?: React.ReactNode;
  className?: string;
  /** Teinte dynamique (catégories carte) — prioritaire sur `tone`. */
  style?: React.CSSProperties;
}

const TONE: Record<BadgeTone, string> = {
  sage: 'bg-[color:var(--lkv-success-bg)] text-[color:var(--lkv-text-primary)]',
  warn: 'bg-[color:var(--lkv-warning-bg)] text-[color:var(--lkv-warning-dark)]',
  danger: 'bg-[color:var(--lkv-danger-bg)] text-[color:var(--lkv-danger-dark)]',
  info: 'bg-[color:var(--lkv-info-bg)] text-[color:var(--lkv-info)]',
  stone: 'bg-[color:var(--lkv-surface-muted)] text-[color:var(--lkv-text-primary)]',
};

/**
 * Badge — primitive canonique d'information et de statut (Phase 2, Lot 6).
 * Non interactive : pour un filtre ou une sélection, utiliser `Chip`.
 */
export function Badge({ tone = 'stone', children, className, style }: BadgeProps) {
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--lkv-border)] px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium',
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
