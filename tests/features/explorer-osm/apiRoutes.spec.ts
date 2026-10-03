import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/features/explorer-osm/adapters/overpassAdapter', () => ({
  queryRoutesInBbox: vi.fn(),
  queryRouteDetail: vi.fn(),
  queryPoisInBbox: vi.fn(),
  OverpassError: class extends Error {
    constructor(msg: string, public code: string) {
      super(msg);
    }
  },
}));

import {
  queryRoutesInBbox,
  queryRouteDetail,
  queryPoisInBbox,
} from '@/features/explorer-osm/adapters/overpassAdapter';
import { GET as routesGET } from '@/app/api/explorer/osm/routes/route';
import { GET as detailGET } from '@/app/api/explorer/osm/route/[id]/route';
import { GET as poisGET } from '@/app/api/explorer/osm/pois/route';
import { POST as materializePOST } from '@/app/api/explorer/osm/materialize/route';

import {
  upstreamRateLimiter,
  upstreamSingleFlight,
} from '@/features/explorer-osm/services/cacheService';

describe('API Routes — Explorer OSM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upstreamRateLimiter.reset();
    upstreamSingleFlight.clear();
  });

  describe('GET /api/explorer/osm/routes', () => {
    it('retourne 400 si aucun paramètre BBOX n’est fourni', async () => {
      const req = new NextRequest('http://localhost:3000/api/explorer/osm/routes');
      const res = await routesGET(req);
      expect(res.status).toBe(400);
    });

    it('retourne SearchEnvelope avec routes normalisées pour BBOX valide', async () => {
      vi.mocked(queryRoutesInBbox).mockResolvedValueOnce({
        elements: [
          {
            type: 'relation',
            id: 1234,
            tags: { name: 'Sentier du Lac', ref: 'SL1', distance: '12 km' },
            center: { lat: 45.5, lon: 6.5 },
          },
        ],
      });

      const req = new NextRequest(
        'http://localhost:3000/api/explorer/osm/routes?min_lat=45.4&max_lat=45.6&min_lng=6.4&max_lng=6.6'
      );
      const res = await routesGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.items).toHaveLength(1);
      expect(json.items[0].name).toBe('Sentier du Lac');
      expect(json.items[0].declaredDistanceKm).toBe(12);
    });
  });

  describe('GET /api/explorer/osm/route/[id]', () => {
    it('retourne 400 si l’ID est invalide', async () => {
      const req = new NextRequest('http://localhost:3000/api/explorer/osm/route/invalid');
      const res = await detailGET(req, { params: Promise.resolve({ id: 'abc' }) });
      expect(res.status).toBe(400);
    });

    it('retourne les détails complets du tracé', async () => {
      vi.mocked(queryRouteDetail).mockResolvedValueOnce({
        elements: [
          {
            type: 'relation',
            id: 2222,
            tags: { name: 'Crête Blanche', sac_scale: 'hiking' },
            members: [
              {
                type: 'way',
                ref: 10,
                role: 'main',
                geometry: [
                  { lat: 45.1, lon: 6.1 },
                  { lat: 45.11, lon: 6.11 },
                ],
              },
            ],
          },
        ],
      });

      const req = new NextRequest('http://localhost:3000/api/explorer/osm/route/2222');
      const res = await detailGET(req, { params: Promise.resolve({ id: '2222' }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.name).toBe('Crête Blanche');
      expect(json.geometryStatus).toBe('complete');
      expect(json.geojson).not.toBeNull();
    });
  });

  describe('GET /api/explorer/osm/pois', () => {
    it('retourne les POIs normalisés pour les catégories demandées', async () => {
      vi.mocked(queryPoisInBbox).mockResolvedValueOnce({
        elements: [
          {
            type: 'node',
            id: 888,
            lat: 45.5,
            lon: 6.5,
            tags: { amenity: 'drinking_water', name: 'Source Fraîche' },
          },
        ],
      });

      const req = new NextRequest(
        'http://localhost:3000/api/explorer/osm/pois?min_lat=45.4&max_lat=45.6&min_lng=6.4&max_lng=6.6&categories=water'
      );
      const res = await poisGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.items).toHaveLength(1);
      expect(json.items[0].category).toBe('water');
      expect(json.items[0].name).toBe('Source Fraîche');
    });
  });

  describe('POST /api/explorer/osm/materialize', () => {
    it('retourne 400 sans osmRelationId', async () => {
      const req = new NextRequest('http://localhost:3000/api/explorer/osm/materialize', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await materializePOST(req);
      expect(res.status).toBe(400);
    });
  });
});
