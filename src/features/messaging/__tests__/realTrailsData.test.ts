import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

import {
  MESSAGE_TRACE_MAX_POINTS,
  REAL_CATALOG_TRAILS,
  buildTrailMessageMeta,
  catalogLineForId,
  isIndicativeTrailId,
  parseRouteId,
  resolveTrailGeometry,
  savedTrailFromRow,
  toMessageLine,
  trailLineFromData,
} from '../data/realTrailsData';
import { formatTraceStats } from '../lib/traceFormat';

const SENTIER = {
  type: 'MultiLineString',
  coordinates: [
    [[6.897, 45.965], [6.898, 45.966]],
    [[6.898, 45.966], [6.9, 45.97]],
  ],
};

describe('parseRouteId', () => {
  it('accepte un entier positif ou une chaîne de chiffres, jamais le reste', () => {
    expect(parseRouteId(1173)).toBe(1173);
    expect(parseRouteId('1790027540899')).toBe(1790027540899);
    expect(parseRouteId(null, undefined, 'relation/123', '42')).toBe(42);
    expect(parseRouteId('trail-gr20-bavella', '3f2a-uuid', 0, -5, 1.5, '', null)).toBeNull();
    expect(parseRouteId('12345678901234567890')).toBeNull();
  });
});

describe('trailLineFromData / savedTrailFromRow', () => {
  it('lit le tracé porté par trail_data (geojson, coordinates, geometry en chaîne)', () => {
    const line = { type: 'LineString', coordinates: [[6.1, 45.1], [6.2, 45.2]] };
    expect(trailLineFromData({ geojson: line })?.coordinates).toHaveLength(2);
    expect(trailLineFromData({ coordinates: line.coordinates })?.coordinates).toHaveLength(2);
    expect(trailLineFromData({ geometry: JSON.stringify(SENTIER) })?.coordinates).toHaveLength(4);
  });

  it('rend null sans tracé, jamais le tracé d’une autre randonnée', () => {
    expect(trailLineFromData({})).toBeNull();
    expect(trailLineFromData(null)).toBeNull();
    expect(trailLineFromData({ geojson: { type: 'LineString', coordinates: [] } })).toBeNull();
  });

  it('une ligne sans géométrie ne reprend ni Bavella ni valeur par défaut', () => {
    const item = savedTrailFromRow({ id: 'row-1', trail_id: 'osm-relation-9', trail_name: 'Ma sortie', trail_data: {} });
    expect(item.geojson).toBeNull();
    expect(item.distance_km).toBeNull();
    expect(item.elevation_gain_m).toBeNull();
    expect(item.region).toBeNull();
    expect(item.routeId).toBeNull();
    for (const bavella of REAL_CATALOG_TRAILS) expect(item.geojson).not.toEqual(bavella.geojson);
  });

  it('reprend nom, chiffres réels et id de route de la ligne', () => {
    const item = savedTrailFromRow({
      id: 'row-2',
      trail_id: '1790027540899',
      trail_name: 'Sentier des Gardes',
      trail_data: { distance_km: 9.1, elevation_gain_m: '640', region: 'aiguilles rouges' },
    });
    expect(item).toMatchObject({
      name: 'Sentier des Gardes',
      distance_km: 9.1,
      elevation_gain_m: 640,
      region: 'aiguilles rouges',
      routeId: 1790027540899,
      isSaved: true,
      geojson: null,
    });
  });

  it('l’id de route du trail_data prime sur trail_id', () => {
    expect(savedTrailFromRow({ id: 'r', trail_id: '5', trail_data: { route_id: 77 } }).routeId).toBe(77);
  });
});

