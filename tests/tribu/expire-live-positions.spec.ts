/**
 * Phase 7 TRIBU — cron `expire-live-positions` (TRIBU-R6).
 *
 *   (a) secret requis ; (b) config requise ; (c) purge positions expirées ;
 *   (d) fermeture des sessions expirées ; (e) erreur → 500.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/expire-live-positions/route';

interface MockOptions {
  deletedPositions?: Array<{ session_id: string }>;
  closedSessions?: Array<{ id: string }>;
  positionsError?: { message: string } | null;
  sessionsError?: { message: string } | null;
  calls?: Array<[string, ...unknown[]]>;
}

function createSupabaseMock(options: MockOptions) {
  const calls = options.calls ?? [];
  const builder: Record<string, unknown> = {};
  let mode: 'select' | 'delete' | 'update' = 'select';
  builder.select = () => builder;
  builder.delete = () => {
    mode = 'delete';
    calls.push(['delete']);
    return builder;
  };
  builder.update = (payload: unknown) => {
    mode = 'update';
    calls.push(['update', payload]);
    return builder;
  };
  builder.lt = (col: string, val: unknown) => {
    calls.push(['lt', col, val]);
    return builder;
  };
  builder.is = (col: string, val: unknown) => {
    calls.push(['is', col, val]);
    return builder;
  };
  builder.then = (resolve: (value: unknown) => unknown) => {
    if (mode === 'delete') {
      return resolve({ data: options.deletedPositions ?? [], error: options.positionsError ?? null });
    }
    if (mode === 'update') {
      return resolve({ data: options.closedSessions ?? [], error: options.sessionsError ?? null });
    }
    return resolve({ data: [], error: null });
  };
  return { from: () => builder };
}

function makeRequest(secret?: string) {
  return new NextRequest('http://localhost/api/cron/expire-live-positions', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const mockedCreateClient = vi.mocked(createClient);
const ORIGINAL_ENV = { ...process.env };

describe('cron expire-live-positions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('(a) refuse un secret absent ou incorrect', async () => {
    expect((await GET(makeRequest())).status).toBe(401);
    expect((await GET(makeRequest('mauvais'))).status).toBe(401);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('(b) répond 503 sans configuration', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await GET(makeRequest('test-secret'))).status).toBe(503);
  });

  it('(c) purge les positions expirées et ferme les sessions expirées', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({
        deletedPositions: [{ session_id: 's1' }, { session_id: 's1' }],
        closedSessions: [{ id: 's1' }],
        calls,
      }) as never
    );

    const response = await GET(makeRequest('test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ positions: 2, sessions: 1 });
    expect(calls).toContainEqual(
      expect.arrayContaining(['lt', 'expires_at', expect.any(String)])
    );
    expect(calls).toContainEqual(['is', 'stopped_at', null]);
  });

  it('(d) aucune expiration : compteurs à zéro', async () => {
    mockedCreateClient.mockReturnValue(createSupabaseMock({}) as never);
    const response = await GET(makeRequest('test-secret'));
    expect(await response.json()).toEqual({ positions: 0, sessions: 0 });
  });

  it('(e) erreur de purge → 500', async () => {
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({ positionsError: { message: 'boom' } }) as never
    );
    expect((await GET(makeRequest('test-secret'))).status).toBe(500);
  });
});
