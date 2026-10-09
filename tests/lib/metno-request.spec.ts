/**
 * Plan 1.8 : MET Norway — 20 requêtes par seconde au plus, jamais avant
 * `Expires` (cache de 45 min, Expires mesuré à ~32 min), User-Agent du site.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { METNO_MAX_PER_SECOND, METNO_REVALIDATE_S, metnoGet, metnoSlot, resetMetnoSlots } from '@/lib/weather/metnoRequest';

afterEach(() => {
  resetMetnoSlots();
  vi.unstubAllGlobals();
});

describe('rythme MET Norway', () => {
  it('20 départs par seconde au plus : le 21e attend la fin de la fenêtre', async () => {
    let t = 0;
    const waits: number[] = [];
    const now = () => t;
    const sleep = async (ms: number) => {
      waits.push(ms);
      t += ms;
    };
    for (let i = 0; i < METNO_MAX_PER_SECOND; i += 1) await metnoSlot(now, sleep);
    expect(waits).toEqual([]);
    await metnoSlot(now, sleep);
    expect(waits.length).toBe(1);
    expect(t).toBeGreaterThanOrEqual(1000);
  });
});

describe('requête MET Norway', () => {
  it('cache de 45 min (au-delà d’Expires) et User-Agent du site', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = await metnoGet('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=45.90&lon=6.13', {
      purpose: 'meteo',
    });
    expect(body).toEqual({ ok: 1 });
    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: { revalidate?: number } };
    expect(init.next?.revalidate).toBe(METNO_REVALIDATE_S);
    expect(METNO_REVALIDATE_S).toBeGreaterThan(32 * 60);
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('koosmoweb.fr');
  });

  it('réponse en erreur ou réseau coupé : null, jamais d’exception', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect(await metnoGet('https://api.met.no/x', { purpose: 'meteo' })).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('réseau'); }));
    expect(await metnoGet('https://api.met.no/x', { purpose: 'meteo' })).toBeNull();
  });
});
