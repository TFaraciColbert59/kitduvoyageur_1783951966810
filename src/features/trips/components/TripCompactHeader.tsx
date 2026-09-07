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
        <GlassSubCard className="!p-2 text-center min-w-[70px]">
          <span className="text-[9px] text-[var(--lkv-text-secondary)] block uppercase font-mono">Phase</span>
          <span className="text-xs font-bold text-[var(--lkv-text-primary)] capitalize">
            {getPhaseLabel(activePhase)}
          </span>
        </GlassSubCard>
        {countdown && (
          <GlassSubCard className="!p-2 text-center min-w-[60px]">
            <span className="text-[9px] text-[var(--lkv-text-secondary)] block uppercase font-mono">Depart</span>
            <span className="text-xs font-bold text-[var(--lkv-warning)] font-mono">{countdown}</span>
          </GlassSubCard>
        )}
        {trip.destination_country_code && (
          <GlassSubCard className="!p-2 text-center min-w-[60px]">
            <span className="text-[9px] text-[var(--lkv-text-secondary)] block uppercase font-mono">Pays</span>
            <span className="text-xs font-bold text-[var(--lkv-text-primary)]">
              {trip.destination_country_code}
            </span>
          </GlassSubCard>
        )}
      </div>
    </div>
  );
}
