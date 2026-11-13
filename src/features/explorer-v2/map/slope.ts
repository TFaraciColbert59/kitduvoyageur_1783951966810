/**
 * Couche « pente » de l'Explorer v2 (fiche K3.04).
 *
 * Le relief n'est pas stocké par segment : il est lu dans le DEM AWS Terrarium
 * par le service existant `POST /api/explorer/v2/profile`. Ce module ne fait
 * que transformer le profil réel en arrêts de `line-gradient` MapLibre, avec
 * les seuils de `04_CARTE.md §2` :
 *   < 8 % sauge · 8–15 % ambre · 15–25 % terre · > 25 % alerte.
 *
 * Aucune altitude n'est inventée : un point sans relief reste explicitement
 * « inconnu » et reçoit la couleur neutre du tracé, jamais une pente à 0.
 */

import { decimateTrack, routeLines, type LngLat } from '../geo/track';

/** Couleurs des seuils de pente, déjà présentes dans `04_CARTE.md §2`. */
export const SLOPE_COLORS = {
  flat: '#7FA27A',
  moderate: '#D8B25A',
  steep: '#C27A4A',
  verySteep: '#A8443A',
  unknown: '#C9D3CC',
} as const;

/** Seuils de pente en pourcentage (positif = montée, négatif = descente). */
export const SLOPE_THRESHOLDS = {
  moderate: 8,
  steep: 15,
  verySteep: 25,
} as const;

export interface SlopeProfilePoint {
  /** Distance cumulée depuis le départ, en mètres. */
  d: number;
  /** Altitude réelle, ou `null` quand la tuile DEM n'a pas pu être lue. */
  ele: number | null;
}

export interface SlopeSummary {
  distanceM: number;
  gainM: number;
  lossM: number;
  minM: number;
  maxM: number;
}

/** Un arrêt `line-progress` : progression 0–1 et couleur. */
export type SlopeStop = [number, string];

export interface SlopeLayer {
  /** Identifiant numérique de l'itinéraire coloré. */
  id: number;
  /** Géométrie GeoJSON réelle (LineString ou MultiLineString). */
  geojson: unknown;
  /** Arrêts triés, commençant à 0 et finissant à 1. */
  stops: SlopeStop[];
  summary: SlopeSummary;
}

/** Couleur d'une pente en pourcentage ; `null` = relief inconnu. */
export function slopeColor(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return SLOPE_COLORS.unknown;
  const value = Math.abs(pct);
  if (value < SLOPE_THRESHOLDS.moderate) return SLOPE_COLORS.flat;
  if (value < SLOPE_THRESHOLDS.steep) return SLOPE_COLORS.moderate;
  if (value < SLOPE_THRESHOLDS.verySteep) return SLOPE_COLORS.steep;
  return SLOPE_COLORS.verySteep;
}

/** Normalise une géométrie éventuellement emballée dans une `Feature`. */
export function geometryOf(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { type?: unknown; geometry?: unknown };
  if (raw.type === 'Feature') return raw.geometry ?? null;
  return value;
}

/**
 * Positions ordonnées d'un itinéraire, plafonnées pour tenir dans le contrat
 * de `POST /api/explorer/v2/profile` (6 000 points). Les lignes d'une
 * géométrie `MultiLineString` sont concaténées dans l'ordre : le service DEM
 * les traite comme une trace continue. Un itinéraire réellement discontinu
 * peut donc fausser la pente au raccord ; cette limite est documentée dans
 * `docs/explorer-v2/C01-K3.04-K3.05.md`, et aucune altitude n'est inventée.
 */
export function routePositions(geojson: unknown, max = 1_500): Array<[number, number]> {
  const lines = routeLines(geojson);
  if (lines.length === 0) return [];
  const flat: LngLat[] = [];
  for (const line of lines) {
    for (const point of line) flat.push(point);
  }
  return decimateTrack(flat, Math.max(2, Math.floor(max))).map(
    (point): [number, number] => [point[0], point[1]],
  );
}

