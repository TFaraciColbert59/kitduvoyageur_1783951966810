import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPublicTrips,
  getUserTrips,
  getTripBySlug,
  createTrip,
  deleteTrip,
  getTripStats,
} from '@/lib/queries-trips';

// Mock server-only
vi.mock('server-only', () => ({}));

// Mock Supabase server client
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

const createMockChain = (defaultData: any = []) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: defaultData, error: null }),
  };
  return chain;
};

let mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('queries-trips (Service Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPublicTrips', () => {
    it('returns paginated public trips with computed stats', async () => {
      const chain = createMockChain();
      chain.range.mockResolvedValue({
        data: [
          {
            id: 'trip-1',
            slug: 'trek-alpes-123456',
            title: 'Trek dans les Alpes',
            visibility: 'public',
            difficulty: 'moderate',
            primary_activity: 'hiking',
            trip_collaborators: [{ count: 2 }],
            trip_steps: [{ count: 5 }],
            trip_expenses: [{ amount: 50 }, { amount: 75 }],
          },
        ],
        count: 1,
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const result = await getPublicTrips({ page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.trips).toHaveLength(1);
      expect(result.trips[0].collaborators_count).toBe(2);
      expect(result.trips[0].steps_count).toBe(5);
      expect(result.trips[0].total_spent).toBe(125);
    });
  });

  describe('getUserTrips', () => {
    it('marks the user as owner when trip.user_id matches', async () => {
      const userId = 'user-owner-123';
      const collabChain = createMockChain();
      collabChain.eq.mockResolvedValue({ data: [], error: null });

      const tripsChain = createMockChain();
      tripsChain.order.mockResolvedValue({
        data: [
          {
            id: 'trip-1',
            slug: 'mon-voyage-123456',
            title: 'Mon Voyage Solo',
            user_id: userId,
            trip_collaborators: [{ count: 1 }],
            trip_steps: [{ count: 3 }],
            trip_items: [{ count: 10 }],
            trip_expenses: [],
          },
        ],
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_collaborators') return collabChain;
        return tripsChain;
      });

      const trips = await getUserTrips(userId);
      expect(trips).toHaveLength(1);
      expect(trips[0].user_role).toBe('owner');
      expect(trips[0].collaborators_count).toBe(1);
    });
  });

  describe('getTripBySlug', () => {
    it('returns null if trip is not found', async () => {
      const chain = createMockChain();
      chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const trip = await getTripBySlug('non-existent-slug');
      expect(trip).toBeNull();
    });

    it('redacts documents for viewers / unauthenticated users (RGPD requirement)', async () => {
      const sampleTrip = {
        id: 'trip-public-1',
        slug: 'tour-du-mont-blanc',
        title: 'Tour du Mont Blanc',
        user_id: 'owner-xyz',
        visibility: 'public',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'trips') {
          const chain = createMockChain();
          chain.maybeSingle.mockResolvedValue({ data: sampleTrip, error: null });
          return chain;
        } else if (table === 'trip_documents') {
          return createMockChain([{ id: 'doc-secret', title: 'Passeport.pdf' }]);
        } else {
          return createMockChain([]);
        }
      });

      // Anonymous call
      const trip = await getTripBySlug('tour-du-mont-blanc', undefined);
      expect(trip).not.toBeNull();
      expect(trip?.permissions.canViewDocuments).toBe(false);
      expect(trip?.documents).toHaveLength(0); // Garanti zéro document leak
    });
  });

  describe('createTrip', () => {
    it('validates schema before inserting', async () => {
      await expect(
        createTrip(
          {
            title: 'No', // shorter than 3 chars
          } as any,
          'user-123'
        )
      ).rejects.toThrow();
    });

    it('inserts and returns new trip for valid input', async () => {
      const chain = createMockChain();
      chain.single.mockResolvedValue({
        data: {
          id: 'new-trip-id',
          slug: 'voyage-en-corse-897654',
          title: 'Voyage en Corse',
          user_id: 'user-123',
          visibility: 'private',
          status: 'draft',
        },
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const created = await createTrip(
        {
          title: 'Voyage en Corse',
          visibility: 'private',
        },
        'user-123'
      );

      expect(created.id).toBe('new-trip-id');
      expect(created.title).toBe('Voyage en Corse');
    });
  });

  describe('getTripStats', () => {
    it('correctly sums distance, elevation and calculates packing progress', async () => {
      mockFrom.mockImplementation((table: string) => {
        const chain = createMockChain();
        if (table === 'trips') {
          chain.maybeSingle.mockResolvedValue({
            data: { estimated_budget: 600, start_date: '2026-07-01', end_date: '2026-07-05' },
            error: null,
          });
        } else if (table === 'trip_steps') {
          chain.eq.mockResolvedValue({
            data: [
              { day_number: 1, distance_km: 15.5, elevation_gain_m: 800, elevation_loss_m: 200 },
              { day_number: 2, distance_km: 12.0, elevation_gain_m: 600, elevation_loss_m: 900 },
            ],
            error: null,
          });
        } else if (table === 'trip_items') {
          chain.eq.mockResolvedValue({
            data: [
              { quantity: 1, is_packed: true },
              { quantity: 1, is_packed: true },
              { quantity: 1, is_packed: false },
            ],
            error: null,
          });
        } else if (table === 'trip_expenses') {
          chain.eq.mockResolvedValue({
            data: [{ amount: 150 }, { amount: 85 }],
            error: null,
          });
        } else if (table === 'trip_collaborators') {
          chain.eq.mockResolvedValue({
            count: 3,
            error: null,
          });
        }
        return chain;
      });

      const stats = await getTripStats('trip-stats-1');
      expect(stats.total_distance_km).toBe(27.5);
      expect(stats.total_elevation_gain_m).toBe(1400);
      expect(stats.total_elevation_loss_m).toBe(1100);
      expect(stats.items_packed).toBe(2);
      expect(stats.items_total).toBe(3);
      expect(stats.estimated_budget).toBe(600);
      expect(stats.total_spent).toBe(235);
      expect(stats.participants_count).toBe(3);
      expect(stats.total_days).toBe(2);
    });
  });
});
