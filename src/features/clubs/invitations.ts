import { isActiveMember, isBlockedBetween } from './privacy';
import type {
  Club,
  ClubEvent,
  ClubMember,
  ClubResult,
  EventRegistration,
  InviteLink,
  InviteTargetKind,
  ParticipantRouteSyncState,
  RecordedActivityInvite,
  RouteRevisionSnapshot,
  ViewerPrivacyContext,
} from './types';

/**
 * K5.21 / K5.22 — Création d'un lien ou QR d'invitation pour un club, une sortie ou une activité.
 */
export function createInviteLink(params: {
  id: string;
  token: string;
  kind: InviteTargetKind;
  targetId: string;
  clubId: string | null;
  actorUserId: string;
  memberships: readonly ClubMember[];
  baseUrl: string;
  expiresAt: string | null;
  maxUses: number | null;
  nowIso: string;
}): ClubResult<InviteLink> {
  if (params.clubId) {
    const actor = params.memberships.find(
      (m) => m.clubId === params.clubId && m.userId === params.actorUserId,
    );
    if (!isActiveMember(actor)) {
      return {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Seul un membre actif du club peut générer une invitation.',
      };
    }
  }

  if (!params.token.trim() || !params.targetId.trim()) {
    return { ok: false, error: 'INVALID_INPUT', message: 'Token et cible requis.' };
  }

  if (params.maxUses !== null && params.maxUses < 1) {
    return { ok: false, error: 'INVALID_INPUT', message: 'maxUses doit être >= 1.' };
  }

  const cleanBase = params.baseUrl.replace(/\/+$/, '');
  const shareUrl = `${cleanBase}/invite/${encodeURIComponent(params.token)}`;
  const qrPayload = `lkdv://invite/${params.kind}/${params.targetId}?token=${encodeURIComponent(params.token)}`;

  return {
    ok: true,
    data: {
      id: params.id,
      token: params.token,
      kind: params.kind,
      targetId: params.targetId,
      clubId: params.clubId,
      createdBy: params.actorUserId,
      createdAt: params.nowIso,
      expiresAt: params.expiresAt,
      maxUses: params.maxUses,
      usesCount: 0,
      revokedAt: null,
      qrPayload,
      shareUrl,
    },
  };
}

/**
 * K5.21 / K5.22 — Validation et consommation atomique d'un lien/QR d'invitation.
 * - Refuse un lien révoqué, expiré, ou déjà épuisé (empêche la double consommation d'une invitation unique).
 * - Refuse si un blocage S6.19 existe entre l'émetteur et le destinataire, ou si l'utilisateur est banni.
 */
export function redeemInviteLink(params: {
  invite: InviteLink;
  redeemerUserId: string;
  memberships: readonly ClubMember[];
  privacyContext: ViewerPrivacyContext;
  nowIso: string;
}): ClubResult<InviteLink> {
  const { invite, redeemerUserId, memberships, privacyContext, nowIso } = params;

  if (invite.revokedAt) {
    return { ok: false, error: 'INVITE_REVOKED', message: 'Lien d’invitation révoqué.' };
  }

  if (invite.expiresAt && Date.parse(invite.expiresAt) <= Date.parse(nowIso)) {
    return { ok: false, error: 'INVITE_EXPIRED', message: 'Lien d’invitation expiré.' };
  }

  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
    return {
      ok: false,
      error: 'INVITE_EXHAUSTED',
      message: 'Nombre maximal d’utilisations de l’invitation atteint.',
    };
  }

  if (isBlockedBetween(invite.createdBy, redeemerUserId, privacyContext.blocks)) {
    return {
      ok: false,
      error: 'BLOCKED_USER',
      message: 'Invitation indisponible suite à un blocage utilisateur.',
    };
  }

  if (invite.clubId) {
    const member = memberships.find(
      (m) => m.clubId === invite.clubId && m.userId === redeemerUserId,
    );
    if (member?.status === 'banned') {
      return {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Utilisateur banni du club.',
      };
    }
  }

  return {
    ok: true,
    data: {
      ...invite,
      usesCount: invite.usesCount + 1,
    },
  };
}

/**
 * Révocation explicite d'une invitation par son créateur ou un admin/modérateur du club.
 */
export function revokeInviteLink(params: {
  invite: InviteLink;
  actorUserId: string;
  memberships: readonly ClubMember[];
  nowIso: string;
}): ClubResult<InviteLink> {
  const { invite, actorUserId, memberships, nowIso } = params;
  const isCreator = invite.createdBy === actorUserId;
  const clubActor = invite.clubId
    ? memberships.find((m) => m.clubId === invite.clubId && m.userId === actorUserId)
    : undefined;
  const isClubModerator =
    isActiveMember(clubActor) &&
    (clubActor?.role === 'admin' || clubActor?.role === 'moderator');

  if (!isCreator && !isClubModerator) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Permissions insuffisantes pour révoquer cette invitation.',
    };
  }

  return {
    ok: true,
    data: {
      ...invite,
      revokedAt: invite.revokedAt ?? nowIso,
    },
  };
}

/**
 * K5.23 — Publication d'une nouvelle révision du tracé d'une sortie par un organisateur autorisé.
 */
