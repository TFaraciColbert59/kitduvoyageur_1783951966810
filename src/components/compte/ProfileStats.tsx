'use client';

import React from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CompteUserProfile } from '@/lib/supabase/queries-compte';

interface ProfileStatsProps {
  stats: CompteUserProfile['stats'] | undefined;
  onStatClick?: (target: 'voyages' | 'carnets' | 'groupes' | 'clubs') => void;
  className?: string;
}

export default function ProfileStats({
  stats,
  onStatClick,
  className = '',
}: ProfileStatsProps) {
  const { triggerHaptic } = useHapticFeedback();

  const statItems = [
    {
      key: 'voyages' as const,
      label: 'Voyages',
      value: stats?.sorties ?? 0,
      icon: '🏔️',
      sub: stats?.km_this_year ? `${stats.km_this_year} km` : '0 km',
    },
    {
      key: 'carnets' as const,
      label: 'Carnets',
      value: stats?.carnets ?? 0,
      icon: '📖',
      sub: 'Récits',
    },
    {
      key: 'groupes' as const,
      label: 'Groupes',
      value: stats?.clubs ?? 0,
      icon: '👥',
      sub: 'Expéditions',
    },
    {
      key: 'clubs' as const,
      label: 'Clubs',
      value: stats?.clubs ?? 0,
      icon: '🏕️',
      sub: 'Rejoints',
    },
  ];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 ${className}`}>
      {statItems.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            triggerHaptic('selection');
            onStatClick?.(item.key);
          }}
          className="bg-white rounded-2xl p-3 sm:p-4 border border-black/[0.06] hover:border-[#17402C]/30 shadow-2xs text-left transition-all active:scale-[0.98] group flex flex-col justify-between gap-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-base sm:text-lg">{item.icon}</span>
            <span className="text-[10px] font-mono text-[#5A7064] group-hover:text-[#17402C] transition-colors">
              {item.sub}
            </span>
          </div>

          <div className="mt-1">
            <p className="text-lg sm:text-xl font-bold font-mono text-[#17402C] group-hover:text-[#17402C] transition-colors">
              {item.value}
            </p>
            <p className="text-xs font-semibold text-[#5A7064]">
              {item.label}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
