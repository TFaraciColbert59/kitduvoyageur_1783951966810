/**
 * Corridor OSM Graph Extractor, AWS Terrarium DEM Bilinear Enricher & Live Environment Snapshotter.
 *
 * Zero-cost open-data pipeline:
 * - Overpass API (2 public mirrors, 4.5s timeout, 15 min LRU cache)
 * - AWS Terrain Tiles (`terrarium`, z12, decoded with `sharp` + bilinear/Horn 3x3 slope)
 * - Open-Meteo Forecast API (start + destination weather, wind, precip, snow, freezing level)
 * - NOAA Offline Daylight (`computeOfflineDaylight`) & Ridge Wind (`computeEffectiveRidgeWind`)
 */

import { decodePngRgba } from '@/lib/geo/decodePng';
import { computeEffectiveRidgeWind, computeOfflineDaylight } from '../adaptive/environment';
import {
  decodeTerrariumTile,
  latToTileY,
  lonToTileX,
  sampleTileElevationBilinear,
  sampleTileSlopeDeg,
  TERRARIUM_BASE_URL,
  TILE_SIZE,
} from '../geo/dem';
import { POI_FLAG_SHELTER, POI_FLAG_WATER } from './tsFallbackEngine';
import {
  EDGE_FLAG_CYCLEWAY,
  EDGE_FLAG_EXPOSED_RIDGE,
  EDGE_FLAG_FERRY,
  EDGE_FLAG_FORD,
  EDGE_FLAG_FOREST_COVER,
  EDGE_FLAG_GLACIER_SNOW,
  EDGE_FLAG_LIT,
  EDGE_FLAG_ROAD_TRAFFIC,
  EDGE_FLAG_STEPS,
  EDGE_FLAG_VIA_FERRATA,
  EDGE_FLAG_WATERWAY,
  HAZARD_FLAG_AVALANCHE_SLOPE,
  HAZARD_FLAG_FIRE,
  HAZARD_FLAG_FLOOD,
  SURFACE_DIRT_TRAIL,
  SURFACE_GRASS_FOREST,
  SURFACE_GRAVEL,
  SURFACE_PAVED,
  SURFACE_ROCK_SCREE,
  SURFACE_SNOW_ICE,
  SURFACE_WATER,
  type CompactCorridorGraph,
  type CompactGraphEdge,
  type CompactGraphNode,
  type RouteEnvironmentSnapshot,
  type RoutePlanEndpoint,
  type UserCapabilityManifest,
} from './types';

export interface MultimodalHubCandidate {
  kind: 'parking' | 'transit';
  name: string;
  lat: number;
  lon: number;
  nodeIndex?: number;
}

export interface BuiltCorridorResult {
  graph: CompactCorridorGraph;
  startNode: number;
  goalNode: number;
  hubs: MultimodalHubCandidate[];
  cacheHit: boolean;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// ── Simple Bounded LRU Caches ────────────────────────────────────────────────

const CORRIDOR_TTL_MS = 15 * 60 * 1000;
const corridorCache = new Map<
  string,
  { at: number; graph: CompactCorridorGraph; hubs: MultimodalHubCandidate[] }
>();

const demTileCache = new Map<string, { at: number; tile: Float32Array }>();
const DEM_TILE_TTL_MS = 60 * 60 * 1000;
const DEM_ZOOM = 12;

export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat * 0.5) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon * 0.5) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function fetchDemTile(zoom: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${zoom}/${x}/${y}`;
  const hit = demTileCache.get(key);
  if (hit && Date.now() - hit.at < DEM_TILE_TTL_MS) {
    return hit.tile;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${TERRARIUM_BASE_URL}/${zoom}/${x}/${y}.png`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const decoded = decodePngRgba(await res.arrayBuffer());
    const tile = decodeTerrariumTile(
      decoded.data,
      decoded.width || TILE_SIZE,
      decoded.channels || 4,
    );
    if (demTileCache.size > 60) {
      const oldestKey = demTileCache.keys().next().value;
      if (oldestKey) demTileCache.delete(oldestKey);
    }
    demTileCache.set(key, { at: Date.now(), tile });
    return tile;
  } catch {
    return null;
  }
}

