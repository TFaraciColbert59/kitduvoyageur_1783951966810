'use client';

import React, { useState, useTransition } from 'react';
import { WifiOff, Trash2, Check } from 'lucide-react';
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
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <WifiOff size={13} aria-hidden="true" />
          <h3 className="font-display font-bold text-xs text-[var(--lkv-primary)]">Hors-ligne</h3>
        </div>
        {available && (
          <span className="glass-pill text-[9px] font-bold text-[var(--lkv-success)] flex items-center gap-1">
            <Check size={10} aria-hidden="true" />
            Disponible
          </span>
        )}
      </div>
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
    </div>
  );
}

export default OfflineToggleWidget;
