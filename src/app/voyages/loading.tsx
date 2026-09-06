import React from 'react';
import AppShell from '@/components/shell/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';

export default function VoyagesLoading() {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="space-y-2">
            <div className="w-28 h-4 bg-black/5 rounded-full animate-pulse" />
            <div className="w-64 h-8 bg-black/10 rounded-xl animate-pulse" />
            <div className="w-96 h-4 bg-black/5 rounded-full animate-pulse" />
          </div>
          <div className="w-40 h-10 bg-black/10 rounded-full animate-pulse" />
        </div>

        {/* Filters Skeleton */}
        <div className="w-full h-16 bg-black/5 rounded-[24px] mb-6 animate-pulse" />

        {/* Cards Grid Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(idx => (
            <GlassCard
              key={idx}
              tone="neutral"
              className="h-80 rounded-[24px] overflow-hidden border border-white/40"
            >
              <div className="w-full h-48 bg-black/10 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="w-3/4 h-5 bg-black/10 rounded-lg animate-pulse" />
                <div className="w-full h-4 bg-black/5 rounded-md animate-pulse" />
                <div className="flex justify-between pt-2 border-t border-black/5">
                  <div className="w-24 h-4 bg-black/5 rounded-full animate-pulse" />
                  <div className="w-16 h-4 bg-black/5 rounded-full animate-pulse" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
