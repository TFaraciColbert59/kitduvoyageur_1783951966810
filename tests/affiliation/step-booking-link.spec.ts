import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildStepBookingLink,
  buildBookingByStepId,
} from '@/features/affiliation/engine/stepBookingLink';
import { StepBookingLinkCta } from '@/features/affiliation/components/StepBookingLinkCta';
import { ItineraryDayTimeline } from '@/features/hub/components/mobile/itinerary/ItineraryDayTimeline';
import type { AffiliateLink } from '@/features/affiliation/types/affiliate.types';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';

const CONTEXT = {
  destinationName: 'Chamonix-Mont-Blanc',
  startDate: '2026-07-01',
  endDate: '2026-07-08',
};

const dummyLink: AffiliateLink = {
  id: 'link-booking-chamonix',
  slug: 'booking-chamonix-hotel',
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
  title: 'Hôtels & Refuges — Chamonix-Mont-Blanc',
  destination_name: 'Chamonix-Mont-Blanc',
  target_url: 'https://www.booking.com/city/fr/chamonix.html',
  tracking_params: { marker: '584920' },
  is_active: true,
  created_at: '2026-09-05T00:00:00Z',
  updated_at: '2026-09-05T00:00:00Z',
};

describe('buildStepBookingLink (pur — jamais d’URL, filtrage par catégorie)', () => {
  it('hébergement → hotel avec searchTerms = hébergement + destination', () => {
    const link = buildStepBookingLink(
      { accommodationName: 'Refuge du Goûter', transportMode: 'foot', dayNumber: 2 },
      CONTEXT
    );

    expect(link).not.toBeNull();
    expect(link?.category).toBe('hotel');
    expect(link?.searchTerms).toBe('Refuge du Goûter Chamonix-Mont-Blanc');
    expect(link?.label).toContain('Refuge du Goûter');
  });

  it('hébergement prioritaire sur le transport du même jour', () => {
    const link = buildStepBookingLink(
      { accommodationName: 'Hôtel des Alpes', transportMode: 'plane', dayNumber: 1 },
      CONTEXT
    );

    expect(link?.category).toBe('hotel');
  });

  it('avion → flight, recherche centrée sur la destination', () => {
    const link = buildStepBookingLink(
      { accommodationName: null, transportMode: 'plane', dayNumber: 1 },
      CONTEXT
    );

    expect(link?.category).toBe('flight');
    expect(link?.searchTerms).toBe('Chamonix-Mont-Blanc');
    expect(link?.label).toContain('Chamonix-Mont-Blanc');
  });

  it('train → flight (Aviasales couvre le rail)', () => {
    const link = buildStepBookingLink(
      { transportMode: 'train', dayNumber: 3 },
      CONTEXT
    );

    expect(link?.category).toBe('flight');
    expect(link?.searchTerms).toBe('Chamonix-Mont-Blanc');
  });

  it('sinon null (marche, voiture, bateau, étape vide)', () => {
    expect(buildStepBookingLink({ transportMode: 'foot', dayNumber: 2 }, CONTEXT)).toBeNull();
    expect(buildStepBookingLink({ transportMode: 'car', dayNumber: 2 }, CONTEXT)).toBeNull();
    expect(buildStepBookingLink({ transportMode: 'boat', dayNumber: 2 }, CONTEXT)).toBeNull();
    expect(buildStepBookingLink({ dayNumber: 2 }, CONTEXT)).toBeNull();
    expect(
      buildStepBookingLink({ accommodationName: '   ', transportMode: null, dayNumber: 2 }, CONTEXT)
    ).toBeNull();
  });

  it('ne construit jamais d’URL brute (l’engine la construit au rendu)', () => {
    const suggestions = [
      buildStepBookingLink({ accommodationName: 'Refuge', dayNumber: 1 }, CONTEXT),
      buildStepBookingLink({ transportMode: 'plane', dayNumber: 1 }, CONTEXT),
    ];
    const serialized = JSON.stringify(suggestions);

    expect(serialized).not.toMatch(/https?:/i);
    expect(serialized).not.toContain('/go/');
  });
});

describe('buildBookingByStepId', () => {
  it('indexe les étapes par id et omet celles sans réservation', () => {
    const map = buildBookingByStepId(
      [
        { id: 'step-hotel', accommodationName: 'Gîte du Tour', dayNumber: 1 },
        { id: 'step-foot', transportMode: 'foot', dayNumber: 2 },
        { id: 'step-train', transportMode: 'train', dayNumber: 3 },
      ],
      CONTEXT
    );

    expect(Object.keys(map)).toEqual(['step-hotel', 'step-train']);
    expect(map['step-hotel']?.category).toBe('hotel');
    expect(map['step-train']?.category).toBe('flight');
  });
});

describe('StepBookingLinkCta (lien par étape, /go + rel sponsored)', () => {
  it('rend le href /go avec trip_id, rel sponsored nofollow et mention Suggestion/Lien partenaire', () => {
    const html = renderToStaticMarkup(
      React.createElement(StepBookingLinkCta, {
        booking: {
          category: 'hotel',
          label: 'Hébergement — Refuge du Goûter',
          searchTerms: 'Refuge du Goûter Chamonix-Mont-Blanc',
        },
        link: dummyLink,
        tripId: 'trip-mont-blanc-2026',
      })
    );

    expect(html).toContain('href="/go/booking-chamonix-hotel?trip_id=trip-mont-blanc-2026"');
    expect(html).toContain('rel="sponsored nofollow"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('Refuge du Goûter');
    expect(html).toContain('Suggestion');
    expect(html).toContain('Lien partenaire');
  });
});

describe('ItineraryDayTimeline — lien de réservation par étape', () => {
  const step: PlannerStep = {
    id: 'step-1',
    trip_id: 'trip-1',
    day_number: 1,
    order_index: 0,
    title: 'Montée au refuge',
    description: null,
    location_name: 'Chamonix',
    latitude: 45.9,
    longitude: 6.8,
    accommodation_name: 'Refuge du Goûter',
    transport_mode: 'foot',
    start_time: '18:00:00',
    distance_km: 8,
    elevation_gain_m: 1200,
    elevation_loss_m: 0,
  };

  it('une étape avec hébergement rend le href /go de la carte affiliée', () => {
    const html = renderToStaticMarkup(
      React.createElement(ItineraryDayTimeline, {
        steps: [step],
        tripId: 'trip-1',
        bookingByStepId: {
          'step-1': {
            category: 'hotel',
            label: 'Hébergement — Refuge du Goûter',
            searchTerms: 'Refuge du Goûter Chamonix-Mont-Blanc',
          },
        },
        affiliateLinks: [dummyLink],
        onOpen: () => {},
      })
    );

    expect(html).toContain('href="/go/booking-chamonix-hotel?trip_id=trip-1"');
    expect(html).toContain('rel="sponsored nofollow"');
  });

  it('sans lien fourni, aucune sortie /go n’est rendue', () => {
    const html = renderToStaticMarkup(
      React.createElement(ItineraryDayTimeline, {
        steps: [step],
        tripId: 'trip-1',
        onOpen: () => {},
      })
    );

    expect(html).not.toContain('/go/');
  });
});
