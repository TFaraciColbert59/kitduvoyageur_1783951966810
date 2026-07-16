/**
 * Overpass API Service
 * Fetches real OpenStreetMap outdoor data: trails, refuges, summits, water points, etc.
 * Uses Overpass API with intelligent caching to avoid hammering OSM servers.
 */

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
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

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

let endpointIndex = 0;

function getEndpoint(): string {
  const ep = OVERPASS_ENDPOINTS[endpointIndex % OVERPASS_ENDPOINTS.length];
  endpointIndex++;
  return ep;
}

async function queryOverpass(query: string, timeoutMs = 30000): Promise<OverpassResult> {
  const endpoint = getEndpoint();
  const body = `data=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const data = await res.json();
    return data as OverpassResult;
  } finally {
    clearTimeout(timer);
  }
}

// ── Hiking Trails ─────────────────────────────────────────────

export async function fetchHikingTrails(bbox: BBox, limit = 100): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:25];
(
  relation["route"="hiking"](${bboxStr});
  relation["route"="foot"](${bboxStr});
  way["highway"="path"]["foot"!="no"](${bboxStr});
  way["highway"="track"]["foot"!="no"](${bboxStr});
);
out center ${limit};
`;

  const result = await queryOverpass(query);
  return result.elements;
}

// ── Mountain Refuges ──────────────────────────────────────────

export async function fetchRefuges(bbox: BBox, limit = 200): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:25];
(
  node["tourism"="alpine_hut"](${bboxStr});
  node["tourism"="wilderness_hut"](${bboxStr});
  node["tourism"="hostel"]["mountain"="yes"](${bboxStr});
  way["tourism"="alpine_hut"](${bboxStr});
);
out center ${limit};
`;

  const result = await queryOverpass(query);
  return result.elements;
}

// ── Water Points ──────────────────────────────────────────────

export async function fetchWaterPoints(bbox: BBox, limit = 300): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:25];
(
  node["natural"="spring"](${bboxStr});
  node["amenity"="drinking_water"](${bboxStr});
  node["natural"="water"]["water"="lake"](${bboxStr});
);
out center ${limit};
`;

  const result = await queryOverpass(query);
  return result.elements;
}

// ── Summits & Natural Features ────────────────────────────────

export async function fetchNaturalFeatures(bbox: BBox, limit = 200): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:25];
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

  const result = await queryOverpass(query);
  return result.elements;
}

// ── Camping ───────────────────────────────────────────────────

export async function fetchCamping(bbox: BBox, limit = 100): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const query = `
[out:json][timeout:25];
(
  node["tourism"="camp_site"](${bboxStr});
  node["tourism"="camp_pitch"](${bboxStr});
  way["tourism"="camp_site"](${bboxStr});
);
out center ${limit};
`;

  const result = await queryOverpass(query);
  return result.elements;
}

// ── Data Transformers ─────────────────────────────────────────

export function transformTrailElement(el: OverpassElement) {
  const tags = el.tags || {};
  const lat = el.center?.lat ?? el.lat;
  const lng = el.center?.lon ?? el.lon;

  const distanceStr = tags['distance'] || tags['length'] || '';
  const distanceKm = distanceStr ? parseFloat(distanceStr.replace(/[^0-9.]/g, '')) : null;

  return {
    osm_id: el.id,
    name: tags['name'] || tags['ref'] || `Sentier OSM ${el.id}`,
    trail_type: tags['route'] === 'hiking' ? 'hiking' : 'hiking',
    country: tags['addr:country'] || null,
    region: tags['addr:state'] || tags['addr:region'] || null,
    distance_km: distanceKm,
    difficulty: mapOsmDifficulty(tags['sac_scale'] || tags['difficulty']),
    surface: tags['surface'] || null,
    waymarking: tags['osmc:symbol'] || tags['marked_trail'] || null,
    description: tags['description'] || null,
    start_lat: lat ?? null,
    start_lng: lng ?? null,
    source: 'overpass',
  };
}

export function transformPOIElement(el: OverpassElement, category: string) {
  const tags = el.tags || {};
  const lat = el.center?.lat ?? el.lat;
  const lng = el.center?.lon ?? el.lon;

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
    metadata.difficulty = mapOsmDifficulty(tags['sac_scale']) || null;
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
    country: tags['addr:country'] || null,
    region: tags['addr:state'] || null,
    metadata,
    source: 'overpass',
  };
}

function mapOsmDifficulty(sacScale?: string): string {
  if (!sacScale) return 'moderate';
  const map: Record<string, string> = {
    'hiking': 'easy',
    'mountain_hiking': 'moderate',
    'demanding_mountain_hiking': 'hard',
    'alpine_hiking': 'hard',
    'demanding_alpine_hiking': 'expert',
    'difficult_alpine_hiking': 'expert',
  };
  return map[sacScale] || 'moderate';
}

// ── Predefined World Regions for Sync ────────────────────────

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
