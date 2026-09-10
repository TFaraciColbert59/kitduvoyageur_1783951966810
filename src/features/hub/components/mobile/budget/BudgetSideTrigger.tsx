'use client';

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
    <div className="fixed right-0 top-1/2 z-[900] -translate-y-1/2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={
          hasTarget
            ? `Budget — ${pct}% consommé${over ? ', dépassé' : ''}`
            : 'Budget — aucune estimation'
        }
        title="Toutes les dépenses"
        className="glass interactive flex h-14 w-12 items-center justify-center border border-white/60 shadow-lg transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
        style={{ borderRadius: '22px 0 0 22px' }}
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
            style={{ transition: 'stroke-dashoffset 500ms var(--ease-glass)' }}
          />
        </svg>
      </button>
    </div>
  );
}

export default BudgetSideTrigger;
