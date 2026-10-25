import { describe, it, expect } from 'vitest';
import { computeKitWeight } from '@/features/trips/engine/contextualKitEngine';
import type { TripItem } from '@/features/trips/types/trip.types';

describe('Sous-phase 1.3 (D3, D4) — Cohérence des poids et des badges (TDD)', () => {
  it('TEST-WEIGHT-01: Sac vide (0 items) -> pas de badge ULTRALIGHT (weightCategory: "none")', () => {
    const result = computeKitWeight([]);
    expect(result.totalWeightGrams).toBe(0);
    expect(result.baseWeightGrams).toBe(0);
    expect(result.weightCategory).toBe('none');
  });

  it('TEST-WEIGHT-02: Sac avec items pesés à 0g -> pas de badge ULTRALIGHT', () => {
    const items: TripItem[] = [
      {
        id: '1',
        trip_id: 't1',
        item_name: 'Poche vide',
        category: 'misc',
        quantity: 1,
        weight_grams: 0,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '',
        updated_at: '',
      },
    ];
    const result = computeKitWeight(items);
    expect(result.totalWeightGrams).toBe(0);
    expect(result.weightCategory).toBe('none');
  });

  it('TEST-WEIGHT-03: Item avec poids non renseigné (null/undefined) -> sac marqué "incomplet", pas "ultralight"', () => {
    const items: TripItem[] = [
      {
        id: '1',
        trip_id: 't1',
        item_name: 'Tente sans poids',
        category: 'shelter',
        quantity: 1,
        weight_grams: null, // Non renseigné
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        trip_id: 't1',
        item_name: 'Couteau',
        category: 'misc',
        quantity: 1,
        weight_grams: 80,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '',
        updated_at: '',
      },
    ];

    const result = computeKitWeight(items);
    expect(result.unweighedItemsCount).toBe(1);
    expect(result.weightCategory).toBe('incomplet');
  });

  it('TEST-WEIGHT-04: Sac complet pesé < 5000g de base -> badge "ultralight"', () => {
    const items: TripItem[] = [
      {
        id: '1',
        trip_id: 't1',
        item_name: 'Abri tarp ultra',
        category: 'shelter',
        quantity: 1,
        weight_grams: 650,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        trip_id: 't1',
        item_name: 'Sac de couchage plume',
        category: 'sleep',
        quantity: 1,
        weight_grams: 750,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '',
        updated_at: '',
      },
    ];

    const result = computeKitWeight(items);
    expect(result.unweighedItemsCount).toBe(0);
    expect(result.baseWeightGrams).toBe(1400);
    expect(result.weightCategory).toBe('ultralight');
  });

  it('TEST-WEIGHT-05: Trousse 44 pièces Michelin avec weight_g <= 0 en boutique utilise le poids de base 220g (Anti-D3)', async () => {
    const { generateTripContextualKit } = await import('@/features/trips/engine/contextualKitEngine');

    const analysis = generateTripContextualKit({
      durationDays: 3,
      currentItems: [],
      availableProducts: [
        {
          id: 'p-michelin',
          slug: 'trousse-de-premiers-secours-michelin-9531-44-pieces',
          name: 'Trousse Michelin 44 pièces',
          brand: 'Michelin',
          price_eur: 22,
          weight_g: 0, // Bug en base : weight_g: 0
          category_main: 'Sécurité',
        },
      ],
    });

    const firstAid = (analysis.gearGaps || [...analysis.vitalGaps, ...analysis.recommendedGaps]).find(
      (g) => g.key === 'first-aid'
    );
    expect(firstAid).toBeDefined();
    // Ne doit PAS être 0g !
    expect(firstAid?.weightGrams).toBeGreaterThan(0);
    expect(firstAid?.weightGrams).toBe(200); // baseWeightGrams fallback
  });
});
