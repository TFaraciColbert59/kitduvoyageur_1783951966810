import { describe, it, expect } from 'vitest';
import {
  calculateTripRetrospectiveMetrics,
  convertTripToCarnetData,
  extractCertifiedPlaceCandidates,
} from '@/features/trips/engine/carnetConversionEngine';
import type { TripFull } from '@/features/trips/types/trip.types';

describe('carnetConversionEngine — Chantier 8 (TDD)', () => {
  const mockTripFull: TripFull = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'tour-du-mont-blanc-7j',
    title: 'Tour du Mont-Blanc Classique',
    description: 'Une aventure de 7 jours autour du massif du Mont-Blanc.',
    destination_country_code: 'FR',
    destination_name: 'Chamonix-Mont-Blanc',
    start_date: '2026-07-10',
    end_date: '2026-07-17',
    status: 'completed',
    visibility: 'public',
    difficulty: 'hard',
    primary_activity: 'trekking',
    estimated_budget: 800,
    budget_currency: 'EUR',
    cover_image_url: 'https://images.unsplash.com/photo-tmb.jpg',
    user_id: 'user-owner-123',
    group_id: null,
    share_token: 'abc123token',
    metadata: {},
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-07-18T18:00:00Z',
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
    collaborators: [
      {
        id: 'c-1',
        trip_id: '11111111-1111-4111-8111-111111111111',
        user_id: 'user-owner-123',
        role: 'owner',
        joined_at: '2026-06-01T10:00:00Z',
        invited_by: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
        profile: { full_name: 'Tony Faraci' },
      },
      {
        id: 'c-2',
        trip_id: '11111111-1111-4111-8111-111111111111',
        user_id: 'user-collab-456',
        role: 'editor',
        joined_at: '2026-06-02T10:00:00Z',
        invited_by: 'user-owner-123',
        created_at: '2026-06-02T10:00:00Z',
        updated_at: '2026-06-02T10:00:00Z',
        profile: { full_name: 'Sophie Guide' },
      },
    ],
    steps: [
      {
        id: 's-1',
        trip_id: '11111111-1111-4111-8111-111111111111',
        day_number: 1,
        order_index: 0,
        title: 'Les Houches → Refuge du Fioux',
        description: 'Montée par le col de Voza.',
        location_name: 'Les Houches',
        latitude: 45.89,
        longitude: 6.798,
        accommodation_name: 'Refuge du Fioux',
        transport_mode: 'foot',
        distance_km: 14.5,
        elevation_gain_m: 950,
        elevation_loss_m: 350,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 's-2',
        trip_id: '11111111-1111-4111-8111-111111111111',
        day_number: 2,
        order_index: 0,
        title: 'Refuge du Fioux → Refuge de la Croix du Bonhomme',
        description: 'Passage par le col du Bonhomme.',
        location_name: 'Col du Bonhomme',
        latitude: 45.75,
        longitude: 6.71,
        accommodation_name: 'Refuge de la Croix du Bonhomme',
        transport_mode: 'foot',
        distance_km: 18.2,
        elevation_gain_m: 1300,
        elevation_loss_m: 400,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ],
    items: [
      {
        id: 'i-1',
        trip_id: '11111111-1111-4111-8111-111111111111',
        item_name: 'Tente Ultralégère 2P',
        category: 'Abri',
        quantity: 1,
        weight_grams: 1200,
        is_packed: true,
        status: 'packed',
        packed_by: 'user-owner-123',
        inventory_item_id: null,
        affiliate_link_id: null,
        priority: 'vital',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 'i-2',
        trip_id: '11111111-1111-4111-8111-111111111111',
        item_name: 'Duvet 0°C',
        category: 'Couchage',
        quantity: 1,
        weight_grams: 850,
        is_packed: true,
        status: 'packed',
        packed_by: 'user-owner-123',
        inventory_item_id: null,
        affiliate_link_id: null,
        priority: 'vital',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 'i-3',
        trip_id: '11111111-1111-4111-8111-111111111111',
        item_name: 'Bâtons télescopiques (oubliés)',
        category: 'Progression',
        quantity: 1,
        weight_grams: 480,
        is_packed: false,
        status: 'needed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ],
    expenses: [
      {
        id: 'e-1',
        trip_id: '11111111-1111-4111-8111-111111111111',
        payer_id: 'user-owner-123',
        title: 'Nuitée Bonhomme',
        amount: 140,
        currency: 'EUR',
        category: 'hébergement',
        expense_date: '2026-07-11',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-11T10:00:00Z',
        updated_at: '2026-07-11T10:00:00Z',
      },
      {
        id: 'e-2',
        trip_id: '11111111-1111-4111-8111-111111111111',
        payer_id: 'user-collab-456',
        title: 'Ravitaillement Les Contamines',
        amount: 60,
        currency: 'EUR',
        category: 'nourriture',
        expense_date: '2026-07-11',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-11T12:00:00Z',
        updated_at: '2026-07-11T12:00:00Z',
      },
    ],
    documents: [
      {
        id: 'doc-1',
        trip_id: '11111111-1111-4111-8111-111111111111',
        user_id: 'user-owner-123',
        title: 'Passeport Tony',
        category: 'passport',
        file_url: 'https://secure.lkdv.fr/passport.pdf',
        file_name: 'passport.pdf',
        file_size_bytes: 1024000,
        mime_type: 'application/pdf',
        expires_at: '2030-01-01',
        notes: 'Strictement confidentiel',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ],
    pois: [
      {
        id: 'poi-1',
        trip_id: '11111111-1111-4111-8111-111111111111',
        step_id: 's-1',
        name: 'Col de Voza',
        category: 'viewpoint',
        latitude: 45.87,
        longitude: 6.78,
        notes: 'Vue panoramique magnifique',
        visited: true,
        osm_id: 'place-refuge-1',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 'poi-2',
        trip_id: '11111111-1111-4111-8111-111111111111',
        step_id: 's-2',
        name: 'Refuge du Bonhomme',
        category: 'refuge',
        latitude: 45.75,
        longitude: 6.71,
        notes: 'Très bon accueil et soupe chaude',
        visited: true,
        osm_id: 'place-refuge-bonhomme',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ],
    safety_checkpoints: [],
    notes: [
      {
        id: 'n-1',
        trip_id: '11111111-1111-4111-8111-111111111111',
        author_id: 'user-owner-123',
        title: 'Départ sous un soleil radieux',
        content: 'Première ascension vers le col de Voza avec les sacs bien calés.',
        day_number: 1,
        is_pinned: true,
        created_at: '2026-07-10T16:00:00Z',
        updated_at: '2026-07-10T16:00:00Z',
        author: { full_name: 'Tony Faraci' },
      },
      {
        id: 'n-2',
        trip_id: '11111111-1111-4111-8111-111111111111',
        author_id: 'user-collab-456',
        title: 'Tempête au col du Bonhomme',
        content: 'Vent à 70 km/h mais quel spectacle minéral ! Arrivée réconfortante au refuge.',
        day_number: 2,
        is_pinned: false,
        created_at: '2026-07-11T19:00:00Z',
        updated_at: '2026-07-11T19:00:00Z',
        author: { full_name: 'Sophie Guide' },
      },
    ],
  };

  it('1. calcule fidèlement les métriques de bilan du voyage (distance, D+, poids, nuits)', () => {
    const metrics = calculateTripRetrospectiveMetrics(mockTripFull);

    expect(metrics.totalKm).toBe(32.7); // 14.5 + 18.2
    expect(metrics.totalElevationGainM).toBe(2250); // 950 + 1300
    expect(metrics.totalElevationLossM).toBe(750); // 350 + 400
    expect(metrics.durationDays).toBe(8); // 10 au 17 juillet = 8 jours
    expect(metrics.nbNuits).toBe(7);
    expect(metrics.stepsCount).toBe(2);
    expect(metrics.visitedPoisCount).toBe(2);
    expect(metrics.packedGearCount).toBe(2); // 2 articles emportés (le 3e était needed)
    expect(metrics.packedWeightKg).toBe(2.05); // 1200g + 850g = 2050g = 2.05 kg
    expect(metrics.totalExpenses).toBe(200); // 140 + 60
    expect(metrics.currency).toBe('EUR');
  });

  it('2. convertit un voyage en structure de carnet communautaire avec métadonnées enrichies', () => {
    const result = convertTripToCarnetData(mockTripFull, {
      customTitle: 'Notre Tour du Mont-Blanc 2026',
      isPublic: true,
      authorName: 'Tony & Sophie',
    });

    expect(result.carnet.title).toBe('Notre Tour du Mont-Blanc 2026');
    expect(result.carnet.destination).toBe('Chamonix-Mont-Blanc');
    expect(result.carnet.distance_km).toBe(32.7);
    expect(result.carnet.denivele_m).toBe(2250);
    expect(result.carnet.nb_nuits).toBe(7);
    expect(result.carnet.nb_voyageurs).toBe(2);
    expect(result.carnet.visibility).toBe('public');
    expect(result.carnet.country_iso).toBe('FR');
    expect(result.carnet.trip_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.carnet.tags).toEqual(expect.arrayContaining(['trekking', 'hard', 'Chamonix-Mont-Blanc']));
  });

  it('3. transforme les récits quotidiens (trip_notes) en moments de carnet (carnet_moments)', () => {
    const result = convertTripToCarnetData(mockTripFull);

    expect(result.moments).toHaveLength(2);
    expect(result.moments[0]).toMatchObject({
      jour_numero: 1,
      citation: 'Départ sous un soleil radieux : Première ascension vers le col de Voza avec les sacs bien calés.',
      auteur_nom: 'Tony Faraci',
      auteur_id: 'user-owner-123',
      lieu: 'Les Houches',
    });
    expect(result.moments[1]).toMatchObject({
      jour_numero: 2,
      citation: 'Tempête au col du Bonhomme : Vent à 70 km/h mais quel spectacle minéral ! Arrivée réconfortante au refuge.',
      auteur_nom: 'Sophie Guide',
      auteur_id: 'user-collab-456',
      lieu: 'Col du Bonhomme',
    });
  });

  it('4. convertit le matériel réel emporté (is_packed = true) en kit du carnet', () => {
    const result = convertTripToCarnetData(mockTripFull);

    expect(result.kitItems).toHaveLength(2);
    expect(result.kitItems[0]).toMatchObject({
      nom: 'Tente Ultralégère 2P',
      detail: 'Abri',
      poids_g: 1200,
      couleur_tag: '#17402C',
      sort_order: 0,
    });
    expect(result.kitItems[1]).toMatchObject({
      nom: 'Duvet 0°C',
      detail: 'Couchage',
      poids_g: 850,
      couleur_tag: '#17402C',
      sort_order: 1,
    });
  });

  it('5. INVARIANT SÉCURITÉ RGPD : zéro fuite de documents ou de ventilations financières privées', () => {
    const result = convertTripToCarnetData(mockTripFull);

    // Aucune trace de documents personnels (passeports, assurances)
    const jsonStr = JSON.stringify(result);
    expect(jsonStr).not.toContain('passport.pdf');
    expect(jsonStr).not.toContain('https://secure.lkdv.fr/passport.pdf');
    expect(jsonStr).not.toContain('Strictement confidentiel');

    // Aucune trace de dépenses individuelles nominatives
    expect(jsonStr).not.toContain('Nuitée Bonhomme');
    expect(jsonStr).not.toContain('Ravitaillement Les Contamines');
  });

  it('6. extrait les candidats pour avis certifiés terrain (has_field_proof) avec déduplication', () => {
    const candidates = extractCertifiedPlaceCandidates(mockTripFull);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      placeId: 'place-refuge-1',
      name: 'Col de Voza',
      category: 'viewpoint',
    });
    expect(candidates[1]).toEqual({
      placeId: 'place-refuge-bonhomme',
      name: 'Refuge du Bonhomme',
      category: 'refuge',
    });
  });
});
