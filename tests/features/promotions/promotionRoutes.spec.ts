import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { POST as evaluatePost } from '@/app/api/promotions/evaluate/route';
import { POST as promotePost } from '@/app/api/promotions/promote/route';
import { PROMOTION_ERROR_CODES, PromotionError } from '@/features/promotions/server/promotionService';

const SECRET = 'sb_rst_super_secret_value';
const USER_ID = 'user-1';

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(url, { method: 'POST', body: JSON.stringify(body), headers }));
}

const rawRequest = (url: string, raw: string, headers: Record<string, string> = {}) =>
  new NextRequest(new Request(url, { method: 'POST', body: raw, headers }));

const promotedRow = {
  status: 'promoted',
  model_version: 'v2.0.0',
  score: '0.981200',
  promoted: true,
};

/** Client dont `rpc` rejoue la reponse configuree pour la route. */
function supabaseWith(rpcImpl: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown }) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: USER_ID } } })) },
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => rpcImpl(name, args)),
  };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.createClient.mockReset();
  mocks.enforceRateLimit.mockReset();
  mocks.enforceRateLimit.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/promotions/evaluate', () => {
  const url = 'http://localhost/api/promotions/evaluate';
  const validBody = { modelVersion: 'v2.0.0', score: 0.98, evidence: { n: 10 }, promote: true };

  it('401 sans session, sans toucher la base ni le quota', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      rpc: vi.fn(),
    });
    const res = await evaluatePost(jsonRequest(url, validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it('applique le quota et renvoie le statut du limiteur', async () => {
    mocks.createClient.mockResolvedValue(supabaseWith(() => ({ data: null, error: null })));
    mocks.enforceRateLimit.mockResolvedValue({
      status: 429,
      headers: new Headers({ 'Retry-After': '60' }),
    });
    const res = await evaluatePost(jsonRequest(url, validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });

  it('rejette un corps JSON invalide (400)', async () => {
    mocks.createClient.mockResolvedValue(supabaseWith(() => ({ data: null, error: null })));
    const res = await evaluatePost(rawRequest(url, '{ not json'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('rejette un corps trop volumineux (413)', async () => {
    mocks.createClient.mockResolvedValue(supabaseWith(() => ({ data: null, error: null })));
    const res = await evaluatePost(
      jsonRequest(url, validBody, { 'content-length': String(64 * 1024) })
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
  });

  it('400 avec la liste des champs fautifs', async () => {
    mocks.createClient.mockResolvedValue(supabaseWith(() => ({ data: null, error: null })));
    const res = await evaluatePost(jsonRequest(url, { modelVersion: 'v 1', score: 5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_request');
    expect(body.fields).toContain('modelVersion');
    expect(body.fields).toContain('score');
  });

  it('200 et payload canonique sur succes', async () => {
    const client = supabaseWith((name) => {
      expect(name).toBe('evaluate_model_promotion');
      return { data: [promotedRow], error: null };
    });
    mocks.createClient.mockResolvedValue(client);

    const res = await evaluatePost(jsonRequest(url, validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      success: true,
      data: { status: 'promoted', modelVersion: 'v2.0.0', score: 0.9812, promoted: true },
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(USER_ID, {
      scope: 'promotion-evaluate',
      limit: 20,
      windowMs: 600000,
      failMode: 'closed',
    });
  });

  it('403 si la RPC refuse (non-admin)', async () => {
    mocks.createClient.mockResolvedValue(
      supabaseWith(() => ({
        data: null,
        error: { code: '42501', message: `denied key=${SECRET}` },
      }))
    );
    const res = await evaluatePost(jsonRequest(url, validBody));
    expect(res.status).toBe(403);
    const raw = JSON.stringify(await res.json());
    expect(raw).toContain(PROMOTION_ERROR_CODES.forbidden);
    expect(raw).not.toContain(SECRET);
  });

  it('409 si la promotion est dans un etat incompatible', async () => {
    mocks.createClient.mockResolvedValue(
      supabaseWith(() => ({ data: null, error: { code: '55000', message: 'not_pending' } }))
    );
    const res = await evaluatePost(jsonRequest(url, validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe(PROMOTION_ERROR_CODES.conflict);
  });

  it('503 quand le contrat base est absent', async () => {
    mocks.createClient.mockResolvedValue(
      supabaseWith(() => ({ data: null, error: { code: '42883', message: SECRET } }))
    );
    const res = await evaluatePost(jsonRequest(url, validBody));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe(PROMOTION_ERROR_CODES.unavailable);
    expect(body.retryable).toBe(true);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('n expose jamais de secret ni de stack dans la reponse', async () => {
    mocks.createClient.mockResolvedValue(
      supabaseWith(() => ({ data: null, error: { code: 'XX000', message: `fatal ${SECRET}` } }))
    );
    const res = await evaluatePost(jsonRequest(url, validBody));
    expect(res.status).toBe(500);
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain('at Object');
  });
});

describe('POST /api/promotions/promote', () => {
  const url = 'http://localhost/api/promotions/promote';
  const validBody = { modelVersion: 'v2.0.0' };

  it('401 sans session', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    });
    const res = await promotePost(jsonRequest(url, validBody));
    expect(res.status).toBe(401);
  });

  it('rejette une cle inconnue (400) au lieu de la stripper', async () => {
    mocks.createClient.mockResolvedValue(supabaseWith(() => ({ data: null, error: null })));
    const res = await promotePost(jsonRequest(url, { ...validBody, score: 1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('200 et payload canonique sur succes', async () => {
    const client = supabaseWith((name, args) => {
      expect(name).toBe('promote_model_version');
      expect(args).toEqual({ p_model_version: 'v2.0.0' });
      return { data: [promotedRow], error: null };
    });
    mocks.createClient.mockResolvedValue(client);

    const res = await promotePost(jsonRequest(url, validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { status: 'promoted', modelVersion: 'v2.0.0', score: 0.9812, promoted: true },
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(USER_ID, {
      scope: 'promotion-promote',
      limit: 10,
      windowMs: 600000,
      failMode: 'closed',
    });
  });

  it('409 quand la promotion n est pas pending', async () => {
    mocks.createClient.mockResolvedValue(
      supabaseWith(() => ({ data: null, error: { code: '55000', message: 'not_pending' } }))
    );
    const res = await promotePost(jsonRequest(url, validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe(PROMOTION_ERROR_CODES.conflict);
  });

  it('503 si la migration n est pas deployee', async () => {
    mocks.createClient.mockResolvedValue(
      supabaseWith(() => ({ data: null, error: { code: '42P01', message: SECRET } }))
    );
    const res = await promotePost(jsonRequest(url, validBody));
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain(SECRET);
  });

  it('rejette un corps trop volumineux avant le parsing (413)', async () => {
    mocks.createClient.mockResolvedValue(supabaseWith(() => ({ data: null, error: null })));
    const res = await promotePost(
      rawRequest(url, 'x'.repeat(9 * 1024), { 'content-type': 'application/json' })
    );
    expect(res.status).toBe(413);
  });
});

describe('PromotionError', () => {
  it('expose un code stable et un retryable explicite', () => {
    const error = new PromotionError(PROMOTION_ERROR_CODES.unknown, 'boom', true);
    expect(error.name).toBe('PromotionError');
    expect(error.code).toBe(PROMOTION_ERROR_CODES.unknown);
    expect(error.retryable).toBe(true);
  });
});
