import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCached, setCached, userCacheKey } from '@/lib/perf/userMemo';

const ACTOR = '00000000-0000-4000-8000-000000000001';
const REQUEST_ID = '00000000-0000-4000-8000-000000000010';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  respondFollowRequest: vi.fn(),
  readReseauError: vi.fn(),
}));

vi.mock('@/lib/api/requireUser', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/features/compte/server/reseau', () => ({
  loadFollowRequests: vi.fn(),
  respondFollowRequest: mocks.respondFollowRequest,
  readReseauError: mocks.readReseauError,
}));

import { POST } from '../route';

function request(body: unknown) {
  return new Request('http://localhost/api/compte/reseau/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/compte/reseau/requests — invalidation après réponse', () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.respondFollowRequest.mockReset();
    mocks.readReseauError.mockReset();
    mocks.requireUser.mockResolvedValue({
      ok: true,
      supabase: {},
      user: { id: ACTOR },
    });
    mocks.respondFollowRequest.mockResolvedValue(undefined);
    mocks.readReseauError.mockImplementation((_error: unknown, fallback: string) => fallback);
    setCached(userCacheKey(ACTOR, 'bootstrap'), { authenticated: true }, 15_000);
    setCached(userCacheKey(ACTOR, 'map'), { points: [] }, 30_000);
  });

  it('invalide le cache du compte après une acceptation', async () => {
    const response = await POST(request({ requestId: REQUEST_ID, action: 'accept' }));

    expect(response.status).toBe(200);
    expect(mocks.respondFollowRequest).toHaveBeenCalledWith({}, REQUEST_ID, 'accept');
    expect(getCached(userCacheKey(ACTOR, 'bootstrap'))).toBeNull();
    expect(getCached(userCacheKey(ACTOR, 'map'))).toBeNull();
  });

  it('invalide aussi après un refus', async () => {
    const response = await POST(request({ requestId: REQUEST_ID, action: 'decline' }));

    expect(response.status).toBe(200);
    expect(mocks.respondFollowRequest).toHaveBeenCalledWith({}, REQUEST_ID, 'decline');
    expect(getCached(userCacheKey(ACTOR, 'bootstrap'))).toBeNull();
  });

  it('ne vide pas le cache quand la mutation échoue', async () => {
    mocks.respondFollowRequest.mockRejectedValue(new Error('request_not_pending'));
    mocks.readReseauError.mockReturnValue('request_not_pending');

    const response = await POST(request({ requestId: REQUEST_ID, action: 'accept' }));

    expect(response.status).toBe(409);
    expect(getCached(userCacheKey(ACTOR, 'bootstrap'))).not.toBeNull();
  });
});
