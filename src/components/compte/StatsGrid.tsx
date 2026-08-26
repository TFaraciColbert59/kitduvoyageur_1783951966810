'use client';

import React from 'react';
import { UserProfile } from '@/lib/types/profile';

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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="glass rounded-[1.25rem] p-4 flex flex-col justify-between border border-white/50 shadow-xs hover:border-[#5B7F55]/30 transition-all duration-150 cursor-pointer"
        >
          <span className="text-[9px] font-mono font-bold text-[#5A7064] tracking-widest uppercase mb-1.5">
            {item.label}
          </span>
          <div className="space-y-0.5">
            <span className="font-mono font-bold text-xl sm:text-2xl text-[#17402C] block">
              {item.value}
            </span>
            <span className={`text-[11px] font-medium block ${item.positive ? 'text-[#5B7F55]' : 'text-[#5A7064]'}`}>
              {item.sub}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
