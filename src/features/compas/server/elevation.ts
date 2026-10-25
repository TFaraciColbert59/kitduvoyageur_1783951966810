import 'server-only';

import { buildProfile, sampleRoute, type ElevationProfile } from '../engine/elevation';
import { TERRAIN_SOURCE, terrainElevations } from '@/lib/geo/terrainElevation';
import { ascentFromElevations } from '../engine/legDistance';

/**
 * Altitudes réelles du tracé : Terrain Tiles (AWS Open Data, gratuites, usage
 * commercial permis). Échec réseau : null, l'accessoire garde le dénivelé et
 * la distance.
 */

export async function getRouteElevation(
  coords: ReadonlyArray<[number, number]>
): Promise<ElevationProfile | null> {
  const samples = sampleRoute(coords, 80);
  if (samples.length === 0) return null;
  const elevations = await terrainElevations(samples.map((sp) => [sp.lon, sp.lat] as const));
  return elevations ? buildProfile(samples, elevations, TERRAIN_SOURCE) : null;
}

/**
 * Dénivelé positif (m) d'un tracé `[lon, lat]` mesuré par un routeur, lu sur
 * le relief : un échantillon tous les 100 m environ (20 à 150). Aucun routeur
 * autorisé ne donne le dénivelé (plan 1.5) ; null si le relief est injoignable.
 */
export async function routeAscentM(line: ReadonlyArray<readonly [number, number]>): Promise<number | null> {
  const coords = line.map(([lon, lat]) => [lat, lon] as [number, number]);
  const ends = sampleRoute(coords, 2);
  const totalKm = ends.at(-1)?.km ?? 0;
  if (!(totalKm > 0)) return null;
  const samples = sampleRoute(coords, Math.min(150, Math.max(20, Math.ceil(totalKm * 10) + 1)));
  const elevations = await terrainElevations(samples.map((sp) => [sp.lon, sp.lat] as const)).catch(() => null);
  return elevations ? ascentFromElevations(elevations) : null;
}

/** Lieux lus au plus (étapes distinctes d'un voyage) : une tuile du relief couvre souvent plusieurs lieux. */
const MAX_ALTITUDE_PLACES = 12;

/** Altitudes lues sur le relief pour des lieux distincts ; null si le relief est injoignable ou qu'aucun lieu n'est valide. */
async function placeAltitudes(points: ReadonlyArray<{ lat: number; lon: number }>): Promise<number[] | null> {
  const seen = new Set<string>();
  const places: Array<{ lat: number; lon: number }> = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) continue;
    const key = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(p);
    if (places.length >= MAX_ALTITUDE_PLACES) break;
  }
  if (!places.length) return null;
  const elevations = await terrainElevations(places.map((p) => [p.lon, p.lat] as const)).catch(() => null);
  return (elevations ?? []).filter((a): a is number => a != null);
}

/**
 * Altitude de secours (plan 4.8) : le point le plus haut des lieux donnés,
 * LU SUR LE RELIEF (Terrain Tiles), jamais une valeur devinée d'après le pays.
 * C'est l'altitude des lieux, pas celle d'un sommet du parcours : elle ne
 * dépasse pas ce que le voyage touche. Relief injoignable, mer (0 m) ou aucun
 * lieu valide : null, et les règles passent en formulation prudente.
 */
export async function pointsMaxAltitudeM(
  points: ReadonlyArray<{ lat: number; lon: number }>
): Promise<number | null> {
  const max = Math.max(0, ...((await placeAltitudes(points)) ?? []));
  return max > 0 ? max : null;
}

/**
 * Le point le plus haut ET le plus bas des lieux donnés, lus sur le relief. Le plus bas dit que le parcours
 * descend au moins jusque-là (les lieux sont sur le parcours) ; il ne dit rien du reste du tracé. Même
 * règle que `pointsMaxAltitudeM` : relief injoignable, mer (0 m) ou aucun lieu valide : null.
 */
export async function pointsAltitudeRange(
  points: ReadonlyArray<{ lat: number; lon: number }>
): Promise<{ maxM: number; minM: number } | null> {
  const altitudes = (await placeAltitudes(points)) ?? [];
  const maxM = Math.max(0, ...altitudes);
  return maxM > 0 ? { maxM, minM: Math.min(...altitudes) } : null;
}
