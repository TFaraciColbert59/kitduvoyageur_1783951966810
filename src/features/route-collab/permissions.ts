import type {
  RouteMemberAccess,
  RouteOperationInput,
  RoutePermission,
  RouteRole,
} from './types';

const ROLE_PERMISSIONS: Readonly<Record<RouteRole, readonly RoutePermission[]>> = {
  owner: [
    'route.read',
    'route.edit_geometry',
    'route.edit_stages',
    'route.edit_waypoints',
    'route.comment',
    'route.propose',
    'route.review',
    'route.publish',
    'route.manage_members',
    'route.manage_privacy',
    'route.download_pack',
  ],
  co_organizer: [
    'route.read',
    'route.edit_geometry',
    'route.edit_stages',
    'route.edit_waypoints',
    'route.comment',
    'route.propose',
    'route.review',
    'route.download_pack',
  ],
  editor: [
    'route.read',
    'route.edit_geometry',
    'route.edit_stages',
    'route.edit_waypoints',
    'route.comment',
    'route.propose',
    'route.download_pack',
  ],
  contributor: ['route.read', 'route.comment', 'route.propose', 'route.download_pack'],
  participant: ['route.read', 'route.download_pack'],
  external_viewer: ['route.read'],
};

export function permissionsForMember(member: RouteMemberAccess | null | undefined): ReadonlySet<RoutePermission> {
  if (!member || member.revokedAt) return new Set();
  const base = new Set<RoutePermission>(ROLE_PERMISSIONS[member.role] ?? []);
  if (member.role === 'co_organizer' && member.delegatedPublish) {
    base.add('route.publish');
  }
  return base;
}

export function hasRoutePermission(
  member: RouteMemberAccess | null | undefined,
  permission: RoutePermission,
  stageId?: string | null,
): boolean {
  if (!member || member.revokedAt) return false;
  const perms = permissionsForMember(member);
  if (!perms.has(permission)) return false;

  // Si un éditeur est restreint à certaines étapes, on vérifie la portée pour les mutations d'étape.
  if (
    stageId &&
    member.stageScopeIds &&
    member.stageScopeIds.length > 0 &&
    (permission === 'route.edit_stages' || permission === 'route.edit_geometry')
  ) {
    return member.stageScopeIds.includes(stageId);
  }
  return true;
}

export function requiredPermissionForOperation(op: RouteOperationInput): RoutePermission {
  switch (op.type) {
    case 'move_point':
    case 'insert_point':
    case 'delete_point':
    case 'reverse_route':
    case 'set_shape_mode':
    case 'set_section_mode':
    case 'apply_routing_result':
    case 'set_sport_profile':
    case 'apply_variant':
      return 'route.edit_geometry';
    case 'add_variant':
      return 'route.propose';
    case 'split_days':
    case 'move_day_boundary':
    case 'update_stage_note':
    case 'set_overnight':
      return 'route.edit_stages';
    case 'revert_to_seq':
      return 'route.publish';
  }
}

/**
 * Une inscription à un événement de club (RSVP) donne au maximum un accès
 * `participant` (lecture + téléchargement du pack). Le droit d'édition exige
 * une autorisation explicite distincte dans `trip_collaborators` / l'espace de route.
 */
export function resolveEffectiveRole(input: {
  tripRole?: RouteRole | null;
  clubEventRsvp?: 'going' | 'interested' | 'waitlist' | 'none' | null;
  explicitRouteGrant?: RouteRole | null;
}): RouteRole | null {
  if (input.explicitRouteGrant) return input.explicitRouteGrant;
  if (input.tripRole) return input.tripRole;
  if (input.clubEventRsvp === 'going') return 'participant';
  return null;
}

export interface RouteInvitationCheckInput {
  readonly status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'revoked';
  readonly expiresAt: string | null;
  readonly invitedUserId: string | null;
  readonly currentUserId: string | null;
  readonly isShareLink?: boolean;
  readonly nowIso?: string;
}

export type RouteInvitationCheckResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly reason: 'auth_required' | 'revoked' | 'already_used' | 'expired' | 'wrong_account';
    };

export function validateRouteInvitation(input: RouteInvitationCheckInput): RouteInvitationCheckResult {
  if (!input.currentUserId) {
    return { valid: false, reason: 'auth_required' };
  }
  if (input.status === 'cancelled' || input.status === 'revoked' || input.status === 'declined') {
    return { valid: false, reason: 'revoked' };
  }
  if (input.status === 'accepted' && !input.isShareLink) {
    return { valid: false, reason: 'already_used' };
  }
  if (input.expiresAt) {
    const expMs = Date.parse(input.expiresAt);
    const nowMs = input.nowIso ? Date.parse(input.nowIso) : Date.now();
    if (Number.isFinite(expMs) && expMs <= nowMs) {
      return { valid: false, reason: 'expired' };
    }
  }
  if (input.invitedUserId && input.invitedUserId !== input.currentUserId) {
    return { valid: false, reason: 'wrong_account' };
  }
  return { valid: true };
}
