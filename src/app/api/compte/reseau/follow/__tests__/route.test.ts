import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCached, invalidateUserCache, setCached, userCacheKey } from '@/lib/perf/userMemo';

const TARGET = '00000000-0000-4000-8000-000000000002';
const OWNER = '00000000-0000-4000-8000-000000000001';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  readReseauError: vi.fn(),
}));

vi.mock('@/lib/api/requireUser', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/features/compte/server/reseau', () => ({
  followUser: mocks.followUser,
  unfollowUser: mocks.unfollowUser,
  readReseauError: mocks.readReseauError,
}));

import { DELETE, POST } from '../route';

function request(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/compte/reseau/follow', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mapCacheKey() {
  return userCacheKey(OWNER, 'map');
}

describe('/api/compte/reseau/follow — invalidation du cache acteur', () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.followUser.mockReset();
    mocks.unfollowUser.mockReset();
    mocks.readReseauError.mockReset();
    invalidateUserCache(OWNER);
    mocks.requireUser.mockResolvedValue({
      ok: true,
      supabase: {},
      user: { id: OWNER },
    });
    mocks.followUser.mockResolvedValue('requested');
    mocks.unfollowUser.mockResolvedValue('unfollowed');
  });

  it('invalide le cache acteur après une demande sortante', async () => {
    setCached(mapCacheKey(), { points: [] }, 30_000);

    const response = await POST(request({ userId: TARGET }));

    expect(response.status).toBe(200);
    expect(mocks.followUser).toHaveBeenCalledWith({}, TARGET);
    expect(getCached(mapCacheKey())).toBeNull();
  });

  it('invalide le cache acteur après un retrait de suivi', async () => {
    setCached(mapCacheKey(), { points: [] }, 30_000);

    const response = await DELETE(request({ userId: TARGET }, 'DELETE'));

    expect(response.status).toBe(200);
    expect(mocks.unfollowUser).toHaveBeenCalledWith({}, TARGET);
    expect(getCached(mapCacheKey())).toBeNull();
  });
});
