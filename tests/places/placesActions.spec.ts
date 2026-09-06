import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addPlaceReviewAction,
  reportPlaceAction,
  addPlaceToTripAction,
} from '@/app/lieux/actions';

// Mock server-only & next/cache
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockGetUser = vi.fn();

const createMockChain = (data: any = []) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    then: (resolve: any) => resolve({ data, error: null }),
  };
  return chain;
};

let mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/queries-trips', () => ({
  getTripById: vi.fn(async (tripId: string) => ({
    id: tripId,
    slug: 'mon-beau-voyage',
    title: 'Mon Beau Voyage',
    user_id: 'user-123',
    duration_days: 7,
  })),
}));

vi.mock('@/lib/queries-places', () => ({
  getPlaceById: vi.fn(async (placeId: string) => ({
    id: placeId,
    name: 'Refuge du Goûter',
    slug: 'refuge-du-gouter',
    category: 'refuge',
    country_code: 'FR',
    latitude: 45.8519,
    longitude: 6.8308,
    altitude_m: 3835,
    sensitivity: 'standard',
  })),
}));

describe('Lieux Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addPlaceReviewAction', () => {
    it('rejects unauthenticated users', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const result = await addPlaceReviewAction({
        place_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        rating: 5,
        comment: 'Superbe refuge avec vue incroyable.',
        has_field_proof: true,
      });

      expect(result.error).toContain('Vous devez être connecté');
    });

    it('creates review with field proof when authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
      mockFrom.mockReturnValue(createMockChain({ id: 'rev-uuid-1' }));

      const result = await addPlaceReviewAction({
        place_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        rating: 5,
        comment: 'Superbe refuge avec vue incroyable et bon accueil.',
        has_field_proof: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.reviewId).toBe('rev-uuid-1');
    });
  });

  describe('reportPlaceAction', () => {
    it('creates a safety/ethical report for a place', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
      mockFrom.mockReturnValue(createMockChain({ id: 'rep-uuid-1' }));

      const result = await reportPlaceAction({
        place_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        reason: 'environmental_damage',
        details: 'Déchets et traces de feu illégal constatés près de la source.',
      });

      expect(result.success).toBe(true);
      expect(result.data?.reportId).toBe('rep-uuid-1');
    });
  });

  describe('addPlaceToTripAction', () => {
    it('adds a place to a trip step and item', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_steps') {
          return createMockChain({ id: 'step-new-1', order_index: 2 });
        }
        return createMockChain({});
      });

      const result = await addPlaceToTripAction({
        tripId: 'trip-abc',
        dayNumber: 3,
        placeId: 'place-xyz',
      });

      expect(result.success).toBe(true);
      expect(result.data?.stepId).toBe('step-new-1');
      expect(result.data?.tripSlug).toBe('mon-beau-voyage');
    });
  });
});
