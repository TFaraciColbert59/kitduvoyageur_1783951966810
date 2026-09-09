'use client';

import React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { tripSectionHref } from '../../registry/tripSectionRegistry';
import type { TripFull, TripStats } from '../../types/trip.types';

export interface BudgetBurnWidgetProps {
  trip: TripFull;
  /** total_spent serveur (getTripStats) — même source que la carte budget du menu. */
  stats?: TripStats | null;
}

/**
 * Widget `budget-burn` — dépensé / estimé, par tête si groupe (prepare, recount).
 * §Y_HUB_SPEC §3. Source unique : stats serveur si fournies, sinon somme locale
 * des dépenses (fallback client).
 */
export function BudgetBurnWidget({ trip, stats = null }: BudgetBurnWidgetProps) {
  const spent = stats ? stats.total_spent : (trip.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const estimated = stats && stats.estimated_budget > 0 ? stats.estimated_budget : Number(trip.estimated_budget) || 0;
  const partyCount = Math.max(1, (trip.collaborators?.length ?? 0) + 1);
  const isGroup = (trip.collaborators?.length ?? 0) > 0;

  const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} ${trip.budget_currency || '€'}`;

  return (
    <GlassCard tone="neutral" className="p-3.5 space-y-2 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <span aria-hidden="true">💶</span> Budget
      </span>
      <div className="text-2xl font-extrabold text-[var(--lkv-text-primary)] font-mono">{fmt(spent)}</div>
      <div className="text-[11px] text-[var(--lkv-text-secondary)]">
        {estimated > 0 ? `sur ${fmt(estimated)} estimé` : 'aucun budget estimé'}
        {isGroup ? ` · ${fmt(spent / partyCount)}/pers.` : ''}
      </div>
      {estimated > 0 && (
        <Link
          href={tripSectionHref(trip.slug, 'budget')}
          className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] min-h-[44px] cursor-pointer"
        >
          Voir le budget →
        </Link>
      )}
    </GlassCard>
  );
}

export default BudgetBurnWidget;
