import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBudgetFx } from '../server/rates';

/**
 * Les taux du budget affiché dans la devise du voyageur et celle du pays (PLAN-100 4.2) :
 * Frankfurter v2 d'abord, currency-api en secours (frontière réseau moquée, 1.8).
 */
const FRANKFURTER = (quote: string, rate: number) => [{ date: '2026-10-09', base: 'EUR', quote, rate }];

function stubFetch(handler: (url: string) => unknown | null) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const body = handler(url);
      return body == null ? new Response('no', { status: 404 }) : new Response(JSON.stringify(body), { status: 200 });
    })
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('getBudgetFx', () => {
  it('rien à montrer en plus (voyageur et pays en euros, ou inconnus) : null, aucun appel réseau', async () => {
    const calls = stubFetch(() => null);
    expect(await getBudgetFx({ tripCurrency: 'EUR', traveller: 'EUR', destination: null })).toBeNull();
    expect(await getBudgetFx({ tripCurrency: 'EUR', traveller: null, destination: 'EUR' })).toBeNull();
    expect(calls).toEqual([]);
  });

  it('un taux par devise à montrer, avec sa source', async () => {
    const calls = stubFetch((url) => {
      const quote = /quotes=([A-Z]{3})/.exec(url)?.[1] ?? '';
      return quote === 'CHF' ? FRANKFURTER('CHF', 0.93) : quote === 'JPY' ? FRANKFURTER('JPY', 176.2) : null;
    });
    const fx = await getBudgetFx({ tripCurrency: 'EUR', traveller: 'CHF', destination: 'JPY' });
    expect(calls).toHaveLength(2);
    expect(fx?.targets.map((t) => t.currency)).toEqual(['CHF', 'JPY']);
    expect(fx?.rates.CHF).toMatchObject({ rate: 0.93, date: '2026-10-09', source: 'Frankfurter (banques centrales)' });
    expect(fx?.rates.JPY.rate).toBe(176.2);
  });

  it('voyage en dollars : le taux du dollar est lu aussi (passage par l’euro)', async () => {
    stubFetch((url) => {
      const quote = /quotes=([A-Z]{3})/.exec(url)?.[1] ?? '';
      return quote === 'USD' ? FRANKFURTER('USD', 1.1) : quote === 'CHF' ? FRANKFURTER('CHF', 0.93) : null;
    });
    const fx = await getBudgetFx({ tripCurrency: 'USD', traveller: 'CHF', destination: 'USD' });
    expect(Object.keys(fx?.rates ?? {}).sort()).toEqual(['CHF', 'USD']);
  });

  it('un taux introuvable (ni Frankfurter ni le secours) manque : la devise reste à montrer, « indisponible »', async () => {
    stubFetch(() => null);
    const fx = await getBudgetFx({ tripCurrency: 'EUR', traveller: 'CUP', destination: null });
    expect(fx?.targets).toEqual([{ currency: 'CUP', kinds: ['voyageur'] }]);
    expect(fx?.rates).toEqual({});
  });

  it('le secours currency-api prend le relais quand Frankfurter ne répond pas', async () => {
    stubFetch((url) => (url.includes('currency-api') ? { date: '2026-10-08', eur: { chf: 0.94 } } : null));
    const fx = await getBudgetFx({ tripCurrency: 'EUR', traveller: 'CHF', destination: null });
    expect(fx?.rates.CHF).toMatchObject({ rate: 0.94, date: '2026-10-08', source: 'currency-api' });
  });
});
