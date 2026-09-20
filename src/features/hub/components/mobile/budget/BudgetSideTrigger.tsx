'use client';

import { IconButton } from '@/components/ui';

export interface BudgetSideTriggerProps {
  progressPct: number;
  over: boolean;
  hasTarget: boolean;
  onOpen: () => void;
}

export function BudgetSideTrigger({ progressPct, over, hasTarget, onOpen }: BudgetSideTriggerProps) {
  const pct = Math.min(100, Math.max(0, progressPct));
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="fixed right-0 top-1/2 z-[var(--z-drawer)] -translate-y-1/2">
      <IconButton
        variant="glass"
        onClick={onOpen}
        aria-label={
          hasTarget
            ? `Budget — ${pct}% consommé${over ? ', dépassé' : ''}`
            : 'Budget — aucune estimation'
        }
        title="Toutes les dépenses"
        className="flex h-14 w-12 !rounded-l-[var(--lkv-radius-lg)] !rounded-r-none"
      >
        <svg viewBox="0 0 40 40" className="h-9 w-9 -rotate-90" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke={over ? 'var(--lkv-danger)' : 'var(--lkv-primary)'}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500 ease-[var(--ease-glass)]"
          />
        </svg>
      </IconButton>
    </div>
  );
}

export default BudgetSideTrigger;
