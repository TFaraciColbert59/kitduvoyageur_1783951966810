import { isActiveMember } from './privacy';
import type {
  ChallengeBadge,
  ChallengeMetric,
  ChallengeParticipantProgress,
  ChallengeScope,
  ClubActivityInput,
  ClubChallenge,
  ClubChallengeSummary,
  ClubMember,
  ClubResult,
} from './types';

function extractMetricValue(activity: ClubActivityInput, metric: ChallengeMetric): number {
  switch (metric) {
    case 'distance_m':
      return Math.max(0, activity.distanceM);
    case 'duration_s':
      return Math.max(0, activity.durationS);
    case 'elevation_gain_m':
      return Math.max(0, activity.elevationGainM);
    case 'activities_count':
      return 1;
  }
}

/**
 * Création d'un défi individuel ou collectif de club.
 */
export function createClubChallenge(params: {
  id: string;
  clubId: string | null;
  scope: ChallengeScope;
  title: string;
  description: string;
  sport: string | null;
  metric: ChallengeMetric;
  targetValue: number;
  startsAt: string;
  endsAt: string;
  badgeTitle: string;
  badgeIcon: string;
  actorUserId: string;
  memberships?: readonly ClubMember[];
}): ClubResult<ClubChallenge> {
  if (!params.title.trim() || params.targetValue <= 0) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Titre et objectif strictement positif requis.',
    };
  }
  if (Date.parse(params.endsAt) <= Date.parse(params.startsAt)) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'La date de fin doit être postérieure au début.',
    };
  }

  if (params.scope === 'club') {
    if (!params.clubId) {
      return {
        ok: false,
        error: 'INVALID_INPUT',
        message: 'clubId requis pour un défi de club.',
      };
    }
    const actor = (params.memberships ?? []).find(
      (m) => m.clubId === params.clubId && m.userId === params.actorUserId,
    );
    if (!actor || !isActiveMember(actor) || (actor.role !== 'admin' && actor.role !== 'moderator')) {
      return {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Seuls les admins/modérateurs du club peuvent créer un défi de club.',
      };
    }
  }

  return {
    ok: true,
    data: {
      id: params.id,
      clubId: params.clubId,
      scope: params.scope,
      title: params.title.trim(),
      description: params.description.trim(),
      sport: params.sport,
      metric: params.metric,
      targetValue: params.targetValue,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      badgeTitle: params.badgeTitle,
      badgeIcon: params.badgeIcon,
      createdBy: params.actorUserId,
    },
  };
}

/**
 * Inscription d'un participant à un défi (membre actif requis si défi de club).
 */
export function joinChallenge(params: {
  challenge: ClubChallenge;
  userId: string;
  memberships: readonly ClubMember[];
  existingProgress: readonly ChallengeParticipantProgress[];
}): ClubResult<ChallengeParticipantProgress> {
  const { challenge, userId, memberships, existingProgress } = params;

  if (challenge.clubId) {
    const member = memberships.find(
      (m) => m.clubId === challenge.clubId && m.userId === userId,
    );
    if (!isActiveMember(member)) {
      return {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Adhésion active au club requise pour rejoindre ce défi.',
      };
    }
  }

  const existing = existingProgress.find(
    (p) => p.challengeId === challenge.id && p.userId === userId,
  );
  if (existing) {
    return { ok: true, data: existing };
  }

  return {
    ok: true,
    data: {
      challengeId: challenge.id,
      userId,
      currentValue: 0,
      recordedActivityIds: [],
      completedAt: null,
      badge: null,
    },
  };
}

/**
 * Enregistrement idempotent d'une activité dans un défi, avec attribution de badge à la complétion.
 */
export function recordActivityInChallenge(params: {
  challenge: ClubChallenge;
  participant: ChallengeParticipantProgress;
  activity: ClubActivityInput;
  nowIso: string;
}): ClubResult<ChallengeParticipantProgress> {
  const { challenge, participant, activity, nowIso } = params;

  if (participant.challengeId !== challenge.id || participant.userId !== activity.userId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Participant ou défi incohérent.' };
  }

  // Idempotence : une même activité ne compte jamais deux fois
  if (participant.recordedActivityIds.includes(activity.id)) {
    return { ok: true, data: participant };
  }

  if (
    challenge.sport &&
    activity.sport.toLowerCase() !== challenge.sport.toLowerCase()
  ) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Sport de l’activité incompatible avec le défi.',
    };
  }

  const actStart = Date.parse(activity.startsAt);
  if (
    actStart < Date.parse(challenge.startsAt) ||
    actStart > Date.parse(challenge.endsAt)
  ) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Activité hors fenêtre temporelle du défi.',
    };
  }

  const delta = extractMetricValue(activity, challenge.metric);
  const nextValue = participant.currentValue + delta;
  const justCompleted =
    challenge.scope === 'individual' &&
    participant.completedAt === null &&
    nextValue >= challenge.targetValue;

  const badge: ChallengeBadge | null = justCompleted
    ? {
        id: `badge_${challenge.id}_${participant.userId}`,
        challengeId: challenge.id,
        title: challenge.badgeTitle,
        icon: challenge.badgeIcon,
        awardedAt: nowIso,
      }
    : participant.badge;

  return {
    ok: true,
    data: {
      ...participant,
      currentValue: nextValue,
      recordedActivityIds: [...participant.recordedActivityIds, activity.id],
      completedAt: justCompleted ? nowIso : participant.completedAt,
      badge,
    },
  };
}

/**
 * Calcul consolidé de la progression d'un défi (individuel ou collectif de club).
 */
export function computeClubChallengeSummary(params: {
  challenge: ClubChallenge;
  participants: readonly ChallengeParticipantProgress[];
  nowIso: string;
}): ClubChallengeSummary {
  const { challenge, participants, nowIso } = params;
  const relevant = participants.filter((p) => p.challengeId === challenge.id);
  const totalProgressValue = relevant.reduce((sum, p) => sum + p.currentValue, 0);
  const progressPct = Math.min(
    100,
    Math.round((totalProgressValue / challenge.targetValue) * 100),
  );
  const isCompleted = totalProgressValue >= challenge.targetValue;

  const badgeAwarded: ChallengeBadge | null = isCompleted
    ? {
        id: `badge_club_${challenge.id}`,
        challengeId: challenge.id,
        title: challenge.badgeTitle,
        icon: challenge.badgeIcon,
        awardedAt: nowIso,
      }
    : null;

  return {
    challenge,
    totalProgressValue,
    progressPct,
    isCompleted,
    completedAt: isCompleted ? nowIso : null,
    participantsCount: relevant.length,
    badgeAwarded,
  };
}