export async function sampleElevationAndSlopeBatch(
  coords: ReadonlyArray<{ lat: number; lon: number }>,
): Promise<Array<{ eleM: number; slopeDeg: number }>> {
  if (coords.length === 0) return [];

  // Choose adaptive Terrarium zoom so long routes (100..1200 km) stay within <= 16 tiles
  // and NEVER drop off to 0 m mid-route!
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lon < minLon) minLon = c.lon;
    if (c.lon > maxLon) maxLon = c.lon;
  }
  const spanDeg = Math.max(maxLat - minLat, maxLon - minLon);
  const zoom =
    spanDeg > 3.0 ? 8 : spanDeg > 1.2 ? 9 : spanDeg > 0.45 ? 10 : spanDeg > 0.16 ? 11 : DEM_ZOOM;

  const tileCoords = new Map<string, { x: number; y: number }>();
  for (const c of coords) {
    const x = Math.floor(lonToTileX(c.lon, zoom));
    const y = Math.floor(latToTileY(c.lat, zoom));
    tileCoords.set(`${x}/${y}`, { x, y });
  }

  const tileEntries = Array.from(tileCoords.entries()).slice(0, 24);
  const tiles = new Map<string, Float32Array>();
  await Promise.all(
    tileEntries.map(async ([k, { x, y }]) => {
      const t = await fetchDemTile(zoom, x, y);
      if (t) tiles.set(k, t);
    }),
  );

  const raw: Array<{ eleM: number | null; slopeDeg: number }> = coords.map((c) => {
    const x = Math.floor(lonToTileX(c.lon, zoom));
    const y = Math.floor(latToTileY(c.lat, zoom));
    const tile = tiles.get(`${x}/${y}`);
    if (!tile) return { eleM: null, slopeDeg: 0 };
    return {
      eleM: Math.round(sampleTileElevationBilinear(tile, TILE_SIZE, c.lon, c.lat, zoom) * 10) / 10,
      slopeDeg: Math.round(sampleTileSlopeDeg(tile, TILE_SIZE, c.lon, c.lat, zoom) * 10) / 10,
    };
  });

  // Linearly interpolate any rare missing tile sample so elevation never cliff-drops to 0 m
  let lastValid = raw.find((r) => r.eleM !== null)?.eleM ?? 0;
  return raw.map((r, idx) => {
    if (r.eleM !== null) {
      lastValid = r.eleM;
      return { eleM: r.eleM, slopeDeg: r.slopeDeg };
    }
    let nextValid = lastValid;
    for (let j = idx + 1; j < raw.length; j++) {
      if (raw[j]!.eleM !== null) {
        nextValid = raw[j]!.eleM!;
        break;
      }
    }
    return { eleM: Math.round(((lastValid + nextValid) * 0.5) * 10) / 10, slopeDeg: 0 };
  });
}

// ── OSM Tag Mapping ──────────────────────────────────────────────────────────

function parseSacGrade(tags: Record<string, string>): number {
  const sac = (tags.sac_scale ?? '').toLowerCase();
  if (sac === 'hiking') return 1;
  if (sac === 'mountain_hiking') return 2;
  if (sac === 'demanding_mountain_hiking') return 3;
  if (sac === 'alpine_hiking') return 4;
  if (sac === 'demanding_alpine_hiking') return 5;
  if (sac === 'difficult_alpine_hiking') return 6;
  const hw = (tags.highway ?? '').toLowerCase();
  if (hw === 'via_ferrata') return 5;
  if (hw === 'path') return 2;
  if (hw === 'track' || hw === 'footway' || hw === 'bridleway' || hw === 'cycleway') return 1;
  return 1;
}

function parseMtbGrade(tags: Record<string, string>): number {
  const bicycle = (tags.bicycle ?? '').toLowerCase();
  if (bicycle === 'no' || bicycle === 'private' || bicycle === 'dismount') return 255;
  const hw = (tags.highway ?? '').toLowerCase();
  if (hw === 'steps' || hw === 'via_ferrata' || hw === 'motorway' || hw === 'trunk') return 255;
  const raw = tags['mtb:scale'];
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 6) return Math.min(5, n);
  }
  const sac = parseSacGrade(tags);
  if (sac >= 4) return 255;
  if (sac === 3) return 3;
  if (hw === 'path') return 2;
  if (hw === 'track') return 1;
  return 0;
}

