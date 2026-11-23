import { isActiveMember, isBlockedBetween, normalizeClubPrivacy } from './privacy';
import {
  CLUB_ROLE_RANK,
  type Club,
  type ClubAnnouncement,
  type ClubCapability,
  type ClubJoinRequest,
  type ClubMember,
  type ClubPrivacy,
  type ClubResult,
  type ClubRole,
  type ClubVisibilityAlias,
  type VerificationBadgeView,
  type ViewerPrivacyContext,
} from './types';

const ROLE_RANK: Record<ClubRole, number> = CLUB_ROLE_RANK;

/**
 * Règle canonique de hiérarchie stricte :
 * - Un acteur de rang R ne peut agir que sur une cible de rang < R.
 * - S'il assigne un nouveau rôle, ce nouveau rôle doit aussi être de rang < R (sauf transfert de propriété réservé à RPC).
 */
export function canManageTargetRole(
  actorRole: ClubRole | null | undefined,
  targetRole: ClubRole | null | undefined,
  newRole?: ClubRole,
): boolean {
  if (!actorRole || !targetRole) return false;
  if (targetRole === 'founder') return false;
  const actorRank = CLUB_ROLE_RANK[actorRole];
  const targetRank = CLUB_ROLE_RANK[targetRole];
  if (actorRank <= targetRank) return false;
  if (newRole) {
    if (newRole === 'founder') return false;
    if (actorRank <= CLUB_ROLE_RANK[newRole]) return false;
  }
  return true;
}

/**
 * Règle canonique anti-escalade sur la délégation de capacité :
 * - Le Fondateur peut toujours activer/désactiver n'importe quelle capacité sur les rôles/membres inférieurs.
 * - Un non-Fondateur doit détenir `permissions.delegate` ET la capacité concernée, et agir sur un rang < au sien.
 */
export function canDelegateCapability(params: {
  actorRole: ClubRole | null | undefined;
  actorCapabilities: ReadonlySet<ClubCapability> | readonly ClubCapability[];
  targetRole: ClubRole | null | undefined;
  capability: ClubCapability;
}): boolean {
  const { actorRole, actorCapabilities, targetRole, capability } = params;
  if (!actorRole || !targetRole) return false;
  if (targetRole === 'founder') return false;
  if (capability === 'club.delete' || capability === 'club.transfer_ownership') {
    return false;
  }
  if (actorRole === 'founder') return true;
  if (CLUB_ROLE_RANK[actorRole] <= CLUB_ROLE_RANK[targetRole]) return false;
  const capSet =
    actorCapabilities instanceof Set ? actorCapabilities : new Set(actorCapabilities);
  return capSet.has('permissions.delegate') && capSet.has(capability);
}

export interface CreateClubInput {
  id: string;
  slug: string;
  name: string;
  description: string;
  primarySport: string;
  sports?: readonly string[];
  privacy: ClubPrivacy | ClubVisibilityAlias;
  zoneLabel?: string | null;
  coverImage?: string | null;
  rules?: string | null;
  joinQuestions?: readonly string[];
  creatorUserId: string;
  creatorDisplayName: string;
  creatorAvatarUrl?: string | null;
  nowIso: string;
}

export function createClubWithFounder(input: CreateClubInput): ClubResult<{
  club: Club;
  founderMember: ClubMember;
}> {
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (!name || !slug || !input.creatorUserId) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Nom, slug et créateur requis pour créer un club.',
    };
  }

  const sports = input.sports && input.sports.length > 0
    ? Array.from(new Set([input.primarySport, ...input.sports]))
    : [input.primarySport];

  const club: Club = {
    id: input.id,
    slug,
    name,
    description: input.description.trim(),
    primarySport: input.primarySport,
    sports,
    privacy: normalizeClubPrivacy(input.privacy),
    zoneLabel: input.zoneLabel ?? null,
    coverImage: input.coverImage ?? null,
    rules: input.rules ?? null,
    joinQuestions: input.joinQuestions ?? [],
    verification: {
      status: 'unverified',
      verifiedAt: null,
      badgeLabel: null,
      eligibleSports: [],
    },
    createdBy: input.creatorUserId,
    createdAt: input.nowIso,
  };

  const founderMember: ClubMember = {
    clubId: club.id,
    userId: input.creatorUserId,
    displayName: input.creatorDisplayName,
    avatarUrl: input.creatorAvatarUrl ?? null,
    role: 'founder',
    status: 'active',
    joinedAt: input.nowIso,
    leaderboardOptIn: true,
    canManageStories: true,
    canManageGear: true,
  };

  return { ok: true, data: { club, founderMember } };
}

