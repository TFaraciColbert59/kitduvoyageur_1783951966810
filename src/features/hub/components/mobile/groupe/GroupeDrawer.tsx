'use client';

import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { GroupeReadiness } from '../../../mobile/groupeEngine';
import { BudgetRing } from '../budget/BudgetRing';

export interface GroupeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  width?: number;
  children: ReactNode;
}

/** Tiroir latéral glass du groupe (même primitive que Budget/Équipement). */
export function GroupeDrawer({ open, onOpenChange, title, width = 460, children }: GroupeDrawerProps) {
  return (
    <GlassDrawer open={open} onOpenChange={onOpenChange} title={title} width={width}>
      <div className="space-y-4 pb-4">{children}</div>
    </GlassDrawer>
  );
}

export interface GroupeReadinessFactor {
  key: string;
  label: string;
  pct: number;
  detail: string;
}

export interface GroupeReadinessDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readiness: GroupeReadiness;
  factors: GroupeReadinessFactor[];
  primaryLabel: string;
  onPrimary: () => void;
}

export function GroupeReadinessDrawer({
  open,
  onOpenChange,
  readiness,
  factors,
  primaryLabel,
  onPrimary,
}: GroupeReadinessDrawerProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title="Préparation du groupe" width={430}>
      <div className="glass-sub-card flex items-center gap-4 rounded-2xl p-4">
        <BudgetRing pct={readiness.pct} size={92} stroke={9}>
          <NumberStat
            value={readiness.pct}
            className="font-display text-xl font-extrabold leading-none text-[var(--lkv-text-primary)]"
          />
          <span className="mt-0.5 text-[8.5px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
            prêt
          </span>
        </BudgetRing>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
            {readiness.pct}% de préparation
          </p>
          <p className="mt-1 text-xs font-medium leading-snug text-[var(--lkv-text-primary)]/70">
            Score calculé en direct : tâches, équipement, invitations et caisse commune.
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {factors.map((factor) => {
          const width = Math.min(100, Math.max(0, factor.pct));
          return (
            <li key={factor.key} className="glass-sub-card rounded-2xl p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/70">
                  {factor.label}
                </span>
                <span className="text-[12px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
                  {factor.pct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--lkv-forest-100)]">
                <div
                  className="h-full rounded-full bg-[var(--lkv-primary)]"
                  style={{ width: `${width}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-[var(--lkv-text-primary)]/70">
                {factor.detail}
              </p>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          onOpenChange(false);
          onPrimary();
        }}
        className="glass-capsule-btn primary inline-flex w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
      >
        {primaryLabel}
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </GroupeDrawer>
  );
}

export default GroupeDrawer;
