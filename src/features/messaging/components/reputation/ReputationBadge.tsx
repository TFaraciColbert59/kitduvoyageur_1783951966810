'use client';

import React from 'react';
import type { ReputationTier } from '../../types/reputation.types';

export interface ReputationBadgeProps {
  tier: ReputationTier;
  points: number;
  className?: string;
}

export const ReputationBadge: React.FC<ReputationBadgeProps> = ({
  tier,
  points,
  className = '',
}) => {
  return (
    <div
      aria-label={`Réputation: ${tier}, ${points} points`}
      role="status"
      className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-stone-900/80 border border-stone-700/60 text-stone-100 backdrop-blur-md shadow-sm ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-forest-400 animate-pulse" />
      <span className="text-xs font-semibold tracking-wide text-stone-200">{tier}</span>
      <span className="text-xs text-stone-400 font-mono">•</span>
      <span className="text-xs font-bold font-mono text-forest-400">{points} pts</span>
    </div>
  );
};
