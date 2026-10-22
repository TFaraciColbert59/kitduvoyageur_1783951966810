import React from 'react';
import { Card, Skeleton } from '@/components/ui';

/**
 * Squelette du hub Communauté.
 *
 * Même anatomie que la page chargée : capsule d'identité, carte héro,
 * capsule 48 px des six espaces, puis trois cartes de contenu — pour que le
 * passage squelette → contenu ne produise aucun décalage de mise en page.
 */
export default function CommunityLoading() {
  return (
    <div
      className="lkdv-community-experience lkdv-immersive min-h-screen pb-24 pt-2 md:pb-12 md:pt-24"
      aria-busy="true"
      aria-label="Chargement de la communauté…"
    >
      <div className="lkdv-immersive-veil" aria-hidden="true" />
      <div className="lkdv-immersive-column space-y-[var(--space-3)]">
        {/* Capsule d'identité */}
        <div className="flex items-center justify-between gap-2 pt-[calc(var(--safe-top)+6px)]">
          <Skeleton className="h-[34px] w-40 rounded-full" />
          <div className="flex gap-1">
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="size-11 rounded-full" />
          </div>
        </div>

        {/* Carte héro */}
        <Card className="space-y-[var(--space-3)]">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        </Card>

        {/* Capsule 48 px des six espaces */}
        <Skeleton className="h-12 w-full rounded-full" />

        {/* Cartes de contenu */}
        <div className="space-y-[var(--space-3)]">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="space-y-[var(--space-3)]">
              <div className="flex items-center gap-[var(--space-3)]">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-[var(--space-1)]">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="aspect-[16/9] w-full rounded-[var(--lkv-radius-sm)]" />
              <div className="space-y-[var(--space-1)]">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
