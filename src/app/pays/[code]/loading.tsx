import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function CountryLoading() {
  return (
    <div className="min-h-screen bg-[#F5F3EE] pb-24 lg:pb-12">
      {/* Hero skeleton */}
      <div className="h-[50vh] min-h-[400px] bg-white relative">
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
        <div className="absolute inset-0 flex flex-col justify-end p-8">
          <Skeleton className="h-16 w-64 mb-4" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Info row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
        
        {/* Related sections */}
        <div className="space-y-8">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
