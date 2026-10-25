/**
 * Domaine pur « sentier → activité » (Task 2).
 *
 * Dérive le brief français envoyé à `runAutoGenPipeline`, mappe la difficulté
 * `trail_metadata` vers le vocabulaire `trips.difficulty`, échantillonne la
 * géométrie GeoJSON de `get_route_geojson` et borne les points au corridor
 * réel de 3 km. Aucune I/O : testable sans React ni Supabase.
 *
 * Règle dure : aucune valeur inventée — un champ absent de `trail_metadata`
 * n'apparaît pas dans le brief.
 */
import { haversineKm } from '@/components/map/engine/camera';

export interface TrailInput {
  id: number;
  name: string;
  ref?: string | null;
  network?: string | null;
  distanceKm?: number | null;
  geom: { type: string; coordinates: unknown };
}

export interface TrailMetaInput {
  difficulty?: string | null;
  durationHours?: number | null;
  elevationGain?: number | null;
  terrainType?: string | null;
}

export type TrailDifficulty = 'easy' | 'moderate' | 'hard' | 'expert';

export interface TrailPoint {
  lat: number;
  lng: number;
}

export const DEFAULT_MAX_POINTS = 120;
export const DEFAULT_CORRIDOR_KM = 3;

const DIFFICULTY_LABEL_FR: Record<TrailDifficulty, string> = {
  easy: 'facile',
  moderate: 'modérée',
  hard: 'difficile',
  expert: 'expert',
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPresentNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatFrNumber(value: number): string {
  return String(value).replace('.', ',');
}

/** `easy|facile → easy`, `moderate|moyen → moderate`, `hard|difficile → hard`,
 *  `expert → expert`, tout le reste (dont null) → `moderate`. */
export function mapTrailDifficulty(difficulty: string | null | undefined): TrailDifficulty {
  if (typeof difficulty !== 'string') return 'moderate';
  const normalized = difficulty.trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'facile') return 'easy';
  if (
    normalized === 'moderate' ||
    normalized === 'moyen' ||
    normalized === 'modérée' ||
    normalized === 'moderee'
  ) {
    return 'moderate';
  }
  if (normalized === 'hard' || normalized === 'difficile') return 'hard';
  if (normalized === 'expert' || normalized === 'experte') return 'expert';
  return 'moderate';
}

/** Coordonnée GeoJSON exploitable : `[lng, lat]` finis et dans les bornes WGS84. */
function isValidCoordinate(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length < 2) return false;
  const lng = value[0] as unknown;
  const lat = value[1] as unknown;
  return (
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90
  );
}

/** Lignes brutes d'une géométrie GeoJSON (`MultiLineString` réel, `LineString` toléré). */
function extractLines(geom: unknown): unknown[][] {
  if (typeof geom !== 'object' || geom === null) return [];
  const candidate = geom as { type?: unknown; coordinates?: unknown };
  if (candidate.type === 'MultiLineString' && Array.isArray(candidate.coordinates)) {
    return candidate.coordinates.filter((line): line is unknown[] => Array.isArray(line));
  }
  if (candidate.type === 'LineString' && Array.isArray(candidate.coordinates)) {
    return [candidate.coordinates];
  }
  return [];
}

/**
 * Échantillonne régulièrement un tracé GeoJSON à `maxPoints` points (défaut 120),
 * premier et dernier conservés. Les coordonnées invalides sont ignorées
 * silencieusement. Sortie `{ lat, lng }`.
 */
export function samplePolyline(geom: unknown, maxPoints: number = DEFAULT_MAX_POINTS): TrailPoint[] {
  const points: TrailPoint[] = [];
  for (const line of extractLines(geom)) {
    for (const coordinate of line) {
      if (isValidCoordinate(coordinate)) {
        points.push({ lat: coordinate[1], lng: coordinate[0] });
      }
    }
  }

  const cap = Number.isFinite(maxPoints)
    ? Math.max(1, Math.trunc(maxPoints))
    : DEFAULT_MAX_POINTS;
  if (points.length <= cap) return points;
  if (cap === 1) return [points[0]];

  const lastIndex = points.length - 1;
  const sampled: TrailPoint[] = [];
  for (let i = 0; i < cap; i += 1) {
    sampled.push(points[Math.round((i * lastIndex) / (cap - 1))]);
  }
  return sampled;
}

