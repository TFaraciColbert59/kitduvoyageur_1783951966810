export type FilterState = {
  difficulty: string[];
  duration: string[];
  terrain_type: string[];
  type?: string[];
  ambiance?: string[];
  family_friendly: boolean | null;
  [key: string]: any;
};

export const DEFAULT_FILTERS: FilterState = {
  difficulty: [],
  duration: [],
  terrain_type: [],
  family_friendly: null,
};

export interface MapTrail {
  id: string;
  name: string;
  lat: number | null;  // mapped from start_lat
  lng: number | null;  // mapped from start_lng
  distance_km?: number | null;
  duration_hours?: number | null;
  difficulty?: string | null;
  elevation_gain?: number | null;
  geojson?: any | null;
  adventure_score?: number | null;
  nature_score?: number | null;
  panorama_score?: number | null;
  ref?: string | null;
  network?: string | null;
  terrain_type?: string | null;
  family_friendly?: boolean | null;
  season?: string | null;
  ai_description?: string | null;
  region?: string | null;
  altitude_m?: number | null;
  capacity?: number | null;
  is_staffed?: boolean | null;
  has_meals?: boolean | null;
  open_months?: string[] | null;
  price_per_night?: number | null;
  has_blankets?: boolean | null;
  description?: string | null;
  image_url?: string | null;
  operator?: string | null;
  symbol?: string | null;
  from?: string | null;
  to?: string | null;
  roundtrip?: boolean | null;
}

// Keep MapRefuge as alias for backwards compat
export type MapRefuge = MapTrail;

export const DEFAULT_TRAIL_IMAGES = [
  'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=800&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=800&q=80',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
  'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80',
];

const FOREST_IMAGES = [
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
  'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
];

const COASTAL_IMAGES = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
];

const WATER_IMAGES = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
  'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80',
];

export function getTrailImage(id: string, name?: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('bois') || n.includes('foret') || n.includes('forêt') || n.includes('sous-bois')) {
    const idx = Math.abs(String(id).split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % FOREST_IMAGES.length;
    return FOREST_IMAGES[idx];
  }
  if (n.includes('mer') || n.includes('plage') || n.includes('cote') || n.includes('côte') || n.includes('littoral') || n.includes('douaniers')) {
    const idx = Math.abs(String(id).split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % COASTAL_IMAGES.length;
    return COASTAL_IMAGES[idx];
  }
  if (n.includes('lac') || n.includes('cascade') || n.includes('riviere') || n.includes('rivière') || n.includes('torrent')) {
    const idx = Math.abs(String(id).split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % WATER_IMAGES.length;
    return WATER_IMAGES[idx];
  }
  if (!id) return DEFAULT_TRAIL_IMAGES[0];
  const sum = String(id).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return DEFAULT_TRAIL_IMAGES[Math.abs(sum) % DEFAULT_TRAIL_IMAGES.length];
}

/**
 * Estimation de la durée de randonnée selon la formule de Tobler / règle de Naismith :
 * - 4.0 km/h sur le plat
 * - +1 heure par tranche de 300 mètres de dénivelé positif
 */
export function estimateHikingDurationHours(
  distanceKm: number | null | undefined,
  elevationGainM?: number | null | undefined
): number | null {
  if (!distanceKm || distanceKm <= 0) return null;
  const flatHours = distanceKm / 4.0;
  const climbHours = elevationGainM && elevationGainM > 0 ? elevationGainM / 300 : 0;
  return Math.round((flatHours + climbHours) * 10) / 10;
}

/**
 * Validation stricte d'une paire lat/lng avant toute création Leaflet.
 * Rejette null/undefined/''/NaN/Infinity (Number(null)===0, Number('')===0
 * créeraient un marqueur fantôme à (0,0)) ET les coordonnées hors bornes
 * géographiques (lat -90..90, lng -180..180).
 */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  if (lat == null || lng == null) return false;
  if (lat === '' || lng === '' || lat === 'NaN' || lng === 'NaN') return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isNaN(nLat) || Number.isNaN(nLng)) return false;
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false;
  return nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

export function toValidLatLng(lat: unknown, lng: unknown): [number, number] | null {
  if (!isValidLatLng(lat, lng)) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return [nLat, nLng];
}

/**
 * Sanitisation centralisée d'un GeoJSON LineString/MultiLineString AVANT toute
 * opération Leaflet (L.geoJSON, getBounds). Supprime les points dont les
 * coordonnées sont invalides (null, NaN, Infinity, hors bornes géographiques)
 * et les lignes devenues vides. Retourne null si rien de valide ne subsiste.
 */
export function sanitizeGeoJSON(geojson: unknown): Record<string, unknown> | null {
  if (!geojson || typeof geojson !== 'object') return null;
  let g = geojson as any;
  if (g.type === 'Feature' && g.geometry) {
    g = g.geometry;
  }
  if (g.type === 'FeatureCollection' && Array.isArray(g.features)) {
    const lines: number[][][] = [];
    for (const feat of g.features) {
      const sub = sanitizeGeoJSON(feat?.geometry || feat);
      if (sub?.type === 'LineString' && Array.isArray(sub.coordinates)) {
        lines.push(sub.coordinates as number[][]);
      } else if (sub?.type === 'MultiLineString' && Array.isArray(sub.coordinates)) {
        lines.push(...(sub.coordinates as number[][][]));
      }
    }
    return lines.length > 0 ? { type: 'MultiLineString', coordinates: lines } : null;
  }

  if (g.type !== 'LineString' && g.type !== 'MultiLineString') return null;
  if (!Array.isArray(g.coordinates)) return null;

  const clean = (line: unknown): number[][] | null => {
    if (!Array.isArray(line) || line.length === 0) return null;
    const out: number[][] = [];
    for (const pt of line) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      out.push([lng, lat]);
    }
    return out.length >= 2 ? out : null;
  };

  if (g.type === 'LineString') {
    const cleaned = clean(g.coordinates);
    return cleaned ? { type: 'LineString', coordinates: cleaned } : null;
  }

  const cleanedLines: number[][][] = [];
  for (const line of g.coordinates as unknown[]) {
    const c = clean(line);
    if (c) cleanedLines.push(c);
  }
  return cleanedLines.length > 0
    ? { type: 'MultiLineString', coordinates: cleanedLines }
    : null;
}

export function getDifficultyColor(difficulty: string | null | undefined): string {
  switch ((difficulty || '').toLowerCase()) {
    case 'facile': return '#5B7F55';
    case 'modérée':
    case 'moderee':
    case 'moderate': return '#C89A3B';
    case 'difficile':
    case 'difficult': return '#A8443A';
    case 'expert':
    case 'très difficile': return '#17402C';
    default: return '#5A7064';
  }
}

export function getDifficultyLabel(difficulty: string | null | undefined): string {
  return difficulty || 'Non renseigné';
}

export function formatDuration(hours: number | null | undefined): string {
  if (!hours || hours <= 0) return 'Non renseigné';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours >= 24) {
    const d = Math.floor(hours / 24);
    const remH = Math.round(hours % 24);
    return remH > 0 ? `${d}j ${remH}h` : `${d}j`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h >= 10) return `${Math.round(hours)}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function formatDistance(km: number | null | undefined): string {
  if (!km) return '—';
  return `${km.toFixed(1)} km`;
}