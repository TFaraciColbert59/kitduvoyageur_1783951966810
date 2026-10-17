import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Lecteur serveur `referentialPlaceSearch` : interrupteur, appel RPC, lignes validées, choix sûr. */
vi.mock('server-only', () => ({}));
const rpc = vi.fn();
let client: { rpc: typeof rpc } | null = { rpc };
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => client }));

import { geoPlacesSearchEnabled, referentialPlaceSearch } from '../server/geoPlaces';

const VILLARD = {
  geoname_id: 2967421,
  name: 'Villard-de-Lans',
  kind: 'village',
  country_code: 'FR',
  admin1: '84',
  lat: 45.07131,
  lon: 5.55392,
  ele_m: 1050,
  population: 4096,
  timezone: 'Europe/Paris',
  updated_at: '2026-10-08',
};

beforeEach(() => {
  client = { rpc };
  rpc.mockReset().mockResolvedValue({ data: [VILLARD], error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.COMPAS_GEO_PLACES_SEARCH;
  vi.restoreAllMocks();
});

describe('referentialPlaceSearch', () => {
  it('interrupteur éteint (défaut) : null, la base n’est pas touchée', async () => {
    expect(geoPlacesSearchEnabled()).toBe(false);
    expect(await referentialPlaceSearch('Villard-de-Lans')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('allumé : le nom saisi part à la RPC, le lieu revient en lieu du Compas', async () => {
    process.env.COMPAS_GEO_PLACES_SEARCH = '1';
    expect(await referentialPlaceSearch(' Villard de Lans ', 'fr')).toEqual({
      name: 'Villard-de-Lans',
      lat: 45.07131,
      lon: 5.55392,
      countryCode: 'FR',
      country: 'France',
      kind: 'village',
      settlement: true,
      settlementRank: 3,
      extent: null,
    });
    expect(rpc).toHaveBeenCalledWith('geo_places_search', {
      p_q: 'Villard de Lans',
      p_cc: 'FR',
      p_limit: 12,
    });
  });
  it('sans pays : p_cc nul', async () => {
    process.env.COMPAS_GEO_PLACES_SEARCH = 'on';
    await referentialPlaceSearch('Villard de Lans');
    expect(rpc).toHaveBeenCalledWith('geo_places_search', {
      p_q: 'Villard de Lans',
      p_cc: null,
      p_limit: 12,
    });
  });
  it('ambigu, absent, ligne invalide, erreur de base, panne ou client absent : null', async () => {
    process.env.COMPAS_GEO_PLACES_SEARCH = 'true';
    rpc.mockResolvedValueOnce({
      data: [VILLARD, { ...VILLARD, geoname_id: 2, population: 3000 }],
      error: null,
    });
    expect(await referentialPlaceSearch('Villard de Lans')).toBeNull();
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await referentialPlaceSearch('Villard de Lans')).toBeNull();
    rpc.mockResolvedValueOnce({ data: [{ ...VILLARD, lat: 'x' }], error: null });
    expect(await referentialPlaceSearch('Villard de Lans')).toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42883' } });
    expect(await referentialPlaceSearch('Villard de Lans')).toBeNull();
    rpc.mockResolvedValueOnce({ data: 'oups', error: null });
    expect(await referentialPlaceSearch('Villard de Lans')).toBeNull();
    rpc.mockRejectedValueOnce(new Error('réseau'));
    expect(await referentialPlaceSearch('Villard de Lans')).toBeNull();
    client = null;
    expect(await referentialPlaceSearch('Villard de Lans')).toBeNull();
  });
  it('nom trop court, sans lettre latine ou nom de pays : aucun appel', async () => {
    process.env.COMPAS_GEO_PLACES_SEARCH = '1';
    expect(await referentialPlaceSearch('Ay')).toBeNull();
    expect(await referentialPlaceSearch('Москва')).toBeNull();
    expect(await referentialPlaceSearch('Panama')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
