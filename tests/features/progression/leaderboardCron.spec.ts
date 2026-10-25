/**
 * P3 — cron `leaderboard-refresh` : consomme la file d'agrégats territoriaux.
 *   (a) secret absent/incorrect → 401 sans client ;
 *   (b) configuration serveur manquante → 503 ;
 *   (c) appel nominal → RPC `refresh_leaderboard_batch` et compteurs ;
 *   (d) erreur RPC → 502.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/cron/leaderboard-refresh/route';

interface MockOptions {
  rpcResult?: { processed: number; failed: number } | null;
  rpcError?: { message: string } | null;
  calls?: Array<[string, ...unknown[]]>;
}

function createSupabaseMock(options: MockOptions) {
  const calls = options.calls ?? [];
  return {
    rpc: (name: string, params: unknown) => {
      calls.push(['rpc', name, params]);
      return Promise.resolve({ data: options.rpcResult ?? null, error: options.rpcError ?? null });
    },
  };
}

function makeRequest(secret?: string) {
  return new NextRequest('http://localhost/api/cron/leaderboard-refresh', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const mockedCreateClient = vi.mocked(createClient);
const ORIGINAL_ENV = { ...process.env };

describe('cron leaderboard-refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('(a) refuse un secret absent ou incorrect sans créer de client', async () => {
    const missing = await POST(makeRequest());
    expect(missing.status).toBe(401);

    const wrong = await POST(makeRequest('mauvais'));
    expect(wrong.status).toBe(401);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('(b) répond 503 si la configuration serveur manque', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await POST(makeRequest('test-secret'));
    expect(response.status).toBe(503);
  });

  it('(c) appelle la RPC et renvoie les compteurs', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({ rpcResult: { processed: 5, failed: 0 }, calls }) as never
    );

    const response = await POST(makeRequest('test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ processed: 5, failed: 0 });
    expect(calls).toContainEqual(['rpc', 'refresh_leaderboard_batch', { p_limit: 100 }]);
  });

  it('(d) erreur RPC → 502', async () => {
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({ rpcError: { message: 'boom' } }) as never
    );

    const response = await POST(makeRequest('test-secret'));
    expect(response.status).toBe(502);
  });
});
