import { describe, it, expect } from 'vitest';
import {
  isWithinQuietHours,
  hoursUntilQuietEnd,
} from '@/lib/notifications/quietHours';

describe('A-186 — heures calmes des notifications', () => {
  it('détecte une plage simple (9 → 17)', () => {
    expect(isWithinQuietHours(8, 9, 17)).toBe(false);
    expect(isWithinQuietHours(9, 9, 17)).toBe(true);
    expect(isWithinQuietHours(16, 9, 17)).toBe(true);
    expect(isWithinQuietHours(17, 9, 17)).toBe(false);
  });

  it('détecte une plage qui traverse minuit (22 → 7)', () => {
    expect(isWithinQuietHours(23, 22, 7)).toBe(true);
    expect(isWithinQuietHours(2, 22, 7)).toBe(true);
    expect(isWithinQuietHours(6, 22, 7)).toBe(true);
    expect(isWithinQuietHours(7, 22, 7)).toBe(false);
    expect(isWithinQuietHours(15, 22, 7)).toBe(false);
  });

  it('ne bloque rien sans plage configurée', () => {
    expect(isWithinQuietHours(3, null, 7)).toBe(false);
    expect(isWithinQuietHours(3, 22, null)).toBe(false);
    expect(isWithinQuietHours(3, 22, 22)).toBe(false);
  });

  it("calcule le délai jusqu'à la fin de plage", () => {
    expect(hoursUntilQuietEnd(23, 7)).toBe(8);
    expect(hoursUntilQuietEnd(6, 7)).toBe(1);
    expect(hoursUntilQuietEnd(7, 7)).toBe(24);
    expect(hoursUntilQuietEnd(10, null)).toBe(1);
  });
});
