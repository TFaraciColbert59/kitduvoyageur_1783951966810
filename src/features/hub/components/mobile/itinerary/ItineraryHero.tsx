'use client';

import { CalendarDays, Plus } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { ItineraryTotals } from '../../../mobile/itineraryEngine';

export interface ItineraryHeroProps {
  title: string;
  daysLeft: number | null;
  daysCount: number;
  totals: ItineraryTotals;
  canEdit: boolean;
  onAddStep: () => void;
  onOpenDays: () => void;
}

/** Hero mobile Itinéraire — totaux, échéance et accès rapides. */
export function ItineraryHero({
  title,
  daysLeft,
  daysCount,
  totals,
  canEdit,
  onAddStep,
  onOpenDays,
}: ItineraryHeroProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <section className="glass relative overflow-hidden rounded-[1.75rem] p-4" aria-label="Itinéraire du voyage">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
            Feuille de route
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-[var(--lkv-text-primary)]">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="glass-pill uppercase tracking-[0.08em]">
            {daysCount} jour{daysCount > 1 ? 's' : ''}
          </span>
          {daysLeft != null && (
            <span className="glass-pill uppercase tracking-[0.08em]">
              {daysLeft >= 0 ? `J-${daysLeft}` : 'En cours'}
            </span>
          )}
        </div>
      </header>

      <ul className="mt-3.5 grid grid-cols-4 gap-2">
        <li className="glass-sub-card rounded-2xl p-2.5 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
            Étapes
          </p>
          <p className="mt-1 font-display text-base font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
            {totals.stepsCount}
          </p>
        </li>
        <li className="glass-sub-card rounded-2xl p-2.5 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
            Distance
          </p>
          <p className="mt-1 font-display text-base font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
            {totals.distanceKm} km
          </p>
        </li>
        <li className="glass-sub-card rounded-2xl p-2.5 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
            D+
          </p>
          <p className="mt-1 font-display text-base font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
            {totals.elevGainM} m
          </p>
        </li>
        <li className="glass-sub-card rounded-2xl p-2.5 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
            D−
          </p>
          <p className="mt-1 font-display text-base font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
            {totals.elevLossM} m
          </p>
        </li>
      </ul>

      <div className="mt-4 flex gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onAddStep();
            }}
            className="glass-capsule-btn primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 !py-3 text-sm font-bold"
          >
            <Plus size={15} aria-hidden="true" />
            Ajouter une étape
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            onOpenDays();
          }}
          className="glass-capsule-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 !py-3 text-sm font-bold"
        >
          <CalendarDays size={15} aria-hidden="true" />
          Gérer les jours
        </button>
      </div>
    </section>
  );
}

export default ItineraryHero;
