import type {
  Club,
  ClubEvent,
  ClubMember,
  ClubPrivacy,
  ClubVisibilityAlias,
  P01Visibility,
  S619BlockRelation,
  ViewerPrivacyContext,
} from './types';

function toSet(input?: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  if (!input) return new Set();
  if (input instanceof Set) return input;
  return new Set(input);
}

/**
 * Normalise un alias de visibilité (`public` / `private` / `invite_only`)
 * vers le domaine canonique DB (`open` / `closed` / `secret`).
 * Fail-closed : une valeur inconnue retombe sur `secret`.
 */
export function normalizeClubPrivacy(
  raw: ClubPrivacy | ClubVisibilityAlias | string | null | undefined,
): ClubPrivacy {
  switch (raw) {
    case 'open':
    case 'public':
      return 'open';
    case 'closed':
    case 'private':
      return 'closed';
    case 'secret':
    case 'invite_only':
      return 'secret';
    default:
      return 'secret';
  }
}

/**
 * Vérifie un blocage bilatéral S6.19 entre `userA` et `userB`.
 * Si l'un a bloqué l'autre, la visibilité mutuelle est strictement coupée.
 */
export function isBlockedBetween(
  userA: string | null | undefined,
  userB: string | null | undefined,
  blocks: readonly S619BlockRelation[] | undefined,
): boolean {
  if (!userA || !userB || !blocks || blocks.length === 0) return false;
  if (userA === userB) return false;
  return blocks.some(
    (b) =>
      (b.blockerId === userA && b.blockedId === userB) ||
      (b.blockerId === userB && b.blockedId === userA),
  );
}

/**
 * Détermine si un membre est actuellement actif (non retiré, non banni, non en attente).
 */
export function isActiveMember(member: ClubMember | null | undefined): boolean {
  return Boolean(member && member.status === 'active');
}

/**
 * Fail-closed : détermine si un club est visible pour un viewer donné.
 * - Un club `secret` (sur invitation uniquement) n'est JAMAIS visible hors membre actif.
 * - Un utilisateur banni du club ne peut pas le voir.
 * - Un club créé par un utilisateur bloqué S6.19 est masqué au viewer (sauf s'il en est déjà membre actif, mais même là les contenus de l'utilisateur bloqué sont filtrés).
 */
export function canViewClub(
  club: Club,
  viewerContext: ViewerPrivacyContext,
  memberships: readonly ClubMember[] = [],
): boolean {
  const viewerId = viewerContext.viewerId;
  const viewerMember = viewerId
    ? memberships.find((m) => m.clubId === club.id && m.userId === viewerId)
    : undefined;

  if (viewerMember?.status === 'banned') {
    return false;
  }

  const viewerClubIds = toSet(viewerContext.viewerClubIds);
  const isMember = isActiveMember(viewerMember) || (viewerId !== null && viewerClubIds.has(club.id));

  if (isMember) {
    return true;
  }

  // Fail-closed : un club privé/secret ne fuite jamais hors membres
  if (club.privacy === 'secret') {
    return false;
  }

  // Si le créateur est bloqué S6.19 et que le viewer n'est pas membre
  if (viewerId && isBlockedBetween(viewerId, club.createdBy, viewerContext.blocks)) {
    return false;
  }

  return club.privacy === 'open' || club.privacy === 'closed';
}

/**
 * Fail-closed : détermine si un club peut apparaître dans les résultats de recherche publique.
 * Seuls les clubs `open` (et éventuellement `closed` si explicitement autorisé) apparaissent ;
 * les clubs `secret` / `invite_only` n'apparaissent JAMAIS en recherche publique.
 */
export function canAppearInPublicClubSearch(
  club: Club,
  viewerContext: ViewerPrivacyContext,
  memberships: readonly ClubMember[] = [],
): boolean {
  if (club.privacy === 'secret') {
    return false;
  }
  return canViewClub(club, viewerContext, memberships);
}

/**
 * Contrôle de visibilité P01 + S6.19 pour une activité ou contribution d'un utilisateur.
 * Fail-closed : toute visibilité inconnue ou absente renvoie `false`.
 */
export function canViewUserContribution(
  ownerUserId: string,
  visibility: P01Visibility | null | undefined,
  viewerContext: ViewerPrivacyContext,
  options?: {
    clubId?: string;
    activeClubMemberIds?: ReadonlySet<string> | readonly string[];
    requireLeaderboardOptIn?: boolean;
    memberOptIn?: boolean;
  },
): boolean {
  const viewerId = viewerContext.viewerId;

  // Blocage bilatéral S6.19 prioritaire sur tout
  if (viewerId && isBlockedBetween(viewerId, ownerUserId, viewerContext.blocks)) {
    return false;
  }

  // Opt-out explicite des classements / présence P01
  if (options?.requireLeaderboardOptIn) {
    const hiddenSet = toSet(viewerContext.hiddenFromLeaderboardsUserIds);
    if (hiddenSet.has(ownerUserId) || options.memberOptIn === false) {
      return false;
    }
  }

  if (viewerId && viewerId === ownerUserId) {
    return true;
  }

  switch (visibility) {
    case 'public':
      return true;
    case 'friends': {
      if (!viewerId) return false;
      const friends = toSet(viewerContext.friendIds);
      return friends.has(ownerUserId);
    }
    case 'club_only': {
      if (!viewerId || !options?.clubId) return false;
      const viewerClubs = toSet(viewerContext.viewerClubIds);
      if (viewerClubs.has(options.clubId)) return true;
      const activeMembers = toSet(options.activeClubMemberIds);
      return activeMembers.has(viewerId);
    }
    case 'private':
    default:
      return false;
  }
}

/**
 * Fail-closed : détermine si un événement de club est visible pour le viewer.
 * L'événement hérite d'abord de la confidentialité du club parent, puis de sa propre visibilité P01,
 * puis des blocages S6.19 envers son créateur.
 */
export function canViewClubEvent(
  event: ClubEvent,
  club: Club | undefined,
  viewerContext: ViewerPrivacyContext,
  memberships: readonly ClubMember[] = [],
): boolean {
  if (!club) return false;
  if (!canViewClub(club, viewerContext, memberships)) {
    return false;
  }

  const viewerId = viewerContext.viewerId;
  if (viewerId && isBlockedBetween(viewerId, event.createdBy, viewerContext.blocks)) {
    return false;
  }

  const activeMemberIds = memberships
    .filter((m) => m.clubId === club.id && m.status === 'active')
    .map((m) => m.userId);

  // Un club fermé (`closed`) ou secret (`secret`) restreint ses événements aux membres actifs
  if ((club.privacy === 'secret' || club.privacy === 'closed') && (!viewerId || !activeMemberIds.includes(viewerId))) {
    return false;
  }

  return canViewUserContribution(event.createdBy, event.visibility, viewerContext, {
    clubId: club.id,
    activeClubMemberIds: activeMemberIds,
  });
}

/**
 * Filtre une liste de clubs visibles pour un viewer donné.
 */
export function filterVisibleClubs(
  clubs: readonly Club[],
  viewerContext: ViewerPrivacyContext,
  memberships: readonly ClubMember[] = [],
  options?: { publicSearchOnly?: boolean },
): Club[] {
  return clubs.filter((club) =>
    options?.publicSearchOnly
      ? canAppearInPublicClubSearch(club, viewerContext, memberships)
      : canViewClub(club, viewerContext, memberships),
  );
}
