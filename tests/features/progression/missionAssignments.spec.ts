/**
 * T13 — missions du compte (route + service liés) :
 *   (a) 401 sans session ; (b) GET nominal mappé, filtré par l'identité de
 *   session ; (c) choose/replace/abandon → statuts 200/400/409/404 ;
 *   (d) l'identité vient TOUJOURS de la session (un userId du corps est
 *   ignoré : aucune action inter-comptes possible) ; (e) erreurs → 4xx/5xx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGINAL_ENV = { ...process.env };

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient as createServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { GET, POST } from '@/app/api/progression/missions/route';

const SESSION_USER = '22222222-2222-4222-8222-222222222222';
const OTHER_MODEL_ROW = {
  id: '33333333-3333-4333-8333-333333333333',
  model_id: 'mission_prep_departure_checks',
  state: 'active',
  target_count: 1,
  period: 'ever',
  progress: 2,
  created_at: '2026-10-11T10:00:00.000Z',
};

const mockedServer = vi.mocked(createServerClient);
const mockedRateLimit = vi.mocked(enforceRateLimit);
const mockedService = vi.mocked(createServiceClient);

interface ServiceMock {
  rows?: unknown[];
  rowsError?: { message: string } | null;
  rpcResult?: unknown;
  rpcError?: { message: string } | null;
  rpcCalls?: Array<{ fn: string; args: Record<string, unknown> }>;
  eqFilters?: Array<[string, unknown]>;
  calls?: Array<Record<string, unknown>>;
}

function createServiceMock(options: ServiceMock) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          options.eqFilters?.push([column, value]);
          return builder;
        },
        order: () => builder,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: options.rows ?? [], error: options.rowsError ?? null }).then(resolve),
      };
      options.calls?.push({ table });
      return builder;
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      options.rpcCalls?.push({ fn, args });
      return Promise.resolve({ data: options.rpcResult ?? null, error: options.rpcError ?? null });
    },
  };
}

function request(method: 'GET' | 'POST', body?: unknown) {
  return new NextRequest('http://localhost/api/progression/missions', {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  mockedServer.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: SESSION_USER } } }) },
  } as never);
  mockedRateLimit.mockResolvedValue(null as never);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('T13 — route missions', () => {
  it('(a) 401 sans session, aucun accès service', async () => {
    mockedServer.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as never);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockedService).not.toHaveBeenCalled();
  });

  it('(b) GET nominal : missions mappées et filtre = identité de session', async () => {
    const eqFilters: Array<[string, unknown]> = [];
    mockedService.mockReturnValue(createServiceMock({ rows: [OTHER_MODEL_ROW], eqFilters }) as never);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.missions).toEqual([
      {
        id: '33333333-3333-4333-8333-333333333333',
        modelId: 'mission_prep_departure_checks',
        state: 'active',
        targetCount: 1,
        period: 'ever',
        progress: 2,
        completedAt: null,
        createdAt: '2026-10-11T10:00:00.000Z',
      },
    ]);
    expect(Array.isArray(body.availableModels)).toBe(true);
    expect(eqFilters).toContainEqual(['user_id', SESSION_USER]);
  });

  it('(c1) choose → 200 avec assignmentId', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedService.mockReturnValue(
      createServiceMock({
        rpcResult: { ok: true, assignmentId: '44444444-4444-4444-8444-444444444444' },
        rpcCalls,
      }) as never
    );

    const response = await POST(request('POST', { action: 'choose', modelId: 'mission_prep_departure_checks' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      assignmentId: '44444444-4444-4444-8444-444444444444',
    });
    expect(rpcCalls).toEqual([
      {
        fn: 'choose_progression_mission',
        args: { p_user_id: SESSION_USER, p_model_id: 'mission_prep_departure_checks' },
      },
    ]);
  });

  it('(c2) choose limite atteinte → 409', async () => {
    mockedService.mockReturnValue(
      createServiceMock({ rpcResult: { ok: false, reason: 'limite_atteinte' } }) as never
    );
    const response = await POST(request('POST', { action: 'choose', modelId: 'mission_community_review' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: 'limite_atteinte' });
  });

  it('(c3) modèle hors format → 400 invalid_input, aucun RPC', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedService.mockReturnValue(createServiceMock({ rpcCalls }) as never);
    const response = await POST(request('POST', { action: 'choose', modelId: 'pas-un-modele!!' }));
    expect(response.status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
  });

  it('(c4) abandon d’une assignation inconnue → 404', async () => {
    mockedService.mockReturnValue(
      createServiceMock({ rpcResult: { ok: false, reason: 'assignation_introuvable' } }) as never
    );
    const response = await POST(
      request('POST', { action: 'abandon', assignmentId: '55555555-5555-4555-8555-555555555555' })
    );
    expect(response.status).toBe(404);
  });

  it('(d) identité de session imposée : un userId injecté dans le corps est ignoré', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedService.mockReturnValue(
      createServiceMock({ rpcResult: { ok: true }, rpcCalls }) as never
    );

    await POST(
      request('POST', {
        action: 'abandon',
        assignmentId: '55555555-5555-4555-8555-555555555555',
        userId: '99999999-9999-4999-8999-999999999999',
      })
    );

    expect(rpcCalls[0].args.p_user_id).toBe(SESSION_USER);
    expect(JSON.stringify(rpcCalls[0].args)).not.toContain('99999999');
  });

  it('(e1) corps malformé → 400 sans appel service', async () => {
    const response = await POST(request('POST', { action: 'explode' }));
    expect(response.status).toBe(400);
    expect(mockedService).not.toHaveBeenCalled();
  });

  it('(e2) erreur RPC → 500 générique', async () => {
    mockedService.mockReturnValue(
      createServiceMock({ rpcError: { message: 'boom' } }) as never
    );
    const response = await POST(request('POST', { action: 'choose', modelId: 'mission_community_carnet' }));
    expect(response.status).toBe(500);
  });
});
