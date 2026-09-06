import { describe, it, expect } from 'vitest';
import { getTripElevationProfile, type ElevationProfile } from '@/features/trips/lib/elevation';
import type { TripFull } from '@/features/trips/types/trip.types';

function createMockTrip(overrides: Partial<TripFull> = {}): TripFull {
  return {
    id: 'test-trip-id',
    slug: 'voyage-test',
    title: 'Randonnée Test',
    description: null,
    destination_country_code: 'FR',
    destination_name: 'Bretagne - GR34',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    status: 'planned',
    visibility: 'private',
    difficulty: 'moderate',
    primary_activity: 'hiking',
    estimated_budget: 500,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-1',
    group_id: null,
    share_token: null,
    metadata: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_role: 'owner',
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
    collaborators: [],
    steps: [],
    items: [],
    expenses: [],
    documents: [],
    pois: [],
    safety_checkpoints: [],
    notes: [],
    ...overrides,
  };
}

describe('Sous-phase 1.2 (D2) — Source unique du profil d’altitude (TDD)', () => {
  it('TEST-ELEVATION-01: Priorité 1 — Étapes avec altitude explicite (stages)', () => {
    const trip = createMockTrip({
      steps: [
        {
          id: 'step-1',
          trip_id: 'test-trip-id',
          day_number: 1,
          order_index: 0,
          title: 'Montée au refuge',
          description: null,
          location_name: 'Refuge du Glacier',
          latitude: 45.8,
          longitude: 6.8,
          accommodation_name: null,
          transport_mode: 'foot',
          distance_km: 12,
          elevation_gain_m: 800,
          elevation_loss_m: 100,
          created_at: '',
          updated_at: '',
          // metadata or custom field
          ...( { elevation_max_m: 2150, elevation_min_m: 1200 } as any ),
        },
        {
          id: 'step-2',
          trip_id: 'test-trip-id',
          day_number: 2,
          order_index: 0,
          title: 'Passage du Col Alpin',
          description: null,
          location_name: 'Col Alpin',
          latitude: 45.85,
          longitude: 6.85,
          accommodation_name: null,
          transport_mode: 'foot',
          distance_km: 15,
          elevation_gain_m: 950,
          elevation_loss_m: 800,
          created_at: '',
          updated_at: '',
          ...( { elevation_max_m: 2780, elevation_min_m: 1800 } as any ),
        },
      ],
    });

    const profile = getTripElevationProfile(trip);

    expect(profile.source).toBe('stages');
    expect(profile.confidence).toBe('high');
    expect(profile.maxM).toBe(2780);
    expect(profile.minM).toBe(1200);
    expect(profile.gainM).toBe(1750); // 800 + 950
  });

  it('TEST-ELEVATION-02: Priorité 2 — Template de route pilote (route_template)', () => {
    const trip = createMockTrip({
      slug: 'tour-du-mont-blanc',
      title: 'Tour du Mont-Blanc',
      destination_name: 'Chamonix / Massif du Mont-Blanc',
      destination_country_code: 'FR',
      steps: [], // Pas d'altitudes sur les étapes
    });

    const profile = getTripElevationProfile(trip);

    expect(profile.source).toBe('route_template');
    expect(profile.confidence).toBe('medium');
    expect(profile.maxM).toBeGreaterThanOrEqual(2500); // Grand Col Ferret 2537m
  });

  it('TEST-ELEVATION-03: Priorité 3 — Lieux géoréférencés / POIs (places)', () => {
    const trip = createMockTrip({
      slug: 'rando-inconnue',
      title: 'Trek Découverte',
      destination_country_code: 'FR',
      metadata: {
        places: [
          { name: 'Belvédère', elevation_m: 1420 },
          { name: 'Pic Local', elevation_m: 1890 },
        ],
      },
    });

    const profile = getTripElevationProfile(trip);

    expect(profile.source).toBe('places');
    expect(profile.confidence).toBe('medium');
    expect(profile.maxM).toBe(1890);
  });

  it('TEST-ELEVATION-04: Priorité 4 — Valeur pays (country_fallback) marquée low', () => {
    const trip = createMockTrip({
      slug: 'escapade-plaine',
      title: 'Escapade Plaine',
      destination_country_code: 'FR',
      steps: [],
      metadata: null,
    });

    const profile = getTripElevationProfile(trip);

    expect(profile.source).toBe('country_fallback');
    expect(profile.confidence).toBe('low');
    expect(profile.maxM).toBeLessThanOrEqual(500);
  });

  it('TEST-ELEVATION-05: Absence totale de données -> fallback gracieux à 0 low', () => {
    const trip = createMockTrip({
      slug: 'sans-destination',
      title: 'Voyage Inconnu',
      destination_country_code: null,
      destination_name: null,
      steps: [],
    });

    const profile = getTripElevationProfile(trip);

    expect(profile.source).toBe('country_fallback');
    expect(profile.confidence).toBe('low');
    expect(profile.maxM).toBe(0);
  });

  it('TEST-ELEVATION-06: Anti-D2 — Dénivelé étape (+54m) n’est PAS confondu avec l’altitude max', () => {
    const trip = createMockTrip({
      title: 'Balade Les Houches',
      destination_country_code: 'FR',
      steps: [
        {
          id: 'step-1',
          trip_id: 'test-trip-id',
          day_number: 1,
          order_index: 0,
          title: 'Petite boucle',
          description: null,
          location_name: 'Les Houches',
          latitude: 45.89,
          longitude: 6.79,
          accommodation_name: null,
          transport_mode: 'foot',
          distance_km: 3,
          elevation_gain_m: 54, // D+ de 54 mètres
          elevation_loss_m: 54,
          created_at: '',
          updated_at: '',
        },
      ],
    });

    const profile = getTripElevationProfile(trip);

    // Ne doit PAS renvoyer 54m comme altitude max !
    // Les Houches est en vallée de Chamonix (~1000m) ou via country/template
    expect(profile.maxM).not.toBe(54);
    expect(profile.gainM).toBe(54); // gainM est bien 54m
  });

  it('TEST-ELEVATION-07: Règle des 2400m — maxM > 2400m déclenche filtre à eau + doudoune grand froid + couverture survie ; maxM <= 2400m ne les déclenche pas', async () => {
    const { generateTripContextualKit } = await import('@/features/trips/engine/contextualKitEngine');

    // Cas 1 : Voyage haute montagne (maxM = 2600m)
    const highAltAnalysis = generateTripContextualKit({
      countryCode: 'FR',
      durationDays: 7,
      elevationProfile: {
        maxM: 2600,
        minM: 1000,
        gainM: 4500,
        source: 'stages',
        confidence: 'high',
      },
    });

    const highGaps = highAltAnalysis.gearGaps.map((g) => g.key);
    expect(highGaps).toContain('water-filter');
    expect(highGaps).toContain('cold-down-jacket');
    expect(highGaps).toContain('survival-blanket');

    // Cas 2 : Voyage moyenne altitude / plaine (maxM = 1800m)
    const lowAltAnalysis = generateTripContextualKit({
      countryCode: 'FR',
      durationDays: 7,
      elevationProfile: {
        maxM: 1800,
        minM: 200,
        gainM: 1200,
        source: 'stages',
        confidence: 'high',
      },
    });

    const lowGaps = lowAltAnalysis.gearGaps.map((g) => g.key);
    expect(lowGaps).not.toContain('water-filter');
    expect(lowGaps).not.toContain('cold-down-jacket');
    expect(lowGaps).not.toContain('survival-blanket');
  });

  it('TEST-ELEVATION-08: Anti-D2 intégration — Voyage France plaine/côte ne propose pas Aiguille du Midi ni secours hélico haute montagne', async () => {
    const { filterAffiliateLinksForTrip } = await import('@/features/affiliation/data/affiliateSeed');

    const bretagneTrip = createMockTrip({
      destination_name: 'Tour de Bretagne GR34',
      destination_country_code: 'FR',
    });

    const profile = getTripElevationProfile(bretagneTrip);
    expect(profile.maxM).toBeLessThanOrEqual(2400);

    const relevantOffers = filterAffiliateLinksForTrip('FR', profile.maxM);

    const offerSlugs = relevantOffers.map((o) => o.slug);
    expect(offerSlugs).not.toContain('getyourguide-activites-chamonix-mont-blanc');
    expect(offerSlugs).not.toContain('chapka-assurance-trek-alpes-france');
  });
});

