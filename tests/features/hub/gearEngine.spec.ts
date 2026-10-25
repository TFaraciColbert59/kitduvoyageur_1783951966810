import { describe, it, expect } from 'vitest';
import {
  buildGearCards,
  buildGearInfoCards,
  buildMemberResources,
  buildMissingRows,
  formatKg,
  gearCategoryLabel,
  isSoloTrip,
  nextPurchaseState,
  PURCHASE_META,
} from '@/features/hub/mobile/gearEngine';
import type { TripFull, TripItem } from '@/features/trips/types/trip.types';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';

function mkItem(overrides: Partial<TripItem> & { id: string; item_name: string }): TripItem {
  return {
    trip_id: 't-1',
    category: 'misc',
    quantity: 1,
    weight_grams: null,
    is_packed: false,
    status: 'needed',
    packed_by: null,
    inventory_item_id: null,
    affiliate_link_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TripItem;
}

function mkTrip(overrides: Partial<TripFull> = {}): TripFull {
  return {
    id: 't-1',
    slug: 'tour-mont-blanc',
    title: 'Tour du Mont-Blanc',
    description: null,
    destination_country_code: 'FR',
    destination_name: 'Mont-Blanc',
    start_date: '2026-09-07',
    end_date: '2026-09-14',
    status: 'planned',
    visibility: 'private',
    difficulty: 'moderate',
    primary_activity: 'trekking',
    estimated_budget: 900,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'u-owner',
    group_id: null,
    share_token: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    collaborators: [],
    steps: [],
    items: [],
    expenses: [],
    documents: [],
    pois: [],
    safety_checkpoints: [],
    notes: [],
    user_role: 'owner',
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
    ...overrides,
  } as TripFull;
}

function mkAnalysis(overrides: Partial<TripKitAnalysis> = {}): TripKitAnalysis {
  return {
    totalItemsCount: 4,
    packedItemsCount: 2,
    vitalItemsCount: 2,
    packedVitalCount: 1,
    completionPercent: 50,
    totalWeightGrams: 8000,
    baseWeightGrams: 6000,
    wornWeightGrams: 1000,
    consumableWeightGrams: 1000,
    weightCategory: 'light',
    unweighedItemsCount: 0,
    maxAltitudeM: 2500,
    seasonContext: 'ete',
    climateWarnings: [],
    vitalGaps: [],
    recommendedGaps: [],
    gearGaps: [],
    ...overrides,
  };
}

describe('buildGearCards', () => {
  it('trie non emballés d’abord et résout les images + poids', () => {
    const trip = mkTrip({
      items: [
        mkItem({ id: 'a', item_name: 'Tente', is_packed: true, weight_grams: 1200, category: 'shelter' }),
        mkItem({ id: 'b', item_name: 'Réchaud', is_packed: false, weight_grams: 300, category: 'cook', quantity: 2 }),
      ],
    });
    const cards = buildGearCards(trip, [{ itemId: 'b', url: 'https://img.test/rechaud.jpg' }]);
    expect(cards.map((c) => c.id)).toEqual(['b', 'a']);
    expect(cards[0].imageUrl).toBe('https://img.test/rechaud.jpg');
    expect(cards[0].weightKg).toBe(0.3);
    expect(cards[0].categoryLabel).toBe('Cuisine');
    expect(cards[1].isPacked).toBe(true);
  });

  it('catégorie inconnue conservée telle quelle', () => {
    expect(gearCategoryLabel('Vivres & Eau')).toBe('Vivres & Eau');
    expect(gearCategoryLabel(null)).toBe('Divers');
  });
});

describe('buildMemberResources', () => {
  it('agrège le poids emballé par membre', () => {
    const trip = mkTrip({
      collaborators: [
        {
          id: 'c-1',
          trip_id: 't-1',
          user_id: 'u-marie',
          role: 'editor',
          joined_at: '2026-01-01T00:00:00Z',
          invited_by: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          profile: { full_name: 'Marie', avatar_url: 'https://img.test/marie.jpg' },
        },
      ],
      items: [
        mkItem({ id: 'a', item_name: 'Tente', is_packed: true, packed_by: 'u-owner', weight_grams: 2000 }),
        mkItem({ id: 'b', item_name: 'Réchaud', is_packed: true, packed_by: 'u-marie', weight_grams: 1000 }),
        mkItem({ id: 'c', item_name: 'Eau', is_packed: false, weight_grams: 1000 }),
      ],
    });
    const rows = buildMemberResources(trip);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ userId: 'u-owner', name: 'Vous', packedWeightKg: 2, progressPct: 50 });
    expect(rows[1]).toMatchObject({
      userId: 'u-marie',
      name: 'Marie',
      avatarUrl: 'https://img.test/marie.jpg',
      packedWeightKg: 1,
      progressPct: 25,
    });
    expect(isSoloTrip(trip)).toBe(false);
  });

  it('solo : propriétaire seul (section masquée par isSoloTrip)', () => {
    const trip = mkTrip({ items: [mkItem({ id: 'a', item_name: 'Tente' })] });
    expect(isSoloTrip(trip)).toBe(true);
    expect(buildMemberResources(trip)).toHaveLength(1);
  });
});

