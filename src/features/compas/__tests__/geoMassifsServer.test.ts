import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Lecteur serveur du référentiel `geo_massifs` : interrupteur, appel RPC, lignes validées. */
vi.mock('server-only', () => ({}));
const rpc = vi.fn();
let client: { rpc: typeof rpc } | null = { rpc };
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => client }));

import { geoMassifsEnabled, referentialMassif } from '../server/geoMassifs';

const EPINAL = { lat: 48.17, lon: 6.45 };
const VOSGES = {
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
  client = { rpc };
  rpc.mockReset().mockResolvedValue({ data: [VOSGES], error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.COMPAS_GEO_MASSIFS;
  vi.restoreAllMocks();
});

describe('referentialMassif', () => {
  it('interrupteur éteint (défaut) : null, la base n’est pas touchée', async () => {
    expect(geoMassifsEnabled()).toBe(false);
    expect(await referentialMassif('Vosges', EPINAL)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('allumé : la clé normalisée part à la RPC, la chaîne proche revient', async () => {
    process.env.COMPAS_GEO_MASSIFS = '1';
    expect(await referentialMassif('les Vosges', EPINAL)).toEqual(VOSGES);
    expect(rpc).toHaveBeenCalledWith('geo_massifs_by_name', { p_name_plain: 'vosges' });
  });
  it('ligne invalide ignorée, erreur de base ou client absent : null', async () => {
    process.env.COMPAS_GEO_MASSIFS = 'on';
    rpc.mockResolvedValueOnce({ data: [{ ...VOSGES, feature_code: 'PK' }], error: null });
    expect(await referentialMassif('Vosges', EPINAL)).toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42883' } });
    expect(await referentialMassif('Vosges', EPINAL)).toBeNull();
    rpc.mockRejectedValueOnce(new Error('réseau'));
    expect(await referentialMassif('Vosges', EPINAL)).toBeNull();
    client = null;
    expect(await referentialMassif('Vosges', EPINAL)).toBeNull();
  });
  it('nom sans clé : aucun appel', async () => {
    process.env.COMPAS_GEO_MASSIFS = '1';
    expect(await referentialMassif('Mountains', EPINAL)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
