'use client';

import { DepartWeightBreakdown } from '@/features/materiel/components/depart/DepartWeightBreakdown';
import { DepartChecklist } from '@/features/materiel/components/depart/DepartChecklist';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

export interface DepartSacSectionProps {
  depart: DepartDetail;
  kitItems: ChecklistItem[];
  isRealKit: boolean;
}

export function DepartSacSection({ depart, kitItems, isRealKit }: DepartSacSectionProps) {
  const checklistPct = Math.max(
    0,
    Math.min(100, Math.round(depart.checklistPct ?? depart.readinessScore?.percentage ?? 0))
  );

  return (
    <section className="glass rounded-[1.75rem] p-4 space-y-4" aria-label="Sac">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
            Sac
          </p>
          <span className="font-mono text-[11px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
            {checklistPct} % prêt
          </span>
        </div>
        <div
          className="glass-progress"
          role="progressbar"
          aria-label="Préparation du sac"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={checklistPct}
        >
          <div className="glass-progress-fill" style={{ width: `${checklistPct}%` }} />
        </div>
      </header>

      <DepartWeightBreakdown
        breakdown={depart.weightBreakdown}
        totalWeightG={depart.baseWeightG}
        baseWeightG={depart.baseWeightG}
        wornWeightG={depart.wornWeightG}
        consumablesWeightG={depart.consumablesWeightG}
        items={kitItems}
        participants={depart.participants}
        comparableTripName={depart.comparableTrip?.name}
      />

      <hr className="border-t border-[var(--lkv-border-subtle)]" />

      <DepartChecklist
        items={kitItems}
        consumables={depart.consumables}
        participants={depart.participants}
        kitId={depart.assignedKit.id}
        isRealKit={isRealKit}
      />
    </section>
  );
}
