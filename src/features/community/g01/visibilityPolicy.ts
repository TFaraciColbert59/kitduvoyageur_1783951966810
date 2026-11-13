/**
 * G01 — politique de visibilité d'une activité et de sa carte publiée.
 *
 * Fail-closed : toute donnée manquante ou inconnue refuse l'accès. La politique
 * ne remplace pas la RLS ; elle est une seconde barrière côté présentation et
 * le dernier mot revient toujours à PostgreSQL. Elle sert surtout à empêcher
 * qu'une carte, un aperçu ou un lien affiche des statistiques alors que la
 * séance ou l'audience ne le permettent pas.
 *
 * Précédence :
 *   1. propriétaire (sa propre séance reste visible pour lui) ;
 *   2. blocage (symétrique) ;
 *   3. visibilité de la séance (`private` = jamais pour un tiers) ;
 *   4. statut du partage (`revoked` = carte retirée) ;
 *   5. audience de la publication (`public`, `abonnies`, `club`).
 */

import {
  isKnownActivityVisibility,
  isUuid,
  normalizeActivityVisibility,
  normalizeShareAudience,
  normalizeShareStatus,
  positiveInteger,
  nonEmptyString,
  type ActivityVisibility,
  type ShareAudience,
} from './contracts';

export interface ViewerFacts {
  viewerId?: string | null;
  /** `true` seulement si le suivi est prouvé ; absent = non-abonné. */
  isFollower?: boolean | null;
  /** Clubs dont le lecteur est membre actif (preuve fournie par l'appelant). */
  activeClubIds?: readonly string[] | null;
  /**
   * `true` = blocage dans un sens ou l'autre ; `false` = absence vérifiée ;
   * `null`/absent = inconnu. Un inconnu refuse l'accès à un compte connecté.
   */
  blocked?: boolean | null;
}

export interface ActivityFacts {
  id?: string | null;
  ownerId?: string | null;
  /** Valeur brute `hike_sessions.visibility`. */
  visibility?: unknown;
}

export interface ShareFacts {
  status?: unknown;
  version?: unknown;
  revokedAt?: string | null;
}

export interface ActivityAccessInput {
  activity?: ActivityFacts | null;
  viewer?: ViewerFacts | null;
}

export interface SharedActivityAccessInput extends ActivityAccessInput {
  share?: ShareFacts | null;
  audience?: unknown;
  clubId?: string | null;
}

export type ActivityAccessReason =
  | 'owner'
  | 'visible'
  | 'public'
  | 'anonymous_public'
  | 'follower'
  | 'club_member'
  | 'missing_activity'
  | 'missing_owner'
  | 'blocked'
  | 'blocked_unknown'
  | 'activity_private'
  | 'unknown_visibility'
  | 'invalid_share'
  | 'share_not_active'
  | 'unknown_audience'
  | 'followers_only'
  | 'club_missing'
  | 'club_mismatch';

export interface ActivityAccess {
  allowed: boolean;
  reason: ActivityAccessReason;
  isOwner: boolean;
  isAnonymous: boolean;
  visibility: ActivityVisibility;
  audience: ShareAudience | null;
  /** Une carte partagée ne contient jamais de trace brute. */
  traceAllowed: false;
}

function deny(
  reason: ActivityAccessReason,
  facts: {
    isOwner: boolean;
    isAnonymous: boolean;
    visibility: ActivityVisibility;
    audience: ShareAudience | null;
  }
): ActivityAccess {
  return { allowed: false, reason, ...facts, traceAllowed: false };
}

function allow(
  reason: ActivityAccessReason,
  facts: {
    isOwner: boolean;
    isAnonymous: boolean;
    visibility: ActivityVisibility;
    audience: ShareAudience | null;
  }
): ActivityAccess {
  return { allowed: true, reason, ...facts, traceAllowed: false };
}

/**
 * Accès à la séance elle-même (hors carte publiée) : propriétaire, blocage et
 * visibilité de la séance. L'audience de publication est évaluée par
 * `resolveSharedActivityAccess`.
 */
