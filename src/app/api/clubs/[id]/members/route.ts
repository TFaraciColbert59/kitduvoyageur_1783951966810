import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  canManageTargetRole,
  changeMemberRole,
  muteClubMember,
  removeOrBanClubMember,
  requestOrJoinClub,
  reviewJoinRequest,
  type ClubJoinRequest,
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
  respondClubResult,
} from '../../_lib/http';
import {
  canReadClub,
  getEffectiveViewerRole,
  hasClubCapability,
  isAdmin,
  isManager,
  loadClubBundle,
} from '../../_lib/db';
import { asArray, mapJoinRequestRow, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const joinSchema = z
  .object({
    message: z.string().trim().max(500).optional(),
    answers: z.array(z.string().trim().max(300)).max(3).optional(),
  })
  .strict()
  .optional();

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('review'), requestId: z.string().uuid(), approve: z.boolean() }).strict(),
  z.object({ action: z.literal('role'), userId: z.string().uuid(), role: z.enum(['admin', 'moderator', 'volunteer', 'member']) }).strict(),
  z
    .object({
      action: z.literal('mute'),
      userId: z.string().uuid(),
      mutedUntil: z.string().datetime().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal('story_permission'),
      userId: z.string().uuid(),
      canManageStories: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('gear_permission'),
      userId: z.string().uuid(),
      canManageGear: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('leader_badge'),
      userId: z.string().uuid(),
      isCertifiedLeader: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('transfer_ownership'),
      userId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal('remove'),
      userId: z.string().uuid(),
      mode: z.enum(['leave', 'remove', 'ban']),
    })
    .strict(),
]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    let joinRequests: ClubJoinRequest[] = [];
    if (isManager(bundle)) {
      const { data, error } = await supabase
        .from('club_join_requests')
        .select('*')
        .eq('club_id', id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) return dbFailure('GET /api/clubs/[id]/members join requests', error);
      joinRequests = asArray<Row>(data).map(mapJoinRequestRow);
    }

    let auditLogs: Row[] = [];
    if (isAdmin(bundle)) {
      const { data: logs } = await supabase
        .from('club_permission_audit')
        .select('*')
        .eq('club_id', id)
        .order('created_at', { ascending: false })
        .limit(25);
      auditLogs = asArray<Row>(logs);
    }

    return json({
      data: {
        members: bundle.members,
        joinRequests,
        auditLogs,
        viewerMembership: bundle.viewerMembership,
        canManage: isManager(bundle),
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/members', error);
  }
}

/** POST — adhésion directe (club open) ou demande (club closed). */
export async function POST(
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

    const parsed = joinSchema.safeParse((await readJson(request)) ?? {});
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const nowIso = new Date().toISOString();
    const result = requestOrJoinClub({
      club: bundle.club,
      userId: user.id,
      displayName:
        bundle.members.find((member) => member.userId === user.id)?.displayName ?? 'Voyageur',
      existingMemberships: bundle.members,
      message: parsed.data?.message ?? null,
      answers: parsed.data?.answers ?? [],
      requestId: crypto.randomUUID(),
      nowIso,
    });
    if (!result.ok) return respondClubResult(result);

    if (result.data.member) {
      const { error } = await supabase.from('club_members').upsert(
        {
          club_id: id,
          user_id: user.id,
          role: result.data.member.role,
          status: result.data.member.status,
          joined_at: nowIso,
          leaderboard_opt_in: result.data.member.leaderboardOptIn ?? false,
        },
        { onConflict: 'club_id,user_id' },
      );
      if (error) return dbFailure('POST /api/clubs/[id]/members join', error);
      return json({ data: { member: result.data.member } }, 201);
    }

    if (result.data.joinRequest) {
      const { error } = await supabase.from('club_join_requests').insert({
        id: result.data.joinRequest.id,
        club_id: id,
        user_id: user.id,
        message: result.data.joinRequest.message,
        answers: result.data.joinRequest.answers,
        status: 'pending',
      });
      if (error) return dbFailure('POST /api/clubs/[id]/members request', error);
      return json({ data: { joinRequest: result.data.joinRequest } }, 201);
    }

    return errorJson('invalid_state', 409);
  } catch (error) {
    return dbFailure('POST /api/clubs/[id]/members', error);
  }
}