/**
 * Distance haversine minimale (km) du point à la polyligne.
 *
 * Chaque segment est traité par projection équirectangulaire locale :
 * `x = lng × cos(lat_point)`, `y = lat` — approximation suffisante à l'échelle
 * d'un segment (quelques km), qui n'altère pas la distance finale car celle-ci
 * reste la haversine exacte au pied de la perpendiculaire (ou au sommet le plus
 * proche si la projection tombe hors du segment). Polyligne vide → `Infinity`.
 */
export function distanceToCorridorKm(point: TrailPoint, polyline: TrailPoint[]): number {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  if (polyline.length === 1) {
    const only = polyline[0];
    return haversineKm([point.lng, point.lat], [only.lng, only.lat]);
  }

  const cosLat = Math.cos(toRadians(point.lat));
  let closestKm = Number.POSITIVE_INFINITY;

  for (let i = 0; i < polyline.length - 1; i += 1) {
    const start = polyline[i];
    const end = polyline[i + 1];
    const startX = start.lng * cosLat;
    const startY = start.lat;
    const endX = end.lng * cosLat;
    const endY = end.lat;
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSq = segmentX * segmentX + segmentY * segmentY;
    const projected =
      lengthSq === 0
        ? 0
        : ((point.lng * cosLat - startX) * segmentX + (point.lat - startY) * segmentY) / lengthSq;
    const t = Math.min(1, Math.max(0, projected));
    const footLat = start.lat + t * (end.lat - start.lat);
    const footLng = start.lng + t * (end.lng - start.lng);
    const distanceKm = haversineKm([point.lng, point.lat], [footLng, footLat]);
    if (distanceKm < closestKm) closestKm = distanceKm;
  }

  return closestKm;
}

/** Point dans le corridor du tracé (défaut 3 km, borne inclusive). */
export function isWithinCorridor(
  point: TrailPoint,
  polyline: TrailPoint[],
  maxKm: number = DEFAULT_CORRIDOR_KM
): boolean {
  return distanceToCorridorKm(point, polyline) <= maxKm;
}

/**
 * Brief français en texte libre pour `runAutoGenPipeline`. N'inclut que des
 * valeurs réelles : nom (toujours), ref/réseau, distance, durée, difficulté,
 * dénivelé et terrain uniquement quand ils existent.
 */
export function buildTrailRawInput(trail: TrailInput, meta: TrailMetaInput | null): string {
  const lines: string[] = [];

  const name = hasText(trail.name) ? trail.name.trim() : '';
  let header = `Randonnée : ${name}`;
  if (hasText(trail.ref)) header += ` (${trail.ref.trim()})`;
  if (hasText(trail.network)) header += ` — réseau ${trail.network.trim()}`;
  lines.push(`${header}.`);

  if (isPresentNumber(trail.distanceKm)) {
    lines.push(`Distance : ${formatFrNumber(trail.distanceKm)} km.`);
  }

  if (meta) {
    if (isPresentNumber(meta.durationHours)) {
      lines.push(`Durée estimée : ${formatFrNumber(meta.durationHours)} h.`);
    }
    if (hasText(meta.difficulty)) {
      lines.push(`Difficulté : ${DIFFICULTY_LABEL_FR[mapTrailDifficulty(meta.difficulty)]}.`);
    }
    if (isPresentNumber(meta.elevationGain)) {
      lines.push(`Dénivelé : ${formatFrNumber(meta.elevationGain)} m.`);
    }
    if (hasText(meta.terrainType)) {
      lines.push(`Terrain : ${meta.terrainType.trim()}.`);
    }
  }

  return lines.join('\n');
}
