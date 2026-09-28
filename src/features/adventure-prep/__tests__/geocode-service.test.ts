import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  geocodePlace,
  reverseGeocodePlace,
  normalizeOpenMeteo,
  normalizePhoton,
  __resetGeoCache,
} from '../geocodeService';

const OK = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetGeoCache();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('normalizeOpenMeteo', () => {
  it('convertit un resultat open-meteo en lieu du produit', () => {
    const out = normalizeOpenMeteo({
      results: [
        {
          id: 1,
          name: 'Chamonix-Mont-Blanc',
          latitude: 45.9237,
          longitude: 6.8694,
          country: 'France',
          admin1: 'Auvergne-Rhône-Alpes',
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: 'Chamonix-Mont-Blanc',
      country: 'France',
      lat: 45.9237,
      lon: 6.8694,
      provider: 'open-meteo',
    });
    expect(out[0].context).toContain('Auvergne-Rhône-Alpes');
  });

  it('ecarte une coordonnee absente ou hors bornes', () => {
    const out = normalizeOpenMeteo({
      results: [
        { id: 1, name: 'Nulle', latitude: 999, longitude: 0, country: 'X' },
        { id: 2, name: 'AlsoNulle', country: 'X' },
        { id: 3, name: 'OK', latitude: 45, longitude: 6, country: 'France' },
      ],
    });
    expect(out.map((r) => r.name)).toEqual(['OK']);
  });
});

describe('normalizePhoton', () => {
  it('convertit un resultat photon en lieu du produit', () => {
    const out = normalizePhoton({
      features: [
        {
          geometry: { coordinates: [6.8694, 45.9237] },
          properties: { name: 'Argentière', country: 'France', state: 'Auvergne-Rhône-Alpes', type: 'city' },
        },
      ],
    });
    expect(out[0]).toMatchObject({ name: 'Argentière', lat: 45.9237, lon: 6.8694, provider: 'photon' });
  });

  it('signale une correspondance approximative, jamais une commune', () => {
    const out = normalizePhoton({
      features: [
        {
          geometry: { coordinates: [6.87, 45.92] },
          properties: { name: 'Imagin hair', country: 'France', type: 'other' },
        },
      ],
    });
    expect(out[0].precision).toBe('inexact');
  });

  it('signale une commune resolue', () => {
    const out = normalizePhoton({
      features: [
        {
          geometry: { coordinates: [6.87, 45.92] },
          properties: { name: 'Chamonix', country: 'France', type: 'town' },
        },
      ],
    });
    expect(out[0].precision).toBe('commune');
  });
});

describe('geocodePlace', () => {
  it('utilise le fournisseur principal quand il repond', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: 1, name: 'Chamonix', latitude: 45.92, longitude: 6.87, country: 'France' }] }),
    } as Response);
    const res = await geocodePlace('Chamonix');
    expect(res.status).toBe('ok');
    expect(res.matches[0].name).toBe('Chamonix');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bascule sur le repli quand le principal echoue', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ features: [{ geometry: { coordinates: [6.87, 45.92] }, properties: { name: 'Chamonix', country: 'France' } }] }),
      } as Response);
    const res = await geocodePlace('Chamonix');
    expect(res.status).toBe('ok');
    expect(res.matches[0].provider).toBe('photon');
  });

  it('repond no_result sans inventer de coordonnee quand personne ne trouve', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as Response);
    const res = await geocodePlace('Lieu imaginaire xyz');
    expect(res.status).toBe('no_result');
    expect(res.matches).toEqual([]);
  });

  it('repond unavailable quand tous les fournisseurs tombent', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const res = await geocodePlace('Chamonix');
    expect(res.status).toBe('unavailable');
    expect(res.matches).toEqual([]);
  });

  it('refuse une requete trop courte ou trop longue sans appeler le reseau', async () => {
    expect((await geocodePlace('a')).status).toBe('invalid');
    expect((await geocodePlace('x'.repeat(200))).status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('met en cache les requetes repetées', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: 1, name: 'Chamonix', latitude: 45.92, longitude: 6.87, country: 'France' }] }),
    } as Response);
    await geocodePlace('Chamonix');
    await geocodePlace('chamonix');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('geocodage inverse', () => {
  it('R1: transforme un point en commune, avec son pays', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: { coordinates: [6.869, 45.923] },
              properties: { name: 'Chamonix-Mont-Blanc', city: 'Chamonix-Mont-Blanc', country: 'France', state: 'Auvergne-Rhone-Alpes', type: 'city' },
            },
          ],
        }),
    } as Response);
    const res = await reverseGeocodePlace(45.9237, 6.8694);
    expect(res.status).toBe('ok');
    expect(res.matches[0]).toMatchObject({ name: 'Chamonix-Mont-Blanc', country: 'France', precision: 'commune' });
  });

  it('R2: garde la position exacte, pas le centroid du fournisseur', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: { coordinates: [6.869, 45.923] },
              properties: { name: 'Chamonix-Mont-Blanc', country: 'France', type: 'city' },
            },
          ],
        }),
    } as Response);
    const res = await reverseGeocodePlace(45.9237, 6.8694);
    // Le fournisseur rend le centre de la commune, pas le point demande : on
    // rend le nom mais on conserve la position reellement mesuree.
    expect(res.matches[0].lat).toBe(45.9237);
    expect(res.matches[0].lon).toBe(6.8694);
  });

  it('R3: ne prend que la ligne de type commune', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          features: [
            { geometry: { coordinates: [6.86, 45.92] }, properties: { name: 'Rue du Mont', country: 'France', type: 'street' } },
            { geometry: { coordinates: [6.87, 45.93] }, properties: { name: 'Chamonix-Mont-Blanc', country: 'France', type: 'city' } },
          ],
        }),
    } as Response);
    const res = await reverseGeocodePlace(45.9237, 6.8694);
    expect(res.matches.map((m) => m.name)).toEqual(['Chamonix-Mont-Blanc']);
  });

  it('R4: refuse une coordonnee hors bornes sans appeler le reseau', async () => {
    expect((await reverseGeocodePlace(999, 0)).status).toBe('invalid');
    expect((await reverseGeocodePlace(Number.NaN, 0)).status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('R5: distingue reseau tombe et personne ne connait ce point', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [] }),
    } as Response);
    expect((await reverseGeocodePlace(45.9, 6.8)).status).toBe('no_result');

    __resetGeoCache();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect((await reverseGeocodePlace(48.8, 2.2)).status).toBe('unavailable');
  });

  it('R6: annonce la commune, jamais le batiment le plus proche', async () => {
    // Releve reel sur /api/geocode?lat=45.9237&lon=6.8694 : Photon en inverse
    // rend d abord des batiments (« Archives municipales de Chamonix-Mont-
    // Blanc », type `house`). Ecrire ce nom afficherait un monument public
    // comme si c etait le point de depart. Le nom vient de la commune.
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: { coordinates: [6.869414, 45.9237221] },
              properties: {
                name: 'Archives municipales de Chamonix-Mont-Blanc',
                type: 'house',
                city: 'Chamonix-Mont-Blanc',
                county: 'Haute-Savoie',
                state: 'Auvergne-Rhone-Alpes',
                country: 'France',
              },
            },
          ],
        }),
    } as Response);
    const res = await reverseGeocodePlace(45.9237, 6.8694);
    expect(res.status).toBe('ok');
    expect(res.matches[0].name).toBe('Chamonix-Mont-Blanc');
    expect(res.matches[0].context).toBe('Haute-Savoie');
  });
});

