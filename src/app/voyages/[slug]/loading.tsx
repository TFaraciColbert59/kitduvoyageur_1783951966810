import React from 'react';
import AppShell from '@/components/shell/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';

export default function TripDetailLoading() {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6">
        {/* Breadcrumb Skeleton */}
        <div className="w-36 h-4 bg-black/5 rounded-full animate-pulse" />

        {/* Hero Skeleton */}
        <div className="w-full h-80 bg-black/10 rounded-[32px] animate-pulse" />

        {/* Tabs Skeleton */}
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="w-28 h-10 bg-black/5 rounded-full animate-pulse shrink-0" />
          ))}
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <GlassCard key={i} tone="neutral" className="h-28 rounded-[20px] p-4">
              <div className="w-16 h-3 bg-black/5 rounded-full mb-2 animate-pulse" />
              <div className="w-24 h-6 bg-black/10 rounded-lg animate-pulse" />
            </GlassCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
