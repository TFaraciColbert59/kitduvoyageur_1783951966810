import React from 'react';
import AppShell from '@/components/shell/AppShell';

export default function LieuxLoading() {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-32 bg-[color:var(--lkv-surface-muted)] rounded-full" />
          <div className="h-8 w-64 bg-[color:var(--lkv-surface-muted)] rounded-2xl" />
          <div className="h-4 w-96 bg-[color:var(--lkv-surface-paper)] rounded-full" />
        </div>

        {/* Filter Bar Skeleton */}
        <div className="h-24 bg-[color:var(--lkv-surface-paper)] rounded-xl border border-[color:var(--glass-border)] p-4 space-y-3">
          <div className="h-10 bg-[color:var(--lkv-surface-muted)] rounded-2xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-7 w-20 bg-[color:var(--lkv-surface-muted)] rounded-full" />
            ))}
          </div>
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl bg-[color:var(--lkv-surface-paper)] border border-[color:var(--glass-border)] p-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-6 w-24 bg-[color:var(--lkv-surface-muted)] rounded-full" />
                  <div className="h-6 w-16 bg-[color:var(--lkv-surface-muted)] rounded-full" />
                </div>
                <div className="h-6 w-48 bg-[color:var(--lkv-surface-muted)] rounded-xl" />
                <div className="h-4 w-32 bg-[color:var(--lkv-surface-paper)] rounded-full" />
                <div className="h-12 w-full bg-[color:var(--lkv-surface-paper)] rounded-xl" />
              </div>
              <div className="h-8 w-full bg-[color:var(--lkv-surface-muted)] rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
