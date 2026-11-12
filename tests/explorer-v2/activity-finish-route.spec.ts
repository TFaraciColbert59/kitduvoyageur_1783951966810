import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/explorer/v2/activity/finish/route';

const BASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'anon-de-test';
const TOKEN = 'jeton-de-test';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const SUMMARY_ID = '33333333-3333-4333-8333-333333333333';
const KEY = `activity.finish:${SESSION_ID}`;
const FINISH_URL = 'http://localhost/api/explorer/v2/activity/finish';

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
  return new NextRequest(FINISH_URL, {
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

describe('POST /api/explorer/v2/activity/finish', () => {
  it('refuse sans jeton, sans appeler la RPC', async () => {
    for (const authorization of [null, '', 'Basic abc', 'Bearer ', 'Bearer   ']) {
      const res = await POST(request({ sessionId: SESSION_ID, idempotencyKey: KEY }, { authorization }));
      expect(res.status, String(authorization)).toBe(401);
      expect(await res.json()).toEqual({ error: 'authentification requise' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un corps invalide sans appeler la RPC', async () => {
    const cases: unknown[] = [
      {},
      { sessionId: 'pas-un-uuid' },
      { sessionId: SESSION_ID, idempotencyKey: 'court' },
      { sessionId: SESSION_ID, idempotencyKey: 'x'.repeat(401) },
    ];

    for (const body of cases) {
      const res = await POST(request(body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'sessionId invalide' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('appelle la RPC idempotente avec la séance, la clé et le jeton relayé', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'applied', summaryId: SUMMARY_ID })
    );

    const res = await POST(request({ sessionId: SESSION_ID, idempotencyKey: KEY }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'saved', summaryId: SUMMARY_ID });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/rest/v1/rpc/finish_activity_session_idempotent`);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      apikey: ANON_KEY,
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      p_session: SESSION_ID,
      p_idempotency_key: KEY,
    });
  });

  it('mappe duplicate et already_finished sans inventer de résumé', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'duplicate', summaryId: SUMMARY_ID }))
      .mockResolvedValueOnce(jsonResponse({ status: 'already_finished', summaryId: null }));

    const duplicate = await POST(request({ sessionId: SESSION_ID, idempotencyKey: KEY }));
    const already = await POST(request({ sessionId: SESSION_ID, idempotencyKey: `${KEY}:2` }));

    expect(await duplicate.json()).toEqual({ status: 'duplicate', summaryId: SUMMARY_ID });
    expect(await already.json()).toEqual({ status: 'already_finished', summaryId: null });
    expect(already.status).toBe(200);
  });

  it('répond 409 quand la clé est déjà liée à une autre séance', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'conflict', reason: 'idempotency_key_reused' }));

    const res = await POST(request({ sessionId: SESSION_ID, idempotencyKey: KEY }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'clé d’idempotence déjà liée à une autre séance',
      code: 'idempotency_conflict',
    });
  });

  it('conserve la RPC historique quand aucune clé n’est fournie', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUMMARY_ID));

    const res = await POST(request({ sessionId: SESSION_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'saved', summaryId: SUMMARY_ID });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/rest/v1/rpc/finish_activity_session`);
    expect(JSON.parse(String(init.body))).toEqual({ p_session: SESSION_ID });
  });

  it('ne prétend pas avoir sauvegardé quand la RPC historique renvoie null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null));

    const res = await POST(request({ sessionId: SESSION_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'already_finished', summaryId: null });
  });

  it('répond 503 sur réponse idempotente malformée, sans prétendre avoir sauvegardé', async () => {
    for (const payload of [
      null,
      'applied',
      [],
      42,
      {},
      { status: 'inconnu' },
      { status: 'applied' },
      { status: 'applied', summaryId: null },
      { status: 'applied', summaryId: 'pas-un-uuid' },
      { status: 'duplicate', summaryId: null },
      { status: 'already_finished', summaryId: 'pas-un-uuid' },
    ]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(payload));
      const res = await POST(request({ sessionId: SESSION_ID, idempotencyKey: KEY }));
      expect(res.status, JSON.stringify(payload)).toBe(503);
      expect(await res.json()).toEqual({ error: 'réponse indisponible' });
    }
  });

  it('conserve le résumé retrouvé avec already_finished', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'already_finished', summaryId: SUMMARY_ID })
    );

    const res = await POST(request({ sessionId: SESSION_ID, idempotencyKey: KEY }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'already_finished', summaryId: SUMMARY_ID });
  });

  it('mappe un conflit de résumé sur un code distinct', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'conflict', reason: 'summary_not_owned' })
    );

    const res = await POST(request({ sessionId: SESSION_ID, idempotencyKey: KEY }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'le résumé lié à cette clé n’appartient pas à cette séance',
      code: 'summary_conflict',
    });
  });

  it('répond 503 sur réponse illisible, erreur réseau ou configuration absente', async () => {
    fetchMock.mockResolvedValueOnce(new Response('pas-du-json', { status: 200 }));
    expect((await POST(request({ sessionId: SESSION_ID }))).status).toBe(503);

    fetchMock.mockRejectedValueOnce(new Error('réseau coupé'));
    expect((await POST(request({ sessionId: SESSION_ID }))).status).toBe(503);

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    fetchMock.mockClear();
    const noConfig = await POST(request({ sessionId: SESSION_ID }));
    expect(noConfig.status).toBe(503);
    expect(await noConfig.json()).toEqual({ error: 'configuration absente' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un JSON syntaxiquement invalide sans appeler la RPC', async () => {
    const res = await POST(request(null, { rawBody: '{' }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
