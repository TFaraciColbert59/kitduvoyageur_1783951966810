import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
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
import { canReadClub, hasClubCapability, loadClubBundle } from '../../_lib/db';
import {
  asArray,
  mapVolunteerAssignmentRow,
  mapVolunteerShiftRow,
  type Row,
} from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createShiftSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create_shift'),
      eventId: z.string().uuid(),
      title: z.string().trim().min(2).max(120),
      zoneLabel: z.string().trim().max(120).nullish(),
      startsAt: z.string().datetime().nullish(),
      endsAt: z.string().datetime().nullish(),
      capacity: z.number().int().min(1).max(500).optional(),
      instructions: z.string().trim().max(1000).nullish(),
    })
    .strict(),
  z
    .object({
      action: z.literal('assign_volunteer'),
      shiftId: z.string().uuid(),
      userId: z.string().uuid(),
      notes: z.string().trim().max(400).nullish(),
    })
    .strict(),
]);

const patchSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('update_shift'),
      shiftId: z.string().uuid(),
      title: z.string().trim().min(2).max(120).optional(),
      zoneLabel: z.string().trim().max(120).nullish(),
      startsAt: z.string().datetime().nullish(),
      endsAt: z.string().datetime().nullish(),
      capacity: z.number().int().min(1).max(500).optional(),
      instructions: z.string().trim().max(1000).nullish(),
    })
    .strict(),
  z
    .object({
      action: z.literal('update_assignment'),
      assignmentId: z.string().uuid(),
      status: z.enum(['assigned', 'confirmed', 'checked_in', 'declined']),
      notes: z.string().trim().max(400).nullish(),
    })
    .strict(),
]);

const deleteSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete_shift'), shiftId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('remove_assignment'), assignmentId: z.string().uuid() }).strict(),
]);

/** GET — postes bénévoles et affectations (filtrable par ?eventId=...). */
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

    const canManage = await hasClubCapability(
      supabase,
      id,
      user.id,
      'volunteers.manage_shifts',
      bundle,
    );
    const eventId = request.nextUrl.searchParams.get('eventId');

    let shiftQuery = supabase
      .from('club_event_volunteer_shifts')
      .select('*')
      .eq('club_id', id)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(200);
    if (eventId && isUuid(eventId)) {
      shiftQuery = shiftQuery.eq('event_id', eventId);
    }

    const { data: shiftRows, error: shiftErr } = await shiftQuery;
    if (shiftErr) return dbFailure('GET /api/clubs/[id]/volunteers shifts', shiftErr);

    const shifts = asArray<Row>(shiftRows).map(mapVolunteerShiftRow);
    const shiftIds = shifts.map((s) => s.id);

    let assignments: ReturnType<typeof mapVolunteerAssignmentRow>[] = [];
    if (shiftIds.length > 0) {
      let assignQuery = supabase
        .from('club_event_volunteer_assignments')
        .select('*')
        .eq('club_id', id)
        .in('shift_id', shiftIds);
      if (!canManage) {
        assignQuery = assignQuery.eq('user_id', user.id);
      }
      const { data: assignRows, error: assignErr } = await assignQuery;
      if (assignErr) return dbFailure('GET /api/clubs/[id]/volunteers assignments', assignErr);
      assignments = asArray<Row>(assignRows).map(mapVolunteerAssignmentRow);
    }

    const byShift = new Map<string, typeof assignments>();
    for (const a of assignments) {
      const list = byShift.get(a.shiftId) ?? [];
      list.push(a);
      byShift.set(a.shiftId, list);
    }

    return json({
      data: {
        canManage,
        shifts: shifts.map((s) => ({
          ...s,
          assignments: byShift.get(s.id) ?? [],
        })),
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/volunteers', error);
  }
}

/** POST — créer un poste/créneau bénévole ou affecter un membre. */
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

    const parsed = createShiftSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const canManage = await hasClubCapability(
      supabase,
      id,
      user.id,
      'volunteers.manage_shifts',
      bundle,
    );
    if (!canManage) return errorJson('forbidden', 403);

    const action = parsed.data;

    if (action.action === 'create_shift') {
      const { data, error } = await supabase
        .from('club_event_volunteer_shifts')
        .insert({
          club_id: id,
          event_id: action.eventId,
          title: action.title,
          zone_label: action.zoneLabel ?? null,
          starts_at: action.startsAt ?? null,
          ends_at: action.endsAt ?? null,
          capacity: action.capacity ?? 4,
          instructions: action.instructions ?? null,
          created_by: user.id,
        })
        .select('*')
        .single();
      if (error) return dbFailure('POST create_shift', error);
      return json({ data: mapVolunteerShiftRow(data as Row) }, 201);
    }

    const { data, error } = await supabase
      .from('club_event_volunteer_assignments')
      .upsert(
        {
          shift_id: action.shiftId,
          club_id: id,
          user_id: action.userId,
          status: 'assigned',
          assigned_by: user.id,
          notes: action.notes ?? null,
        },
        { onConflict: 'shift_id,user_id' },
      )
      .select('*')
      .single();
    if (error) return dbFailure('POST assign_volunteer', error);
    return json({ data: mapVolunteerAssignmentRow(data as Row) }, 201);
  } catch (error) {
    return dbFailure('POST /api/clubs/[id]/volunteers', error);
  }
}

