import { describe, it, expect } from 'vitest';

import { analyzeKit } from '../../src/lib/ai/configuratorCore';
import type { OwnedGearItem, RealShopProduct } from '../../src/lib/ai/configuratorCore';

function product(partial: Partial<RealShopProduct> & { id: string }): RealShopProduct {
  return {
    slug: partial.id,
    name: 'Produit',
    brand: 'LKDV',
    category: 'Accessoires',
    priceEur: 50,
    weightGrams: 500,
    image: '',
    stock: 5,
    ...partial,
  };
}

function gear(partial: Partial<OwnedGearItem> & { id: string; name: string }): OwnedGearItem {
  return {
    category: 'Équipement',
    weightGrams: 800,
    source: 'inventory',
    ...partial,
  };
}

const FULL_CATALOG: RealShopProduct[] = [
  product({ id: 'p1', name: 'Sac à dos Trek 60L', category: 'Sacs à dos', priceEur: 180, weightGrams: 1500 }),
  product({ id: 'p2', name: 'Duvet Mountain 800', category: 'Couchage', priceEur: 250, weightGrams: 1200 }),
  product({ id: 'p3', name: 'Gourde filtrante 1L', category: 'Eau', priceEur: 40, weightGrams: 150 }),
  product({ id: 'p4', name: 'Veste hardshell 3 couches', category: 'Vêtements', priceEur: 300, weightGrams: 600 }),
  product({ id: 'p5', name: 'Tente 2 places', category: 'Tentes', priceEur: 400, weightGrams: 2200 }),
];

describe('src/lib/ai/configuratorCore — moteur déterministe pur (server-safe)', () => {
  it('TEST-KIT-01: inventaire vide → sac/couchage/eau manquants issus du catalogue RÉEL', () => {
    const result = analyzeKit({
      catalog: FULL_CATALOG,
      ownedItems: [],
      weatherKey: 'frais_brumeux',
      durationKey: '3-5d',
    });

    const names = result.missingItems.map((m) => m.name);
    expect(names).toContain('Sac à dos Trek 60L');
    expect(names).toContain('Duvet Mountain 800');
    expect(names).toContain('Gourde filtrante 1L');
    expect(result.missingItems.every((m) => FULL_CATALOG.some((p) => p.id === m.id))).toBe(true);
    expect(result.missingItems[0].essentiality).toBe('indispensable');
  });

  it('TEST-KIT-02: règle "never fabricate" — pas de match catalogue → missingItems vide', () => {
    const result = analyzeKit({
      catalog: [product({ id: 'x1', name: 'Bandana', category: 'Accessoires' })],
      ownedItems: [],
      weatherKey: 'frais_brumeux',
      durationKey: '3-5d',
    });

    expect(result.missingItems).toEqual([]);
    expect(result.inadequateAlerts.length).toBeGreaterThanOrEqual(0);
  });

  it('TEST-KIT-03: équipement possédé détecté par nom (sac, duvet, eau)', () => {
    const result = analyzeKit({
      catalog: FULL_CATALOG,
      ownedItems: [
        gear({ id: 'g1', name: 'Sac de randonnée 50L' }),
        gear({ id: 'g2', name: 'Sac de couchage -5°C', category: 'Couchage' }),
        gear({ id: 'g3', name: 'Gourde isotherme' }),
      ],
      weatherKey: 'sec_chaud',
      durationKey: '1-2d',
    });

    const names = result.missingItems.map((m) => m.name);
    expect(names).not.toContain('Sac à dos Trek 60L');
    expect(names).not.toContain('Duvet Mountain 800');
    expect(names).not.toContain('Gourde filtrante 1L');
  });

  it('TEST-KIT-04: alerte météo danger si froid sec sans duvet, score pénalisé et borné', () => {
    const cold = analyzeKit({
      catalog: FULL_CATALOG,
      ownedItems: [],
      weatherKey: 'froid_sec',
      durationKey: '1-2d',
    });

    expect(cold.inadequateAlerts.some((a) => a.severity === 'danger' && a.item.includes('couchage'))).toBe(true);
    expect(cold.preparationScore).toBeLessThan(100);
    expect(cold.preparationScore).toBeGreaterThanOrEqual(35);
  });

  it('TEST-KIT-05: totaux — poids possédé + manquants, prix des manquants', () => {
    const result = analyzeKit({
      catalog: FULL_CATALOG,
      ownedItems: [gear({ id: 'g1', name: 'Duvet léger', weightGrams: 1000 })],
      weatherKey: 'sec_chaud',
      durationKey: '3-5d',
    });

    // Duvet possédé → sac (180 €) + eau (40 €) manquants ; tente recommandée si durée != 1-2d
    // sac 1500g + eau 150g + tente 2200g ; arrondi toFixed(1) historique sur chaque étape
    expect(result.totalOwnedWeightKg).toBe(1.0);
    expect(result.totalWeightKg).toBe(4.9);
    expect(result.totalMissingPriceEur).toBe(180 + 40 + 400);
  });

  it('TEST-KIT-06: veste exigée seulement si météo humide', () => {
    const dry = analyzeKit({ catalog: FULL_CATALOG, ownedItems: [], weatherKey: 'sec_chaud', durationKey: '1-2d' });
    const wet = analyzeKit({ catalog: FULL_CATALOG, ownedItems: [], weatherKey: 'pluvieux_vente', durationKey: '1-2d' });

    expect(dry.missingItems.map((m) => m.name)).not.toContain('Veste hardshell 3 couches');
    expect(wet.missingItems.map((m) => m.name)).toContain('Veste hardshell 3 couches');
    expect(wet.inadequateAlerts.some((a) => a.item.includes('imperméable'))).toBe(true);
  });
});
