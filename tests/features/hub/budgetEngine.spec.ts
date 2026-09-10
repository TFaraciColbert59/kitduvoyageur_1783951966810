import { describe, it, expect } from 'vitest';
import {
  budgetOutstandingDebts,
  budgetProgress,
  buildBudgetBalances,
  buildBudgetCategoryRows,
  buildBudgetChips,
  buildBudgetDaySlides,
} from '@/features/hub/mobile/budgetEngine';
import type { TripExpense } from '@/features/trips/types/trip.types';

function mkExpense(overrides: Partial<TripExpense> & { id: string; title: string; amount: number }): TripExpense {
  return {
    trip_id: 't-1',
    payer_id: 'u-owner',
    currency: 'EUR',
    category: 'divers',
    expense_date: '2026-09-08',
    split_type: 'equal',
    is_planned: false,
    metadata: null,
    created_at: '2026-09-08T00:00:00Z',
    updated_at: '2026-09-08T00:00:00Z',
    ...overrides,
  } as TripExpense;
}

const TODAY = '2026-09-10';

const EXPENSES: TripExpense[] = [
  mkExpense({ id: 'e1', title: 'Refuge', amount: 140, category: 'hébergement', expense_date: '2026-09-07' }),
  mkExpense({ id: 'e2', title: 'Ravitaillement', amount: 60.5, category: 'nourriture', expense_date: '2026-09-10' }),
  mkExpense({ id: 'e3', title: 'Bus', amount: 30, category: 'transport', expense_date: '2026-09-08', is_planned: true }),
  mkExpense({ id: 'e4', title: 'Avant départ', amount: 12, category: 'matériel', expense_date: '2026-09-01' }),
];

describe('budget engine (mobile)', () => {
  it('calcule la progression de la jauge', () => {
    expect(
      budgetProgress({ totalSpent: 890, estimatedBudget: 1000 } as never)
    ).toEqual({ pct: 89, over: false, hasTarget: true });
    expect(
      budgetProgress({ totalSpent: 1200, estimatedBudget: 1000 } as never)
    ).toEqual({ pct: 100, over: true, hasTarget: true });
    expect(
      budgetProgress({ totalSpent: 100, estimatedBudget: null } as never)
    ).toEqual({ pct: 0, over: false, hasTarget: false });
  });

  it('construit les chips réelles/prevues/reste/aujourd’hui', () => {
    const summary = {
      totalSpent: 200.5,
      plannedTotal: 30,
      estimatedBudget: 890,
      remainingBudget: 689.5,
      categories: { hébergement: 140, nourriture: 60.5 },
      balances: [],
      settlements: [],
      currency: 'EUR',
    } as never;
    const chips = buildBudgetChips({
      summary,
      expenses: EXPENSES,
      isMulti: false,
      participantCount: 1,
      daysCount: 4,
      today: TODAY,
    });
    const byKey = new Map(chips.map((c) => [c.key, c]));
    expect(byKey.get('real')?.value).toBe('201 €');
    expect(byKey.get('planned')?.label).toBe('1 à venir');
    expect(byKey.get('remaining')?.value).toBe('690 €');
    expect(byKey.get('today')?.value).toBe('61 €');
    expect(byKey.get('average')?.value).toBe('50 €');
    expect(byKey.has('per-person')).toBe(false);
  });

  it('ajoute la chip par personne en multi', () => {
    const summary = { totalSpent: 200, plannedTotal: 0, estimatedBudget: null, remainingBudget: null, categories: {}, balances: [], settlements: [], currency: 'EUR' } as never;
    const chips = buildBudgetChips({
      summary,
      expenses: [],
      isMulti: true,
      participantCount: 4,
      daysCount: 2,
      today: TODAY,
    });
    expect(chips.find((c) => c.key === 'per-person')?.value).toBe('50 €');
  });

  it('slides jour par jour avec aujourd’hui', () => {
    const slides = buildBudgetDaySlides({
      trip: { start_date: '2026-09-07', end_date: '2026-09-11' },
      expenses: EXPENSES,
      today: TODAY,
    });
    expect(slides).toHaveLength(5);
    expect(slides.map((s) => s.dayNumber)).toEqual([1, 2, 3, 4, 5]);
    const todaySlide = slides.find((s) => s.isToday);
    expect(todaySlide?.date).toBe(TODAY);
    expect(todaySlide?.realTotal).toBe(60.5);
    expect(todaySlide?.plannedTotal).toBe(0);
    expect(slides[1].plannedTotal).toBe(30);
    // Dépense hors plage (01/09) clampée sur le jour 1 : ses ids suivent le slide.
    expect(slides[0].expenseIds).toEqual(expect.arrayContaining(['e1', 'e4']));
    expect(slides[2].expenseIds).toEqual([]);
  });

  it('catégories triées avec pourcentages et couleurs', () => {
    const rows = buildBudgetCategoryRows({
      totalSpent: 200,
      categories: { transport: 30, hébergement: 140, nourriture: 30 },
    } as never);
    expect(rows.map((r) => r.label)).toEqual(['Hébergement', 'Transport', 'Nourriture']);
    expect(rows[0].pct).toBe(70);
    expect(rows[0].color).toBe('var(--lkv-primary)');
    expect(rows[1].color).toBe('var(--lkv-secondary)');
  });

  it('balances + règlements + dettes restantes', () => {
    const summary = {
      balances: [
        { userId: 'u-a', name: 'A', paid: 100, share: 50, net: 50 },
        { userId: 'u-b', name: 'B', paid: 0, share: 50, net: -50 },
      ],
      settlements: [{ fromUserId: 'u-b', fromName: 'B', toUserId: 'u-a', toName: 'A', amount: 50 }],
    } as never;
    const view = buildBudgetBalances(summary);
    expect(view.balanced).toBe(false);
    expect(view.rows[0].name).toBe('A');
    expect(budgetOutstandingDebts(summary)).toBe(50);
    expect(
      buildBudgetBalances({ balances: [{ userId: 'a', name: 'A', paid: 10, share: 10, net: 0 }], settlements: [] } as never)
        .balanced
    ).toBe(true);
  });
});
