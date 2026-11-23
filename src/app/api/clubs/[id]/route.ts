import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  canViewClubChannel,
  canViewClubEvent,
  evaluateClubVerificationBadge,
  isActiveMember,
  isAdminCapability,
  normalizeClubPrivacy,
  type Club,
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
} from '../_lib/http';
import {
  canReadClub,
  getEffectiveViewerRole,
  hasClubCapability,
  loadChannels,
  loadClubBundle,
  loadEvents,
  loadViewerCapabilities,
} from '../_lib/db';
import { mapClubRow, type Row } from '../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchClubSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(1000).optional(),
    privacy: z.enum(['open', 'closed', 'secret', 'public', 'private', 'invite_only']).optional(),
    zoneLabel: z.string().trim().max(120).nullish(),
    rules: z.string().trim().max(1000).nullish(),
    joinQuestions: z.array(z.string().trim().min(1).max(160)).max(3).optional(),
  })
  .strict();

const deleteClubSchema = z
  .object({
    confirmSlug: z.string().trim().min(1).max(120),
  })
  .strict();

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

    const events = await loadEvents(supabase, id);
    const visibleEvents = events.filter((event) =>
      canViewClubEvent(event, bundle.club, bundle.viewerContext, bundle.members),
    );
    const isMember = Boolean(bundle.viewerMembership && isActiveMember(bundle.viewerMembership));
    const rawChannels = isMember ? await loadChannels(supabase, id) : [];
    const viewerRole = getEffectiveViewerRole(bundle);
    const effectiveMembership = bundle.viewerMembership
      ? { ...bundle.viewerMembership, role: viewerRole ?? bundle.viewerMembership.role }
      : null;
    const channels = rawChannels.filter((ch) => canViewClubChannel(ch, effectiveMembership));
    const viewerCapabilities = isMember
      ? await loadViewerCapabilities(supabase, id, bundle)
      : [];
    const verificationBadge = evaluateClubVerificationBadge({
      club: bundle.club,
      sportContext: bundle.club.primarySport,
      isAuthorizedContext: true,
    });

    return json({
      data: {
        club: bundle.club,
        viewerMembership: bundle.viewerMembership,
        viewerRole,
        viewerCapabilities,
        members: isMember ? bundle.members : [],
        events: visibleEvents,
        channels,
        verificationBadge,
        canManage: viewerCapabilities.some(isAdminCapability),
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]', error);
  }
}

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

    const parsed = patchClubSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const canEdit = await hasClubCapability(supabase, id, user.id, 'club.edit_settings', bundle);
    if (!canEdit) return errorJson('forbidden', 403);

    const patch: Row = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.privacy !== undefined) patch.privacy = normalizeClubPrivacy(parsed.data.privacy);
    if (parsed.data.zoneLabel !== undefined) patch.location_label = parsed.data.zoneLabel ?? null;
    if (parsed.data.rules !== undefined) patch.rules = parsed.data.rules ?? null;
    if (parsed.data.joinQuestions !== undefined) patch.join_questions = parsed.data.joinQuestions;
    if (Object.keys(patch).length === 0) return errorJson('invalid_body', 400);

    const { data, error } = await supabase
      .from('clubs')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return dbFailure('PATCH /api/clubs/[id]', error);
    if (!data) return errorJson('not_found', 404);

    const club: Club = mapClubRow(data as Row);
    return json({ data: club });
  } catch (error) {
    return dbFailure('PATCH /api/clubs/[id]', error);
  }
}

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

    const parsed = deleteClubSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const canDelete = await hasClubCapability(supabase, id, user.id, 'club.delete', bundle);
    if (!canDelete) return errorJson('forbidden', 403);

    const needle = parsed.data.confirmSlug.trim().toLowerCase();
    const slugMatch = bundle.club.slug.trim().toLowerCase() === needle;
    const nameMatch = bundle.club.name.trim().toLowerCase() === needle;
    if (!slugMatch && !nameMatch) {
      return errorJson('confirmation_mismatch', 400);
    }

    const { error } = await supabase.from('clubs').delete().eq('id', id);
    if (error) return dbFailure('DELETE /api/clubs/[id]', error);

    return json({ data: { deletedClubId: id } });
  } catch (error) {
    return dbFailure('DELETE /api/clubs/[id]', error);
  }
}
