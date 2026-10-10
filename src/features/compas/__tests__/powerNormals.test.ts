import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// Le module météo importe le point d'accès MET Norway (limites en base) : remplacé, sans réseau.
vi.mock('@/lib/weather/metnoRequest', () => ({
  metnoForecastUrl: () => 'https://api.met.no/test',
  metnoGet: vi.fn(async () => null),
}));

import { climatologyUrl, getPrecipNormals } from '../server/weather';

/** Réponse réelle de NASA POWER pour Manaus (climatologie 2001-2020), relevée le 9 oct. 2026. */
const manaus = (aug = 1.61) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-60.02, -3.12, 51.37] },
  properties: {
    parameter: {
      PRECTOTCORR: {
        JAN: 7.24,
        FEB: 8.36,
        MAR: 8.63,
        APR: 8.72,
        MAY: 6.62,
        JUN: 3.97,
        JUL: 2.44,
        AUG: aug,
        SEP: 2.26,
        OCT: 3.33,
        NOV: 4.5,
        DEC: 6.87,
        ANN: 5.36,
      },
    },
  },
  header: { fill_value: -999.0 },
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('normales NASA POWER côté serveur', () => {
  afterEach(() => vi.restoreAllMocks());

  it('URL : climatologie au point arrondi à 0,01°, précipitations seulement', () => {
    expect(climatologyUrl(-3.119, -60.0217)).toBe(
      'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR&community=RE&longitude=-60.02&latitude=-3.12&format=JSON'
    );
  });

  it('lit les douze mois ; réponse gardée 30 jours', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(manaus()));
    expect(await getPrecipNormals(-3.12, -60.02)).toEqual({
      precip: [7.24, 8.36, 8.63, 8.72, 6.62, 3.97, 2.44, 1.61, 2.26, 3.33, 4.5, 6.87],
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(climatologyUrl(-3.12, -60.02));
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(30 * 86_400);
  });

  it('service injoignable ou valeur de remplissage : null, la période reste non proposée', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValueOnce(new Error('réseau coupé'));
    expect(await getPrecipNormals(-3.12, -60.02)).toBeNull();
    fetchSpy.mockImplementationOnce(async () => json(manaus(-999)));
    expect(await getPrecipNormals(-3.12, -60.02)).toBeNull();
  });
});
