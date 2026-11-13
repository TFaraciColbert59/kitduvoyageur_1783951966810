/** Libellés de distance et de dénivelé d'un tracé partagé (aperçu, tiroir, bulle). */

export interface TraceStats {
  distanceKm?: number | null;
  elevationGainM?: number | null;
}

export function formatDistanceKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km) || km <= 0) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function formatElevationGain(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  return `+${Math.round(meters)} m`;
}

/** « 12,4 km · +880 m » ; une valeur inconnue est omise, jamais remplacée. `null` si rien n'est connu. */
export function formatTraceStats(stats: TraceStats): string | null {
  const parts = [formatDistanceKm(stats.distanceKm), formatElevationGain(stats.elevationGainM)].filter(
    (part): part is string => part !== null,
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}
