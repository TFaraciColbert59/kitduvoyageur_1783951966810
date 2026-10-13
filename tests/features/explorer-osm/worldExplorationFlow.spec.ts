import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  mergeAndDeduplicateTrails,
  filterTrailsByViewport,
  type ViewportBbox,
} from '@/features/explorer-osm/services/trailMergeService';
import type { MapTrail } from '@/components/explorer/types';
import type { SearchEnvelope, ExternalRouteSummary } from '@/features/explorer-osm/domain/types';

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

// Plan 100, 2.12 : le relief (Terrain Tiles sur s3.amazonaws.com) n'est jamais
// demandé par un test ; sans altitude lue, le détail reste sans profil, comme
// quand la source ne répond pas.
vi.mock('@/lib/geo/terrainElevation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geo/terrainElevation')>()),
  terrainElevations: vi.fn(async () => null),
}));
vi.mock('@/features/explorer-osm/adapters/overpassAdapter', () => ({
  queryRoutesInBbox: vi.fn(),
  queryRouteDetail: vi.fn(),
  OverpassError: class extends Error {
    constructor(msg: string, public code: string) {
      super(msg);
    }
  },
}));

import { queryRoutesInBbox, queryRouteDetail } from '@/features/explorer-osm/adapters/overpassAdapter';
import { GET as routesGET } from '@/app/api/explorer/osm/routes/route';
import { GET as detailGET } from '@/app/api/explorer/osm/route/[id]/route';
import {
  upstreamRateLimiter,
  upstreamSingleFlight,
  osmRouteSummaryCache,
  osmRouteDetailCache,
} from '@/features/explorer-osm/services/cacheService';

