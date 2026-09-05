import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TripTeamView } from '@/features/trips/components/TripTeamView';
import { TripBudgetView } from '@/features/trips/components/TripBudgetView';
import { TripDocumentsView } from '@/features/trips/components/TripDocumentsView';
import { TripShareModal } from '@/features/trips/components/TripShareModal';
import type { TripFull } from '@/features/trips/types/trip.types';

// Mock simple de next/navigation et server actions
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: any) =>
    React.createElement('a', { href, className }, children),
}));

vi.mock('@/app/voyages/collab-actions', () => ({
  inviteCollaboratorAction: vi.fn(),
  updateRoleAction: vi.fn(),
  removeCollaboratorAction: vi.fn(),
}));

vi.mock('@/app/voyages/budget-actions', () => ({
  addExpenseAction: vi.fn(),
  deleteExpenseAction: vi.fn(),
}));

vi.mock('@/app/voyages/document-actions', () => ({
  addTripDocumentAction: vi.fn(),
  deleteTripDocumentAction: vi.fn(),
}));

vi.mock('@/app/voyages/share-actions', () => ({
  updateTripVisibilityAction: vi.fn(),
}));

describe('UI Components — Chantier 7', () => {
  const dummyTrip: TripFull = {
    id: 'trip-alpha',
    slug: 'mont-blanc-express',
    title: 'Tour du Mont-Blanc Express',
    description: 'Trek engagé de 7 jours',
    destination_country_code: 'FR',
    destination_name: 'France',
    start_date: '2026-08-01',
    end_date: '2026-08-08',
    status: 'planned',
    visibility: 'unlisted',
    difficulty: 'hard',
    primary_activity: 'trekking',
    estimated_budget: 800,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-alice',
    group_id: null,
    share_token: 'secret-tok-xyz',
    metadata: {},
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    collaborators: [
      {
        id: 'collab-1',
        trip_id: 'trip-alpha',
        user_id: 'user-alice',
        role: 'owner',
        joined_at: '2026-06-01T10:00:00Z',
        invited_by: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
        profile: { full_name: 'Alice Alpiniste' },
      },
      {
        id: 'collab-2',
        trip_id: 'trip-alpha',
        user_id: 'user-bob',
        role: 'editor',
        joined_at: '2026-06-02T10:00:00Z',
        invited_by: 'user-alice',
        created_at: '2026-06-02T10:00:00Z',
        updated_at: '2026-06-02T10:00:00Z',
        profile: { full_name: 'Bob Bivouac' },
      },
    ],
    steps: [],
    items: [],
    expenses: [
      {
        id: 'exp-1',
        trip_id: 'trip-alpha',
        payer_id: 'user-alice',
        title: 'Nuitée Refuge Bonatti',
        amount: 140,
        currency: 'EUR',
        category: 'hébergement',
        expense_date: '2026-08-02',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
        payer: { full_name: 'Alice Alpiniste' },
      },
    ],
    documents: [
      {
        id: 'doc-1',
        trip_id: 'trip-alpha',
        user_id: 'user-alice',
        title: 'Passeport biométrique',
        category: 'passport',
        file_url: 'https://example.com/passport.pdf',
        file_name: 'passport.pdf',
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        expires_at: '2029-01-01',
        notes: 'Passeport valide 10 ans',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ],
    pois: [],
    safety_checkpoints: [],
    notes: [],
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
  };

  it('affiche TripTeamView avec les membres et le bouton d\'invitation pour l\'owner', () => {
    const html = renderToStaticMarkup(React.createElement(TripTeamView, { trip: dummyTrip }));

    expect(html).toContain('Équipe &amp; Compagnons de Route');
    expect(html).toContain('Alice Alpiniste');
    expect(html).toContain('Bob Bivouac');
    expect(html).toContain('Inviter un voyageur');
  });

  it('affiche TripBudgetView avec le total dépensé et les règlements de compte', () => {
    const html = renderToStaticMarkup(React.createElement(TripBudgetView, { trip: dummyTrip }));

    expect(html).toContain('Budget &amp; Partage des Dépenses');
    expect(html).toContain('140 EUR');
    expect(html).toContain('800 EUR');
    expect(html).toContain('Nuitée Refuge Bonatti');
  });

  it('affiche TripDocumentsView avec les alertes d\'échéance et le respect RGPD', () => {
    const html = renderToStaticMarkup(React.createElement(TripDocumentsView, { trip: dummyTrip }));

    expect(html).toContain('Papiers &amp; Documents Sécurisés');
    expect(html).toContain('Passeport biométrique');
    expect(html).toContain('Protection RGPD');
  });

  it('affiche TripShareModal avec le lien de partage et la sélection de visibilité', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripShareModal, {
        trip: dummyTrip,
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    expect(html).toContain('Partager &amp; Exporter l&#x27;Expédition');
    expect(html).toContain('Lien d&#x27;accès direct');
    expect(html).toContain('Trace GPX 1.1');
    expect(html).toContain('Feuille de Route / PDF');
  });
});
