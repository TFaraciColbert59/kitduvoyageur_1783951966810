import type {
  GhostProfile,
  LiveSegmentDefinition,
  PrivacyContext,
} from './types';

function toSet(ids: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  return ids instanceof Set ? ids : new Set(ids);
}

/**
 * Fail-closed P01 / S6.19 check for whether the viewer can see and run a Live Segment.
 */
export function isSegmentAccessible(
  segment: LiveSegmentDefinition,
  privacy: PrivacyContext,
): boolean {
  if (!privacy.optedInLiveSegments) {
    return false;
  }

  const blocked = toSet(privacy.blockedUserIds);
  if (blocked.has(segment.ownerId)) {
    return false;
  }

  if (segment.isPrivate && segment.ownerId !== privacy.viewerId) {
    return false;
  }

  return segment.points.length >= 2 && segment.totalDistanceM > 0;
}

/**
 * Fail-closed P01 / S6.19 check for an individual ghost target (PR, KOM/QOM, friend, target).
 */
export function isGhostProfileEligible(
  ghost: GhostProfile,
  privacy: PrivacyContext,
): boolean {
  if (!privacy.optedInLiveSegments) {
    return false;
  }

  const blocked = toSet(privacy.blockedUserIds);
  const allowedPeers = toSet(privacy.allowedPeerIds);

  if (ghost.ownerId && blocked.has(ghost.ownerId)) {
    return false;
  }

  const isSelf = ghost.ownerId === privacy.viewerId;

  if (ghost.kind === 'pr' || ghost.kind === 'target') {
    if (ghost.ownerId && !isSelf) {
      return false;
    }
    return ghost.checkpoints.length >= 2 && ghost.totalTimeMs > 0;
  }

  if (!ghost.isOptedIn) {
    return false;
  }

  if (ghost.kind === 'friend') {
    if (!ghost.ownerId) {
      return false;
    }
    if (!isSelf && !allowedPeers.has(ghost.ownerId)) {
      return false;
    }
    return ghost.checkpoints.length >= 2 && ghost.totalTimeMs > 0;
  }

  // kom / qom
  if (!ghost.isPublic && !isSelf && !(ghost.ownerId && allowedPeers.has(ghost.ownerId))) {
    return false;
  }

  return ghost.checkpoints.length >= 2 && ghost.totalTimeMs > 0;
}

/**
 * Returns a sanitized copy of the segment with only eligible ghost profiles,
 * or null if the segment itself is not accessible under P01 / S6.19.
 */
export function sanitizeSegmentForLive(
  segment: LiveSegmentDefinition,
  privacy: PrivacyContext,
): LiveSegmentDefinition | null {
  if (!isSegmentAccessible(segment, privacy)) {
    return null;
  }

  const eligibleGhosts = segment.ghostProfiles.filter((ghost) =>
    isGhostProfileEligible(ghost, privacy),
  );

  return {
    ...segment,
    ghostProfiles: eligibleGhosts,
  };
}

/**
 * Selects the preferred ghost profile from an already-sanitized segment.
 * Priority: requested kind -> PR -> KOM -> QOM -> friend -> target.
 */
export function selectPreferredGhost(
  segment: LiveSegmentDefinition,
  preferredKind?: GhostProfile['kind'],
): GhostProfile | null {
  if (segment.ghostProfiles.length === 0) {
    return null;
  }

  if (preferredKind) {
    const exact = segment.ghostProfiles.find((g) => g.kind === preferredKind);
    if (exact) {
      return exact;
    }
  }

  const order: GhostProfile['kind'][] = ['pr', 'kom', 'qom', 'friend', 'target'];
  for (const kind of order) {
    const match = segment.ghostProfiles.find((g) => g.kind === kind);
    if (match) {
      return match;
    }
  }

  return segment.ghostProfiles[0] ?? null;
}
