import { isBlockedBetween } from './privacy';
import type {
  ActivityEventMatch,
  ClubActivityInput,
  ClubEvent,
  ClubResult,
  EventRegistration,
  GroupActivityCluster,
  S619BlockRelation,
} from './types';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeOverlapMinutes(aStartIso: string, aEndIso: string, bStartIso: string, bEndIso: string): number {
  const aStart = Date.parse(aStartIso);
  const aEnd = Date.parse(aEndIso);
  const bStart = Date.parse(bStartIso);
  const bEnd = Date.parse(bEndIso);
  const overlapMs = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
  return overlapMs > 0 ? overlapMs / 60_000 : 0;
}

/**
 * S5.17 — Appariement automatique et idempotent d'une activité éligible à un événement de club.
 * - Exige inscription active (`registered`), sport compatible, fenêtre temporelle proche,
 *   proximité géographique si coordonnées disponibles, et consentement P01.
 * - Si un match existe déjà (actif ou détaché manuellement), ne crée jamais de doublon.
 */
export function matchActivityToClubEvent(params: {
  matchId: string;
  activity: ClubActivityInput;
  event: ClubEvent;
  registrations: readonly EventRegistration[];
  existingMatches: readonly ActivityEventMatch[];
  nowIso: string;
  maxStartDeltaMinutes?: number;
  maxStartDistanceMeters?: number;
}): ClubResult<ActivityEventMatch> {
  const { activity, event, registrations, existingMatches } = params;

  if (activity.allowEventMatching === false || activity.visibility === 'private') {
    return {
      ok: false,
      error: 'PRIVACY_RESTRICTED',
      message: 'Activité exclue de l’appariement par les règles de confidentialité P01.',
    };
  }

  // Idempotence & respect du retrait manuel : si déjà détaché manuellement, on ne ré-apparie pas
  const existing = existingMatches.find(
    (m) => m.activityId === activity.id && m.eventId === event.id,
  );
  if (existing) {
    if (existing.detachedAt) {
      return {
        ok: false,
        error: 'CONFLICT',
        message: 'Activité retirée manuellement de cet événement.',
      };
    }
    return { ok: true, data: existing };
  }

  const reg = registrations.find(
    (r) =>
      r.eventId === event.id &&
      r.userId === activity.userId &&
      r.status === 'registered',
  );
  if (!reg) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'L’utilisateur doit être inscrit à l’événement pour l’appariement.',
    };
  }

  if (activity.sport.toLowerCase() !== event.sport.toLowerCase()) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Sport incompatible entre l’activité et l’événement.',
    };
  }

  const maxDeltaMin = params.maxStartDeltaMinutes ?? 45;
  const deltaMin = Math.abs(Date.parse(activity.startsAt) - Date.parse(event.startsAt)) / 60_000;
  if (deltaMin > maxDeltaMin) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Écart horaire trop important pour l’appariement automatique.',
    };
  }

  let distanceScore = 1;
  if (
    typeof activity.startLat === 'number' &&
    typeof activity.startLng === 'number' &&
    typeof event.lat === 'number' &&
    typeof event.lng === 'number'
  ) {
    const maxDistM = params.maxStartDistanceMeters ?? 5_000;
    const dist = haversineMeters(activity.startLat, activity.startLng, event.lat, event.lng);
    if (dist > maxDistM) {
      return {
        ok: false,
        error: 'INVALID_INPUT',
        message: 'Point de départ trop éloigné du lieu de l’événement.',
      };
    }
    distanceScore = Math.max(0, 1 - dist / maxDistM);
  }

  const timeScore = Math.max(0, 1 - deltaMin / maxDeltaMin);
  const confidenceScore = Number(((timeScore + distanceScore) / 2).toFixed(2));

  return {
    ok: true,
    data: {
      id: params.matchId,
      activityId: activity.id,
      eventId: event.id,
      userId: activity.userId,
      confidenceScore,
      matchedAt: params.nowIso,
      detachedAt: null,
    },
  };
}

/**
 * S5.17 — Retrait manuel du lien entre une activité et un événement par son propriétaire.
 */
export function detachActivityFromEvent(params: {
  match: ActivityEventMatch;
  actorUserId: string;
  nowIso: string;
}): ClubResult<ActivityEventMatch> {
  if (params.match.userId !== params.actorUserId) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Seul le propriétaire de l’activité peut retirer ce lien.',
    };
  }
  return {
    ok: true,
    data: {
      ...params.match,
      detachedAt: params.match.detachedAt ?? params.nowIso,
    },
  };
}

/**
 * S5.18 — Détection automatique des activités réalisées ensemble (extérieur ou indoor).
 * - Respecte P01 (`private` ou `allowGroupDetection === false` exclus).
 * - Respecte S6.19 : deux utilisateurs mutuellement bloqués ne sont jamais regroupés.
 * - Exige un chevauchement temporel minimal et, en extérieur, une proximité de départ.
 */
export function detectGroupActivities(params: {
  activities: readonly ClubActivityInput[];
  blocks?: readonly S619BlockRelation[];
  minOverlapMinutes?: number;
  maxOutdoorDistanceMeters?: number;
}): GroupActivityCluster[] {
  const minOverlap = params.minOverlapMinutes ?? 15;
  const maxDistM = params.maxOutdoorDistanceMeters ?? 1_500;

  const eligible = params.activities.filter(
    (a) => a.visibility !== 'private' && a.allowGroupDetection !== false,
  );

  const visited = new Set<string>();
  const clusters: GroupActivityCluster[] = [];

  for (let i = 0; i < eligible.length; i += 1) {
    const seed = eligible[i];
    if (visited.has(seed.id)) continue;

    const group: ClubActivityInput[] = [seed];
    visited.add(seed.id);

    for (let j = i + 1; j < eligible.length; j += 1) {
      const candidate = eligible[j];
      if (visited.has(candidate.id)) continue;
      if (candidate.userId === seed.userId) continue;
      if (candidate.sport.toLowerCase() !== seed.sport.toLowerCase()) continue;
      if (candidate.isIndoor !== seed.isIndoor) continue;

      const blockedWithAny = group.some((m) =>
        isBlockedBetween(m.userId, candidate.userId, params.blocks),
      );
      if (blockedWithAny) continue;

      const overlap = timeOverlapMinutes(
        seed.startsAt,
        seed.endsAt,
        candidate.startsAt,
        candidate.endsAt,
      );
      if (overlap < minOverlap) continue;

      if (!seed.isIndoor) {
        if (
          typeof seed.startLat !== 'number' ||
          typeof seed.startLng !== 'number' ||
          typeof candidate.startLat !== 'number' ||
          typeof candidate.startLng !== 'number'
        ) {
          continue;
        }
        const dist = haversineMeters(
          seed.startLat,
          seed.startLng,
          candidate.startLat,
          candidate.startLng,
        );
        if (dist > maxDistM) continue;
      }

      group.push(candidate);
      visited.add(candidate.id);
    }

    if (group.length >= 2) {
      const starts = group.map((g) => Date.parse(g.startsAt));
      const ends = group.map((g) => Date.parse(g.endsAt));
      clusters.push({
        id: `grp_${group.map((g) => g.id).sort().join('_')}`,
        sport: seed.sport,
        isIndoor: seed.isIndoor,
        startsAt: new Date(Math.min(...starts)).toISOString(),
        endsAt: new Date(Math.max(...ends)).toISOString(),
        participantUserIds: Array.from(new Set(group.map((g) => g.userId))),
        activityIds: group.map((g) => g.id),
      });
    }
  }

  return clusters;
}
