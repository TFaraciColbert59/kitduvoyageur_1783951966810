'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { TripFull } from '../../types/trip.types';

export interface SafetyNextWidgetProps {
  trip: TripFull;
}

/**
 * Widget `safety-next` — prochain point de contrôle + appel (prepare, live).
 * §Y_HUB_SPEC §3. Non monté si autonomy === 'serviced' (filtre profil).
 */
export function SafetyNextWidget({ trip }: SafetyNextWidgetProps) {
  const { haptic } = useHapticFeedback();
  const checkpoints = (trip.safety_checkpoints || []).filter((c) => c.status === 'pending');

  if (checkpoints.length === 0) return null;

  const next = checkpoints[0];

  const call = () => {
    if (!next.contact_phone) return;
    haptic('light');
    const url = `tel:${next.contact_phone.replace(/[^+\d]/g, '')}`;
    if (typeof window !== 'undefined') window.location.href = url;
  };

  return (
    <GlassCard tone="sage" className="p-3.5 space-y-1.5 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <span aria-hidden="true">🛟</span> Prochain point de contrôle
      </span>
      <div className="text-sm font-bold text-[var(--lkv-text-primary)] leading-snug">{next.label}</div>
      <div className="text-[11px] text-[var(--lkv-text-secondary)]">
        {next.contact_name ? `${next.contact_name} · ` : ''}
        {next.scheduled_at ? new Date(next.scheduled_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
      </div>
      {next.contact_phone && (
        <button
          type="button"
          onClick={call}
          className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--lkv-primary)] hover:underline min-h-[44px] cursor-pointer"
          aria-label={`Appeler ${next.contact_name || 'le contact'}`}
        >
          <span aria-hidden="true">📞</span> Appeler le contact
        </button>
      )}
    </GlassCard>
  );
}

export default SafetyNextWidget;
