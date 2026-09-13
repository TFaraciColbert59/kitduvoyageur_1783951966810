/**
 * Phase 2 TRIBU — cron `cleanup-ephemeral-groups` (TRIBU-R6).
 *
 *   (a) secret absent/incorrect → 401 sans client ;
 *   (b) configuration serveur manquante → 503 ;
 *   (c) aucun groupe expiré → `{ deleted: 0 }` sans suppression ;
 *   (d) groupes expirés → suppression ciblée des seuls éphémères dépassés ;
 *   (e) erreur de lecture → 500.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/cleanup-ephemeral-groups/route';

interface MockOptions {
  expired?: Array<{ id: string }>;
  selectError?: { message: string } | null;
  deleteError?: { message: string } | null;
  calls?: Array<[string, ...unknown[]]>;
}

function createSupabaseMock(options: MockOptions) {
  const calls = options.calls ?? [];
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: unknown) => {
    calls.push(['eq', col, val]);
    return builder;
  };
  builder.lt = (col: string, val: unknown) => {
    calls.push(['lt', col, val]);
    return builder;
  };
  builder.delete = () => {
    calls.push(['delete']);
    return builder;
  };
  builder.in = (col: string, val: unknown) => {
    calls.push(['in', col, val]);
    return Promise.resolve({ error: options.deleteError ?? null });
  };
  builder.then = (resolve: (value: unknown) => unknown) =>
    resolve({
      data: options.expired ?? [],
      error: options.selectError ?? null,
    });
  return { from: () => builder };
}

function makeRequest(secret?: string) {
  return new NextRequest('http://localhost/api/cron/cleanup-ephemeral-groups', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const mockedCreateClient = vi.mocked(createClient);
const ORIGINAL_ENV = { ...process.env };

describe('cron cleanup-ephemeral-groups', () => {
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
    const missing = await GET(makeRequest());
    expect(missing.status).toBe(401);

    const wrong = await GET(makeRequest('mauvais'));
    expect(wrong.status).toBe(401);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('(b) répond 503 si la configuration serveur manque', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await GET(makeRequest('test-secret'));
    expect(response.status).toBe(503);
  });

  it('(c) aucun groupe expiré : aucun DELETE', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedCreateClient.mockReturnValue(createSupabaseMock({ expired: [], calls }) as never);

    const response = await GET(makeRequest('test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: 0 });
    expect(calls.some(([op]) => op === 'delete')).toBe(false);
    expect(calls).toContainEqual(['eq', 'is_ephemeral', true]);
    expect(calls.some(([op, col]) => op === 'lt' && col === 'auto_dissolve_at')).toBe(true);
  });

  it('(d) supprime uniquement les éphémères dépassés', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({
        expired: [{ id: 'g1' }, { id: 'g2' }],
        calls,
      }) as never
    );

    const response = await GET(makeRequest('test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: 2 });
    expect(calls).toContainEqual(['in', 'id', ['g1', 'g2']]);
  });

  it('(e) erreur de lecture → 500', async () => {
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({ selectError: { message: 'boom' } }) as never
    );

    const response = await GET(makeRequest('test-secret'));
    expect(response.status).toBe(500);
  });
});
