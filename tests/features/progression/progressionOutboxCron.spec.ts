/**
 * P1 — cron `progression-outbox` : consomme l'outbox canonique.
 *   (a) secret absent/incorrect → 401 sans client ;
 *   (b) configuration serveur manquante → 503 ;
 *   (c) appel nominal → RPC `process_progression_outbox` et compteurs ;
 *   (d) erreur RPC → 502.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/cron/progression-outbox/route';

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
  return new NextRequest('http://localhost/api/cron/progression-outbox', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const mockedCreateClient = vi.mocked(createClient);
const ORIGINAL_ENV = { ...process.env };

describe('cron progression-outbox', () => {
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
      createSupabaseMock({ rpcResult: { processed: 3, failed: 1 }, calls }) as never
    );

    const response = await POST(makeRequest('test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ processed: 3, failed: 1 });
    expect(calls).toContainEqual(['rpc', 'process_progression_outbox', { p_limit: 50 }]);
  });

  it('(d) erreur RPC → 502', async () => {
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({ rpcError: { message: 'boom' } }) as never
    );

    const response = await POST(makeRequest('test-secret'));
    expect(response.status).toBe(502);
  });
});
