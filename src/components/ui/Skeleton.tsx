'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-white/10 via-white/25 to-white/10 bg-[length:200%_100%] animate-shimmer rounded-[var(--lkv-radius-md)]',
        className
      )}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'g1 rounded-[var(--lkv-radius-card)] p-5 border border-[color:var(--glass-rim)] shadow-sm space-y-4',
        className
      )}
    >
      <Skeleton className="w-full aspect-[16/10] rounded-[var(--lkv-radius-lg)]" />
      <div className="space-y-2">
        <Skeleton className="w-1/3 h-4" />
        <Skeleton className="w-3/4 h-6" />
        <Skeleton className="w-full h-4" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-[color:var(--glass-rim)]">
        <Skeleton className="w-24 h-8 rounded-full" />
        <Skeleton className="w-16 h-8 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonCarnetCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'g1 rounded-[var(--lkv-radius-card)] p-4 border border-[color:var(--glass-rim)] shadow-sm space-y-3',
        className
      )}
    >
      <Skeleton className="w-full h-48 rounded-[var(--lkv-radius-lg)]" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="w-7 h-7 rounded-full" />
        <Skeleton className="w-28 h-4 rounded-full" />
      </div>
      <Skeleton className="w-4/5 h-5 rounded-full" />
      <Skeleton className="w-full h-3.5 rounded-full" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="w-20 h-6 rounded-full" />
        <Skeleton className="w-14 h-4 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonProductCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'g1 rounded-[var(--lkv-radius-card)] p-4 border border-[color:var(--glass-rim)] shadow-sm space-y-3',
        className
      )}
    >
      <Skeleton className="w-full aspect-square rounded-[var(--lkv-radius-lg)]" />
      <div className="space-y-1.5 pt-1">
        <Skeleton className="w-1/3 h-3 rounded-full" />
        <Skeleton className="w-3/4 h-5 rounded-full" />
        <Skeleton className="w-1/2 h-4 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="w-16 h-5 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonClubCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'g1 rounded-[var(--lkv-radius-card)] p-5 border border-[color:var(--glass-rim)] shadow-sm space-y-4',
        className
      )}
    >
      <div className="flex items-center gap-3.5">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="w-3/4 h-5 rounded-full" />
          <Skeleton className="w-1/2 h-3.5 rounded-full" />
        </div>
      </div>
      <Skeleton className="w-full h-10 rounded-full" />
    </div>
  );
}

export function SkeletonList({ items = 4, className = '' }: { items?: number; className?: string }) {
  return (
    <div
      className={cn(
        'g1 rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-rim)] divide-y divide-[color:var(--glass-rim)] overflow-hidden',
        className
      )}
    >
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="w-1/2 h-4 rounded-full" />
              <Skeleton className="w-1/3 h-3 rounded-full" />
            </div>
          </div>
          <Skeleton className="w-12 h-4 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4 rounded-full', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export default Skeleton;
