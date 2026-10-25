/**
 * A14 — Bornes cartographiques pour les endpoints GeoJSON.
 *
 * `/api/hikes/geojson` acceptait toute bounding box : une requête pouvait
 * demander la planète entière (coût RPC + payload non bornés). Ce module
 * valide strictement les paramètres et borne l'emprise à `MAX_BBOX_SPAN_DEG`
 * par axe (recentrage sur le centre demandé) ainsi que la tolérance de
 * simplification. Fonctions pures, testables sans réseau.
 */

/** Emprise maximale acceptée par axe (degrés) — 20° ≈ 2200 km. */
export const MAX_BBOX_SPAN_DEG = 20;
/** Emprise par défaut : France métropolitaine (comportement historique). */
export const DEFAULT_BBOX = {
  minLng: -5.5,
  minLat: 41.0,
  maxLng: 10.0,
  maxLat: 52.0,
} as const;
/** Tolérance de simplification par défaut (comportement historique). */
export const DEFAULT_TOLERANCE = 0.0008;
/** Bornes de la tolérance de simplification. */
export const MIN_TOLERANCE = 0.00001;
export const MAX_TOLERANCE = 0.01;

export interface BboxQuery {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  tolerance: number;
}

export type BboxParseResult =
  | { ok: true; bbox: BboxQuery; clamped: boolean }
  | { ok: false; error: string };

function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Valide et borne la bounding box + tolérance d'une requête cartographique.
 * - paramètres absents ⇒ défaut France ;
 * - paramètres partiels/NaN/hors monde ⇒ refus explicite ;
 * - min ≥ max ⇒ refus ;
 * - emprise > MAX_BBOX_SPAN_DEG ⇒ recentrage borné (`clamped: true`) ;
 * - tolérance hors bornes ⇒ bornée (`clamped: true`).
 */
export function parseBboxQuery(params: URLSearchParams): BboxParseResult {
  const keys = ['min_lng', 'min_lat', 'max_lng', 'max_lat'] as const;
  const present = keys.filter((key) => params.has(key));

  let values: BboxQuery;
  if (present.length === 0) {
    values = { ...DEFAULT_BBOX, tolerance: DEFAULT_TOLERANCE };
  } else if (present.length < keys.length) {
    return { ok: false, error: 'min_lng, min_lat, max_lng et max_lat sont requis ensemble' };
  } else {
    const numbers = keys.map((key) => Number(params.get(key)));
    if (numbers.some((value) => !isFiniteNumber(value))) {
      return { ok: false, error: 'coordonnées invalides (nombres finis requis)' };
    }
    const [minLng, minLat, maxLng, maxLat] = numbers;
    if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
      return { ok: false, error: 'coordonnées hors limites mondiales' };
    }
    if (minLng >= maxLng || minLat >= maxLat) {
      return { ok: false, error: 'min doit être strictement inférieur à max sur chaque axe' };
    }
    values = { minLng, minLat, maxLng, maxLat, tolerance: DEFAULT_TOLERANCE };
  }

  const toleranceRaw = params.has('tolerance') ? Number(params.get('tolerance')) : DEFAULT_TOLERANCE;
  if (!isFiniteNumber(toleranceRaw)) {
    return { ok: false, error: 'tolerance invalide (nombre fini requis)' };
  }

  let clamped = false;
  for (const axis of [
    { min: 'minLng', max: 'maxLng', lower: -180, upper: 180 },
    { min: 'minLat', max: 'maxLat', lower: -90, upper: 90 },
  ] as const) {
    const span = values[axis.max] - values[axis.min];
    if (span > MAX_BBOX_SPAN_DEG) {
      const center = (values[axis.max] + values[axis.min]) / 2;
      values[axis.min] = clamp(center - MAX_BBOX_SPAN_DEG / 2, axis.lower, axis.upper);
      values[axis.max] = clamp(center + MAX_BBOX_SPAN_DEG / 2, axis.lower, axis.upper);
      clamped = true;
    }
  }

  const tolerance = clamp(toleranceRaw, MIN_TOLERANCE, MAX_TOLERANCE);
  if (tolerance !== toleranceRaw) clamped = true;

  return { ok: true, bbox: { ...values, tolerance }, clamped };
}
