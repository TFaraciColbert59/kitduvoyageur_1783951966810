import { describe, it, expect } from 'vitest';
import {
  CATEGORY_LIMITS,
  discoveryQuerySchema,
  resolveLimit,
} from '@/features/discovery/schemas/discovery.schema';

describe('discovery query schema', () => {
  it('normalise le code pays et accepte les catégories valides', () => {
    const result = discoveryQuerySchema.safeParse({ countryCode: 'fr', category: 'hotels' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countryCode).toBe('FR');
      expect(result.data.category).toBe('hotels');
    }
  });

  it('refuse une catégorie interdite', () => {
    expect(discoveryQuerySchema.safeParse({ countryCode: 'FR', category: 'bars' }).success).toBe(
      false
    );
    expect(discoveryQuerySchema.safeParse({ countryCode: 'FR', category: '/etc/passwd' }).success).toBe(
      false
    );
  });

  it('refuse tout code pays non ISO A2 (anti-injection / anti-proxy)', () => {
    for (const bad of ['F', 'FRA', 'F1', '../etc', 'FR;', '', 'fr-fr']) {
      expect(discoveryQuerySchema.safeParse({ countryCode: bad, category: 'attractions' }).success).toBe(
        false
      );
    }
  });

  it('borne les résultats aux plafonds contractuels v1', () => {
    expect(CATEGORY_LIMITS).toEqual({ attractions: 6, restaurants: 6, hotels: 4 });
    expect(resolveLimit('hotels', 999)).toBe(4);
    expect(resolveLimit('attractions', 3)).toBe(3);
    expect(resolveLimit('restaurants')).toBe(6);
    expect(resolveLimit('hotels', 0)).toBe(1);
    expect(resolveLimit('attractions', Number.NaN)).toBe(6);
  });
});
