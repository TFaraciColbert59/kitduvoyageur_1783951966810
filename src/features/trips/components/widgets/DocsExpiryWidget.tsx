'use client';

import React from 'react';
import { FileText } from 'lucide-react';
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
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs font-sans">
      <div className="flex items-center gap-1.5">
        <FileText size={13} aria-hidden="true" />
        <h3 className="font-display font-bold text-xs text-[var(--lkv-primary)]">Documents à renouveler</h3>
      </div>
      <div className="space-y-1.5">
        {expiring.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 text-xs text-[var(--lkv-text-primary)]">
            <span className="truncate">{d.title}</span>
            <span className="glass-pill pill-warn text-[9px] font-bold shrink-0 tabular-nums">
              exp. {d.expires_at ? new Date(d.expires_at).toLocaleDateString('fr-FR') : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DocsExpiryWidget;
