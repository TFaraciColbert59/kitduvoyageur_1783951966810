// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  isPlaceSavedInList,
  loadSavedPlaces,
  toggleSavedPlaceInList,
  writeSavedPlaces,
} from '../savedPlaces';
import { normalizeBikeOverpassElements, GET as getBikePois } from '@/app/api/explorer/v2/bike-pois/route';
import { parseFirmsCsv, GET as getFires } from '@/app/api/explorer/v2/fires/route';
import { GET as getSurfaces } from '@/app/api/explorer/v2/surfaces/route';
import * as overpassAdapter from '@/features/explorer-osm/adapters/overpassAdapter';

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async () => null),
}));

vi.mock('@/features/explorer-osm/services/cacheService', () => ({
  overpassCircuitBreaker: { isOpen: () => false },
}));

describe('C01 savedPlaces (K3.11)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('toggles saved places idempotently and isolates storage by user key', () => {
    const sample = { id: 'poi-1', name: 'Source du Col', kind: 'poi' as const, subtype: 'water', lat: 45.8, lng: 6.8 };
    const added = toggleSavedPlaceInList([], sample);
    expect(added.saved).toBe(true);
    expect(added.places).toHaveLength(1);
    expect(isPlaceSavedInList(added.places, 'poi-1')).toBe(true);

    writeSavedPlaces(added.places, 'user-a');
    expect(loadSavedPlaces('user-a')).toHaveLength(1);
    expect(loadSavedPlaces('user-b')).toHaveLength(0);

    const removed = toggleSavedPlaceInList(added.places, sample);
    expect(removed.saved).toBe(false);
    expect(removed.places).toHaveLength(0);
  });
});

describe('C01 bike-pois API (K3.10)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes real OSM bicycle shops, repair stations and e-bike chargers', () => {
    const items = normalizeBikeOverpassElements({
      elements: [
        { type: 'node', id: 101, lat: 45.92, lon: 6.87, tags: { shop: 'bicycle', name: 'Atelier Mont-Blanc' } },
        { type: 'node', id: 102, lat: 45.93, lon: 6.88, tags: { amenity: 'bicycle_repair_station' } },
        {
          type: 'way',
          id: 203,
          center: { lat: 45.94, lon: 6.89 },
          tags: { amenity: 'charging_station', bicycle: 'yes', operator: 'Vallée' },
        },
      ],
    });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.category)).toEqual(['bike_shop', 'bike_repair', 'ebike_charging']);
    expect(items[2].name).toContain('Vallée');
  });

  it('returns zoom_required without calling Overpass when viewport exceeds 400 km2', async () => {
    const spy = vi.spyOn(overpassAdapter, 'executeOverpassQuery');
    const req = new NextRequest(
      'http://localhost/api/explorer/v2/bike-pois?min_lat=45.4&max_lat=45.9&min_lng=6.0&max_lng=6.8',
    );
    const res = await getBikePois(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.status).toBe('zoom_required');
    expect(json.code).toBe('VIEWPORT_TOO_LARGE');
    expect(json.items).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('C01 fires API (K3.14)', () => {
  const originalKey = process.env.NASA_FIRMS_MAP_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.NASA_FIRMS_MAP_KEY;
    else process.env.NASA_FIRMS_MAP_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('returns explicit unavailable status when NASA_FIRMS_MAP_KEY is unconfigured', async () => {
    delete process.env.NASA_FIRMS_MAP_KEY;
    const req = new NextRequest(
      'http://localhost/api/explorer/v2/fires?min_lat=45.8&max_lat=45.9&min_lng=6.8&max_lng=6.9',
    );
    const res = await getFires(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('unavailable');
    expect(json.incidents).toEqual([]);
  });

  it('parses real VIIRS FIRMS CSV rows and ignores invalid coordinates', () => {
    const csv = [
      'latitude,longitude,acq_date,confidence',
      '45.9123,6.8712,2026-08-01,high',
      '999,6.8,2026-08-01,low',
    ].join('\n');
    const parsed = parseFirmsCsv(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].geometry.coordinates).toEqual([6.8712, 45.9123]);
    expect(parsed[0].source).toBe('NASA FIRMS (VIIRS)');
  });
});

describe('C01 surfaces API (K3.04)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('evaluates OSM highway surface tags via analyzeSurfaces without fabricating missing surfaces', async () => {
    vi.spyOn(overpassAdapter, 'executeOverpassQuery').mockResolvedValue({
      elements: [
        {
          id: 500,
          tags: { highway: 'track', surface: 'gravel', name: 'Piste du Lac' },
          geometry: [
            { lat: 45.9, lon: 6.85 },
            { lat: 45.905, lon: 6.855 },
          ],
        },
      ],
    });
    const req = new NextRequest(
      'http://localhost/api/explorer/v2/surfaces?min_lat=45.89&max_lat=45.91&min_lng=6.84&max_lng=6.86',
    );
    const res = await getSurfaces(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.features).toHaveLength(1);
    expect(json.features[0].category).toBe('unpaved');
    expect(json.analysis.shares[0].category).toBe('unpaved');
  });
});
