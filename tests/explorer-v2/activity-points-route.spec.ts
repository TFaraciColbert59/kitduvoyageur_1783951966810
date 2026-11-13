import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/explorer/v2/activity/points/route';

const BASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'anon-de-test';
const TOKEN = 'jeton-de-test';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const URL = 'http://localhost/api/explorer/v2/activity/points';

const POINT = {
  seq: 1,
  t: 1_700_000_000_000,
  lat: 45.9237,
  lng: 6.8694,
  ele: 1200.5,
  acc: 8,
  speed: 1.2,
};

const BODY = {
  sessionId: SESSION_ID,
  points: [POINT],
  metrics: { distanceM: 1200, elevGainM: 80, movingS: 600, paused: false },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function request(body: unknown, authorization: string | null = `Bearer ${TOKEN}`): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authorization !== null) headers.authorization = authorization;
  return new NextRequest(URL, { method: 'POST', headers, body: JSON.stringify(body) });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', BASE_URL);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON_KEY);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/explorer/v2/activity/points', () => {
  it('refuse sans jeton sans appeler la RPC', async () => {
    for (const authorization of [null, '', 'Basic abc', 'Bearer ']) {
      const res = await POST(request(BODY, authorization));
      expect(res.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('transmet les points avec leur séquence et l’heure ISO', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ inserted: 1, received: 1, syncedThroughSeq: 1 }));
    const res = await POST(request(BODY));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ inserted: 1, received: 1, syncedThroughSeq: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/rest/v1/rpc/sync_activity_session`);
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_session: SESSION_ID,
      p_points: [
        {
          seq: 1,
          t: new Date(POINT.t).toISOString(),
          lat: POINT.lat,
          lng: POINT.lng,
          ele: POINT.ele,
          acc: POINT.acc,
          speed: POINT.speed,
        },
      ],
      p_distance_m: 1200,
      p_elev_gain_m: 80,
      p_moving_s: 600,
      p_paused: false,
      p_started_at: null,
      p_ended_at: null,
    });
  });

  it('transmet les heures réelles de départ et d’arrêt', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ inserted: 0, received: 0, syncedThroughSeq: 0 }));
    const startedAt = 1_700_000_000_000;
    const endedAt = 1_700_000_600_000;
    const res = await POST(request({ ...BODY, points: [], startedAt, endedAt }));

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_started_at: new Date(startedAt).toISOString(),
      p_ended_at: new Date(endedAt).toISOString(),
    });
  });

  it('refuse les coordonnées hors bornes, les séquences nulles et les lots trop grands', async () => {
    for (const body of [
      { ...BODY, points: [{ ...POINT, lat: 91 }] },
      { ...BODY, points: [{ ...POINT, lng: -181 }] },
      { ...BODY, points: [{ ...POINT, seq: 0 }] },
      { ...BODY, points: [{ ...POINT, t: -1 }] },
      { ...BODY, points: Array.from({ length: 201 }, (_, index) => ({ ...POINT, seq: index + 1 })) },
      { ...BODY, metrics: { ...BODY.metrics, distanceM: -1 } },
    ]) {
      const res = await POST(request(body));
      expect(res.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('conserve un refus de droits en 403 et un conflit de séance close en 409', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"code":"42501"}', { status: 403 }));
    expect((await POST(request(BODY))).status).toBe(403);

    fetchMock.mockResolvedValueOnce(new Response('séance déjà close', { status: 400 }));
    expect((await POST(request(BODY))).status).toBe(409);
  });

  it('rejette une réponse RPC incomplète', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ inserted: 1, received: 1 }));
    expect((await POST(request(BODY))).status).toBe(503);
  });
});
