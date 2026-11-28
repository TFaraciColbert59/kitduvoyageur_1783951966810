import type { ActivitySourceOrigin } from '../activityEventBus';

export interface ActivityImportCandidate {
  id: string;
  sourceOrigin: ActivitySourceOrigin;
  hasBleSensors?: boolean;
  sportSlug: string;
  startedAtMs: number;
  endedAtMs: number;
  distanceM: number;
  elevGainM: number;
  startLat?: number | null;
  startLng?: number | null;
  avgHrBpm?: number | null;
  avgPowerW?: number | null;
  photoUrls?: string[];
  waypoints?: Array<{ id: string; kind: string; label: string; lat: number; lng: number }>;
  gearIds?: string[];
  carnetId?: string | null;
  tripId?: string | null;
  notes?: string;
}

export interface DeduplicationMergeResult {
  isDuplicate: boolean;
  reason: string;
  winnerId: string;
  loserId: string;
  merged: ActivityImportCandidate;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Priorité capteur déterministe :
 * Montre .FIT (Garmin/Suunto/Coros) > iPhone LKDV + BLE > iPhone LKDV > HealthKit > GPX > Manuel
 */
export function getSourceTelemetryPriority(candidate: ActivityImportCandidate): number {
  switch (candidate.sourceOrigin) {
    case 'garmin_fit':
    case 'suunto_fit':
    case 'coros_fit':
      return 100;
    case 'lkdv_native':
      return candidate.hasBleSensors ? 85 : 75;
    case 'lkdv_web':
      return 70;
    case 'apple_healthkit':
      return 60;
    case 'strava_api':
      return 50;
    case 'gpx_import':
      return 40;
    default:
      return 10;
  }
}

export function computeTemporalOverlapRatio(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const minDuration = Math.max(1, Math.min(Math.max(1, aEnd - aStart), Math.max(1, bEnd - bStart)));
  return overlap / minDuration;
}

/**
 * Déduplication déterministe & fusion non destructive :
 * - Chevauchement temporel : delta départ <= 180 s OU recouvrement >= 70 %
 * - Proximité spatiale : départ <= 250 m OU écart distance <= 15 %
 * - Le gagnant fournit la télémétrie (trace, FC, puissance, D+ baro)
 * - Les médias (photos), repères, matériel, carnet, voyage et notes du secondaire sont 100 % préservés !
 */
export function deduplicateAndMergeActivities(
  existing: ActivityImportCandidate,
  incoming: ActivityImportCandidate,
): DeduplicationMergeResult | null {
  const startDeltaS = Math.abs(existing.startedAtMs - incoming.startedAtMs) / 1000;
  const overlapRatio = computeTemporalOverlapRatio(
    existing.startedAtMs,
    existing.endedAtMs,
    incoming.startedAtMs,
    incoming.endedAtMs,
  );

  const temporalMatch = startDeltaS <= 180 || overlapRatio >= 0.7;
  if (!temporalMatch) return null;

  let spatialOrDistMatch = false;
  if (
    typeof existing.startLat === 'number' &&
    typeof existing.startLng === 'number' &&
    typeof incoming.startLat === 'number' &&
    typeof incoming.startLng === 'number'
  ) {
    const startGapM = haversineM(
      existing.startLat,
      existing.startLng,
      incoming.startLat,
      incoming.startLng,
    );
    if (startGapM <= 250) {
      spatialOrDistMatch = true;
    }
  }

  const maxDist = Math.max(existing.distanceM, incoming.distanceM, 1);
  const distDiffRatio = Math.abs(existing.distanceM - incoming.distanceM) / maxDist;
  if (distDiffRatio <= 0.15) {
    spatialOrDistMatch = true;
  }

  // Cas indoor (distance 0 des deux côtés) : overlap temporel + même sport suffit
  if (existing.distanceM === 0 && incoming.distanceM === 0 && existing.sportSlug === incoming.sportSlug) {
    spatialOrDistMatch = true;
  }

  if (!spatialOrDistMatch) return null;

  const existingPrio = getSourceTelemetryPriority(existing);
  const incomingPrio = getSourceTelemetryPriority(incoming);
  const winner = incomingPrio > existingPrio ? incoming : existing;
  const loser = winner === incoming ? existing : incoming;

  const uniquePhotos = Array.from(
    new Set([...(winner.photoUrls ?? []), ...(loser.photoUrls ?? [])]),
  );
  const uniqueGear = Array.from(new Set([...(winner.gearIds ?? []), ...(loser.gearIds ?? [])]));
  const wpById = new Map<string, { id: string; kind: string; label: string; lat: number; lng: number }>();
  for (const wp of [...(winner.waypoints ?? []), ...(loser.waypoints ?? [])]) {
    wpById.set(wp.id, wp);
  }

  const mergedNotes = [winner.notes?.trim(), loser.notes?.trim()]
    .filter((s): s is string => Boolean(s && s.length > 0))
    .join('\n');

  return {
    isDuplicate: true,
    reason: `overlap=${Math.round(overlapRatio * 100)}%,startDelta=${Math.round(startDeltaS)}s,winner=${winner.sourceOrigin}`,
    winnerId: winner.id,
    loserId: loser.id,
    merged: {
      ...winner,
      avgHrBpm: winner.avgHrBpm ?? loser.avgHrBpm ?? null,
      avgPowerW: winner.avgPowerW ?? loser.avgPowerW ?? null,
      photoUrls: uniquePhotos,
      waypoints: Array.from(wpById.values()),
      gearIds: uniqueGear,
      carnetId: winner.carnetId ?? loser.carnetId ?? null,
      tripId: winner.tripId ?? loser.tripId ?? null,
      notes: mergedNotes || undefined,
    },
  };
}
