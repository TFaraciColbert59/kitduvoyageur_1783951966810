/**
 * `/api/geocode` dans la langue de l'interface (PLAN-100 6.4) : Photon (`lang`) et Nominatim
 * (`accept-language`) reçoivent la langue de la personne ; le cache mémoire la distingue. En
 * français, les adresses sont celles d'avant, À L'IDENTIQUE (Nominatim sans `accept-language`).
 * Réseau simulé : aucun appel réel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodePlace, reverseGeocodePlace, __resetGeoCache, __resetNominatimCadence } from '../geocodeService';

let fetchMock: ReturnType<typeof vi.fn>;
const json = (payload: unknown) =>
  ({ ok: true, headers: { get: () => 'application/json' }, json: () => Promise.resolve(payload) }) as unknown as Response;
const PHOTON = {
  features: [
    {
      geometry: { coordinates: [16.37, 48.2] },
      properties: { name: 'Vienna', osm_key: 'place', osm_value: 'city', type: 'city', country: 'Austria', osm_id: 1 },
    },
  ],
};
const urls = () => fetchMock.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  __resetGeoCache();
  __resetNominatimCadence();
  fetchMock = vi.fn(async () => json(PHOTON));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('géocodage du préparateur : langue de l’interface', () => {
  it('français (défaut) : Photon lang=fr, adresse d’avant', async () => {
    await geocodePlace('Vienne');
    expect(urls()).toEqual(['https://photon.komoot.io/api/?q=Vienne&limit=8&lang=fr']);
    await geocodePlace('Vienne', 'fr');
    expect(urls()).toHaveLength(1); // même clé de cache qu’avant
  });

  it('français : Nominatim (repli) sans accept-language, comme avant', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.includes('photon') ? Promise.reject(new Error('503')) : json([])));
    await geocodePlace('Vienne');
    const nomi = urls().find((u) => u.includes('nominatim'))!;
    expect(nomi).toBe('https://nominatim.openstreetmap.org/search?q=Vienne&format=jsonv2&limit=8&addressdetails=1');
  });

  it('anglais : lang=en et accept-language=en ; le cache ne mélange pas les langues', async () => {
    await geocodePlace('Vienna', 'fr');
    await geocodePlace('Vienna', 'en');
    expect(urls()).toEqual([
      'https://photon.komoot.io/api/?q=Vienna&limit=8&lang=fr',
      'https://photon.komoot.io/api/?q=Vienna&limit=8&lang=en',
    ]);
    fetchMock.mockImplementation(async (url: string) => (url.includes('photon') ? Promise.reject(new Error('503')) : json([])));
    await geocodePlace('Wien', 'en');
    expect(urls().find((u) => u.includes('nominatim'))).toContain('&accept-language=en');
  });

  it('langue absente du Photon public : default (noms locaux), jamais une erreur 400', async () => {
    await geocodePlace('Wien', 'es');
    expect(urls()[0]).toBe('https://photon.komoot.io/api/?q=Wien&limit=8&lang=default');
  });

  it('point inverse : fr d’avant, en à part (clé et adresses)', async () => {
    await reverseGeocodePlace(48.2, 16.37);
    await reverseGeocodePlace(48.2, 16.37, 'en');
    expect(urls()).toEqual([
      'https://photon.komoot.io/reverse?lat=48.2&lon=16.37&limit=8&lang=fr',
      'https://photon.komoot.io/reverse?lat=48.2&lon=16.37&limit=8&lang=en',
    ]);
  });
});
