import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-[#F5F2EC] pb-24 lg:pb-12 pt-24 lg:pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-48 mb-8" />

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Form */}
          <div className="w-full lg:w-2/3 space-y-8">
            <div className="glass p-6 sm:p-8 space-y-6">
              <Skeleton className="h-8 w-40 mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Skeleton className="h-14 w-full rounded-full" />
                <Skeleton className="h-14 w-full rounded-full" />
                <Skeleton className="h-14 w-full rounded-full col-span-1 sm:col-span-2" />
              </div>
            </div>
            <div className="glass p-6 sm:p-8 space-y-6">
              <Skeleton className="h-8 w-48 mb-6" />
              <Skeleton className="h-14 w-full rounded-full" />
              <Skeleton className="h-14 w-full rounded-full" />
            </div>
          </div>

          {/* Order Summary */}
          <div className="w-full lg:w-1/3">
            <div className="glass p-6 space-y-6">
              <Skeleton className="h-8 w-48" />
              <div className="space-y-4 pt-4 border-t border-white/50">
                <div className="flex gap-4">
                  <Skeleton className="h-16 w-16 rounded-xl flex-shrink-0" />
                  <div className="space-y-2 flex-grow">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
                <div className="pt-4 border-t border-white/50 space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
              <Skeleton className="h-14 w-full rounded-full mt-8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
