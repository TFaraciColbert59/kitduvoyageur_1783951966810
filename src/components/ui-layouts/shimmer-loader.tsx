'use client';

// UI Layouts (MIT) — adaptation LKDV du principe shimmer-loader :
// ici un squelette de chargement générique (barres lumineuses) pour le Hub.
import { cn } from '@/lib/utils';

export interface ShimmerBlockProps {
  className?: string;
  /** Hauteur de la barre (défaut h-4). */
  h?: string;
}

/** Une barre de squelette scintillante. */
export function ShimmerBlock({ className, h = 'h-4' }: ShimmerBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-full bg-[var(--lkv-surface-muted)]',
        h,
        className
      )}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent"
        style={{ willChange: 'transform' }}
      />
    </div>
  );
}

export interface ShimmerLoaderProps {
  className?: string;
  /** Composer une liste de lignes (largeurs arbitraires autorisées). */
  rows?: number;
  /** Rendu custom — voir usage dans hub/loading. */
  children?: React.ReactNode;
}

/** Squelette shimmer générique : pastille + lignes, ou contenu custom. */
export function ShimmerLoader({ className, rows = 3, children }: ShimmerLoaderProps) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
      {children ??
        (Array.from({ length: rows }).map((_, i) => (
          <ShimmerBlock key={i} className={i === 0 ? 'w-3/4' : i === rows - 1 ? 'w-1/2' : 'w-full'} />
        )))}
    </div>
  );
}

export default ShimmerLoader;
