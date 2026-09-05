import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TripNotesView } from '@/features/trips/components/TripNotesView';
import { TripCompletionModal } from '@/features/trips/components/TripCompletionModal';
import type { TripFull } from '@/features/trips/types/trip.types';

// Mock de next/navigation et server actions
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/app/voyages/completion-actions', () => ({
  addTripNoteAction: vi.fn(),
  deleteTripNoteAction: vi.fn(),
  updateTripStatusAction: vi.fn(),
  publishTripCarnetAction: vi.fn(),
  submitTripFieldReviewsAction: vi.fn(),
}));

describe('TripNotesView & TripCompletionModal — Chantier 8 UI', () => {
  const mockTripFull: TripFull = {
    id: 'trip-alpha',
    slug: 'mont-blanc-express',
    title: 'Tour du Mont-Blanc Express',
    description: 'Trek engagé de 7 jours',
    destination_country_code: 'FR',
    destination_name: 'Chamonix',
    start_date: '2026-08-01',
    end_date: '2026-08-08',
    status: 'active',
    visibility: 'public',
    difficulty: 'hard',
    primary_activity: 'trekking',
    estimated_budget: 800,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-alice',
    group_id: null,
    share_token: 'secret-tok-xyz',
    metadata: {},
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-01T10:00:00Z',
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
        trip_id: 'trip-alpha',
        user_id: 'user-alice',
        role: 'owner',
        joined_at: '2026-07-01T10:00:00Z',
        invited_by: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
        profile: { full_name: 'Alice Alpiniste' },
      },
    ],
    steps: [
      {
        id: 's-1',
        trip_id: 'trip-alpha',
        day_number: 1,
        order_index: 0,
        title: 'Étape 1',
        description: null,
        location_name: 'Les Houches',
        latitude: 45.89,
        longitude: 6.79,
        accommodation_name: 'Refuge 1',
        transport_mode: 'foot',
        distance_km: 15.2,
        elevation_gain_m: 850,
        elevation_loss_m: 200,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ],
    items: [
      {
        id: 'i-1',
        trip_id: 'trip-alpha',
        item_name: 'Sac de couchage',
        category: 'Bivouac',
        quantity: 1,
        weight_grams: 950,
        is_packed: true,
        status: 'packed',
        packed_by: 'user-alice',
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ],
    expenses: [],
    documents: [],
    pois: [
      {
        id: 'poi-1',
        trip_id: 'trip-alpha',
        step_id: 's-1',
        name: 'Refuge du Fioux',
        category: 'refuge',
        latitude: 45.8,
        longitude: 6.7,
        notes: null,
        visited: true,
        osm_id: 'place-refuge-fioux',
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ],
    safety_checkpoints: [],
    notes: [
      {
        id: 'n-1',
        trip_id: 'trip-alpha',
        author_id: 'user-alice',
        title: 'Arrivée sous la pluie',
        content: 'Sentier boueux mais accueil chaleureux au refuge.',
        day_number: 1,
        is_pinned: true,
        created_at: '2026-08-01T18:00:00Z',
        updated_at: '2026-08-01T18:00:00Z',
        author: { full_name: 'Alice Alpiniste' },
      },
    ],
  };

  it('1. rend TripNotesView avec le titre du carnet, les boutons d\'action et la note épinglée', () => {
    const html = renderToStaticMarkup(React.createElement(TripNotesView, { trip: mockTripFull }));

    expect(html).toContain('Carnet de bord &amp; Récits de voyage');
    expect(html).toContain('Arrivée sous la pluie');
    expect(html).toContain('Sentier boueux mais accueil chaleureux au refuge.');
    expect(html).toContain('Alice Alpiniste');
    expect(html).toContain('Jour 1');
    expect(html).toContain('Épinglé');
    expect(html).toContain('Clôturer le voyage');
    expect(html).toContain('Ajouter un récit');
  });

  it('2. rend TripNotesView à l\'état vide avec encouragement à écrire', () => {
    const emptyTrip = { ...mockTripFull, notes: [] };
    const html = renderToStaticMarkup(React.createElement(TripNotesView, { trip: emptyTrip }));

    expect(html).toContain('Aucune note enregistrée');
    expect(html).toContain('Racontez votre première étape');
    expect(html).toContain('Écrire dans le carnet');
  });

  it('3. rend TripNotesView pour un voyage clôturé (status = completed)', () => {
    const completedTrip = { ...mockTripFull, status: 'completed' as const };
    const html = renderToStaticMarkup(React.createElement(TripNotesView, { trip: completedTrip }));

    expect(html).toContain('Expédition terminée · Carnet de bord clôturé');
    expect(html).toContain('Bilan &amp; Rétrospective');
  });

  it('4. rend TripCompletionModal avec métriques, options carnet et avis certifiés', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripCompletionModal, {
        trip: mockTripFull,
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    expect(html).toContain('Rétrospective &amp; Carnet de Voyage');
    expect(html).toContain('15.2 km'); // metrics totalKm
    expect(html).toContain('+850 m'); // elevation gain
    expect(html).toContain('Publier en carnet de bord communautaire');
    expect(html).toContain('Refuge du Fioux'); // Visited place candidate
    expect(html).toContain('Certifier vos lieux visités (Preuve terrain)');
    expect(html).toContain('Valider &amp; Clôturer l&#x27;expédition');
  });
});
