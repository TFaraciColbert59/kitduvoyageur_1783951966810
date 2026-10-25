import { describe, expect, it } from 'vitest';
import { crewPace, settleExpenses } from '../engine/crew';

const members = [
  { userId: 'a', name: 'Ana' },
  { userId: 'b', name: 'Ben' },
  { userId: 'c', name: 'Cléo' },
];

describe('settleExpenses', () => {
  it('partage équitablement et simplifie les remboursements', () => {
    const s = settleExpenses(
      [{ amount: 90, isPlanned: false, payerId: 'a', splitType: 'equal' }],
      members
    );
    expect(s.balances.find((b) => b.userId === 'a')?.net).toBe(60);
    expect(s.debts).toHaveLength(2);
    expect(s.debts.every((d) => d.toUserId === 'a' && d.amount === 30)).toBe(true);
  });

  it('ignore les dépenses prévues', () => {
    const s = settleExpenses(
      [{ amount: 90, isPlanned: true, payerId: 'a', splitType: 'equal' }],
      members
    );
    expect(s.debts).toEqual([]);
    expect(s.countedAmount).toBe(0);
  });

  it('une dépense individuelle reste à la charge du payeur', () => {
    const s = settleExpenses(
      [{ amount: 40, isPlanned: false, payerId: 'b', splitType: 'individual' }],
      members
    );
    expect(s.debts).toEqual([]);
  });

  it('exclut les parts libres au lieu de les deviner', () => {
    const s = settleExpenses(
      [{ amount: 50, isPlanned: false, payerId: 'a', splitType: 'custom' }],
      members
    );
    expect(s.excludedCount).toBe(1);
    expect(s.excludedAmount).toBe(50);
    expect(s.debts).toEqual([]);
  });

  it('un payeur hors groupe est ajouté aux participants', () => {
    const s = settleExpenses(
      [{ amount: 80, isPlanned: false, payerId: 'z', splitType: 'equal' }],
      members
    );
    expect(s.balances).toHaveLength(4);
    expect(s.balances.find((b) => b.userId === 'z')?.net).toBe(60);
  });
});

describe('crewPace', () => {
  it('prend le plus lent parmi les allures connues', () => {
    const p = crewPace([
      { ...members[0], flatSpeedKmh: 4.5 },
      { ...members[1], flatSpeedKmh: 3.2 },
      { ...members[2], flatSpeedKmh: null },
    ]);
    expect(p.slowest).toEqual({ userId: 'b', name: 'Ben', speedKmh: 3.2 });
    expect(p.known).toBe(2);
    expect(p.total).toBe(3);
  });

  it('ne devine rien quand aucune allure n’est connue', () => {
    expect(crewPace([{ ...members[0], flatSpeedKmh: null }]).slowest).toBeNull();
  });
});
