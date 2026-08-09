import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function ExplorerLoading() {
  return (
    <div className="min-h-screen bg-[#F0EBE1] pb-24 lg:pb-12 pt-24 lg:pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        
        {/* Search & filters skeleton */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full sm:w-48 rounded-2xl flex-shrink-0" />
        </div>

        {/* Map or grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  );
}
