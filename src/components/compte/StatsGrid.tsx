'use client';

import React from 'react';
import { Card } from '@/components/ui';
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
        <Card
          key={item.label}
          variant="compact"
          className="p-4 flex flex-col justify-between hover:border-[color:var(--lkv-secondary)]/30 transition-all duration-150"
        >
          <span className="text-[9px] font-mono font-bold text-[color:var(--lkv-text-muted)] tracking-widest uppercase mb-1.5">
            {item.label}
          </span>
          <div className="space-y-0.5">
            <span className="font-mono font-bold text-xl sm:text-2xl text-[color:var(--lkv-primary)] block">
              {item.value}
            </span>
            <span className={`text-[11px] font-medium block ${item.positive ? 'text-[color:var(--lkv-secondary)]' : 'text-[color:var(--lkv-text-muted)]'}`}>
              {item.sub}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
