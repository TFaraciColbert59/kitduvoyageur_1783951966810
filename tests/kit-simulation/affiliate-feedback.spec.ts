import { describe, expect, it } from 'vitest';
import { normalizeOffer, bestPurchasable, type RawOffer } from '@/features/kit-simulation/affiliate';
import { summarizeFeedback, uniqueFeedback, type Feedback } from '@/features/kit-simulation/feedback';

// Provenance : porté de LKDV-reference tests/affiliate-feedback.test.cjs (12 tests,
// Dossier Technique Maître Annexe C). Sémantique inchangée ; imports directs src/.

const now = '2026-10-18T12:00:00Z';

const raw: RawOffer = {
  merchantId: 'test',
  merchantSku: 'fixture',
  gtin: '4006381333931',
  price: '12.34',
  shipping: '3.00',
  currency: 'EUR',
  inStock: true,
  deepLink: 'https://example.test/path',
  observedAt: '2026-10-18T10:00:00Z',
  expiresAt: '2026-10-19T12:00:00Z',
};

const allowed = new Set(['example.test']);

const event: Feedback = {
  eventId: '1',
  tripId: 'trip',
  gearId: 'gear',
  participantId: 'person',
  distanceM: 1000,
  minimumTempC: 2,
  comfortScore: 4,
  unused: true,
  safetyCritical: true,
  consentAggregate: true,
};

describe('normalisation des offres (Awin)', () => {
  it('normalisation prix sans flottant', () => {
    expect(normalizeOffer(raw, allowed, now).priceCents).toBe(1234);
  });

  it('GTIN syntaxique seulement', () => {
    expect(() => normalizeOffer({ ...raw, gtin: '123' }, allowed, now)).toThrow();
  });

  it('hote redirection interdit', () => {
    expect(() => normalizeOffer({ ...raw, deepLink: 'https://evil.test' }, allowed, now)).toThrow();
  });

  it('pas de devise implicite', () => {
    expect(() => normalizeOffer({ ...raw, currency: 'USD' }, allowed, now)).toThrow();
  });

  it('offre expiree refusee', () => {
    expect(() => normalizeOffer({ ...raw, expiresAt: now }, allowed, now)).toThrow();
  });

  it('stock faux exclu', () => {
    expect(bestPurchasable([{ ...normalizeOffer(raw, allowed, now), inStock: false }], now)).toBeNull();
  });

  it('prix livre et non prix nu', () => {
    const a = normalizeOffer(raw, allowed, now);
    const b = { ...a, merchantId: 'b', priceCents: 1300, shippingCents: 0 };
    expect(bestPurchasable([a, b], now)?.merchantId).toBe('b');
  });
});

describe('retours terrain (feedback)', () => {
  it('feedback une fois par sortie objet personne', () => {
    expect(uniqueFeedback([event, { ...event, eventId: '2' }]).length).toBe(1);
  });

  it('plancher de diffusion', () => {
    expect(summarizeFeedback([event]).unusedRate).toBeNull();
  });

  it('retrait de consentement exclu', () => {
    expect(summarizeFeedback([{ ...event, consentAggregate: false }]).samples).toBe(0);
  });

  it('aucune suppression automatique de secours', () => {
    expect(summarizeFeedback([event]).removalAdviceAllowed).toBe(false);
  });

  it('seuil robustesse minimum', () => {
    expect(() => summarizeFeedback([event], 1)).toThrow();
  });
});
