import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () => ({ rpc: vi.fn(async () => ({ data: null, error: null })) }),
}));

import { signRouteCacheKey, verifyRouteCacheSignature } from '@/lib/routeCacheSignature';
import { POST } from '@/app/api/route/cache/route';

const KEY = 'route:pieton:6.8693,45.9237;6.7983,45.8917';
const LEGS = [
  {
    distanceKm: 2.4,
    durationMin: 34,
    geometry: [
      [6.8693, 45.9237],
      [6.7983, 45.8917],
    ],
  },
];

function post(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/route/cache', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ key: KEY, mode: 'pieton', provider: 'osrm', legs: LEGS }),
  });
}

describe('cache de routage : seul le serveur écrit (audit du 8 octobre)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test';
    delete process.env.ROUTE_CACHE_SECRET;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('signature propre à chaque clé, vérifiée à temps constant', () => {
    const sig = signRouteCacheKey(KEY);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyRouteCacheSignature(KEY, sig)).toBe(true);
    expect(verifyRouteCacheSignature(`${KEY};1,1`, sig)).toBe(false);
    expect(verifyRouteCacheSignature(KEY, null)).toBe(false);
    expect(verifyRouteCacheSignature(KEY, 'faux')).toBe(false);
  });

  it('sans secret côté serveur, rien n’est signé ni accepté', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(signRouteCacheKey(KEY)).toBe('');
    expect(verifyRouteCacheSignature(KEY, '')).toBe(false);
  });

  it('écriture sans signature : 403, rien en base', async () => {
    const res = await POST(post());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ status: 'forbidden' });
  });

  it('écriture signée par le serveur : acceptée', async () => {
    const res = await POST(post({ 'x-route-cache-signature': signRouteCacheKey(KEY) }));
    expect(res.status).toBe(200);
  });

  it('géométrie démesurée refusée même signée (base gratuite de 500 Mo)', async () => {
    const big = Array.from({ length: 6_000 }, (_, i) => [6 + i / 1e5, 45]);
    const req = new NextRequest('http://localhost/api/route/cache', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-route-cache-signature': signRouteCacheKey(KEY) },
      body: JSON.stringify({ key: KEY, mode: 'pieton', provider: 'osrm', legs: [{ ...LEGS[0], geometry: big }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
