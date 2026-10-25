/**
 * WEA-ROUTE — contrat de la route /api/weather.
 *
 * Cette route existe, repond 200, et personne ne l appelait. Avant de la
 * brancher, on verifie qu elle DISTINGUE ce qui manque vraiment : des
 * coordonnees, ou la plage de dates. Un message unique qui dit
 * « lat_lon_range_expected » pour une plage absente envoie l appelant chercher
 * au mauvais endroit pendant des heures.
 *
 * Regle de fer : une source muette vaut 503 « unavailable », jamais une liste
 * vide qui se ferait passer pour « aucune pluie ». Et une plage refusee ne
 * doit jamais avoir interroge le fournisseur.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  fetchDayWeather: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/features/adventure-prep/weatherService', () => ({
  fetchDayWeather: mocks.fetchDayWeather,
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET } from '@/app/api/weather/route';

const BASE = 'http://localhost/api/weather';
const VALID = '?lat=45.923&lon=6.869&from=2026-09-28&to=2026-10-01';

function get(query: string): Promise<Response> {
  return GET(new NextRequest(`${BASE}${query}`));
}

async function reason(res: Response): Promise<string> {
  return ((await res.json()) as { reason?: string }).reason ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.fetchDayWeather.mockResolvedValue([
    {
      date: '2026-09-28',
      tMaxC: 22.5,
      tMinC: 13,
      precipMm: 0,
      precipProbPct: 3,
      windMaxKmh: 7.7,
      code: 3,
      label: 'Partiellement nuageux',
    },
  ]);
});

describe('WEA-ROUTE — ce qui manque se dit exactement', () => {
  it('WEA-ROUTE-01: des coordonnees valides sans plage de dates => la plage est nommee', async () => {
    // LE BUG : la route repondait « lat_lon_range_expected » alors que lat et
    // lon etaient parfaitement valides. Il manquait `from` et `to`.
    const res = await get('?lat=45.923&lon=6.869');
    expect(res.status).toBe(400);
    expect(await reason(res)).toBe('date_range_expected');
  });

  it('WEA-ROUTE-02: une seule date manquante est une plage manquante', async () => {
    expect(await reason(await get('?lat=45.923&lon=6.869&from=2026-09-28'))).toBe('date_range_expected');
    expect(await reason(await get('?lat=45.923&lon=6.869&to=2026-10-01'))).toBe('date_range_expected');
  });

  it('WEA-ROUTE-03: des coordonnees absentes sont nommees comme telles', async () => {
    expect(await reason(await get('?from=2026-09-28&to=2026-10-01'))).toBe('coordinates_expected');
  });

  it('WEA-ROUTE-04: une coordonnee hors bornes est un probleme de coordonnees', async () => {
    expect(await reason(await get('?lat=145.923&lon=6.869&from=2026-09-28&to=2026-10-01'))).toBe(
      'coordinates_expected',
    );
    expect(await reason(await get('?lat=45.923&lon=286.869&from=2026-09-28&to=2026-10-01'))).toBe(
      'coordinates_expected',
    );
  });

  it('WEA-ROUTE-05: une date qui n est pas ISO est un probleme de plage', async () => {
    expect(await reason(await get('?lat=45.923&lon=6.869&from=28-09-2026&to=2026-10-01'))).toBe(
      'date_range_expected',
    );
  });

  it('WEA-ROUTE-06: une plage inversee est dite inversee', async () => {
    expect(await reason(await get('?lat=45.923&lon=6.869&from=2026-10-01&to=2026-09-28'))).toBe(
      'range_inverted',
    );
  });

  it('WEA-ROUTE-07: un parametre inconnu est refuse avant toute lecture', async () => {
    const res = await get(`${VALID}&days=7`);
    expect(await reason(res)).toBe('unknown_parameter');
    expect(mocks.fetchDayWeather).not.toHaveBeenCalled();
  });

  it('WEA-ROUTE-09: un brouillon vierge (startDate null) produit une plage vide, jamais une erreur opaque', async () => {
    // C'est ce qu emet un client dont le brouillon n a pas de date : `from` et
    // `to` arrivent vides. La route doit nommer la plage manquante ET refuser
    // d interroger le fournisseur — jamais debridgee sur une date "aujourd hui".
    for (const query of [
      '?lat=45.923&lon=6.869&from=&to=',
      '?lat=45.923&lon=6.869&from=null&to=null',
      '?lat=45.923&lon=6.869&from=undefined&to=undefined',
    ]) {
      const res = await get(query);
      expect(res.status).toBe(400);
      expect(await reason(res)).toBe('date_range_expected');
    }
    expect(mocks.fetchDayWeather).not.toHaveBeenCalled();
  });

  it('WEA-ROUTE-08: une plage trop large est refusee sans reponse partialle', async () => {
    const res = await get('?lat=45.923&lon=6.869&from=2026-01-01&to=2026-06-01');
    expect(res.status).toBe(400);
    expect(await reason(res)).toBe('range_too_wide');
    expect(mocks.fetchDayWeather).not.toHaveBeenCalled();
  });
});

describe('WEA-ROUTE — une plage refusee n a jamais touche le fournisseur', () => {
  it('WEA-ROUTE-10: coordonnees ou dates absentes => zero appel reseau', async () => {
    await get('?lat=45.923&lon=6.869');
    await get('?from=2026-09-28&to=2026-10-01');
    await get('?lat=45.923&lon=6.869&from=bim&to=2026-10-01');
    expect(mocks.fetchDayWeather).not.toHaveBeenCalled();
  });
});

describe('WEA-ROUTE — la plage transmise est la plage demandee', () => {
  it('WEA-ROUTE-20: chaque journee demandee est transmise, sans en inventer', async () => {
    await get(VALID);
    const [lat, lon, dates] = mocks.fetchDayWeather.mock.calls[0] as [
      number,
      number,
      string[],
    ];
    expect(lat).toBe(45.923);
    expect(lon).toBe(6.869);
    expect(dates).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']);
  });

  it('WEA-ROUTE-21: une seule date est une aventure d un jour', async () => {
    mocks.fetchDayWeather.mockResolvedValue([]);
    await get('?lat=45.923&lon=6.869&from=2026-09-28&to=2026-09-28');
    expect(mocks.fetchDayWeather.mock.calls[0]?.[2]).toEqual(['2026-09-28']);
  });

  it('WEA-ROUTE-22: la plage traverse un changement de mois sans decalage', async () => {
    mocks.fetchDayWeather.mockResolvedValue([]);
    await get('?lat=45.923&lon=6.869&from=2026-09-30&to=2026-10-02');
    expect(mocks.fetchDayWeather.mock.calls[0]?.[2]).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });
});

describe('WEA-ROUTE — une source muette ne devient pas un ciel degage', () => {
  it('WEA-ROUTE-30: fournisseur muet => 503 et zero journee', async () => {
    mocks.fetchDayWeather.mockResolvedValue(null);
    const res = await get(VALID);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unavailable', days: [] });
  });

  it('WEA-ROUTE-31: un refus anti-rafale est relaie tel quel', async () => {
    const limited = new Response('{}', { status: 429 });
    mocks.enforceRateLimit.mockResolvedValue(limited);
    expect(await get(VALID)).toBe(limited);
    expect(mocks.fetchDayWeather).not.toHaveBeenCalled();
  });

  it('WEA-ROUTE-32: une reponse valide porte les jours ET un cache', async () => {
    const res = await get(VALID);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age');
    const body = (await res.json()) as { status: string; days: unknown[] };
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.days)).toBe(true);
  });
});

