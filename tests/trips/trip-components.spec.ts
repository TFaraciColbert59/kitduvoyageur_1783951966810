import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TripBadge } from '@/features/trips/components/TripBadge';
import { TripCard } from '@/features/trips/components/TripCard';
import { TripOverviewTab } from '@/features/trips/components/TripOverviewTab';
import { TripPlaceholderTab } from '@/features/trips/components/TripPlaceholderTab';
import type { TripFull, TripStats, TripWithDetails } from '@/features/trips/types/trip.types';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    React.createElement('img', { src, alt, className }),
}));

describe('Trips UI Components', () => {
  describe('TripBadge', () => {
    it('renders status badges with correct labels', () => {
      const htmlDraft = renderToStaticMarkup(React.createElement(TripBadge, { type: 'status', value: 'draft' }));
      expect(htmlDraft).toContain('Brouillon');

      const htmlPlanned = renderToStaticMarkup(React.createElement(TripBadge, { type: 'status', value: 'planned' }));
      expect(htmlPlanned).toContain('Planifié');

      const htmlActive = renderToStaticMarkup(React.createElement(TripBadge, { type: 'status', value: 'active' }));
      expect(htmlActive).toContain('En cours');

      const htmlCompleted = renderToStaticMarkup(React.createElement(TripBadge, { type: 'status', value: 'completed' }));
      expect(htmlCompleted).toContain('Terminé');

      const htmlCancelled = renderToStaticMarkup(React.createElement(TripBadge, { type: 'status', value: 'cancelled' }));
      expect(htmlCancelled).toContain('Annulé');
    });

    it('renders difficulty badges with correct labels', () => {
      const htmlEasy = renderToStaticMarkup(React.createElement(TripBadge, { type: 'difficulty', value: 'easy' }));
      expect(htmlEasy).toContain('Facile');

      const htmlModerate = renderToStaticMarkup(React.createElement(TripBadge, { type: 'difficulty', value: 'moderate' }));
      expect(htmlModerate).toContain('Modéré');

      const htmlExpert = renderToStaticMarkup(React.createElement(TripBadge, { type: 'difficulty', value: 'expert' }));
      expect(htmlExpert).toContain('Expert');
    });

    it('renders activity badges with correct labels', () => {
      const htmlHiking = renderToStaticMarkup(React.createElement(TripBadge, { type: 'activity', value: 'hiking' }));
      expect(htmlHiking).toContain('Randonnée');

      const htmlTrekking = renderToStaticMarkup(React.createElement(TripBadge, { type: 'activity', value: 'trekking' }));
      expect(htmlTrekking).toContain('Trek');

      const htmlBivouac = renderToStaticMarkup(React.createElement(TripBadge, { type: 'activity', value: 'bivouac' }));
      expect(htmlBivouac).toContain('Bivouac');
    });

    it('renders collaborator role badges', () => {
      const htmlOwner = renderToStaticMarkup(React.createElement(TripBadge, { type: 'role', value: 'owner' }));
      expect(htmlOwner).toContain('Organisateur');

      const htmlEditor = renderToStaticMarkup(React.createElement(TripBadge, { type: 'role', value: 'editor' }));
      expect(htmlEditor).toContain('Éditeur');

      const htmlViewer = renderToStaticMarkup(React.createElement(TripBadge, { type: 'role', value: 'viewer' }));
      expect(htmlViewer).toContain('Lecteur');
    });
  });

  describe('TripCard', () => {
    const mockTrip: TripWithDetails = {
      id: 'trip-101',
      user_id: 'user-abc',
      group_id: null,
      title: 'Tour des Annapurnas',
      slug: 'tour-des-annapurnas',
      description: 'Grand trek himalayen en autonomie partielle',
      destination_name: 'Népal',
      destination_country_code: 'NP',
      start_date: '2026-10-10',
      end_date: '2026-10-25',
      difficulty: 'hard',
      primary_activity: 'trekking',
      status: 'planned',
      visibility: 'public',
      estimated_budget: 1500,
      budget_currency: 'EUR',
      cover_image_url: null,
      share_token: null,
      metadata: {},
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      collaborators_count: 2,
      steps_count: 14,
    };

    it('renders trip title, destination, and badges', () => {
      const html = renderToStaticMarkup(React.createElement(TripCard, { trip: mockTrip }));
      expect(html).toContain('Tour des Annapurnas');
      expect(html).toContain('Népal');
      expect(html).toContain('Planifié');
    });

    it('renders steps and collaborators counts', () => {
      const html = renderToStaticMarkup(React.createElement(TripCard, { trip: mockTrip }));
      expect(html).toContain('14');
      expect(html).toContain('2');
    });

    it('links to the trip detail slug page', () => {
      const html = renderToStaticMarkup(React.createElement(TripCard, { trip: mockTrip }));
      expect(html).toContain('href="/voyages/tour-des-annapurnas"');
    });
  });

  describe('TripOverviewTab', () => {
    const mockTripFull: TripFull = {
      id: 'trip-101',
      user_id: 'user-abc',
      group_id: null,
      title: 'Tour des Annapurnas',
      slug: 'tour-des-annapurnas',
      description: 'Expédition complète',
      destination_name: 'Népal',
      destination_country_code: 'NP',
      start_date: '2026-10-10',
      end_date: '2026-10-25',
      difficulty: 'hard',
      primary_activity: 'trekking',
      status: 'planned',
      visibility: 'public',
      estimated_budget: 1500,
      budget_currency: 'EUR',
      cover_image_url: null,
      share_token: null,
      metadata: {},
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      collaborators: [
        {
          id: 'collab-1',
          trip_id: 'trip-101',
          user_id: 'user-abc',
          role: 'owner',
          invited_by: null,
          joined_at: '2026-09-01T00:00:00Z',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
          profile: {
            full_name: 'Jean Explorateur',
            username: 'jean_trek',
            avatar_url: null,
          },
        },
      ],
      steps: [
        {
          id: 'step-1',
          trip_id: 'trip-101',
          day_number: 1,
          title: 'Besisahar - Bahundanda',
          description: 'Première étape',
          location_name: 'Besisahar',
          latitude: 28.23,
          longitude: 84.37,
          distance_km: 14,
          elevation_gain_m: 550,
          elevation_loss_m: 100,
          transport_mode: 'foot',
          accommodation_name: 'Lodge',
          order_index: 0,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      items: [],
      expenses: [],
      documents: [],
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

    const mockStats: TripStats = {
      trip_id: 'trip-101',
      total_days: 16,
      total_distance_km: 210,
      total_elevation_gain_m: 8500,
      total_elevation_loss_m: 8500,
      items_packed: 15,
      items_total: 20,
      estimated_budget: 1500,
      total_spent: 450,
      participants_count: 1,
    };

    it('renders key metrics and gear progress bar', () => {
      const html = renderToStaticMarkup(
        React.createElement(TripOverviewTab, {
          trip: mockTripFull,
          stats: mockStats,
          onTabChange: () => {},
        })
      );
      expect(html).toContain('16');
      expect(html).toContain('jours');
      expect(html).toContain('210 km');
      expect(html).toContain('+8500m');
      expect(html).toContain('15 sur 20 emballés (75%)');
      expect(html).toContain('Jean Explorateur');
      expect(html).toContain('Besisahar - Bahundanda');
    });
  });

  describe('TripPlaceholderTab', () => {
    it('displays Master Plan badge and chantier info', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          TripPlaceholderTab,
          {
            chantierNumber: 4,
            chantierTitle: 'Shakedown Sac & Matériel',
            description: "Module d'optimisation du poids",
            hasData: true,
            children: React.createElement('div', null, 'Tente ultra-légère - 1.2 kg'),
          }
        )
      );

      expect(html).toContain('Chantier 4');
      expect(html).toContain('Shakedown Sac &amp; Matériel');
      expect(html).toContain('Tente ultra-légère - 1.2 kg');
    });
  });
});
