import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  /** compact = bloc inline (listes, cartes), sinon bloc de page. */
  compact?: boolean;
}

/**
 * LoadingState — langage unique de chargement (Lot 3).
 * Remplace les spinners/placeholders maison : même structure partout.
 */
export function LoadingState({
  label = 'Chargement…',
  compact = false,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      {...props}
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-[var(--space-3)] text-center',
        compact ? 'py-[var(--space-6)]' : 'py-[var(--space-12)]',
        className
      )}
    >
      <Spinner size={compact ? 'md' : 'lg'} label="" />
      {label && (
        <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
          {label}
        </p>
      )}
    </div>
  );
}

export default LoadingState;