/**
 * Transforme un profil altimétrique en arrêts de dégradé.
 *
 * La progression est calculée sur la distance réelle du profil. Deux points
 * consécutifs sans altitude produisent un arrêt neutre ; on ne fabrique pas
 * une pente entre deux points séparés par un trou DEM.
 */
export function buildSlopeGradient(
  points: readonly SlopeProfilePoint[],
  distanceM: number,
): SlopeStop[] {
  if (points.length === 0) return [];
  const total = Number.isFinite(distanceM) && distanceM > 0
    ? distanceM
    : Math.max(0, points[points.length - 1]?.d ?? 0);
  if (!(total > 0)) return [];

  const raw: SlopeStop[] = [];
  let previous: { d: number; ele: number } | null = null;
  for (const point of points) {
    if (!Number.isFinite(point.d)) continue;
    const progress = Math.max(0, Math.min(1, point.d / total));
    if (point.ele === null || !Number.isFinite(point.ele)) {
      // Le premier point sans relief n'a pas encore de couleur : on garde le
      // précédent, sinon la ligne commencerait par un faux « plat ».
      if (previous) {
        raw.push([progress, SLOPE_COLORS.unknown]);
        previous = null;
      }
      continue;
    }
    if (!previous) {
      raw.push([progress, SLOPE_COLORS.flat]);
      previous = { d: point.d, ele: point.ele };
      continue;
    }
    const deltaD = point.d - previous.d;
    const pct = deltaD > 0 ? ((point.ele - previous.ele) / deltaD) * 100 : null;
    raw.push([progress, slopeColor(pct)]);
    previous = { d: point.d, ele: point.ele };
  }

  if (raw.length === 0) return [];

  const clean: SlopeStop[] = [];
  for (const [progress, color] of raw) {
    const value = Math.max(0, Math.min(1, progress));
    const last = clean[clean.length - 1];
    if (last && value <= last[0]) {
      // Deux points à la même distance : le plus récent porte l'information.
      last[1] = color;
      continue;
    }
    clean.push([value, color]);
  }
  if (clean.length === 0) return [];
  if (clean[0][0] > 0) clean.unshift([0, clean[0][1]]);
  if (clean[clean.length - 1][0] < 1) clean.push([1, clean[clean.length - 1][1]]);
  return clean.length >= 2 ? clean : [];
}

/** Synthèse réelle d'un profil ; `null` sous deux altitudes connues. */
export function summarizeSlope(
  points: readonly SlopeProfilePoint[],
  distanceM: number,
): SlopeSummary | null {
  let known = 0;
  let gain = 0;
  let loss = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let previous: { d: number; ele: number } | null = null;

  for (const point of points) {
    if (!Number.isFinite(point.d) || point.ele === null || !Number.isFinite(point.ele)) {
      previous = null;
      continue;
    }
    known += 1;
    min = Math.min(min, point.ele);
    max = Math.max(max, point.ele);
    if (previous && point.d > previous.d) {
      const delta = point.ele - previous.ele;
      if (delta > 0) gain += delta;
      else loss -= delta;
    }
    previous = { d: point.d, ele: point.ele };
  }

  if (known < 2) return null;
  const total = Number.isFinite(distanceM) && distanceM > 0
    ? distanceM
    : Math.max(0, points[points.length - 1]?.d ?? 0);
  return {
    distanceM: Math.round(total),
    gainM: Math.round(gain),
    lossM: Math.round(loss),
    minM: Math.round(min),
    maxM: Math.round(max),
  };
}

/**
 * Expression MapLibre `line-gradient` à partir des arrêts.
 *
 * `line-progress` n'existe que si la source GeoJSON a été créée avec
 * `lineMetrics: true` (voir MapStage).
 */
export function slopeGradientExpression(stops: readonly SlopeStop[]): unknown {
  if (stops.length < 2) return null;
  const expression: unknown[] = ['interpolate', ['linear'], ['line-progress']];
  for (const [progress, color] of stops) {
    expression.push(progress, color);
  }
  return expression;
}
