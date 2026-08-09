import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CartLoading() {
  return (
    <div className="min-h-screen bg-[#F0EBE1] pb-24 lg:pb-12 pt-24 lg:pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-48 mb-8" />
        
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Cart items */}
          <div className="w-full lg:w-2/3 space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 flex gap-6">
                <Skeleton className="h-24 w-24 rounded-xl flex-shrink-0" />
                <div className="flex-grow space-y-3 py-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-5 w-1/4" />
                </div>
              </div>
            ))}
          </div>
          
          {/* Summary */}
          <div className="w-full lg:w-1/3">
            <div className="bg-white rounded-3xl p-6 space-y-6 sticky top-32">
              <Skeleton className="h-8 w-48" />
              <div className="space-y-4 pt-4 border-t border-[#F0ECE1]">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
              <Skeleton className="h-14 w-full rounded-xl mt-8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
