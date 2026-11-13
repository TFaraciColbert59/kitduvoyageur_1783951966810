import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/explorer/v2/activity/start/route';

const BASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'anon-de-test';
const TOKEN = 'jeton-de-test';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const START_URL = 'http://localhost/api/explorer/v2/activity/start';

const BIG_ROUTE_ID = '1790027540898';
const BODY = {
  clientSessionId: CLIENT_ID,
  sport: 'rando',
  variantId: 'rando-journee',
  routeId: BIG_ROUTE_ID,
};

function rpcBody(created: boolean) {
  return {
    ok: true,
    created,
    sessionId: SESSION_ID,
    clientSessionId: CLIENT_ID,
    sport: 'rando',
    variantId: 'rando-journee',
    routeId: BIG_ROUTE_ID,
    startedAt: '2026-11-11T15:00:00+00:00',
    sessionStatus: 'live',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function request(
  body: unknown,
  options: { authorization?: string | null; rawBody?: string } = {}
): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.authorization === undefined) {
    headers.authorization = `Bearer ${TOKEN}`;
  } else if (options.authorization !== null) {
    headers.authorization = options.authorization;
  }
  return new NextRequest(START_URL, {
    method: 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
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

describe('POST /api/explorer/v2/activity/start', () => {
  it('refuse sans jeton, sans appeler la RPC', async () => {
    for (const authorization of [null, '', 'Basic abc', 'Bearer ', 'Bearer   ']) {
      const res = await POST(request(BODY, { authorization }));
      expect(res.status, String(authorization)).toBe(401);
      expect(await res.json()).toEqual({ error: 'authentification requise' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un corps invalide, un sport inconnu ou une variante incompatible', async () => {
    const cases: Array<[unknown, string]> = [
      [{}, 'invalid_body'],
      [{ ...BODY, clientSessionId: 'pas-un-uuid' }, 'invalid_body'],
      [{ ...BODY, sport: 'golf' }, 'unknown_sport'],
      [{ ...BODY, variantId: 'variante-inexistante' }, 'unknown_variant'],
      [{ ...BODY, sport: 'course' }, 'variant_sport_mismatch'],
      [{ ...BODY, routeId: 0 }, 'invalid_body'],
      [{ ...BODY, userId: SESSION_ID }, 'invalid_body'],
    ];

    for (const [body, code] of cases) {
      const res = await POST(request(body));
      expect(res.status, code).toBe(400);
      expect(await res.json(), code).toMatchObject({ code });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse une variante bloquée (indoor ou métrique non captée)', async () => {
    const res = await POST(request({ ...BODY, sport: 'course', variantId: 'course-tapis' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'variante non démarrable',
      code: 'variant_unavailable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepte le schéma Bearer sans tenir compte de la casse', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(rpcBody(true)));

    const res = await POST(request(BODY, { authorization: 'bearer jeton-de-test' }));

    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it('crée la séance via la RPC, avec le jeton relayé et sans acteur client', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(rpcBody(true)));

    const res = await POST(request(BODY, { authorization: 'Bearer   jeton-de-test  ' }));

    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { ok: _ok, ...createdSession } = rpcBody(true);
    expect(await res.json()).toEqual(createdSession);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/rest/v1/rpc/start_activity_session`);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      apikey: ANON_KEY,
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      p_client_session_id: CLIENT_ID,
      p_sport: 'rando',
      p_variant_id: 'rando-journee',
      p_route_id: BIG_ROUTE_ID,
    });
    expect(JSON.parse(String(init.body))).not.toHaveProperty('user_id');
    expect(JSON.parse(String(init.body))).not.toHaveProperty('p_user_id');
  });

  it('accepte un routeId numérique sûr d’un client historique', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...rpcBody(true), routeId: 42 }));

    const res = await POST(request({ ...BODY, routeId: 42 }));

    expect(res.status).toBe(201);
    expect((await res.json()).routeId).toBe('42');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ p_route_id: '42' });
  });

  it('accepte une réponse numérique de l’ancienne RPC sans perdre le contrat', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...rpcBody(true), routeId: 42 }));

    const res = await POST(request(BODY));

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ routeId: '42', created: true });
  });

  it('rejoue le même identifiant client comme la même séance', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(rpcBody(true)))
      .mockResolvedValueOnce(jsonResponse(rpcBody(false)));

    const first = await POST(request(BODY));
    const replay = await POST(request(BODY));

    expect([first.status, replay.status]).toEqual([201, 200]);
    const firstBody = (await first.json()) as { sessionId: string; created: boolean };
    const replayBody = (await replay.json()) as { sessionId: string; created: boolean };
    expect(firstBody.sessionId).toBe(SESSION_ID);
    expect(replayBody.sessionId).toBe(SESSION_ID);
    expect(firstBody.created).toBe(true);
    expect(replayBody.created).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuse un identifiant client réutilisé avec un contenu différent', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, reason: 'payload_mismatch' }));

    const res = await POST(request({ ...BODY, routeId: '1790027540899' }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'clientSessionId déjà utilisé avec un autre contenu',
      code: 'client_session_conflict',
    });
  });

  it('ne réécrit aucun identifiant et transmet la réponse existante telle quelle', async () => {
    const existingResponse = {
      ...rpcBody(false),
      sessionStatus: 'paused',
    };
    const { ok: _ok, ...existing } = existingResponse;
    fetchMock.mockResolvedValueOnce(jsonResponse(existingResponse));

    const res = await POST(request(BODY));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(existing);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mappe les refus de la RPC sans divulguer son corps', async () => {
    const cases: Array<[number, number, string]> = [
      [400, 400, 'démarrage refusé'],
      [401, 401, 'authentification refusée'],
      [403, 403, 'accès refusé'],
      [404, 503, 'démarrage refusé'],
      [422, 400, 'démarrage refusé'],
      [500, 503, 'démarrage refusé'],
    ];

    for (const [upstream, expected, error] of cases) {
      fetchMock.mockResolvedValueOnce(
        new Response('detail-interne-a-ne-pas-fuir', { status: upstream })
      );
      const res = await POST(request(BODY));
      expect(res.status, String(upstream)).toBe(expected);
      const body = (await res.json()) as { error: string };
      expect(body.error, String(upstream)).toBe(error);
      expect(JSON.stringify(body)).not.toContain('detail-interne');
    }
  });

  it('répond 503 sur réponse illisible, erreur réseau ou configuration absente', async () => {
    fetchMock.mockResolvedValueOnce(new Response('pas-du-json', { status: 200 }));
    expect((await POST(request(BODY))).status).toBe(503);

    fetchMock.mockRejectedValueOnce(new Error('réseau coupé'));
    expect((await POST(request(BODY))).status).toBe(503);

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    fetchMock.mockClear();
    const noConfig = await POST(request(BODY));
    expect(noConfig.status).toBe(503);
    expect(await noConfig.json()).toEqual({ error: 'configuration absente' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un JSON syntaxiquement invalide sans appeler la RPC', async () => {
    const res = await POST(request(null, { rawBody: '{' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'démarrage invalide', code: 'invalid_body' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
