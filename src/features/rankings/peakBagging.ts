import { isActivityEligibleForPersonalRewards } from './privacy';
import {
  GpsTrackPoint,
  PeakAscentRecord,
  PeakBaggingEntry,
  PeakBaggingSummary,
  PeakDefinition,
  RankingActivityRecord,
} from './types';

export const DEFAULT_PEAK_RADIUS_METERS = 50;
const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle Haversine distance in meters between two WGS84 coordinates.
 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function findClosestDistanceToPointMeters(
  track: readonly GpsTrackPoint[] | undefined,
  targetLat: number,
  targetLng: number
): number | null {
  if (!track || track.length === 0) {
    return null;
  }
  let minDist = Infinity;
  for (const pt of track) {
    if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) {
      continue;
    }
    const dist = haversineMeters(pt.lat, pt.lng, targetLat, targetLng);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return Number.isFinite(minDist) ? minDist : null;
}

/**
 * K5.26: Validates which peaks were reached by an activity's GPS track.
 * Fail-closed: invalid, flagged, or deleted activities yield 0 ascents.
 */
export function validatePeakAscents(
  activity: RankingActivityRecord,
  peaks: readonly PeakDefinition[]
): PeakAscentRecord[] {
  if (!isActivityEligibleForPersonalRewards(activity)) {
    return [];
  }
  if (!activity.gpsTrack || activity.gpsTrack.length === 0) {
    return [];
  }

  const ascents: PeakAscentRecord[] = [];
  for (const peak of peaks) {
    const radius = peak.validationRadiusMeters ?? DEFAULT_PEAK_RADIUS_METERS;
    const closest = findClosestDistanceToPointMeters(activity.gpsTrack, peak.lat, peak.lng);
    if (closest !== null && closest <= radius) {
      ascents.push({
        peakId: peak.id,
        peakName: peak.name,
        peakElevationMeters: peak.elevationMeters,
        activityId: activity.id,
        ascendedAt: activity.startedAt,
        closestDistanceMeters: Math.round(closest * 100) / 100,
      });
    }
  }

  return ascents;
}

/**
 * K5.26: Builds the full Peak Bagging summary (lists + stats) for a user
 * from their valid, non-flagged activities.
 */
export function buildPeakBaggingSummary(
  userId: string,
  activities: readonly RankingActivityRecord[],
  peaks: readonly PeakDefinition[]
): PeakBaggingSummary {
  const byPeak = new Map<string, { ascentCount: number; firstAscentAt: string; lastAscentAt: string }>();

  for (const activity of activities) {
    if (activity.userId !== userId) {
      continue;
    }
    const ascents = validatePeakAscents(activity, peaks);
    for (const ascent of ascents) {
      const existing = byPeak.get(ascent.peakId);
      if (!existing) {
        byPeak.set(ascent.peakId, {
          ascentCount: 1,
          firstAscentAt: ascent.ascendedAt,
          lastAscentAt: ascent.ascendedAt,
        });
      } else {
        existing.ascentCount += 1;
        if (Date.parse(ascent.ascendedAt) < Date.parse(existing.firstAscentAt)) {
          existing.firstAscentAt = ascent.ascendedAt;
        }
        if (Date.parse(ascent.ascendedAt) > Date.parse(existing.lastAscentAt)) {
          existing.lastAscentAt = ascent.ascendedAt;
        }
      }
    }
  }

  let conqueredPeaksCount = 0;
  let totalAscentsCount = 0;
  let highestConqueredPeakMeters: number | null = null;
  let cumulativePeakElevationMeters = 0;

  const entries: PeakBaggingEntry[] = peaks.map((peak) => {
    const stats = byPeak.get(peak.id);
    const isConquered = Boolean(stats && stats.ascentCount > 0);
    if (isConquered && stats) {
      conqueredPeaksCount += 1;
      totalAscentsCount += stats.ascentCount;
      cumulativePeakElevationMeters += peak.elevationMeters;
      if (highestConqueredPeakMeters === null || peak.elevationMeters > highestConqueredPeakMeters) {
        highestConqueredPeakMeters = peak.elevationMeters;
      }
    }
    return {
      peakId: peak.id,
      name: peak.name,
      elevationMeters: peak.elevationMeters,
      region: peak.region ?? null,
      isConquered,
      ascentCount: stats?.ascentCount ?? 0,
      firstAscentAt: stats?.firstAscentAt ?? null,
      lastAscentAt: stats?.lastAscentAt ?? null,
    };
  });

  const totalPeaksInCatalog = peaks.length;
  const completionPct =
    totalPeaksInCatalog > 0
      ? Math.round((conqueredPeaksCount / totalPeaksInCatalog) * 10000) / 100
      : 0;

  return {
    userId,
    totalPeaksInCatalog,
    conqueredPeaksCount,
    completionPct,
    totalAscentsCount,
    highestConqueredPeakMeters,
    cumulativePeakElevationMeters,
    entries,
  };
}
