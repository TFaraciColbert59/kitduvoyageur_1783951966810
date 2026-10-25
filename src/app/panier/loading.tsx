import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui';

export default function CartLoading() {
  return (
    <div className="min-h-screen bg-transparent pb-24 pt-24 lg:pb-12 lg:pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="mb-[var(--space-8)] h-10 w-48" />

        <div className="flex flex-col gap-12 lg:flex-row">
          {/* Cart items */}
          <div className="w-full space-y-[var(--space-6)] lg:w-2/3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="flex gap-[var(--space-6)] p-[var(--space-4)]">
                <Skeleton className="h-24 w-24 flex-shrink-0 rounded-[var(--lkv-radius-lg)]" />
                <div className="flex-grow space-y-[var(--space-3)] py-[var(--space-2)]">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-5 w-1/4" />
                </div>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <div className="w-full lg:w-1/3">
            <Card className="space-y-[var(--space-6)] p-[var(--space-6)]">
              <Skeleton className="h-8 w-48" />
              <div className="space-y-[var(--space-4)] border-t border-[color:var(--lkv-border)] pt-[var(--space-4)]">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
              <Skeleton className="mt-[var(--space-8)] h-14 w-full rounded-full" />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