/**
 * Adhésion directe (club `open`) ou demande d'adhésion (club `closed`).
 * Un club `secret` (sur invitation uniquement) refuse toute adhésion directe sans invitation.
 */
export function requestOrJoinClub(params: {
  club: Club;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  existingMemberships: readonly ClubMember[];
  message?: string | null;
  answers?: readonly string[];
  requestId: string;
  nowIso: string;
}): ClubResult<{ member?: ClubMember; joinRequest?: ClubJoinRequest }> {
  const { club, userId, existingMemberships } = params;
  const existing = existingMemberships.find(
    (m) => m.clubId === club.id && m.userId === userId,
  );

  if (existing?.status === 'banned') {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Utilisateur banni de ce club.',
    };
  }

  if (existing?.status === 'active') {
    return {
      ok: false,
      error: 'CONFLICT',
      message: 'Utilisateur déjà membre actif de ce club.',
    };
  }

  if (club.privacy === 'secret') {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Ce club est sur invitation uniquement.',
    };
  }

  if (club.privacy === 'open') {
    const member: ClubMember = {
      clubId: club.id,
      userId,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl ?? null,
      role: 'member',
      status: 'active',
      joinedAt: params.nowIso,
      leaderboardOptIn: true,
    };
    return { ok: true, data: { member } };
  }

  // club.privacy === 'closed'
  const joinRequest: ClubJoinRequest = {
    id: params.requestId,
    clubId: club.id,
    userId,
    displayName: params.displayName,
    message: params.message ?? null,
    answers: params.answers ?? [],
    status: 'pending',
    createdAt: params.nowIso,
  };
  return { ok: true, data: { joinRequest } };
}

/**
 * Approbation ou rejet d'une demande d'adhésion par un `admin` ou `moderator` actif.
 */
export function reviewJoinRequest(params: {
  request: ClubJoinRequest;
  actorMember: ClubMember | undefined;
  approve: boolean;
  nowIso: string;
  allowByCapability?: boolean;
}): ClubResult<{ updatedRequest: ClubJoinRequest; newMember?: ClubMember }> {
  const { request, actorMember, approve, nowIso, allowByCapability = false } = params;

  if (!isActiveMember(actorMember) || !actorMember) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif.' };
  }
  if (actorMember.clubId !== request.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur hors du club cible.' };
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
      message: 'Seul un fondateur, administrateur ou modérateur peut traiter les demandes.',
    };
  }
  if (request.status !== 'pending') {
    return {
      ok: false,
      error: 'CONFLICT',
      message: 'La demande a déjà été traitée.',
    };
  }

  const updatedRequest: ClubJoinRequest = {
    ...request,
    status: approve ? 'approved' : 'rejected',
    reviewedBy: actorMember.userId,
    reviewedAt: nowIso,
  };

  if (!approve) {
    return { ok: true, data: { updatedRequest } };
  }

  const newMember: ClubMember = {
    clubId: request.clubId,
    userId: request.userId,
    displayName: request.displayName,
    avatarUrl: null,
    role: 'member',
    status: 'active',
    joinedAt: nowIso,
    leaderboardOptIn: true,
  };

  return { ok: true, data: { updatedRequest, newMember } };
}

/**
 * Changement de rôle dans un club.
 *
 * Invariants stricts :
 * 1. Aucune auto-promotion de rôle (`actorId === targetId` avec rang supérieur interdit).
 * 2. Seul un `admin` actif peut modifier les rôles.
 * 3. Le dernier `admin` actif ne peut jamais être rétrogradé.
 */
