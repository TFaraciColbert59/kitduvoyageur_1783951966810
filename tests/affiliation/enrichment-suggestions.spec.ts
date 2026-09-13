import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  parseEnrichmentSuggestions,
  resolveEnrichmentSuggestions,
} from '@/features/affiliation/engine/enrichmentSuggestions';
import { TripSuggestionSection } from '@/features/affiliation/components/TripSuggestionSection';
import { TripAffiliateProvider } from '@/features/affiliation/components/TripAffiliateProvider';
import type { AffiliateLink } from '@/features/affiliation/types/affiliate.types';

/**
 * IMPORTANT 3 — les `suggestions` LLM ne sont plus des données mortes : elles
 * sont rendues via la machinerie T8 (catégorie → lien actif), et une suggestion
 * sans lien actif correspondant est omise entièrement (aucune rangée morte).
 */

function makeLink(overrides: Partial<AffiliateLink> & { id: string; slug: string }): AffiliateLink {
  return {
    partner_id: 'partner-booking',
    partner: {
      id: 'partner-booking',
      slug: 'booking',
      name: 'Booking.com',
      network: 'travelpayouts',
      website_url: 'https://www.booking.com',
      commission_rate_desc: '3% à 4%',
      is_active: true,
      created_at: '2026-09-05T00:00:00Z',
    },
    category: 'hotel',
    country_code: 'FR',
    title: 'Hôtels & Refuges',
    destination_name: null,
    target_url: 'https://www.booking.com/searchresults.fr.html',
    tracking_params: { marker: '584920' },
    is_active: true,
    created_at: '2026-09-05T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
    ...overrides,
  };
}

const HOTEL_LINK = makeLink({
  id: 'link-chamonix',
  slug: 'booking-chamonix-hotel',
  destination_name: 'Chamonix-Mont-Blanc',
});

const CONTEXT = { destinationName: 'Chamonix-Mont-Blanc' };

describe('parseEnrichmentSuggestions — lecture défensive', () => {
  it('lit les suggestions valides et borne les entrées malformées', () => {
    const parsed = parseEnrichmentSuggestions({
      enrichment_suggestions: [
        { category: 'hotel', label: 'Nuit près du départ', searchTerms: 'hôtel Chamonix centre' },
        { category: 'inconnu', label: 'x', searchTerms: 'y' },
        { category: 'flight', label: '   ', searchTerms: 'vol' },
        { category: 'esim', label: 'eSIM', searchTerms: 'esim europe' },
      ],
    });

    expect(parsed).toEqual([
      { category: 'hotel', label: 'Nuit près du départ', searchTerms: 'hôtel Chamonix centre' },
      { category: 'esim', label: 'eSIM', searchTerms: 'esim europe' },
    ]);
  });

  it('retourne [] sans métadonnées ou sans tableau', () => {
    expect(parseEnrichmentSuggestions(null)).toEqual([]);
    expect(parseEnrichmentSuggestions({})).toEqual([]);
    expect(parseEnrichmentSuggestions({ enrichment_suggestions: 'hotel' })).toEqual([]);
  });
});

describe('resolveEnrichmentSuggestions — catégorie dure, destination-aware', () => {
  it('résout la suggestion vers le lien actif de sa catégorie', () => {
    const resolved = resolveEnrichmentSuggestions(
      [{ category: 'hotel', label: 'Nuit', searchTerms: 'hôtel Chamonix' }],
      [HOTEL_LINK],
      CONTEXT
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      label: 'Nuit',
      searchTerms: 'hôtel Chamonix',
      slug: 'booking-chamonix-hotel',
      partnerName: 'Booking.com',
    });
  });

  it('sans candidat de la catégorie → suggestion omise', () => {
    const resolved = resolveEnrichmentSuggestions(
      [{ category: 'esim', label: 'eSIM', searchTerms: 'esim europe' }],
      [HOTEL_LINK],
      CONTEXT
    );

    expect(resolved).toEqual([]);
  });

  it('destination sans correspondance → suggestion omise (résolveur durci)', () => {
    const parisLink = makeLink({
      id: 'link-paris',
      slug: 'booking-paris-hotel',
      destination_name: 'Paris',
    });
    const resolved = resolveEnrichmentSuggestions(
      [{ category: 'hotel', label: 'Nuit', searchTerms: 'hôtel Chamonix' }],
      [parisLink],
      CONTEXT
    );

    expect(resolved).toEqual([]);
  });
});

describe('TripSuggestionSection — rendu compact, jamais de rangée morte', () => {
  it('rend le label, les searchTerms en sous-titre et le href /go', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripAffiliateProvider, {
        value: { links: [HOTEL_LINK], bookingByStepId: {} },
        children: React.createElement(TripSuggestionSection, {
          suggestions: [{ category: 'hotel', label: 'Nuit', searchTerms: 'hôtel Chamonix' }],
          destinationName: 'Chamonix-Mont-Blanc',
          tripId: 'trip-1',
        }),
      })
    );

    expect(html).toContain('Suggestions de réservation');
    expect(html).toContain('href="/go/booking-chamonix-hotel?trip_id=trip-1"');
    expect(html).toContain('rel="sponsored nofollow"');
    expect(html).toContain('Nuit');
    expect(html).toContain('hôtel Chamonix');
  });

  it('sans lien actif correspondant, le bloc entier est omis', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripAffiliateProvider, {
        value: { links: [], bookingByStepId: {} },
        children: React.createElement(TripSuggestionSection, {
          suggestions: [{ category: 'hotel', label: 'Nuit', searchTerms: 'hôtel Chamonix' }],
          destinationName: 'Chamonix-Mont-Blanc',
          tripId: 'trip-1',
        }),
      })
    );

    expect(html).toBe('');
  });
});
