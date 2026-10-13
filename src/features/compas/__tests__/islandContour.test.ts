import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `lookupIslandContour` : le contour d'une île, lu en UNE requête Nominatim (`polygon_geojson=1`). La carte est
 * simulée à sa frontière (`fetch`) ; le choix de la ligne (île de ce nom, la plus proche, polygone lisible) et
 * l'absence de contour deviné sont réels.
 */
vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));

import { lookupIslandContour } from '../server/placeLookup';
import { onIslandContour } from '../engine/islands';

const SICILE_RING = [[12.45, 37.95], [13.3, 38.2], [14.3, 38.05], [15.6, 38.3], [15.65, 38.2], [15.1, 37.4], [15.3, 37.0], [15.1, 36.65], [14.4, 36.8], [13.6, 37.25], [12.6, 37.55], [12.45, 37.95]];
const row = (over: Record<string, unknown>) => ({
  category: 'place',
  type: 'island',
  name: 'Sicile',
  lat: '37.55',
  lon: '14.0',
  geojson: { type: 'Polygon', coordinates: [SICILE_RING] },
  ...over,
});
const NEAR = { lat: 37.5, lon: 14.0 };
const ask = async () => {
  const call = lookupIslandContour({ name: 'Sicile', near: NEAR, halfExtentKm: 167 });
  // Nominatim : une requête à la fois, une pause après chacune.
  await vi.advanceTimersByTimeAsync(3000);
  return call;
};

let rows: unknown;
let urls: string[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  urls = [];
  rows = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    urls.push(String(input));
    if (rows === 'down') throw new Error('réseau');
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('lookupIslandContour', () => {
  it('une requête Nominatim avec le polygone, et le contour de l’île de ce nom', async () => {
    rows = [row({})];
    const contour = await ask();
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
    expect(urls[0]).toContain('polygon_geojson=1');
    expect(urls[0]).toContain('q=Sicile');
    expect(contour).not.toBeNull();
    expect(onIslandContour(contour!, { lat: 37.55, lon: 14.0 })).toBe(true);
    // La Calabre, de l'autre côté du détroit, n'en fait pas partie.
    expect(onIslandContour(contour!, { lat: 38.15, lon: 15.87 })).toBe(false);
  });

  it('seule une île (place=island) compte : une région administrative de même nom est écartée', async () => {
    rows = [
      row({ category: 'boundary', type: 'administrative', geojson: { type: 'Polygon', coordinates: [[[10, 35], [18, 35], [18, 41], [10, 41], [10, 35]]] } }),
      row({}),
    ];
    const contour = await ask();
    // Le polygone administratif (qui englobe la Calabre) n'a pas été pris.
    expect(onIslandContour(contour!, { lat: 38.15, lon: 15.87 })).toBe(false);
    expect(onIslandContour(contour!, { lat: 37.55, lon: 14.0 })).toBe(true);
  });

  it('plusieurs îles du même nom : la plus proche de l’île cherchée, jamais l’homonyme lointain', async () => {
    const far = [[100, 10], [101, 10], [101, 11], [100, 11], [100, 10]];
    rows = [row({ lat: '10.5', lon: '100.5', geojson: { type: 'Polygon', coordinates: [far] } }), row({})];
    const contour = await ask();
    expect(onIslandContour(contour!, { lat: 37.55, lon: 14.0 })).toBe(true);
    expect(onIslandContour(contour!, { lat: 10.5, lon: 100.5 })).toBe(false);
  });

  it('rien de lisible : null, jamais un contour deviné', async () => {
    for (const payload of [
      [],
      'down',
      [row({ geojson: { type: 'Point', coordinates: [14, 37.5] } })],
      [row({ geojson: undefined })],
      [row({ lat: '10.5', lon: '100.5' })],
      [row({ category: 'boundary', type: 'administrative' })],
    ]) {
      rows = payload;
      expect(await ask(), JSON.stringify(payload).slice(0, 60)).toBeNull();
    }
  });

  it('un nom vide n’appelle aucun service', async () => {
    expect(await lookupIslandContour({ name: '  ', near: NEAR, halfExtentKm: 100 })).toBeNull();
    expect(urls).toHaveLength(0);
  });
});
