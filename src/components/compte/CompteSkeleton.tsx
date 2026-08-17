'use client';

import React from 'react';

export function ProfileHeaderSkeleton() {
  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] animate-pulse">
      <div className="flex items-start gap-4 sm:gap-5">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#F4F1EB]" />
        <div className="flex-1 space-y-2.5 py-1">
          <div className="h-6 bg-[#F4F1EB] rounded-lg w-1/3" />
          <div className="h-4 bg-[#F4F1EB] rounded-md w-1/4" />
          <div className="h-3 bg-[#F4F1EB] rounded-md w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-black/[0.06] space-y-2">
          <div className="w-6 h-6 bg-[#F4F1EB] rounded" />
          <div className="h-5 bg-[#F4F1EB] rounded w-1/2" />
          <div className="h-3 bg-[#F4F1EB] rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-black/[0.06] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#F4F1EB] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-[#F4F1EB] rounded w-2/3" />
            <div className="h-3 bg-[#F4F1EB] rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CarnetsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden border border-black/[0.06]">
          <div className="aspect-[16/9] bg-[#F4F1EB]" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-[#F4F1EB] rounded w-3/4" />
            <div className="h-3 bg-[#F4F1EB] rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VoyagesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-3xl p-5 border border-black/[0.06] space-y-3">
        <div className="h-5 bg-[#F4F1EB] rounded w-1/3" />
        <div className="h-8 bg-[#F4F1EB] rounded w-2/3" />
        <div className="h-4 bg-[#F4F1EB] rounded w-1/2" />
      </div>
    </div>
  );
}

export function EquipmentSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden border border-black/[0.06]">
          <div className="aspect-square bg-[#F4F1EB]" />
          <div className="p-3 space-y-1.5">
            <div className="h-3.5 bg-[#F4F1EB] rounded w-3/4" />
            <div className="h-3 bg-[#F4F1EB] rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
