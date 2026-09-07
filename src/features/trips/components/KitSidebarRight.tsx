'use client';
import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Scale, Package, CheckCircle2 } from 'lucide-react';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';
import { getKitCounters } from '@/features/trips/hooks/useKitCounters';
import { getTripDuration } from '@/features/trips/hooks/useTripDuration';

interface KitSidebarRightProps {
  trip: TripFull;
  analysis: TripKitAnalysis;
}

export default function KitSidebarRight({ trip, analysis }: KitSidebarRightProps) {
  const kit = getKitCounters(trip.items);
  const duration = getTripDuration(trip);
  const packedPercent = kit.total > 0 ? Math.round((kit.ready / kit.total) * 100) : 0;
  const totalWeightKg = analysis.totalWeightGrams ? (analysis.totalWeightGrams / 1000).toFixed(1) : '0.0';

  return (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans">
      <GlassCard className="p-3.5 space-y-2.5 text-[var(--lkv-text-primary)]">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
          <Scale size={13} />
          <span>Bilan du Sac</span>
        </span>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-[var(--lkv-text-secondary)]"><Package size={12} />Total objets</span>
            <span className="font-mono font-semibold">{kit.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-[var(--lkv-text-secondary)]"><CheckCircle2 size={12} />Emballes</span>
            <span className="font-mono font-semibold">{kit.ready} ({packedPercent}%)</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-[var(--lkv-text-secondary)]"><Scale size={12} />Poids total</span>
            <span className="font-mono font-semibold">{totalWeightKg} kg</span>
          </div>
        </div>
        <div className="w-full bg-[var(--lkv-border-subtle)] rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-[var(--lkv-primary)] h-full rounded-full transition-all duration-300"
            style={{ width: `${packedPercent}%` }}
          />
        </div>
      </GlassCard>
      <GlassCard className="p-3.5 text-xs text-[var(--lkv-text-primary)] space-y-1.5">
        <p className="font-bold text-[var(--lkv-text-secondary)] uppercase tracking-wider text-[9px] font-mono">Contexte expedition</p>
        <div className="space-y-1 text-[var(--lkv-text-primary)]">
          <div className="flex justify-between"><span className="text-[var(--lkv-text-secondary)]">Altitude max</span><span className="font-mono font-semibold">{analysis.maxAltitudeM}m</span></div>
          <div className="flex justify-between"><span className="text-[var(--lkv-text-secondary)]">Duree</span><span className="font-mono font-semibold">{duration.durationDays}j</span></div>
        </div>
      </GlassCard>
    </aside>
  );
}