import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Branchement du référentiel `geo_massifs` (plan 3.3, GeoNames T et L) dans `lookupMassif` :
 * interrupteur allumé et massif connu près du lieu → le massif du référentiel, sans Nominatim ;
 * sinon, exactement le chemin d'avant (Nominatim, « massif <nom> »).
 */
vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) =>
    fn()
  ),
}));
vi.mock('../server/locationIq', () => ({ nominatimJson: vi.fn(async () => []) }));
vi.mock('../server/geoMassifs', () => ({
  geoMassifsEnabled: vi.fn(() => false),
  referentialMassif: vi.fn(async () => null),
}));

import { lookupMassif } from '../server/placeLookup';
import { nominatimJson } from '../server/locationIq';
import { geoMassifsEnabled, referentialMassif } from '../server/geoMassifs';
import type { GeoMassifRow } from '../engine/geoMassifs';

const EPINAL = { lat: 48.17, lon: 6.45 };
const VOSGES: GeoMassifRow = {
  geoname_id: 9000001,
  feature_code: 'MTS',
  name: 'Vosges',
  name_plain: 'vosges',
  country_code: 'FR',
  lat: 48.08333,
  lon: 7,
  elevation_m: 1424,
};

beforeEach(() => {
  vi.mocked(geoMassifsEnabled).mockReturnValue(false);
  vi.mocked(referentialMassif).mockReset().mockResolvedValue(null);
  vi.mocked(nominatimJson).mockClear();
});
afterEach(() => vi.clearAllMocks());

describe('lookupMassif : le référentiel avant Nominatim', () => {
  it('éteint : le référentiel n’est pas lu, Nominatim est interrogé comme avant', async () => {
    expect(await lookupMassif('Vosges', EPINAL)).toBeNull();
    expect(referentialMassif).not.toHaveBeenCalled();
    expect(String(vi.mocked(nominatimJson).mock.calls[0]?.[0])).toContain('q=massif%20Vosges');
  });
  it('allumé et connu : le massif du référentiel, un point sans emprise, aucun appel Nominatim', async () => {
    vi.mocked(geoMassifsEnabled).mockReturnValue(true);
    vi.mocked(referentialMassif).mockResolvedValue(VOSGES);
    expect(await lookupMassif('Vosges', EPINAL)).toEqual({
      name: 'Vosges',
      lat: 48.08333,
      lon: 7,
      countryCode: 'FR',
      country: null,
      kind: 'mountain_range',
      landmark: true,
      extent: null,
    });
    expect(referentialMassif).toHaveBeenCalledWith('Vosges', EPINAL);
    expect(nominatimJson).not.toHaveBeenCalled();
  });
  it('allumé mais inconnu ou en panne : repli exact sur Nominatim', async () => {
    vi.mocked(geoMassifsEnabled).mockReturnValue(true);
    vi.mocked(referentialMassif).mockRejectedValueOnce(new Error('base'));
    expect(await lookupMassif('Jura', EPINAL)).toBeNull();
    expect(nominatimJson).toHaveBeenCalledTimes(1);
  });
});
