import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function ClubsLoading() {
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-12 pt-24 lg:pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto max-w-full" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  );
}
