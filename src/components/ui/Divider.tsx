import React from 'react';
import { cn } from '@/lib/utils';

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerSpacing = 'none' | 'sm' | 'md' | 'lg';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: DividerOrientation;
  spacing?: DividerSpacing;
  /** Bord plus marqué (frontière de section). */
  strong?: boolean;
}

/* Séparateur canonique — remplace les <div className="h-px bg-…"> dispersés. */
const SPACING: Record<DividerOrientation, Record<DividerSpacing, string>> = {
  horizontal: {
    none: '',
    sm: 'my-[var(--space-2)]',
    md: 'my-[var(--space-4)]',
    lg: 'my-[var(--space-6)]',
  },
  vertical: {
    none: '',
    sm: 'mx-[var(--space-2)]',
    md: 'mx-[var(--space-4)]',
    lg: 'mx-[var(--space-6)]',
  },
};

export function Divider({
  orientation = 'horizontal',
  spacing = 'md',
  strong = false,
  className,
  ...props
}: DividerProps) {
  const border = strong ? 'bg-[var(--lkv-border-strong)]' : 'bg-[var(--lkv-border)]';
  return (
    <div
      {...props}
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        border,
        SPACING[orientation][spacing],
        className
      )}
    />
  );
}

export default Divider;
