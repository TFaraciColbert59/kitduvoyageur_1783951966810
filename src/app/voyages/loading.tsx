import React from 'react';
import { PageLayout } from '@/design';
import { Skeleton, SkeletonCard } from '@/components/ui';

export default function VoyagesLoading() {
  return (
    <PageLayout safeTop={true} hasBottomNav={true}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full rounded-full" />
          </div>
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>

        <Skeleton className="h-16 w-full rounded-[var(--lkv-radius-xl)]" />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <SkeletonCard key={idx} className="h-80 overflow-hidden" />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
