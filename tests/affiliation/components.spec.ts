import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AffiliateDisclosure } from '@/features/affiliation/components/AffiliateDisclosure';
import { AffiliateLinkCard } from '@/features/affiliation/components/AffiliateLinkCard';
import { TripAffiliateSection } from '@/features/affiliation/components/TripAffiliateSection';
import type { AffiliateLink } from '@/features/affiliation/types/affiliate.types';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, className, target, rel }: any) =>
    React.createElement('a', { href, className, target, rel }, children),
}));

describe('Affiliation Components (Apple HIG & Legal Transparency)', () => {
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

  describe('AffiliateDisclosure (ROADMAP §5.3 / DGCCRF & Loi influenceurs 2023)', () => {
    it('renders compulsory legal disclosure text with transparency claims', () => {
      const html = renderToStaticMarkup(React.createElement(AffiliateDisclosure));

      expect(html).toContain('Transparence &amp; Indépendance');
      expect(html).toContain('liens partenaires rémunérés');
      expect(html).toContain('sans aucun surcoût');
      expect(html).toContain('rémunération n’influence jamais');
    });
  });

  describe('AffiliateLinkCard (Apple HIG & SEO safe)', () => {
    it('renders partner name, title, badge, and external link with rel="sponsored nofollow"', () => {
      const html = renderToStaticMarkup(
        React.createElement(AffiliateLinkCard, {
          link: dummyLink,
          tripId: 'trip-mont-blanc-2026',
        })
      );

      expect(html).toContain('Hôtels &amp; Refuges — Chamonix-Mont-Blanc');
      expect(html).toContain('Booking.com');
      expect(html).toContain('Hébergement');
      expect(html).toContain('href="/go/booking-chamonix-hotel?trip_id=trip-mont-blanc-2026"');
      expect(html).toContain('rel="sponsored nofollow"');
      expect(html).toContain('target="_blank"');
    });
  });

  describe('TripAffiliateSection', () => {
    it('returns null when no links are provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(TripAffiliateSection, { links: [] })
      );
      expect(html).toBe('');
    });

    it('renders disclosure and links grid when links are available', () => {
      const html = renderToStaticMarkup(
        React.createElement(TripAffiliateSection, {
          links: [dummyLink],
          tripId: 'trip-1',
          countryNames: ['France'],
        })
      );

      expect(html).toContain('Réservations et services partenaires');
      expect(html).toContain('Transparence &amp; Indépendance');
      expect(html).toContain('Partenaires vérifiés pour France');
      expect(html).toContain('Booking.com');
      expect(html).toContain('1 offres disponibles');
    });
  });
});
