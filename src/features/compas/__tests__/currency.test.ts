import { describe, expect, it } from 'vitest';
import { convertFromEur, parseFrankfurter } from '../engine/currency';

describe('parseFrankfurter', () => {
  it('lit un taux valide', () => {
    expect(parseFrankfurter({ date: '2026-10-01', rates: { CHF: 0.94 } }, 'CHF')).toEqual({
      base: 'EUR',
      currency: 'CHF',
      rate: 0.94,
      date: '2026-10-01',
    });
  });
  it.each([
    [null],
    [{}],
    [{ date: '2026-10-01', rates: {} }],
    [{ date: '2026-10-01', rates: { CHF: 0 } }],
    [{ date: 'hier', rates: { CHF: 0.9 } }],
  ])('rend null sur une réponse inutilisable (%#)', (json) => {
    expect(parseFrankfurter(json, 'CHF')).toBeNull();
  });
});

describe('convertFromEur', () => {
  it('convertit et arrondit au centime', () => {
    const fx = { base: 'EUR', currency: 'CHF', rate: 0.9433, date: '2026-10-01' } as const;
    expect(convertFromEur(100, fx)?.amount).toBe(94.33);
  });
  it('ne devine rien sans taux', () => {
    expect(convertFromEur(100, null)).toBeNull();
  });
});
