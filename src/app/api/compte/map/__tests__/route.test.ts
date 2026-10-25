import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateUserCache } from '@/lib/perf/userMemo';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  loadCompteMap: vi.fn(),
}));

vi.mock('@/lib/api/requireUser', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/features/compte/map/server/loadCompteMap', () => ({
  loadCompteMap: mocks.loadCompteMap,
}));

import { GET } from '../route';

describe('GET /api/compte/map', () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.loadCompteMap.mockReset();
    invalidateUserCache('u1');
  });

  it('refuse sans session', async () => {
    mocks.requireUser.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.loadCompteMap).not.toHaveBeenCalled();
  });

  it('renvoie la carte du propriétaire', async () => {
    mocks.requireUser.mockResolvedValue({ ok: true, supabase: {}, user: { id: 'u1' } });
    mocks.loadCompteMap.mockResolvedValue({
      tracks: [],
      massifs: [],
      carnets: [],
      pois: [],
      stats: { outings: 0, km: 0, dplus: 0, massifs: 0, countries: 0 },
      bounds: null,
      truncated: false,
      generatedAt: 'x',
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.loadCompteMap).toHaveBeenCalledWith({}, 'u1');
  });

  it('ne casse pas la page en cas d’erreur serveur', async () => {
    mocks.requireUser.mockResolvedValue({ ok: true, supabase: {}, user: { id: 'u1' } });
    mocks.loadCompteMap.mockRejectedValue(new Error('boom'));
    const response = await GET();
    expect(response.status).toBe(500);
  });
});
