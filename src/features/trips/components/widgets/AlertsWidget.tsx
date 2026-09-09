'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import type { TripFull } from '../../types/trip.types';

export interface AlertsWidgetProps {
  trip: TripFull;
}

/**
 * Widget `alerts` — alertes bloquantes (toutes phases). §Y_HUB_SPEC §3.
 * Agrégat des signaux : documents expirant ou expirés.
 */
export function AlertsWidget({ trip }: AlertsWidgetProps) {
  const today = new Date();
  // documents dont la validité expire avant le départ (ou est déjà passée)
  const expiring = (trip.documents || []).filter((d) => {
    if (!d.expires_at) return false;
    const exp = new Date(d.expires_at);
    return exp.getTime() < today.getTime();
  });

  if (expiring.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass p-3.5 space-y-2.5 rounded-2xl border border-[var(--lkv-warning)]/40 shadow-xs font-sans"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TriangleAlert size={13} className="text-[var(--lkv-warning-dark)]" aria-hidden="true" />
          <h3 className="font-display font-bold text-xs text-[var(--lkv-warning-dark)]">Alertes</h3>
        </div>
        <span className="glass-pill pill-warn text-[9px] font-bold tabular-nums">
          {expiring.length}
        </span>
      </div>
      <p className="text-xs text-[var(--lkv-text-primary)]">
        {expiring.length} document{expiring.length > 1 ? 's' : ''} expiré{expiring.length > 1 ? 's' : ''}:{' '}
        {expiring.map((d) => d.title).join(', ')}
      </p>
    </div>
  );
}

export default AlertsWidget;
