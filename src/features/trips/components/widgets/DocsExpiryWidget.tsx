'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { TripFull } from '../../types/trip.types';

export interface DocsExpiryWidgetProps {
  trip: TripFull;
}

/**
 * Widget `docs-expiry` — documents expirant avant le départ (prepare). §Y_HUB_SPEC §3.
 */
export function DocsExpiryWidget({ trip }: DocsExpiryWidgetProps) {
  if (!trip.start_date) return null;
  const start = new Date(`${trip.start_date}T00:00:00`);
  const expiring = (trip.documents || []).filter((d) => {
    if (!d.expires_at) return false;
    const exp = new Date(d.expires_at);
    return exp.getTime() <= start.getTime();
  });

  if (expiring.length === 0) return null;

  return (
    <GlassCard tone="neutral" className="p-3.5 space-y-1.5 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <span aria-hidden="true">🗂️</span> Documents à renouveler
      </span>
      {expiring.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 text-xs text-[var(--lkv-text-primary)]">
          <span className="truncate">{d.title}</span>
          <span className="shrink-0 text-[10px] font-mono text-[var(--lkv-warning-dark)]">
            exp. {d.expires_at ? new Date(d.expires_at).toLocaleDateString('fr-FR') : ''}
          </span>
        </div>
      ))}
    </GlassCard>
  );
}

export default DocsExpiryWidget;
