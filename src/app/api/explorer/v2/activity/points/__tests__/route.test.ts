import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

import { POST } from '../route';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const LEASE_ID = '22222222-2222-4222-8222-222222222222';

describe('POST /api/explorer/v2/activity/points (Lot 00 P0 float & RPC fix)', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost/api/explorer/v2/activity/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('accepts floating-point GPS/barometer metrics and rounds them to integers for sync_activity_session', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ inserted: 1, received: 1, syncedThroughSeq: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new Request('http://localhost/api/explorer/v2/activity/points', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-jwt',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'activity.points:test:1',
      },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        writerLeaseId: LEASE_ID,
        points: [
          {
            seq: 1,
            t: 1_760_000_000_000,
            lat: 45.8326,
            lng: 6.8652,
            ele: 2480.4,
            acc: 4.5,
            speed: 2.35,
          },
        ],
        metrics: {
          distanceM: 1243.7,
          elevGainM: 84.3,
          movingS: 512.8,
          paused: false,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ inserted: 1, received: 1, syncedThroughSeq: 1 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const rpcPayload = JSON.parse(String(init?.body));
    expect(rpcPayload.p_distance_m).toBe(1244);
    expect(rpcPayload.p_elev_gain_m).toBe(84);
    expect(rpcPayload.p_moving_s).toBe(513);
    expect(Number.isInteger(rpcPayload.p_distance_m)).toBe(true);
    expect(Number.isInteger(rpcPayload.p_elev_gain_m)).toBe(true);
    expect(Number.isInteger(rpcPayload.p_moving_s)).toBe(true);
  });

  it('rejects negative or non-finite metrics with 400', async () => {
    const req = new Request('http://localhost/api/explorer/v2/activity/points', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-jwt',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        points: [],
        metrics: {
          distanceM: -10.5,
          elevGainM: 0,
          movingS: 10,
          paused: false,
        },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
