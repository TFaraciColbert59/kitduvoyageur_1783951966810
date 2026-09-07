'use client';

import React from 'react';
import { GlassSubCard, GlassPill } from '@/components/ui';
import { getPhaseLabel, type TripPhase } from '@/features/trips/engine/temporalPhaseEngine';
import { TripBadge } from './TripBadge';
import type { TripFull } from '../types/trip.types';

interface TripCompactHeaderProps {
  trip: TripFull;
  activePhase: TripPhase;
  daysUntilStart?: number | null;
}

export function TripCompactHeader({ trip, activePhase, daysUntilStart }: TripCompactHeaderProps) {
  const countdown =
    daysUntilStart !== null && daysUntilStart !== undefined && daysUntilStart > 0
      ? `J-${daysUntilStart}`
      : daysUntilStart === 0
      ? "Aujourd'hui"
      : null;

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-[var(--lkv-radius-card)] glass border border-white/60 shadow-[var(--elevation-1)]">
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
      <div className="flex items-center gap-2 shrink-0">
        <div className="glass-sub-card flex items-center divide-x divide-white/50 px-3.5 py-1.5 rounded-[var(--lkv-radius-md)] border border-white/60 shadow-2xs">
          <div className="pr-3 text-center">
            <span className="text-[8.5px] text-[var(--lkv-text-secondary)] block uppercase font-mono tracking-wider font-medium">Phase</span>
            <span className="text-xs font-bold text-[var(--lkv-text-primary)] capitalize">
              {getPhaseLabel(activePhase)}
            </span>
          </div>
          {countdown && (
            <div className="px-3 text-center">
              <span className="text-[8.5px] text-[var(--lkv-text-secondary)] block uppercase font-mono tracking-wider font-medium">Départ</span>
              <span className="text-xs font-bold text-[var(--lkv-warning)] font-mono">{countdown}</span>
            </div>
          )}
          {trip.destination_country_code && (
            <div className="pl-3 text-center">
              <span className="text-[8.5px] text-[var(--lkv-text-secondary)] block uppercase font-mono tracking-wider font-medium">Pays</span>
              <span className="text-xs font-bold text-[var(--lkv-text-primary)] font-mono">
                {trip.destination_country_code}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
