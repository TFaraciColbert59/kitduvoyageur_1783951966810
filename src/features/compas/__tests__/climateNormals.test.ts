/**
 * Plan 4.8 : les normales climatiques (NASA POWER) nourrissent les règles du kit.
 *
 * Les réponses de `fixtures/power-climatology.json` sont de VRAIES réponses de
 * l'API climatologie de NASA POWER (paramètres T2M, T2M_MIN, T2M_MAX,
 * PRECTOTCORR), relevées le 10 octobre 2026 au point arrondi à 0,01°. Aucune
 * valeur n'est inventée : un test qui a besoin d'un climat le lit ici.
 *
 * À retenir sur ces données : T2M est la moyenne du mois ; T2M_MIN et T2M_MAX
 * sont les EXTRÊMES relevés sur la période (Paris : -12 °C en janvier, 40 °C en
 * juillet), pas la nuit ni l'après-midi typiques. Les règles s'appuient donc
 * sur la moyenne et ne lisent l'extrême que comme un second garde-fou.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixtures from './fixtures/power-climatology.json';
import { powerClimateNormals } from '../engine/metno';
import {
  CLIMATE_THRESHOLDS,
  climateWindow,
  readClimate,
  type ClimateNormals,
} from '@/features/trips/engine/climate';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/weather/metnoRequest', () => ({
  metnoForecastUrl: () => 'https://api.met.no/test',
  metnoGet: vi.fn(async () => null),
}));

type Place = keyof typeof fixtures;
const normalsOf = (place: Place): ClimateNormals => {
  const n = powerClimateNormals(fixtures[place].payload);
  if (!n) throw new Error(`fixture illisible : ${place}`);
  return n;
};
/** Une date par mois voulu (AAAA-MM-15). */
const dates = (...months: number[]) => months.map((m) => `2027-${String(m).padStart(2, '0')}-15`);
const read = (place: Place, ...months: number[]) => {
  const r = readClimate(climateWindow(normalsOf(place), dates(...months)));
  if (!r) throw new Error('climat illisible');
  return r;
};

describe('powerClimateNormals : lecture de la réponse NASA POWER', () => {
  it('lit les douze mois de chaque mesure, dans l’ordre janvier → décembre', () => {
    const ubud = normalsOf('ubud');
    expect(ubud.precip).toEqual([10.21, 8.91, 6.49, 4.1, 2.64, 1.78, 1.28, 0.77, 1.26, 1.84, 4.47, 8.76]);
    expect(ubud.tMean[0]).toBe(25.53);
    expect(ubud.tMin[7]).toBe(18.69);
    expect(ubud.tMax[11]).toBe(34.49);
    for (const series of Object.values(ubud)) expect(series).toHaveLength(12);
  });

  it.each(['T2M', 'T2M_MIN', 'T2M_MAX', 'PRECTOTCORR'])('sans %s : rien n’est comblé', (name) => {
    const payload = structuredClone(fixtures.paris.payload) as { properties: { parameter: Record<string, unknown> } };
    delete payload.properties.parameter[name];
    expect(powerClimateNormals(payload)).toBeNull();
  });

  it('un mois à la valeur de remplissage (-999), absent, négatif (pluie) ou illisible : null', () => {
    const broken = (patch: (p: Record<string, Record<string, unknown>>) => void) => {
      const payload = structuredClone(fixtures.paris.payload) as {
        properties: { parameter: Record<string, Record<string, unknown>> };
      };
      patch(payload.properties.parameter);
      return powerClimateNormals(payload);
    };
    expect(broken((p) => (p.T2M.MAR = -999))).toBeNull();
    expect(broken((p) => delete p.T2M_MIN.JUN)).toBeNull();
    expect(broken((p) => (p.PRECTOTCORR.AUG = -0.2))).toBeNull();
    expect(broken((p) => (p.T2M_MAX.JUL = 'chaud'))).toBeNull();
    expect(powerClimateNormals(null)).toBeNull();
    expect(powerClimateNormals('{}')).toBeNull();
  });
});

describe('climateWindow : les mois du voyage', () => {
  it('garde les mois des dates, une fois chacun, dans l’ordre du voyage', () => {
    const w = climateWindow(normalsOf('paris'), ['2027-12-30', '2027-12-31', '2028-01-01', '2028-01-02']);
    expect(w?.months.map((m) => m.month)).toEqual([12, 1]);
    expect(w?.months[0]).toMatchObject({ tMeanC: 3.55, precipMmDay: 2.24 });
    expect(w?.months[1]).toMatchObject({ tMeanC: 3.0, tMinC: -12.33, tMaxC: 14.23 });
  });

  it('sans date lisible ou sans normales exploitables : null (rien n’est supposé)', () => {
    expect(climateWindow(normalsOf('paris'), [])).toBeNull();
    expect(climateWindow(normalsOf('paris'), ['demain', '2027-13-01'])).toBeNull();
    expect(climateWindow(null, dates(7))).toBeNull();
    expect(climateWindow({ tMean: [1], tMin: [1], tMax: [1], precip: [1] }, dates(7))).toBeNull();
  });
});

