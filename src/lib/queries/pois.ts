import { createClient } from '@/lib/supabase/server';

export interface UnifiedPOI {
  id: string;
  name: string;
  category: 'refuge' | 'summit' | 'water' | 'viewpoint' | 'waterfall' | 'col' | 'camping';
  lat: number;
  lng: number;
  altitude_m?: number | null;
  details?: string | null;
  description?: string | null;
  source: 'outdoor_points' | 'map_refuges' | 'map_summits' | 'map_water_points' | 'trail_pois';
  is_verified?: boolean;
  region?: string | null;
  country?: string | null;
  massif?: string | null;
  capacity?: number | null;
  price_per_night?: number | null;
  is_staffed?: boolean | null;
  is_potable?: boolean | null;
  water_type?: string | null;
  phone?: string | null;
  website?: string | null;
  open_months?: string[] | null;
  tags?: Record<string, any> | null;
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
 * Récupère l'ensemble des POI consolidés avec toutes leurs informations riches
 */
export async function getPois(options: GetPoisOptions = {}): Promise<UnifiedPOI[]> {
  const { category = null, minLat = null, maxLat = null, minLng = null, maxLng = null, limit = 2500 } = options;

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
    supabase.from('outdoor_points').select('id, name, category, lat, lng, altitude, description, region, country, metadata'),
    supabase.from('map_refuges').select('id, name, description, lat, lng, altitude_m, capacity, is_staffed, open_months, phone, website, price_per_night, region, country, tags'),
    supabase.from('map_summits').select('id, name, description, lat, lng, altitude_m, prominence_m, difficulty, massif, region, country, tags'),
    supabase.from('map_water_points').select('id, name, description, lat, lng, altitude_m, water_type, is_potable, is_seasonal, flow_rate, region, country'),
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

      const cat = normalizeCategory(p.category);
      const meta = (p.metadata || {}) as Record<string, any>;

      allPois.push({
        id: `outdoor-${p.id}`,
        name: p.name || 'Point d\'intérêt',
        category: cat,
        lat,
        lng,
        altitude_m: p.altitude != null ? Number(p.altitude) : null,
        description: p.description || null,
        details: p.description || (p.altitude ? `${p.altitude} m d'altitude` : null),
        region: p.region || null,
        country: p.country || null,
        massif: meta.massif || null,
        phone: meta.phone || null,
        website: meta.website || null,
        capacity: meta.capacity ? Number(meta.capacity) : null,
        is_potable: meta.is_potable !== undefined ? Boolean(meta.is_potable) : cat === 'water' ? true : null,
        tags: meta,
        source: 'outdoor_points',
        is_verified: true,
      });
    }
  }

  // 2. map_refuges (Détails complets de refuges)
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
      const staffStr = r.is_staffed ? 'Gardé' : 'Non gardé / libre';
      const priceStr = r.price_per_night ? `${r.price_per_night} €/nuit` : '';
      const details = [capacityStr, staffStr, priceStr].filter(Boolean).join(' · ');

      allPois.push({
        id: `refuge-${r.id}`,
        name: r.name || 'Refuge',
        category: 'refuge',
        lat,
        lng,
        altitude_m: r.altitude_m != null ? Number(r.altitude_m) : null,
        description: r.description || null,
        details: details ? `🏡 ${details}` : 'Refuge de montagne',
        capacity: r.capacity ? Number(r.capacity) : null,
        price_per_night: r.price_per_night ? Number(r.price_per_night) : null,
        is_staffed: r.is_staffed,
        open_months: r.open_months || null,
        phone: r.phone || null,
        website: r.website || null,
        region: r.region || null,
        country: r.country || null,
        tags: r.tags ? { tags: r.tags } : null,
        source: 'map_refuges',
        is_verified: true,
      });
    }
  }

  // 3. map_summits (Détails de sommets)
  if (summitsRes.data) {
    for (const s of summitsRes.data) {
      if (s.lat == null || s.lng == null) continue;
      const lat = Number(s.lat);
      const lng = Number(s.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
      if (seenCoordinates.has(key)) continue;
      seenCoordinates.add(key);

      const altStr = s.altitude_m ? `${s.altitude_m} m` : '';
      const massifStr = s.massif || '';
      const diffStr = s.difficulty ? `Accès ${s.difficulty}` : '';
      const details = [altStr, massifStr, diffStr].filter(Boolean).join(' · ');

      allPois.push({
        id: `summit-${s.id}`,
        name: s.name || 'Sommet',
        category: 'summit',
        lat,
        lng,
        altitude_m: s.altitude_m != null ? Number(s.altitude_m) : null,
        description: s.description || null,
        details: details ? `⛰️ ${details}` : 'Sommet alpin',
        massif: s.massif || null,
        region: s.region || null,
        country: s.country || null,
        source: 'map_summits',
        is_verified: true,
      });
    }
  }

  // 4. map_water_points (Détails points d'eau)
  if (waterRes.data) {
    for (const w of waterRes.data) {
      if (w.lat == null || w.lng == null) continue;
      const lat = Number(w.lat);
      const lng = Number(w.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
      if (seenCoordinates.has(key)) continue;
      seenCoordinates.add(key);

      const potableStr = w.is_potable ? 'Eau potable vérifiée ✅' : 'Eau non traitée / à filtrer ⚠️';
      const typeStr = w.water_type ? `Type : ${w.water_type}` : '';
      const flowStr = w.flow_rate ? `Débit : ${w.flow_rate}` : '';
      const details = [potableStr, typeStr, flowStr].filter(Boolean).join(' · ');

      allPois.push({
        id: `water-${w.id}`,
        name: w.name || 'Point d\'eau',
        category: 'water',
        lat,
        lng,
        altitude_m: w.altitude_m != null ? Number(w.altitude_m) : null,
        description: w.description || null,
        details: `💧 ${details}`,
        is_potable: w.is_potable,
        water_type: w.water_type || null,
        region: w.region || null,
        country: w.country || null,
        source: 'map_water_points',
        is_verified: true,
      });
    }
  }

  // 5. trail_pois (PostGIS points)
  const { data: trailPoisData } = await supabase
    .from('trail_pois')
    .select('id, name, category, description, tags, geom')
    .not('geom', 'is', null)
    .limit(1500);

  if (trailPoisData) {
    for (const tp of trailPoisData) {
      let lat: number | null = null;
      let lng: number | null = null;

      if (tp.geom && typeof tp.geom === 'object' && 'coordinates' in (tp.geom as any)) {
        const coords = (tp.geom as any).coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          lng = Number(coords[0]);
          lat = Number(coords[1]);
        }
      }

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
          const defaultName = cat === 'refuge' ? 'Refuge / Abri' : cat === 'summit' ? 'Sommet' : cat === 'water' ? 'Point d\'eau' : cat === 'viewpoint' ? 'Panorama' : 'Point d\'intérêt';
          const tags = (tp.tags || {}) as Record<string, any>;
          const ele = tags.ele ? Number(tags.ele) : null;
          const potable = tags.drinking_water === 'yes' ? true : tags.drinking_water === 'no' ? false : null;

          allPois.push({
            id: `trailpoi-${tp.id}`,
            name: tp.name || defaultName,
            category: cat,
            lat,
            lng,
            altitude_m: ele,
            description: tp.description || tags.description || null,
            details: tp.description || tags.description || (ele ? `${ele} m d'altitude` : tags.tourism || tags.natural || tags.amenity || null),
            is_potable: potable,
            phone: tags.phone || tags['contact:phone'] || null,
            website: tags.website || tags['contact:website'] || null,
            capacity: tags.capacity ? Number(tags.capacity) : null,
            tags,
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
