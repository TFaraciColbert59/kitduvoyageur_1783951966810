import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CommunityLoading() {
  return (
    <div className="min-h-screen bg-[#F0EBE1] pb-24 md:pb-12 pt-2 md:pt-24" aria-busy="true" aria-label="Chargement de la communauté…">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 space-y-3">
        {/* Category switcher pills */}
        <div className="flex gap-2 overflow-x-hidden pb-1">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Community Feed posts */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/50 backdrop-blur-md rounded-[1.25rem] p-4 border border-white/60 space-y-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="w-full aspect-[16/9] rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-stone-200/50">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
