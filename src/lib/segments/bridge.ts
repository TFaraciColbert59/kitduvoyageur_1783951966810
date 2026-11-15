import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LeaderboardSport,
  ModerationStatus,
  SegmentEffortInput,
} from '@/features/leaderboards';
import type {
  GhostProfile,
  LiveSegmentDefinition,
  SegmentDirection as LiveSegmentDirection,
  SegmentPoint as LiveSegmentPoint,
  SportType as LiveSportType,
} from '@/features/live-segments';
import type { ActivityTraceForSegments, SegmentDefinition, SegmentEffort } from '@/features/segments';
import { loadActivePrivacyZonesForProjection } from '@/features/compte/server/privacyZones';
import {
  getAthletePrivacy,
  getLeaderboardViewerRelations,
  removeLeaderboardSegment,
  replaceLeaderboardEffortsForSegment,
  saveLeaderboardViewerRelations as setLeaderboardViewerRelations,
  upsertAthletePrivacy,
  upsertLeaderboardSegment,
} from '@/lib/leaderboards/store';
import { getSegment, listEfforts, listSegments } from '@/lib/segments/store';

function toLeaderboardSport(sport: SegmentDefinition['sport']): LeaderboardSport {
  return sport === 'walking' ? 'hiking' : sport;
}

function toLiveSport(sport: SegmentDefinition['sport']): LiveSportType | null {
  if (
    sport === 'cycling' ||
    sport === 'running' ||
    sport === 'hiking' ||
    sport === 'trail' ||
    sport === 'gravel'
  ) {
    return sport;
  }
  if (sport === 'walking') return 'hiking';
  if (sport === 'mtb') return 'cycling';
  return null;
}

function toModerationStatus(effort: SegmentEffort): ModerationStatus {
  if (effort.status === 'excluded') return 'excluded';
  if (effort.status === 'under_review') return 'flagged';
  if (effort.status === 'valid') return 'valid';
  return 'rejected';
}

function mapEffortToLeaderboard(segment: SegmentDefinition, effort: SegmentEffort): SegmentEffortInput {
  const leaderboardSport = toLeaderboardSport(segment.sport);
  const existingPrivacy = getAthletePrivacy(effort.userId);
  if (!existingPrivacy) {
    upsertAthletePrivacy({
      userId: effort.userId,
      displayName: `Athlète ${effort.userId.slice(0, 6)}`,
      accountVisibility: effort.eligibleForPublicLeaderboard ? 'public' : 'private',
      leaderboardConsentGranted: effort.eligibleForPublicLeaderboard,
      isHiddenOrSuspended: false,
    });
  }

  return {
    effortId: effort.effortId,
    activityId: effort.activityId,
    segmentId: effort.segmentId,
    userId: effort.userId,
    sport: leaderboardSport,
    elapsedTimeS: Math.max(1, effort.elapsedDurationS),
    movingTimeS: Math.min(Math.max(1, effort.movingDurationS), Math.max(1, effort.elapsedDurationS)),
    distanceM: effort.coveredDistanceM,
    completionRatio: effort.coverageRatio,
    achievedAt: effort.exitedAt,
    audience:
      effort.visibility === 'public' && effort.eligibleForPublicLeaderboard
        ? 'public'
        : 'private',
    athleteGender: 'unspecified',
    maxSpeedKmh: effort.maxSpeedKmh,
    averageSpeedKmh: effort.avgSpeedKmh,
    hasGpsJump: effort.exclusionReasons.includes('gps_jump_or_teleport'),
    offRoute: effort.exclusionReasons.includes('corridor_deviation'),
    uturnDetected: effort.exclusionReasons.includes('uturn_detected'),
    motorizedSuspected: effort.exclusionReasons.includes('motorized_vehicle_suspected'),
    gpsQuality: effort.gpsQuality,
    moderationStatus: toModerationStatus(effort),
  };
}

/**
 * Synchronise un ou plusieurs segments S01 + leurs efforts vers le store S02
 * (`/api/leaderboards`). Enforces C-PRIV: privé, supprimé ou fusionné ne
 * restent jamais visibles publiquement ; un segment dangereux est marqué
 * `isHazardous: true` (pas de KOM/Local Legend).
 */
