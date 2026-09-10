'use client';

import { ArrowRight, Wallet } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { formatEuro } from '../../../mobile/mobileHubEngine';
import type { GroupeBalancesView } from '../../../mobile/groupeEngine';

export interface GroupePendingExpense {
  id: string;
  title: string;
  amount: number;
  payerName: string;
}

export interface GroupeBalancesCardProps {
  view: GroupeBalancesView;
  pendingExpenses: GroupePendingExpense[];
  isPending: boolean;
  onSettle: (expenseId: string) => void;
  onOpenExpenses?: () => void;
}

export function GroupeBalancesCard({
  view,
  pendingExpenses,
  isPending,
  onSettle,
  onOpenExpenses,
}: GroupeBalancesCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const hasActivity = view.rows.some((row) => row.paid > 0 || row.share > 0) || pendingExpenses.length > 0;

  return (
    <section aria-label="Caisse commune" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
          Caisse commune
        </p>
        {onOpenExpenses && (
          <button
            type="button"
            onClick={onOpenExpenses}
            className="glass-capsule-btn !px-3 !py-1.5 text-[11px] font-bold min-h-[44px]"
          >
            Dépenses
          </button>
        )}
      </div>

      {!hasActivity ? (
        <div className="glass-sub-card rounded-2xl p-4">
          <p className="text-sm font-bold text-[var(--lkv-text-primary)]">Aucune dépense partagée</p>
          <p className="mt-1 text-xs font-medium text-[var(--lkv-text-primary)]/70">
            Ajoutez une dépense pour calculer qui doit quoi.
          </p>
        </div>
      ) : (
        <>
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

          {view.settlements.length > 0 && (
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
          )}

          {view.settlements.length === 0 && pendingExpenses.length === 0 && (
            <p className="px-1 text-xs font-medium text-[var(--lkv-text-primary)]/70">
              Comptes équilibrés — rien à régler.
            </p>
          )}

          {pendingExpenses.length > 0 && (
            <div className="glass-sub-card rounded-2xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/70">
                À rembourser
              </p>
              <ul className="mt-2 space-y-2.5">
                {pendingExpenses.map((expense) => (
                  <li key={expense.id} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-[var(--lkv-secondary)]">
                      <Wallet size={14} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-[var(--lkv-text-primary)]">
                        {expense.title}
                      </span>
                      <span className="block truncate text-[10px] font-medium text-[var(--lkv-text-primary)]/70">
                        Avancé par {expense.payerName}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
                      {formatEuro(expense.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('medium');
                        onSettle(expense.id);
                      }}
                      disabled={isPending}
                      className="glass-capsule-btn primary shrink-0 !px-3 !py-1.5 text-[11px] font-bold min-h-[44px] disabled:opacity-50"
                    >
                      Marquer remboursé
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default GroupeBalancesCard;
