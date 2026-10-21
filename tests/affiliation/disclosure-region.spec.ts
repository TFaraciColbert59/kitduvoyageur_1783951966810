import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AffiliateDisclosure,
  AFFILIATE_DISCLOSURE_TEXT,
} from '@/features/affiliation/components/AffiliateDisclosure';
import {
  affiliateDisclosureCopy,
  disclosureRegimeFor,
} from '@/features/affiliation/engine/disclosureRegion';
import { LOCALES } from '@/lib/i18n/locale';

/**
 * PLAN-100 6.4 « Mentions d'affiliation par région ». Le texte choisi dépend de la RÉGION
 * (États-Unis : lien financier, au sens de la FTC ; Royaume-Uni : publicité signalée, au sens
 * CMA / ASA ; France et Union européenne : la mention française existante). La France garde son
 * texte au caractère près : le rendu est comparé à celui d'avant le module.
 */

const before = JSON.parse(
  readFileSync(path.join(process.cwd(), 'tests/affiliation/fixtures/affiliateDisclosure.fr.json'), 'utf8')
) as { full: string; compact: string };

const render = (props: React.ComponentProps<typeof AffiliateDisclosure> = {}) =>
  renderToStaticMarkup(React.createElement(AffiliateDisclosure, props));

describe('disclosureRegimeFor : la région décide, jamais la nationalité', () => {
  it('codes de région et balises de langue', () => {
    expect(disclosureRegimeFor('FR')).toBe('fr');
    expect(disclosureRegimeFor('fr')).toBe('fr');
    expect(disclosureRegimeFor('fr-FR')).toBe('fr');
    expect(disclosureRegimeFor('US')).toBe('us');
    expect(disclosureRegimeFor('en-US')).toBe('us');
    expect(disclosureRegimeFor('en')).toBe('us');
    expect(disclosureRegimeFor('GB')).toBe('uk');
    expect(disclosureRegimeFor('en-GB')).toBe('uk');
    expect(disclosureRegimeFor('de-DE')).toBe('eu');
    expect(disclosureRegimeFor('fr-BE')).toBe('eu');
    expect(disclosureRegimeFor('ES')).toBe('eu');
    expect(disclosureRegimeFor('it')).toBe('eu');
  });

  it('hors des régions connues, ou inconnue : la mention actuelle (défaut)', () => {
    expect(disclosureRegimeFor('fr-CA')).toBe('default');
    expect(disclosureRegimeFor('de-CH')).toBe('default');
    expect(disclosureRegimeFor('JP')).toBe('default');
    expect(disclosureRegimeFor('')).toBe('default');
    expect(disclosureRegimeFor(null)).toBe('default');
    expect(disclosureRegimeFor(undefined)).toBe('default');
    expect(disclosureRegimeFor('pas une balise !')).toBe('default');
  });
});

describe('affiliateDisclosureCopy : texte par langue et par région', () => {
  it('français en France : la mention existante, sans note régionale', () => {
    const c = affiliateDisclosureCopy('fr', 'FR');
    expect(c.regime).toBe('fr');
    expect(c.note).toBeNull();
    expect(c.compact).toBe(AFFILIATE_DISCLOSURE_TEXT);
    expect(c.summary).toBe('Liens partenaires');
  });

  it('français : France, Union européenne et défaut donnent le même texte', () => {
    const fr = affiliateDisclosureCopy('fr', 'FR');
    for (const region of ['BE', 'LU', 'CA', 'CH', null]) {
      const { regime: _r, ...rest } = affiliateDisclosureCopy('fr', region);
      const { regime: _f, ...frRest } = fr;
      expect(rest, String(region)).toEqual(frRest);
    }
  });

  it('États-Unis : le lien financier est dit en clair, en tête', () => {
    const c = affiliateDisclosureCopy('en', 'US');
    expect(c.regime).toBe('us');
    expect(c.note).toMatch(/material connection/i);
    expect(c.note).toMatch(/commission/);
    expect(c.summary).toMatch(/affiliate/i);
  });

  it('Royaume-Uni : la publicité est signalée dès l’étiquette visible', () => {
    const c = affiliateDisclosureCopy('en', 'GB');
    expect(c.regime).toBe('uk');
    expect(c.summary).toMatch(/^Ad\b/);
    expect(c.note).toMatch(/advertising/i);
  });

  it('chaque langue a chaque variante, non vide, et l’anglais n’est pas du français', () => {
    for (const locale of LOCALES) {
      for (const region of ['FR', 'DE', 'US', 'GB', 'JP']) {
        const c = affiliateDisclosureCopy(locale, region);
        for (const v of [c.ariaLabel, c.summary, c.showDetail, c.title, c.body, c.emphasis, c.compact])
          expect(v.trim(), `${locale} ${region}`).not.toBe('');
        if (c.regime === 'us' || c.regime === 'uk') expect(c.note?.trim()).toBeTruthy();
        else expect(c.note).toBeNull();
      }
    }
    expect(affiliateDisclosureCopy('en', 'FR').compact).not.toBe(AFFILIATE_DISCLOSURE_TEXT);
  });

  it('sans région : celle de la langue (fr → France, en → États-Unis)', () => {
    expect(affiliateDisclosureCopy('fr').regime).toBe('fr');
    expect(affiliateDisclosureCopy('en').regime).toBe('us');
    expect(affiliateDisclosureCopy('de').regime).toBe('eu');
  });
});

describe('<AffiliateDisclosure /> : rendu', () => {
  it('France : rendu identique, au caractère près, à celui d’avant (complet et compact)', () => {
    expect(render()).toBe(before.full);
    expect(render({ compact: true })).toBe(before.compact);
    expect(render({ locale: 'fr', region: 'FR' })).toBe(before.full);
    expect(render({ locale: 'fr', region: 'fr-FR', compact: true })).toBe(before.compact);
  });

  it('Union européenne et défaut, en français : rendu identique aussi', () => {
    expect(render({ locale: 'fr', region: 'BE' })).toBe(before.full);
    expect(render({ locale: 'fr', region: 'CA', compact: true })).toBe(before.compact);
  });

  it('États-Unis : la note précède le détail, en complet comme en compact', () => {
    const full = render({ locale: 'en', region: 'US' });
    expect(full).toMatch(/material connection/i);
    expect(full.indexOf('Material connection')).toBeGreaterThan(-1);
    expect(full.indexOf('Material connection')).toBeLessThan(full.indexOf('Booking through'));
    const compact = render({ locale: 'en', region: 'US', compact: true });
    expect(compact.indexOf('Material connection')).toBeGreaterThan(-1);
    expect(compact).toMatch(/<summary><span>Affiliate links/);
    expect(compact.indexOf('Material connection')).toBeLessThan(compact.indexOf('These are paid'));
  });

  it('Royaume-Uni : étiquette « Ad » visible sans ouvrir le détail', () => {
    const compact = render({ locale: 'en', region: 'GB', compact: true });
    expect(compact).toMatch(/<summary><span>Ad · Affiliate links<\/span>/);
  });

  it('toujours une note lisible par les lecteurs d’écran, dans la langue', () => {
    expect(render({ locale: 'de', region: 'DE' })).toContain('role="note"');
    expect(render({ locale: 'de', region: 'DE' })).toContain('aria-label="Transparenz zu Werbung und Partnerlinks"');
    expect(render({ locale: 'es', region: 'ES', compact: true })).toContain('Mostrar el detalle');
  });
});
