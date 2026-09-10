import { ArrowRight } from 'lucide-react';
import { formatEuro } from '../../../mobile/mobileHubEngine';
import type { BudgetBalancesView } from '../../../mobile/budgetEngine';

export interface BudgetBalancesCardProps {
  view: BudgetBalancesView;
}

export function BudgetBalancesCard({ view }: BudgetBalancesCardProps) {
  if (view.rows.length === 0) return null;

  return (
    <section aria-label="Équilibre entre participants" className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
        Équilibre
      </p>

      <ul className="space-y-2">
        {view.rows.map((row) => {
          const owes = row.net < -0.01;
          const receives = row.net > 0.01;
          return (
            <li key={row.userId} className="glass-sub-card flex items-center gap-3 rounded-2xl p-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-sm font-bold text-[var(--lkv-primary)] ring-2 ring-white"
                aria-hidden="true"
              >
                {row.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[var(--lkv-text-primary)]">
                  {row.name}
                </span>
                <span className="mt-0.5 block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/70">
                  Payé {formatEuro(row.paid)} · Part {formatEuro(row.share)}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
                  owes
                    ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]'
                    : receives
                      ? 'bg-[var(--sage-50)] text-[var(--sage-700)]'
                      : 'bg-black/5 text-[var(--lkv-text-primary)]'
                }`}
              >
                {owes ? '−' : receives ? '+' : ''}
                {formatEuro(Math.abs(row.net))}
              </span>
            </li>
          );
        })}
      </ul>

      {view.settlements.length > 0 ? (
        <div className="glass-sub-card rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/70">
            Règlements optimaux
          </p>
          <ul className="mt-2 space-y-2">
            {view.settlements.map((settlement) => (
              <li
                key={`${settlement.fromUserId}-${settlement.toUserId}`}
                className="flex items-center gap-2 text-[11.5px]"
              >
                <span className="min-w-0 truncate font-semibold text-[var(--lkv-text-primary)]">
                  {settlement.fromName}
                </span>
                <ArrowRight size={12} className="shrink-0 text-[var(--lkv-text-primary)]/50" aria-hidden="true" />
                <span className="min-w-0 truncate font-semibold text-[var(--lkv-text-primary)]">
                  {settlement.toName}
                </span>
                <span className="ml-auto shrink-0 font-bold tabular-nums text-[var(--lkv-text-primary)]">
                  {formatEuro(settlement.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-1 text-xs font-medium text-[var(--lkv-text-primary)]/70">
          Comptes équilibrés — rien à régler.
        </p>
      )}
    </section>
  );
}

export default BudgetBalancesCard;
