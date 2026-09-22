import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CarnetLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--glass-bg-medium)]">
      <div className="h-16 border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset" />

      <div className="mx-auto max-w-7xl px-[var(--space-4)] py-20 sm:px-[var(--space-8)] lg:px-[var(--space-12)]">
        <Skeleton className="mb-[var(--space-6)] h-6 w-48 rounded-full" />
        <Skeleton className="mb-[var(--space-4)] h-16 w-3/4 rounded-[var(--lkv-radius-2xl)]" />
        <Skeleton className="mb-[var(--space-8)] h-16 w-1/2 rounded-[var(--lkv-radius-2xl)]" />
        <Skeleton className="h-4 w-96 rounded-full" />
      </div>

      <div className="border-y border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset py-[var(--space-8)]">
        <div className="mx-auto grid max-w-7xl grid-cols-3 gap-[var(--space-6)] px-[var(--space-4)] md:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center gap-[var(--space-2)]">
              <Skeleton className="h-8 w-16 rounded-[var(--lkv-radius-xl)]" />
              <Skeleton className="h-3 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
