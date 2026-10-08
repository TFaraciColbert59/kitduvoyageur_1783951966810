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
