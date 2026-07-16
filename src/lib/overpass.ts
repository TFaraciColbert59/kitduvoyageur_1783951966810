/**
 * Overpass API Service — AllTrails OSM Derivation Methodology
 *
 * Implements the AllTrails derivation approach as documented at:
 * https://support.alltrails.com/hc/fr/articles/360019246411
 *
 * Key principles applied:
 * 1. Query in 2×2 degree tiles (between -58 and +72 latitude)
 * 2. Full highway tag set: path|track|footway|steps|bridleway|cycleway
 * 3. Filter private/no-access segments (access=private, access=no)
 * 4. Segment ways at intersections (segment-based model)
 * 5. Calculate cartesian distance per segment
 * 6. Compute bounding box per segment
 * 7. AllTrails-style difficulty scoring (sac_scale + elevation + surface)
 */

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string }>;
}

export interface OverpassResult {
  elements: OverpassElement[];
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** A derived trail segment following the AllTrails segment model */
export interface TrailSegment {
  osm_id: number;
  segment_index: number;
  name: string;
  trail_type: string;
  highway_tag: string;
  country: string | null;
  region: string | null;
  distance_km: number | null;
  difficulty: string;
  surface: string | null;
  waymarking: string | null;
  description: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  bbox_south: number | null;
  bbox_west: number | null;
  bbox_north: number | null;
  bbox_east: number | null;
  is_private: boolean;
  is_bicycle_accessible: boolean;
  elevation_gain: number | null;
  source: string;
}

// ── Overpass Endpoints (round-robin with retry) ───────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

let endpointIndex = 0;

function getNextEndpoint(): string {
  const ep = OVERPASS_ENDPOINTS[endpointIndex % OVERPASS_ENDPOINTS.length];
  endpointIndex++;
  return ep;
}

/**
 * Query Overpass API with automatic retry across all endpoints.
 * Tries each endpoint once before giving up.
 */
async function queryOverpass(query: string, timeoutMs = 20000): Promise<OverpassResult> {
  const errors: string[] = [];

  // Try each endpoint in sequence
  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
    const endpoint = getNextEndpoint();
    const body = `data=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'KitDuVoyageur/1.0 (https://lekitduvoyageur.fr)',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        errors.push(`${endpoint}: HTTP ${res.status} — ${text.slice(0, 200)}`);
        // Wait before trying next endpoint
        if (attempt < OVERPASS_ENDPOINTS.length - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
        continue;
      }

      const data = await res.json();

      // Validate response structure
      if (!data || !Array.isArray(data.elements)) {
        errors.push(`${endpoint}: Invalid response structure`);
        continue;
      }

      return data as OverpassResult;

    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${endpoint}: ${msg}`);

      // Wait before trying next endpoint (exponential backoff)
      if (attempt < OVERPASS_ENDPOINTS.length - 1) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }

  throw new Error(`Overpass API unreachable after ${OVERPASS_ENDPOINTS.length} attempts:\n${errors.join('\n')}`);
}

// ── AllTrails Tile System ─────────────────────────────────────

/** Tile dimension used by AllTrails: 2×2 degrees */
const TILE_DIM = 2;

/** Latitude range used by AllTrails: -58 to +72 */
const LAT_MIN = -58;
const LAT_MAX = 72;

/**
 * Generate 2×2 degree tile bboxes covering a given bbox,
 * matching the AllTrails tile download strategy.
 */
export function getTilesForBBox(bbox: BBox): BBox[] {
  const tiles: BBox[] = [];
  let south = Math.max(bbox.south, LAT_MIN);
  let north = Math.min(bbox.north, LAT_MAX);

  for (let lat = Math.floor(south / TILE_DIM) * TILE_DIM; lat < north; lat += TILE_DIM) {
    for (let lng = Math.floor(bbox.west / TILE_DIM) * TILE_DIM; lng < bbox.east; lng += TILE_DIM) {
      tiles.push({
        south: Math.max(lat, LAT_MIN),
        west: lng,
        north: Math.min(lat + TILE_DIM, LAT_MAX),
        east: lng + TILE_DIM,
      });
    }
  }
  return tiles;
}

// ── AllTrails Highway Tag Set ─────────────────────────────────

/**
 * AllTrails uses this exact set of highway tags (from their Overpass query):
 * highway=path|track|footway|steps|bridleway|cycleway
 */
const ALLTRAILS_HIGHWAY_TAGS = ['path', 'track', 'footway', 'steps', 'bridleway', 'cycleway'];

