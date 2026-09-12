import { describe, it, expect } from 'vitest';
import { evaluateServedOffer } from '../../src/features/affiliation/engine/offersFreshness';

const NOW = new Date('2026-09-12T00:00:00.000Z');

const baseOffer = {
  price: 120,
  currency: 'EUR',
  priceCheckedAt: '2026-09-01T00:00:00.000Z',
  availability: true,
  availabilityCheckedAt: '2026-09-01T00:00:00.000Z',
  expiresAt: null,
  validTo: null,
  hasAffiliateLink: false,
  affiliateTargetUrl: null,
};

describe('Phase 4 — offres servies : prix/dispo horodatés, affiliation divulguée', () => {
  it('sert un prix horodaté non expiré', () => {
    const view = evaluateServedOffer(baseOffer, NOW);
    expect(view.price).toBe(120);
    expect(view.priceState).toBe('served');
    expect(view.isExpired).toBe(false);
  });

  it('ne sert jamais un prix sans horodatage (aucune invention)', () => {
    const view = evaluateServedOffer({ ...baseOffer, priceCheckedAt: null }, NOW);
    expect(view.price).toBeNull();
    expect(view.currency).toBeNull();
    expect(view.priceState).toBe('missing_timestamp');
  });

  it('ne sert ni prix ni disponibilité d’une offre expirée mais la signale', () => {
    const view = evaluateServedOffer(
      { ...baseOffer, expiresAt: '2026-09-01T00:00:00.000Z' },
      NOW
    );
    expect(view.isExpired).toBe(true);
    expect(view.price).toBeNull();
    expect(view.priceState).toBe('expired');
  });

  it('ne sert pas une disponibilité sans horodatage', () => {
    const view = evaluateServedOffer({ ...baseOffer, availabilityCheckedAt: null }, NOW);
    expect(view.availability).toBeNull();
    expect(view.availabilityState).toBe('missing_timestamp');
  });

  it('n’exige la divulgation que pour un lien affilié réel en HTTPS', () => {
    expect(evaluateServedOffer(baseOffer, NOW).disclosureRequired).toBe(false);

    const withLink = evaluateServedOffer(
      { ...baseOffer, hasAffiliateLink: true, affiliateTargetUrl: 'https://example.invalid/x' },
      NOW
    );
    expect(withLink.hasAffiliateLink).toBe(true);
    expect(withLink.disclosureRequired).toBe(true);

    const httpLink = evaluateServedOffer(
      { ...baseOffer, hasAffiliateLink: true, affiliateTargetUrl: 'http://example.invalid/x' },
      NOW
    );
    expect(httpLink.hasAffiliateLink).toBe(false);
    expect(httpLink.disclosureRequired).toBe(false);
  });

  it('conserve une offre sans prix en « unknown » sans fabriquer de valeur', () => {
    const view = evaluateServedOffer(
      { ...baseOffer, price: null, currency: null, priceCheckedAt: null },
      NOW
    );
    expect(view.price).toBeNull();
    expect(view.priceState).toBe('unknown');
  });
});
