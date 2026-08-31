import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-[#F5F2EC] pb-24 md:pb-12 pt-2 md:pt-24" aria-busy="true" aria-label="Chargement du compte…">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Mobile profile card */}
        <div className="bg-white/40 backdrop-blur-md rounded-[1.25rem] p-5 border border-white/60  space-y-4">
          <div className="flex items-center gap-4 border-b border-[#F0ECE1] pb-4">
            <Skeleton className="h-16 w-16 md:h-20 md:w-20 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-3 rounded-xl bg-white/50 space-y-1.5">
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-6 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Section tabs placeholder */}
        <div className="flex gap-2 overflow-x-hidden">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-9 w-28 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Content list placeholder */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-xl bg-white/40 border border-white/50 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