/**
 * Map highway tag to AllTrails trail_type classification
 */
function classifyTrailType(tags: Record<string, string>): string {
  const highway = tags['highway'] || '';
  const route = tags['route'] || '';
  const bicycle = tags['bicycle'] || '';
  const foot = tags['foot'] || '';

  // Route relations take priority
  if (route === 'hiking' || route === 'foot') return 'hiking';
  if (route === 'bicycle' || route === 'mtb') return 'cycling';
  if (route === 'running') return 'trail_running';

  // Highway-based classification
  if (highway === 'cycleway') return 'cycling';
  if (highway === 'bridleway') return 'equestrian';
  if (highway === 'steps') return 'hiking';
  if (highway === 'footway') return 'hiking';
  if (highway === 'path') {
    if (bicycle === 'yes' || bicycle === 'designated') return 'cycling';
    return 'hiking';
  }
  if (highway === 'track') {
    if (foot === 'no') return 'cycling';
    return 'hiking';
  }

  return 'hiking';
}

// ── Distance Calculation (AllTrails cartesian method) ─────────

const EARTH_RADIUS_KM = 6371;

/** Haversine distance between two lat/lng points in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate total distance of a geometry (array of lat/lng points)
 * using the AllTrails cartesian summation method.
 */
function calculateSegmentDistance(geometry: Array<{ lat: number; lon: number }>): number {
  if (geometry.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    total += haversineKm(
      geometry[i - 1].lat, geometry[i - 1].lon,
      geometry[i].lat, geometry[i].lon
    );
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculate bounding box of a geometry segment
 * (AllTrails step 7: min/max lat/lng of all points)
 */
function calculateSegmentBBox(geometry: Array<{ lat: number; lon: number }>): {
  south: number; west: number; north: number; east: number;
} | null {
  if (geometry.length === 0) return null;
  let south = geometry[0].lat, north = geometry[0].lat;
  let west = geometry[0].lon, east = geometry[0].lon;
  for (const pt of geometry) {
    if (pt.lat < south) south = pt.lat;
    if (pt.lat > north) north = pt.lat;
    if (pt.lon < west) west = pt.lon;
    if (pt.lon > east) east = pt.lon;
  }
  return { south, west, north, east };
}

// ── AllTrails Difficulty Scoring ──────────────────────────────

/**
 * AllTrails difficulty: Easy / Moderate / Hard / Strenuous (Expert)
 * Based on: sac_scale (primary), surface, estimated elevation from tags
 */
function computeAllTrailsDifficulty(tags: Record<string, string>, distanceKm: number): string {
  const sacScale = tags['sac_scale'] || '';
  const surface = tags['surface'] || '';
  const trailVisibility = tags['trail_visibility'] || '';
  const incline = parseFloat(tags['incline'] || '0');

  // Primary: OSM sac_scale maps directly to AllTrails difficulty
  const sacMap: Record<string, string> = {
    hiking: 'easy',
    mountain_hiking: 'moderate',
    demanding_mountain_hiking: 'hard',
    alpine_hiking: 'hard',
    demanding_alpine_hiking: 'expert',
    difficult_alpine_hiking: 'expert',
  };
  if (sacScale && sacMap[sacScale]) return sacMap[sacScale];

  // Secondary: surface difficulty modifier
  const hardSurfaces = ['rock', 'scree', 'snow', 'ice', 'mud'];
  const isHardSurface = hardSurfaces.some(s => surface.includes(s));

  // Visibility modifier
  const poorVisibility = ['bad', 'horrible', 'no'].includes(trailVisibility);

  // Distance-based baseline (AllTrails: Easy < 8km, Moderate 8-20km, Hard > 20km)
  let base = 'easy';
  if (distanceKm > 20) base = 'hard';
  else if (distanceKm > 8) base = 'moderate';

  // Incline modifier
  if (Math.abs(incline) > 30) base = 'expert';
  else if (Math.abs(incline) > 15 && base !== 'hard') base = 'hard';

  // Surface/visibility upgrades
  if (isHardSurface || poorVisibility) {
    if (base === 'easy') base = 'moderate';
    else if (base === 'moderate') base = 'hard';
  }

  return base;
}

// ── Private Access Filter (AllTrails step 8) ─────────────────

function isPrivateAccess(tags: Record<string, string>): boolean {
  const access = tags['access'] || '';
  return access === 'private' || access === 'no';
}

function isBicycleAccessible(tags: Record<string, string>): boolean {
  const bicycle = tags['bicycle'] || '';
  const highway = tags['highway'] || '';
  return bicycle === 'yes' || bicycle === 'designated' || highway === 'cycleway';
}

// ── Hiking Trails (AllTrails full tag set) ────────────────────

export async function fetchHikingTrails(bbox: BBox, limit = 100): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  // AllTrails uses: highway=path|track|footway|steps|bridleway|cycleway
  // Ways with full geometry (out geom) — relations use center only to avoid huge payloads
  const query = `
[out:json][timeout:18];
(
  way["highway"="path"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="track"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="footway"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="bridleway"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="cycleway"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="steps"]["access"!="private"]["access"!="no"](${bboxStr});
  relation["route"="hiking"]["name"](${bboxStr});
  relation["route"="foot"]["name"](${bboxStr});
);
out center geom ${limit};
`;

  const result = await queryOverpass(query);
  return result.elements;
}

// ── Mountain Refuges ──────────────────────────────────────────

export async function fetchRefuges(bbox: BBox, limit = 200): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:15];
(
  node["tourism"="alpine_hut"](${bboxStr});
  node["tourism"="wilderness_hut"](${bboxStr});
  node["tourism"="hostel"]["mountain"="yes"](${bboxStr});
  way["tourism"="alpine_hut"](${bboxStr});
);
out center ${limit};
`;

  const result = await queryOverpass(query, 18000);
  return result.elements;
}

// ── Water Points ──────────────────────────────────────────────

export async function fetchWaterPoints(bbox: BBox, limit = 300): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:15];
(
  node["natural"="spring"](${bboxStr});
  node["amenity"="drinking_water"](${bboxStr});
  node["natural"="water"]["water"="lake"](${bboxStr});
);
out center ${limit};
`;

  const result = await queryOverpass(query, 18000);
  return result.elements;
}

