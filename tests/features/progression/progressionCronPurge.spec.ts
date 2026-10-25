/**
 * P4 — cron `progression-outbox` : consommation du lot + purge de rétention.
 *   (a) nominal      → process_progression_outbox(p_limit=50) puis
 *                      purge_progression_outbox(p_keep_days=90), réponse
 *                      { processed, failed, purged } ;
 *   (b) purge en échec → non bloquant, purged=0, compteurs de lot intacts ;
 *   (c) purge sans données → purged=0 et jamais NaN.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/cron/progression-outbox/route';

type RpcResponse = { data: unknown; error: { message: string } | null };
type RpcHandler = (params: unknown) => RpcResponse;

function createSupabaseMock(
  handlers: Record<string, RpcHandler>,
  calls: Array<[string, unknown]>
) {
  return {
    rpc: (name: string, params: unknown) => {
      calls.push([name, params]);
      const handler = handlers[name];
      if (!handler) {
        return Promise.resolve({ data: null, error: { message: `RPC inconnue: ${name}` } });
      }
      return Promise.resolve(handler(params));
    },
  };
}

function makeRequest(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/progression-outbox', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

const mockedCreateClient = vi.mocked(createClient);
const ORIGINAL_ENV = { ...process.env };

describe('cron progression-outbox — purge de rétention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('(a) appelle les deux RPC et renvoie purged', async () => {
    const calls: Array<[string, unknown]> = [];
    mockedCreateClient.mockReturnValue(
      createSupabaseMock(
        {
          process_progression_outbox: () => ({
            data: { processed: 7, failed: 1 },
            error: null,
          }),
          purge_progression_outbox: () => ({ data: 12, error: null }),
        },
        calls
      ) as never
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ processed: 7, failed: 1, purged: 12 });
    expect(calls).toEqual([
      ['process_progression_outbox', { p_limit: 50 }],
      ['purge_progression_outbox', { p_keep_days: 90 }],
    ]);
  });

  it('(b) purge en échec → non bloquant, purged=0', async () => {
    const calls: Array<[string, unknown]> = [];
    mockedCreateClient.mockReturnValue(
      createSupabaseMock(
        {
          process_progression_outbox: () => ({
            data: { processed: 4, failed: 0 },
            error: null,
          }),
          purge_progression_outbox: () => ({ data: null, error: { message: 'timeout' } }),
        },
        calls
      ) as never
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ processed: 4, failed: 0, purged: 0 });
    expect(calls.map(([name]) => name)).toEqual([
      'process_progression_outbox',
      'purge_progression_outbox',
    ]);
  });

  it('(c) purge sans données → purged=0, jamais NaN', async () => {
    mockedCreateClient.mockReturnValue(
      createSupabaseMock(
        {
          process_progression_outbox: () => ({
            data: { processed: 0, failed: 0 },
            error: null,
          }),
          purge_progression_outbox: () => ({ data: null, error: null }),
        },
        []
      ) as never
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.purged).toBe(0);
    expect(Number.isNaN(body.purged)).toBe(false);
  });
});