describe('resolveTrailGeometry : jamais de repli sur une autre randonnée', () => {
  const own = { type: 'LineString' as const, coordinates: [[6.1, 45.1], [6.2, 45.2]] as [number, number][] };

  it('1) la géométrie portée par l’élément, sans requête', async () => {
    const fetchRoute = vi.fn();
    const result = await resolveTrailGeometry({ geojson: own, routeId: 12 }, fetchRoute);
    expect(result).toEqual({ geojson: own, source: 'item' });
    expect(fetchRoute).not.toHaveBeenCalled();
  });

  it('2) sinon la géométrie réelle de hiking_routes, par id de route (MultiLineString)', async () => {
    const fetchRoute = vi.fn().mockResolvedValue(SENTIER);
    const result = await resolveTrailGeometry({ geojson: null, routeId: 1790027540899 }, fetchRoute);
    expect(fetchRoute).toHaveBeenCalledWith(1790027540899);
    expect(result.source).toBe('hiking_routes');
    expect(result.geojson?.coordinates).toHaveLength(4);
  });

  it('2 bis) accepte une géométrie stockée en chaîne JSON', async () => {
    const result = await resolveTrailGeometry({ routeId: 1 }, async () => JSON.stringify(SENTIER));
    expect(result.source).toBe('hiking_routes');
  });

  it('3) sinon aucun tracé : route sans géométrie, lecture en erreur, pas d’id', async () => {
    expect(await resolveTrailGeometry({ routeId: 9900000000001 }, async () => null)).toEqual({ geojson: null, source: null });
    expect(await resolveTrailGeometry({ routeId: 3 }, async () => Promise.reject(new Error('rpc')))).toEqual({
      geojson: null,
      source: null,
    });
    const fetchRoute = vi.fn();
    expect(await resolveTrailGeometry({ geojson: null, routeId: null }, fetchRoute)).toEqual({ geojson: null, source: null });
    expect(fetchRoute).not.toHaveBeenCalled();
  });

  it('une géométrie à un seul point n’est pas un tracé', async () => {
    const result = await resolveTrailGeometry({ geojson: { type: 'LineString', coordinates: [[6.1, 45.1]] } }, async () => null);
    expect(result.geojson).toBeNull();
  });

  it('un nom inconnu ne tombe jamais sur le catalogue', async () => {
    const item = savedTrailFromRow({ id: 'x', trail_name: 'Bavella inconnue', trail_data: {} });
    const result = await resolveTrailGeometry(item, async () => null);
    expect(result.geojson).toBeNull();
  });
});

describe('message randonnée', () => {
  const many = {
    type: 'LineString' as const,
    coordinates: Array.from({ length: 900 }, (_, i) => [6 + i / 1000, 45 + i / 3000] as [number, number]),
  };

  it('joint un tracé simplifié (≤ 200 points) avec départ et arrivée conservés', () => {
    const light = toMessageLine(many)!;
    expect(light.coordinates.length).toBeLessThanOrEqual(MESSAGE_TRACE_MAX_POINTS);
    expect(light.coordinates[0]).toEqual(many.coordinates[0]);
    expect(light.coordinates[light.coordinates.length - 1]).toEqual(many.coordinates[many.coordinates.length - 1]);
    expect(toMessageLine(null)).toBeNull();
  });

  it('n’écrit pas de geojson quand le tracé est inconnu, et ne double pas les coordonnées', () => {
    const item = savedTrailFromRow({ id: 'r1', trail_id: '12', trail_name: 'Sans tracé', trail_data: {} });
    const meta = buildTrailMessageMeta(item, null);
    expect(meta).not.toHaveProperty('geojson');
    expect(meta).not.toHaveProperty('coordinates');
    expect(meta.id).toBe('12');
    const withLine = buildTrailMessageMeta(item, many);
    expect(withLine.geojson?.coordinates.length).toBeLessThanOrEqual(200);
    expect(withLine).not.toHaveProperty('coordinates');
  });

  it('marque le catalogue schématique comme indicatif', () => {
    const catalog = REAL_CATALOG_TRAILS[0];
    expect(buildTrailMessageMeta(catalog, catalog.geojson).indicative).toBe(true);
    expect(isIndicativeTrailId(catalog.id)).toBe(true);
    expect(isIndicativeTrailId('1173')).toBe(false);
    expect(buildTrailMessageMeta(savedTrailFromRow({ id: 'a', trail_data: {} }), null)).not.toHaveProperty('indicative');
  });
});

describe('catalogLineForId : correspondance par identifiant exact seulement', () => {
  it('retrouve le tracé schématique d’un id du catalogue', () => {
    expect(catalogLineForId('trail-aiguilles-chamonix')).toEqual(
      REAL_CATALOG_TRAILS.find((t) => t.id === 'trail-aiguilles-chamonix')!.geojson,
    );
  });

  it('rend null pour un nom, un id inconnu ou un id de route : jamais Bavella', () => {
    expect(catalogLineForId('Traversée des Aiguilles de Chamonix')).toBeNull();
    expect(catalogLineForId('trail-inconnu')).toBeNull();
    expect(catalogLineForId('1790027540899')).toBeNull();
    expect(catalogLineForId(undefined)).toBeNull();
  });
});

describe('formatTraceStats', () => {
  it('omet ce qui est inconnu, n’affiche jamais 0 ni NaN', () => {
    expect(formatTraceStats({ distanceKm: 12.43, elevationGainM: 879.6 })).toBe('12,4 km · +880 m');
    expect(formatTraceStats({ distanceKm: 0.45 })).toBe('450 m');
    expect(formatTraceStats({ distanceKm: null, elevationGainM: 640 })).toBe('+640 m');
    expect(formatTraceStats({ distanceKm: 0, elevationGainM: Number.NaN })).toBeNull();
    expect(formatTraceStats({})).toBeNull();
  });
});
