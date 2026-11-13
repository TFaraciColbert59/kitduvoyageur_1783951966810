import type {
  AthletePrivacySnapshot,
  EffortRejectionReason,
  LeaderboardScope,
  LeaderboardViewerContext,
  SegmentEffortInput,
} from './types';

export interface PrivacyEvaluationResult {
  allowed: boolean;
  reason?: EffortRejectionReason;
  athlete?: AthletePrivacySnapshot;
}

/**
 * Évalue en mode fail-closed (P01 / S6.19) si un effort est éligible
 * pour être affiché dans un classement donné pour un spectateur donné.
 */
export function evaluateLeaderboardPrivacy(
  effort: SegmentEffortInput,
  scope: LeaderboardScope,
  clubId: string | null,
  viewer: LeaderboardViewerContext,
  privacyDirectory?: ReadonlyMap<string, AthletePrivacySnapshot>
): PrivacyEvaluationResult {
  const athlete = effort.athlete ?? privacyDirectory?.get(effort.userId);
  if (!athlete) {
    return { allowed: false, reason: 'privacy_missing_snapshot' };
  }

  if (athlete.isHiddenOrSuspended) {
    return { allowed: false, reason: 'privacy_hidden_or_suspended' };
  }

  const viewerId = viewer.isAuthenticated ? viewer.viewerId : null;
  const isSelf = Boolean(viewerId && viewerId === effort.userId);

  // S6.19 : blocage bidirectionnel (bloqueur ou bloqué)
  if (
    !isSelf &&
    (viewer.blockedUserIds?.includes(effort.userId) ||
      viewer.blockedByUserIds?.includes(effort.userId))
  ) {
    return { allowed: false, reason: 'privacy_blocked' };
  }

  // S6.19 : mise en sourdine (masqué pour le spectateur)
  if (!isSelf && viewer.mutedUserIds?.includes(effort.userId)) {
    return { allowed: false, reason: 'privacy_muted' };
  }

  // Fail-closed sur l'audience de l'effort : un effort privé ou sans audience
  // ne figure jamais dans les projections de classement (même publiques).
  const audience = effort.audience;
  if (!audience || audience === 'private') {
    return { allowed: false, reason: 'privacy_audience_denied' };
  }

  // Fail-closed sur le consentement explicite aux classements
  if (athlete.leaderboardConsentGranted !== true) {
    return { allowed: false, reason: 'privacy_unconsented' };
  }

  const accountVisibility = athlete.accountVisibility;
  if (!accountVisibility || accountVisibility === 'private') {
    return { allowed: false, reason: 'privacy_private_account' };
  }

  if (scope === 'global') {
    if (accountVisibility !== 'public' || audience !== 'public') {
      return { allowed: false, reason: 'privacy_audience_denied' };
    }
    return { allowed: true, athlete };
  }

  // Les classements amis et club exigent un spectateur authentifié
  if (!viewerId) {
    return { allowed: false, reason: 'privacy_audience_denied' };
  }

  if (scope === 'friends') {
    const isViewerFriend =
      isSelf || Boolean(viewer.friendIds?.includes(effort.userId));
    if (!isViewerFriend) {
      return { allowed: false, reason: 'scope_not_in_friends' };
    }

    // Si le compte est followers_only, l'athlète doit aussi avoir le spectateur
    // dans ses amis autorisés (si la liste est fournie) ou être soi-même.
    if (
      !isSelf &&
      accountVisibility === 'followers_only' &&
      athlete.friendIds &&
      !athlete.friendIds.includes(viewerId)
    ) {
      return { allowed: false, reason: 'privacy_audience_denied' };
    }

    if (audience !== 'public' && audience !== 'friends') {
      return { allowed: false, reason: 'privacy_audience_denied' };
    }

    return { allowed: true, athlete };
  }

  // scope === 'club'
  if (!clubId || !viewer.clubIds?.includes(clubId)) {
    return { allowed: false, reason: 'scope_not_in_club' };
  }

  if (!athlete.clubIds?.includes(clubId)) {
    return { allowed: false, reason: 'scope_not_in_club' };
  }

  if (audience !== 'public' && audience !== 'club') {
    return { allowed: false, reason: 'privacy_audience_denied' };
  }

  return { allowed: true, athlete };
}
