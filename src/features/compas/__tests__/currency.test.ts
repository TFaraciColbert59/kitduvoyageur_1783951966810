import { describe, expect, it } from 'vitest';
import {
  convertFromEur,
  CURRENCY_API_SOURCE,
  FRANKFURTER_SOURCE,
  parseCurrencyApi,
  parseFrankfurterV2,
} from '../engine/currency';

describe('parseFrankfurterV2', () => {
  it('lit le taux de la devise demandée, avec sa source', () => {
    const json = [
      { date: '2026-10-08', base: 'EUR', quote: 'USD', rate: 1.1206 },
      { date: '2026-10-08', base: 'EUR', quote: 'VND', rate: 29060 },
    ];
    expect(parseFrankfurterV2(json, 'VND')).toEqual({
      base: 'EUR',
      currency: 'VND',
      rate: 29060,
      date: '2026-10-08',
      source: FRANKFURTER_SOURCE,
    });
  });
  it.each([
    [null],
    [{}],
    [{ status: 422, message: 'invalid currency: ZZZ' }],
    [[]],
    [[{ date: '2026-10-08', base: 'EUR', quote: 'USD', rate: 1.12 }]],
    [[{ date: '2026-10-08', base: 'EUR', quote: 'VND', rate: 0 }]],
    [[{ date: '2026-10-08', base: 'USD', quote: 'VND', rate: 26000 }]],
    [[{ date: 'hier', base: 'EUR', quote: 'VND', rate: 29060 }]],
  ])('rend null sur une réponse inutilisable (%#)', (json) => {
    expect(parseFrankfurterV2(json, 'VND')).toBeNull();
  });
});

describe('parseCurrencyApi (secours)', () => {
  it('lit le code en minuscules', () => {
    expect(parseCurrencyApi({ date: '2026-10-08', eur: { ars: 1700.37, usd: 1.12 } }, 'ARS')).toEqual({
      base: 'EUR',
      currency: 'ARS',
      rate: 1700.37,
      date: '2026-10-08',
      source: CURRENCY_API_SOURCE,
    });
  });
  it.each([[null], [{ date: '2026-10-08' }], [{ date: '2026-10-08', eur: { ars: -1 } }], [{ eur: { ars: 1700 } }]])(
    'rend null sur une réponse inutilisable (%#)',
    (json) => {
      expect(parseCurrencyApi(json, 'ARS')).toBeNull();
    }
  );
});

describe('convertFromEur', () => {
  it('convertit, arrondit au centime et garde la source', () => {
    const fx = { base: 'EUR', currency: 'CHF', rate: 0.9433, date: '2026-10-01', source: FRANKFURTER_SOURCE } as const;
    expect(convertFromEur(100, fx)).toMatchObject({ amount: 94.33, source: FRANKFURTER_SOURCE });
  });
  it('ne devine rien sans taux', () => {
    expect(convertFromEur(100, null)).toBeNull();
  });
});
