'use client';

import { ArrowRight } from 'lucide-react';
import { Badge, Button, IconButton } from '@/components/ui';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import type { GroupeReadiness } from '../../../mobile/groupeEngine';
import { BudgetRing } from '../budget/BudgetRing';

export interface GroupeReadinessHeroProps {
  readiness: GroupeReadiness;
  daysLeft: number | null;
  memberNames: string[];
  pendingCount: number;
  primaryLabel: string;
  onPrimary: () => void;
  onOpenDetails: () => void;
}

function FactorRow({ label, pct }: { label: string; pct: number }) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <li>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/70">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--lkv-forest-100)]">
        <div
          className="h-full rounded-full bg-[var(--lkv-primary)] transition-[width] duration-700"
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
  );
}

export function GroupeReadinessHero({
  readiness,
  daysLeft,
  memberNames,
  pendingCount,
  primaryLabel,
  onPrimary,
  onOpenDetails,
}: GroupeReadinessHeroProps) {
  return (
    <section className="glass relative overflow-hidden rounded-[var(--lkv-radius-card)] p-4" aria-label="Préparation du groupe">
      <header className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Préparation du groupe
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {pendingCount > 0 && (
            <Badge tone="info" className="uppercase tracking-[0.08em]">
              {pendingCount} en attente
            </Badge>
          )}
          {daysLeft != null && (
            <Badge tone="stone" className="uppercase tracking-[0.08em]">
              {daysLeft >= 0 ? `J-${daysLeft}` : 'En cours'}
            </Badge>
          )}
        </div>
      </header>

      <div className="mt-3 flex items-center gap-4">
        <IconButton
          variant="glass"
          onClick={onOpenDetails}
          aria-label={`Détail de la préparation — ${readiness.pct}% prêt`}
          className="relative shrink-0"
        >
          <BudgetRing pct={readiness.pct}>
            <NumberStat
              value={readiness.pct}
              className="font-display text-2xl font-extrabold leading-none text-[var(--lkv-text-primary)]"
            />
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
              prêt
            </span>
            </BudgetRing>
        </IconButton>

        <ul className="min-w-0 flex-1 space-y-2.5">
          <FactorRow label="Tâches" pct={readiness.factors.tasks} />
          <FactorRow label="Équipement" pct={readiness.factors.kit} />
          <FactorRow label="Règlements" pct={readiness.factors.budget} />
        </ul>
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <div className="flex -space-x-2" aria-hidden="true">
          {memberNames.slice(0, 4).map((name, index) => (
            <span
              key={`${name}-${index}`}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[10px] font-bold uppercase text-[var(--lkv-primary)] ring-2 ring-white"
            >
              {name.slice(0, 1)}
            </span>
          ))}
          {memberNames.length > 4 && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lkv-primary)] text-[10px] font-bold text-white ring-2 ring-white">
              +{memberNames.length - 4}
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium text-[var(--lkv-text-primary)]/70">
          {memberNames.length} membre{memberNames.length > 1 ? 's' : ''} actif{memberNames.length > 1 ? 's' : ''}
        </p>
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={onPrimary}
        icon={<ArrowRight size={15} aria-hidden="true" />}
        iconPosition="trailing"
        className="mt-4 !py-3 text-sm font-bold"
      >
        {primaryLabel}
      </Button>
    </section>
  );
}

export default GroupeReadinessHero;
