import 'server-only';

import { buildProfile, sampleRoute, type ElevationProfile } from '../engine/elevation';
import { TERRAIN_SOURCE, terrainElevations } from '@/lib/geo/terrainElevation';

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
