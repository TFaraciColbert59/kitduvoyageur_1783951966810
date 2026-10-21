import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// KIT-004 (partie locale) — tests unitaires de la route kit-simulation avec
// frontières mockées (session Supabase, rate-limit). Complète les tests
// d'intégration staging (non exécutés, cf. TASKS.json) sans les remplacer.
// La route reste désactivée par défaut : ici elle est activée explicitement.

const mocks = vi.hoisted(() => ({
  user: { id: 'owner' } as { id: string } | null,
  authError: null as unknown,
  enforceImpl: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
  insertSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user }, error: mocks.authError }),
    },
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: mocks.maybeSingle, single: mocks.single }),
        }),
      }),
      insert: (payload: unknown) => {
        mocks.insert(payload);
        return { select: () => ({ single: mocks.insertSingle }) };
      },
    }),
  }),
}));

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: (...args: unknown[]) => mocks.enforceImpl(...args),
}));

import { POST } from '@/app/api/kit-simulation/route';
import { fingerprint } from '@/features/kit-simulation/idempotency';
import { ENGINE_VERSION } from '@/features/kit-simulation/core';

const ORIGIN = 'https://staging.example.invalid';
const KEY = 'key-0123456789abcdef';

const input = {
  mode: 'balanced',
  accommodation: 'hotel',
  cooking: false,
  naturalWater: false,
  minTempC: null,
  minimumPadR: null,
  coldMarginC: 3,
  budgetCents: 50000,
  maxPackWeightG: 10000,
  packVolumeMl: 50000,
  consumablesG: 1000,
};

const candidateRow = {
  option_id: 'owned:p1',
  product_id: '00000000-0000-4000-8000-000000000001',
  name: 'Fixture de test',
  slot: 'pack',
  weight_g: 1000,
  measured_weight_g: null,
  volume_ml: 1000,
  comfort_c: null,
  r_value: null,
  verified: true,
  source: 'owned',
  price_cents: 0,
  currency: 'EUR',
  available_units: 1,
  valid_until: '2031-01-01T00:00:00Z',
};

function request(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest('https://local.test/api/kit-simulation', {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'Content-Type': 'application/json',
      'Idempotency-Key': KEY,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validHash = fingerprint({ version: ENGINE_VERSION, input });

beforeEach(() => {
  vi.stubEnv('KIT_SIMULATION_ENABLED', 'true');
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  mocks.user = { id: 'owner' };
  mocks.authError = null;
  mocks.enforceImpl.mockReset();
  mocks.enforceImpl.mockResolvedValue(null);
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({ data: [candidateRow], error: null });
  mocks.maybeSingle.mockReset();
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.single.mockReset();
  mocks.insert.mockReset();
  mocks.insertSingle.mockReset();
  mocks.insertSingle.mockResolvedValue({ data: { result: { version: ENGINE_VERSION } }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('kit-simulation route — garde-fous', () => {
  it('404 quand le drapeau est désactivé (défaut de production)', async () => {
    vi.stubEnv('KIT_SIMULATION_ENABLED', 'false');
    const response = await POST(request(input));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'DISABLED' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('403 quand Origin ne correspond pas à APP_ORIGIN', async () => {
    const response = await POST(request(input, { origin: 'https://evil.test' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'ORIGIN_DENIED' });
  });

  it('401 sans session', async () => {
    mocks.user = null;
    const response = await POST(request(input));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'AUTH_REQUIRED' });
    expect(mocks.enforceImpl).not.toHaveBeenCalled();
  });

  it('propage le refus du rate limit', async () => {
    mocks.enforceImpl.mockResolvedValue(
      NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
    );
    const response = await POST(request(input));
    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('400 sans Idempotency-Key valide', async () => {
    const response = await POST(request(input, { 'Idempotency-Key': 'trop-court' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('415 pour un media type non JSON', async () => {
    const response = await POST(
      request(input, { 'Content-Type': 'text/plain' })
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('400 pour un JSON invalide', async () => {
    const response = await POST(request('{pas du json'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_JSON' });
  });

  it('400 pour une entrée hors schéma (commission interdite)', async () => {
    const response = await POST(request({ ...input, commission: 99 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_INPUT' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('400 pour une borne invalide', async () => {
    const response = await POST(request({ ...input, maxPackWeightG: 0 }));
    expect(response.status).toBe(400);
  });

  it('503 quand la lecture préalable échoue', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: 'XX000' } });
    const response = await POST(request(input));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'SIMULATION_UNAVAILABLE' });
  });

  it('503 quand le catalogue est indisponible', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0001' } });
    const response = await POST(request(input));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'SIMULATION_UNAVAILABLE' });
  });
});

describe('kit-simulation route — idempotence et exécution', () => {
  it('rejeu clé identique + entrée identique : résultat figé, aucune réinsertion', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { request_hash: validHash, result: { replayed: true } },
      error: null,
    });
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ replayed: true });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('clé identique + entrée différente : 409 sans écraser le résultat figé', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { request_hash: 'a'.repeat(64), result: { replayed: true } },
      error: null,
    });
    const response = await POST(request(input));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'KEY_CONFLICT' });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('succès : candidats bornés par slot, insertion du snapshot, réponse no-store', async () => {
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: ENGINE_VERSION });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = mocks.rpc.mock.calls[0] as [string, { p_slots: string[]; p_limit: number }];
    expect(fn).toBe('kit_simulation_candidates');
    expect(args.p_limit).toBe(24);
    expect([...args.p_slots].sort()).toEqual(
      ['first_aid', 'light', 'navigation', 'pack', 'rain', 'water_container'].sort()
    );

    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'owner',
        idempotency_key: KEY,
        request_hash: validHash,
        engine_version: ENGINE_VERSION,
      })
    );
  });

  it('course concurrente (23505) : relit le gagnant et le sert', async () => {
    mocks.insertSingle.mockResolvedValue({ data: null, error: { code: '23505' } });
    mocks.single.mockResolvedValue({
      data: { request_hash: validHash, result: { winner: true } },
      error: null,
    });
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ winner: true });
  });

  it('course concurrente (23505) avec entrée divergente : 409', async () => {
    mocks.insertSingle.mockResolvedValue({ data: null, error: { code: '23505' } });
    mocks.single.mockResolvedValue({
      data: { request_hash: 'b'.repeat(64), result: { winner: true } },
      error: null,
    });
    const response = await POST(request(input));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'KEY_CONFLICT' });
  });

  it('503 quand l’insertion échoue hors conflit', async () => {
    mocks.insertSingle.mockResolvedValue({ data: null, error: { code: '57014' } });
    const response = await POST(request(input));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'SIMULATION_UNAVAILABLE' });
  });

  it('quota consommé avant tout calcul (pas de contournement par rejeu)', async () => {
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect(mocks.enforceImpl).toHaveBeenCalledWith(
      'owner',
      expect.objectContaining({ scope: 'kit-simulation', limit: 20, windowMs: 60000, failMode: 'closed' })
    );
  });
});