export function changeMemberRole(params: {
  clubId: string;
  actorUserId: string;
  targetUserId: string;
  newRole: ClubRole;
  memberships: readonly ClubMember[];
}): ClubResult<ClubMember[]> {
  const { clubId, actorUserId, targetUserId, newRole, memberships } = params;

  const actor = memberships.find(
    (m) => m.clubId === clubId && m.userId === actorUserId,
  );
  const target = memberships.find(
    (m) => m.clubId === clubId && m.userId === targetUserId,
  );

  if (!actor || !isActiveMember(actor)) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif.' };
  }
  if (!target || !isActiveMember(target)) {
    return { ok: false, error: 'NOT_FOUND', message: 'Membre cible introuvable ou inactif.' };
  }

  // Invariant 1 : aucune auto-promotion
  if (actorUserId === targetUserId && ROLE_RANK[newRole] > ROLE_RANK[target.role]) {
    return {
      ok: false,
      error: 'SELF_PROMOTION_FORBIDDEN',
      message: 'Auto-promotion de rôle strictement interdite.',
    };
  }

  // Invariant 2 : seul le fondateur ou un admin peut changer un rôle
  if (actor.role !== 'founder' && actor.role !== 'admin') {
    if (actorUserId === targetUserId && ROLE_RANK[newRole] > ROLE_RANK[actor.role]) {
      return {
        ok: false,
        error: 'SELF_PROMOTION_FORBIDDEN',
        message: 'Auto-promotion de rôle strictement interdite.',
      };
    }
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Seul un administrateur peut modifier les rôles du club.',
    };
  }

  // Invariant 3 : protection du dernier admin/fondateur
  if ((target.role === 'admin' || target.role === 'founder') && newRole !== 'admin' && newRole !== 'founder') {
    const activeAdminsCount = memberships.filter(
      (m) => m.clubId === clubId && m.status === 'active' && (m.role === 'admin' || m.role === 'founder'),
    ).length;
    if (activeAdminsCount <= 1) {
      return {
        ok: false,
        error: 'LAST_ADMIN_PROTECTED',
        message: 'Impossible de rétrograder le dernier administrateur du club.',
      };
    }
  }

  if (target.role === 'founder' && newRole !== 'founder') {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Le fondateur du club ne peut pas être rétrogradé.',
    };
  }

  if ((target.role === 'admin' || newRole === 'admin' || newRole === 'founder') && actor.role !== 'founder') {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Seul le fondateur peut nommer ou rétrograder un administrateur.',
    };
  }

  const updated = memberships.map((m) =>
    m.clubId === clubId && m.userId === targetUserId
      ? { ...m, role: newRole }
      : m,
  );

  return { ok: true, data: updated };
}

/**
 * Départ volontaire ou expulsion/bannissement d'un membre.
 * Protège le dernier administrateur contre un départ ou une expulsion sans relève.
 */
export function removeOrBanClubMember(params: {
  clubId: string;
  actorUserId: string;
  targetUserId: string;
  mode: 'leave' | 'remove' | 'ban';
  memberships: readonly ClubMember[];
}): ClubResult<ClubMember[]> {
  const { clubId, actorUserId, targetUserId, mode, memberships } = params;

  const actor = memberships.find((m) => m.clubId === clubId && m.userId === actorUserId);
  const target = memberships.find((m) => m.clubId === clubId && m.userId === targetUserId);

  if (!actor || !isActiveMember(actor)) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif.' };
  }
  if (!target || target.status === 'removed' || target.status === 'banned') {
    return { ok: false, error: 'NOT_FOUND', message: 'Membre cible introuvable.' };
  }

  if (mode === 'leave') {
    if (actorUserId !== targetUserId) {
      return { ok: false, error: 'FORBIDDEN', message: 'Un membre ne peut quitter que pour lui-même.' };
    }
  } else {
    if (actorUserId === targetUserId) {
      return { ok: false, error: 'INVALID_INPUT', message: 'Utilisez leave pour quitter le club.' };
    }
    const actorRank = ROLE_RANK[actor.role];
    const targetRank = ROLE_RANK[target.role];
    if (actor.role === 'member' || actor.role === 'volunteer' || actorRank <= targetRank) {
      return {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Permissions insuffisantes pour retirer ou bannir ce membre.',
      };
    }
  }

  if (target.role === 'founder') {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Le fondateur ne peut pas quitter ou être retiré sans transférer la propriété.',
    };
  }

  if (target.role === 'admin') {
    const activeAdminsCount = memberships.filter(
      (m) => m.clubId === clubId && m.status === 'active' && (m.role === 'admin' || m.role === 'founder'),
    ).length;
    if (activeAdminsCount <= 1) {
      return {
        ok: false,
        error: 'LAST_ADMIN_PROTECTED',
        message: 'Le dernier administrateur ne peut pas quitter ou être retiré sans successeur.',
      };
    }
  }

  const nextStatus: ClubMember['status'] = mode === 'ban' ? 'banned' : 'removed';
  const updated = memberships.map((m) =>
    m.clubId === clubId && m.userId === targetUserId
      ? { ...m, status: nextStatus }
      : m,
  );

  return { ok: true, data: updated };
}

