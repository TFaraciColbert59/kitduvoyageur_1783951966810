import { describe, expect, it } from 'vitest';
import {
  groupExpensesByCategory,
  projectRemainingBudget,
  splitCentsExactly,
} from '@/features/hub/cockpit/budgetMath';

describe('cockpit budgetMath', () => {
  it('splits 10 EUR across 3 participants without rounding error', () => {
    const shares = splitCentsExactly(10, ['u3', 'u1', 'u2']);
    expect(shares).toEqual([
      { participantId: 'u1', cents: 334, amount: 3.34 },
      { participantId: 'u2', cents: 333, amount: 3.33 },
      { participantId: 'u3', cents: 333, amount: 3.33 },
    ]);
    const totalCents = shares.reduce((sum, s) => sum + s.cents, 0);
    expect(totalCents).toBe(1000);
  });

  it('splits 100 EUR across 7 participants deterministically and sums exactly', () => {
    const ids = ['g', 'f', 'e', 'd', 'c', 'b', 'a'];
    const shares = splitCentsExactly(100, ids);
    expect(shares.reduce((s, x) => s + x.cents, 0)).toBe(10000);
    expect(shares[0].participantId).toBe('a');
    expect(shares[0].cents).toBe(1429);
    expect(shares[6].cents).toBe(1428);
  });

  it('groups real expenses by category and ignores planned entries', () => {
    const grouped = groupExpensesByCategory([
      { id: '1', title: 'Refuge', amount: 45.5, currency: 'EUR', category: 'Hébergement', planned: false },
      { id: '2', title: 'Pain', amount: 4.5, currency: 'EUR', category: 'Nourriture', planned: false },
      { id: '3', title: 'Fromage', amount: 8.2, currency: 'EUR', category: 'Nourriture', planned: false },
      { id: '4', title: 'Prévu', amount: 200, currency: 'EUR', category: 'Transport', planned: true },
    ]);
    expect(grouped).toEqual([
      { category: 'Hébergement', amount: 45.5, currency: 'EUR', count: 1 },
      { category: 'Nourriture', amount: 12.7, currency: 'EUR', count: 2 },
    ]);
  });

  it('projects end-of-trip spend and remaining margin from daily pace', () => {
    const proj = projectRemainingBudget(120, 400, 3, 10);
    expect(proj).toEqual({
      spentCents: 12000,
      dailyPaceCents: 4000,
      projectedTotalCents: 40000,
      remainingDays: 7,
      remainingBudgetCents: 0,
    });
  });
});
