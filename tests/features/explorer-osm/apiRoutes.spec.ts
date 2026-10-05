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

vi.mock('@/features/explorer-osm/services/canonicalRouteService', () => ({
  getOrCreateCanonicalRoute: vi.fn().mockResolvedValue({
    canonicalId: 'canonical-777',
    isNewlyCreated: true,
    route: { id: 'canonical-777', name: 'Vrai Sentier Officiel OSM' },
  }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({}),
}));
// Personne connectée par défaut ; un test la retire pour vérifier le 401.
const viewer = vi.hoisted(() => ({ id: 'user-1' as string | null }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: viewer.id ? { id: viewer.id } : null } }) },
  })),
}));

import {
  queryRoutesInBbox,
  queryRouteDetail,
  queryPoisInBbox,
} from '@/features/explorer-osm/adapters/overpassAdapter';
import { getOrCreateCanonicalRoute } from '@/features/explorer-osm/services/canonicalRouteService';
import { GET as routesGET } from '@/app/api/explorer/osm/routes/route';
import { GET as detailGET } from '@/app/api/explorer/osm/route/[id]/route';
import { GET as poisGET } from '@/app/api/explorer/osm/pois/route';
import { POST as materializePOST } from '@/app/api/explorer/osm/materialize/route';

import {
  upstreamRateLimiter,
  upstreamSingleFlight,
  osmRouteSummaryCache,
  osmRouteDetailCache,
  osmPoiCache,
} from '@/features/explorer-osm/services/cacheService';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

