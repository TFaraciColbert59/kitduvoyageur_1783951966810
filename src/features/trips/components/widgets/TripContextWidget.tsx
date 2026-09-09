'use client';

import React from 'react';
import { Mountain } from 'lucide-react';
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
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs font-sans">
      <div className="flex items-center gap-1.5">
        <Mountain size={13} aria-hidden="true" />
        <h3 className="font-display font-bold text-xs text-[var(--lkv-primary)]">Contexte</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {maxDPlusM != null && (
          <div>
            <div className="text-base font-extrabold text-[var(--lkv-text-primary)] tabular-nums">{maxDPlusM.toLocaleString('fr-FR')} m</div>
            <div className="text-[10px] font-bold text-[var(--lkv-text-muted)]">D+ max</div>
          </div>
        )}
        {days != null && (
          <div>
            <div className="text-base font-extrabold text-[var(--lkv-text-primary)] tabular-nums">{days} j</div>
            <div className="text-[10px] font-bold text-[var(--lkv-text-muted)]">durée</div>
          </div>
        )}
        {trip.difficulty && (
          <div>
            <div className="text-base font-extrabold text-[var(--lkv-text-primary)] capitalize">{trip.difficulty}</div>
            <div className="text-[10px] font-bold text-[var(--lkv-text-muted)]">difficulté</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TripContextWidget;
