'use client';

import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { formatEuro } from '../../../mobile/mobileHubEngine';
import type { BudgetCategoryRow } from '../../../mobile/budgetEngine';

export interface BudgetCategoryCardProps {
  rows: BudgetCategoryRow[];
  onSelect: (categoryKey: string) => void;
}

export function BudgetCategoryCard({ rows, onSelect }: BudgetCategoryCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  if (rows.length === 0) return null;

  return (
    <section aria-label="Répartition par catégorie" className="glass rounded-[1.4rem] p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
        Répartition
      </p>

      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-black/5" aria-hidden="true">
        {rows.map((row) => (
          <span key={row.key} style={{ width: `${row.pct}%`, background: row.color }} />
        ))}
      </div>

      <ul className="mt-2.5 space-y-0.5">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onSelect(row.key);
              }}
              aria-label={`${row.label} — ${formatEuro(row.amount)}, ${row.pct}%`}
              className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-1 text-left transition-colors hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: row.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate text-sm font-semibold text-[var(--lkv-text-primary)]">
                {row.label}
              </span>
              <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-[var(--lkv-text-primary)]">
                {formatEuro(row.amount)}
              </span>
              <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--lkv-text-primary)]/60">
                {row.pct}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default BudgetCategoryCard;
