import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  canViewClubChannel,
  createClubChannel,
  isActiveMember,
  listChannelMessagesForViewer,
  moderateChannelMessage,
  muteClubMember,
  postChannelMessage,
  reportChannelMessage,
  type ClubChannel,
  type ClubChannelMessage,
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
  loadChannels,
  loadClubBundle,
} from '../../_lib/db';
import { asArray, mapChannelRow, mapMessageRow, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const roleEnum = z.enum(['founder', 'admin', 'moderator', 'volunteer', 'member']);

const postSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create_channel'),
      name: z.string().trim().min(2).max(60),
      kind: z.enum(['general', 'announcements', 'events', 'custom']),
      description: z.string().trim().max(240).nullish(),
      minRole: roleEnum.optional(),
      readOnlyForMembers: z.boolean().optional(),
      notificationsEnabledByDefault: z.boolean().optional(),
      position: z.number().int().min(0).max(500).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('post_message'),
      channelId: z.string().uuid(),
      body: z.string().trim().min(1).max(2000),
      messageType: z
        .enum(['text', 'image', 'audio', 'gpx', 'trail', 'product', 'kit', 'file', 'video', 'post'])
        .optional(),
      metadata: z.record(z.string(), z.unknown()).nullable().optional(),
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

const patchChannelSchema = z
  .object({
    channelId: z.string().uuid(),
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(240).nullish(),
    kind: z.enum(['general', 'announcements', 'events', 'custom']).optional(),
    readOnlyForMembers: z.boolean().optional(),
    minRole: roleEnum.optional(),
    position: z.number().int().min(0).max(500).optional(),
    archived: z.boolean().optional(),
  })
  .strict();

const deleteChannelSchema = z
  .object({
    channelId: z.string().uuid(),
  })
  .strict();

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

/** GET — salons du club (filtrés par min_role) et messages visibles du salon demandé (S5.07). */
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

    const viewerRole = getEffectiveViewerRole(bundle) ?? bundle.viewerMembership.role;
    const effectiveMember = { ...bundle.viewerMembership, role: viewerRole };
    const wantArchived = request.nextUrl.searchParams.get('includeArchived') === '1';
    const canSeeArchived =
      wantArchived &&
      ((await hasClubCapability(supabase, id, user.id, 'salons.edit_settings', bundle)) ||
        (await hasClubCapability(supabase, id, user.id, 'salons.archive_or_delete', bundle)));

    const allChannels = await loadChannels(supabase, id);
    const channels = allChannels.filter((ch) =>
      canViewClubChannel(ch, effectiveMember, { includeArchived: canSeeArchived }),
    );
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
      memberships: bundle.members.map((m) =>
        m.userId === user.id ? effectiveMember : m,
      ),
    });
    if (!filtered.ok) return respondClubResult(filtered);

    const [canPostRegular, canPostAnnouncements] = await Promise.all([
      hasClubCapability(supabase, id, user.id, 'salons.post', bundle),
      hasClubCapability(supabase, id, user.id, 'salons.post_announcements', bundle),
    ]);

    return json({
      data: {
        channels,
        activeChannelId: active.id,
        messages: filtered.data,
        canPost:
          !active.archivedAt &&
          ((!active.readOnlyForMembers && canPostRegular) || canPostAnnouncements),
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
    const effectiveRole = getEffectiveViewerRole(bundle);
    const actor = bundle.viewerMembership
      ? { ...bundle.viewerMembership, role: effectiveRole ?? bundle.viewerMembership.role }
      : null;
    const nowIso = new Date().toISOString();
    const action = parsed.data;

    if (action.action === 'create_channel') {
      const canCreate = await hasClubCapability(supabase, id, user.id, 'salons.create', bundle);
      if (!canCreate) return errorJson('forbidden', 403);
      const created = createClubChannel({
        id: crypto.randomUUID(),
        clubId: id,
        name: action.name,
        kind: action.kind,
        description: action.description ?? null,
        minRole: (action.minRole as ClubRole | undefined) ?? 'member',
        readOnlyForMembers: action.readOnlyForMembers,
        notificationsEnabledByDefault: action.notificationsEnabledByDefault,
        position: action.position ?? 0,
        actorMember: actor ?? undefined,
        nowIso,
        allowByCapability: true,
      });
      if (!created.ok) return respondClubResult(created);
      const { error } = await supabase.from('club_channels').insert({
        id: created.data.id,
        club_id: id,
        name: created.data.name,
        kind: created.data.kind,
        description: created.data.description ?? null,
        min_role: created.data.minRole ?? 'member',
        read_only_for_members: created.data.readOnlyForMembers,
        notifications_enabled_by_default: created.data.notificationsEnabledByDefault,
        position: created.data.position ?? 0,
        created_by: user.id,
      });
      if (error) return dbFailure('POST create channel', error);
      return json({ data: created.data }, 201);
    }

    if (action.action === 'post_message') {
      const channel = await loadChannel(supabase, id, action.channelId);
      if (!channel) return errorJson('not_found', 404);
      const [canPostRegular, canPostAnnouncements] = await Promise.all([
        hasClubCapability(supabase, id, user.id, 'salons.post', bundle),
        hasClubCapability(supabase, id, user.id, 'salons.post_announcements', bundle),
      ]);
      const posted = postChannelMessage({
        id: crypto.randomUUID(),
        channel,
        actorMember: actor ?? undefined,
        body: action.body,
        nowIso,
        canPostOverride: canPostRegular,
        canPostAnnouncementsOverride: canPostAnnouncements,
      });
      if (!posted.ok) return respondClubResult(posted);
      const messageType = action.messageType ?? 'text';
      const metadata = action.metadata ?? null;
      const { error } = await supabase.from('club_channel_messages').insert({
        id: posted.data.id,
        channel_id: channel.id,
        club_id: id,
        author_id: user.id,
        body: posted.data.body,
        message_type: messageType,
        metadata,
      });
      if (error) return dbFailure('POST message', error);
      return json(
        {
          data: {
            ...posted.data,
            messageType,
            metadata,
          },
        },
        201,
      );
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

/** PATCH — modifier les paramètres, l'ordre, le minRole ou l'archivage d'un salon. */
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

    const parsed = patchChannelSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const { channelId, archived, ...settings } = parsed.data;
    const hasSettingsChanges = Object.keys(settings).length > 0;

    if (hasSettingsChanges) {
      const canEdit = await hasClubCapability(supabase, id, user.id, 'salons.edit_settings', bundle);
      if (!canEdit) return errorJson('forbidden', 403);
    }
    if (archived !== undefined) {
      const canArchive = await hasClubCapability(supabase, id, user.id, 'salons.archive_or_delete', bundle);
      if (!canArchive) return errorJson('forbidden', 403);
    }

    const patch: Row = {};
    if (settings.name !== undefined) patch.name = settings.name;
    if (settings.description !== undefined) patch.description = settings.description ?? null;
    if (settings.kind !== undefined) patch.kind = settings.kind;
    if (settings.readOnlyForMembers !== undefined) patch.read_only_for_members = settings.readOnlyForMembers;
    if (settings.minRole !== undefined) patch.min_role = settings.minRole;
    if (settings.position !== undefined) patch.position = settings.position;
    if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;

    if (Object.keys(patch).length === 0) return errorJson('invalid_body', 400);

    const { data, error } = await supabase
      .from('club_channels')
      .update(patch)
      .eq('id', channelId)
      .eq('club_id', id)
      .select('*')
      .maybeSingle();
    if (error) return dbFailure('PATCH /api/clubs/[id]/salons', error);
    if (!data) return errorJson('not_found', 404);

    return json({ data: mapChannelRow(data as Row) });
  } catch (error) {
    return dbFailure('PATCH /api/clubs/[id]/salons', error);
  }
}

/** DELETE — suppression définitive d'un salon (salons.archive_or_delete). */
export async function DELETE(
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

    const queryChannelId = request.nextUrl.searchParams.get('channelId');
    const body = queryChannelId ? { channelId: queryChannelId } : await readJson(request);
    const parsed = deleteChannelSchema.safeParse(body);
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const canDelete = await hasClubCapability(supabase, id, user.id, 'salons.archive_or_delete', bundle);
    if (!canDelete) return errorJson('forbidden', 403);

    const { error } = await supabase
      .from('club_channels')
      .delete()
      .eq('id', parsed.data.channelId)
      .eq('club_id', id);
    if (error) return dbFailure('DELETE /api/clubs/[id]/salons', error);

    return json({ data: { deletedChannelId: parsed.data.channelId } });
  } catch (error) {
    return dbFailure('DELETE /api/clubs/[id]/salons', error);
  }
}
