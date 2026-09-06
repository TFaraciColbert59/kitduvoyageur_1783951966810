import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveDraftTripSchema,
  wizardPersistInputSchema,
} from '@/features/trips/schemas/trip.schema';
import {
  generateAndPersistItinerary,
  saveDraftTripAction,
  regenerateItineraryAction,
} from '@/app/voyages/actions';

// Mock server-only et cache Next.js
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase
let mockUser: any = { id: 'usr-lead-01', email: 'lead@lkdv.fr' };

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUser },
        error: null,
      })),
    },
    from: mockFrom,
  })),
}));

// Mock queries-trips pour getTripById
vi.mock('@/lib/queries-trips', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getTripById: vi.fn(async (tripId: string) => ({
      id: tripId,
      slug: 'expedition-islande-7j',
      title: 'Expédition Islande',
      description: null,
      destination_country_code: 'IS',
      destination_name: 'Islande',
      start_date: '2026-07-10',
      end_date: '2026-07-16',
      status: 'planned',
      primary_activity: 'trekking',
      difficulty: 'moderate',
      metadata: { countries: ['IS'], pace: 'standard' },
      permissions: { canEdit: true, canDelete: true },
    })),
  };
});

describe('Chantier 2 — Wizard & Itinerary Engine Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'usr-lead-01', email: 'lead@lkdv.fr' };
  });

  describe('Validation Schémas Wizard', () => {
    it('valide un payload de persistance complet', () => {
      const validPayload = {
        title: 'Traversée du Mont-Blanc',
        countries: ['FR'],
        durationDays: 7,
        pace: 'standard' as const,
        activityType: 'trekking' as const,
        difficulty: 'moderate' as const,
        accommodationType: 'bivouac' as const,
        travelersCount: 2,
        groupType: 'couple' as const,
        publishStatus: 'planned' as const,
      };

      const parsed = wizardPersistInputSchema.parse(validPayload);
      expect(parsed.title).toBe('Traversée du Mont-Blanc');
      expect(parsed.countries).toEqual(['FR']);
      expect(parsed.durationDays).toBe(7);
      expect(parsed.travelersCount).toBe(2);
    });

    it('rejette un nombre de jours hors limites (< 1 ou > 90)', () => {
      expect(() =>
        wizardPersistInputSchema.parse({
          title: 'Trek',
          countries: ['FR'],
          durationDays: 0,
        })
      ).toThrow();

      expect(() =>
        wizardPersistInputSchema.parse({
          title: 'Trek',
          countries: ['FR'],
          durationDays: 100,
        })
      ).toThrow();
    });

    it('rejette une liste de pays vide', () => {
      expect(() =>
        wizardPersistInputSchema.parse({
          title: 'Trek sans pays',
          countries: [],
          durationDays: 5,
        })
      ).toThrow();
    });
  });

  describe('generateAndPersistItinerary', () => {
    it('génère un itinéraire déterministe avec étapes et items matériels', async () => {
      // Configuration du mock Supabase pour destination_steps et insertion
      const mockTripId = 'trip-uuid-1234';
      const mockSlug = 'traversee-islande-7j';

      mockFrom.mockImplementation((table: string) => {
        if (table === 'destination_steps') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'is-1',
                  country_code: 'IS',
                  title: 'Landmannalaugar',
                  location_name: 'Landmannalaugar',
                  latitude: 63.99,
                  longitude: -19.06,
                  distance_km: 12,
                  elevation_gain_m: 470,
                  elevation_loss_m: 0,
                  difficulty: 'moderate',
                  activity_type: 'trekking',
                  order_hint: 1,
                  is_demanding: false,
                },
              ],
              error: null,
            }),
          };
        }

        if (table === 'trips') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockTripId, slug: mockSlug },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockTripId, slug: mockSlug },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === 'trip_steps') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        if (table === 'trip_items') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const result = await generateAndPersistItinerary({
        title: 'Traversée Islande',
        countries: ['IS'],
        durationDays: 5,
        pace: 'standard',
        activityType: 'trekking',
        difficulty: 'moderate',
        accommodationType: 'bivouac',
        travelersCount: 2,
        groupType: 'couple',
        publishStatus: 'planned',
      });

      expect(result.success).toBe(true);
      expect(result.tripId).toBe(mockTripId);
      expect(result.slug).toBe(mockSlug);
      expect(result.output.steps.length).toBe(5);
      expect(result.output.total_days).toBe(5);
      expect(result.output.items.length).toBeGreaterThan(0);
    });

    it('fonctionne en mode anonyme (non authentifié) sans planter', async () => {
      mockUser = null; // Utilisateur non connecté

      mockFrom.mockImplementation((table: string) => {
        if (table === 'destination_steps') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await generateAndPersistItinerary({
        title: 'Exploration Népal',
        countries: ['NP'],
        durationDays: 4,
        pace: 'chill',
        activityType: 'hiking',
        difficulty: 'easy',
        accommodationType: 'refuge',
        travelersCount: 1,
        groupType: 'solo',
        publishStatus: 'draft',
      });

      expect(result.success).toBe(true);
      expect(result.tripId).toBeNull();
      expect(result.slug).toBeNull();
      expect(result.output.total_days).toBe(4);
      expect(result.output.steps.length).toBe(4);
    });
  });

  describe('saveDraftTripAction', () => {
    it('enregistre un brouillon en base à partir de l’étape 3', async () => {
      const mockDraftId = 'draft-id-456';
      mockFrom.mockImplementation((table: string) => {
        if (table === 'trips') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockDraftId, slug: 'brouillon-maroc' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await saveDraftTripAction({
        title: 'Brouillon Maroc',
        countries: ['MA'],
        durationDays: 6,
        pace: 'standard',
        activityType: 'trekking',
        difficulty: 'moderate',
        accommodationType: 'bivouac',
        travelersCount: 3,
        groupType: 'friends',
      });

      expect(res.tripId).toBe(mockDraftId);
      expect(res.slug).toBe('brouillon-maroc');
    });
  });

  describe('regenerateItineraryAction', () => {
    it('recalcule les étapes pour un voyage existant et préserve le matériel utilisateur', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'destination_steps') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'trips') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'trip-exist', slug: 'trip-exist-slug' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'trip_steps') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'trip_items') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await regenerateItineraryAction('11111111-1111-4111-8111-111111111111');
      expect(res.success).toBe(true);
      expect(res.output.total_days).toBe(7);
      expect(res.output.steps.length).toBe(7);
    });
  });
});
