import { describe, expect, it } from 'vitest';
import { simplifyOffers, stayDates } from '../engine/stays';
import type { BookingCandidate } from '@/features/booking/server/bookingProviderTypes';

const cand = (over: Partial<BookingCandidate> = {}): BookingCandidate => ({
  id: 'h1',
  provider: 'routestack',
  vertical: 'hotel',
  title: 'Refuge du col',
  description: null,
  amount: 62,
  currency: 'eur',
  deeplink: 'https://partner.example/offer/h1',
  bookingKind: 'search',
  requiresRevalidation: true,
  providerReference: null,
  metadata: {},
  ...over,
});

describe('stayDates', () => {
  it('nuit du jour N = arrivée le jour N, départ le lendemain', () => {
    expect(stayDates('2026-10-12', 1)).toEqual({ checkIn: '2026-10-12', checkOut: '2026-10-13' });
    expect(stayDates('2026-10-31', 2)).toEqual({ checkIn: '2026-11-01', checkOut: '2026-11-02' });
  });
  it.each([
    [null, 1],
    ['demain', 1],
    ['2026-10-12', 0],
    ['2026-10-12', 61],
    ['2026-10-12', 1.5],
  ])('refuse %s / jour %s', (start, day) => {
    expect(stayDates(start as string | null, day as number)).toBeNull();
  });
});

describe('simplifyOffers', () => {
  it('normalise la devise et garde le lien https', () => {
    const [o] = simplifyOffers([cand()]);
    expect(o).toMatchObject({
      amount: 62,
      currency: 'EUR',
      url: 'https://partner.example/offer/h1',
    });
  });
  it('ne devine ni la devise ni le prix', () => {
    const [noCurrency] = simplifyOffers([cand({ currency: null })]);
    expect(noCurrency.amount).toBeNull();
    expect(noCurrency.currency).toBeNull();
    const [noAmount] = simplifyOffers([cand({ amount: null })]);
    expect(noAmount.amount).toBeNull();
  });
  it('refuse un lien non https et écarte les offres sans titre', () => {
    const out = simplifyOffers([
      cand({ deeplink: 'javascript:alert(1)' }),
      cand({ id: 'x', title: '  ' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBeNull();
  });
  it('limite le nombre d’offres', () => {
    const many = Array.from({ length: 20 }, (_, i) => cand({ id: `h${i}`, title: `H${i}` }));
    expect(simplifyOffers(many, 5)).toHaveLength(5);
  });
});
