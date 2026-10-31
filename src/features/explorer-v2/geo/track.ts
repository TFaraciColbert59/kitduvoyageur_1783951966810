/**
 * Moteur géométrique partagé de l'Explorer v2 (serveur Next + Web Worker).
 *
 * Ce module est **pur** (aucune dépendance DOM, réseau ou Next) : il est
 * importé par la route `api/explorer/v2/profile` (Node, DEM décodé par `sharp`)
 * et par le worker géo (navigateur, DEM décodé par `OffscreenCanvas`). Une seule
 * implémentation de la distance, de la décimation et du rééchantillonnage évite
 * les divergences de résultats entre profil serveur et profil client.
 *
 * Unités : les distances sont en **mètres**, les positions en **[lng, lat]**
 * (degrés décimaux, ordre GeoJSON — jamais [lat, lng]).
 */

/** Position géographique, ordre GeoJSON : [longitude, latitude]. */
export type LngLat = readonly [number, number];

export const EARTH_RADIUS_M = 6_371_000;

/** Pas d'échantillonnage par défaut du profil altimétrique. */
export const DEFAULT_STEP_M = 60;

/**
 * Plafond de sécurité : au-delà, le profil n'apporte plus rien à l'écran et un
 * pas dérisoire ferait exploser la mémoire du worker (cf. incident P0).
 */
export const MAX_RESAMPLED_POINTS = 20_000;

/** Vrai si la valeur est une paire [lng, lat] finie et dans les bornes légales. */
export function isValidLngLat(value: unknown): value is LngLat {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [lng, lat] = value;
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Distance haversine en mètres. Renvoie `NaN` si une coordonnée est invalide :
 * on ne fabrique jamais une distance à partir d'une donnée corrompue.
 */
export function haversineM(a: LngLat, b: LngLat): number {
  if (!isValidLngLat(a) || !isValidLngLat(b)) return Number.NaN;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(Math.min(1, h))));
}

/** Longueur cumulée d'une trace, en mètres (points invalides ignorés). */
export function trackDistanceM(positions: readonly LngLat[]): number {
  let total = 0;
  let previous: LngLat | null = null;
  for (const position of positions) {
    if (!isValidLngLat(position)) continue;
    if (previous) {
      const segment = haversineM(previous, position);
      if (Number.isFinite(segment)) total += segment;
    }
    previous = position;
  }
  return total;
}

/**
 * Sous-échantillonne une trace trop dense (les géométries OSM sont bruitées).
 * Renvoie la trace d'origine telle quelle (même référence) si elle tient déjà.
 */
export function decimateTrack(positions: readonly LngLat[], max: number): readonly LngLat[] {
  const limit = Number.isFinite(max) && max >= 2 ? Math.floor(max) : 2;
  if (positions.length <= limit) return positions;
  const step = Math.ceil(positions.length / limit);
  const out: LngLat[] = [];
  for (let index = 0; index < positions.length; index += step) out.push(positions[index]);
  const last = positions[positions.length - 1];
  const tail = out[out.length - 1];
  if (tail !== last) out.push(last);
  return out;
}

export interface ResampledPoint {
  /** Position interpolée, ordre [lng, lat], longitude normalisée. */
  position: [number, number];
  /** Distance cumulée depuis le départ, en mètres. */
  distance_m: number;
}

export interface ResampleOptions {
  /** Nombre maximal de points produits (garde anti-OOM). */
  maxSamples?: number;
}

/** Interpolation de longitude par le plus court chemin (antiméridien). */
function interpolateLng(from: number, to: number, ratio: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;
  let lng = from + delta * ratio;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return lng;
}

/**
 * Rééchantillonne une trace tous les `stepM` mètres.
 *
 * Invariants garantis (et testés) :
 * - la distance cumulée est **strictement croissante** ;
 * - aucune distance ne dépasse la longueur réelle de la trace ;
 * - le premier point est conservé à la distance 0 ;
 * - les points répétés, non finis ou hors bornes ne produisent ni NaN ni doublon ;
 * - un pas nul/négatif/NaN retombe sur `DEFAULT_STEP_M` ;
 * - la production est bornée par `maxSamples` (aucune boucle sans fin).
 */
