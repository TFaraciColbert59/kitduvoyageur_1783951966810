import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  inviteFriendToRecordedActivity,
  updateRecordedActivityInvite,
  type RecordedActivityInvite,
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
} from '../_lib/http';
import { loadViewerContext } from '../_lib/db';
import { asArray, asString, iso, type Row } from '../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z
  .object({
    activityId: z.string().min(1),
    inviteeUserId: z.string().uuid(),
  })
  .strict();

const respondSchema = z
  .object({
    inviteId: z.string().uuid(),
    action: z.enum(['accept', 'decline', 'revoke']),
  })
  .strict();

function mapRow(row: Row): RecordedActivityInvite {
  return {
    id: String(row.id ?? ''),
    activityId: String(row.activity_id ?? ''),
    ownerUserId: String(row.owner_user_id ?? ''),
    inviteeUserId: String(row.invitee_user_id ?? ''),
    status:
      row.status === 'accepted' || row.status === 'declined' || row.status === 'revoked'
        ? row.status
        : 'pending',
    createdAt: iso(row.created_at),
    respondedAt: asString(row.responded_at) ? iso(row.responded_at) : null,
  };
}

/** GET — invitations de traces reçues et émises par le lecteur (S5.19). */
export async function GET() {
  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const { data, error } = await supabase
      .from('club_recorded_activity_invites')
      .select('*')
      .or(`owner_user_id.eq.${user.id},invitee_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return dbFailure('GET activity invites', error);
    return json({ data: asArray<Row>(data).map(mapRow) });
  } catch (error) {
    return dbFailure('GET /api/clubs/activity-invites', error);
  }
}

/** POST — inviter un ami à réutiliser une trace enregistrée. */
export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return csrfFailure();

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const activity = await supabase
      .from('activities')
      .select('id, user_id')
      .eq('id', parsed.data.activityId)
      .maybeSingle();
    if (activity.error) return dbFailure('POST activity invite activity', activity.error);
    if (!activity.data || (activity.data as Row).user_id !== user.id) {
      return errorJson('not_found', 404);
    }

    const { context } = await loadViewerContext(supabase, user.id);
    const { data, error } = await supabase
      .from('club_recorded_activity_invites')
      .select('*')
      .eq('activity_id', parsed.data.activityId)
      .limit(50);
    if (error) return dbFailure('POST activity invite duplicates', error);

    const nowIso = new Date().toISOString();
    const created = inviteFriendToRecordedActivity({
      id: crypto.randomUUID(),
      activityId: parsed.data.activityId,
      ownerUserId: user.id,
      inviteeUserId: parsed.data.inviteeUserId,
      privacyContext: context,
      existingInvites: asArray<Row>(data).map(mapRow),
      nowIso,
    });
    if (!created.ok) return respondClubResult(created);

    const { error: insertError } = await supabase.from('club_recorded_activity_invites').insert({
      id: created.data.id,
      activity_id: created.data.activityId,
      owner_user_id: user.id,
      invitee_user_id: created.data.inviteeUserId,
      status: created.data.status,
    });
    if (insertError) return dbFailure('POST activity invite', insertError);
    return json({ data: created.data }, 201);
  } catch (error) {
    return dbFailure('POST /api/clubs/activity-invites', error);
  }
}

/** PATCH — accepter, refuser ou révoquer une invitation de trace. */
export async function PATCH(request: NextRequest) {
  if (!hasValidOrigin(request)) return csrfFailure();

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const parsed = respondSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());
    if (!isUuid(parsed.data.inviteId)) return errorJson('not_found', 404);

    const { data, error } = await supabase
      .from('club_recorded_activity_invites')
      .select('*')
      .eq('id', parsed.data.inviteId)
      .maybeSingle();
    if (error) return dbFailure('PATCH activity invite load', error);
    if (!data) return errorJson('not_found', 404);

    const { context } = await loadViewerContext(supabase, user.id);
    const nowIso = new Date().toISOString();
    const updated = updateRecordedActivityInvite({
      invite: mapRow(data as Row),
      actorUserId: user.id,
      action: parsed.data.action,
      privacyContext: context,
      nowIso,
    });
    if (!updated.ok) return respondClubResult(updated);

    const { error: updateError } = await supabase
      .from('club_recorded_activity_invites')
      .update({ status: updated.data.status, responded_at: nowIso })
      .eq('id', parsed.data.inviteId);
    if (updateError) return dbFailure('PATCH activity invite', updateError);
    return json({ data: updated.data });
  } catch (error) {
    return dbFailure('PATCH /api/clubs/activity-invites', error);
  }
}
