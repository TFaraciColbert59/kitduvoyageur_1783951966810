'use client';

import React from 'react';
import { LifeBuoy } from 'lucide-react';
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
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs font-sans">
      <div className="flex items-center gap-1.5">
        <LifeBuoy size={13} aria-hidden="true" />
        <h3 className="font-display font-bold text-xs text-[var(--lkv-primary)]">Prochain point de contrôle</h3>
      </div>
      <div className="text-sm font-bold text-[var(--lkv-text-primary)] leading-snug">{next.label}</div>
      <div className="text-[11px] text-[var(--lkv-text-secondary)] tabular-nums">
        {next.contact_name ? `${next.contact_name} · ` : ''}
        {next.scheduled_at ? new Date(next.scheduled_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
      </div>
      {next.contact_phone && (
        <button
          type="button"
          onClick={call}
          className="glass-pill min-h-[44px] px-4 text-[11px] font-bold text-[var(--lkv-primary)] hover:bg-white/70 transition-colors cursor-pointer flex items-center gap-1.5"
          aria-label={`Appeler ${next.contact_name || 'le contact'}`}
        >
          <LifeBuoy size={12} aria-hidden="true" /> Appeler le contact
        </button>
      )}
    </div>
  );
}

export default SafetyNextWidget;
