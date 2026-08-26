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
    <div className={`bg-white rounded-[0.75rem] p-5 border border-[#E8E4D8] space-y-4  ${className}`}>
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

export function SkeletonCarnetCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#FBFAF6] rounded-2xl p-4 border border-[#17402C]/10 space-y-3  ${className}`}>
      <Skeleton className="w-full h-48 rounded-xl" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="w-7 h-7 rounded-full" />
        <Skeleton className="w-28 h-4 rounded" />
      </div>
      <Skeleton className="w-4/5 h-5 rounded" />
      <Skeleton className="w-full h-3.5 rounded" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="w-20 h-6 rounded-full" />
        <Skeleton className="w-14 h-4 rounded" />
      </div>
    </div>
  );
}

export function SkeletonProductCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#FBFAF6] rounded-2xl p-4 border border-[#17402C]/10 space-y-3  ${className}`}>
      <Skeleton className="w-full aspect-square rounded-xl" />
      <div className="space-y-1.5 pt-1">
        <Skeleton className="w-1/3 h-3 rounded" />
        <Skeleton className="w-3/4 h-5 rounded" />
        <Skeleton className="w-1/2 h-4 rounded" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="w-16 h-5 rounded" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonClubCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#FBFAF6] rounded-2xl p-5 border border-[#17402C]/10 space-y-4  ${className}`}>
      <div className="flex items-center gap-3.5">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="w-3/4 h-5 rounded" />
          <Skeleton className="w-1/2 h-3.5 rounded" />
        </div>
      </div>
      <Skeleton className="w-full h-10 rounded-xl" />
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
