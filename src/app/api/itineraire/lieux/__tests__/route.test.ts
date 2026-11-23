import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/rate-limit', () => ({ clientIpFromHeaders: vi.fn(() => '203.0.113.9') }));
vi.mock('@/features/compas/server/stagePoiLookup', () => ({ lookupStagePois: vi.fn() }));

import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { lookupStagePois } from '@/features/compas/server/stagePoiLookup';
import { POST } from '../route';

const call = (body: unknown, raw?: string) =>
  POST(
    new NextRequest('http://localhost/api/itineraire/lieux', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw ?? JSON.stringify(body),
    }),
  );

describe('POST /api/itineraire/lieux', () => {
  beforeEach(() => {
    vi.mocked(lookupStagePois).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
  });

  it('rend les lieux relevés et leur source, sans cache', async () => {
    vi.mocked(lookupStagePois).mockResolvedValue({
      pois: [{ id: 1, name: 'Refuge du Col', category: 'refuge', lat: 45.9, lon: 6.2, distanceM: 120, elevationM: null }],
      partial: false,
    });
    const res = await call({ points: [{ lat: 45.9, lon: 6.2 }] });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.pois).toHaveLength(1);
    expect(json.partial).toBe(false);
    expect(json.source).toMatch(/OpenStreetMap/);
    expect(vi.mocked(lookupStagePois)).toHaveBeenCalledWith([{ lat: 45.9, lon: 6.2 }]);
  });

  it('refuse un JSON illisible, des coordonnées hors bornes, trop de points, une clé inconnue', async () => {
    expect((await call(null, '{oups')).status).toBe(400);
    expect((await call({ points: [{ lat: 95, lon: 6 }] })).status).toBe(400);
    expect((await call({ points: [] })).status).toBe(400);
    expect((await call({ points: Array.from({ length: 9 }, () => ({ lat: 45, lon: 6 })) })).status).toBe(400);
    expect((await call({ points: [{ lat: 45, lon: 6 }], url: 'http://x' })).status).toBe(400);
    expect((await call({ points: [{ lat: 'a', lon: 6 }] })).status).toBe(400);
    expect(vi.mocked(lookupStagePois)).not.toHaveBeenCalled();
  });

  it('respecte la limite de débit', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 }));
    expect((await call({ points: [{ lat: 45, lon: 6 }] })).status).toBe(429);
    expect(vi.mocked(lookupStagePois)).not.toHaveBeenCalled();
  });

  it('panne du service : 503, liste vide et partiel, jamais un lieu inventé', async () => {
    vi.mocked(lookupStagePois).mockRejectedValue(new Error('overpass'));
    const res = await call({ points: [{ lat: 45, lon: 6 }] });
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.pois).toEqual([]);
    expect(json.partial).toBe(true);
  });
});
