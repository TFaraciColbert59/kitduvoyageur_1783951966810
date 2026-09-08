'use client';

import React from 'react';
import { TripBadge } from './TripBadge';
import type { TripFull } from '../types/trip.types';
import type { TripPhase } from '../engine/temporalPhaseEngine';

interface TripCompactHeaderProps {
  trip: TripFull;
  activePhase: TripPhase;
  daysUntilStart?: number | null;
}

export function TripCompactHeader({ trip, activePhase: _activePhase, daysUntilStart: _daysUntilStart }: TripCompactHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-[var(--lkv-radius-card)] glass border border-white/60 shadow-sm">
      <div className="min-w-0 flex-1">
        <span className="text-[9.5px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] font-bold block mb-0.5">
          Expedition Outdoor
        </span>
        <h1 className="text-xl font-display font-extrabold text-[var(--lkv-text-primary)] tracking-tight truncate">
          {trip.title}
        </h1>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <TripBadge type="status" value={trip.status} size="sm" />
          <TripBadge type="activity" value={trip.primary_activity} size="sm" />
          <TripBadge type="difficulty" value={trip.difficulty} size="sm" />
        </div>
      </div>
    </div>
  );
}
