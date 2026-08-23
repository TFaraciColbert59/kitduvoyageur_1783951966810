import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function ExplorerLoading() {
  return (
    <div className="h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-[#F0EBE1] pb-16 md:pb-0 pt-1 md:pt-20" aria-busy="true" aria-label="Chargement de la carte et des sentiers…">
      {/* Mobile top floating bar skeleton */}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pt-2 z-10 flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-full shadow-sm" />
        <Skeleton className="h-11 w-11 rounded-full shadow-sm flex-shrink-0" />
      </div>

      {/* Center map view placeholder */}
      <div className="flex-1 w-full relative flex items-center justify-center">
        <div className="text-stone-400/40 animate-pulse flex flex-col items-center gap-2">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
          <span className="text-xs font-medium tracking-wide">Chargement de la cartographie…</span>
        </div>
      </div>

      {/* Bottom trail cards carousel on mobile / grid on desktop */}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-3 z-10">
        <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-hidden">
          <SkeletonCard className="w-[85vw] md:w-auto flex-shrink-0 shadow-md" />
          <SkeletonCard className="hidden md:block shadow-md" />
          <SkeletonCard className="hidden md:block shadow-md" />
        </div>
      </div>
    </div>
  );
}