describe('World Exploration Flow — Chamonix, Dolomites, Kumano (Japon), USA, Nouvelle-Zélande', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upstreamRateLimiter.reset();
    upstreamSingleFlight.clear();
    osmRouteSummaryCache.clear();
    osmRouteDetailCache.clear();
  });
  // Définition des 5 zones mondiales canoniques
  const CHAMONIX_BBOX: ViewportBbox = {
    minLat: 45.89,
    maxLat: 45.96,
    minLng: 6.82,
    maxLng: 6.94,
    zoom: 13,
  };

  const DOLOMITES_BBOX: ViewportBbox = {
    minLat: 46.50,
    maxLat: 46.58,
    minLng: 12.08,
    maxLng: 12.22,
    zoom: 13,
  };

  const KUMANO_BBOX: ViewportBbox = {
    minLat: 33.78,
    maxLat: 33.88,
    minLng: 135.65,
    maxLng: 135.82,
    zoom: 13,
  };

  const USA_APPALACHIAN_BBOX: ViewportBbox = {
    minLat: 38.45,
    maxLat: 38.58,
    minLng: -78.50,
    maxLng: -78.35,
    zoom: 13,
  };

  const NZ_ROUTEBURN_BBOX: ViewportBbox = {
    minLat: -44.82,
    maxLat: -44.70,
    minLng: 168.10,
    maxLng: 168.25,
    zoom: 13,
  };

  // Relations OSM authentiques représentatives
  const RAW_OSM_CHAMONIX = {
    type: 'relation',
    id: 111001,
    tags: {
      route: 'hiking',
      name: 'Tour du Mont Blanc (Secteur Chamonix - Brévent)',
      ref: 'TMB',
      network: 'rwn',
      sac_scale: 'mountain_hiking',
      distance: '16.5 km',
    },
    center: { lat: 45.93, lon: 6.86 },
    members: [
      {
        type: 'way',
        ref: 101,
        role: 'main',
        geometry: [
          { lat: 45.925, lon: 6.855 },
          { lat: 45.935, lon: 6.865 },
        ],
      },
    ],
  };

  const RAW_OSM_DOLOMITES = {
    type: 'relation',
    id: 222002,
    tags: {
      route: 'hiking',
      name: 'Alta Via delle Dolomiti n. 1 (Cortina)',
      ref: 'AV1',
      network: 'nwn',
      sac_scale: 'demanding_mountain_hiking',
      distance: '24 km',
    },
    center: { lat: 46.54, lon: 12.14 },
    members: [
      {
        type: 'way',
        ref: 201,
        role: 'main',
        geometry: [
          { lat: 46.535, lon: 12.135 },
          { lat: 46.545, lon: 12.145 },
        ],
      },
    ],
  };

  const RAW_OSM_KUMANO = {
    type: 'relation',
    id: 333003,
    tags: {
      route: 'hiking',
      name: 'Kumano Kodo - Nakahechi Route (熊野古道 中辺路)',
      ref: 'KK-N',
      network: 'nwn',
      sac_scale: 'hiking',
      distance: '38 km',
    },
    center: { lat: 33.83, lon: 135.74 },
    members: [
      {
        type: 'way',
        ref: 301,
        role: 'main',
        geometry: [
          { lat: 33.825, lon: 135.735 },
          { lat: 33.835, lon: 135.745 },
        ],
      },
    ],
  };

  const RAW_OSM_USA = {
    type: 'relation',
    id: 444004,
    tags: {
      route: 'hiking',
      name: 'Appalachian National Scenic Trail (Shenandoah Section)',
      ref: 'AT',
      network: 'nwn',
      sac_scale: 'hiking',
      distance: '42 km',
    },
    center: { lat: 38.51, lon: -78.43 },
    members: [
      {
        type: 'way',
        ref: 401,
        role: 'main',
        geometry: [
          { lat: 38.505, lon: -78.435 },
          { lat: 38.515, lon: -78.425 },
        ],
      },
    ],
  };

  const RAW_OSM_NZ = {
    type: 'relation',
    id: 555005,
    tags: {
      route: 'hiking',
      name: 'Routeburn Track (Great Walk)',
      ref: 'RBT',
      network: 'nwn',
      sac_scale: 'hiking',
      distance: '32 km',
    },
    center: { lat: -44.76, lon: 168.16 },
    members: [
      {
        type: 'way',
        ref: 501,
        role: 'main',
        geometry: [
          { lat: -44.765, lon: 168.155 },
          { lat: -44.755, lon: 168.165 },
        ],
      },
    ],
  };

  async function searchZone(bbox: ViewportBbox, rawRelation: any): Promise<MapTrail[]> {
    vi.mocked(queryRoutesInBbox).mockResolvedValueOnce({
      elements: [rawRelation],
    });
    const url = `http://localhost:3000/api/explorer/osm/routes?min_lat=${bbox.minLat}&max_lat=${bbox.maxLat}&min_lng=${bbox.minLng}&max_lng=${bbox.maxLng}`;
    const req = new NextRequest(url);
    const res = await routesGET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as SearchEnvelope<ExternalRouteSummary>;
    expect(json.status).toBe('ok');
    expect(json.items.length).toBeGreaterThan(0);

    return json.items.map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.representativePoint ? r.representativePoint[1] : null,
      lng: r.representativePoint ? r.representativePoint[0] : null,
      distance_km: r.calculatedDistanceKm || r.declaredDistanceKm || null,
      ref: r.ref,
      network: r.network,
      difficulty: r.tags.sac_scale || null,
      source: 'openstreetmap',
      geometryStatus: r.geometryStatus,
    } as any as MapTrail));
  }

  async function fetchRouteDetail(relationId: number, rawRelation: any) {
    vi.mocked(queryRouteDetail).mockResolvedValueOnce({
      elements: [rawRelation],
    });
    const req = new NextRequest(`http://localhost:3000/api/explorer/osm/route/${relationId}`);
    const res = await detailGET(req, { params: Promise.resolve({ id: String(relationId) }) });
    expect(res.status).toBe(200);
    const detail = await res.json();
    return detail;
  }

  it('1. FRANCE (Chamonix) : découverte /api/explorer/osm/routes, affichage et chargement tracé réel', async () => {
    const trails = await searchZone(CHAMONIX_BBOX, RAW_OSM_CHAMONIX);
    const inViewport = filterTrailsByViewport(trails, CHAMONIX_BBOX);
    expect(inViewport).toHaveLength(1);
    expect(inViewport[0].name).toContain('Tour du Mont Blanc');
    expect(inViewport[0].ref).toBe('TMB');

    // Vérification de la route détail /api/explorer/osm/route/:id
    const detail = await fetchRouteDetail(111001, RAW_OSM_CHAMONIX);
    expect(detail.geometryStatus).toBe('complete');
    expect(detail.geojson).not.toBeNull();
    expect(detail.geojson.type).toBe('LineString');
    expect(detail.geojson.coordinates.length).toBeGreaterThan(1);
  });

  it('2. ITALIE (Dolomites) : découverte et exclusion stricte des sentiers français', async () => {
    const chamonixTrails = await searchZone(CHAMONIX_BBOX, RAW_OSM_CHAMONIX);
    const dolomitesTrails = await searchZone(DOLOMITES_BBOX, RAW_OSM_DOLOMITES);

    // L'utilisateur déplace la carte vers les Dolomites et clique « Explorer cette zone »
    const merged = mergeAndDeduplicateTrails(chamonixTrails, dolomitesTrails);
    const inViewport = filterTrailsByViewport(merged, DOLOMITES_BBOX);

    // Chamonix DOIT avoir disparu, seules les Dolomites sont affichées
    expect(inViewport).toHaveLength(1);
    expect(inViewport[0].name).toContain('Alta Via delle Dolomiti');
    expect(inViewport.some((t) => t.name.includes('Mont Blanc'))).toBe(false);

    // Vérification du tracé réel
    const detail = await fetchRouteDetail(222002, RAW_OSM_DOLOMITES);
    expect(detail.geojson.coordinates.length).toBeGreaterThan(1);
  });

  it('3. JAPON (Kumano Kodo) : découverte et exclusion des sentiers italiens', async () => {
    const dolomitesTrails = await searchZone(DOLOMITES_BBOX, RAW_OSM_DOLOMITES);
    const kumanoTrails = await searchZone(KUMANO_BBOX, RAW_OSM_KUMANO);

    const merged = mergeAndDeduplicateTrails(dolomitesTrails, kumanoTrails);
    const inViewport = filterTrailsByViewport(merged, KUMANO_BBOX);

    expect(inViewport).toHaveLength(1);
    expect(inViewport[0].name).toContain('Kumano Kodo');
    expect(inViewport[0].lat).toBeCloseTo(33.83, 1);
    expect(inViewport.some((t) => t.name.includes('Dolomiti'))).toBe(false);

    const detail = await fetchRouteDetail(333003, RAW_OSM_KUMANO);
    expect(detail.geojson.coordinates.length).toBeGreaterThan(1);
  });

  it('4. USA (Appalachian Trail) : découverte et exclusion des sentiers japonais', async () => {
    const kumanoTrails = await searchZone(KUMANO_BBOX, RAW_OSM_KUMANO);
    const usaTrails = await searchZone(USA_APPALACHIAN_BBOX, RAW_OSM_USA);

    const merged = mergeAndDeduplicateTrails(kumanoTrails, usaTrails);
    const inViewport = filterTrailsByViewport(merged, USA_APPALACHIAN_BBOX);

    expect(inViewport).toHaveLength(1);
    expect(inViewport[0].name).toContain('Appalachian National Scenic Trail');
    expect(inViewport[0].ref).toBe('AT');
    expect(inViewport.some((t) => t.name.includes('Kumano'))).toBe(false);

    const detail = await fetchRouteDetail(444004, RAW_OSM_USA);
    expect(detail.geojson.coordinates.length).toBeGreaterThan(1);
  });

  it('5. NOUVELLE-ZÉLANDE (Routeburn Track) : découverte et exclusion des sentiers américains', async () => {
    const usaTrails = await searchZone(USA_APPALACHIAN_BBOX, RAW_OSM_USA);
    const nzTrails = await searchZone(NZ_ROUTEBURN_BBOX, RAW_OSM_NZ);

    const merged = mergeAndDeduplicateTrails(usaTrails, nzTrails);
    const inViewport = filterTrailsByViewport(merged, NZ_ROUTEBURN_BBOX);

    expect(inViewport).toHaveLength(1);
    expect(inViewport[0].name).toContain('Routeburn Track');
    expect(inViewport[0].ref).toBe('RBT');
    expect(inViewport.some((t) => t.name.includes('Appalachian'))).toBe(false);

    const detail = await fetchRouteDetail(555005, RAW_OSM_NZ);
    expect(detail.geojson.coordinates.length).toBeGreaterThan(1);
  });

  it('6. Chaîne complète continue : France → Italie → Japon → USA → NZ sans aucune persistance indésirable', async () => {
    const chamonix = await searchZone(CHAMONIX_BBOX, RAW_OSM_CHAMONIX);
    const dolomites = await searchZone(DOLOMITES_BBOX, RAW_OSM_DOLOMITES);
    const kumano = await searchZone(KUMANO_BBOX, RAW_OSM_KUMANO);
    const usa = await searchZone(USA_APPALACHIAN_BBOX, RAW_OSM_USA);
    const nz = await searchZone(NZ_ROUTEBURN_BBOX, RAW_OSM_NZ);

    const allTrails = [
      ...chamonix,
      ...dolomites,
      ...kumano,
      ...usa,
      ...nz,
    ];

    // Vérification que chaque viewport isole uniquement son propre sentier
    const chamonixOnly = filterTrailsByViewport(allTrails, CHAMONIX_BBOX);
    expect(chamonixOnly.map((t) => t.name)).toEqual(['Tour du Mont Blanc (Secteur Chamonix - Brévent)']);

    const dolomitesOnly = filterTrailsByViewport(allTrails, DOLOMITES_BBOX);
    expect(dolomitesOnly.map((t) => t.name)).toEqual(['Alta Via delle Dolomiti n. 1 (Cortina)']);

    const kumanoOnly = filterTrailsByViewport(allTrails, KUMANO_BBOX);
    expect(kumanoOnly.map((t) => t.name)).toEqual(['Kumano Kodo - Nakahechi Route (熊野古道 中辺路)']);

    const usaOnly = filterTrailsByViewport(allTrails, USA_APPALACHIAN_BBOX);
    expect(usaOnly.map((t) => t.name)).toEqual(['Appalachian National Scenic Trail (Shenandoah Section)']);

    const nzOnly = filterTrailsByViewport(allTrails, NZ_ROUTEBURN_BBOX);
    expect(nzOnly.map((t) => t.name)).toEqual(['Routeburn Track (Great Walk)']);
  });
});