export function resampleTrack(
  positions: readonly LngLat[],
  stepM: number = DEFAULT_STEP_M,
  options: ResampleOptions = {},
): ResampledPoint[] {
  const step = Number.isFinite(stepM) && stepM > 0 ? stepM : DEFAULT_STEP_M;
  const maxSamples =
    Number.isFinite(options.maxSamples) && (options.maxSamples as number) >= 1
      ? Math.floor(options.maxSamples as number)
      : MAX_RESAMPLED_POINTS;

  const valid = positions.filter(isValidLngLat);
  if (valid.length === 0) return [];
  const out: ResampledPoint[] = [{ position: [valid[0][0], valid[0][1]], distance_m: 0 }];
  if (valid.length === 1) return out;

  let travelled = 0;
  let nextAt = step;
  let saturated = false;
  for (let index = 1; index < valid.length; index += 1) {
    const a = valid[index - 1];
    const b = valid[index];
    const segment = haversineM(a, b);
    if (!Number.isFinite(segment) || segment <= 0) continue;
    if (!saturated) {
      // `nextAt` ne dépasse jamais `travelled + segment` : le nombre de points
      // produits par segment est borné par `segment / step`, donc la boucle
      // progresse toujours (correctif de l'incident resampleTrack).
      while (nextAt <= travelled + segment + 1e-9) {
        const ratio = Math.min(1, Math.max(0, (nextAt - travelled) / segment));
        out.push({
          position: [interpolateLng(a[0], b[0], ratio), a[1] + (b[1] - a[1]) * ratio],
          distance_m: nextAt,
        });
        nextAt += step;
        if (out.length > maxSamples) {
          saturated = true;
          break;
        }
      }
    }
    travelled += segment;
  }
  return out;
}

/**
 * Empreinte de contenu d'une trace (et de ses paramètres de calcul).
 *
 * Sert de clé de cache au profil altimétrique : `length:premier-point` ignorait
 * une mutation interne de la trace. FNV-1a sur les coordonnées arrondies au
 * 1e-7 degré plus la longueur et les paramètres : deux traces différentes ne
 * peuvent pas partager la clé par accident.
 */
export function trackRevision(
  positions: readonly LngLat[],
  params: { stepM?: number; demZoom?: number } = {},
): string {
  let hash = 0x811c9dc5;
  const mix = (value: number) => {
    const rounded = Math.round(value * 1e7);
    for (let shift = 0; shift < 32; shift += 8) {
      hash ^= (rounded >>> shift) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  for (const position of positions) {
    if (!isValidLngLat(position)) continue;
    mix(position[0]);
    mix(position[1]);
  }
  const step = params.stepM ?? DEFAULT_STEP_M;
  const zoom = params.demZoom ?? 10;
  return `${positions.length}:${hash.toString(36)}:${step}:${zoom}`;
}

export interface ElevationPoint {
  /** Distance cumulée depuis le départ, en mètres. */
  d: number;
  /** Altitude en mètres, ou null si le DEM ne couvre pas le point. */
  ele: number | null;
}

export interface ElevationSummary {
  distance_m: number;
  gain_m: number;
  loss_m: number;
  min_m: number | null;
  max_m: number | null;
}

/**
 * Synthèse altimétrique : dénivelé positif/négatif sur les paires réellement
 * renseignées (un trou DEM n'est jamais comblé par une valeur inventée).
 */
export function summarizeElevation(
  points: readonly ElevationPoint[],
  distanceM: number,
): ElevationSummary {
  let gain = 0;
  let loss = 0;
  let min: number | null = null;
  let max: number | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].ele;
    const current = points[index].ele;
    if (previous === null || current === null) continue;
    const delta = current - previous;
    if (delta > 0) gain += delta;
    else loss -= delta;
  }
  for (const point of points) {
    if (point.ele === null) continue;
    if (min === null || point.ele < min) min = point.ele;
    if (max === null || point.ele > max) max = point.ele;
  }
  return {
    distance_m: Math.round(distanceM),
    gain_m: Math.round(gain),
    loss_m: Math.round(loss),
    min_m: min === null ? null : Math.round(min),
    max_m: max === null ? null : Math.round(max),
  };
}