/**
 * Création d'une annonce de club (réservée aux admins et modérateurs).
 */
export function createClubAnnouncement(params: {
  id: string;
  clubId: string;
  actorMember: ClubMember | undefined;
  title: string;
  body: string;
  pinned?: boolean;
  nowIso: string;
}): ClubResult<ClubAnnouncement> {
  const { actorMember } = params;
  if (!isActiveMember(actorMember) || !actorMember || actorMember.clubId !== params.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif du club.' };
  }
  if (
    actorMember.role !== 'founder' &&
    actorMember.role !== 'admin' &&
    actorMember.role !== 'moderator'
  ) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Seuls les fondateurs, administrateurs et modérateurs peuvent publier une annonce.',
    };
  }
  if (!params.title.trim() || !params.body.trim()) {
    return { ok: false, error: 'INVALID_INPUT', message: 'Titre et contenu requis.' };
  }

  return {
    ok: true,
    data: {
      id: params.id,
      clubId: params.clubId,
      authorId: actorMember.userId,
      title: params.title.trim(),
      body: params.body.trim(),
      pinned: Boolean(params.pinned),
      createdAt: params.nowIso,
    },
  };
}

/**
 * Liste les annonces d'un club pour un membre actif, en filtrant les auteurs bloqués S6.19.
 */
export function listClubAnnouncementsForMember(params: {
  clubId: string;
  announcements: readonly ClubAnnouncement[];
  viewerContext: ViewerPrivacyContext;
  memberships: readonly ClubMember[];
}): ClubResult<ClubAnnouncement[]> {
  const viewerId = params.viewerContext.viewerId;
  if (!viewerId) {
    return { ok: false, error: 'UNAUTHORIZED', message: 'Authentification requise.' };
  }
  const viewerMember = params.memberships.find(
    (m) => m.clubId === params.clubId && m.userId === viewerId,
  );
  if (!isActiveMember(viewerMember)) {
    return { ok: false, error: 'FORBIDDEN', message: 'Réservé aux membres actifs du club.' };
  }

  const visible = params.announcements.filter(
    (a) =>
      a.clubId === params.clubId &&
      !isBlockedBetween(viewerId, a.authorId, params.viewerContext.blocks),
  );
  return { ok: true, data: visible };
}

/**
 * S5.10 — Évaluation du badge « Club vérifié » selon éligibilité sport et autorisation.
 */
export function evaluateClubVerificationBadge(params: {
  club: Club;
  sportContext?: string | null;
  isAuthorizedContext: boolean;
}): VerificationBadgeView {
  const { club, sportContext, isAuthorizedContext } = params;
  if (!isAuthorizedContext || club.verification.status !== 'verified') {
    return { visible: false, kind: null, label: null, sport: null };
  }
  if (
    sportContext &&
    club.verification.eligibleSports.length > 0 &&
    !club.verification.eligibleSports.includes(sportContext)
  ) {
    return { visible: false, kind: null, label: null, sport: null };
  }
  return {
    visible: true,
    kind: 'club_verified',
    label: club.verification.badgeLabel ?? 'Club vérifié',
    sport: sportContext ?? club.primarySport,
  };
}

/**
 * S5.10 — Évaluation du badge « Pro sportif » d'un membre.
 */
export function evaluateProAthleteBadge(params: {
  member: ClubMember;
  sportContext?: string | null;
  viewerContext: ViewerPrivacyContext;
}): VerificationBadgeView {
  const { member, sportContext, viewerContext } = params;
  if (
    !member.isProAthlete ||
    !isActiveMember(member) ||
    (viewerContext.viewerId &&
      isBlockedBetween(viewerContext.viewerId, member.userId, viewerContext.blocks))
  ) {
    return { visible: false, kind: null, label: null, sport: null };
  }
  if (
    sportContext &&
    member.verifiedSports &&
    member.verifiedSports.length > 0 &&
    !member.verifiedSports.includes(sportContext)
  ) {
    return { visible: false, kind: null, label: null, sport: null };
  }
  return {
    visible: true,
    kind: 'pro_athlete',
    label: 'Pro sportif',
    sport: sportContext ?? member.verifiedSports?.[0] ?? null,
  };
}
