import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Overpass endpoints (round-robin) ─────────────────────────
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
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

// ── Predefined zones ──────────────────────────────────────────
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
  ecrins: {
    bbox: { south: 44.6, west: 5.9, north: 45.1, east: 6.5 },
    country: 'France',
    label: 'Écrins',
  },
  corsica: {
    bbox: { south: 41.3, west: 8.5, north: 43.1, east: 9.6 },
    country: 'France',
    label: 'Corse (GR20)',
  },
  jura: {
    bbox: { south: 46.2, west: 5.8, north: 47.2, east: 6.8 },
    country: 'France',
    label: 'Jura',
  },
};

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

function calcDistance(geom: OSMNode[]): number {
  let d = 0;
  for (let i = 1; i < geom.length; i++) {
    d += haversineKm(geom[i - 1].lat, geom[i - 1].lon, geom[i].lat, geom[i].lon);
  }
  return Math.round(d * 100) / 100;
}

// ── Overpass query with retry ─────────────────────────────────
async function queryOverpass(query: string, timeoutMs = 30000): Promise<OSMElement[]> {
  const errors: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'KitDuVoyageur/1.0 (https://lekitduvoyageur.fr)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        errors.push(`${endpoint}: HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const data = await res.json();
      if (!data?.elements || !Array.isArray(data.elements)) {
        errors.push(`${endpoint}: invalid response`);
        continue;
      }
      console.log(`[fetch-osm-trails] Overpass OK via ${endpoint}: ${data.elements.length} elements`);
      return data.elements as OSMElement[];
    } catch (err) {
      clearTimeout(timer);
      errors.push(`${endpoint}: ${err instanceof Error ? err.message : String(err)}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`Overpass unreachable after all endpoints: ${errors.join(' | ')}`);
}

// ── Reconstruct GPS from relation members ─────────────────────
function reconstructGeometry(
  members: Array<{ type: string; ref: number; role: string }>,
  wayMap: Map<number, OSMNode[]>
): OSMNode[] {
  const wayMembers = members.filter((m) => m.type === 'way');
  if (wayMembers.length === 0) return [];
  const segments: OSMNode[][] = [];
  for (const m of wayMembers) {
    const geom = wayMap.get(m.ref);
    if (geom && geom.length >= 2) segments.push(geom);
  }
  if (segments.length === 0) return [];
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

// ── GPS validation ────────────────────────────────────────────
function validateGPS(coords: number[][], minPoints: number): boolean {
  if (coords.length < minPoints) return false;
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2) return false;
    if (isNaN(c[0]) || isNaN(c[1])) return false;
    if (c[0] < -180 || c[0] > 180 || c[1] < -90 || c[1] > 90) return false;
  }
  const first = coords[0];
  const last = coords[coords.length - 1];
  const straightDist = haversineKm(first[1], first[0], last[1], last[0]);
  let pathLen = 0;
  for (let i = 1; i < coords.length; i++) {
    pathLen += haversineKm(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
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

// ── Main fetch function ───────────────────────────────────────
async function fetchTrailsForZone(
  bbox: BBox,
  country: string,
  limit = 80
): Promise<{
  trails: Record<string, unknown>[];
  stats: { ways: number; relations: number; valid: number; rejected: number };
}> {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  const waysQuery = `
[out:json][timeout:30];
(
  way["highway"="path"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="track"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="footway"]["access"!="private"]["access"!="no"](${bboxStr});
  way["highway"="bridleway"]["access"!="private"]["access"!="no"](${bboxStr});
);
out body geom ${limit};
`;

  const relationsQuery = `
[out:json][timeout:30];
(
  relation["route"="hiking"]["name"](${bboxStr});
  relation["route"="foot"]["name"](${bboxStr});
);
out body;
>;
out body geom;
`;

  const [waysResult, relationsResult] = await Promise.allSettled([
    queryOverpass(waysQuery, 35000),
    queryOverpass(relationsQuery, 35000),
  ]);

  const wayMap = new Map<number, OSMNode[]>();
  const ways: OSMElement[] = [];
  const relations: OSMElement[] = [];

  if (waysResult.status === 'fulfilled') {
    for (const el of waysResult.value) {
      if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
        ways.push(el);
        wayMap.set(el.id, el.geometry);
      }
    }
  }

  if (relationsResult.status === 'fulfilled') {
    for (const el of relationsResult.value) {
      if (el.type === 'relation') {
        relations.push(el);
      } else if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
        wayMap.set(el.id, el.geometry);
      }
    }
  }

  const trails: Record<string, unknown>[] = [];
  let rejected = 0;
  const MIN_POINTS = 20;

  // Process ways
  for (const way of ways) {
    const tags = way.tags || {};
    const geom = way.geometry!;
    const coords = geom.map((pt) => [pt.lon, pt.lat]);
    if (!validateGPS(coords, MIN_POINTS)) {
      rejected++;
      continue;
    }
    const distKm = calcDistance(geom);
    const startLat = geom[0].lat;
    const startLng = geom[0].lon;
    const endLat = geom[geom.length - 1].lat;
    const endLng = geom[geom.length - 1].lon;
    const elevGain = tags['ascent'] ? parseInt(tags['ascent']) : null;
    const durationHours = distKm
      ? Math.round((distKm / 3.5 + (elevGain || 0) / 300) * 10) / 10
      : null;

    trails.push({
      osm_id: way.id,
      name: tags['name'] || tags['ref'] || `Sentier OSM ${way.id}`,
      description: tags['description'] || null,
      difficulty: getDifficulty(tags, distKm),
      distance_km: distKm,
      elevation_gain_m: elevGain,
      duration_hours: durationHours,
      region: tags['addr:state'] || tags['addr:region'] || null,
      country,
      geojson: { type: 'LineString', coordinates: coords },
      gps_points_count: coords.length,
      start_lat: startLat,
      start_lng: startLng,
      end_lat: endLat,
      end_lng: endLng,
      is_loop: haversineKm(startLat, startLng, endLat, endLng) < 0.1,
      is_verified: true,
      source: 'overpass',
      tags: [tags['highway'] || 'path', tags['surface'] || '', tags['sac_scale'] || ''].filter(Boolean),
    });
  }

  // Process relations
  for (const rel of relations) {
    const tags = rel.tags || {};
    if (!rel.members) continue;
    const geom = reconstructGeometry(rel.members, wayMap);
    if (geom.length < MIN_POINTS) {
      rejected++;
      continue;
    }
    const coords = geom.map((pt) => [pt.lon, pt.lat]);
    if (!validateGPS(coords, MIN_POINTS)) {
      rejected++;
      continue;
    }
    const distKm = calcDistance(geom);
    const startLat = geom[0].lat;
    const startLng = geom[0].lon;
    const endLat = geom[geom.length - 1].lat;
    const endLng = geom[geom.length - 1].lon;
    const elevGain = tags['ascent'] ? parseInt(tags['ascent']) : null;
    const durationHours = distKm
      ? Math.round((distKm / 3.5 + (elevGain || 0) / 300) * 10) / 10
      : null;

    trails.push({
      osm_id: rel.id,
      name: tags['name'] || tags['ref'] || `Route OSM ${rel.id}`,
      description: tags['description'] || null,
      difficulty: getDifficulty(tags, distKm),
      distance_km: distKm,
      elevation_gain_m: elevGain,
      duration_hours: durationHours,
      region: tags['addr:state'] || tags['addr:region'] || null,
      country,
      geojson: { type: 'LineString', coordinates: coords },
      gps_points_count: coords.length,
      start_lat: startLat,
      start_lng: startLng,
      end_lat: endLat,
      end_lng: endLng,
      is_loop: haversineKm(startLat, startLng, endLat, endLng) < 0.1,
      is_verified: true,
      source: 'overpass',
      tags: [tags['route'] || 'hiking', tags['network'] || '', tags['operator'] || ''].filter(Boolean),
    });
  }

  return {
    trails,
    stats: { ways: ways.length, relations: relations.length, valid: trails.length, rejected },
  };
}

// ── Edge Function handler ─────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GET: list available zones + current DB stats
    if (req.method === 'GET') {
      const { count } = await supabase
        .from('hiking_trails')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'overpass');

      return new Response(
        JSON.stringify({
          trails_from_osm: count ?? 0,
          available_zones: Object.entries(SYNC_ZONES).map(([key, z]) => ({
            key,
            label: z.label,
            country: z.country,
            bbox: z.bbox,
          })),
          usage: 'POST with { "zone": "chamonix" } or { "bbox": {...}, "country": "France", "label": "..." }',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: fetch from Overpass and seed Supabase
    const body = await req.json().catch(() => ({}));
    const zoneName = body.zone as string | undefined;
    const customBbox = body.bbox as BBox | undefined;

    let bbox: BBox;
    let country: string;
    let label: string;

    if (customBbox) {
      bbox = customBbox;
      country = body.country || 'Unknown';
      label = body.label || `Zone ${customBbox.south.toFixed(1)},${customBbox.west.toFixed(1)}`;
    } else if (zoneName && SYNC_ZONES[zoneName]) {
      const zone = SYNC_ZONES[zoneName];
      bbox = zone.bbox;
      country = zone.country;
      label = zone.label;
    } else {
      // Default: Chamonix
      const zone = SYNC_ZONES.chamonix;
      bbox = zone.bbox;
      country = zone.country;
      label = zone.label;
    }

    console.log(`[fetch-osm-trails] Fetching "${label}" bbox=${JSON.stringify(bbox)}`);

    const { trails, stats } = await fetchTrailsForZone(bbox, country, 100);

    if (trails.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          label,
          stats,
          message: 'Aucun sentier GPS valide trouvé pour cette zone.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert into hiking_trails by osm_id
    const { data: upserted, error: upsertErr } = await supabase
      .from('hiking_trails')
      .upsert(trails, { onConflict: 'osm_id', ignoreDuplicates: false })
      .select('id');

    if (upsertErr) {
      console.error('[fetch-osm-trails] Upsert error:', upsertErr);
      return new Response(
        JSON.stringify({
          success: false,
          label,
          error: upsertErr.message,
          trails_prepared: trails.length,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const inserted = upserted?.length ?? trails.length;
    console.log(`[fetch-osm-trails] Stored ${inserted} trails for "${label}"`);

    return new Response(
      JSON.stringify({
        success: true,
        label,
        bbox,
        trails_inserted: inserted,
        stats: {
          ways_fetched: stats.ways,
          relations_fetched: stats.relations,
          valid_gps_trails: stats.valid,
          rejected_insufficient_gps: stats.rejected,
        },
        message: `✅ ${inserted} sentiers GPS réels importés pour "${label}"`,
        sample: trails.slice(0, 3).map((t) => ({
          name: t.name,
          gps_points: t.gps_points_count,
          distance_km: t.distance_km,
          difficulty: t.difficulty,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[fetch-osm-trails] Fatal error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        hint: 'Overpass API may be temporarily unavailable. Try again in a few minutes.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
