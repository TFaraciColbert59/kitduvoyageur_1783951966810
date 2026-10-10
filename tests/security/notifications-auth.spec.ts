import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.limit = async () => ({ data: [], error: null });
  return {
    createClient: vi.fn(() => ({
      from: () => chain,
      rpc: async () => ({ data: 3, error: null }),
    })),
  };
});

import { NextRequest } from 'next/server';
import { POST as processPOST } from '@/app/api/notifications/process/route';
import { GET as digestGET, POST as digestPOST } from '@/app/api/notifications/digest/route';

const SECRET = 'test-cron-secret';

function buildRequest(method: 'GET' | 'POST', path: string, secret?: string) {
  return new NextRequest(`http://localhost:4028${path}`, {
    method,
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe('notifications — accès cron (F-003)', () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.CRON_SECRET = original;
    vi.unstubAllGlobals();
  });

  it('POST /api/notifications/process — 401 sans en-tête', async () => {
    const res = await processPOST(buildRequest('POST', '/api/notifications/process'));
    expect(res.status).toBe(401);
  });

  it('POST /api/notifications/process — 401 avec secret erroné', async () => {
    const res = await processPOST(buildRequest('POST', '/api/notifications/process', 'mauvais-secret'));
    expect(res.status).toBe(401);
  });

  it('POST /api/notifications/process — passe le contrôle avec le bon secret (200, file vide)', async () => {
    const res = await processPOST(buildRequest('POST', '/api/notifications/process', SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
  });

  it('GET /api/notifications/digest — 401 sans en-tête', async () => {
    const res = await digestGET(buildRequest('GET', '/api/notifications/digest'));
    expect(res.status).toBe(401);
  });

  it('POST /api/notifications/digest — 401 sans en-tête', async () => {
    const res = await digestPOST(buildRequest('POST', '/api/notifications/digest'));
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications/digest — 401 avec secret erroné', async () => {
    const res = await digestGET(buildRequest('GET', '/api/notifications/digest', 'mauvais-secret'));
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications/digest — autorisé : déclenche process avec le Bearer CRON_SECRET', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const res = await digestGET(buildRequest('GET', '/api/notifications/digest', SECRET));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/process'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${SECRET}` }),
      })
    );
  });

  it('secret absent de la configuration — 401 même avec un en-tête', async () => {
    process.env.CRON_SECRET = '';
    const res = await digestGET(buildRequest('GET', '/api/notifications/digest', SECRET));
    expect(res.status).toBe(401);
  });
});
