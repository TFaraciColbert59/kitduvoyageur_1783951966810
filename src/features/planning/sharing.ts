/**
 * Partage et contrôle d'audience P01 (fail-closed).
 * Aucun itinéraire privé, révoqué, expiré ou appartenant à un utilisateur bloqué
 * ne doit être exposé dans une recherche, une collection partagée ou un lancement.
 */

import type {
  MultiDayPlan,
  PlanShareRecord,
  ShareAccessDecision,
  ShareAudience,
  ViewerContextP01,
} from './models';
import { assertValidTimeZone } from './timezone';

export interface CreateShareRequest {
  shareId: string;
  audience: ShareAudience;
  timezone: string;
  createdAtIso: string;
  expiresAtIso?: string | null;
  allowedTribeIds?: string[];
  includeExactStartEndCoords?: boolean;
}

export type ShareCreationResult =
  | { ok: true; record: PlanShareRecord }
  | { ok: false; reason: 'forbidden_not_owner' | 'consent_missing_p01' | 'invalid_expiration' };

export function isPlanVisibleToViewerP01(
  plan: MultiDayPlan,
  viewer: ViewerContextP01,
): boolean {
  if (viewer.viewerId && viewer.viewerId === plan.ownerId) {
    return true;
  }
  if (viewer.blockedUserIds.includes(plan.ownerId)) {
    return false;
  }
  if (plan.audience === 'private') {
    return false;
  }
  if (!plan.publicShareConsented && plan.audience === 'public') {
    return false;
  }
  if (plan.audience === 'friends') {
    return viewer.viewerId !== null && viewer.friendIds.includes(plan.ownerId);
  }
  if (plan.audience === 'tribu') {
    return viewer.viewerId !== null && viewer.tribuIds.length > 0;
  }
  return plan.audience === 'public';
}

export function createPlanShare(
  plan: MultiDayPlan,
  actorId: string,
  request: CreateShareRequest,
): ShareCreationResult {
  if (actorId !== plan.ownerId) {
    return { ok: false, reason: 'forbidden_not_owner' };
  }
  if (request.audience === 'public' && !plan.publicShareConsented) {
    return { ok: false, reason: 'consent_missing_p01' };
  }

  const tz = assertValidTimeZone(request.timezone);
  const createdMs = Date.parse(request.createdAtIso);
  if (Number.isNaN(createdMs)) {
    throw new Error(`Invalid createdAtIso: "${request.createdAtIso}"`);
  }

  if (request.expiresAtIso != null) {
    const expMs = Date.parse(request.expiresAtIso);
    if (Number.isNaN(expMs) || expMs <= createdMs) {
      return { ok: false, reason: 'invalid_expiration' };
    }
  }

  return {
    ok: true,
    record: {
      shareId: request.shareId,
      planId: plan.id,
      ownerId: plan.ownerId,
      audience: request.audience,
      timezone: tz,
      createdAtIso: request.createdAtIso,
      expiresAtIso: request.expiresAtIso ?? null,
      revokedAtIso: null,
      allowedTribeIds: request.allowedTribeIds ? [...request.allowedTribeIds] : [],
      includeExactStartEndCoords:
        request.audience === 'private' ? true : Boolean(request.includeExactStartEndCoords),
    },
  };
}

export function revokePlanShare(
  record: PlanShareRecord,
  actorId: string,
  revokedAtIso: string,
): { ok: true; record: PlanShareRecord } | { ok: false; reason: 'forbidden_not_owner' } {
  if (actorId !== record.ownerId) {
    return { ok: false, reason: 'forbidden_not_owner' };
  }
  const revokedMs = Date.parse(revokedAtIso);
  if (Number.isNaN(revokedMs)) {
    throw new Error(`Invalid revokedAtIso: "${revokedAtIso}"`);
  }
  return {
    ok: true,
    record: {
      ...record,
      revokedAtIso,
    },
  };
}

export function evaluateShareAccessP01(
  plan: MultiDayPlan,
  share: PlanShareRecord | null,
  viewer: ViewerContextP01,
  nowIso: string,
): ShareAccessDecision {
  if (viewer.viewerId && viewer.viewerId === plan.ownerId) {
    return {
      allowed: true,
      audience: 'private',
      includeExactStartEndCoords: true,
    };
  }

  if (viewer.blockedUserIds.includes(plan.ownerId)) {
    return { allowed: false, reason: 'blocked_p01' };
  }

  if (!share || share.planId !== plan.id) {
    return { allowed: false, reason: 'not_shared' };
  }

  if (share.revokedAtIso !== null) {
    return { allowed: false, reason: 'revoked' };
  }

  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    throw new Error(`Invalid nowIso: "${nowIso}"`);
  }
  if (share.expiresAtIso !== null) {
    const expMs = Date.parse(share.expiresAtIso);
    if (Number.isNaN(expMs) || nowMs >= expMs) {
      return { allowed: false, reason: 'expired' };
    }
  }

  if (share.audience === 'private') {
    return { allowed: false, reason: 'private_p01' };
  }

  if (share.audience === 'public' && !plan.publicShareConsented) {
    return { allowed: false, reason: 'consent_missing_p01' };
  }

  if (share.audience === 'friends') {
    if (!viewer.viewerId || !viewer.friendIds.includes(plan.ownerId)) {
      return { allowed: false, reason: 'audience_mismatch' };
    }
  }

  if (share.audience === 'tribu') {
    const hasTribe =
      viewer.viewerId !== null &&
      share.allowedTribeIds.some((t) => viewer.tribuIds.includes(t));
    if (!hasTribe) {
      return { allowed: false, reason: 'audience_mismatch' };
    }
  }

  return {
    allowed: true,
    audience: share.audience,
    includeExactStartEndCoords: share.includeExactStartEndCoords,
  };
}
