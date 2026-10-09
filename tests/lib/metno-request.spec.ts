/**
 * Plan 1.8 : MET Norway — 20 requêtes par seconde au plus, jamais avant
 * `Expires` (cache de 45 min, Expires mesuré à ~32 min), User-Agent du site.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryRateLimitSize, resetMemoryRateLimits } from '@/lib/rate-limit';
import {
  METNO_MAX_PER_SECOND,
  METNO_REVALIDATE_S,
  metnoForecastUrl,
  metnoGet,
  metnoSiteSlot,
  metnoSlot,
  resetMetnoSlots,
} from '@/lib/weather/metnoRequest';

afterEach(() => {
  resetMetnoSlots();
  resetMemoryRateLimits();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe('plafond MET à l’échelle du site (fenêtre partagée, clé metno:site)', () => {
  type Outcome = 'allowed' | 'limited' | 'unavailable';
  const fakeConsume = (outcomes: Outcome[], opts: { degraded?: boolean; retryAfterSeconds?: number } = {}) => {
    const queue = [...outcomes];
    return vi.fn(async (_options: unknown) => ({
      outcome: queue.shift() ?? 'allowed',
      retryAfterSeconds: opts.retryAfterSeconds ?? 1,
      degraded: opts.degraded ?? false,
    }));
  };

  it('limité deux fois puis autorisé : attend deux fois, 3 appels avec la bonne clé et le bon plafond', async () => {
    const consume = fakeConsume(['limited', 'limited', 'allowed']);
    const sleep = vi.fn(async (_ms: number) => {});
    await metnoSiteSlot({ consume, sleep });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledTimes(3);
    for (const [options] of consume.mock.calls) {
      expect(options).toMatchObject({
        key: 'metno:site',
        limit: METNO_MAX_PER_SECOND,
        windowMs: 1000,
        failMode: 'open',
      });
      expect(options).toMatchObject({ timeoutMs: 500 });
    }
  });

  it('l’attente suit retryAfterSeconds, plafonnée à une seconde', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    await metnoSiteSlot({ consume: fakeConsume(['limited', 'allowed'], { retryAfterSeconds: 1 }), sleep });
    expect(sleep).toHaveBeenLastCalledWith(1000);
    sleep.mockClear();
    await metnoSiteSlot({ consume: fakeConsume(['limited', 'allowed'], { retryAfterSeconds: 30 }), sleep });
    expect(sleep).toHaveBeenLastCalledWith(1000);
  });

  it('autorisé du premier coup : aucune attente, un seul appel', async () => {
    const consume = fakeConsume(['allowed']);
    const sleep = vi.fn(async (_ms: number) => {});
    await metnoSiteSlot({ consume, sleep });
    expect(consume).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('indisponible (ouvert) : on laisse passer tout de suite, sans attendre', async () => {
    const consume = fakeConsume(['unavailable']);
    const sleep = vi.fn(async (_ms: number) => {});
    await metnoSiteSlot({ consume, sleep });
    expect(consume).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('repli dégradé (base injoignable) : on laisse passer tout de suite, même « limité »', async () => {
    const consume = fakeConsume(['limited'], { degraded: true });
    const sleep = vi.fn(async (_ms: number) => {});
    await metnoSiteSlot({ consume, sleep });
    expect(consume).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('toujours limité : rend la main après 3 tentatives et le dit une seule fois', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consume = fakeConsume(['limited', 'limited', 'limited', 'limited', 'limited']);
    const sleep = vi.fn(async (_ms: number) => {});
    await expect(metnoSiteSlot({ consume, sleep })).resolves.toBeUndefined();
    expect(consume).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[meteo] plafond MET du site atteint');
  });

  it('metnoGet consomme la fenêtre du site (repli mémoire sans base) avant chaque requête MET', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(memoryRateLimitSize()).toBe(0);
    await metnoGet('https://api.met.no/x');
    expect(memoryRateLimitSize()).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('requête MET Norway', () => {
  it('cache de 45 min (au-delà d’Expires) et User-Agent du site', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = await metnoGet('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=45.90&lon=6.13');
    expect(body).toEqual({ ok: 1 });
    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: { revalidate?: number } };
    expect(init.next?.revalidate).toBe(METNO_REVALIDATE_S);
    expect(METNO_REVALIDATE_S).toBeGreaterThan(32 * 60);
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('koosmoweb.fr');
  });

  it('réponse en erreur ou réseau coupé : null, jamais d’exception', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect(await metnoGet('https://api.met.no/x')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('réseau'); }));
    expect(await metnoGet('https://api.met.no/x')).toBeNull();
  });
});

describe('une seule entrée de cache par point', () => {
  it('l’URL de prévision est arrondie à 0,01°', () => {
    expect(metnoForecastUrl(45.8992, 6.1294)).toBe(
      'https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=45.90&lon=6.13'
    );
    expect(metnoForecastUrl(45.8992, 6.1294).endsWith('?lat=45.90&lon=6.13')).toBe(true);
  });

  it('deux appelants pour le même point : même URL et même User-Agent (même clé de cache)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    // Un appelant « page météo » et un appelant « Compas », avec des coordonnées un peu différentes
    // mais le même point une fois arrondi à 0,01°.
    await metnoGet(metnoForecastUrl(45.8992, 6.1294), { timeoutMs: 4000 });
    await metnoGet(metnoForecastUrl(45.9031, 6.1251), { timeoutMs: 6000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [urlA, initA] = fetchMock.mock.calls[0];
    const [urlB, initB] = fetchMock.mock.calls[1];
    expect(urlA).toBe(urlB);
    expect((initA?.headers as Record<string, string>)['User-Agent']).toBe(
      (initB?.headers as Record<string, string>)['User-Agent']
    );
  });
});
