'use client';

import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { ListItem } from '@/components/ui';
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
    <section aria-label="Répartition par catégorie" className="glass rounded-[var(--lkv-radius-lg)] p-4">
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
          <ListItem
            key={row.key}
            onClick={() => {
              triggerHaptic('selection');
              onSelect(row.key);
            }}
            aria-label={`${row.label} — ${formatEuro(row.amount)}, ${row.pct}%`}
            leading={
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: row.color }}
                aria-hidden="true"
              />
            }
            title={row.label}
            trailing={
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold tabular-nums">{formatEuro(row.amount)}</span>
                <span className="w-9 text-right text-[11px] font-semibold tabular-nums">{row.pct}%</span>
              </span>
            }
          />
        ))}
      </ul>
    </section>
  );
}

export default BudgetCategoryCard;
