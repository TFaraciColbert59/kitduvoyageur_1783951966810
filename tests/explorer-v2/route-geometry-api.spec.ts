import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route API de géométrie réelle : elle doit exposer `get_route_geojson` sans
 * simplification, refuser les identifiants invalides et distinguer un 404 d'une
 * panne (503). Aucun appel réseau : la RPC PostgREST est doublée.
 */

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/explorer-v2/pgrest', () => ({ rpc: rpcMock }));

import { GET } from '@/app/api/explorer/v2/routes/[id]/geometry/route';

function call(id: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/explorer/v2/routes/${id}/geometry`), {
    params: Promise.resolve({ id }),
  });
}

describe('API géométrie réelle · /api/explorer/v2/routes/[id]/geometry', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('sert la géométrie complète de get_route_geojson', async () => {
    const geojson = {
      type: 'LineString',
      coordinates: [
        [6.86, 45.9209],
        [6.88, 45.9209],
      ],
    };
    rpcMock.mockResolvedValue(geojson);

    const response = await call('42');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ geojson });
    expect(rpcMock).toHaveBeenCalledWith(
      'get_route_geojson',
      { p_route_id: 42 },
      86_400,
    );
  });

  it('décode une géométrie renvoyée en chaîne JSON', async () => {
    rpcMock.mockResolvedValue(JSON.stringify({ type: 'LineString', coordinates: [] }));
    const response = await call('7');
    expect(response.status).toBe(200);
    expect((await response.json()).geojson).toEqual({
      type: 'LineString',
      coordinates: [],
    });
  });

  it('répond 404 quand la route n’a pas de géométrie', async () => {
    rpcMock.mockResolvedValue(null);
    const response = await call('99');
    expect(response.status).toBe(404);
  });

  it('refuse un identifiant non numérique ou nul', async () => {
    expect((await call('abc')).status).toBe(400);
    expect((await call('0')).status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('répond 503 quand la lecture échoue', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    rpcMock.mockRejectedValue(new Error('PostgREST 500'));
    const response = await call('12');
    expect(response.status).toBe(503);
    errorSpy.mockRestore();
  });
});
