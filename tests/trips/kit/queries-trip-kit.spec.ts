import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getShopProducts,
  getTripKitDetails,
  addTripItem,
  toggleTripItemPacked,
  deleteTripItem,
  addRecommendedItemToTrip,
} from '@/lib/queries-trip-kit';

// Mock server-only
vi.mock('server-only', () => ({}));

// Mock Supabase
const createMockChain = (data: any = []) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    then: (resolve: any) => resolve({ data, error: null }),
  };
  return chain;
};

let mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// Mock getTripBySlug
vi.mock('@/lib/queries-trips', () => ({
  getTripBySlug: vi.fn(async (slug: string) => {
    if (slug === 'trip-inexistant') return null;
    return {
      id: 'trip-1',
      slug: 'chamonix-trek',
      title: 'Trek du Mont-Blanc',
      destination_country_code: 'FR',
      destination_name: 'Chamonix-Mont-Blanc',
      duration_days: 7,
      start_date: '2026-07-10',
      primary_activity: 'trekking',
      steps: [
        {
          id: 'step-1',
          trip_id: 'trip-1',
          day_number: 1,
          order_index: 0,
          title: 'Montée vers les refuges',
          elevation_gain_m: 2800,
        },
      ],
      items: [
        {
          id: 'item-1',
          trip_id: 'trip-1',
          item_name: 'Veste de pluie',
          category: 'clothing',
          quantity: 1,
          weight_grams: 400,
          is_packed: false,
          is_vital: false,
        },
      ],
    };
  }),
}));

describe('queries-trip-kit (Chantier 6 — Service Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches real shop products from database and parses numbers', async () => {
    const rawProducts = [
      {
        id: 'p1',
        slug: 'lampe-frontale-led-rechargeable-black-diamond-spot-400',
        name: 'Lampe Frontale LED Spot 400',
        brand: 'Black Diamond',
        price_eur: '75.00',
        weight_g: 90,
        category_main: 'Éclairage',
      },
    ];

    mockFrom.mockReturnValue(createMockChain(rawProducts));

    const products = await getShopProducts();

    expect(mockFrom).toHaveBeenCalledWith('shop_products');
    expect(products).toHaveLength(1);
    expect(products[0].price_eur).toBe(75.0);
    expect(products[0].brand).toBe('Black Diamond');
  });

  it('generates trip kit details with contextual analysis and gaps', async () => {
    const rawProducts = [
      {
        id: 'p-secours',
        slug: 'trousse-de-premiers-secours-michelin-9531-44-pieces',
        name: 'Trousse de Premiers Secours Michelin',
        brand: 'Michelin',
        price_eur: '22.00',
        weight_g: 220,
        category_main: 'Sécurité / Urgence',
      },
    ];

    mockFrom.mockReturnValue(createMockChain(rawProducts));

    const result = await getTripKitDetails('chamonix-trek');

    expect(result).not.toBeNull();
    expect(result?.trip.slug).toBe('chamonix-trek');
    expect(result?.analysis.maxAltitudeM).toBe(2800);
    expect(result?.analysis.vitalGaps.length).toBeGreaterThan(0);
  });

  it('adds an item to trip_items with category and priority', async () => {
    const inserted = {
      id: 'new-item-1',
      trip_id: 'trip-1',
      item_name: 'Gourde filtrante',
      category: 'water',
      weight_grams: 120,
      quantity: 1,
      is_packed: false,
      status: 'needed',
      priority: 'vital',
      is_vital: true,
      source: 'user',
    };

    mockFrom.mockReturnValue(createMockChain([inserted]));

    const item = await addTripItem({
      tripId: 'trip-1',
      itemName: 'Gourde filtrante',
      category: 'water',
      weightGrams: 120,
      priority: 'vital',
      isVital: true,
    });

    expect(mockFrom).toHaveBeenCalledWith('trip_items');
    expect(item).not.toBeNull();
    expect(item?.item_name).toBe('Gourde filtrante');
    expect(item?.priority).toBe('vital');
  });

  it('toggles item packed state', async () => {
    mockFrom.mockReturnValue(createMockChain());

    const ok = await toggleTripItemPacked('item-1', true);

    expect(mockFrom).toHaveBeenCalledWith('trip_items');
    expect(ok).toBe(true);
  });

  it('deletes an item from trip_items', async () => {
    mockFrom.mockReturnValue(createMockChain());

    const ok = await deleteTripItem('item-1');

    expect(mockFrom).toHaveBeenCalledWith('trip_items');
    expect(ok).toBe(true);
  });

  it('adds recommended item with contextual note and product reference', async () => {
    const recReturn = {
      id: 'rec-item-1',
      trip_id: 'trip-1',
      item_name: 'Crampons Black Diamond (Black Diamond)',
      category: 'clothing',
      weight_grams: 400,
      quantity: 1,
      is_packed: false,
      status: 'needed',
      priority: 'vital',
      is_vital: true,
      source: 'contextual_kit',
      shop_product_id: 'p-crampons',
    };

    mockFrom.mockReturnValue(createMockChain([recReturn]));

    const item = await addRecommendedItemToTrip('trip-1', {
      id: 'rec-crampons',
      name: 'Crampons de traction',
      category: 'clothing',
      priority: 'vital',
      reason: 'Altitude > 2800m',
      weightGrams: 400,
      shopProduct: {
        id: 'p-crampons',
        slug: 'crampons-a-neigeglace-baton-trekking-black-diamond-bd110045',
        name: 'Crampons Black Diamond',
        brand: 'Black Diamond',
        price_eur: 28.0,
        weight_g: 400,
        category_main: 'Protection froid',
      },
    });

    expect(mockFrom).toHaveBeenCalledWith('trip_items');
    expect(item).not.toBeNull();
    expect(item?.source).toBe('contextual_kit');
    expect(item?.shop_product_id).toBe('p-crampons');
  });
});
