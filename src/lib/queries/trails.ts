import { createClient } from "@/lib/supabase/server";
import type { MapTrail } from "@/components/explorer/types";

export interface GetTrailsOptions {
  minDist?: number;
  maxDist?: number | null;
  difficulty?: string | null;
  search?: string | null;
  includeShort?: boolean;
  minLat?: number | null;
  maxLat?: number | null;
  minLng?: number | null;
  maxLng?: number | null;
  limit?: number | null;
}

// ── In-Memory Cache (TTL: 60 secondes) ──────────────────────────────────────────
interface CacheEntry {
  data: MapTrail[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

/**
 * Charge et déduplique les randonnées de manière ultra-rapide (1 seule requête SQL).
 * Intègre un cache en mémoire pour des réponses SSR & API instantanées (< 5ms).
 */
export async function getTrails(options: GetTrailsOptions = {}): Promise<MapTrail[]> {
  const {
    minDist = 2.0,
    maxDist = null,
    difficulty = null,
    search = null,
    includeShort = false,
    minLat = null,
    maxLat = null,
    minLng = null,
    maxLng = null,
    limit = 300,
  } = options;

  const cacheKey = JSON.stringify({ minDist, maxDist, difficulty, search, includeShort, minLat, maxLat, minLng, maxLng, limit });
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  const supabase = await createClient();

  let query = supabase
    .from("explore_trails")
    .select(
      "id, name, start_lat, start_lng, distance_km, duration_hours, difficulty, elevation_gain, adventure_score, nature_score, panorama_score, ref, network, terrain_type, family_friendly, season, ai_description"
    );

  if (!includeShort && minDist > 0) {
    query = query.gte("distance_km", minDist);
  }

  if (maxDist !== null && !isNaN(maxDist)) {
    query = query.lte("distance_km", maxDist);
  }

  if (difficulty && difficulty !== "all") {
    query = query.ilike("difficulty", `%${difficulty}%`);
  }

  if (search && search.trim() !== "") {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  // Filtrage spatial Viewport (Bounding Box)
  if (
    minLat !== null &&
    maxLat !== null &&
    minLng !== null &&
    maxLng !== null &&
    !isNaN(minLat) &&
    !isNaN(maxLat) &&
    !isNaN(minLng) &&
    !isNaN(maxLng)
  ) {
    query = query
      .gte("start_lat", minLat)
      .lte("start_lat", maxLat)
      .gte("start_lng", minLng)
      .lte("start_lng", maxLng);
  }

  query = query.order("distance_km", { ascending: false });

  if (limit && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getTrails] Supabase error:", error);
    return cached ? cached.data : [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Deduplication logic: Keep the best trail for duplicate start coordinates (~100m)
  const seenStartCoords = new Set<string>();
  const deduplicated: MapTrail[] = [];

  for (const t of data) {
    const latKey = t.start_lat !== null && t.start_lat !== undefined ? Number(t.start_lat).toFixed(3) : "null";
    const lngKey = t.start_lng !== null && t.start_lng !== undefined ? Number(t.start_lng).toFixed(3) : "null";
    const coordKey = `${latKey}_${lngKey}`;

    if (coordKey !== "null_null" && seenStartCoords.has(coordKey)) {
      continue;
    }

    if (coordKey !== "null_null") {
      seenStartCoords.add(coordKey);
    }

    deduplicated.push({
      id: String(t.id),
      name: t.name || `Randonnée #${t.id}`,
      lat: t.start_lat !== undefined && t.start_lat !== null ? Number(t.start_lat) : null,
      lng: t.start_lng !== undefined && t.start_lng !== null ? Number(t.start_lng) : null,
      distance_km: t.distance_km != null ? Number(t.distance_km) : null,
      duration_hours: t.duration_hours != null ? Number(t.duration_hours) : null,
      difficulty: t.difficulty != null ? String(t.difficulty) : null,
      elevation_gain: t.elevation_gain != null ? Number(t.elevation_gain) : null,
      terrain_type: t.terrain_type != null ? String(t.terrain_type) : null,
      family_friendly: t.family_friendly ?? null,
      season: t.season != null ? String(t.season) : null,
      ai_description: t.ai_description != null ? String(t.ai_description) : null,
      adventure_score: t.adventure_score != null ? Number(t.adventure_score) : null,
      nature_score: t.nature_score != null ? Number(t.nature_score) : null,
      panorama_score: t.panorama_score != null ? Number(t.panorama_score) : null,
      geojson: null,
    });
  }

  // Stocker dans le cache
  cache.set(cacheKey, { data: deduplicated, timestamp: now });

  return deduplicated;
}
