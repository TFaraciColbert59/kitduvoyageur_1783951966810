import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlaceCard, getCategoryLabel } from '@/features/places/components/PlaceCard';
import { AddPlaceToTripModal } from '@/features/places/components/AddPlaceToTripModal';
import { PlaceDetailClient } from '@/features/places/components/PlaceDetailClient';
import type { PlaceWithDistance, PlaceReview } from '@/features/places/types/place.types';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

describe('Place UI Components (Apple HIG & Liquid Glass)', () => {
  const dummyPlace: PlaceWithDistance = {
    id: 'place-1',
    slug: 'refuge-du-gouter',
    name: 'Refuge du Goûter',
    category: 'refuge',
    country_code: 'FR',
    region: 'Haute-Savoie',
    city: 'Saint-Gervais',
    latitude: 45.85,
    longitude: 6.83,
    altitude_m: 3835,
    description: 'Plus haut refuge gardé de France.',
    sensitivity: 'standard',
    source: 'curated',
    osm_id: null,
    author_id: null,
    is_verified: true,
    practical_info: {
      waterAvailable: true,
      bookingRequired: true,
      capacity: 120,
    },
    bayesian_rating: 4.6,
    reviews_count: 15,
    created_at: '2026-09-05T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
    is_blurred: false,
    blur_radius_m: 0,
  };

  describe('getCategoryLabel', () => {
    it('translates place categories into French labels', () => {
      expect(getCategoryLabel('refuge')).toBe('Refuge Alpin');
      expect(getCategoryLabel('bivouac')).toBe('Bivouac');
      expect(getCategoryLabel('water_source')).toBe('Source d’Eau');
      expect(getCategoryLabel('pass')).toBe('Col');
      expect(getCategoryLabel('viewpoint')).toBe('Belvédère');
      expect(getCategoryLabel('lake')).toBe('Lac');
    });
  });

  describe('PlaceCard', () => {
    it('renders place card with title, category, altitude, and rating', () => {
      const html = renderToStaticMarkup(
        React.createElement(PlaceCard, { place: dummyPlace })
      );

      expect(html).toContain('Refuge du Goûter');
      expect(html).toContain('Refuge Alpin');
      expect(html).toContain('3835 m');
      expect(html).toContain('4.6');
      expect(html).toContain('15 avis');
      expect(html).toContain('Vérifié');
    });

    it('renders blurring warning banner when place is sensitive', () => {
      const sensitivePlace: PlaceWithDistance = {
        ...dummyPlace,
        name: 'Bivouac Fragile',
        sensitivity: 'sensitive',
        is_blurred: true,
        blur_radius_m: 500,
      };

      const html = renderToStaticMarkup(
        React.createElement(PlaceCard, { place: sensitivePlace })
      );

      expect(html).toContain('Zone fragile : coordonnées floutées à ~500m');
    });

    it('renders action button when onAddToTrip is provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(PlaceCard, {
          place: dummyPlace,
          onAddToTrip: () => {},
        })
      );

      expect(html).toContain('Ajouter à mon voyage');
    });
  });

  describe('AddPlaceToTripModal', () => {
    it('renders modal with trip selector and day buttons', () => {
      const userTrips = [
        { id: 'trip-1', title: 'Tour du Mont-Blanc', slug: 'tmb', duration_days: 7 },
      ];

      const html = renderToStaticMarkup(
        React.createElement(AddPlaceToTripModal, {
          place: dummyPlace,
          isOpen: true,
          onClose: () => {},
          userTrips,
        })
      );

      expect(html).toContain('Ajouter à un Voyage');
      expect(html).toContain('Tour du Mont-Blanc (7 jours)');
      expect(html).toContain('Jour 1');
      expect(html).toContain('Jour 7');
      expect(html).toContain('Confirmer l’ajout');
    });
  });

  describe('PlaceDetailClient', () => {
    it('renders complete place details, practical info and reviews', () => {
      const dummyReviews: PlaceReview[] = [
        {
          id: 'rev-1',
          place_id: 'place-1',
          author_id: 'user-1',
          rating: 5,
          comment: 'Accueil formidable au refuge.',
          has_field_proof: true,
          visit_date: '2026-08-10',
          created_at: '2026-08-10T12:00:00Z',
          updated_at: '2026-08-10T12:00:00Z',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(PlaceDetailClient, {
          place: dummyPlace,
          reviews: dummyReviews,
          photos: [],
          userTrips: [],
        })
      );

      expect(html).toContain('Refuge du Goûter');
      expect(html).toContain('Informations Pratiques &amp; Équipements');
      expect(html).toContain('Preuve terrain certifiée');
      expect(html).toContain('Accueil formidable au refuge.');
      expect(html).toContain('Ajouter à mon voyage');
      expect(html).toContain('Signaler un problème');
    });
  });
});