export function publishEventRouteRevision(params: {
  event: ClubEvent;
  actorMember: ClubMember | undefined;
  routeId: string;
  checksum: string;
  distanceM: number;
  elevationGainM: number;
  requiresParticipantDecision?: boolean;
  nowIso: string;
}): ClubResult<{ event: ClubEvent; snapshot: RouteRevisionSnapshot }> {
  const { event, actorMember } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== event.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif du club.' };
  }
  const canEdit =
    actorMember.role === 'admin' ||
    actorMember.role === 'moderator' ||
    actorMember.userId === event.createdBy;
  if (!canEdit) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Permissions insuffisantes pour modifier le tracé de la sortie.',
    };
  }

  const nextRevision = event.routeRevision + 1;
  const updatedEvent: ClubEvent = {
    ...event,
    routeId: params.routeId,
    routeRevision: nextRevision,
  };

  const snapshot: RouteRevisionSnapshot = {
    eventId: event.id,
    routeId: params.routeId,
    revision: nextRevision,
    checksum: params.checksum,
    distanceM: params.distanceM,
    elevationGainM: params.elevationGainM,
    updatedBy: actorMember.userId,
    updatedAt: params.nowIso,
    requiresParticipantDecision: Boolean(params.requiresParticipantDecision),
  };

  return { ok: true, data: { event: updatedEvent, snapshot } };
}

/**
 * K5.23 — Synchronisation idempotente d'une révision de tracé vers un participant.
 * Fail-closed : si le participant a été retiré/banni du club ou désinscrit de l'événement,
 * la révision est refusée et son état est marqué `revoked: true`.
 */
export function syncParticipantRouteRevision(params: {
  event: ClubEvent;
  club: Club;
  snapshot: RouteRevisionSnapshot;
  participantUserId: string;
  currentSync: ParticipantRouteSyncState | undefined;
  memberships: readonly ClubMember[];
  registrations: readonly EventRegistration[];
  nowIso: string;
}): ClubResult<ParticipantRouteSyncState> {
  const {
    event,
    club,
    snapshot,
    participantUserId,
    currentSync,
    memberships,
    registrations,
    nowIso,
  } = params;

  const member = memberships.find(
    (m) => m.clubId === club.id && m.userId === participantUserId,
  );
  const reg = registrations.find(
    (r) => r.eventId === event.id && r.userId === participantUserId,
  );

  const isBanned = member?.status === 'banned' || member?.status === 'removed';
  const isRegistered = reg?.status === 'registered';

  if (isBanned || !isRegistered || (club.privacy !== 'open' && !isActiveMember(member))) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Accès au tracé révoqué : participant retiré ou non inscrit.',
    };
  }

  // Idempotence : si la révision est déjà synchronisée, on renvoie l'état inchangé
  if (currentSync && currentSync.lastSyncedRevision >= snapshot.revision && !currentSync.revoked) {
    return { ok: true, data: currentSync };
  }

  return {
    ok: true,
    data: {
      eventId: event.id,
      userId: participantUserId,
      lastSyncedRevision: snapshot.revision,
      pendingRevision: snapshot.requiresParticipantDecision ? snapshot.revision : null,
      decisionRequired: snapshot.requiresParticipantDecision,
      revoked: false,
      syncedAt: nowIso,
    },
  };
}

/**
 * S5.19 — Inviter un ami à réutiliser une trace d'activité enregistrée.
 */
export function inviteFriendToRecordedActivity(params: {
  id: string;
  activityId: string;
  ownerUserId: string;
  inviteeUserId: string;
  privacyContext: ViewerPrivacyContext;
  existingInvites: readonly RecordedActivityInvite[];
  nowIso: string;
}): ClubResult<RecordedActivityInvite> {
  const { ownerUserId, inviteeUserId, privacyContext, existingInvites } = params;
  if (ownerUserId === inviteeUserId) {
    return { ok: false, error: 'INVALID_INPUT', message: 'Impossible de s’auto-inviter.' };
  }
  if (isBlockedBetween(ownerUserId, inviteeUserId, privacyContext.blocks)) {
    return {
      ok: false,
      error: 'BLOCKED_USER',
      message: 'Invitation bloquée par les règles S6.19.',
    };
  }
  const duplicate = existingInvites.find(
    (i) =>
      i.activityId === params.activityId &&
      i.inviteeUserId === inviteeUserId &&
      (i.status === 'pending' || i.status === 'accepted'),
  );
  if (duplicate) {
    return { ok: false, error: 'CONFLICT', message: 'Invitation déjà active pour cet ami.' };
  }

  return {
    ok: true,
    data: {
      id: params.id,
      activityId: params.activityId,
      ownerUserId,
      inviteeUserId,
      status: 'pending',
      createdAt: params.nowIso,
      respondedAt: null,
    },
  };
}

/**
 * S5.19 — Acceptation, refus ou révocation d'une invitation sur activité enregistrée.
 */
export function updateRecordedActivityInvite(params: {
  invite: RecordedActivityInvite;
  actorUserId: string;
  action: 'accept' | 'decline' | 'revoke';
  privacyContext: ViewerPrivacyContext;
  nowIso: string;
}): ClubResult<RecordedActivityInvite> {
  const { invite, actorUserId, action, privacyContext, nowIso } = params;

  if (action === 'revoke') {
    if (actorUserId !== invite.ownerUserId) {
      return { ok: false, error: 'FORBIDDEN', message: 'Seul le propriétaire peut révoquer.' };
    }
    return {
      ok: true,
      data: { ...invite, status: 'revoked', respondedAt: nowIso },
    };
  }

  if (actorUserId !== invite.inviteeUserId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Seul l’invité peut répondre.' };
  }
  if (invite.status === 'revoked') {
    return { ok: false, error: 'INVITE_REVOKED', message: 'Invitation révoquée.' };
  }
  if (isBlockedBetween(invite.ownerUserId, invite.inviteeUserId, privacyContext.blocks)) {
    return { ok: false, error: 'BLOCKED_USER', message: 'Action bloquée par S6.19.' };
  }

  return {
    ok: true,
    data: {
      ...invite,
      status: action === 'accept' ? 'accepted' : 'declined',
      respondedAt: nowIso,
    },
  };
}