export function resolveActivityAccess(input: ActivityAccessInput = {}): ActivityAccess {
  const activity = input.activity ?? null;
  const viewer = input.viewer ?? {};
  const activityId = nonEmptyString(activity?.id);
  const ownerId = nonEmptyString(activity?.ownerId);
  const viewerId = nonEmptyString(viewer.viewerId);
  const isOwner = Boolean(viewerId && ownerId && viewerId === ownerId);
  const isAnonymous = !viewerId;
  const rawVisibility = activity?.visibility;
  const visibility = normalizeActivityVisibility(rawVisibility);
  const audience = null;

  if (!activityId) {
    return deny('missing_activity', { isOwner: false, isAnonymous, visibility, audience });
  }
  if (!ownerId) {
    return deny('missing_owner', { isOwner: false, isAnonymous, visibility, audience });
  }

  // Le propriétaire voit toujours sa propre séance, même privée. La carte
  // publiée reste soumise au statut du partage (`resolveSharedActivityAccess`).
  if (isOwner) {
    return allow('owner', { isOwner: true, isAnonymous: false, visibility, audience });
  }

  if (viewer.blocked === true) {
    return deny('blocked', { isOwner: false, isAnonymous, visibility, audience });
  }
  // Un compte connecté dont l'absence de blocage n'est pas prouvée est refusé.
  if (!isAnonymous && (viewer.blocked === null || viewer.blocked === undefined)) {
    return deny('blocked_unknown', { isOwner: false, isAnonymous, visibility, audience });
  }

  if (!isKnownActivityVisibility(rawVisibility)) {
    return deny('unknown_visibility', { isOwner: false, isAnonymous, visibility, audience });
  }
  if (visibility === 'private') {
    return deny('activity_private', { isOwner: false, isAnonymous, visibility, audience });
  }

  return allow('visible', { isOwner: false, isAnonymous, visibility, audience });
}

/** Booléen pratique pour les gardes de composant. */
export function canViewActivity(input: ActivityAccessInput = {}): boolean {
  return resolveActivityAccess(input).allowed;
}

/**
 * Accès à la carte publiée : séance visible + partage actif + audience.
 * Un partage retiré n'est jamais rendu, même à son auteur, sur la surface
 * « fil » : sa séance reste consultable dans son espace personnel.
 */
export function resolveSharedActivityAccess(
  input: SharedActivityAccessInput = {}
): ActivityAccess {
  const audience = normalizeShareAudience(input.audience);
  const base = resolveActivityAccess(input);
  const facts = {
    isOwner: base.isOwner,
    isAnonymous: base.isAnonymous,
    visibility: base.visibility,
    audience,
  };

  if (!base.allowed) {
    return { ...base, audience };
  }

  const share = input.share ?? null;
  const status = normalizeShareStatus(share?.status);
  if (!share || status === null || positiveInteger(share.version) === null) {
    return deny('invalid_share', facts);
  }
  if (share.revokedAt) {
    return deny('share_not_active', facts);
  }
  if (status !== 'shared') {
    return deny('share_not_active', facts);
  }

  if (base.isOwner) {
    return allow('owner', facts);
  }

  if (!audience) {
    return deny('unknown_audience', facts);
  }

  if (base.visibility === 'private') {
    return deny('activity_private', facts);
  }

  if (audience === 'public') {
    if (base.visibility === 'public' || base.visibility === 'shared') {
      return allow(base.isAnonymous ? 'anonymous_public' : 'public', facts);
    }
    if (base.visibility === 'followers') {
      return input.viewer?.isFollower === true
        ? allow('follower', facts)
        : deny('followers_only', facts);
    }
    return deny('activity_private', facts);
  }

  if (audience === 'abonnies') {
    return input.viewer?.isFollower === true
      ? allow('follower', facts)
      : deny('followers_only', facts);
  }

  // audience === 'club'
  const clubId = nonEmptyString(input.clubId);
  if (!clubId) {
    return deny('club_missing', facts);
  }
  if (!isUuid(clubId)) {
    return deny('club_missing', facts);
  }
  const clubs = input.viewer?.activeClubIds;
  if (!Array.isArray(clubs) || !clubs.includes(clubId)) {
    return deny('club_mismatch', facts);
  }
  return allow('club_member', facts);
}

export function canViewSharedActivity(input: SharedActivityAccessInput = {}): boolean {
  return resolveSharedActivityAccess(input).allowed;
}
