import { describe, it, expect } from 'vitest';
import { getTripCounters } from '@/features/trips/hooks/useTripCounters';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';

function createMockTrip(overrides: Partial<TripFull> = {}): TripFull {
  return {
    id: 'trip-counters-1',
    slug: 'trip-counters',
    title: 'Expédition Écrins',
    description: null,
    destination_country_code: 'FR',
    destination_name: 'Massif des Écrins',
    start_date: '2026-07-01',
    end_date: '2026-07-08',
    status: 'planned',
    visibility: 'private',
    difficulty: 'hard',
    primary_activity: 'trekking',
    estimated_budget: 600,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'u1',
    group_id: null,
    share_token: null,
    metadata: null,
    created_at: '',
    updated_at: '',
    user_role: 'owner',
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
    collaborators: [],
    steps: [
      {
        id: 's1',
        trip_id: 'trip-counters-1',
        day_number: 1,
        order_index: 0,
        title: 'Étape 1',
        description: null,
        location_name: null,
        latitude: null,
        longitude: null,
        accommodation_name: null,
        transport_mode: 'foot',
        distance_km: 14,
        elevation_gain_m: 800,
        elevation_loss_m: 200,
        created_at: '',
        updated_at: '',
      },
      {
        id: 's2',
        trip_id: 'trip-counters-1',
        day_number: 2,
        order_index: 0,
        title: 'Étape 2',
        description: null,
        location_name: null,
        latitude: null,
        longitude: null,
        accommodation_name: null,
        transport_mode: 'foot',
        distance_km: 16,
        elevation_gain_m: 900,
        elevation_loss_m: 800,
        created_at: '',
        updated_at: '',
      },
    ],
    items: [
      {
        id: 'i1',
        trip_id: 'trip-counters-1',
        item_name: 'Duvet',
        category: 'sleep',
        quantity: 1,
        weight_grams: 800,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '',
        updated_at: '',
      },
    ],
    expenses: [
      {
        id: 'e1',
        trip_id: 'trip-counters-1',
        title: 'Refuge nuit 1',
        amount: 45,
        currency: 'EUR',
        paid_by_user_id: 'u1',
        payer_id: 'u1',
        split_type: 'equal',
        metadata: null,
        expense_date: '2026-07-01',
        created_at: '',
        updated_at: '',
      } as any,
    ],
    documents: [],
    pois: [],
    safety_checkpoints: [],
    notes: [],
    ...overrides,
  };
}

describe('Sous-phase 1.4 (D5, D6) — Compteurs dérivés des données réelles (TDD)', () => {
  it('TEST-COUNTERS-01: counters.itinerary === trip.steps.length (élimine l’écart D6)', () => {
    const trip = createMockTrip();
    const counters = getTripCounters(trip);

    expect(counters.itinerary).toBe(2);
    expect(counters.itinerary).toBe(trip.steps.length);
  });

  it('TEST-COUNTERS-02: Itinéraire vide -> counters.itinerary === 0 (pas de compteur fantôme)', () => {
    const emptyTrip = createMockTrip({ steps: [] });
    const counters = getTripCounters(emptyTrip);

    expect(counters.itinerary).toBe(0);
  });

  it('TEST-COUNTERS-03: counters.gear === renderedRecommendations.length (élimine l’écart D5)', () => {
    const trip = createMockTrip();
    const mockAnalysis: Partial<TripKitAnalysis> = {
      vitalGaps: [
        {
          id: 'rec-1',
          key: 'first-aid',
          name: 'Trousse',
          category: 'safety',
          priority: 'vital',
          reason: 'Obligatoire',
          weightGrams: 200,
          shopProduct: null,
        },
      ],
      recommendedGaps: [
        {
          id: 'rec-2',
          key: 'whistle',
          name: 'Sifflet',
          category: 'safety',
          priority: 'recommended',
          reason: 'Sécurité',
          weightGrams: 20,
          shopProduct: null,
        },
      ],
    };

    const counters = getTripCounters(trip, mockAnalysis as TripKitAnalysis);

    expect(counters.gearGapsTotal).toBe(2);
    expect(counters.gearItems).toBe(1); // 1 item in trip.items
  });
});
