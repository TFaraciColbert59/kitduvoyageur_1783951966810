import React from 'react';
import { cn } from '@/lib/utils';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerTone = 'primary' | 'accent' | 'danger' | 'inverted' | 'muted' | 'current';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  /** Libellé accessible (role="status"). */
  label?: string;
}

/* Source unique de vérité pour les indicateurs de chargement.
 * Remplace les ~33 spinners artisanaux (`rounded-full animate-spin`). */
const SIZE: Record<SpinnerSize, string> = {
  xs: 'h-[var(--icon-xs)] w-[var(--icon-xs)] border',
  sm: 'h-[var(--icon-sm)] w-[var(--icon-sm)] border-2',
  md: 'h-[var(--icon-md)] w-[var(--icon-md)] border-2',
  lg: 'h-[var(--icon-lg)] w-[var(--icon-lg)] border-2',
  xl: 'h-[var(--icon-xl)] w-[var(--icon-xl)] border-2',
};

const TONE: Record<SpinnerTone, string> = {
  primary: 'border-[color:var(--glass-label)]',
  accent: 'border-[color:var(--glass-label-secondary)]',
  danger: 'border-[color:var(--lkv-danger)]',
  inverted: 'border-[color:var(--lkv-text-inverted)]',
  muted: 'border-[color:var(--lkv-text-muted)]',
  current: 'border-current',
};

export function Spinner({
  size = 'md',
  tone = 'primary',
  label = 'Chargement',
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      {...props}
      role="status"
      aria-label={label}
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-t-transparent motion-reduce:animate-none',
        SIZE[size],
        TONE[tone],
        className
      )}
    />
  );
}

export default Spinner;