describe('buildMissingRows', () => {
  it('mappe les gaps vers les items du voyage et déduplique', () => {
    const rec = {
      id: 'g-1',
      key: 'gap-shelter',
      name: 'Tente 2 places',
      category: 'shelter' as const,
      priority: 'vital' as const,
      reason: 'Exposition au vent',
      weightGrams: 1800,
      shopProduct: {
        id: 'p-1',
        slug: 'tente-2p',
        name: 'Tente 2 places',
        brand: 'MSR',
        price_eur: 349,
        weight_g: 1800,
        category_main: 'shelter',
        image: 'https://img.test/tente.jpg',
      },
    };
    const tripItems = [
      mkItem({ id: 'i-1', item_name: 'Tente 2 places (MSR)', shop_product_id: 'p-1', purchase_state: 'in_cart' } as never),
    ];
    const rows = buildMissingRows(
      mkAnalysis({ vitalGaps: [rec], recommendedGaps: [rec] }),
      tripItems,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'gap-shelter',
      state: 'in_cart',
      tripItemId: 'i-1',
      imageUrl: 'https://img.test/tente.jpg',
      priceEur: 349,
    });
  });

  it('gap non ajouté : état needed sans item', () => {
    const rows = buildMissingRows(
      mkAnalysis({
        vitalGaps: [
          {
            id: 'g-2',
            key: 'gap-water',
            name: 'Gourde filtrante',
            category: 'water',
            priority: 'vital',
            reason: 'Points d’eau espacés',
            weightGrams: 120,
            shopProduct: null,
          },
        ],
      }),
      [],
    );
    expect(rows[0].state).toBe('needed');
    expect(rows[0].tripItemId).toBeNull();
  });

  it('ajoute les items du cycle d’achat hors gap et rattache le produit boutique', () => {
    const rows = buildMissingRows(
      mkAnalysis(),
      [
        mkItem({ id: 'i-2', item_name: 'Bâtons', purchase_state: 'shipping' } as never),
        mkItem({ id: 'i-3', item_name: 'Sac', purchase_state: 'needed' } as never),
        mkItem({
          id: 'i-4',
          item_name: 'Frontale (Petzl)',
          purchase_state: 'added',
          shop_product_id: 'p-9',
        } as never),
      ],
      [],
      [
        {
          id: 'p-9',
          slug: 'frontale-petzl',
          name: 'Frontale Petzl',
          brand: 'Petzl',
          price_eur: 39,
          weight_g: 80,
          category_main: 'tech',
        },
      ],
    );
    expect(rows.map((r) => r.name)).toEqual(['Frontale Petzl', 'Bâtons']);
    expect(rows[0]).toMatchObject({ state: 'added', productId: 'p-9', productSlug: 'frontale-petzl', priceEur: 39 });
    expect(rows[1].state).toBe('shipping');
  });
});

describe('cycle d’achat', () => {
  it('needed → added → in_cart → shipping → needed', () => {
    expect(nextPurchaseState('needed')).toBe('added');
    expect(nextPurchaseState('added')).toBe('in_cart');
    expect(nextPurchaseState('in_cart')).toBe('shipping');
    expect(nextPurchaseState('shipping')).toBe('needed');
    expect(PURCHASE_META.added.action).toBe('Au panier');
  });
});

describe('infos sac', () => {
  it('formatKg', () => {
    expect(formatKg(0)).toBe('0 kg');
    expect(formatKg(1200)).toBe('1,2 kg');
    expect(formatKg(12400)).toBe('12,4 kg');
  });

  it('cartes info avec alerte vital', () => {
    const cards = buildGearInfoCards(
      mkAnalysis({ vitalGaps: [{} as never], recommendedGaps: [] }),
    );
    expect(cards.find((c) => c.key === 'vital-gaps')?.tone).toBe('warn');
    expect(cards.find((c) => c.key === 'total')?.value).toBe('8 kg');
  });
});
