'use client';

import React from 'react';
import type { AdventureStreak } from '../../types/reputation.types';

export interface AdventureStreakBannerProps {
  streak: AdventureStreak;
  onPlanNext?: () => void;
  className?: string;
}

export const AdventureStreakBanner: React.FC<AdventureStreakBannerProps> = ({
  streak,
  onPlanNext,
  className = '',
}) => {
  return (
    <aside
      aria-label="Série d aventures collectives en équipe"
      className={`bg-stone-900/90 border border-stone-800 rounded-2xl p-4 text-stone-100 shadow-md ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl select-none">🔥</span>
          <div>
            <div className="text-sm font-bold text-stone-100">
              {streak.currentStreak} sorties en équipe d affilée
            </div>
            <div className="text-xs text-stone-400">
              {streak.isActive
                ? `Plus que ${streak.daysUntilStreakExpires} jours pour maintenir la série`
                : 'Série inactive - planifiez une sortie ensemble'}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Planifier la prochaine sortie"
          onClick={onPlanNext}
          className="min-h-[44px] min-w-[44px] h-[44px] px-4 rounded-xl bg-forest-700 hover:bg-forest-600 text-stone-100 font-medium text-xs flex items-center justify-center transition-colors"
        >
          Planifier
        </button>
      </div>
    </aside>
  );
};
