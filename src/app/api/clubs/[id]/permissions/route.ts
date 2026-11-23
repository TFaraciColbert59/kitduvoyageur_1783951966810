import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  canDelegateCapability,
  canManageTargetRole,
  CLUB_CAPABILITIES,
  CLUB_DEFAULT_ROLE_CAPABILITIES,
  type ClubCapability,
  type ClubRole,
} from '@/features/clubs';
import {
  csrfFailure,
  dbFailure,
  errorJson,
  hasValidOrigin,
  isUuid,
  json,
  optionalUser,
  readJson,
} from '../../_lib/http';
import {
  canReadClub,
  getEffectiveViewerRole,
  hasClubCapability,
  loadClubBundle,
  loadViewerCapabilities,
} from '../../_lib/db';
import { asArray, mapAuditEntryRow, mapClubRole, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const capabilityEnum = z.enum(CLUB_CAPABILITIES);
const delegableRoleEnum = z.enum(['admin', 'moderator', 'volunteer', 'member']);

const patchPermissionsSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('set_role_policy'),
      role: delegableRoleEnum,
      capability: capabilityEnum,
      allowed: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('reset_role_policies'),
      role: delegableRoleEnum,
    })
    .strict(),
  z
    .object({
      action: z.literal('set_member_override'),
      userId: z.string().uuid(),
      capability: capabilityEnum,
      allowed: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('reset_member_overrides'),
      userId: z.string().uuid(),
      capability: capabilityEnum.optional(),
    })
    .strict(),
]);

/** GET — matrice des droits (défauts globaux, policies par rôle, overrides membres & audit). */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const viewerCapabilities = await loadViewerCapabilities(supabase, id, bundle);
    const viewerRole = getEffectiveViewerRole(bundle);
    if (!viewerRole) return errorJson('forbidden', 403);

    const canViewAudit = viewerCapabilities.includes('members.view_audit_log');
    const canDelegate =
      viewerRole === 'founder' ||
      viewerCapabilities.includes('permissions.delegate') ||
      viewerCapabilities.includes('members.manage_roles');

    const [policiesRes, overridesRes, auditRes] = await Promise.all([
      supabase
        .from('club_role_capability_policies')
        .select('club_id, role, capability, allowed, updated_by, updated_at')
        .eq('club_id', id),
      canDelegate
        ? supabase
            .from('club_member_capability_overrides')
            .select('club_id, user_id, capability, allowed, granted_by, updated_at')
            .eq('club_id', id)
        : Promise.resolve({ data: [], error: null }),
      canViewAudit
        ? supabase
            .from('club_permission_audit')
            .select('*')
            .eq('club_id', id)
            .order('created_at', { ascending: false })
            .limit(80)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const rolePolicies = asArray<Row>(policiesRes.data).map((row) => ({
      clubId: String(row.club_id ?? id),
      role: mapClubRole(row.role) as Exclude<ClubRole, 'founder'>,
      capability: String(row.capability ?? '') as ClubCapability,
      allowed: Boolean(row.allowed),
      updatedBy: typeof row.updated_by === 'string' ? row.updated_by : null,
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    }));

    const memberOverrides = asArray<Row>(overridesRes.data).map((row) => ({
      clubId: String(row.club_id ?? id),
      userId: String(row.user_id ?? ''),
      capability: String(row.capability ?? '') as ClubCapability,
      allowed: Boolean(row.allowed),
      grantedBy: typeof row.granted_by === 'string' ? row.granted_by : null,
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    }));

    const auditEntries = asArray<Row>(auditRes.data).map(mapAuditEntryRow);

    return json({
      data: {
        viewerRole,
        viewerCapabilities,
        roleDefaults: CLUB_DEFAULT_ROLE_CAPABILITIES,
        rolePolicies,
        memberOverrides,
        auditEntries,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/permissions', error);
  }
}

/** PATCH — modifier une policy de rôle ou une surcharge membre avec anti-escalade strict. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const parsed = patchPermissionsSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const actorRole = getEffectiveViewerRole(bundle);
    const actorCaps = await loadViewerCapabilities(supabase, id, bundle);
    if (!actorRole) return errorJson('forbidden', 403);

    const action = parsed.data;

    if (action.action === 'set_role_policy') {
      const ok = canDelegateCapability({
        actorRole,
        actorCapabilities: actorCaps,
        targetRole: action.role,
        capability: action.capability,
      });
      if (!ok) return errorJson('forbidden', 403);

      const { error } = await supabase.from('club_role_capability_policies').upsert(
        {
          club_id: id,
          role: action.role,
          capability: action.capability,
          allowed: action.allowed,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'club_id,role,capability' },
      );
      if (error) return dbFailure('PATCH set_role_policy', error);
      return json({
        data: {
          role: action.role,
          capability: action.capability,
          allowed: action.allowed,
        },
      });
    }

    if (action.action === 'reset_role_policies') {
      const canDelegate =
        actorRole === 'founder' ||
        (await hasClubCapability(supabase, id, user.id, 'permissions.delegate', bundle));
      if (!canDelegate) return errorJson('forbidden', 403);
      if (!canManageTargetRole(actorRole, action.role)) {
        return errorJson('forbidden', 403);
      }

      let resetQuery = supabase
        .from('club_role_capability_policies')
        .delete()
        .eq('club_id', id)
        .eq('role', action.role);
      if (actorRole !== 'founder') {
        resetQuery = resetQuery.in('capability', actorCaps);
      }
      const { error } = await resetQuery;
      if (error) return dbFailure('PATCH reset_role_policies', error);
      return json({ data: { resetRole: action.role } });
    }

    // Actions ciblant un membre précis
    if (action.userId === user.id) {
      return errorJson('forbidden', 403);
    }
    const targetMember = bundle.members.find(
      (m) => m.userId === action.userId && m.status === 'active',
    );
    if (!targetMember) return errorJson('not_found', 404);
    const targetRole: ClubRole =
      bundle.club.createdBy === targetMember.userId ? 'founder' : targetMember.role;

    if (action.action === 'set_member_override') {
      const ok = canDelegateCapability({
        actorRole,
        actorCapabilities: actorCaps,
        targetRole,
        capability: action.capability,
      });
      if (!ok) return errorJson('forbidden', 403);

      const { error } = await supabase.from('club_member_capability_overrides').upsert(
        {
          club_id: id,
          user_id: action.userId,
          capability: action.capability,
          allowed: action.allowed,
          granted_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'club_id,user_id,capability' },
      );
      if (error) return dbFailure('PATCH set_member_override', error);
      return json({
        data: {
          userId: action.userId,
          capability: action.capability,
          allowed: action.allowed,
        },
      });
    }

    // reset_member_overrides
    const canReset = action.capability
      ? canDelegateCapability({
          actorRole,
          actorCapabilities: actorCaps,
          targetRole,
          capability: action.capability,
        })
      : actorRole === 'founder' ||
        (actorCaps.includes('permissions.delegate') && canManageTargetRole(actorRole, targetRole));
    if (!canReset) return errorJson('forbidden', 403);

    let query = supabase
      .from('club_member_capability_overrides')
      .delete()
      .eq('club_id', id)
      .eq('user_id', action.userId);
    if (action.capability) {
      query = query.eq('capability', action.capability);
    } else if (actorRole !== 'founder') {
      query = query.in('capability', actorCaps);
    }
    const { error } = await query;
    if (error) return dbFailure('PATCH reset_member_overrides', error);
    return json({ data: { resetUserId: action.userId, capability: action.capability ?? null } });
  } catch (error) {
    return dbFailure('PATCH /api/clubs/[id]/permissions', error);
  }
}
