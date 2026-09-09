'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import type { TripFull } from '../../types/trip.types';

export interface NextStepWidgetProps {
  trip: TripFull;
}

/**
 * Widget `next-step` — prochaine étape (live). §Y_HUB_SPEC §3.
 */
export function NextStepWidget({ trip }: NextStepWidgetProps) {
  const steps = (trip.steps || []).filter((s) => s.day_number > 0);
  const ordered = [...steps].sort((a, b) => a.day_number - b.day_number || a.order_index - b.order_index);
  const next = ordered.find((s) => !s.id.endsWith('-done')) ?? ordered[0];
  if (!next) return null;

  return (
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin size={13} aria-hidden="true" />
          <h3 className="font-display font-bold text-xs text-[var(--lkv-primary)]">Prochaine étape</h3>
        </div>
        <span className="glass-pill text-[9px] font-bold text-[var(--lkv-text-primary)] tabular-nums">
          J{next.day_number}
        </span>
      </div>
      <div className="text-sm font-bold text-[var(--lkv-text-primary)] leading-snug">{next.title}</div>
      <div className="text-[11px] text-[var(--lkv-text-secondary)] tabular-nums">
        {next.transport_mode ? next.transport_mode.replace('_', ' ') : ''}
        {next.distance_km
          ? `${next.transport_mode ? ' · ' : ''}${String(next.distance_km).replace('.', ',')} km`
          : ''}
      </div>
    </div>
  );
}

export default NextStepWidget;
