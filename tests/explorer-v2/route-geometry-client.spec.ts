import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ROUTE_GEOMETRY_TIMEOUT_MS,
  RouteGeometryTimeoutError,
  fetchRouteGeometry,
} from '@/features/explorer-v2/data/routeGeometry';

/**
 * Client de géométrie : une requête ne doit jamais rester suspendue et une
 * erreur passagère doit être retentée. Le 404 reste définitif (aucune trace).
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('explorer-v2 · client de géométrie', () => {
  it('borne une requête suspendue par un délai', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    await expect(
      fetchRouteGeometry('1', { timeoutMs: 20, attempts: 1, retryDelayMs: 0 }),
    ).rejects.toBeInstanceOf(RouteGeometryTimeoutError);
  });

  it('retente une erreur passagère puis publie la géométrie', async () => {
    const geojson = {
      type: 'LineString',
      coordinates: [
        [6.86, 45.92],
        [6.88, 45.92],
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ geojson }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchRouteGeometry('1', { timeoutMs: 1_000, attempts: 2, retryDelayMs: 1 }),
    ).resolves.toEqual(geojson);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ne retente pas un 404 : la route n’existe pas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchRouteGeometry('999', { timeoutMs: 1_000, attempts: 2, retryDelayMs: 1 }),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('s’arrête immédiatement quand l’appelant annule', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const controller = new AbortController();
    const pending = fetchRouteGeometry('1', {
      signal: controller.signal,
      timeoutMs: ROUTE_GEOMETRY_TIMEOUT_MS,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