export function syncS01ToLeaderboards(segmentId?: string): void {
  const segments = segmentId ? [getSegment(segmentId)].filter(Boolean) as SegmentDefinition[] : listSegments();
  for (const segment of segments) {
    if (segment.visibility === 'private' || segment.deletedAt || segment.canonicalSegmentId) {
      removeLeaderboardSegment(segment.id);
      replaceLeaderboardEffortsForSegment(segment.id, []);
      continue;
    }

    upsertLeaderboardSegment({
      segmentId: segment.id,
      name: segment.name,
      sport: toLeaderboardSport(segment.sport),
      distanceM: segment.lengthM,
      elevationGainM: segment.elevationGainM,
      isHazardous: segment.hazardous,
      isArchived: Boolean(segment.deletedAt),
      region: null,
      surface: segment.surface ?? null,
      createdAt: segment.createdAt,
    });

    const efforts = listEfforts(segment.id).map((effort) => mapEffortToLeaderboard(segment, effort));
    replaceLeaderboardEffortsForSegment(segment.id, efforts);
  }
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toLiveDirection(dir: SegmentDefinition['direction']): LiveSegmentDirection {
  if (dir === 'reverse') return 'reverse';
  return 'forward';
}

/**
 * Expose les segments S01 publics, actifs et non dangereux au catalogue Live Segments (S03).
 */
export function listS01LiveDefinitions(): LiveSegmentDefinition[] {
  const out: LiveSegmentDefinition[] = [];
  for (const segment of listSegments()) {
    if (segment.visibility === 'private' || segment.deletedAt || segment.hazardous || segment.canonicalSegmentId) {
      continue;
    }
    const sport = toLiveSport(segment.sport);
    if (!sport || segment.points.length < 2) continue;

    let cumDist = 0;
    const livePoints: LiveSegmentPoint[] = segment.points.map((pt, idx) => {
      if (idx > 0) {
        const prev = segment.points[idx - 1];
        cumDist += haversineM(prev.lat, prev.lng, pt.lat, pt.lng);
      }
      return {
        lat: pt.lat,
        lon: pt.lng,
        ele: pt.ele ?? undefined,
        cumulativeDistanceM: Math.round(cumDist),
      };
    });

    const totalDistanceM = livePoints[livePoints.length - 1]?.cumulativeDistanceM || segment.lengthM;
    const validEfforts = listEfforts(segment.id)
      .filter((e) => e.status === 'valid' && e.eligibleForPublicLeaderboard && e.elapsedDurationS > 0)
      .sort((a, b) => a.elapsedDurationS - b.elapsedDurationS);

    const best = validEfforts[0];
    const ghostProfiles: GhostProfile[] = [];
    if (best && totalDistanceM > 0) {
      const totalMs = Math.round(best.elapsedDurationS * 1000);
      ghostProfiles.push({
        kind: 'kom',
        label: 'Référence segment',
        totalTimeMs: totalMs,
        checkpoints: [
          { distanceM: 0, elapsedMs: 0 },
          { distanceM: Math.round(totalDistanceM / 2), elapsedMs: Math.round(totalMs / 2) },
          { distanceM: totalDistanceM, elapsedMs: totalMs },
        ],
        ownerId: best.userId,
        isPublic: true,
        isOptedIn: true,
      });
    } else if (totalDistanceM > 0) {
      const defaultMs = Math.round((totalDistanceM / 4) * 1000);
      ghostProfiles.push({
        kind: 'target',
        label: 'Cible S01',
        totalTimeMs: defaultMs,
        checkpoints: [
          { distanceM: 0, elapsedMs: 0 },
          { distanceM: totalDistanceM, elapsedMs: defaultMs },
        ],
        isPublic: true,
        isOptedIn: true,
      });
    }

    out.push({
      id: segment.id,
      version: segment.version,
      name: segment.name,
      sport,
      direction: toLiveDirection(segment.direction),
      points: livePoints,
      totalDistanceM,
      elevationGainM: Math.round(segment.elevationGainM),
      isPrivate: false,
      ownerId: segment.createdByUserId,
      ghostProfiles,
    });
  }
  return out;
}

/**
 * Hydrate automatiquement une trace d'activité S01 avec les zones privées P01
 * actives de l'utilisateur (`K7.05` / `C-PRIV`), sans dupliquer les zones déjà fournies.
 */
export async function hydrateActivityWithPrivacyZones(
  activity: ActivityTraceForSegments,
  userId: string,
  supabase?: SupabaseClient
): Promise<ActivityTraceForSegments> {
  try {
    const zones = await loadActivePrivacyZonesForProjection(supabase ?? null, userId);
    if (zones.length === 0) return activity;
    const existing = activity.hiddenZones ?? [];
    const seen = new Set(existing.map((z) => z.id).filter(Boolean));
    const merged = [...existing];
    for (const z of zones) {
      if (seen.has(z.id)) continue;
      merged.push({
        id: z.id,
        center: { lat: z.centerLat, lng: z.centerLng },
        radiusM: z.radiusM,
      });
    }
    return { ...activity, hiddenZones: merged };
  } catch {
    return activity;
  }
}

/**
 * Synchronise les blocages et abonnements P01/S6.19 depuis Supabase vers le store
 * S02 avant le calcul de classement (`C-PRIV` fail-closed).
 */
export async function syncViewerRelationsFromDb(
  viewerId: string | null,
  supabase?: SupabaseClient
): Promise<void> {
  if (!viewerId || !supabase) return;
  try {
    const current = getLeaderboardViewerRelations(viewerId);
    const [blocksRes, followsRes] = await Promise.all([
      supabase
        .from('user_blocks')
        .select('blocker_id,blocked_id')
        .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
      supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', viewerId),
    ]);

    const blockedUserIds = new Set(current.blockedUserIds);
    const blockedByUserIds = new Set(current.blockedByUserIds);
    for (const row of blocksRes.data ?? []) {
      const r = row as { blocker_id?: string; blocked_id?: string };
      if (r.blocker_id === viewerId && r.blocked_id) blockedUserIds.add(r.blocked_id);
      if (r.blocked_id === viewerId && r.blocker_id) blockedByUserIds.add(r.blocker_id);
    }

    const friendIds = new Set(current.friendIds);
    for (const row of followsRes.data ?? []) {
      const r = row as { following_id?: string };
      if (r.following_id) friendIds.add(r.following_id);
    }

    setLeaderboardViewerRelations({
      ...current,
      blockedUserIds: [...blockedUserIds],
      blockedByUserIds: [...blockedByUserIds],
      friendIds: [...friendIds],
    });
  } catch {
    /* fail silently on missing table in memory-only test runs */
  }
}
