import React from 'react';
import { Card, Skeleton } from '@/components/ui';

export default function CommunityLoading() {
  return (
    <div className="min-h-screen bg-transparent pb-24 pt-2 md:pb-12 md:pt-24" aria-busy="true" aria-label="Chargement de la communauté…">
      <div className="mx-auto max-w-3xl space-y-[var(--space-3)] px-[var(--space-3)] sm:px-[var(--space-6)]">
        {/* Category switcher pills */}
        <div className="flex gap-[var(--space-2)] overflow-x-hidden pb-[var(--space-1)]">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>

        {/* Community Feed posts */}
        <div className="space-y-[var(--space-3)]">
          {[1, 2, 3].map(i => (
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
              <div className="flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-2)]">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
