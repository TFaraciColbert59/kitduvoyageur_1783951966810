import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Branchement des régions naturelles et presqu'îles GeoNames (`RGN`, `PEN`, plan 3.3) dans
 * `lookupNatural` : interrupteur COMPAS_GEO_MASSIFS allumé et lieu connu → le lieu du référentiel,
 * un point sans emprise, sans Photon ; sinon (éteint, inconnu, panne, recherche de rivière),
 * exactement la recherche Photon d'avant.
 */
vi.mock('server-only', () => ({}));
vi.mock('@/lib/i18n/serverLocale', () => ({ getRequestLocale: vi.fn(async () => 'fr') }));
vi.mock('@/lib/siteSlot', () => ({ photonSlot: vi.fn(async () => true) }));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) =>
    fn()
  ),
}));
vi.mock('../server/geoMassifs', () => ({
  geoMassifsEnabled: vi.fn(() => false),
  referentialMassif: vi.fn(async () => null),
  referentialNaturalRegion: vi.fn(async () => null),
}));

import { lookupNatural } from '../server/placeLookup';
import { geoMassifsEnabled, referentialNaturalRegion } from '../server/geoMassifs';
import type { GeoMassifRow } from '../engine/geoMassifs';

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
const CROZON: GeoMassifRow = {
  ...CAMARGUE,
  geoname_id: 3022000,
  feature_code: 'PEN',
  name: "Presqu'île de Crozon",
  name_plain: 'crozon',
  lat: 48.25,
  lon: -4.5,
};

const fetchMock = vi.fn(
  async (..._args: unknown[]) => new Response(JSON.stringify({ features: [] }), { status: 200 })
);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(geoMassifsEnabled).mockReturnValue(false);
  vi.mocked(referentialNaturalRegion).mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('lookupNatural : régions naturelles et presqu’îles du référentiel', () => {
  it('éteint : le référentiel n’est pas lu, Photon est interrogé comme avant', async () => {
    expect(await lookupNatural('Camargue', 'FR')).toBeNull();
    expect(referentialNaturalRegion).not.toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('photon.komoot.io/api/?q=Camargue');
  });
  it('allumé et connu : la région naturelle, un point sans emprise, aucun appel Photon', async () => {
    vi.mocked(geoMassifsEnabled).mockReturnValue(true);
    vi.mocked(referentialNaturalRegion).mockResolvedValue(CAMARGUE);
    expect(await lookupNatural('Camargue', 'FR')).toEqual({
      name: 'Camargue',
      lat: 43.53,
      lon: 4.5,
      countryCode: 'FR',
      country: null,
      kind: 'natural_region',
      landmark: true,
      extent: null,
    });
    expect(referentialNaturalRegion).toHaveBeenCalledWith('Camargue', 'FR');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('allumé : une presqu’île nommée', async () => {
    vi.mocked(geoMassifsEnabled).mockReturnValue(true);
    vi.mocked(referentialNaturalRegion).mockResolvedValue(CROZON);
    expect(await lookupNatural("Presqu'île de Crozon", null)).toMatchObject({
      name: "Presqu'île de Crozon",
      kind: 'peninsula',
      extent: null,
    });
  });
  it('allumé mais inconnu ou en panne : repli exact sur Photon', async () => {
    vi.mocked(geoMassifsEnabled).mockReturnValue(true);
    vi.mocked(referentialNaturalRegion).mockRejectedValueOnce(new Error('base'));
    expect(await lookupNatural('Bretagne', 'FR')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('recherche d’une rivière (lookupRiver) : le référentiel des régions n’est pas lu', async () => {
    vi.mocked(geoMassifsEnabled).mockReturnValue(true);
    vi.mocked(referentialNaturalRegion).mockResolvedValue(CAMARGUE);
    await lookupNatural('Le Tarn', 'FR', true);
    expect(referentialNaturalRegion).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
