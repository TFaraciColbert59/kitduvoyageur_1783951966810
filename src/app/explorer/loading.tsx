import React from 'react';
import { Skeleton, Spinner } from '@/components/ui';

/**
 * ExplorerLoading — squelette plein écran de la carte (aucun spinner artisanal).
 */
export default function ExplorerLoading() {
  return (
    <div
      className="fixed inset-0 bg-[color:var(--glass-bg-medium)]"
      aria-busy="true"
      aria-label="Chargement de l'espace Aventures…"
    >
      {/* Map skeleton */}
      <div className="absolute inset-0 animate-pulse bg-[color:var(--glass-bg-medium)]" />

      {/* Header skeleton */}
      <div className="absolute left-3 right-3 top-[calc(var(--safe-top)+12px)] z-[var(--z-sticky)] h-12">
        <Skeleton className="h-12 w-full rounded-[var(--lkv-radius-lg)]" />
      </div>

      {/* ── DESKTOP : panneau de liste latéral gauche ── */}
      <div className="absolute left-3 bottom-3 top-[60px] z-[var(--z-fab)] hidden w-[360px] flex-col gap-[var(--space-2)] md:flex">
        <Skeleton className="h-10 w-full rounded-[var(--lkv-radius-md)]" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-[var(--lkv-radius-md)]" />
        ))}
      </div>

      {/* ── MOBILE : bottom sheet skeleton au-dessus de la bottom bar ── */}
      <div
        className="absolute left-2.5 right-2.5 bottom-[calc(var(--nav-offset)+8px)] z-[var(--z-fab)] flex h-[30vh] flex-col gap-[var(--space-2)] md:hidden"
      >
        <Skeleton className="mx-auto h-1.5 w-10 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-[78px] w-full rounded-[var(--lkv-radius-md)]" />
      </div>

      {/* Spinner */}
      <div className="absolute bottom-8 right-8 flex flex-col items-center gap-[var(--space-2)]">
        <Spinner size="md" label="Chargement…" />
        <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
          Chargement…
        </span>
      </div>
    </div>
  );
}
