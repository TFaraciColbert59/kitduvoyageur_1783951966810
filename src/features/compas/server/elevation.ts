import 'server-only';

import { buildProfile, sampleRoute, type ElevationProfile } from '../engine/elevation';

/**
 * Altitudes réelles du tracé : API d'élévation Open-Meteo (modèle numérique
 * Copernicus GLO-90, 90 m), 100 points au plus par requête. Échec réseau :
 * null, l'accessoire garde le dénivelé et la distance.
 */
const ELEVATION = 'https://api.open-meteo.com/v1/elevation';
const SOURCE = 'Open-Meteo · Copernicus DEM GLO-90';

export async function getRouteElevation(
  coords: ReadonlyArray<[number, number]>
): Promise<ElevationProfile | null> {
  const samples = sampleRoute(coords, 80);
  if (samples.length === 0) return null;
  const q = new URLSearchParams({
    latitude: samples.map((s) => s.lat).join(','),
    longitude: samples.map((s) => s.lon).join(','),
  });
  try {
    const res = await fetch(`${ELEVATION}?${q.toString()}`, {
      // Le relief ne change pas : un mois de cache.
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { elevation?: unknown };
    return buildProfile(samples, body?.elevation, SOURCE);
  } catch {
    return null;
  }
}
