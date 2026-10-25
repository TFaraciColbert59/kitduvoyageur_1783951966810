import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 2.10 : « autour de moi » (recherche de parcours) reçoit la position de
 * l'appareil ; elle est arrondie à 0,01° (~1 km) dès l'entrée du serveur, même si un
 * client la donne plus fine, avant tout appel à la base. Client Supabase simulé.
 */
const h = vi.hoisted(() => ({ rpcArgs: [] as Array<Record<string, unknown>> }));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'compas_search_routes') h.rpcArgs.push(args);
      return { data: [], error: null };
    },
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'not', 'limit']) chain[m] = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
      return chain;
    },
  }),
}));

import { compasSearchRoutesAction } from '../server/compasActions';

beforeEach(() => {
  h.rpcArgs = [];
});

describe('compasSearchRoutesAction : la position est arrondie à ~1 km', () => {
  it('une position fine arrive arrondie à la base', async () => {
    const res = await compasSearchRoutesAction({ lat: 45.923712, lon: 6.869349, query: null });
    expect(res.success).toBe(true);
    expect(h.rpcArgs).toHaveLength(1);
    expect(h.rpcArgs[0]).toMatchObject({ p_lat: 45.92, p_lng: 6.87, p_radius_km: 50 });
  });

  it('une recherche par nom ne porte aucune position ; une moitié de position n’est pas gardée', async () => {
    await compasSearchRoutesAction({ lat: null, lon: null, query: 'Tour du Mont-Blanc' });
    await compasSearchRoutesAction({ lat: 45.923712, lon: null, query: 'GR5' });
    expect(h.rpcArgs[0]).toMatchObject({ p_lat: null, p_lng: null, p_query: 'Tour du Mont-Blanc' });
    expect(h.rpcArgs[1]).toMatchObject({ p_lat: null, p_lng: null, p_query: 'GR5' });
  });

  it('une position hors du monde est refusée avant tout appel', async () => {
    const res = await compasSearchRoutesAction({ lat: 123, lon: 6.87, query: null });
    expect(res.success).toBe(false);
    expect(h.rpcArgs).toHaveLength(0);
  });
});
