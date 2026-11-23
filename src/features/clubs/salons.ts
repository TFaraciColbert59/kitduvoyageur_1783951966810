import { isActiveMember, isBlockedBetween } from './privacy';
import {
  CLUB_ROLE_RANK,
  type ClubChannel,
  type ClubChannelKind,
  type ClubChannelMessage,
  type ClubContentReport,
  type ClubMember,
  type ClubResult,
  type ClubRole,
  type ViewerPrivacyContext,
} from './types';

function isMemberMuted(member: ClubMember, nowIso: string): boolean {
  if (!member.mutedUntil) return false;
  return Date.parse(member.mutedUntil) > Date.parse(nowIso);
}

export function canViewClubChannel(
  channel: Pick<ClubChannel, 'minRole' | 'archivedAt'>,
  member: ClubMember | undefined | null,
  options?: { includeArchived?: boolean },
): boolean {
  if (!member || !isActiveMember(member)) return false;
  if (channel.archivedAt && !options?.includeArchived) return false;
  const requiredRole: ClubRole = channel.minRole ?? 'member';
  return CLUB_ROLE_RANK[member.role] >= CLUB_ROLE_RANK[requiredRole];
}

/**
 * S5.07 — Création d'un salon de club (fondateur, admin ou modérateur uniquement).
 */
export function createClubChannel(params: {
  id: string;
  clubId: string;
  name: string;
  kind: ClubChannelKind;
  description?: string | null;
  minRole?: ClubRole;
  readOnlyForMembers?: boolean;
  notificationsEnabledByDefault?: boolean;
  position?: number;
  actorMember: ClubMember | undefined;
  nowIso: string;
  allowByCapability?: boolean;
}): ClubResult<ClubChannel> {
  const { actorMember, allowByCapability = false } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== params.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif du club.' };
  }
  if (
    !allowByCapability &&
    actorMember.role !== 'founder' &&
    actorMember.role !== 'admin' &&
    actorMember.role !== 'moderator'
  ) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Seuls les fondateurs, administrateurs et modérateurs peuvent créer un salon.',
    };
  }
  const name = params.name.trim();
  if (!name) {
    return { ok: false, error: 'INVALID_INPUT', message: 'Nom de salon requis.' };
  }

  return {
    ok: true,
    data: {
      id: params.id,
      clubId: params.clubId,
      name,
      kind: params.kind,
      description: params.description?.trim() || null,
      minRole: params.minRole ?? 'member',
      readOnlyForMembers: params.readOnlyForMembers ?? params.kind === 'announcements',
      notificationsEnabledByDefault: params.notificationsEnabledByDefault ?? true,
      position: params.position ?? 0,
      archivedAt: null,
      createdBy: actorMember.userId,
      createdAt: params.nowIso,
    },
  };
}

/**
 * S5.07 — Publication d'un message dans un salon de club avec contrôle des permissions, du minRole et du mute.
 */
export function postChannelMessage(params: {
  id: string;
  channel: ClubChannel;
  actorMember: ClubMember | undefined;
  body: string;
  nowIso: string;
  canPostOverride?: boolean;
  canPostAnnouncementsOverride?: boolean;
}): ClubResult<ClubChannelMessage> {
  const { channel, actorMember, nowIso, canPostOverride, canPostAnnouncementsOverride } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== channel.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Réservé aux membres actifs du club.' };
  }
  if (!canViewClubChannel(channel, actorMember)) {
    return { ok: false, error: 'FORBIDDEN', message: 'Accès à ce salon restreint par rôle ou archivé.' };
  }
  if (isMemberMuted(actorMember, nowIso)) {
    return { ok: false, error: 'FORBIDDEN', message: 'Membre temporairement mis en sourdine.' };
  }
  const hasAnnouncementPermission =
    canPostAnnouncementsOverride !== undefined
      ? canPostAnnouncementsOverride
      : actorMember.role === 'founder' ||
        actorMember.role === 'admin' ||
        actorMember.role === 'moderator';
  if (channel.readOnlyForMembers && !hasAnnouncementPermission) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Ce salon est en lecture seule pour les membres.',
    };
  }
  if (!channel.readOnlyForMembers && canPostOverride === false && !hasAnnouncementPermission) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Publication désactivée pour ce membre.',
    };
  }
  const body = params.body.trim();
  if (!body) {
    return { ok: false, error: 'INVALID_INPUT', message: 'Message vide.' };
  }

  return {
    ok: true,
    data: {
      id: params.id,
      channelId: channel.id,
      clubId: channel.clubId,
      authorId: actorMember.userId,
      body,
      createdAt: nowIso,
      editedAt: null,
      hiddenByModeratorId: null,
      hiddenReason: null,
      deletedAt: null,
    },
  };
}

/**
 * S5.07 — Lecture des messages d'un salon (fail-closed hors membres, filtrage S6.19 et messages modérés).
 */
