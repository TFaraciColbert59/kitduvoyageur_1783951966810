import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui';

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-transparent pb-24 pt-24 lg:pb-12 lg:pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="mb-[var(--space-8)] h-10 w-48" />

        <div className="flex flex-col gap-12 lg:flex-row">
          {/* Form */}
          <div className="w-full space-y-[var(--space-8)] lg:w-2/3">
            <Card className="space-y-[var(--space-6)] p-[var(--space-6)] sm:p-[var(--space-8)]">
              <Skeleton className="mb-[var(--space-6)] h-8 w-40" />
              <div className="grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2">
                <Skeleton className="h-14 w-full rounded-full" />
                <Skeleton className="h-14 w-full rounded-full" />
                <Skeleton className="col-span-1 h-14 w-full rounded-full sm:col-span-2" />
              </div>
            </Card>
            <Card className="space-y-[var(--space-6)] p-[var(--space-6)] sm:p-[var(--space-8)]">
              <Skeleton className="mb-[var(--space-6)] h-8 w-48" />
              <Skeleton className="h-14 w-full rounded-full" />
              <Skeleton className="h-14 w-full rounded-full" />
            </Card>
          </div>

          {/* Order Summary */}
          <div className="w-full lg:w-1/3">
            <Card className="space-y-[var(--space-6)] p-[var(--space-6)]">
              <Skeleton className="h-8 w-48" />
              <div className="space-y-[var(--space-4)] border-t border-[color:var(--lkv-border)] pt-[var(--space-4)]">
                <div className="flex gap-[var(--space-4)]">
                  <Skeleton className="h-16 w-16 flex-shrink-0 rounded-[var(--lkv-radius-md)]" />
                  <div className="flex-grow space-y-[var(--space-2)]">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
                <div className="space-y-[var(--space-3)] border-t border-[color:var(--lkv-border)] pt-[var(--space-4)]">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
              <Skeleton className="mt-[var(--space-8)] h-14 w-full rounded-full" />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
