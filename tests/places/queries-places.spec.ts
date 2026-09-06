import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPlaces,
  getPlaceBySlug,
  getPlaceById,
  createPlace,
  getUserTripsForPicker,
} from '@/lib/queries-places';

// Mock server-only
vi.mock('server-only', () => ({}));

// Mock Supabase client
const createMockChain = (data: any = [], count: number | null = null) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    then: (resolve: any) => resolve({ data, count: count ?? (Array.isArray(data) ? data.length : 1), error: null }),
  };
  return chain;
};

let mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('queries-places (Service Layer & Ethical Blurring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches places and applies ethical blurring for sensitive locations', async () => {
    const rawPlaces = [
      {
        id: '1',
        slug: 'refuge-gouter',
        name: 'Refuge du Goûter',
        category: 'refuge',
        country_code: 'FR',
        latitude: 45.851945,
        longitude: 6.830823,
        sensitivity: 'standard',
        bayesian_rating: 4.5,
        reviews_count: 12,
      },
      {
        id: '2',
        slug: 'bivouac-secret',
        name: 'Bivouac Sauvage Fragile',
        category: 'bivouac',
        country_code: 'FR',
        latitude: 45.981842,
        longitude: 6.887231,
        sensitivity: 'sensitive',
        bayesian_rating: 4.8,
        reviews_count: 5,
      },
    ];

    mockFrom.mockReturnValue(createMockChain(rawPlaces, 2));

    const result = await getPlaces();
    expect(result.places).toHaveLength(2);

    // Standard: exact coords
    expect(result.places[0].latitude).toBe(45.851945);
    expect(result.places[0].is_blurred).toBe(false);

    // Sensitive: blurred to 2 decimals (~500m)
    expect(result.places[1].latitude).toBe(45.98);
    expect(result.places[1].longitude).toBe(6.89);
    expect(result.places[1].is_blurred).toBe(true);
    expect(result.places[1].blur_radius_m).toBe(500);
  });

  it('preserves exact coordinates when admin option is passed', async () => {
    const rawPlaces = [
      {
        id: '2',
        slug: 'bivouac-secret',
        name: 'Bivouac Sauvage Fragile',
        category: 'bivouac',
        country_code: 'FR',
        latitude: 45.981842,
        longitude: 6.887231,
        sensitivity: 'sensitive',
      },
    ];

    mockFrom.mockReturnValue(createMockChain(rawPlaces, 1));

    const result = await getPlaces(undefined, { isAdmin: true });
    expect(result.places[0].latitude).toBe(45.981842);
    expect(result.places[0].is_blurred).toBe(false);
  });

  it('fetches place by slug with associated reviews and photos', async () => {
    const rawPlace = {
      id: 'place-123',
      slug: 'refuge-des-cosmiques',
      name: 'Refuge des Cosmiques',
      category: 'refuge',
      country_code: 'FR',
      latitude: 45.8732,
      longitude: 6.8834,
      sensitivity: 'standard',
    };

    const rawReviews = [
      {
        id: 'rev-1',
        place_id: 'place-123',
        author_id: 'user-1',
        rating: 5,
        comment: 'Magnifique expérience avec preuve de passage',
        has_field_proof: true,
      },
    ];

    const rawPhotos = [
      {
        id: 'photo-1',
        place_id: 'place-123',
        url: 'https://example.com/photo.jpg',
        is_featured: true,
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'places') return createMockChain(rawPlace);
      if (table === 'place_reviews') return createMockChain(rawReviews);
      if (table === 'place_photos') return createMockChain(rawPhotos);
      return createMockChain([]);
    });

    const result = await getPlaceBySlug('refuge-des-cosmiques');
    expect(result.place).not.toBeNull();
    expect(result.place?.name).toBe('Refuge des Cosmiques');
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].has_field_proof).toBe(true);
    expect(result.photos).toHaveLength(1);
  });

  it('fetches user trips for the quick add picker', async () => {
    const rawTrips = [
      { id: 'trip-1', title: 'Tour du Mont-Blanc', slug: 'tour-du-mont-blanc', duration_days: 7 },
    ];

    mockFrom.mockReturnValue(createMockChain(rawTrips));

    const trips = await getUserTripsForPicker('user-123');
    expect(trips).toHaveLength(1);
    expect(trips[0].slug).toBe('tour-du-mont-blanc');
  });

  it('fetches a place by its ID', async () => {
    const rawPlace = {
      id: 'place-id-999',
      slug: 'source-froide',
      name: 'Source de Fontaine Froide',
      category: 'water_source',
      country_code: 'FR',
      latitude: 44.8962,
      longitude: 5.5134,
      sensitivity: 'sensitive',
    };

    mockFrom.mockReturnValue(createMockChain(rawPlace));

    const place = await getPlaceById('place-id-999');
    expect(place).not.toBeNull();
    expect(place?.name).toBe('Source de Fontaine Froide');
    expect(place?.is_blurred).toBe(true);
  });

  it('creates a new community place with schema validation', async () => {
    const newPlaceData = {
      id: 'new-id',
      slug: 'nouveau-refuge',
      name: 'Nouveau Refuge',
      category: 'refuge' as const,
      country_code: 'FR',
      latitude: 45.0,
      longitude: 6.0,
      sensitivity: 'standard' as const,
      source: 'community' as const,
      author_id: 'user-author',
      is_verified: false,
    };

    mockFrom.mockReturnValue(createMockChain(newPlaceData));

    const created = await createPlace(
      {
        name: 'Nouveau Refuge',
        slug: 'nouveau-refuge',
        category: 'refuge',
        country_code: 'FR',
        latitude: 45.0,
        longitude: 6.0,
        sensitivity: 'standard',
      },
      'user-author'
    );

    expect(created.name).toBe('Nouveau Refuge');
    expect(created.slug).toBe('nouveau-refuge');
  });
});

