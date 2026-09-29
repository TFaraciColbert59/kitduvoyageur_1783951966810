/**
 * PROV-API — J5 : l API doit nommer sa source.
 *
 * La consigne dit : « UI = nom du fournisseur + lien, et l API doit exposer
 * le champ. » Tant que la route ne renvoie que `status: ok`, l interface n a
 * aucun moyen honnete d afficher d ou vient une donnee : elle invente un
 * credit, ou elle n en affiche aucun. Les deux sont faux.
 *
 * Regle de fer : le credit n est claims QUE sur des donnees reelles. Une
 * reponse 503 ne porte aucun fournisseur, parce qu il n y a rien a credited.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  fetchDayWeather: vi.fn(),
  elevationsAt: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/features/adventure-prep/weatherService', () => ({
  fetchDayWeather: mocks.fetchDayWeather,
}));
vi.mock('@/features/adventure-prep/routingService', () => ({
  elevationsAt: mocks.elevationsAt,
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET as weatherGet } from '@/app/api/weather/route';
import { GET as elevationGet } from '@/app/api/elevation/route';

type Body = { provider?: { name?: string; url?: string } };

const WEATHER_OK = '?lat=45.923&lon=6.869&from=2026-09-28&to=2026-09-28';
const ELEVATION_OK = '?points=6.869,45.923;6.870,45.924';

async function providerOf(res: Response): Promise<{ name: string; url: string } | null> {
  const body = (await res.json()) as Body;
  if (!body.provider) return null;
  return { name: String(body.provider.name), url: String(body.provider.url) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.fetchDayWeather.mockResolvedValue([
    { date: '2026-09-28', tMaxC: 22.5, tMinC: 13, precipMm: 0, precipProbPct: 3, windMaxKmh: 7.7, code: 3, label: 'Partiellement nuageux' },
  ]);
  mocks.elevationsAt.mockResolvedValue([1035, 1042]);
});

describe('PROV-API — la source est nommee des les donnees reelles', () => {
  it('PROV-API-01: /api/weather en 200 nomme le fournisseur et un lienResolvable', async () => {
    const res = await weatherGet(new NextRequest(`http://localhost/api/weather${WEATHER_OK}`));
    expect(res.status).toBe(200);
    const provider = await providerOf(res);
    expect(provider, 'la route ne declare aucune source').not.toBeNull();
    expect(provider?.name.length ?? 0).toBeGreaterThan(0);
    expect(provider?.url ?? '').toMatch(/^https:\/\//);
  });

  it('PROV-API-02: /api/elevation en 200 nomme le fournisseur et un lien resolvable', async () => {
    const res = await elevationGet(new NextRequest(`http://localhost/api/elevation${ELEVATION_OK}`));
    expect(res.status).toBe(200);
    const provider = await providerOf(res);
    expect(provider, 'la route ne declare aucune source').not.toBeNull();
    expect(provider?.name.length ?? 0).toBeGreaterThan(0);
    expect(provider?.url ?? '').toMatch(/^https:\/\//);
  });

  it('PROV-API-03: le fournisseur est le MEME pour meteo et altitude, sinon l UI ment deux fois', async () => {
    const w = await providerOf(await weatherGet(new NextRequest(`http://localhost/api/weather${WEATHER_OK}`)));
    const e = await providerOf(await elevationGet(new NextRequest(`http://localhost/api/elevation${ELEVATION_OK}`)));
    expect(w?.name).toBe(e?.name);
    expect(w?.url).toBe(e?.url);
  });

  it('PROV-API-04: 503 ne credit aucune source — il n y a rien a credited', async () => {
    mocks.fetchDayWeather.mockResolvedValue(null);
    mocks.elevationsAt.mockResolvedValue(null);
    const w = await weatherGet(new NextRequest(`http://localhost/api/weather${WEATHER_OK}`));
    const e = await elevationGet(new NextRequest(`http://localhost/api/elevation${ELEVATION_OK}`));
    expect(w.status).toBe(503);
    expect(e.status).toBe(503);
    expect(await providerOf(w), 'une panne ne doit pas afficher de credit').toBeNull();
    expect(await providerOf(e), 'une panne ne doit pas afficher de credit').toBeNull();
  });

  it('PROV-API-05: une requete refusee ne credit pas non plus', async () => {
    const res = await weatherGet(new NextRequest('http://localhost/api/weather?lat=45.9'));
    expect(res.status).toBe(400);
    expect(await providerOf(res)).toBeNull();
  });
});