export function listChannelMessagesForViewer(params: {
  channel: ClubChannel;
  messages: readonly ClubChannelMessage[];
  viewerContext: ViewerPrivacyContext;
  memberships: readonly ClubMember[];
}): ClubResult<ClubChannelMessage[]> {
  const viewerId = params.viewerContext.viewerId;
  if (!viewerId) {
    return { ok: false, error: 'UNAUTHORIZED', message: 'Authentification requise.' };
  }
  const viewerMember = params.memberships.find(
    (m) => m.clubId === params.channel.clubId && m.userId === viewerId,
  );
  if (!isActiveMember(viewerMember)) {
    return { ok: false, error: 'FORBIDDEN', message: 'Accès au salon réservé aux membres actifs.' };
  }
  if (!canViewClubChannel(params.channel, viewerMember, { includeArchived: true })) {
    return { ok: false, error: 'FORBIDDEN', message: 'Salon réservé à un grade supérieur.' };
  }

  const visible = params.messages.filter((msg) => {
    if (msg.channelId !== params.channel.id || msg.clubId !== params.channel.clubId) {
      return false;
    }
    if (msg.deletedAt || msg.hiddenByModeratorId) {
      return false;
    }
    if (isBlockedBetween(viewerId, msg.authorId, params.viewerContext.blocks)) {
      return false;
    }
    return true;
  });

  return { ok: true, data: visible };
}

/**
 * S5.07 — Modération d'un message (masquage par admin/moderator ou suppression par auteur).
 */
export function moderateChannelMessage(params: {
  message: ClubChannelMessage;
  actorMember: ClubMember | undefined;
  action: 'hide' | 'delete';
  reason?: string | null;
  nowIso: string;
}): ClubResult<ClubChannelMessage> {
  const { message, actorMember, action, nowIso } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== message.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif du club.' };
  }

  const isModerator =
    actorMember.role === 'founder' ||
    actorMember.role === 'admin' ||
    actorMember.role === 'moderator';
  const isAuthor = actorMember.userId === message.authorId;

  if (action === 'hide') {
    if (!isModerator) {
      return {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Seuls les administrateurs et modérateurs peuvent masquer un message.',
      };
    }
    return {
      ok: true,
      data: {
        ...message,
        hiddenByModeratorId: actorMember.userId,
        hiddenReason: params.reason ?? 'Modération du salon',
      },
    };
  }

  // action === 'delete'
  if (!isModerator && !isAuthor) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Permissions insuffisantes pour supprimer ce message.',
    };
  }
  return {
    ok: true,
    data: {
      ...message,
      deletedAt: nowIso,
    },
  };
}

/**
 * S5.07 — Mise en sourdine (mute) d'un membre par un admin ou modérateur.
 * Un modérateur ne peut pas muter un admin ni un autre modérateur.
 */
export function muteClubMember(params: {
  clubId: string;
  actorMember: ClubMember | undefined;
  targetMember: ClubMember | undefined;
  mutedUntilIso: string | null;
}): ClubResult<ClubMember> {
  const { actorMember, targetMember } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== params.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif.' };
  }
  if (!targetMember || !isActiveMember(targetMember) || targetMember.clubId !== params.clubId) {
    return { ok: false, error: 'NOT_FOUND', message: 'Membre cible introuvable.' };
  }
  if (actorMember.role === 'member' || actorMember.role === 'volunteer') {
    return { ok: false, error: 'FORBIDDEN', message: 'Permissions insuffisantes.' };
  }
  if (CLUB_ROLE_RANK[actorMember.role] <= CLUB_ROLE_RANK[targetMember.role]) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Impossible de mettre en sourdine un membre de rang égal ou supérieur.',
    };
  }

  return {
    ok: true,
    data: {
      ...targetMember,
      mutedUntil: params.mutedUntilIso,
    },
  };
}

/**
 * S5.07 — Signalement d'un message de salon par un membre actif.
 */
export function reportChannelMessage(params: {
  id: string;
  message: ClubChannelMessage;
  reporterMember: ClubMember | undefined;
  reason: string;
  nowIso: string;
}): ClubResult<ClubContentReport> {
  const { message, reporterMember } = params;
  if (!reporterMember || !isActiveMember(reporterMember) || reporterMember.clubId !== message.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Seuls les membres actifs peuvent signaler.' };
  }
  const reason = params.reason.trim();
  if (!reason) {
    return { ok: false, error: 'INVALID_INPUT', message: 'Motif de signalement requis.' };
  }

  return {
    ok: true,
    data: {
      id: params.id,
      clubId: message.clubId,
      channelId: message.channelId,
      messageId: message.id,
      reporterId: reporterMember.userId,
      reason,
      status: 'open',
      createdAt: params.nowIso,
    },
  };
}
