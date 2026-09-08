'use client';

import React, { useState, useTransition } from 'react';
import { WifiOff, Trash2, Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { saveTripOffline, isTripAvailableOffline, removeOfflineTrip } from '../../offline/tripOfflineStorage';
import type { TripFull } from '../../types/trip.types';

export interface OfflineToggleWidgetProps {
  trip: TripFull;
}

/**
 * Widget `offline-toggle` — ex-`TripOfflineBar` (« Garder hors-ligne »).
 * Le payload stocké est assaini (audit Y0.7/R7 : ni documents, ni dépenses,
 * ni share_token — cf. tripOfflineStorage.saveTripOffline).
 */
export function OfflineToggleWidget({ trip }: OfflineToggleWidgetProps) {
  const [available, setAvailable] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { triggerHaptic } = useHapticFeedback();

  React.useEffect(() => {
    setAvailable(isTripAvailableOffline(trip.slug));
    setMounted(true);
  }, [trip.slug]);

  const toggle = () => {
    triggerHaptic(available ? 'medium' : 'success');
    startTransition(async () => {
      if (available) {
        removeOfflineTrip(trip.slug);
        setAvailable(false);
      } else {
        const ok = saveTripOffline(trip);
        setAvailable(ok);
      }
    });
  };

  return (
    <GlassCard tone="neutral" className="p-3.5 space-y-2 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <WifiOff size={12} />
        Hors-ligne
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={!mounted || isPending}
        aria-pressed={available}
        className={`glass-capsule-btn w-full justify-center min-h-[44px] ${available ? '' : 'primary'}`}
      >
        {available ? <Check size={14} /> : <WifiOff size={14} />}
        <span>
          {available ? 'Disponible hors-ligne' : 'Garder hors-ligne'}
        </span>
      </button>
      {available && (
        <button
          type="button"
          onClick={toggle}
          className="min-h-[44px] px-3 text-[11px] text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
        >
          <Trash2 size={12} />
          <span>Retirer du cache local</span>
        </button>
      )}
    </GlassCard>
  );
}

export default OfflineToggleWidget;
