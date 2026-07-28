'use client';

import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-gradient-to-r from-[#E8E5DC] via-[#FAF8F5] to-[#E8E5DC] bg-[length:200%_100%] animate-shimmer rounded-xl ${className}`}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-3xl p-5 border border-[#E8E4D8] space-y-4 shadow-sm ${className}`}>
      <Skeleton className="w-full aspect-[16/10] rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="w-1/3 h-4" />
        <Skeleton className="w-3/4 h-6" />
        <Skeleton className="w-full h-4" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-[#F0ECE1]">
        <Skeleton className="w-24 h-8 rounded-full" />
        <Skeleton className="w-16 h-8 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}
