'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { TripFull } from '../../types/trip.types';

export interface KitBalanceWidgetProps {
  trip: TripFull;
}

/**
 * Widget `kit-balance` — bilan du sac : poids total, emballés, %.
 * Données dérivées de trip.items (prepare). §Y_HUB_SPEC §3.
 */
export function KitBalanceWidget({ trip }: KitBalanceWidgetProps) {
  const items = trip.items || [];
  const totalWeightG = items.reduce((sum, i) => sum + (Number(i.weight_grams) || 0) * (Number(i.quantity) || 1), 0);
  const packedCount = items.filter((i) => i.is_packed).length;
  const percent = items.length > 0 ? Math.round((packedCount / items.length) * 100) : 0;

  return (
    <GlassCard tone="neutral" className="p-3.5 space-y-2 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <span aria-hidden="true">🎒</span> Bilan du sac
      </span>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--lkv-text-muted)]">
          Aucun objet dans ce voyage. Ajoutez des objects à la section Équipement.
        </p>
      ) : (
        <>
          <div className="text-2xl font-extrabold text-[var(--lkv-text-primary)] font-mono">
            {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1).replace('.', ',')} kg` : `${totalWeightG} g`}
          </div>
          <div className="text-[11px] text-[var(--lkv-text-secondary)]">
            {packedCount}/{items.length} objets emballés
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--lkv-success-bg)] overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de l'emballage">
            <div className="h-full rounded-full bg-[var(--lkv-secondary)] transition-all" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
    </GlassCard>
  );
}

export default KitBalanceWidget;
