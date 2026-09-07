'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
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
    <GlassCard tone="warn" className="p-3.5 space-y-1.5 rounded-[var(--lkv-radius-card)] border border-[var(--lkv-warning)]/30">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-warning-dark)] flex items-center gap-1.5">
        <span aria-hidden="true">⚠️</span> Alertes
      </span>
      <p className="text-xs text-[var(--lkv-text-primary)]">
        {expiring.length} document{expiring.length > 1 ? 's' : ''} expiré{expiring.length > 1 ? 's' : ''}:{' '}
        {expiring.map((d) => d.title).join(', ')}
      </p>
    </GlassCard>
  );
}

export default AlertsWidget;
