import { isActiveMember, isBlockedBetween } from './privacy';
import type {
  ClubChannel,
  ClubChannelKind,
  ClubChannelMessage,
  ClubContentReport,
  ClubMember,
  ClubResult,
  ViewerPrivacyContext,
} from './types';

function isMemberMuted(member: ClubMember, nowIso: string): boolean {
  if (!member.mutedUntil) return false;
  return Date.parse(member.mutedUntil) > Date.parse(nowIso);
}

/**
 * S5.07 — Création d'un salon de club (admin ou modérateur uniquement).
 */
export function createClubChannel(params: {
  id: string;
  clubId: string;
  name: string;
  kind: ClubChannelKind;
  readOnlyForMembers?: boolean;
  notificationsEnabledByDefault?: boolean;
  actorMember: ClubMember | undefined;
  nowIso: string;
}): ClubResult<ClubChannel> {
  const { actorMember } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== params.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif du club.' };
  }
  if (actorMember.role !== 'admin' && actorMember.role !== 'moderator') {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Seuls les administrateurs et modérateurs peuvent créer un salon.',
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
      readOnlyForMembers: params.readOnlyForMembers ?? params.kind === 'announcements',
      notificationsEnabledByDefault: params.notificationsEnabledByDefault ?? true,
      createdBy: actorMember.userId,
      createdAt: params.nowIso,
    },
  };
}

/**
 * S5.07 — Publication d'un message dans un salon de club avec contrôle des permissions et du mute.
 */
export function postChannelMessage(params: {
  id: string;
  channel: ClubChannel;
  actorMember: ClubMember | undefined;
  body: string;
  nowIso: string;
}): ClubResult<ClubChannelMessage> {
  const { channel, actorMember, nowIso } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== channel.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Réservé aux membres actifs du club.' };
  }
  if (isMemberMuted(actorMember, nowIso)) {
    return { ok: false, error: 'FORBIDDEN', message: 'Membre temporairement mis en sourdine.' };
  }
  if (
    channel.readOnlyForMembers &&
    actorMember.role !== 'admin' &&
    actorMember.role !== 'moderator'
  ) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Ce salon est en lecture seule pour les membres.',
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

  const isModerator = actorMember.role === 'admin' || actorMember.role === 'moderator';
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
  if (actorMember.role === 'member') {
    return { ok: false, error: 'FORBIDDEN', message: 'Permissions insuffisantes.' };
  }
  if (actorMember.role === 'moderator' && targetMember.role !== 'member') {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Un modérateur ne peut muter qu’un membre standard.',
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
