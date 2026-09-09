'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
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
    <GlassCard tone="sage" className="p-3.5 space-y-1.5 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <span aria-hidden="true">📍</span> Prochaine étape
      </span>
      <div className="text-sm font-bold text-[var(--lkv-text-primary)] leading-snug">{next.title}</div>
      <div className="text-[11px] text-[var(--lkv-text-secondary)]">
        Jour {next.day_number}
        {next.transport_mode ? ` · ${next.transport_mode.replace('_', ' ')}` : ''}
        {next.distance_km ? ` · ${String(next.distance_km).replace('.', ',')} km` : ''}
      </div>
    </GlassCard>
  );
}

export default NextStepWidget;
