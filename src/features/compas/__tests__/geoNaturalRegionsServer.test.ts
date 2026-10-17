import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Régions naturelles et presqu'îles du référentiel `geo_massifs` (plan 3.3, GeoNames `RGN` et
 * `PEN`) : lecteur serveur et choix. Même interrupteur que les massifs (COMPAS_GEO_MASSIFS).
 * Un nom qui n'est pas celui du lieu (« Crozon » la commune pour « Presqu'île de Crozon »), un
 * relief, un pays différent ou des homonymes de pays différents sans pays donné : null.
 */
vi.mock('server-only', () => ({}));
const rpc = vi.fn();
let client: { rpc: typeof rpc } | null = { rpc };
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => client }));

import { pickNaturalRegion, referentialNaturalRegion } from '../server/geoMassifs';
import type { GeoMassifRow } from '../engine/geoMassifs';

const CROZON: GeoMassifRow = {
  geoname_id: 3022000,
  feature_code: 'PEN',
  name: "Presqu'île de Crozon",
  name_plain: 'crozon',
  country_code: 'FR',
  lat: 48.25,
  lon: -4.5,
  elevation_m: null,
};
const CAMARGUE: GeoMassifRow = {
  geoname_id: 3028000,
  feature_code: 'RGN',
  name: 'Camargue',
  name_plain: 'camargue',
  country_code: 'FR',
  lat: 43.53,
  lon: 4.5,
  elevation_m: null,
};
const VOSGES: GeoMassifRow = {
  ...CAMARGUE,
  geoname_id: 9000001,
  feature_code: 'MTS',
  name: 'Vosges',
  name_plain: 'vosges',
};

beforeEach(() => {
  client = { rpc };
  rpc.mockReset().mockResolvedValue({ data: [CAMARGUE], error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.COMPAS_GEO_MASSIFS;
  vi.restoreAllMocks();
});

describe('pickNaturalRegion', () => {
  it('le nom du lieu, région naturelle ou presqu’île', () => {
    expect(pickNaturalRegion([CAMARGUE], 'Camargue', null)).toEqual(CAMARGUE);
    expect(pickNaturalRegion([CROZON], "Presqu'île de Crozon", 'FR')).toEqual(CROZON);
    expect(pickNaturalRegion([CROZON], 'presqu’ile de crozon', null)).toEqual(CROZON);
  });
  it('« Crozon » (la commune) n’est pas « Presqu’île de Crozon » : null', () => {
    expect(pickNaturalRegion([CROZON], 'Crozon', 'FR')).toBeNull();
  });
  it('un relief n’est pas une région naturelle (lookupMassif s’en charge) : null', () => {
    expect(pickNaturalRegion([VOSGES], 'Vosges', 'FR')).toBeNull();
  });
  it('autre pays : null ; homonymes de pays différents sans pays donné : null, jamais un tirage', () => {
    expect(pickNaturalRegion([CAMARGUE], 'Camargue', 'ES')).toBeNull();
    const other = { ...CAMARGUE, geoname_id: 1, country_code: 'US' };
    expect(pickNaturalRegion([CAMARGUE, other], 'Camargue', null)).toBeNull();
    expect(pickNaturalRegion([CAMARGUE, other], 'Camargue', 'FR')).toEqual(CAMARGUE);
  });
});

describe('referentialNaturalRegion', () => {
  it('interrupteur éteint (défaut) : null, la base n’est pas touchée', async () => {
    expect(await referentialNaturalRegion('Camargue', 'FR')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('allumé : la clé normalisée part à la RPC des massifs, la région revient', async () => {
    process.env.COMPAS_GEO_MASSIFS = '1';
    expect(await referentialNaturalRegion('Camargue', 'FR')).toEqual(CAMARGUE);
    expect(rpc).toHaveBeenCalledWith('geo_massifs_by_name', { p_name_plain: 'camargue' });
  });
  it('allumé, erreur de base, ligne invalide ou sans client : null', async () => {
    process.env.COMPAS_GEO_MASSIFS = '1';
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42P01' } });
    expect(await referentialNaturalRegion('Camargue', 'FR')).toBeNull();
    rpc.mockResolvedValueOnce({ data: [{ ...CAMARGUE, lat: 'x' }], error: null });
    expect(await referentialNaturalRegion('Camargue', 'FR')).toBeNull();
    client = null;
    expect(await referentialNaturalRegion('Camargue', 'FR')).toBeNull();
  });
});
