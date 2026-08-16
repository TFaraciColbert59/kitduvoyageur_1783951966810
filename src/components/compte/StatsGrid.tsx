'use client';

import React from 'react';
import { UserProfile } from '@/lib/mock/compte-marceline';

interface StatsGridProps {
  stats: UserProfile['stats'];
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const items = [
    {
      label: 'DISTANCE 2026',
      value: stats.distance_2026.value,
      sub: stats.distance_2026.diff,
      positive: true,
    },
    {
      label: 'DÉNIVELÉ CUMULÉ',
      value: stats.elevation_gain.value,
      sub: stats.elevation_gain.detail,
    },
    {
      label: 'NUITS EN REFUGE',
      value: stats.refuge_nights.value,
      sub: stats.refuge_nights.detail,
    },
    {
      label: 'CO₂ ÉCONOMISÉ',
      value: stats.co2_saved.value,
      sub: stats.co2_saved.detail,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-[0.75rem] p-5 border border-[#1C2620]/5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer"
        >
          <span className="text-[10px] font-mono font-bold text-[#1C2620]/50 tracking-widest uppercase mb-2">
            {item.label}
          </span>
          <div className="space-y-1">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-[#1C2620] block">
              {item.value}
            </span>
            <span className={`text-xs font-semibold block ${item.positive ? 'text-emerald-600' : 'text-[#1C2620]/60'}`}>
              {item.sub}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
