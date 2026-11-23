import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { canManageTargetRole, type ClubRole } from '@/features/clubs';
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
} from '../../_lib/db';
import { asArray, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchModerationSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('resolve_report'),
      reportId: z.string().uuid(),
      resolution: z.enum(['hide_message', 'delete_message', 'dismiss', 'mute_author']),
      muteHours: z.number().int().min(1).max(720).optional(),
      reason: z.string().trim().max(280).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('unmute_member'),
      userId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal('unban_member'),
      userId: z.string().uuid(),
    })
    .strict(),
]);

/** GET — file des signalements + membres en sourdine / bannis. */
export async function GET(
  request: NextRequest,
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

    const canModerate =
      (await hasClubCapability(supabase, id, user.id, 'moderation.resolve_reports', bundle)) ||
      (await hasClubCapability(supabase, id, user.id, 'salons.moderate_messages', bundle)) ||
      (await hasClubCapability(supabase, id, user.id, 'members.mute', bundle)) ||
      (await hasClubCapability(supabase, id, user.id, 'members.ban_or_kick', bundle));
    if (!canModerate) return errorJson('forbidden', 403);

    const statusFilter = request.nextUrl.searchParams.get('status');
    let reportQuery = supabase
      .from('club_content_reports')
      .select('*')
      .eq('club_id', id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (statusFilter === 'open' || statusFilter === 'resolved' || statusFilter === 'dismissed') {
      reportQuery = reportQuery.eq('status', statusFilter);
    }

    const { data: reportRows, error: reportErr } = await reportQuery;
    if (reportErr) return dbFailure('GET /api/clubs/[id]/moderation reports', reportErr);

    const nowMs = Date.now();
    const mutedMembers = bundle.members.filter(
      (m) => m.status === 'active' && m.mutedUntil && Date.parse(m.mutedUntil) > nowMs,
    );
    const bannedMembers = bundle.members.filter((m) => m.status === 'banned');

    return json({
      data: {
        reports: asArray<Row>(reportRows).map((row) => ({
          id: String(row.id ?? ''),
          clubId: String(row.club_id ?? id),
          channelId: String(row.channel_id ?? ''),
          messageId: String(row.message_id ?? ''),
          reporterId: String(row.reporter_id ?? ''),
          reason: String(row.reason ?? ''),
          status:
            row.status === 'resolved' || row.status === 'dismissed' ? row.status : 'open',
          createdAt: String(row.created_at ?? ''),
          resolvedBy: typeof row.resolved_by === 'string' ? row.resolved_by : null,
          resolvedAt: typeof row.resolved_at === 'string' ? row.resolved_at : null,
        })),
        mutedMembers,
        bannedMembers,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/moderation', error);
  }
}

/** PATCH — traiter un signalement, lever un mute ou réintégrer un banni. */
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

    const parsed = patchModerationSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const actorRole = getEffectiveViewerRole(bundle);
    if (!actorRole) return errorJson('forbidden', 403);
    const nowIso = new Date().toISOString();
    const action = parsed.data;

    if (action.action === 'resolve_report') {
      const canResolve = await hasClubCapability(
        supabase,
        id,
        user.id,
        'moderation.resolve_reports',
        bundle,
      );
      if (!canResolve) return errorJson('forbidden', 403);

      const { data: reportRow, error: loadErr } = await supabase
        .from('club_content_reports')
        .select('*')
        .eq('id', action.reportId)
        .eq('club_id', id)
        .maybeSingle();
      if (loadErr) return dbFailure('PATCH moderation load report', loadErr);
      if (!reportRow) return errorJson('not_found', 404);

      const messageId = String((reportRow as Row).message_id ?? '');

      if (action.resolution === 'hide_message' || action.resolution === 'delete_message') {
        const canModMsg = await hasClubCapability(
          supabase,
          id,
          user.id,
          'salons.moderate_messages',
          bundle,
        );
        if (!canModMsg) return errorJson('forbidden', 403);
        const msgPatch =
          action.resolution === 'hide_message'
            ? {
                hidden_by_moderator_id: user.id,
                hidden_reason: action.reason || 'Masqué suite à un signalement',
              }
            : { deleted_at: nowIso };
        const { error: msgErr } = await supabase
          .from('club_channel_messages')
          .update(msgPatch)
          .eq('id', messageId)
          .eq('club_id', id);
        if (msgErr) return dbFailure('PATCH moderation message', msgErr);
      }

      if (action.resolution === 'mute_author') {
        const canMute = await hasClubCapability(supabase, id, user.id, 'members.mute', bundle);
        if (!canMute) return errorJson('forbidden', 403);
        const { data: msgRow } = await supabase
          .from('club_channel_messages')
          .select('author_id')
          .eq('id', messageId)
          .eq('club_id', id)
          .maybeSingle();
        const authorId = msgRow ? String((msgRow as Row).author_id ?? '') : '';
        if (authorId) {
          const target = bundle.members.find((m) => m.userId === authorId);
          const targetRole: ClubRole =
            target && bundle.club.createdBy === target.userId
              ? 'founder'
              : target?.role ?? 'member';
          if (!canManageTargetRole(actorRole, targetRole)) {
            return errorJson('forbidden', 403);
          }
          const hours = action.muteHours ?? 24;
          const mutedUntil = new Date(Date.now() + hours * 3600_000).toISOString();
          const { error: muteErr } = await supabase
            .from('club_members')
            .update({ muted_until: mutedUntil })
            .eq('club_id', id)
            .eq('user_id', authorId);
          if (muteErr) return dbFailure('PATCH moderation mute author', muteErr);
        }
      }

      const nextStatus = action.resolution === 'dismiss' ? 'dismissed' : 'resolved';
      const { error: updErr } = await supabase
        .from('club_content_reports')
        .update({
          status: nextStatus,
          resolved_by: user.id,
          resolved_at: nowIso,
        })
        .eq('id', action.reportId)
        .eq('club_id', id);
      if (updErr) return dbFailure('PATCH moderation resolve report', updErr);

      return json({ data: { reportId: action.reportId, status: nextStatus } });
    }

    const target = bundle.members.find((m) => m.userId === action.userId);
    if (!target) return errorJson('not_found', 404);
    const targetRole: ClubRole =
      bundle.club.createdBy === target.userId ? 'founder' : target.role;
    if (!canManageTargetRole(actorRole, targetRole)) {
      return errorJson('forbidden', 403);
    }

    if (action.action === 'unmute_member') {
      const canMute = await hasClubCapability(supabase, id, user.id, 'members.mute', bundle);
      if (!canMute) return errorJson('forbidden', 403);
      const { error } = await supabase
        .from('club_members')
        .update({ muted_until: null })
        .eq('club_id', id)
        .eq('user_id', action.userId);
      if (error) return dbFailure('PATCH unmute_member', error);
      return json({ data: { userId: action.userId, mutedUntil: null } });
    }

    const canBan = await hasClubCapability(supabase, id, user.id, 'members.ban_or_kick', bundle);
    if (!canBan) return errorJson('forbidden', 403);
    const { error } = await supabase
      .from('club_members')
      .update({ status: 'active' })
      .eq('club_id', id)
      .eq('user_id', action.userId);
    if (error) return dbFailure('PATCH unban_member', error);
    return json({ data: { userId: action.userId, status: 'active' } });
  } catch (error) {
    return dbFailure('PATCH /api/clubs/[id]/moderation', error);
  }
}