function parseSurface(tags: Record<string, string>): number {
  if (tags.waterway) return SURFACE_WATER;
  const s = (tags.surface ?? '').toLowerCase();
  if (['asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'cobblestone'].includes(s)) {
    return SURFACE_PAVED;
  }
  if (['gravel', 'fine_gravel', 'compacted', 'pebblestone'].includes(s)) {
    return SURFACE_GRAVEL;
  }
  if (['rock', 'scree', 'shingle', 'stone', 'boulders'].includes(s)) {
    return SURFACE_ROCK_SCREE;
  }
  if (['snow', 'ice', 'glacier'].includes(s)) {
    return SURFACE_SNOW_ICE;
  }
  if (['grass', 'woodchips', 'ground', 'earth', 'mud'].includes(s)) {
    return SURFACE_GRASS_FOREST;
  }
  if (['dirt', 'unpaved', 'sand'].includes(s)) {
    return SURFACE_DIRT_TRAIL;
  }
  const hw = (tags.highway ?? '').toLowerCase();
  if (['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'cycleway', 'living_street', 'pedestrian'].includes(hw)) {
    return SURFACE_PAVED;
  }
  if (hw === 'track') {
    const tt = (tags.tracktype ?? '').toLowerCase();
    if (tt === 'grade1') return SURFACE_PAVED;
    if (tt === 'grade2') return SURFACE_GRAVEL;
    return SURFACE_DIRT_TRAIL;
  }
  return SURFACE_DIRT_TRAIL;
}

function parseEdgeFlags(tags: Record<string, string>, eleM: number): number {
  let flags = 0;
  const hw = (tags.highway ?? '').toLowerCase();
  if (tags.waterway) flags |= EDGE_FLAG_WATERWAY;
  if (tags.route === 'ferry') flags |= EDGE_FLAG_FERRY;
  if (tags.ford === 'yes' || tags.ford === 'stepping_stones') flags |= EDGE_FLAG_FORD;
  if (hw === 'steps') flags |= EDGE_FLAG_STEPS;
  if (hw === 'via_ferrata' || tags.via_ferrata_scale) flags |= EDGE_FLAG_VIA_FERRATA;
  if (tags.lit === 'yes') flags |= EDGE_FLAG_LIT;
  if (hw === 'cycleway' || tags.cycleway === 'track' || tags.cycleway === 'lane') {
    flags |= EDGE_FLAG_CYCLEWAY;
  }
  if (['primary', 'secondary', 'tertiary', 'unclassified'].includes(hw)) {
    flags |= EDGE_FLAG_ROAD_TRAFFIC;
  }
  if (tags.natural === 'glacier' || tags.surface === 'glacier' || tags.surface === 'ice') {
    flags |= EDGE_FLAG_GLACIER_SNOW;
  }
  if (
    tags.landuse === 'forest' ||
    tags.natural === 'wood' ||
    (eleM > 0 && eleM < 1750 && (hw === 'track' || hw === 'path') && tags.surface !== 'rock')
  ) {
    flags |= EDGE_FLAG_FOREST_COVER;
  }
  if (
    tags.natural === 'ridge' ||
    tags.natural === 'arete' ||
    tags.exposure === 'yes' ||
    eleM >= 2150
  ) {
    flags |= EDGE_FLAG_EXPOSED_RIDGE;
  }
  return flags;
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

async function queryOverpassCorridor(
  south: number,
  west: number,
  north: number,
  east: number,
  includeWaterways: boolean,
): Promise<OverpassElement[] | null> {
  const bbox = `${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)}`;
  const waterClause = includeWaterways
    ? `way["waterway"~"^(river|canal)$"](${bbox});`
    : '';
  const query = `[out:json][timeout:6];(
    way["highway"~"^(path|footway|track|bridleway|cycleway|steps|via_ferrata|unclassified|tertiary|secondary|residential|service|living_street|pedestrian)$"]["access"!="private"]["access"!="no"](${bbox});
    ${waterClause}
    node["amenity"~"^(drinking_water|shelter|parking|bus_station)$"](${bbox});
    node["natural"="spring"](${bbox});
    node["tourism"~"^(alpine_hut|wilderness_hut)$"](${bbox});
    node["highway"="bus_stop"](${bbox});
    node["railway"~"^(station|halt)$"](${bbox});
  );(._;>;);out body;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'LeKitDuVoyageur-ExplorerV2/2.0 (https://lekitduvoyageur.fr)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassElement[] };
      if (Array.isArray(json.elements) && json.elements.length > 0) {
        return json.elements;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function computeMainComponentNodes(
  nodeCount: number,
  edges: readonly CompactGraphEdge[],
): Set<number> {
  const adj: number[][] = Array.from({ length: nodeCount }, () => []);
  for (const e of edges) {
    if (e.from >= 0 && e.from < nodeCount && e.to >= 0 && e.to < nodeCount) {
      adj[e.from]!.push(e.to);
      adj[e.to]!.push(e.from);
    }
  }
  const visited = new Uint8Array(nodeCount);
  let bestComp: number[] = [];
  for (let i = 0; i < nodeCount; i++) {
    if (visited[i] || adj[i]!.length === 0) continue;
    const comp: number[] = [];
    const stack = [i];
    visited[i] = 1;
    while (stack.length > 0) {
      const u = stack.pop()!;
      comp.push(u);
      for (const v of adj[u]!) {
        if (!visited[v]) {
          visited[v] = 1;
          stack.push(v);
        }
      }
    }
    if (comp.length > bestComp.length) {
      bestComp = comp;
    }
  }
  return new Set(bestComp);
}

function findNearestNodeIndex(
  nodes: readonly CompactGraphNode[],
  lat: number,
  lon: number,
  allowedNodes?: ReadonlySet<number>,
): { index: number; distM: number } {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (allowedNodes && allowedNodes.size > 0 && !allowedNodes.has(i)) continue;
    const n = nodes[i]!;
    const d = haversineDistanceM(lat, lon, n.lat, n.lon);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { index: bestIdx, distM: bestDist };
}

/**
 * Builds a DEM-enriched CompactCorridorGraph around origin -> destination (for <= 35 km).
 * Returns `null` if Overpass is unreachable or graph is disconnected (caller falls back to Valhalla).
 */
export async function buildLocalCorridorGraph(
  origin: RoutePlanEndpoint,
  destination: RoutePlanEndpoint,
  manifest: UserCapabilityManifest,
  env: RouteEnvironmentSnapshot,
): Promise<BuiltCorridorResult | null> {
  const straightM = haversineDistanceM(origin.lat, origin.lng, destination.lat, destination.lng);
  if (straightM > 35_000) return null;

  // Compute padded corridor bbox (min 650m padding, proportional to distance up to 3.2km)
  const padM = Math.min(3200, Math.max(650, straightM * 0.28));
  const latPad = padM / 111_320;
  const meanLat = (origin.lat + destination.lat) * 0.5;
  const lonPad = padM / (111_320 * Math.max(0.2, Math.cos((meanLat * Math.PI) / 180)));

  const south = Math.min(origin.lat, destination.lat) - latPad;
  const north = Math.max(origin.lat, destination.lat) + latPad;
  const west = Math.min(origin.lng, destination.lng) - lonPad;
  const east = Math.max(origin.lng, destination.lng) + lonPad;

  const includeWaterways = manifest.hasWatercraftAndPfd;
  const cacheKey = `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}:${includeWaterways ? 'w' : 'l'}`;
  const cached = corridorCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CORRIDOR_TTL_MS) {
    const sHit = findNearestNodeIndex(cached.graph.nodes, origin.lat, origin.lng);
    const gHit = findNearestNodeIndex(cached.graph.nodes, destination.lat, destination.lng);
    if (sHit.index >= 0 && gHit.index >= 0 && sHit.distM <= 1800 && gHit.distM <= 1800) {
      return {
        graph: cached.graph,
        startNode: sHit.index,
        goalNode: gHit.index,
        hubs: cached.hubs,
        cacheHit: true,
      };
    }
  }

  const elements = await queryOverpassCorridor(south, west, north, east, includeWaterways);
  if (!elements) return null;

  const rawNodes = new Map<number, { lat: number; lon: number; tags?: Record<string, string> }>();
  const ways: OverpassElement[] = [];
  const waterPois: Array<{ lat: number; lon: number }> = [];
  const shelterPois: Array<{ lat: number; lon: number }> = [];
  const hubs: MultimodalHubCandidate[] = [];

  for (const el of elements) {
    if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
      rawNodes.set(el.id, { lat: el.lat, lon: el.lon, tags: el.tags });
      if (el.tags) {
        const am = el.tags.amenity ?? '';
        const nat = el.tags.natural ?? '';
        const tour = el.tags.tourism ?? '';
        const hw = el.tags.highway ?? '';
        const rw = el.tags.railway ?? '';
        if (am === 'drinking_water' || nat === 'spring') {
          waterPois.push({ lat: el.lat, lon: el.lon });
        }
        if (am === 'shelter' || tour === 'alpine_hut' || tour === 'wilderness_hut') {
          shelterPois.push({ lat: el.lat, lon: el.lon });
        }
        if (am === 'parking') {
          hubs.push({
            kind: 'parking',
            name: el.tags.name || 'Parking d’accès',
            lat: el.lat,
            lon: el.lon,
          });
        }
        if (hw === 'bus_stop' || am === 'bus_station' || rw === 'station' || rw === 'halt') {
          hubs.push({
            kind: 'transit',
            name: el.tags.name || (rw ? 'Gare' : 'Arrêt de bus'),
            lat: el.lat,
            lon: el.lon,
          });
        }
      }
    } else if (el.type === 'way' && Array.isArray(el.nodes) && el.nodes.length >= 2) {
      ways.push(el);
    }
  }

  if (ways.length === 0) return null;

  // Compact node indexing (only nodes actually used by ways, capped at 18,000 nodes for speed)
  const osmToCompact = new Map<number, number>();
  const compactNodes: CompactGraphNode[] = [];

  const getOrAddNode = (osmId: number): number => {
    const existing = osmToCompact.get(osmId);
    if (existing !== undefined) return existing;
    const rn = rawNodes.get(osmId);
    if (!rn || compactNodes.length >= 18_000) return -1;
    const idx = compactNodes.length;
    osmToCompact.set(osmId, idx);
    compactNodes.push({
      lat: rn.lat,
      lon: rn.lon,
      eleM: 0,
      poiFlags: 0,
    });
    return idx;
  };

  // Pre-collect used nodes
  for (const w of ways) {
    for (const nid of w.nodes!) {
      getOrAddNode(nid);
    }
  }
  if (compactNodes.length < 2) return null;

  // Batch sample DEM elevations & Horn 3x3 slopes
  const demSamples = await sampleElevationAndSlopeBatch(compactNodes);
  for (let i = 0; i < compactNodes.length; i++) {
    compactNodes[i]!.eleM = demSamples[i]?.eleM ?? 0;
  }

  // Stamp nearby water & shelter POIs onto closest graph nodes (within 120 m)
  for (const wp of waterPois) {
    const hit = findNearestNodeIndex(compactNodes, wp.lat, wp.lon);
    if (hit.index >= 0 && hit.distM <= 120) {
      compactNodes[hit.index]!.poiFlags |= POI_FLAG_WATER;
    }
  }
  for (const sp of shelterPois) {
    const hit = findNearestNodeIndex(compactNodes, sp.lat, sp.lon);
    if (hit.index >= 0 && hit.distM <= 150) {
      compactNodes[hit.index]!.poiFlags |= POI_FLAG_SHELTER;
    }
  }

  // Build directed edges
  const edges: CompactGraphEdge[] = [];
  for (const w of ways) {
    const tags = w.tags ?? {};
    const oneway = tags.oneway === 'yes' || tags.oneway === '1';
    const surface = parseSurface(tags);
    const sacGrade = parseSacGrade(tags);
    const mtbGrade = parseMtbGrade(tags);
    const wwGrade = tags.waterway ? Number.parseInt(tags['whitewater:rapid_grade'] ?? '1', 10) || 1 : 0;

    const nodes = w.nodes!;
    for (let i = 0; i < nodes.length - 1; i++) {
      const u = osmToCompact.get(nodes[i]!);
      const v = osmToCompact.get(nodes[i + 1]!);
      if (u === undefined || v === undefined || u === v) continue;
      const nu = compactNodes[u]!;
      const nv = compactNodes[v]!;
      const lenM = Math.max(1, haversineDistanceM(nu.lat, nu.lon, nv.lat, nv.lon));
      const dz = nv.eleM - nu.eleM;
      const segSlopeDeg = Math.abs((Math.atan(dz / lenM) * 180) / Math.PI);
      const hornSlopeDeg = Math.max(demSamples[u]?.slopeDeg ?? 0, demSamples[v]?.slopeDeg ?? 0);
      const maxSlopeDeg = Math.min(60, Math.max(segSlopeDeg, hornSlopeDeg * 0.85));
      const meanEle = (nu.eleM + nv.eleM) * 0.5;
      const flags = parseEdgeFlags(tags, meanEle);

      let hazardFlags = 0;
      if (
        maxSlopeDeg >= 30 &&
        (env.snowDepthCm >= 15 ||
          (env.freezingLevelM !== null && meanEle >= env.freezingLevelM && env.precipMmH > 0.1))
      ) {
        hazardFlags |= HAZARD_FLAG_AVALANCHE_SLOPE;
      }
      if (env.activeFloodAlert && ((flags & EDGE_FLAG_WATERWAY) !== 0 || (flags & EDGE_FLAG_FORD) !== 0)) {
        hazardFlags |= HAZARD_FLAG_FLOOD;
      }
      if (env.activeFireCount > 0 && tags.landuse === 'forest' && env.activeWeatherAlerts.some((a) => /feu|incendie/i.test(a))) {
        hazardFlags |= HAZARD_FLAG_FIRE;
      }

      edges.push({
        from: u,
        to: v,
        lengthM: lenM,
        dplusM: dz > 0 ? dz : 0,
        dminusM: dz < 0 ? -dz : 0,
        maxSlopeDeg,
        surface,
        sacGrade,
        mtbGrade,
        wwGrade,
        flags,
        hazardFlags,
      });

      // Bidirectional except explicit oneway vehicle roads (pedestrians can still walk both ways)
      if (!oneway || (flags & EDGE_FLAG_ROAD_TRAFFIC) === 0) {
        edges.push({
          from: v,
          to: u,
          lengthM: lenM,
          dplusM: dz < 0 ? -dz : 0,
          dminusM: dz > 0 ? dz : 0,
          maxSlopeDeg,
          surface,
          sacGrade,
          mtbGrade,
          wwGrade,
          flags,
          hazardFlags,
        });
      }
    }
  }

  if (edges.length === 0) return null;

  const graph: CompactCorridorGraph = {
    version: 1,
    nodes: compactNodes,
    edges,
    fetchedAtIso: new Date().toISOString(),
    source: 'overpass_corridor',
  };

  if (corridorCache.size > 35) {
    const oldestKey = corridorCache.keys().next().value;
    if (oldestKey) corridorCache.delete(oldestKey);
  }
  corridorCache.set(cacheKey, { at: Date.now(), graph, hubs });

  const mainComp = computeMainComponentNodes(compactNodes.length, edges);
  const sHit = findNearestNodeIndex(compactNodes, origin.lat, origin.lng, mainComp);
  const gHit = findNearestNodeIndex(compactNodes, destination.lat, destination.lng, mainComp);
  if (sHit.index < 0 || gHit.index < 0 || sHit.distM > 1800 || gHit.distM > 1800) {
    return null;
  }

  return {
    graph,
    startNode: sHit.index,
    goalNode: gHit.index,
    hubs,
    cacheHit: false,
  };
}

/**
 * Fetches live multi-point weather, snow, freezing level, daylight & nearby hazard signals.
 */
export async function fetchRouteEnvironmentSnapshot(
  origin: RoutePlanEndpoint,
  destination: RoutePlanEndpoint,
  departureMs: number,
): Promise<RouteEnvironmentSnapshot> {
  const nowIso = new Date().toISOString();
  const daylight = computeOfflineDaylight(destination.lat, destination.lng, departureMs);
  const sources: Array<{ name: string; updatedAtIso: string }> = [
    { name: 'NOAA Éphémérides solaires (offline)', updatedAtIso: nowIso },
  ];

  let temperatureStartC: number | null = null;
  let temperatureHighC: number | null = null;
  let windKmh = 12;
  let precipMmH = 0;
  let snowDepthCm = 0;
  let freezingLevelM: number | null = null;
  let thunderstormRisk = false;
  let activeFireCount = 0;
  const activeWeatherAlerts: string[] = [];

  const fetchOpenMeteoPoint = async (lat: number, lng: number) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=freezing_level_height,snow_depth&forecast_days=1&timezone=auto`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      return (await res.json()) as {
        current?: {
          temperature_2m?: number;
          precipitation?: number;
          weather_code?: number;
          wind_speed_10m?: number;
          wind_gusts_10m?: number;
        };
        hourly?: {
          freezing_level_height?: number[];
          snow_depth?: number[];
        };
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  const fetchNearbyEonetFires = async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2200);
      const pad = 0.25;
      const minLon = Math.min(origin.lng, destination.lng) - pad;
      const maxLon = Math.max(origin.lng, destination.lng) + pad;
      const minLat = Math.min(origin.lat, destination.lat) - pad;
      const maxLat = Math.max(origin.lat, destination.lat) + pad;
      const url = `https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&bbox=${minLon.toFixed(2)},${maxLat.toFixed(2)},${maxLon.toFixed(2)},${minLat.toFixed(2)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return 0;
      const data = (await res.json()) as { events?: unknown[] };
      return Array.isArray(data.events) ? data.events.length : 0;
    } catch {
      return 0;
    }
  };

  const [wxStart, wxDest, fires] = await Promise.all([
    fetchOpenMeteoPoint(origin.lat, origin.lng),
    fetchOpenMeteoPoint(destination.lat, destination.lng),
    fetchNearbyEonetFires(),
  ]);

  if (wxStart?.current || wxDest?.current) {
    sources.push({ name: 'Open-Meteo (météo & isotherme 0°C)', updatedAtIso: nowIso });
    temperatureStartC = wxStart?.current?.temperature_2m ?? wxDest?.current?.temperature_2m ?? null;
    temperatureHighC = wxDest?.current?.temperature_2m ?? temperatureStartC;
    windKmh = Math.max(
      wxStart?.current?.wind_speed_10m ?? 0,
      wxDest?.current?.wind_speed_10m ?? 0,
    );
    precipMmH = Math.max(
      wxStart?.current?.precipitation ?? 0,
      wxDest?.current?.precipitation ?? 0,
    );
    const wmoCodes = [wxStart?.current?.weather_code ?? 0, wxDest?.current?.weather_code ?? 0];
    thunderstormRisk = wmoCodes.some((c) => c >= 95);
    if (thunderstormRisk) {
      activeWeatherAlerts.push('Risque orageux détecté sur le secteur');
    }
    const freezeArr = wxDest?.hourly?.freezing_level_height ?? wxStart?.hourly?.freezing_level_height;
    if (Array.isArray(freezeArr) && typeof freezeArr[0] === 'number') {
      freezingLevelM = Math.round(freezeArr[0]);
    }
    const snowArr = wxDest?.hourly?.snow_depth ?? wxStart?.hourly?.snow_depth;
    if (Array.isArray(snowArr) && typeof snowArr[0] === 'number') {
      snowDepthCm = Math.round(snowArr[0] * 100);
    }
  }

  activeFireCount = fires;
  if (activeFireCount > 0) {
    sources.push({ name: 'NASA EONET (feux actifs)', updatedAtIso: nowIso });
    activeWeatherAlerts.push(`${activeFireCount} incendie actif détecté à proximité`);
  }

  const ridgeWind = computeEffectiveRidgeWind({
    baseWindKmh: windKmh,
    windGustKmh: windKmh * 1.35,
    altitudeM: 2200,
    ridgeExposed: true,
  });

  // Conservative snow/avalanche BRA heuristic when snowpack is deep
  const avalancheBraLevel: 0 | 1 | 2 | 3 | 4 | 5 =
    snowDepthCm >= 60 ? 3 : snowDepthCm >= 25 ? 2 : snowDepthCm >= 10 ? 1 : 0;

  return {
    fetchedAtIso: nowIso,
    temperatureStartC,
    temperatureHighC,
    windKmh: Math.round(windKmh),
    ridgeWindKmh: Math.round(ridgeWind.effectiveWindKmh),
    precipMmH: Math.round(precipMmH * 10) / 10,
    snowDepthCm,
    freezingLevelM,
    thunderstormRisk,
    avalancheBraLevel,
    activeFireCount,
    activeFloodAlert: false,
    activeWeatherAlerts,
    daylight,
    sources,
  };
}
