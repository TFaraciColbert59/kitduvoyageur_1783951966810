import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async () => null),
}));

describe('GET /api/outdoor/network', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 on malformed bbox coordinates', async () => {
    const req = new NextRequest(
      'http://localhost/api/outdoor/network?min_lat=not-a-number&max_lat=46&min_lng=6&max_lng=7',
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('aggregates Waymarked Trails routes (including numeric slopes group), IGN Hydro WFS lakes/rivers, and Overpass marinas', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('hiking.waymarkedtrails.org')) {
        return new Response(
          JSON.stringify({
            results: [
              { id: 377905, name: 'GR 55 La Vanoise', ref: 'GR 55', group: 'NAT' },
              { id: 2795160, name: "Tour du Lac d'Annecy", ref: 'GRP TLA', group: 'REG' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('slopes.waymarkedtrails.org')) {
        return new Response(
          JSON.stringify({
            results: [{ id: 14735515, name: 'Boucle de Barmus', group: 5 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('data.geopf.fr/wfs/ows') && url.includes('plan_d_eau')) {
        return new Response(
          JSON.stringify({
            features: [
              {
                id: 'plan_d_eau.1',
                geometry: { type: 'MultiPolygon', coordinates: [[[[6.171, 45.856]]]] },
                properties: { toponyme: "Lac d'Annecy", nature: 'Lac' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('data.geopf.fr/wfs/ows') && url.includes('cours_d_eau')) {
        return new Response(
          JSON.stringify({
            features: [
              {
                id: 'cours_d_eau.1',
                geometry: { type: 'MultiLineString', coordinates: [[[6.125, 45.899]]] },
                properties: { toponyme: 'le Thiou' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('overpass.private.coffee')) {
        return new Response(
          JSON.stringify({
            elements: [
              {
                type: 'node',
                id: 67890,
                lat: 45.899,
                lon: 6.135,
                tags: { leisure: 'marina', name: 'Port des Marquisats' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const req = new NextRequest(
      'http://localhost/api/outdoor/network?min_lat=45.81&max_lat=45.92&min_lng=6.11&max_lng=6.25&types=hiking,slopes,waterways&limit=10',
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.counts.routes).toBe(3);
    expect(json.counts.waterways).toBe(3);
    expect(json.routes[0].ref).toBe('GR 55');
    expect(json.routes[2].group).toBe('5');
    expect(json.waterways.map((w: { kind: string }) => w.kind)).toEqual([
      'navigable_lake',
      'river',
      'marina',
    ]);
    expect(json.providers.waymarked_slopes).toBe('ok');
    expect(json.providers.ign_hydro_wfs).toBe('ok');
    expect(json.tileOverlays.hiking).toContain('tile.waymarkedtrails.org/hiking');
    expect(json.tileOverlays.nauticalSeamarks).toContain('tiles.openseamap.org/seamark');
    expect(json.tileOverlays.hydrographyIgn).toContain('HYDROGRAPHY.HYDROGRAPHY');
  });

  it('degrades gracefully when upstream providers fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network_down'));

    const req = new NextRequest(
      'http://localhost/api/outdoor/network?min_lat=45.10&max_lat=45.20&min_lng=5.80&max_lng=5.95&types=mtb,waterways',
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('empty');
    expect(json.providers.waymarked_mtb).toBe('degraded');
    expect(json.providers.overpass_waterways).toBe('degraded');
    expect(json.routes).toEqual([]);
    expect(json.waterways).toEqual([]);
  });
});
