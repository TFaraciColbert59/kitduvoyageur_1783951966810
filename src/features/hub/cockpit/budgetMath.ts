import type { CockpitExpense } from './model';

export interface ExactShare {
  participantId: string;
  cents: number;
  amount: number;
}

/**
 * Répartit un montant en centimes entiers sans aucune perte ni création d'arrondi.
 * Le reste (totalCents % n) est distribué +1 centime aux premiers participants triés
 * par identifiant, garantissant un résultat déterministe et exactement sommé.
 */
export function splitCentsExactly(totalAmount: number, participantIds: string[]): ExactShare[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || participantIds.length === 0) return [];
  const sorted = [...new Set(participantIds)].sort();
  const totalCents = Math.round(totalAmount * 100);
  const count = sorted.length;
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;

  return sorted.map((participantId, index) => {
    const cents = base + (index < remainder ? 1 : 0);
    return {
      participantId,
      cents,
      amount: cents / 100,
    };
  });
}

export interface CategoryTotal {
  category: string;
  amount: number;
  currency: string;
  count: number;
}

export function groupExpensesByCategory(expenses: CockpitExpense[]): CategoryTotal[] {
  const map = new Map<string, { category: string; cents: number; currency: string; count: number }>();
  for (const exp of expenses) {
    if (exp.planned) continue;
    const category = exp.category?.trim() || 'Autre';
    const key = `${exp.currency}:${category}`;
    const existing = map.get(key) ?? { category, cents: 0, currency: exp.currency, count: 0 };
    existing.cents += Math.round(exp.amount * 100);
    existing.count += 1;
    map.set(key, existing);
  }
  return [...map.values()]
    .map((entry) => ({
      category: entry.category,
      amount: entry.cents / 100,
      currency: entry.currency,
      count: entry.count,
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

export interface BudgetProjection {
  spentCents: number;
  dailyPaceCents: number;
  projectedTotalCents: number;
  remainingDays: number;
  remainingBudgetCents: number | null;
}

export function projectRemainingBudget(
  totalSpent: number,
  plannedEnvelope: number | null,
  elapsedDays: number,
  totalDays: number,
): BudgetProjection | null {
  if (!Number.isFinite(totalSpent) || totalDays < 1) return null;
  const clampedElapsed = Math.max(1, Math.min(elapsedDays, totalDays));
  const remainingDays = Math.max(0, totalDays - clampedElapsed);
  const spentCents = Math.round(totalSpent * 100);
  const dailyPaceCents = Math.round(spentCents / clampedElapsed);
  const projectedTotalCents = spentCents + dailyPaceCents * remainingDays;
  const remainingBudgetCents = plannedEnvelope != null && Number.isFinite(plannedEnvelope)
    ? Math.round(plannedEnvelope * 100) - projectedTotalCents
    : null;

  return {
    spentCents,
    dailyPaceCents,
    projectedTotalCents,
    remainingDays,
    remainingBudgetCents,
  };
}
