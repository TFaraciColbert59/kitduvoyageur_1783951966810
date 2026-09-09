'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { TripFull } from '../../types/trip.types';

export interface TripContextWidgetProps {
  trip: TripFull;
  /** D+ maximal dérivé des étapes (Math.max des elevation_gain_m — m). */
  maxDPlusM?: number;
}

/**
 * Widget `trip-context` — D+ max, durée, difficulté (prepare). §Y_HUB_SPEC §3.
 * Non monté pour scale=day ni activité cultural (filtre profil).
 */
export function TripContextWidget({ trip, maxDPlusM }: TripContextWidgetProps) {
  const days = trip.start_date && trip.end_date
    ? Math.max(1, Math.round((new Date(`${trip.end_date}T00:00:00`).getTime() - new Date(`${trip.start_date}T00:00:00`).getTime()) / 86400000) + 1)
    : null;

  return (
    <GlassCard tone="neutral" className="p-3.5 space-y-1.5 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <span aria-hidden="true">⛰️</span> Contexte
      </span>
      <div className="grid grid-cols-3 gap-2 text-center">
        {maxDPlusM != null && (
          <div>
            <div className="text-base font-extrabold text-[var(--lkv-text-primary)] font-mono">{maxDPlusM.toLocaleString('fr-FR')} m</div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--lkv-text-muted)]">D+ MAX</div>
          </div>
        )}
        {days != null && (
          <div>
            <div className="text-base font-extrabold text-[var(--lkv-text-primary)] font-mono">{days} j</div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--lkv-text-muted)]">durée</div>
          </div>
        )}
        {trip.difficulty && (
          <div>
            <div className="text-base font-extrabold text-[var(--lkv-text-primary)] capitalize">{trip.difficulty}</div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--lkv-text-muted)]">difficulté</div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default TripContextWidget;
