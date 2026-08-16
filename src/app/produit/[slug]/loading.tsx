import React from 'react';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function ProductLoading() {
  return (
    <div className="min-h-screen bg-[#F0EBE1] pb-24 lg:pb-12 pt-24 lg:pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Image skeleton */}
          <div className="w-full lg:w-1/2">
            <Skeleton className="w-full aspect-square rounded-[0.75rem]" />
            <div className="flex gap-4 mt-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="w-20 h-20 rounded-xl" />)}
            </div>
          </div>
          
          {/* Details skeleton */}
          <div className="w-full lg:w-1/2 space-y-8">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-8 w-24" />
            </div>
            
            <SkeletonText lines={4} />
            
            <div className="space-y-4 pt-8">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