/** PATCH — revue d’une demande, rôle, sourdine, retrait, bannissement ou départ. */
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

    const parsed = patchSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);
    const actor = bundle.viewerMembership;
    const nowIso = new Date().toISOString();
    const action = parsed.data;

    if (action.action === 'review') {
      const canReview = await hasClubCapability(
        supabase,
        id,
        user.id,
        'members.review_requests',
        bundle,
      );
      if (!canReview) return errorJson('forbidden', 403);
      const { data, error } = await supabase
        .from('club_join_requests')
        .select('*')
        .eq('id', action.requestId)
        .eq('club_id', id)
        .maybeSingle();
      if (error) return dbFailure('PATCH review load', error);
      if (!data) return errorJson('not_found', 404);

      const review = reviewJoinRequest({
        request: mapJoinRequestRow(data as Row),
        actorMember: actor ?? undefined,
        approve: action.approve,
        nowIso,
        allowByCapability: true,
      });
      if (!review.ok) return respondClubResult(review);

      const { error: requestError } = await supabase
        .from('club_join_requests')
        .update({
          status: review.data.updatedRequest.status,
          reviewed_by: user.id,
          reviewed_at: nowIso,
        })
        .eq('id', action.requestId)
        .eq('status', 'pending');
      if (requestError) return dbFailure('PATCH review request', requestError);

      if (review.data.newMember) {
        const { error: memberError } = await supabase.from('club_members').upsert(
          {
            club_id: id,
            user_id: review.data.newMember.userId,
            role: review.data.newMember.role,
            status: 'active',
            joined_at: nowIso,
            leaderboard_opt_in: review.data.newMember.leaderboardOptIn ?? false,
          },
          { onConflict: 'club_id,user_id' },
        );
        if (memberError) return dbFailure('PATCH review member', memberError);
      }
      return json({ data: review.data });
    }

    if (action.action === 'role') {
      const canManageRoles = await hasClubCapability(supabase, id, user.id, 'members.manage_roles', bundle);
      if (!canManageRoles) return errorJson('forbidden', 403);
      const result = changeMemberRole({
        clubId: id,
        actorUserId: user.id,
        targetUserId: action.userId,
        newRole: action.role as ClubRole,
        memberships: bundle.members,
      });
      if (!result.ok) return respondClubResult(result);
      const { error } = await supabase
        .from('club_members')
        .update({
          role: action.role,
          can_manage_stories: action.role === 'admin' || action.role === 'moderator',
          can_manage_gear: action.role === 'admin' || action.role === 'volunteer',
        })
        .eq('club_id', id)
        .eq('user_id', action.userId);
      if (error) return dbFailure('PATCH role', error);
      return json({ data: result.data });
    }

    if (action.action === 'story_permission') {
      const actorRole = getEffectiveViewerRole(bundle);
      const canDelegate =
        actorRole === 'founder' ||
        ((await hasClubCapability(supabase, id, user.id, 'permissions.delegate', bundle)) &&
          (await hasClubCapability(supabase, id, user.id, 'stories.publish_club', bundle)));
      if (!canDelegate) return errorJson('forbidden', 403);
      const target = bundle.members.find((member) => member.userId === action.userId && member.status === 'active');
      if (!target) return errorJson('not_found', 404);
      const targetRole: ClubRole =
        bundle.club.createdBy === target.userId ? 'founder' : target.role;
      if (action.userId === user.id || !canManageTargetRole(actorRole, targetRole)) {
        return errorJson('forbidden', 403);
      }
      const { error } = await supabase
        .from('club_members')
        .update({ can_manage_stories: action.canManageStories })
        .eq('club_id', id)
        .eq('user_id', action.userId);
      if (error) return dbFailure('PATCH story_permission', error);
      await supabase.from('club_member_capability_overrides').upsert(
        [
          {
            club_id: id,
            user_id: action.userId,
            capability: 'stories.publish_club',
            allowed: action.canManageStories,
            granted_by: user.id,
          },
          {
            club_id: id,
            user_id: action.userId,
            capability: 'stories.manage_highlights',
            allowed: action.canManageStories,
            granted_by: user.id,
          },
        ],
        { onConflict: 'club_id,user_id,capability' },
      );
      return json({
        data: {
          userId: action.userId,
          canManageStories: action.canManageStories,
        },
      });
    }

    if (action.action === 'gear_permission') {
      const actorRole = getEffectiveViewerRole(bundle);
      const canDelegate =
        actorRole === 'founder' ||
        ((await hasClubCapability(supabase, id, user.id, 'permissions.delegate', bundle)) &&
          (await hasClubCapability(supabase, id, user.id, 'gear.manage_club_inventory', bundle)));
      if (!canDelegate) return errorJson('forbidden', 403);
      const target = bundle.members.find((member) => member.userId === action.userId && member.status === 'active');
      if (!target) return errorJson('not_found', 404);
      const targetRole: ClubRole =
        bundle.club.createdBy === target.userId ? 'founder' : target.role;
      if (action.userId === user.id || !canManageTargetRole(actorRole, targetRole)) {
        return errorJson('forbidden', 403);
      }
      const { error } = await supabase
        .from('club_members')
        .update({ can_manage_gear: action.canManageGear })
        .eq('club_id', id)
        .eq('user_id', action.userId);
      if (error) return dbFailure('PATCH gear_permission', error);
      await supabase.from('club_member_capability_overrides').upsert(
        [
          {
            club_id: id,
            user_id: action.userId,
            capability: 'gear.manage_club_inventory',
            allowed: action.canManageGear,
            granted_by: user.id,
          },
          {
            club_id: id,
            user_id: action.userId,
            capability: 'gear.approve_club_loans',
            allowed: action.canManageGear,
            granted_by: user.id,
          },
        ],
        { onConflict: 'club_id,user_id,capability' },
      );
      return json({
        data: {
          userId: action.userId,
          canManageGear: action.canManageGear,
        },
      });
    }

    if (action.action === 'leader_badge') {
      const actorRole = getEffectiveViewerRole(bundle);
      const canManageRoles = await hasClubCapability(supabase, id, user.id, 'members.manage_roles', bundle);
      if (!canManageRoles) return errorJson('forbidden', 403);
      const target = bundle.members.find((member) => member.userId === action.userId && member.status === 'active');
      if (!target) return errorJson('not_found', 404);
      const targetRole: ClubRole =
        bundle.club.createdBy === target.userId ? 'founder' : target.role;
      if (actorRole !== 'founder' && !canManageTargetRole(actorRole, targetRole)) {
        return errorJson('forbidden', 403);
      }
      const { error } = await supabase
        .from('club_members')
        .update({ is_certified_leader: action.isCertifiedLeader })
        .eq('club_id', id)
        .eq('user_id', action.userId);
      if (error) return dbFailure('PATCH leader_badge', error);
      return json({
        data: {
          userId: action.userId,
          isCertifiedLeader: action.isCertifiedLeader,
        },
      });
    }

    if (action.action === 'transfer_ownership') {
      const isFounder =
        bundle.club.createdBy === user.id || bundle.viewerMembership?.role === 'founder';
      if (!isFounder) return errorJson('forbidden', 403);
      if (action.userId === user.id) return errorJson('validation_error', 400);
      const target = bundle.members.find((member) => member.userId === action.userId && member.status === 'active');
      if (!target) return errorJson('not_found', 404);

      const { error: rpcError } = await supabase.rpc('club_transfer_ownership', {
        p_club_id: id,
        p_new_founder_id: action.userId,
      });
      if (rpcError) return dbFailure('PATCH transfer_ownership rpc', rpcError);

      return json({ data: { newFounderId: action.userId } });
    }

    if (action.action === 'mute') {
      const target = bundle.members.find((member) => member.userId === action.userId);
      const result = muteClubMember({
        clubId: id,
        actorMember: actor ?? undefined,
        targetMember: target,
        mutedUntilIso: action.mutedUntil,
      });
      if (!result.ok) return respondClubResult(result);
      const { error } = await supabase
        .from('club_members')
        .update({ muted_until: action.mutedUntil })
        .eq('club_id', id)
        .eq('user_id', action.userId);
      if (error) return dbFailure('PATCH mute', error);
      return json({ data: result.data });
    }

    const targetExists = bundle.members.some((member) => member.userId === action.userId);
    if (!targetExists) return errorJson('not_found', 404);
    const result = removeOrBanClubMember({
      clubId: id,
      actorUserId: user.id,
      targetUserId: action.userId,
      mode: action.mode,
      memberships: bundle.members,
    });
    if (!result.ok) return respondClubResult(result);

    if (action.mode === 'ban') {
      const { error } = await supabase
        .from('club_members')
        .update({ status: 'banned' })
        .eq('club_id', id)
        .eq('user_id', action.userId);
      if (error) return dbFailure('PATCH ban', error);
    } else {
      // `leave` et `remove` coupent l’adhésion : la ligne est supprimée, ce qui
      // respecte le CHECK existant (active/pending/banned) sans migration de
      // contrainte et sans conserver un accès résiduel.
      const { error } = await supabase
        .from('club_members')
        .delete()
        .eq('club_id', id)
        .eq('user_id', action.mode === 'leave' ? user.id : action.userId);
      if (error) return dbFailure('PATCH remove', error);
    }
    return json({ data: result.data });
  } catch (error) {
    return dbFailure('PATCH /api/clubs/[id]/members', error);
  }
}
