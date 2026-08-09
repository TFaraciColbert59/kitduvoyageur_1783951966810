import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function BoutiqueLoading() {
  return (
    <div className="min-h-screen bg-[#F0EBE1] pb-24 lg:pb-12 pt-24 lg:pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-5 w-72 mx-auto" />
        </div>
        
        {/* Filters skeleton */}
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />)}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  );
}
