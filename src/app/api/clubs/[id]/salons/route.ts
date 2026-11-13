import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  createClubChannel,
  isActiveMember,
  listChannelMessagesForViewer,
  moderateChannelMessage,
  muteClubMember,
  postChannelMessage,
  reportChannelMessage,
  type ClubChannel,
  type ClubChannelMessage,
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
import { canReadClub, loadChannels, loadClubBundle } from '../../_lib/db';
import { asArray, mapChannelRow, mapMessageRow, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const postSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create_channel'),
      name: z.string().trim().min(2).max(60),
      kind: z.enum(['general', 'announcements', 'events', 'custom']),
      readOnlyForMembers: z.boolean().optional(),
      notificationsEnabledByDefault: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('post_message'),
      channelId: z.string().uuid(),
      body: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      action: z.literal('moderate'),
      messageId: z.string().uuid(),
      moderation: z.enum(['hide', 'delete']),
      reason: z.string().trim().max(280).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('report'),
      messageId: z.string().uuid(),
      reason: z.string().trim().min(2).max(280),
    })
    .strict(),
  z
    .object({
      action: z.literal('mute'),
      userId: z.string().uuid(),
      mutedUntil: z.string().datetime().nullable(),
    })
    .strict(),
]);

async function loadChannel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  channelId: string,
): Promise<ClubChannel | null> {
  const { data, error } = await supabase
    .from('club_channels')
    .select('*')
    .eq('id', channelId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapChannelRow(data as Row) : null;
}

async function loadMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  messageId: string,
): Promise<ClubChannelMessage | null> {
  const { data, error } = await supabase
    .from('club_channel_messages')
    .select('*')
    .eq('id', messageId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMessageRow(data as Row) : null;
}

/** GET — salons du club et messages visibles du salon demandé (S5.07). */
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
    if (!bundle.viewerMembership || !isActiveMember(bundle.viewerMembership)) {
      return errorJson('forbidden', 403);
    }

    const channels = await loadChannels(supabase, id);
    const requested = request.nextUrl.searchParams.get('channelId');
    const active = requested
      ? channels.find((channel) => channel.id === requested) ?? null
      : channels[0] ?? null;
    if (!active) {
      return json({ data: { channels, activeChannelId: null, messages: [] } });
    }

    const { data, error } = await supabase
      .from('club_channel_messages')
      .select('*')
      .eq('channel_id', active.id)
      .eq('club_id', id)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) return dbFailure('GET salons messages', error);

    const filtered = listChannelMessagesForViewer({
      channel: active,
      messages: asArray<Row>(data).map(mapMessageRow),
      viewerContext: bundle.viewerContext,
      memberships: bundle.members,
    });
    if (!filtered.ok) return respondClubResult(filtered);

    return json({
      data: {
        channels,
        activeChannelId: active.id,
        messages: filtered.data,
        canPost:
          !active.readOnlyForMembers ||
          bundle.viewerMembership.role === 'admin' ||
          bundle.viewerMembership.role === 'moderator',
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/salons', error);
  }
}

/** POST — créer un salon, publier, modérer, signaler ou mettre en sourdine. */
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

    const parsed = postSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);
    const actor = bundle.viewerMembership;
    const nowIso = new Date().toISOString();
    const action = parsed.data;

    if (action.action === 'create_channel') {
      const created = createClubChannel({
        id: crypto.randomUUID(),
        clubId: id,
        name: action.name,
        kind: action.kind,
        readOnlyForMembers: action.readOnlyForMembers,
        notificationsEnabledByDefault: action.notificationsEnabledByDefault,
        actorMember: actor ?? undefined,
        nowIso,
      });
      if (!created.ok) return respondClubResult(created);
      const { error } = await supabase.from('club_channels').insert({
        id: created.data.id,
        club_id: id,
        name: created.data.name,
        kind: created.data.kind,
        read_only_for_members: created.data.readOnlyForMembers,
        notifications_enabled_by_default: created.data.notificationsEnabledByDefault,
        created_by: user.id,
      });
      if (error) return dbFailure('POST create channel', error);
      return json({ data: created.data }, 201);
    }

    if (action.action === 'post_message') {
      const channel = await loadChannel(supabase, id, action.channelId);
      if (!channel) return errorJson('not_found', 404);
      const posted = postChannelMessage({
        id: crypto.randomUUID(),
        channel,
        actorMember: actor ?? undefined,
        body: action.body,
        nowIso,
      });
      if (!posted.ok) return respondClubResult(posted);
      const { error } = await supabase.from('club_channel_messages').insert({
        id: posted.data.id,
        channel_id: channel.id,
        club_id: id,
        author_id: user.id,
        body: posted.data.body,
      });
      if (error) return dbFailure('POST message', error);
      return json({ data: posted.data }, 201);
    }

    if (action.action === 'moderate') {
      const message = await loadMessage(supabase, id, action.messageId);
      if (!message) return errorJson('not_found', 404);
      const moderated = moderateChannelMessage({
        message,
        actorMember: actor ?? undefined,
        action: action.moderation,
        reason: action.reason ?? null,
        nowIso,
      });
      if (!moderated.ok) return respondClubResult(moderated);
      const patch =
        action.moderation === 'hide'
          ? {
              hidden_by_moderator_id: moderated.data.hiddenByModeratorId,
              hidden_reason: moderated.data.hiddenReason,
            }
          : { deleted_at: nowIso };
      const { error } = await supabase
        .from('club_channel_messages')
        .update(patch)
        .eq('id', message.id)
        .eq('club_id', id);
      if (error) return dbFailure('POST moderate', error);
      return json({ data: moderated.data });
    }

    if (action.action === 'report') {
      const message = await loadMessage(supabase, id, action.messageId);
      if (!message) return errorJson('not_found', 404);
      const reported = reportChannelMessage({
        id: crypto.randomUUID(),
        message,
        reporterMember: actor ?? undefined,
        reason: action.reason,
        nowIso,
      });
      if (!reported.ok) return respondClubResult(reported);
      const { error } = await supabase.from('club_content_reports').insert({
        id: reported.data.id,
        club_id: id,
        channel_id: message.channelId,
        message_id: message.id,
        reporter_id: user.id,
        reason: reported.data.reason,
        status: 'open',
      });
      if (error) return dbFailure('POST report', error);
      return json({ data: reported.data }, 201);
    }

    const target = bundle.members.find((member) => member.userId === action.userId);
    const muted = muteClubMember({
      clubId: id,
      actorMember: actor ?? undefined,
      targetMember: target,
      mutedUntilIso: action.mutedUntil,
    });
    if (!muted.ok) return respondClubResult(muted);
    const { error } = await supabase
      .from('club_members')
      .update({ muted_until: action.mutedUntil })
      .eq('club_id', id)
      .eq('user_id', action.userId);
    if (error) return dbFailure('POST mute', error);
    return json({ data: muted.data });
  } catch (error) {
    return dbFailure('POST /api/clubs/[id]/salons', error);
  }
}
