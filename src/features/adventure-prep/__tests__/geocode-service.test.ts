import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodePlace, normalizeOpenMeteo, normalizePhoton, __resetGeoCache } from '../geocodeService';

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

