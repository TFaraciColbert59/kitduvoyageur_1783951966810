import React from 'react';
import { Skeleton, SkeletonClubCard } from '@/components/ui/Skeleton';

export default function ClubsLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--lkv-surface)] pb-24 pt-24 lg:pb-12 lg:pt-32">
      <div className="mx-auto max-w-7xl space-y-[var(--space-12)] px-[var(--space-4)] sm:px-[var(--space-6)] lg:px-[var(--space-8)]">
        <div className="space-y-[var(--space-4)] text-center">
          <Skeleton className="mx-auto h-12 w-64" />
          <Skeleton className="mx-auto h-6 w-96 max-w-full" />
        </div>

        <div className="grid grid-cols-1 gap-[var(--space-8)] md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonClubCard key={i} />)}
        </div>
      </div>
    </div>
  );
}
