import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

// ── Overpass endpoints ────────────────────────────────────────
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface OSMNode {
  lat: number;
  lon: number;
}

interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: OSMNode[];
  tags?: Record<string, string>;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string }>;
}

// ── Haversine distance ────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Query Overpass with retry ─────────────────────────────────
async function queryOverpass(query: string, timeoutMs = 25000): Promise<OSMElement[]> {
  const errors: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
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
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        errors.push(`${endpoint}: HTTP ${res.status}`);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      const data = await res.json();
      if (!data?.elements || !Array.isArray(data.elements)) {
        errors.push(`${endpoint}: invalid response`);
        continue;
      }
      console.log(`[sync-trails] Overpass OK via ${endpoint}: ${data.elements.length} elements`);
      return data.elements as OSMElement[];
    } catch (err) {
      clearTimeout(timer);
      errors.push(`${endpoint}: ${err instanceof Error ? err.message : String(err)}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error(`Overpass unreachable: ${errors.join(' | ')}`);
}

// ── Reconstruct GPS LineString from ways ──────────────────────
function reconstructGeometry(
  members: Array<{ type: string; ref: number; role: string }>,
  wayMap: Map<number, OSMNode[]>
): OSMNode[] {
  const wayMembers = members.filter(m => m.type === 'way');
  if (wayMembers.length === 0) return [];

  const segments: OSMNode[][] = [];
  for (const m of wayMembers) {
    const geom = wayMap.get(m.ref);
    if (geom && geom.length >= 2) segments.push(geom);
  }
  if (segments.length === 0) return [];

  // Chain segments end-to-end
  const result: OSMNode[] = [...segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const last = result[result.length - 1];
    const distFwd = haversineKm(last.lat, last.lon, seg[0].lat, seg[0].lon);
    const distRev = haversineKm(last.lat, last.lon, seg[seg.length - 1].lat, seg[seg.length - 1].lon);
    if (distRev < distFwd) {
      result.push(...[...seg].reverse());
    } else {
      result.push(...seg);
    }
  }
  return result;
}

// ── Validate GPS geometry ─────────────────────────────────────
function validateGPS(coords: number[][], minPoints: number): boolean {
  if (coords.length < minPoints) return false;
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2) return false;
    if (isNaN(c[0]) || isNaN(c[1])) return false;
    if (c[0] < -180 || c[0] > 180 || c[1] < -90 || c[1] > 90) return false;
  }
  // Reject straight lines: real trails have sinuosity > 1.02
  const first = coords[0];
  const last = coords[coords.length - 1];
  const straightDist = haversineKm(first[1], first[0], last[1], last[0]);
  let pathLen = 0;
  for (let i = 1; i < coords.length; i++) {
    pathLen += haversineKm(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
  }
  if (straightDist > 0.1 && pathLen / straightDist < 1.02) return false;
  return true;
}

// ── Difficulty from OSM tags ──────────────────────────────────
function getDifficulty(tags: Record<string, string>, distKm: number): string {
  const sac: Record<string, string> = {
    hiking: 'easy',
    mountain_hiking: 'moderate',
    demanding_mountain_hiking: 'hard',
    alpine_hiking: 'hard',
    demanding_alpine_hiking: 'expert',
    difficult_alpine_hiking: 'expert',
  };
  if (tags['sac_scale'] && sac[tags['sac_scale']]) return sac[tags['sac_scale']];
  if (distKm > 20) return 'hard';
  if (distKm > 8) return 'moderate';
  return 'easy';
}

// ── Calculate path distance ───────────────────────────────────
function calcDistance(geom: OSMNode[]): number {
  let d = 0;
  for (let i = 1; i < geom.length; i++) {
    d += haversineKm(geom[i-1].lat, geom[i-1].lon, geom[i].lat, geom[i].lon);
  }
  return Math.round(d * 100) / 100;
}

// ── Fetch hiking trails from Overpass for a small tile ────────
async function fetchHikingTrailsFromOSM(bbox: BBox, limit = 80): Promise<{
  trails: ReturnType<typeof buildTrailRecord>[];
  stats: { ways: number; relations: number; valid: number; rejected: number };
}> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  // STEP 1: Fetch ways with full geometry (out body geom = inline node coordinates)
  // This is the critical query — "out body geom" gives us ALL node lat/lon for each way
  const waysQuery = `
[out:json][timeout:25];
(
  way["highway"="path"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="track"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="footway"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="bridleway"]["access"!="private"]["access"!="no"](${bboxStr});
);
out body geom ${limit};
`;

  // STEP 2: Fetch named hiking relations + recurse into member ways for geometry
  // ">;" recurses into members, "out body geom" gives us the way geometries
  const relationsQuery = `
[out:json][timeout:25];
(
  relation["route"="hiking"]["name"](${bboxStr});
  relation["route"="foot"]["name"](${bboxStr});
);
out body;
>;
out body geom;
`;

  const [waysResult, relationsResult] = await Promise.allSettled([
    queryOverpass(waysQuery, 28000),
    queryOverpass(relationsQuery, 28000),
  ]);

  const wayMap = new Map<number, OSMNode[]>();
  const ways: OSMElement[] = [];
  const relations: OSMElement[] = [];

  // Process ways — each has geometry: [{lat, lon}, ...] inline
  if (waysResult.status === 'fulfilled') {
    for (const el of waysResult.value) {
      if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
        ways.push(el);
        wayMap.set(el.id, el.geometry);
      }
    }
  }

  // Process relations — extract relations and build wayMap from member ways
  if (relationsResult.status === 'fulfilled') {
    for (const el of relationsResult.value) {
      if (el.type === 'relation') {
        relations.push(el);
      } else if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
        wayMap.set(el.id, el.geometry);
      }
    }
  }

  console.log(`[sync-trails] Fetched: ${ways.length} ways, ${relations.length} relations, ${wayMap.size} way geometries`);

  const trails: ReturnType<typeof buildTrailRecord>[] = [];
  let rejected = 0;
  const MIN_POINTS = 20;

  // STEP 3: Transform ways → GeoJSON LineString
  for (const way of ways) {
    const tags = way.tags || {};
    const geom = way.geometry!;
    const coords = geom.map(pt => [pt.lon, pt.lat]);

    if (!validateGPS(coords, MIN_POINTS)) { rejected++; continue; }

    const distKm = calcDistance(geom);
    const startLat = geom[0].lat;
    const startLng = geom[0].lon;
    const endLat = geom[geom.length - 1].lat;
    const endLng = geom[geom.length - 1].lon;
    const elevGain = tags['ascent'] ? parseInt(tags['ascent']) : null;
    const durationHours = distKm ? Math.round((distKm / 3.5 + (elevGain || 0) / 300) * 10) / 10 : null;

    trails.push(buildTrailRecord({
      osm_id: way.id,
      name: tags['name'] || tags['ref'] || `Sentier OSM ${way.id}`,
      trail_type: getTrailType(tags),
      country: tags['addr:country'] || null,
      region: tags['addr:state'] || tags['addr:region'] || null,
      distance_km: distKm,
      difficulty: getDifficulty(tags, distKm),
      surface: tags['surface'] || null,
      description: tags['description'] || null,
      start_lat: startLat,
      start_lng: startLng,
      end_lat: endLat,
      end_lng: endLng,
      elevation_gain: elevGain,
      duration_hours: durationHours,
      is_loop: haversineKm(startLat, startLng, endLat, endLng) < 0.1,
      geojson: { type: 'LineString', coordinates: coords },
      gps_points_count: coords.length,
    }));
  }

  // STEP 4: Transform relations → reconstruct GPS from member ways
  for (const rel of relations) {
    const tags = rel.tags || {};
    if (!rel.members) continue;

    // Reconstruct full GPS trace: relation → ways → nodes → coordinates
    const geom = reconstructGeometry(rel.members, wayMap);
    if (geom.length < MIN_POINTS) { rejected++; continue; }

    const coords = geom.map(pt => [pt.lon, pt.lat]);
    if (!validateGPS(coords, MIN_POINTS)) { rejected++; continue; }

    const distKm = calcDistance(geom);
    const startLat = geom[0].lat;
    const startLng = geom[0].lon;
    const endLat = geom[geom.length - 1].lat;
    const endLng = geom[geom.length - 1].lon;
    const elevGain = tags['ascent'] ? parseInt(tags['ascent']) : null;
    const durationHours = distKm ? Math.round((distKm / 3.5 + (elevGain || 0) / 300) * 10) / 10 : null;

    console.log(`[sync-trails] Relation ${rel.id} "${tags['name']}": ${geom.length} GPS points, ${distKm.toFixed(1)}km`);

    trails.push(buildTrailRecord({
      osm_id: rel.id,
      name: tags['name'] || tags['ref'] || `Route OSM ${rel.id}`,
      trail_type: getTrailType(tags),
      country: tags['addr:country'] || null,
      region: tags['addr:state'] || tags['addr:region'] || null,
      distance_km: distKm,
      difficulty: getDifficulty(tags, distKm),
      surface: tags['surface'] || null,
      description: tags['description'] || null,
      start_lat: startLat,
      start_lng: startLng,
      end_lat: endLat,
      end_lng: endLng,
      elevation_gain: elevGain,
      duration_hours: durationHours,
      is_loop: haversineKm(startLat, startLng, endLat, endLng) < 0.1,
      geojson: { type: 'LineString', coordinates: coords },
      gps_points_count: coords.length,
    }));
  }

  return {
    trails,
    stats: { ways: ways.length, relations: relations.length, valid: trails.length, rejected },
  };
}

function getTrailType(tags: Record<string, string>): string {
  const route = tags['route'] || '';
  const highway = tags['highway'] || '';
  if (route === 'hiking' || route === 'foot') return 'hiking';
  if (route === 'bicycle' || route === 'mtb') return 'cycling';
  if (highway === 'cycleway') return 'cycling';
  if (highway === 'bridleway') return 'equestrian';
  return 'hiking';
}

function buildTrailRecord(data: {
  osm_id: number;
  name: string;
  trail_type: string;
  country: string | null;
  region: string | null;
  distance_km: number;
  difficulty: string;
  surface: string | null;
  description: string | null;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  elevation_gain: number | null;
  duration_hours: number | null;
  is_loop: boolean;
  geojson: { type: string; coordinates: number[][] };
  gps_points_count: number;
}) {
  return {
    osm_id: data.osm_id,
    name: data.name,
    trail_type: data.trail_type,
    country: data.country,
    region: data.region,
    distance_km: data.distance_km,
    difficulty: data.difficulty,
    surface: data.surface,
    description: data.description,
    start_lat: data.start_lat,
    start_lng: data.start_lng,
    end_lat: data.end_lat,
    end_lng: data.end_lng,
    elevation_gain: data.elevation_gain,
    duration_hours: data.duration_hours,
    is_loop: data.is_loop,
    geojson: data.geojson,
    gps_points_count: data.gps_points_count,
    source: 'overpass',
    metadata: {},
  };
}

// ── Predefined zones (small enough for Overpass to handle) ────
const SYNC_ZONES: Record<string, { bbox: BBox; country: string; label: string }> = {
  chamonix: {
    bbox: { south: 45.85, west: 6.7, north: 46.05, east: 7.0 },
    country: 'France',
    label: 'Chamonix / Mont-Blanc',
  },
  alpes_nord: {
    bbox: { south: 45.5, west: 6.0, north: 46.0, east: 7.0 },
    country: 'France',
    label: 'Alpes du Nord',
  },
  alpes_sud: {
    bbox: { south: 44.0, west: 6.0, north: 44.8, east: 7.0 },
    country: 'France',
    label: 'Alpes du Sud',
  },
  mercantour: {
    bbox: { south: 43.9, west: 6.8, north: 44.4, east: 7.5 },
    country: 'France',
    label: 'Mercantour',
  },
  pyrenees: {
    bbox: { south: 42.5, west: -1.0, north: 43.2, east: 1.5 },
    country: 'France',
    label: 'Pyrénées centrales',
  },
  vercors: {
    bbox: { south: 44.7, west: 5.3, north: 45.2, east: 5.8 },
    country: 'France',
    label: 'Vercors',
  },
  belledonne: {
    bbox: { south: 45.0, west: 5.8, north: 45.5, east: 6.3 },
    country: 'France',
    label: 'Belledonne',
  },
};

// ── POST /api/map/sync-trails ─────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));

    // Accept either a named zone or a custom bbox
    const zoneName = body.zone as string | undefined;
    const customBbox = body.bbox as BBox | undefined;
    const customLabel = body.label as string | undefined;

    let bbox: BBox;
    let country: string;
    let label: string;

    if (customBbox) {
      bbox = customBbox;
      country = body.country || 'Unknown';
      label = customLabel || `Zone ${bbox.south.toFixed(1)},${bbox.west.toFixed(1)}`;
    } else if (zoneName && SYNC_ZONES[zoneName]) {
      const zone = SYNC_ZONES[zoneName];
      bbox = zone.bbox;
      country = zone.country;
      label = zone.label;
    } else {
      // Default: Chamonix — small zone, guaranteed to work
      const zone = SYNC_ZONES.chamonix;
      bbox = zone.bbox;
      country = zone.country;
      label = zone.label;
    }

    console.log(`[sync-trails] Starting sync for "${label}" bbox=${JSON.stringify(bbox)}`);

    // STEP 5: Fetch from Overpass
    const { trails, stats } = await fetchHikingTrailsFromOSM(bbox, 100);

    console.log(`[sync-trails] Pipeline result: ${stats.valid} valid trails, ${stats.rejected} rejected`);

    if (trails.length === 0) {
      return NextResponse.json({
        success: false,
        label,
        bbox,
        stats,
        message: 'Aucun sentier avec géométrie GPS complète trouvé. Essayez une autre zone.',
      }, { status: 200 });
    }

    // STEP 6: Store in Supabase
    // Upsert by osm_id to avoid duplicates
    const { error: upsertErr, data: upsertedData } = await supabase
      .from('trails')
      .upsert(trails, { onConflict: 'osm_id', ignoreDuplicates: false })
      .select('id');
    const count = upsertedData?.length ?? trails.length;

    if (upsertErr) {
      console.error('[sync-trails] Upsert error:', upsertErr);
      return NextResponse.json({
        success: false,
        label,
        error: upsertErr.message,
        trails_prepared: trails.length,
      }, { status: 500 });
    }

    // Update country on inserted trails (Overpass often doesn't have country tag)
    await supabase
      .from('trails')
      .update({ country })
      .in('osm_id', trails.map(t => t.osm_id))
      .is('country', null);

    console.log(`[sync-trails] Stored ${count ?? trails.length} trails for "${label}"`);

    return NextResponse.json({
      success: true,
      label,
      bbox,
      trails_inserted: count ?? trails.length,
      stats: {
        ways_fetched: stats.ways,
        relations_fetched: stats.relations,
        valid_gps_trails: stats.valid,
        rejected_insufficient_gps: stats.rejected,
      },
      message: `✅ ${stats.valid} sentiers GPS réels importés pour "${label}" (${stats.ways} ways + ${stats.relations} relations OSM)`,
      sample: trails.slice(0, 3).map(t => ({
        name: t.name,
        gps_points: t.gps_points_count,
        distance_km: t.distance_km,
        geojson_type: t.geojson.type,
      })),
    });

  } catch (err) {
    console.error('[sync-trails] Fatal error:', err);
    return NextResponse.json({
      success: false,
      error: String(err),
      hint: 'Overpass API may be temporarily unavailable. Try again in a few minutes.',
    }, { status: 500 });
  }
}

// ── GET /api/map/sync-trails — list available zones ──────────
export async function GET() {
  try {
    const supabase = await createClient();

    const { count: trailsCount } = await supabase
      .from('trails')
      .select('id', { count: 'exact', head: true });

    const { data: sample } = await supabase
      .from('trails')
      .select('name, gps_points_count, distance_km, geojson')
      .not('geojson', 'is', null)
      .limit(5);

    return NextResponse.json({
      trails_in_db: trailsCount ?? 0,
      available_zones: Object.entries(SYNC_ZONES).map(([key, z]) => ({
        key,
        label: z.label,
        country: z.country,
        bbox: z.bbox,
      })),
      sample_trails: sample?.map(t => ({
        name: t.name,
        gps_points: t.gps_points_count,
        distance_km: t.distance_km,
        has_geojson: !!t.geojson,
        geojson_type: (t.geojson as { type?: string } | null)?.type,
        coordinates_count: (t.geojson as { coordinates?: unknown[] } | null)?.coordinates?.length ?? 0,
      })) ?? [],
      instructions: 'POST with { "zone": "chamonix" } to import trails. Available zones: ' + Object.keys(SYNC_ZONES).join(', '),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