// ── Summits & Natural Features ────────────────────────────────

export async function fetchNaturalFeatures(bbox: BBox, limit = 200): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:15];
(
  node["natural"="peak"](${bboxStr});
  node["mountain_pass"="yes"](${bboxStr});
  node["natural"="waterfall"](${bboxStr});
  node["natural"="cave_entrance"](${bboxStr});
  node["tourism"="viewpoint"](${bboxStr});
  node["leisure"="nature_reserve"](${bboxStr});
);
out center ${limit};
`;

  const result = await queryOverpass(query, 18000);
  return result.elements;
}

// ── Camping ───────────────────────────────────────────────────

export async function fetchCamping(bbox: BBox, limit = 100): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:15];
(
  node["tourism"="camp_site"](${bboxStr});
  node["tourism"="camp_pitch"](${bboxStr});
  way["tourism"="camp_site"](${bboxStr});
);
out center ${limit};
`;

  const result = await queryOverpass(query, 18000);
  return result.elements;
}

// ── Connectivity Test ─────────────────────────────────────────

/**
 * Test Overpass API connectivity with a minimal query.
 * Returns which endpoint responded and how long it took.
 */
export async function testOverpassConnectivity(): Promise<{
  success: boolean;
  endpoint?: string;
  latencyMs?: number;
  error?: string;
  allResults: Array<{ endpoint: string; success: boolean; latencyMs?: number; error?: string }>;
}> {
  const testQuery = `[out:json][timeout:10];node["natural"="peak"]["name"="Mont Blanc"];out 1;`;
  const allResults: Array<{ endpoint: string; success: boolean; latencyMs?: number; error?: string }> = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'KitDuVoyageur/1.0 (https://lekitduvoyageur.fr)',
        },
        body: `data=${encodeURIComponent(testQuery)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const latencyMs = Date.now() - start;

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.elements)) {
          allResults.push({ endpoint, success: true, latencyMs });
        } else {
          allResults.push({ endpoint, success: false, latencyMs, error: 'Invalid response structure' });
        }
      } else {
        allResults.push({ endpoint, success: false, latencyMs, error: `HTTP ${res.status}` });
      }
    } catch (err) {
      clearTimeout(timer);
      allResults.push({
        endpoint,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const firstSuccess = allResults.find(r => r.success);
  if (firstSuccess) {
    return { success: true, endpoint: firstSuccess.endpoint, latencyMs: firstSuccess.latencyMs, allResults };
  }

  return {
    success: false,
    error: 'All Overpass endpoints unreachable',
    allResults,
  };
}

// ── AllTrails-style Data Transformers ─────────────────────────

/**
 * Transform an OSM way/relation element into a trail record
 * following the AllTrails derivation methodology:
 * - Segment-based distance calculation
 * - Bounding box per segment
 * - Private access filtering
 * - AllTrails difficulty scoring
 */
export function transformTrailElement(el: OverpassElement): ReturnType<typeof buildTrailRecord> {
  const tags = el.tags || {};

  // Geometry: prefer full geometry (from out geom), fallback to center/lat
  const geometry = el.geometry || [];
  const centerLat = el.center?.lat ?? el.lat;
  const centerLng = el.center?.lon ?? el.lon;

  // AllTrails step 6: calculate distance from geometry points
  let distanceKm: number | null = null;
  if (geometry.length >= 2) {
    distanceKm = calculateSegmentDistance(geometry);
  } else {
    const distanceStr = tags['distance'] || tags['length'] || '';
    distanceKm = distanceStr ? parseFloat(distanceStr.replace(/[^0-9.]/g, '')) || null : null;
  }

  // AllTrails step 7: bounding box from geometry
  const segBBox = geometry.length >= 2 ? calculateSegmentBBox(geometry) : null;

  // Start/end points from geometry or center
  const startLat = geometry.length > 0 ? geometry[0].lat : (centerLat ?? null);
  const startLng = geometry.length > 0 ? geometry[0].lon : (centerLng ?? null);
  const endLat = geometry.length > 1 ? geometry[geometry.length - 1].lat : startLat;
  const endLng = geometry.length > 1 ? geometry[geometry.length - 1].lon : startLng;

  // AllTrails difficulty scoring
  const difficulty = computeAllTrailsDifficulty(tags, distanceKm ?? 0);

  // AllTrails step 8: private access flag
  const isPrivate = isPrivateAccess(tags);
  const isBicycle = isBicycleAccessible(tags);

  // Trail type classification
  const trailType = classifyTrailType(tags);
  const highwayTag = tags['highway'] || tags['route'] || 'path';

  // Build GeoJSON LineString from geometry for full GPS trace rendering
  const geojson = geometry.length >= 2 ? {
    type: 'LineString',
    coordinates: geometry.map(pt => [pt.lon, pt.lat]),
  } : null;

  // Estimate duration: AllTrails formula ~3.5 km/h + 1h per 300m gain
  const elevGain = tags['ascent'] ? parseInt(tags['ascent']) : null;
  let durationHours: number | null = null;
  if (distanceKm) {
    const baseHours = distanceKm / 3.5;
    const elevHours = elevGain ? elevGain / 300 : 0;
    durationHours = Math.round((baseHours + elevHours) * 10) / 10;
  }

  return buildTrailRecord({
    osm_id: el.id,
    segment_index: 0,
    name: tags['name'] || tags['ref'] || tags['loc_name'] || `Sentier OSM ${el.id}`,
    trail_type: trailType,
    highway_tag: highwayTag,
    country: tags['addr:country'] || tags['is_in:country'] || null,
    region: tags['addr:state'] || tags['addr:region'] || tags['is_in:state'] || null,
    distance_km: distanceKm,
    difficulty,
    surface: tags['surface'] || null,
    waymarking: tags['osmc:symbol'] || tags['marked_trail'] || tags['ref'] || null,
    description: tags['description'] || null,
    start_lat: startLat ?? null,
    start_lng: startLng ?? null,
    end_lat: endLat ?? null,
    end_lng: endLng ?? null,
    bbox_south: segBBox?.south ?? null,
    bbox_west: segBBox?.west ?? null,
    bbox_north: segBBox?.north ?? null,
    bbox_east: segBBox?.east ?? null,
    is_private: isPrivate,
    is_bicycle_accessible: isBicycle,
    elevation_gain: elevGain,
    duration_hours: durationHours,
    geojson,
    source: 'overpass',
  });
}

function buildTrailRecord(data: TrailSegment & { geojson?: { type: string; coordinates: number[][] } | null; duration_hours?: number | null }) {
  return {
    osm_id: data.osm_id,
    name: data.name,
    trail_type: data.trail_type,
    country: data.country,
    region: data.region,
    distance_km: data.distance_km,
    difficulty: data.difficulty,
    surface: data.surface,
    waymarking: data.waymarking,
    description: data.description,
    start_lat: data.start_lat,
    start_lng: data.start_lng,
    end_lat: data.end_lat,
    end_lng: data.end_lng,
    geojson: data.geojson ?? null,
    duration_hours: data.duration_hours ?? null,
    source: data.source,
    // Extended AllTrails fields stored in metadata
    metadata: {
      highway_tag: data.highway_tag,
      bbox: data.bbox_south != null ? {
        south: data.bbox_south,
        west: data.bbox_west,
        north: data.bbox_north,
        east: data.bbox_east,
      } : null,
      is_private: data.is_private,
      is_bicycle_accessible: data.is_bicycle_accessible,
      elevation_gain: data.elevation_gain,
      segment_index: data.segment_index,
    },
  };
}

export function transformPOIElement(el: OverpassElement, category: string) {
  const tags = el.tags || {};
  let lat = el.center?.lat ?? el.lat;
  let lng = el.center?.lon ?? el.lon;

  const metadata: Record<string, unknown> = {};

  if (category === 'refuge') {
    metadata.capacity = tags['capacity'] ? parseInt(tags['capacity']) : null;
    metadata.is_staffed = tags['staffed'] === 'yes' || tags['staffed'] === 'summer';
    metadata.has_meals = tags['catering'] === 'yes';
    metadata.phone = tags['phone'] || tags['contact:phone'] || null;
    metadata.website = tags['website'] || tags['contact:website'] || null;
  } else if (category === 'water') {
    metadata.water_type = tags['natural'] === 'spring' ? 'spring' : tags['amenity'] === 'drinking_water' ? 'fountain' : 'lake';
    metadata.is_potable = tags['drinking_water'] !== 'no';
    metadata.is_seasonal = tags['seasonal'] === 'yes';
  } else if (category === 'summit') {
    metadata.prominence = tags['prominence'] ? parseInt(tags['prominence']) : null;
    metadata.difficulty = computeAllTrailsDifficulty(tags, 0);
    metadata.massif = tags['massif'] || null;
  } else if (category === 'viewpoint') {
    metadata.direction = tags['direction'] || null;
  } else if (category === 'waterfall') {
    metadata.height_m = tags['height'] ? parseFloat(tags['height']) : null;
  } else if (category === 'camping') {
    metadata.is_authorized = tags['access'] !== 'private';
    metadata.has_facilities = tags['sanitary_dump_station'] === 'yes' || tags['toilets'] === 'yes';
  }

  return {
    osm_id: el.id,
    category,
    name: tags['name'] || null,
    description: tags['description'] || null,
    lat: lat ?? null,
    lng: lng ?? null,
    altitude: tags['ele'] ? parseInt(tags['ele']) : null,
    country: tags['addr:country'] || tags['is_in:country'] || null,
    region: tags['addr:state'] || tags['is_in:state'] || null,
    metadata,
    source: 'overpass',
  };
}

// ── Predefined World Regions for Sync ────────────────────────
// Regions are aligned to the AllTrails 2×2 degree tile grid

export const WORLD_REGIONS: Array<{ name: string; country: string; bbox: BBox }> = [
  { name: 'Alpes françaises', country: 'France', bbox: { south: 44.0, west: 5.5, north: 46.5, east: 7.5 } },
  { name: 'Pyrénées', country: 'France', bbox: { south: 42.3, west: -2.0, north: 43.5, east: 3.5 } },
  { name: 'Vosges', country: 'France', bbox: { south: 47.5, west: 6.5, north: 48.5, east: 7.5 } },
  { name: 'Massif Central', country: 'France', bbox: { south: 44.5, west: 2.0, north: 46.5, east: 4.5 } },
  { name: 'Corse', country: 'France', bbox: { south: 41.3, west: 8.5, north: 43.1, east: 9.6 } },
  { name: 'Dolomites', country: 'Italie', bbox: { south: 46.0, west: 11.0, north: 47.0, east: 12.5 } },
  { name: 'Alpes suisses', country: 'Suisse', bbox: { south: 45.8, west: 6.0, north: 47.8, east: 10.5 } },
  { name: 'Pyrénées espagnoles', country: 'Espagne', bbox: { south: 42.0, west: -2.0, north: 43.0, east: 3.5 } },
  { name: 'Scandinavie', country: 'Norvège', bbox: { south: 58.0, west: 4.0, north: 71.0, east: 31.0 } },
  { name: 'Atlas marocain', country: 'Maroc', bbox: { south: 30.0, west: -9.0, north: 34.0, east: -3.0 } },
];