describe('API Routes — Explorer OSM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upstreamRateLimiter.reset();
    upstreamSingleFlight.clear();
    osmRouteSummaryCache.clear();
    osmRouteDetailCache.clear();
    osmPoiCache.clear();
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

    it('retourne 400 avec message explicite si l’aire géodésique BBOX dépasse 400 km²', async () => {
      // BBOX gigantesque (ex: 2° x 2° à l'équateur)
      const req = new NextRequest(
        'http://localhost:3000/api/explorer/osm/routes?min_lat=0.0&max_lat=2.0&min_lng=0.0&max_lng=2.0'
      );
      const res = await routesGET(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('VIEWPORT_TOO_LARGE');
      expect(json.error).toBe('Zoome pour rechercher des randonnées');
      expect(json.maxAllowedKm2).toBe(400);
      expect(json.areaKm2).toBeGreaterThan(400);
    });

    it('ne consomme pas le rate limit si l’aire géodésique BBOX dépasse 400 km²', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/explorer/osm/routes?min_lat=0.0&max_lat=2.0&min_lng=0.0&max_lng=2.0'
      );
      const res = await routesGET(req);
      expect(res.status).toBe(400);
      expect(enforceRateLimit).not.toHaveBeenCalled();
    });

    it('ne consomme pas le rate limit si la réponse est servie depuis le cache', async () => {
      osmRouteSummaryCache.set('routes:45.400:45.600:6.400:6.600:50', {
        status: 'ok',
        items: [{ id: 'osm:relation:123', name: 'Cached Route' } as any],
        fetchedAt: new Date().toISOString(),
        stale: false,
        limited: false,
        fromCache: true,
        warnings: [],
      });

      const req = new NextRequest(
        'http://localhost:3000/api/explorer/osm/routes?min_lat=45.4&max_lat=45.6&min_lng=6.4&max_lng=6.6'
      );
      const res = await routesGET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-lkdv-cache')).toBe('HIT');
      expect(enforceRateLimit).not.toHaveBeenCalled();
    });

    it('ne déclenche pas le disjoncteur (circuit breaker) en cas d’annulation client', async () => {
      const { overpassCircuitBreaker } = await import('@/features/explorer-osm/services/cacheService');
      const { OverpassError } = await import('@/features/explorer-osm/adapters/overpassAdapter');
      overpassCircuitBreaker.reset();

      vi.mocked(queryRoutesInBbox).mockRejectedValueOnce(
        new (OverpassError as any)('Requête annulée par le client', 'ABORTED')
      );

      const req = new NextRequest(
        'http://localhost:3000/api/explorer/osm/routes?min_lat=45.4&max_lat=45.6&min_lng=6.4&max_lng=6.6'
      );
      const res = await routesGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('empty');
      expect(overpassCircuitBreaker.getState()).toBe('CLOSED');
      expect(overpassCircuitBreaker.isOpen()).toBe(false);
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

    it('ne consomme pas le rate limit si le détail est servi depuis le cache', async () => {
      osmRouteDetailCache.set('route-detail:2222', {
        id: 'osm:relation:2222',
        name: 'Crête Blanche',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/explorer/osm/route/2222');
      const res = await detailGET(req, { params: Promise.resolve({ id: '2222' }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('x-lkdv-cache')).toBe('HIT');
      expect(enforceRateLimit).not.toHaveBeenCalled();
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

    it('retourne 400 avec VIEWPORT_TOO_LARGE et ne consomme pas le rate limit si l’aire BBOX dépasse 400 km²', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/explorer/osm/pois?min_lat=0.0&max_lat=2.0&min_lng=0.0&max_lng=2.0'
      );
      const res = await poisGET(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('VIEWPORT_TOO_LARGE');
      expect(enforceRateLimit).not.toHaveBeenCalled();
    });

    it('ne consomme pas le rate limit si les POIs sont servis depuis le cache', async () => {
      osmPoiCache.set('pois:45.400:45.600:6.400:6.600:water:60', {
        status: 'ok',
        items: [{ id: 'osm:node:888', name: 'Source Fraîche', category: 'water' } as any],
        fetchedAt: new Date().toISOString(),
        stale: false,
        limited: false,
        fromCache: true,
        warnings: [],
      });

      const req = new NextRequest(
        'http://localhost:3000/api/explorer/osm/pois?min_lat=45.4&max_lat=45.6&min_lng=6.4&max_lng=6.6&categories=water'
      );
      const res = await poisGET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-lkdv-cache')).toBe('HIT');
      expect(enforceRateLimit).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/explorer/osm/materialize', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
    });

    it('refuse une personne non connectée (401), sans toucher au catalogue', async () => {
      viewer.id = null;
      const req = new NextRequest('http://localhost:3000/api/explorer/osm/materialize', {
        method: 'POST',
        body: JSON.stringify({ osmRelationId: 777 }),
      });
      const res = await materializePOST(req);
      viewer.id = 'user-1';
      expect(res.status).toBe(401);
      expect(queryRouteDetail).not.toHaveBeenCalled();
    });

    it('retourne 400 sans osmRelationId', async () => {
      const req = new NextRequest('http://localhost:3000/api/explorer/osm/materialize', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await materializePOST(req);
      expect(res.status).toBe(400);
    });

    it('ignore tout objet detail fourni par le client et interroge le serveur OSM pour la géométrie', async () => {
      vi.mocked(queryRouteDetail).mockResolvedValueOnce({
        elements: [
          {
            type: 'relation',
            id: 777,
            tags: { name: 'Vrai Sentier Officiel OSM' },
            members: [
              {
                type: 'way',
                ref: 1,
                role: 'main',
                geometry: [{ lat: 45.0, lon: 6.0 }, { lat: 45.1, lon: 6.1 }],
              },
            ],
          },
        ],
      });

      const fakeClientDetail = {
        name: 'HACKED ROUTE NAME FROM CLIENT',
        geojson: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      };

      const req = new NextRequest('http://localhost:3000/api/explorer/osm/materialize', {
        method: 'POST',
        body: JSON.stringify({
          osmRelationId: 777,
          detail: fakeClientDetail, // NE DOIT PAS ÊTRE UTILISÉ
        }),
      });

      const res = await materializePOST(req);
      expect(res.status).toBe(200);
      expect(queryRouteDetail).toHaveBeenCalledWith(777);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(getOrCreateCanonicalRoute).toHaveBeenCalled();
      const passedDetail = vi.mocked(getOrCreateCanonicalRoute).mock.calls[0][1];
      expect(passedDetail.name).toBe('Vrai Sentier Officiel OSM');
      expect(passedDetail.name).not.toBe('HACKED ROUTE NAME FROM CLIENT');
    });
  });
});