describe('readClimate : froid sans altitude, pluie, saison des pluies, chaleur', () => {
  it('froid : l’Islande, la Patagonie et Paris l’hiver sans qu’aucune altitude soit connue', () => {
    expect(read('reykjavik', 2)).toMatchObject({ cool: true, frost: true, icy: true, deepCold: true });
    expect(read('torres', 7)).toMatchObject({ cool: true, frost: true, icy: true, deepCold: true });
    expect(read('paris', 1)).toMatchObject({ cool: true, frost: true, icy: false, deepCold: false });
    // Paris en juin : ni couche chaude ni gel, malgré un minimum relevé à 2,7 °C.
    expect(read('paris', 6)).toMatchObject({ cool: false, frost: false, icy: false });
  });

  it('froid : le mois le plus froid du voyage l’emporte, et il est nommé', () => {
    const r = read('paris', 6, 12, 7);
    expect(r.coldest.month).toBe(12);
    expect(r.hottest.month).toBe(7);
  });

  it('les nuits d’altitude sous les tropiques gèlent (Cusco en juillet) mais pas l’été austral', () => {
    expect(read('cusco', 7)).toMatchObject({ cool: true, frost: true, icy: false });
    expect(read('cusco', 1)).toMatchObject({ cool: true, frost: false });
  });

  it('pluie : Reykjavik et le Mont-Blanc oui, Paris et Marrakech non', () => {
    expect(read('reykjavik', 9)).toMatchObject({ rainy: true });
    expect(read('chamonix', 5)).toMatchObject({ rainy: true, heavyRain: false });
    expect(read('paris', 10).rainy).toBe(false);
    expect(read('marrakech', 6).rainy).toBe(false);
  });

  it('pluies abondantes (mousson, saison des pluies) : Bali de décembre à mars, le Népal en juillet', () => {
    expect(read('ubud', 1)).toMatchObject({ rainy: true, heavyRain: true });
    expect(read('kathmandu', 7)).toMatchObject({ rainy: true, heavyRain: true });
    expect(read('ubud', 8).heavyRain).toBe(false);
    expect(read('kathmandu', 12).heavyRain).toBe(false);
    // Le seuil est une quantité de pluie, pas un lieu : Reykjavik en septembre (6,03 mm/jour) le dépasse aussi.
    expect(read('reykjavik', 9).heavyRain).toBe(true);
  });

  it('chaleur : Marrakech l’été (sec et chaud), Paris en juillet tiède, jamais l’hiver', () => {
    expect(read('marrakech', 7)).toMatchObject({ warm: true, hot: true });
    expect(read('marrakech', 7).desertHot?.month).toBe(7);
    expect(read('paris', 7)).toMatchObject({ warm: true, hot: false, desertHot: null });
    expect(read('paris', 1)).toMatchObject({ warm: false, hot: false });
    // Bali est chaud toute l’année mais pas sec : pas de climat désertique.
    expect(read('ubud', 11)).toMatchObject({ hot: true, desertHot: null });
  });

  it('les seuils sont ceux écrits (un seul endroit)', () => {
    expect(CLIMATE_THRESHOLDS).toMatchObject({ layerMeanC: 12, rainMmDay: 3, heavyRainMmDay: 6, warmMeanC: 18, hotMeanC: 24 });
  });
});

describe('getClimateNormals : le serveur lit une demande, gardée 30 jours', () => {
  afterEach(() => vi.restoreAllMocks());
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

  it('URL : climatologie au point arrondi à 0,01°, température et pluie', async () => {
    const { climateNormalsUrl } = await import('../server/weather');
    expect(climateNormalsUrl(-8.504, 115.2611)).toBe(
      'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M%2CT2M_MIN%2CT2M_MAX%2CPRECTOTCORR&community=RE&longitude=115.26&latitude=-8.50&format=JSON'
    );
  });

  it('lit les normales du point ; réponse gardée 30 jours', async () => {
    const { climateNormalsUrl, getClimateNormals } = await import('../server/weather');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(fixtures.ubud.payload));
    const normals = await getClimateNormals(-8.5, 115.26);
    expect(normals).toEqual(normalsOf('ubud'));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(climateNormalsUrl(-8.5, 115.26));
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(30 * 86_400);
  });

  it('service injoignable, réponse vide ou valeur de remplissage : null, l’écran ne comble rien', async () => {
    const { getClimateNormals } = await import('../server/weather');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValueOnce(new Error('réseau coupé'));
    expect(await getClimateNormals(-8.5, 115.26)).toBeNull();
    fetchSpy.mockImplementationOnce(async () => json({}));
    expect(await getClimateNormals(-8.5, 115.26)).toBeNull();
    const filled = structuredClone(fixtures.ubud.payload);
    (filled.properties.parameter.T2M as Record<string, number>).JUL = -999;
    fetchSpy.mockImplementationOnce(async () => json(filled));
    expect(await getClimateNormals(-8.5, 115.26)).toBeNull();
  });
});
