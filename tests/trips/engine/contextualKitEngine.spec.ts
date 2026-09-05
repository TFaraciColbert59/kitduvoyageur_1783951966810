import { describe, it, expect } from 'vitest';
import {
  generateTripContextualKit,
  type ContextualKitInput,
} from '@/features/trips/engine/contextualKitEngine';
import type { ShopProductReference } from '@/features/trips/types/kit.types';
import type { TripItem, TripStep } from '@/features/trips/types/trip.types';

describe('Contextual Kit Engine (Chantier 6 — IA & Kit Contextuel)', () => {
  const dummyProducts: ShopProductReference[] = [
    {
      id: 'prod-1',
      slug: 'lampe-frontale-led-rechargeable-black-diamond-spot-400',
      name: 'Lampe Frontale LED Black Diamond Spot 400',
      brand: 'Black Diamond',
      price_eur: 75.0,
      weight_g: 90,
      category_main: 'Éclairage',
    },
    {
      id: 'prod-2',
      slug: 'trousse-de-premiers-secours-michelin-9531-44-pieces',
      name: 'Trousse de Premiers Secours Michelin 9531',
      brand: 'Michelin',
      price_eur: 22.0,
      weight_g: 220,
      category_main: 'Sécurité / Urgence',
    },
    {
      id: 'prod-3',
      slug: 'crampons-a-neigeglace-baton-trekking-black-diamond-bd110045',
      name: 'Crampons à Neige/Glace Black Diamond',
      brand: 'Black Diamond',
      price_eur: 28.0,
      weight_g: 400,
      category_main: 'Protection froid',
    },
    {
      id: 'prod-4',
      slug: 'tente-de-camping-2-personnes-categorie-bigbuy',
      name: 'Tente de Camping 2 Personnes',
      brand: 'BigBuy Outdoor',
      price_eur: 75.0,
      weight_g: 2000,
      category_main: 'Bivouac / Sommeil',
    },
    {
      id: 'prod-5',
      slug: 'creme-solaire-nivea-spf-50-200-ml',
      name: 'Crème Solaire Nivea SPF 50+',
      brand: 'Nivea',
      price_eur: 16.0,
      weight_g: 220,
      category_main: 'Protection / Hygiène',
    },
    {
      id: 'prod-6',
      slug: 'poncho-impermeable-pluie-categorie-bigbuy',
      name: 'Poncho Imperméable Pluie',
      brand: 'BigBuy Outdoor',
      price_eur: 12.0,
      weight_g: 150,
      category_main: 'Vêtements / Protection',
    },
  ];

  it('identifies universal vital safety items for any outdoor trip', () => {
    const input: ContextualKitInput = {
      durationDays: 3,
      currentItems: [],
      availableProducts: dummyProducts,
    };

    const analysis = generateTripContextualKit(input);

    const vitalKeys = analysis.vitalGaps.map((g) => g.id);
    expect(vitalKeys).toContain('rec-first-aid');
    expect(vitalKeys).toContain('rec-whistle');
    expect(vitalKeys).toContain('rec-headlamp');

    const headlampGap = analysis.vitalGaps.find((g) => g.id === 'rec-headlamp');
    expect(headlampGap?.shopProduct).not.toBeNull();
    expect(headlampGap?.shopProduct?.brand).toBe('Black Diamond');
    expect(headlampGap?.shopProduct?.price_eur).toBe(75.0);
  });

  it('triggers alpine & snow equipment when altitude exceeds 2400m', () => {
    const steps: TripStep[] = [
      {
        id: 's1',
        trip_id: 't1',
        day_number: 1,
        order_index: 0,
        title: 'Montée au Refuge du Goûter',
        description: null,
        location_name: 'Saint-Gervais',
        latitude: 45.85,
        longitude: 6.83,
        accommodation_name: null,
        transport_mode: 'foot',
        distance_km: 12,
        elevation_gain_m: 3835, // High altitude!
        elevation_loss_m: 100,
        created_at: '',
        updated_at: '',
      },
    ];

    const input: ContextualKitInput = {
      countryCode: 'FR',
      durationDays: 2,
      steps,
      currentItems: [],
      availableProducts: dummyProducts,
    };

    const analysis = generateTripContextualKit(input);

    expect(analysis.maxAltitudeM).toBe(3835);
    const crampons = analysis.vitalGaps.find((g) => g.id === 'rec-crampons');
    expect(crampons).toBeDefined();
    expect(crampons?.priority).toBe('vital');
    expect(crampons?.reason).toContain('3835m');
    expect(crampons?.shopProduct?.slug).toBe('crampons-a-neigeglace-baton-trekking-black-diamond-bd110045');
  });

  it('recommends rain protection for wet destinations like Iceland', () => {
    const input: ContextualKitInput = {
      countryCode: 'IS',
      durationDays: 6,
      currentItems: [],
      availableProducts: dummyProducts,
    };

    const analysis = generateTripContextualKit(input);

    expect(analysis.climateWarnings.some((w) => w.includes('Islande'))).toBe(true);
    const poncho = analysis.vitalGaps.find((g) => g.id === 'rec-rain-poncho');
    expect(poncho).toBeDefined();
    expect(poncho?.priority).toBe('vital');
  });

  it('recommends sun & hydration protection for hot destinations (Morocco summer)', () => {
    const input: ContextualKitInput = {
      countryCode: 'MA',
      durationDays: 7,
      seasonMonth: 7, // Juillet
      currentItems: [],
      availableProducts: dummyProducts,
    };

    const analysis = generateTripContextualKit(input);

    expect(analysis.climateWarnings.some((w) => w.includes('Maroc'))).toBe(true);
    const sunscreen = analysis.vitalGaps.find((g) => g.id === 'rec-sunscreen');
    expect(sunscreen).toBeDefined();
    expect(sunscreen?.priority).toBe('vital');
  });

  it('excludes items already present in the traveler items list from gaps', () => {
    const currentItems: TripItem[] = [
      {
        id: 'item-1',
        trip_id: 't1',
        item_name: 'Trousse de premiers secours Michelin',
        category: 'safety',
        quantity: 1,
        weight_grams: 220,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        is_vital: true,
        created_at: '',
        updated_at: '',
      },
    ];

    const input: ContextualKitInput = {
      durationDays: 3,
      currentItems,
      availableProducts: dummyProducts,
    };

    const analysis = generateTripContextualKit(input);

    // Trousse already present => not in vitalGaps!
    expect(analysis.vitalGaps.some((g) => g.id === 'rec-first-aid')).toBe(false);
    expect(analysis.packedItemsCount).toBe(1);
    expect(analysis.vitalItemsCount).toBe(1);
    expect(analysis.packedVitalCount).toBe(1);
    expect(analysis.completionPercent).toBe(100);
  });

  it('correctly calculates base weight by excluding worn and consumable items', () => {
    const currentItems: TripItem[] = [
      {
        id: 'i1',
        trip_id: 't1',
        item_name: 'Tente 2P',
        category: 'shelter',
        quantity: 1,
        weight_grams: 1800,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        is_worn: false,
        is_consumable: false,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'i2',
        trip_id: 't1',
        item_name: 'Veste Gore-Tex portée',
        category: 'clothing',
        quantity: 1,
        weight_grams: 650,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        is_worn: true, // Worn!
        is_consumable: false,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'i3',
        trip_id: 't1',
        item_name: 'Eau 2L',
        category: 'water',
        quantity: 1,
        weight_grams: 2000,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        is_worn: false,
        is_consumable: true, // Consumable!
        created_at: '',
        updated_at: '',
      },
    ];

    const input: ContextualKitInput = {
      durationDays: 2,
      currentItems,
    };

    const analysis = generateTripContextualKit(input);

    expect(analysis.totalWeightGrams).toBe(4450);
    expect(analysis.baseWeightGrams).toBe(1800); // 1800g only!
    expect(analysis.wornWeightGrams).toBe(650);
    expect(analysis.consumableWeightGrams).toBe(2000);
    expect(analysis.weightCategory).toBe('ultralight'); // < 5000g
  });

  it('guarantees 100% deterministic output across multiple runs', () => {
    const input: ContextualKitInput = {
      countryCode: 'PE',
      activity: 'trekking',
      durationDays: 10,
      seasonMonth: 6,
      currentItems: [],
      availableProducts: dummyProducts,
    };

    const run1 = JSON.stringify(generateTripContextualKit(input));
    const run2 = JSON.stringify(generateTripContextualKit(input));
    expect(run1).toBe(run2);
  });
});
