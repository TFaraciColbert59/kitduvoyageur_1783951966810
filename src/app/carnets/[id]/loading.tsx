import React from 'react';

export default function CarnetLoading() {
  return (
    <div className="min-h-screen bg-[#E7E3D6] animate-pulse">
      {/* Header Skeleton */}
      <div className="h-16 bg-[#1C2620]/5 border-b border-[#1C2620]/10" />

      {/* Hero Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-20">
        <div className="h-6 w-48 bg-[#1C2620]/10 rounded-full mb-6" />
        <div className="h-16 w-3/4 bg-[#1C2620]/10 rounded-2xl mb-4" />
        <div className="h-16 w-1/2 bg-[#1C2620]/10 rounded-2xl mb-8" />
        <div className="h-4 w-96 bg-[#1C2620]/10 rounded-full" />
      </div>

      {/* StatsBar Skeleton */}
      <div className="border-y border-[#1C2620]/10 bg-[#E7E3D6]/50 py-8">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-3 md:grid-cols-6 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-8 w-16 bg-[#1C2620]/10 rounded-xl" />
              <div className="h-3 w-12 bg-[#1C2620]/10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
