import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  filterAffiliateLinksForTrip,
  REAL_AFFILIATE_LINKS_SEED,
} from '@/features/affiliation/data/affiliateSeed';
import { TripAffiliateSection } from '@/features/affiliation/components/TripAffiliateSection';
import { COUNTRY_DETAILS } from '@/lib/countryDetails';

/**
 * CHANTIER Z4 — HONNÊTETÉ COMMERCIALE (D27–D31)
 *
 * Supprime les affirmations commerciales non fondées :
 * - D27 : pas d'offres haute montagne pour un voyage de plaine / < 1500 m.
 * - D30 : « partenaires vérifiés » sans définition de « vérifié ».
 * - D31 : aucune affirmation de sécurité absolue sans test.
 */

const MINIMAL_LINK: any = {
  id: 'l1',
  slug: 'booking-fr-randonnee-hebergements',
  partner_id: 'p1',
  partner: {
    id: 'p1',
    slug: 'booking',
    name: 'Booking',
    network: 'BA',
    website_url: 'https://booking.com',
    commission_rate_desc: '',
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  category: 'hotel',
  country_code: 'FR',
  title: 'Hébergements randonnée en France',
  destination_name: 'France',
  target_url: 'https://booking.com/searchresults.fr.html?ss=France',
  tracking_params: {},
  is_active: true,
  created_at: '',
  updated_at: '',
};

describe('CHANTIER Z4 — HONNÊTETÉ COMMERCIALE', () => {
  describe('Z-D27 — Pas d\'offres haute montagne pour un voyage de plaine', () => {
    it('Z-D27.1 : pour un voyage à 1000 m, aucune offre ne dépasse cette altitude', () => {
      const links = filterAffiliateLinksForTrip('FR', 1000);
      expect(links.length).toBeGreaterThan(0);
      for (const l of links) {
        expect(l.country_code).toBe('FR');
        if (typeof l.min_altitude_m === 'number') {
          expect(l.min_altitude_m, `Offre ${l.slug} inadaptée`).toBeLessThanOrEqual(1000);
        }
      }
    });

    it('Z-D27.2 : pour un voyage à 3000 m, les offres alpinisme haute montagne sont proposées', () => {
      const links = filterAffiliateLinksForTrip('FR', 3000);
      expect(
        links.some(
          (l) =>
            l.slug.includes('chamonix-mont-blanc') &&
            (l.min_altitude_m || 0) >= 2400
        )
      ).toBe(true);
    });

    it('Z-D27.3 : le seed contient bien des offres haute montagne à protéger', () => {
      // Garde-fou : si on retire plus tard les offres haute altitude, le filtre D27
      // perd son sens. On vérifie qu'il en existe au moins une côté FR.
      expect(
        REAL_AFFILIATE_LINKS_SEED.some(
          (l) => l.country_code === 'FR' && (l.min_altitude_m || 0) >= 2400
        )
      ).toBe(true);
    });
  });

  describe('Z-D30 — « Partenaires vérifiés » sans définition de vérifié', () => {
    it('Z-D30.1 : le bloc partenaire n\'affirme plus « vérifiés » et utilise un libellé honnête', () => {
      const html = renderToStaticMarkup(
        React.createElement(TripAffiliateSection, {
          links: [MINIMAL_LINK],
          countryNames: ['France'],
        })
      );
      expect(html).not.toMatch(/\bvérifi/i);
      expect(html).toContain('Services et partenaires pour');
    });
  });

  describe('Z-D31 — Aucune affirmation de sécurité absolue', () => {
    it('Z-D31.1 : aucune fiche pays n\'affirme une sécurité « absolue » ou « quasi-nulle »', () => {
      for (const [code, detail] of Object.entries(COUNTRY_DETAILS)) {
        for (const c of detail?.securite?.conseils || []) {
          const text = `${c.titre} ${c.description}`.toLowerCase();
          expect(text, `Pays ${code} : "${c.titre}"`).not.toMatch(/absolue?/);
          expect(text, `Pays ${code} : "${c.titre}"`).not.toMatch(/quasi-null/i);
        }
      }
    });
  });
});
