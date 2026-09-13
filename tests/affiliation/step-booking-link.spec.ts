import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildStepBookingLink,
  buildBookingByStepId,
  resolveBookingByStepId,
  resolveStepBookingLink,
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

describe('resolveBookingByStepId (résolution côté serveur : destination avant catégorie)', () => {
  const chamonixHotel = makeLink({
    id: 'link-chamonix',
    slug: 'booking-chamonix-hotel',
    destination_name: 'Chamonix-Mont-Blanc',
    created_at: '2026-09-01T00:00:00Z',
  });
  const parisHotel = makeLink({
    id: 'link-paris',
    slug: 'booking-paris-hotel',
    destination_name: 'Paris',
    created_at: '2026-09-10T00:00:00Z',
  });

  it('un pool de liens même catégorie dans deux villes → slug de la destination de l’étape', () => {
    const map = resolveBookingByStepId(
      [
        {
          id: 'step-chamonix',
          accommodationName: 'Refuge du Goûter',
          locationName: 'Chamonix',
          dayNumber: 1,
        },
      ],
      [parisHotel, chamonixHotel],
      CONTEXT
    );

    // Paris est plus récent, mais Chamonix matche la localisation de l'étape.
    expect(map['step-chamonix']?.slug).toBe('booking-chamonix-hotel');
    expect(map['step-chamonix']?.partnerName).toBe('Booking.com');
  });

  it('match insensible à la casse et aux diacritiques (étape → destination du voyage)', () => {
    const nepalLink = makeLink({
      id: 'link-nepal',
      slug: 'booking-nepal-lodges',
      destination_name: 'Népal',
    });
    const map = resolveBookingByStepId(
      [{ id: 'step-1', accommodationName: 'Lodge', dayNumber: 1 }],
      [parisHotel, nepalLink],
      { ...CONTEXT, destinationName: 'NEPAL' }
    );

    expect(map['step-1']?.slug).toBe('booking-nepal-lodges');
  });

  it('aucune correspondance de destination → pas d’entrée (aucun lien hors sujet)', () => {
    const map = resolveBookingByStepId(
      [{ id: 'step-1', accommodationName: 'Gîte', locationName: 'Cusco', dayNumber: 1 }],
      [parisHotel, chamonixHotel],
      { ...CONTEXT, destinationName: 'Cusco' }
    );

    expect(map['step-1']).toBeUndefined();
  });

  it('resolveStepBookingLink : correspondance exigée, récence seulement entre correspondants', () => {
    const booking = {
      category: 'hotel' as const,
      label: 'Hébergement — Gîte',
      searchTerms: 'Gîte Cusco',
    };

    // Aucun candidat ne matche Cusco → null (jamais de lien vers Paris).
    expect(
      resolveStepBookingLink(booking, [parisHotel, chamonixHotel], {
        ...CONTEXT,
        destinationName: 'Cusco',
      })
    ).toBeNull();

    // Paris matche → le plus récent des correspondants est retenu.
    expect(
      resolveStepBookingLink(booking, [chamonixHotel, parisHotel], {
        ...CONTEXT,
        destinationName: 'Paris',
      })?.slug
    ).toBe('booking-paris-hotel');
  });

  it('la catégorie reste un filtre dur : aucun candidat de la catégorie → pas d’entrée', () => {
    const map = resolveBookingByStepId(
      [{ id: 'step-flight', transportMode: 'plane', dayNumber: 1 }],
      [parisHotel, chamonixHotel],
      CONTEXT
    );

    expect(map['step-flight']).toBeUndefined();
  });

  it('une étape sans réservation n’entre jamais dans la carte', () => {
    const map = resolveBookingByStepId(
      [{ id: 'step-foot', transportMode: 'foot', dayNumber: 2 }],
      [parisHotel, chamonixHotel],
      CONTEXT
    );

    expect(Object.keys(map)).toEqual([]);
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
        slug: 'booking-chamonix-hotel',
        partnerName: 'Booking.com',
        tripId: 'trip-mont-blanc-2026',
      })
    );

    expect(html).toContain('href="/go/booking-chamonix-hotel?trip_id=trip-mont-blanc-2026"');
    expect(html).toContain('rel="sponsored nofollow"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('Refuge du Goûter');
    expect(html).toContain('Suggestion');
    expect(html).toContain('Lien partenaire');
    expect(html).toContain('Booking.com');
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

  it('une étape avec hébergement rend le href /go résolu côté serveur', () => {
    const html = renderToStaticMarkup(
      React.createElement(ItineraryDayTimeline, {
        steps: [step],
        tripId: 'trip-1',
        bookingByStepId: {
          'step-1': {
            category: 'hotel',
            label: 'Hébergement — Refuge du Goûter',
            searchTerms: 'Refuge du Goûter Chamonix-Mont-Blanc',
            slug: 'booking-chamonix-hotel',
            partnerName: 'Booking.com',
          },
        },
        onOpen: () => {},
      })
    );

    expect(html).toContain('href="/go/booking-chamonix-hotel?trip_id=trip-1"');
    expect(html).toContain('rel="sponsored nofollow"');
  });

  it('sans mise en relation serveur, aucune sortie /go n’est rendue', () => {
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
