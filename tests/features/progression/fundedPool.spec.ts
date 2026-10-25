/** T40 — pool financé : pool nul → rien ; prorata centimes ; résidus en réserve ; plafonds. */
import { describe, it, expect } from 'vitest';
import {
  allocatePool,
  periodCapForShares,
} from '@/features/progression/domain/fundedPool';

describe('distribution d’un pool financé', () => {
  it('pool nul → aucune distribution, rien inventé', () => {
    const result = allocatePool({
      poolCents: 0,
      eligibleShares: [{ userId: 'u1', shares: 25 }],
    });
    expect(result.distributable).toBe(false);
    expect(result.allocations).toEqual([]);
  });

  it('exemple de l’économie : 120 € / 600 parts / 25 parts → 5 €', () => {
    const result = allocatePool({
      poolCents: 12000,
      eligibleShares: [
        { userId: 'u1', shares: 25 },
        { userId: 'u2', shares: 575 },
      ],
    });
    expect(result.allocations.find((entry) => entry.userId === 'u1')?.cents).toBe(500);
    expect(result.reserveCents).toBe(0);
  });

  it('arrondis : le total distribué ne dépasse jamais le pool, résidus tracés', () => {
    const result = allocatePool({
      poolCents: 1000,
      eligibleShares: [
        { userId: 'a', shares: 1 },
        { userId: 'b', shares: 1 },
        { userId: 'c', shares: 1 },
      ],
    });
    const total = result.allocations.reduce((sum, entry) => sum + entry.cents, 0);
    expect(total).toBeLessThanOrEqual(1000);
    expect(result.reserveCents).toBe(1000 - total);
  });

  it('plafonds de parts : 50/semaine, 200/période', () => {
    expect(periodCapForShares(1)).toBe(50);
    expect(periodCapForShares(8)).toBe(200);
    expect(periodCapForShares(52)).toBe(200);
  });
});
