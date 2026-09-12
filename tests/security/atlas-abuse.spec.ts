/**
 * CHANTIER ATLAS — Phase 5
 * Tests d'abus des endpoints viewport : plafond de bbox serveur (span ≤ 20°)
 * et rate limiting glissant par IP (429 explicite).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/queries/trails', () => ({ getTrails: vi.fn(async () => []) }));
vi.mock('@/lib/queries/pois', () => ({ getPois: vi.fn(async () => []) }));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async () => null),
}));

import { getTrails } from '@/lib/queries/trails';
import { getPois } from '@/lib/queries/pois';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { GET as hikesGET } from '@/app/api/hikes/route';
import { GET as poisGET } from '@/app/api/pois/route';
import { MAX_BBOX_SPAN_DEG } from '@/lib/geo/bbox';

const mockedGetTrails = vi.mocked(getTrails);
const mockedGetPois = vi.mocked(getPois);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);

function request(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: 'GET' });
}

function bboxArgs(fn: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  return fn.mock.calls[0][0] as Record<string, unknown>;
}

describe('ATLAS Phase 5 — /api/hikes borné et limité', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans bbox : appelle getTrails sans viewport (comportement historique)', async () => {
    const response = await hikesGET(request('/api/hikes?limit=50'));
    expect(response.status).toBe(200);
    const args = bboxArgs(mockedGetTrails);
    expect(args.minLat).toBeNull();
    expect(args.maxLng).toBeNull();
    expect(response.headers.get('x-lkdv-bbox-clamped')).toBeNull();
  });

  it('bbox surdimensionnée (span 40°) : recentrée à 20° et signalée', async () => {
    const response = await hikesGET(
      request('/api/hikes?min_lng=-20&max_lng=20&min_lat=30&max_lat=70')
    );
    expect(response.status).toBe(200);
    const args = bboxArgs(mockedGetTrails);
    expect((args.maxLng as number) - (args.minLng as number)).toBeCloseTo(MAX_BBOX_SPAN_DEG, 5);
    expect((args.maxLat as number) - (args.minLat as number)).toBeCloseTo(MAX_BBOX_SPAN_DEG, 5);
    expect(response.headers.get('x-lkdv-bbox-clamped')).toBe('1');
  });

  it('bbox partielle : 400 explicite sans appel données', async () => {
    const response = await hikesGET(request('/api/hikes?min_lng=2&max_lng=3'));
    expect(response.status).toBe(400);
    expect(mockedGetTrails).not.toHaveBeenCalled();
  });

  it('bbox non finie : 400 explicite', async () => {
    const response = await hikesGET(
      request('/api/hikes?min_lng=abc&max_lng=3&min_lat=44&max_lat=46')
    );
    expect(response.status).toBe(400);
  });

  it('paramètre numérique non fini (limit=abc) : 400 sans appel données', async () => {
    const response = await hikesGET(request('/api/hikes?limit=abc'));
    expect(response.status).toBe(400);
    expect(mockedGetTrails).not.toHaveBeenCalled();
  });

  it('rate limit dépassé : 429 sans appel données', async () => {
    mockedEnforceRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
    );
    const response = await hikesGET(request('/api/hikes?limit=10'));
    expect(response.status).toBe(429);
    expect(mockedGetTrails).not.toHaveBeenCalled();
  });
});

describe('ATLAS Phase 5 — /api/pois borné et limité', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bbox surdimensionnée : recentrée à 20° et signalée', async () => {
    const response = await poisGET(
      request('/api/pois?min_lng=-30&max_lng=30&min_lat=10&max_lat=60&zoom=5')
    );
    expect(response.status).toBe(200);
    const args = bboxArgs(mockedGetPois);
    expect((args.maxLng as number) - (args.minLng as number)).toBeCloseTo(MAX_BBOX_SPAN_DEG, 5);
    expect(response.headers.get('x-lkdv-bbox-clamped')).toBe('1');
  });

  it('rate limit dépassé : 429 sans appel données', async () => {
    mockedEnforceRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
    );
    const response = await poisGET(request('/api/pois?limit=10'));
    expect(response.status).toBe(429);
    expect(mockedGetPois).not.toHaveBeenCalled();
  });

  it('les deux routes partagent la garde de rate limiting (au moins 2 appels)', async () => {
    await hikesGET(request('/api/hikes'));
    await poisGET(request('/api/pois'));
    expect(mockedEnforceRateLimit).toHaveBeenCalledTimes(2);
  });
});
