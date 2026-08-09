import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-[#F0EBE1] pb-24 lg:pb-12 pt-24 lg:pt-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
          <div className="flex items-center gap-6 border-b border-[#F0ECE1] pb-8">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ))}
          </div>
          
          <div className="pt-8">
            <Skeleton className="h-12 w-40 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
