/**
 * Domaine pur « trace du jour sélectionné » (Task 5).
 *
 * Découpe la polyligne réelle d'un sentier en sous-trace du jour, avec les
 * mêmes fractions que `deterministicActivityContent.startPointForDay`
 * (`round(((d-1)/days)*(N-1))` → `round((d/days)*(N-1))`, bornes incluses) :
 * le jour J commence au dernier point du jour J-1 et Jlast finit au dernier
 * sommet. Aucune I/O : testable sans React ni réseau.
 */
import { haversineKm } from '@/components/map/engine/camera';

export interface DayTracePoint {
  lat: number;
  lng: number;
}

function isFinitePoint(value: DayTracePoint | null | undefined): value is DayTracePoint {
  return (
    !!value &&
    typeof value.lat === 'number' &&
    Number.isFinite(value.lat) &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lng)
  );
}

function sanitizePoints(points: DayTracePoint[] | null | undefined): DayTracePoint[] {
  return Array.isArray(points) ? points.filter(isFinitePoint) : [];
}

/** Entier ≥ 1 fini, sinon `null` (jour/jours hors domaine → comportement sûr). */
function positiveIntegerOrNull(value: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const truncated = Math.trunc(value);
  return truncated >= 1 ? truncated : null;
}

/**
 * Sous-trace du jour `day` sur `days` : indices
 * `round(((day-1)/days)*(N-1))` → `round((day/days)*(N-1))`, bornes incluses.
 * Jour hors domaine → borné au dernier jour ; entrées invalides → `[]` ;
 * polyligne à un seul sommet → ce sommet.
 */
export function sliceDayTrace(
  polyline: { lat: number; lng: number }[],
  day: number,
  days: number
): { lat: number; lng: number }[] {
  const points = sanitizePoints(polyline);
  if (points.length === 0) return [];

  const totalDays = positiveIntegerOrNull(days);
  const dayNumber = positiveIntegerOrNull(day);
  if (totalDays == null || dayNumber == null) return [];

  if (points.length === 1 || totalDays === 1) return points;

  const lastIndex = points.length - 1;
  const currentDay = Math.min(dayNumber, totalDays);
  const start = Math.round(((currentDay - 1) / totalDays) * lastIndex);
  const end = Math.round((currentDay / totalDays) * lastIndex);
  return points.slice(start, end + 1);
}

/** Indice du sommet de `polyline` le plus proche (haversine) de `point`. */
function nearestVertexIndex(point: DayTracePoint, polyline: DayTracePoint[]): number {
  let bestIndex = 0;
  let bestKm = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length; i += 1) {
    const candidate = polyline[i];
    const km = haversineKm([point.lng, point.lat], [candidate.lng, candidate.lat]);
    if (km < bestKm) {
      bestKm = km;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Trace du jour priorisant les étapes géolocalisées réelles : dès 2 étapes, la
 * sous-polyligne va du sommet le plus proche de la première au sommet le plus
 * proche de la dernière (segment normalisé min→max, jamais de coupe vide).
 * Sinon repli sur `sliceDayTrace` (fractions de jour).
 */
export function dayTraceFromSteps(
  stepPoints: { lat: number; lng: number }[] | null | undefined,
  polyline: { lat: number; lng: number }[],
  day: number,
  days: number
): { lat: number; lng: number }[] {
  const steps = sanitizePoints(stepPoints);
  const points = sanitizePoints(polyline);
  if (steps.length < 2 || points.length < 2) return sliceDayTrace(points, day, days);

  const firstIndex = nearestVertexIndex(steps[0], points);
  const lastIndex = nearestVertexIndex(steps[steps.length - 1], points);
  const start = Math.min(firstIndex, lastIndex);
  const end = Math.max(firstIndex, lastIndex);
  return points.slice(start, end + 1);
}

/**
 * `metadata.route_id` canonique : entier ≥ 1 (nombre ou chaîne numérique),
 * sinon `null`. Aucun identifiant inventé.
 */
export function routeIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = metadata.route_id;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    const truncated = Math.trunc(raw);
    return truncated >= 1 ? String(truncated) : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    const truncated = Math.trunc(parsed);
    return truncated >= 1 ? String(truncated) : null;
  }
  return null;
}
