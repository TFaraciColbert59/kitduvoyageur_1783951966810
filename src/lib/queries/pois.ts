import { createClient } from '@/lib/supabase/server';

export interface UnifiedPOI {
  id: string;
  name: string;
  category: 'refuge' | 'summit' | 'water' | 'viewpoint' | 'waterfall' | 'col' | 'camping';
  lat: number;
  lng: number;
  altitude_m?: number | null;
  details?: string | null;
  source: 'outdoor_points' | 'map_refuges' | 'map_summits' | 'map_water_points' | 'trail_pois';
  is_verified?: boolean;
}

export interface GetPoisOptions {
  category?: string | null;
  minLat?: number | null;
  maxLat?: number | null;
  minLng?: number | null;
  maxLng?: number | null;
  limit?: number | null;
}

// In-Memory Cache (TTL: 60 secondes)
interface CacheEntry {
  data: UnifiedPOI[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function normalizeCategory(cat: string | null | undefined): UnifiedPOI['category'] {
  if (!cat) return 'viewpoint';
  const c = cat.toLowerCase();
  if (c.includes('refuge') || c.includes('shelter') || c.includes('cabane') || c.includes('gite')) return 'refuge';
  if (c.includes('summit') || c.includes('peak') || c.includes('sommet') || c.includes('mont') || c.includes('pic')) return 'summit';
  if (c.includes('water') || c.includes('spring') || c.includes('source') || c.includes('fontaine') || c.includes('eau')) return 'water';
  if (c.includes('view') || c.includes('point de vue') || c.includes('panorama') || c.includes('belvedere')) return 'viewpoint';
  if (c.includes('waterfall') || c.includes('cascade')) return 'waterfall';
  if (c.includes('col') || c.includes('pass')) return 'col';
  if (c.includes('camp') || c.includes('bivouac')) return 'camping';
  return 'viewpoint';
}

/**
 * Récupère l'ensemble des POI depuis outdoor_points, map_refuges, map_summits, map_water_points et trail_pois
 */
export async function getPois(options: GetPoisOptions = {}): Promise<UnifiedPOI[]> {
  const { category = null, minLat = null, maxLat = null, minLng = null, maxLng = null, limit = 2000 } = options;

  const cacheKey = JSON.stringify({ category, minLat, maxLat, minLng, maxLng, limit });
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const supabase = await createClient();

  const [
    outdoorRes,
    refugesRes,
    summitsRes,
    waterRes,
  ] = await Promise.all([
    supabase.from('outdoor_points').select('id, name, category, lat, lng, altitude, description'),
    supabase.from('map_refuges').select('id, name, lat, lng, altitude_m, capacity, price_per_night'),
    supabase.from('map_summits').select('id, name, lat, lng, altitude_m, massif'),
    supabase.from('map_water_points').select('id, name, lat, lng, altitude_m, is_potable'),
  ]);

  const allPois: UnifiedPOI[] = [];
  const seenCoordinates = new Set<string>();

  // 1. outdoor_points (Haute qualité)
  if (outdoorRes.data) {
    for (const p of outdoorRes.data) {
      if (p.lat == null || p.lng == null) continue;
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
      seenCoordinates.add(key);

      allPois.push({
        id: `outdoor-${p.id}`,
        name: p.name || 'Point d\'intérêt',
        category: normalizeCategory(p.category),
        lat,
        lng,
        altitude_m: p.altitude != null ? Number(p.altitude) : null,
        details: p.description || null,
        source: 'outdoor_points',
        is_verified: true,
      });
    }
  }

  // 2. map_refuges
  if (refugesRes.data) {
    for (const r of refugesRes.data) {
      if (r.lat == null || r.lng == null) continue;
      const lat = Number(r.lat);
      const lng = Number(r.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
      if (seenCoordinates.has(key)) continue;
      seenCoordinates.add(key);

      const capacityStr = r.capacity ? `${r.capacity} lits` : 'Ouvert';
      const priceStr = r.price_per_night ? ` · ${r.price_per_night}€/nuit` : '';

      allPois.push({
        id: `refuge-${r.id}`,
        name: r.name || 'Refuge',
        category: 'refuge',
        lat,
        lng,
        altitude_m: r.altitude_m != null ? Number(r.altitude_m) : null,
        details: `🏡 Refuge · ${capacityStr}${priceStr}`,
        source: 'map_refuges',
        is_verified: true,
      });
    }
  }

  // 3. map_summits
  if (summitsRes.data) {
    for (const s of summitsRes.data) {
      if (s.lat == null || s.lng == null) continue;
      const lat = Number(s.lat);
      const lng = Number(s.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
      if (seenCoordinates.has(key)) continue;
      seenCoordinates.add(key);

      const altStr = s.altitude_m ? `${s.altitude_m}m` : '';
      const massifStr = s.massif ? ` · ${s.massif}` : '';

      allPois.push({
        id: `summit-${s.id}`,
        name: s.name || 'Sommet',
        category: 'summit',
        lat,
        lng,
        altitude_m: s.altitude_m != null ? Number(s.altitude_m) : null,
        details: `⛰️ Sommet · ${altStr}${massifStr}`,
        source: 'map_summits',
        is_verified: true,
      });
    }
  }

  // 4. map_water_points
  if (waterRes.data) {
    for (const w of waterRes.data) {
      if (w.lat == null || w.lng == null) continue;
      const lat = Number(w.lat);
      const lng = Number(w.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
      if (seenCoordinates.has(key)) continue;
      seenCoordinates.add(key);

      allPois.push({
        id: `water-${w.id}`,
        name: w.name || 'Point d\'eau',
        category: 'water',
        lat,
        lng,
        altitude_m: w.altitude_m != null ? Number(w.altitude_m) : null,
        details: `💧 Point d'eau · ${w.is_potable ? 'Eau potable ✅' : 'Non potable ⚠️'}`,
        source: 'map_water_points',
        is_verified: true,
      });
    }
  }

  // 5. trail_pois (PostGIS points)
  // Fetch trail_pois with lat/lng
  const { data: trailPoisData } = await supabase
    .from('trail_pois')
    .select('id, name, category, description, tags, geom')
    .not('geom', 'is', null)
    .limit(1000);

  if (trailPoisData) {
    for (const tp of trailPoisData) {
      let lat: number | null = null;
      let lng: number | null = null;

      // Extract geometry coords from GeoJSON / object if present
      if (tp.geom && typeof tp.geom === 'object' && 'coordinates' in (tp.geom as any)) {
        const coords = (tp.geom as any).coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          lng = Number(coords[0]);
          lat = Number(coords[1]);
        }
      }

      // If lat/lng could not be read from object, try parsing if string
      if ((lat == null || lng == null) && typeof tp.geom === 'string') {
        try {
          const parsed = JSON.parse(tp.geom);
          if (parsed?.coordinates) {
            lng = Number(parsed.coordinates[0]);
            lat = Number(parsed.coordinates[1]);
          }
        } catch {
          // not json
        }
      }

      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
        if (!seenCoordinates.has(key)) {
          seenCoordinates.add(key);
          const cat = normalizeCategory(tp.category);
          const defaultName = cat === 'refuge' ? 'Refuge / Abri' : cat === 'summit' ? 'Sommet' : cat === 'water' ? 'Point d\'eau' : cat === 'viewpoint' ? 'Point de vue' : 'Point d\'intérêt';
          const tags = tp.tags as Record<string, any> | null;
          const ele = tags?.ele ? Number(tags.ele) : null;

          allPois.push({
            id: `trailpoi-${tp.id}`,
            name: tp.name || defaultName,
            category: cat,
            lat,
            lng,
            altitude_m: ele,
            details: tp.description || tags?.description || (ele ? `${ele}m d'altitude` : null),
            source: 'trail_pois',
            is_verified: false,
          });
        }
      }
    }
  }

  // Filter by options
  let filtered = allPois;

  if (category && category !== 'all') {
    const norm = normalizeCategory(category);
    filtered = filtered.filter((p) => p.category === norm);
  }

  if (minLat != null) filtered = filtered.filter((p) => p.lat >= minLat);
  if (maxLat != null) filtered = filtered.filter((p) => p.lat <= maxLat);
  if (minLng != null) filtered = filtered.filter((p) => p.lng >= minLng);
  if (maxLng != null) filtered = filtered.filter((p) => p.lng <= maxLng);

  if (limit != null && filtered.length > limit) {
    filtered = filtered.slice(0, limit);
  }

  cache.set(cacheKey, { data: filtered, timestamp: now });
  return filtered;
}
