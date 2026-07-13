import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-white/8 rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="topo-card p-4 flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="w-full aspect-square rounded-xl" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex justify-between items-center mt-auto pt-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function KitCardSkeleton() {
  return (
    <div className="topo-card p-5 flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="w-full h-40 rounded-xl" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex justify-between items-center mt-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
    </div>
  );
}

export function CountryCardSkeleton() {
  return (
    <div className="topo-card p-4 flex flex-col gap-2" aria-hidden="true">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
