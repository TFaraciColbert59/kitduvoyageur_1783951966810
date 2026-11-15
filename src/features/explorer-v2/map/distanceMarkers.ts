/**
 * Marqueurs de distance de l'Explorer v2 (fiche C01 · K3.12).
 *
 * Les marqueurs sont **dérivés de la géométrie réelle** de l'itinéraire
 * sélectionné : aucune distance n'est stockée par point, aucun kilométrage
 * n'est inventé. Le module est pur (aucun DOM, réseau ou React) et réutilise
 * les lignes validées de `geo/track.ts`.
 *
 * Unités : les distances internes restent en **mètres**. L'intervalle et le
 * libellé suivent l'unité d'affichage (métrique ou impériale) : 1 km ou 1 mi.
 */

import { haversineM, routeLines, type LngLat } from '../geo/track';

/** Intervalle métrique : un marqueur par kilomètre. */
export const METRIC_MARKER_INTERVAL_M = 1_000;

/** Intervalle impérial : un marqueur par mile terrestre. */
export const IMPERIAL_MARKER_INTERVAL_M = 1_609.344;

/**
 * Plafond d'affichage : une trace de 400 km produit déjà 400 étiquettes.
 * Au-delà, on garde les premiers marqueurs plutôt que de saturer le DOM ;
 * le tiroir annonce le nombre de marqueurs constructibles, plafond compris.
 */
export const MAX_DISTANCE_MARKERS = 400;

export interface DistanceMarker {
  /** Identifiant stable dans la trace courante (`distance-1`, `distance-2`…). */
  id: string;
  /** Distance cumulée depuis le départ, en mètres. */
  distanceM: number;
  /** Position interpolée, ordre GeoJSON [lng, lat]. */
  lng: number;
  lat: number;
  /** Libellé localisé : « 3 km » ou « 2 mi ». */
  label: string;
}

/** Intervalle de marquage pour l'unité d'affichage courante. */
export function distanceMarkerIntervalM(units: 'metric' | 'imperial'): number {
  return units === 'imperial' ? IMPERIAL_MARKER_INTERVAL_M : METRIC_MARKER_INTERVAL_M;
}

/** Suffixe d'unité, sans valeur : « km » ou « mi ». */
export function distanceMarkerUnit(units: 'metric' | 'imperial'): 'km' | 'mi' {
  return units === 'imperial' ? 'mi' : 'km';
}

/** Libellé d'intervalle : « 1 km » ou « 1 mi ». */
export function distanceMarkerIntervalLabel(units: 'metric' | 'imperial'): string {
  return `1 ${distanceMarkerUnit(units)}`;
}

/** Formate une distance cumulée sans jamais afficher de valeur inventée. */
export function formatDistanceMarker(
  distanceM: number,
  units: 'metric' | 'imperial',
): string {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return '';
  const value =
    units === 'imperial' ? distanceM / IMPERIAL_MARKER_INTERVAL_M : distanceM / METRIC_MARKER_INTERVAL_M;
  const rounded = Math.max(1, Math.round(value));
  return `${rounded} ${distanceMarkerUnit(units)}`;
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
 * Construit les marqueurs à intervalle régulier sur une géométrie
 * `LineString` / `MultiLineString` (ou une `Feature` qui la porte).
 *
 * Règles de fidélité :
 * - la distance est la somme haversine des segments réels ;
 * - un segment invalide est ignoré, jamais interpolé ;
 * - une `MultiLineString` est parcourue ligne par ligne : le raccord entre
 *   deux lignes n'est **pas** compté comme de la distance, donc aucun marqueur
 *   n'est placé dans un trou éventuel ;
 * - le premier marqueur est à `intervalM` (pas de « 0 km » redondant) ;
 * - la sortie est plafonnée à `maxMarkers`.
 */
export function buildDistanceMarkers(
  geojson: unknown,
  units: 'metric' | 'imperial',
  options: { maxMarkers?: number; intervalM?: number } = {},
): DistanceMarker[] {
  const lines = routeLines(geojson);
  if (lines.length === 0) return [];

  const interval =
    typeof options.intervalM === 'number' &&
    Number.isFinite(options.intervalM) &&
    options.intervalM > 0
      ? options.intervalM
      : distanceMarkerIntervalM(units);
  const maxMarkers =
    typeof options.maxMarkers === 'number' &&
    Number.isFinite(options.maxMarkers) &&
    options.maxMarkers >= 1
      ? Math.floor(options.maxMarkers)
      : MAX_DISTANCE_MARKERS;

  const markers: DistanceMarker[] = [];
  let travelled = 0;
  let nextAt = interval;
  let index = 0;

  for (const line of lines) {
    for (let pointIndex = 1; pointIndex < line.length; pointIndex += 1) {
      const a = line[pointIndex - 1] as LngLat;
      const b = line[pointIndex] as LngLat;
      const segment = haversineM(a, b);
      if (!Number.isFinite(segment) || segment <= 0) continue;

      while (nextAt <= travelled + segment + 1e-9) {
        const ratio = Math.min(1, Math.max(0, (nextAt - travelled) / segment));
        index += 1;
        markers.push({
          id: `distance-${index}`,
          distanceM: nextAt,
          lng: interpolateLng(a[0], b[0], ratio),
          lat: a[1] + (b[1] - a[1]) * ratio,
          label: formatDistanceMarker(nextAt, units),
        });
        if (markers.length >= maxMarkers) return markers;
        nextAt += interval;
      }
      travelled += segment;
    }
  }

  return markers;
}
