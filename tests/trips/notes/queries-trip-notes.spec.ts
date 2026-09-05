import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTripNotes,
  addTripNote,
  updateTripNote,
  deleteTripNote,
} from '@/lib/queries-trip-notes';
import {
  updateTripStatus,
  publishTripToCarnet,
  submitTripFieldReviews,
} from '@/lib/queries-trip-completion';

// Mock de Supabase server
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock de getTripById pour publishTripToCarnet
vi.mock('@/lib/queries-trips', () => ({
  getTripById: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';

function createChainedMock(result: any = { error: null }) {
  const chain: any = {
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

describe('queries-trip-notes & queries-trip-completion — Chantier 8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queries-trip-notes', () => {
    it('récupère la liste des notes du voyage avec enrichissement du profil auteur', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'trip_notes') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockImplementation(function (this: any) {
                return {
                  order: vi.fn().mockImplementation(function (this: any) {
                    return {
                      order: vi.fn().mockResolvedValue({
                        data: [
                          {
                            id: 'n-1',
                            trip_id: 'trip-1',
                            author_id: 'user-1',
                            title: 'Arrivée au camp de base',
                            content: 'Magnifique coucher de soleil.',
                            day_number: 1,
                            is_pinned: true,
                            created_at: '2026-07-10T18:00:00Z',
                            updated_at: '2026-07-10T18:00:00Z',
                          },
                        ],
                        error: null,
                      }),
                    };
                  }),
                };
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'user-1', full_name: 'Tony Faraci', avatar_url: null }],
              }),
            };
          }
          return {};
        }),
      };

      (createClient as any).mockResolvedValue(mockSupabase);

      const notes = await getTripNotes('trip-1');
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Arrivée au camp de base');
      expect(notes[0].author?.full_name).toBe('Tony Faraci');
      expect(notes[0].is_pinned).toBe(true);
    });

    it('ajoute une note au carnet de bord', async () => {
      const mockInsertedNote = {
        id: 'n-new',
        trip_id: 'trip-1',
        author_id: 'user-1',
        title: 'Étape 2',
        content: 'Col difficile franchi',
        day_number: 2,
        is_pinned: false,
        created_at: '2026-07-11T12:00:00Z',
        updated_at: '2026-07-11T12:00:00Z',
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockInsertedNote, error: null }),
        })),
      };

      (createClient as any).mockResolvedValue(mockSupabase);

      const res = await addTripNote({
        tripId: 'trip-1',
        authorId: 'user-1',
        title: 'Étape 2',
        content: 'Col difficile franchi',
        dayNumber: 2,
      });

      expect(res.success).toBe(true);
      expect(res.note?.id).toBe('n-new');
    });

    it('met à jour une note existante', async () => {
      const mockSupabase = {
        from: vi.fn(() => createChainedMock({ data: { id: 'n-1', content: 'Édité' }, error: null })),
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const res = await updateTripNote({
        noteId: 'n-1',
        tripId: 'trip-1',
        content: 'Édité',
        isPinned: true,
      });

      expect(res.success).toBe(true);
    });

    it('supprime une note', async () => {
      const mockSupabase = {
        from: vi.fn(() => createChainedMock({ error: null })),
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const res = await deleteTripNote('n-1', 'trip-1');
      expect(res.success).toBe(true);
    });
  });

  describe('queries-trip-completion', () => {
    it('met à jour le statut du voyage en completed', async () => {
      const mockSupabase = {
        from: vi.fn(() => createChainedMock({ error: null })),
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const res = await updateTripStatus('trip-1', 'completed');
      expect(res.success).toBe(true);
    });

    it('publie un voyage en carnet communautaire (carnet, moments, kitItems)', async () => {
      const mockTrip: any = {
        id: 'trip-1',
        title: 'Trek du Salkantay',
        destination_name: 'Machu Picchu',
        description: 'Trek mythique',
        start_date: '2026-08-01',
        end_date: '2026-08-05',
        status: 'active',
        difficulty: 'hard',
        primary_activity: 'trekking',
        destination_country_code: 'PE',
        user_id: 'user-1',
        collaborators: [],
        steps: [
          { day_number: 1, distance_km: 15, elevation_gain_m: 800, location_name: 'Mollepata' },
        ],
        items: [
          { item_name: 'Sac 50L', category: 'Portage', is_packed: true, weight_grams: 1400 },
        ],
        notes: [
          { title: 'Jour 1', content: 'Départ matinal', day_number: 1, author_id: 'user-1' },
        ],
        pois: [],
        expenses: [],
        documents: [],
      };

      (getTripById as any).mockResolvedValue(mockTrip);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'carnets') {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'carnet-new-123' }, error: null }),
            };
          }
          if (table === 'carnet_moments' || table === 'carnet_kit_items') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'trips') {
            return createChainedMock({ error: null });
          }
          return {};
        }),
      };

      (createClient as any).mockResolvedValue(mockSupabase);

      const res = await publishTripToCarnet('trip-1', {
        title: 'Mon Salkantay 2026',
        isPublic: true,
      });

      expect(res.success).toBe(true);
      expect(res.carnetId).toBe('carnet-new-123');
    });

    it('enregistre des avis certifiés terrain avec has_field_proof: true', async () => {
      let insertedPayload: any = null;
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'place_reviews') {
            return {
              insert: vi.fn().mockImplementation((payload) => {
                insertedPayload = payload;
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };

      (createClient as any).mockResolvedValue(mockSupabase);

      const res = await submitTripFieldReviews('trip-1', 'user-1', [
        { placeId: 'place-refuge-bonhomme', rating: 5, comment: 'Accueil chaleureux et dortoirs propres !' },
      ]);

      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(insertedPayload).toHaveLength(1);
      expect(insertedPayload[0].has_field_proof).toBe(true);
      expect(insertedPayload[0].place_id).toBe('place-refuge-bonhomme');
      expect(insertedPayload[0].trip_id).toBe('trip-1');
    });
  });
});