/** PATCH — modifier un poste ou pointer (check-in / confirmation) un bénévole. */
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

    const canManage = await hasClubCapability(
      supabase,
      id,
      user.id,
      'volunteers.manage_shifts',
      bundle,
    );
    if (!canManage) return errorJson('forbidden', 403);

    const action = parsed.data;

    if (action.action === 'update_shift') {
      const patch: Row = {};
      if (action.title !== undefined) patch.title = action.title;
      if (action.zoneLabel !== undefined) patch.zone_label = action.zoneLabel ?? null;
      if (action.startsAt !== undefined) patch.starts_at = action.startsAt ?? null;
      if (action.endsAt !== undefined) patch.ends_at = action.endsAt ?? null;
      if (action.capacity !== undefined) patch.capacity = action.capacity;
      if (action.instructions !== undefined) patch.instructions = action.instructions ?? null;
      if (Object.keys(patch).length === 0) return errorJson('invalid_body', 400);

      const { data, error } = await supabase
        .from('club_event_volunteer_shifts')
        .update(patch)
        .eq('id', action.shiftId)
        .eq('club_id', id)
        .select('*')
        .maybeSingle();
      if (error) return dbFailure('PATCH update_shift', error);
      if (!data) return errorJson('not_found', 404);
      return json({ data: mapVolunteerShiftRow(data as Row) });
    }

    const patch: Row = {
      status: action.status,
      checked_in_at: action.status === 'checked_in' ? new Date().toISOString() : null,
    };
    if (action.notes !== undefined) patch.notes = action.notes ?? null;

    const { data, error } = await supabase
      .from('club_event_volunteer_assignments')
      .update(patch)
      .eq('id', action.assignmentId)
      .eq('club_id', id)
      .select('*')
      .maybeSingle();
    if (error) return dbFailure('PATCH update_assignment', error);
    if (!data) return errorJson('not_found', 404);
    return json({ data: mapVolunteerAssignmentRow(data as Row) });
  } catch (error) {
    return dbFailure('PATCH /api/clubs/[id]/volunteers', error);
  }
}

/** DELETE — supprimer un poste ou retirer une affectation bénévole. */
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

    const parsed = deleteSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const canManage = await hasClubCapability(
      supabase,
      id,
      user.id,
      'volunteers.manage_shifts',
      bundle,
    );
    if (!canManage) return errorJson('forbidden', 403);

    if (parsed.data.action === 'delete_shift') {
      const { error } = await supabase
        .from('club_event_volunteer_shifts')
        .delete()
        .eq('id', parsed.data.shiftId)
        .eq('club_id', id);
      if (error) return dbFailure('DELETE shift', error);
      return json({ data: { deletedShiftId: parsed.data.shiftId } });
    }

    const { error } = await supabase
      .from('club_event_volunteer_assignments')
      .delete()
      .eq('id', parsed.data.assignmentId)
      .eq('club_id', id);
    if (error) return dbFailure('DELETE assignment', error);
    return json({ data: { deletedAssignmentId: parsed.data.assignmentId } });
  } catch (error) {
    return dbFailure('DELETE /api/clubs/[id]/volunteers', error);
  }
}
