import { HandCoins, CheckCircle2 } from 'lucide-react';
import { calculateBudgetSummary } from '@/features/trips/engine/budgetEngine';
import type { TripFull } from '@/features/trips/types/trip.types';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';

/**
 * H-ACT — Bloc "Qui doit quoi" de l'aperçu (budgetEngine.simplifyDebts —
 * fonction pure déjà testée ; zéro donnée serveur supplémentaire).
 * Affiché quand >1 participant a des dépenses (party !== solo).
 */
export function SettlementsBlock({ trip, slug }: { trip: TripFull; slug: string }) {
  const summary = calculateBudgetSummary(
    { estimated_budget: trip.estimated_budget, budget_currency: trip.budget_currency },
    trip.expenses ?? [],
    trip.collaborators ?? [],
  );
  const currency = summary.currency || 'EUR';
  const settlements = summary.settlements.slice(0, 3);
  const ref: HubAdventureRef = { nature: 'sortie', slug };

  return (
    <div className="glass p-5 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[var(--lkv-text-primary)] flex items-center gap-2">
          <HandCoins size={18} className="text-[var(--lkv-text-secondary)]" aria-hidden="true" />
          <span>Qui doit quoi</span>
        </h2>
        <a
          href={hubSectionHref(ref, 'budget')}
          className="text-xs font-semibold text-[var(--lkv-primary)] hover:underline min-h-[44px] inline-flex items-center"
        >
          Voir le budget →
        </a>
      </div>

      {settlements.length === 0 ? (
        <div className="flex items-center gap-2.5 text-sm text-[var(--lkv-text-secondary)]">
          <CheckCircle2 size={18} className="text-[var(--lkv-success)] shrink-0" aria-hidden="true" />
          <span>Comptes équilibrés — personne ne doit rien.</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {settlements.map((s, i) => (
            <li
              key={`${s.fromUserId}-${s.toUserId}-${i}`}
              className="flex items-center justify-between px-3 py-2.5 rounded-[var(--lkv-radius-md)] bg-white/35 border border-white/50"
            >
              <span className="text-sm text-[var(--lkv-text-primary)] truncate">
                <strong className="font-semibold">{s.fromName}</strong> doit{' '}
                <strong className="font-semibold">{s.toName}</strong>
              </span>
              <span className="text-sm font-bold text-[var(--lkv-text-primary)] shrink-0 ml-2">
                {s.amount.toFixed(2)} {currency}
              </span>
            </li>
          ))}
          {summary.settlements.length > 3 && (
            <li className="text-xs text-[var(--lkv-text-secondary)] px-3">
              +{summary.settlements.length - 3} autre(s) règlement(s)…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default SettlementsBlock;
