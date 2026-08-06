export type FilterState = {
  difficulty: string[];
  duration: string[];
  terrain_type: string[];
  family_friendly: boolean | null;
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
  // Extended fields for refuges/shelters
  region?: string | null;
  altitude_m?: number | null;
  capacity?: number | null;
  is_staffed?: boolean | null;
  has_meals?: boolean | null;
  open_months?: string[] | null;
  price_per_night?: number | null;
  has_blankets?: boolean | null;
  description?: string | null;
}

// Keep MapRefuge as alias for backwards compat
export type MapRefuge = MapTrail;

export const DEFAULT_TRAIL_IMAGES = [
  'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=600&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
  'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
  'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=600&q=80',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80',
  'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=600&q=80',
];

export function getTrailImage(id: string): string {
  if (!id) return DEFAULT_TRAIL_IMAGES[0];
  const sum = String(id).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return DEFAULT_TRAIL_IMAGES[sum % DEFAULT_TRAIL_IMAGES.length];
}

export function getDifficultyColor(difficulty: string | null | undefined): string {
  switch ((difficulty || '').toLowerCase()) {
    case 'facile': return '#22c55e';
    case 'modérée':
    case 'moderee':
    case 'moderate': return '#f97316';
    case 'difficile':
    case 'difficult': return '#ef4444';
    case 'expert':
    case 'très difficile': return '#7c3aed';
    default: return '#6b7280';
  }
}

export function getDifficultyLabel(difficulty: string | null | undefined): string {
  return difficulty || 'Randonnée';
}

export function formatDuration(hours: number | null | undefined): string {
  if (!hours) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatDistance(km: number | null | undefined): string {
  if (!km) return '—';
  return `${km.toFixed(1)} km`;
}