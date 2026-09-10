'use client';

import { Plus } from 'lucide-react';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import type { BudgetSummary } from '@/features/trips/engine/budgetEngine';
import { budgetProgress } from '../../../mobile/budgetEngine';
import { formatEuro } from '../../../mobile/mobileHubEngine';
import { BudgetRing } from './BudgetRing';

export interface BudgetHeroCardProps {
  summary: BudgetSummary;
  isMulti: boolean;
  remaining: number | null;
  onAdd: () => void;
}

function HeroMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/70">
        {label}
      </span>
      <span
        className={`text-sm font-bold tabular-nums ${
          danger ? 'text-[var(--lkv-danger)]' : 'text-[var(--lkv-text-primary)]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function BudgetHeroCard({ summary, isMulti, remaining, onAdd }: BudgetHeroCardProps) {
  const { pct, over, hasTarget } = budgetProgress(summary);

  return (
    <section className="glass relative overflow-hidden rounded-[1.75rem] p-4">
      <header className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Budget du voyage
        </p>
        <span
          className={`glass-pill ${over ? 'pill-danger' : ''} shrink-0 uppercase tracking-[0.08em]`}
        >
          {hasTarget ? (over ? 'Dépassé' : `${pct}% du prévu`) : 'Sans estimation'}
        </span>
      </header>

      <div className="mt-3 flex items-center gap-4">
        <BudgetRing pct={pct} over={over}>
          <NumberStat
            value={Math.round(summary.totalSpent)}
            className="font-display text-2xl font-extrabold leading-none text-[var(--lkv-text-primary)]"
          />
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
            dépensé
          </span>
        </BudgetRing>

        <div className="min-w-0 flex-1 space-y-2">
          <HeroMetric
            label={isMulti ? 'Reste à régler' : 'Reste du budget'}
            value={remaining != null ? formatEuro(remaining) : '—'}
            danger={remaining != null && remaining < 0}
          />
          <HeroMetric label="Prévu à venir" value={formatEuro(summary.plannedTotal)} />
          <HeroMetric
            label="Estimation"
            value={summary.estimatedBudget != null ? formatEuro(summary.estimatedBudget) : '—'}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="glass-capsule-btn primary mt-4 inline-flex w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
      >
        <Plus size={15} aria-hidden="true" />
        Ajouter une dépense
      </button>
    </section>
  );
}

export default BudgetHeroCard;
