import React from 'react';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function ProductLoading() {
  return (
    <div className="min-h-dvh bg-transparent pb-24 pt-24 lg:pb-12 lg:pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-12 lg:flex-row">
          {/* Image skeleton */}
          <div className="w-full lg:w-1/2">
            <Skeleton className="aspect-square w-full rounded-[var(--lkv-radius-md)]" />
            <div className="mt-[var(--space-4)] flex gap-[var(--space-4)]">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-20 rounded-[var(--lkv-radius-md)]" />)}
            </div>
          </div>
          
          {/* Details skeleton */}
          <div className="w-full space-y-[var(--space-8)] lg:w-1/2">
            <div className="space-y-[var(--space-4)]">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-8 w-24" />
            </div>
            
            <SkeletonText lines={4} />
            
            <div className="space-y-[var(--space-4)] pt-[var(--space-8)]">
              <Skeleton className="h-14 w-full rounded-[var(--lkv-radius-lg)]" />
              <Skeleton className="h-14 w-full rounded-[var(--lkv-radius-lg)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
