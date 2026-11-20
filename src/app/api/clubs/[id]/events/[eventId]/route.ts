import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  buildEventFlyer,
  canViewClubEvent,
  computeEventAttendanceStats,
  updateEventOrganization,
  type Club,
  type ParticipantRouteSyncState,
  type RouteRevisionSnapshot,
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
} from '../../../_lib/http';
import {
  canReadClub,
  isManager,
  loadAttendanceRecords,
  loadClubBundle,
  loadEvent,
  loadEventRegistrations,
} from '../../../_lib/db';
import {
  mapClubRow,
  mapEventRow,
  mapRegistrationRow,
  mapRouteSnapshot,
  mapRouteSyncRow,
  type Row,
} from '../../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('register'),
      paceGroupId: z.string().uuid().nullish(),
    })
    .strict(),
  z.object({ action: z.literal('cancel') }).strict(),
  z
    .object({
      action: z.literal('publish_route'),
      routeId: z.string().regex(/^[1-9][0-9]{0,17}$/),
      expectedRevision: z.number().int().min(0).max(2147483647),
      meetingPoint: z.string().trim().max(200).nullish(),
    })
    .strict(),
  z.object({ action: z.literal('sync_route') }).strict(),
  z.object({
    action: z.literal('decide_route'),
    revision: z.number().int().positive().max(2147483647),
    adopt: z.boolean(),
  }).strict(),
  z.object({ action: z.literal('attendance') }).strict(),
  z
    .object({
      action: z.literal('flyer'),
      shareUrl: z.string().url(),
      coHostClubIds: z.array(z.string().uuid()).max(10).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('update_organization'),
      paceGroups: z
        .array(
          z
            .object({
              id: z.string().trim().min(1),
              label: z.string().trim().min(1).max(60),
              targetPaceLabel: z.string().trim().min(1).max(60),
              minSpeedKmh: z.number().nullish(),
              maxSpeedKmh: z.number().nullish(),
              leaderUserId: z.string().uuid().nullish(),
            })
            .strict(),
        )
        .max(20)
        .optional(),
      coHostClubIds: z.array(z.string().uuid()).max(10).optional(),
    })
    .strict(),
]);

async function loadLatestRevision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<RouteRevisionSnapshot | null> {
  const { data, error } = await supabase
    .from('club_event_route_revisions')
    .select('*')
    .eq('event_id', eventId)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRouteSnapshot(data as Row) : null;
}

async function loadRouteSync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  userId: string,
): Promise<ParticipantRouteSyncState | null> {
  const { data, error } = await supabase
    .from('club_event_route_sync')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRouteSyncRow(data as Row) : null;
}

/** GET — fiche détaillée d’une sortie + inscription et état de tracé du lecteur. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; eventId: string }> },
) {
  const { id, eventId } = await context.params;
  if (!isUuid(id) || !isUuid(eventId)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const event = await loadEvent(supabase, eventId, id);
    if (!event || !canViewClubEvent(event, bundle.club, bundle.viewerContext, bundle.members)) {
      return errorJson('not_found', 404);
    }

    const registrations = user ? await loadEventRegistrations(supabase, eventId) : [];
    const manager = isManager(bundle);
    const eventCounts = {
      registered: event.registeredCount ?? registrations.filter((registration) => registration.status === 'registered').length,
      waitlist: registrations.filter((registration) => registration.status === 'waitlist').length,
    };
    const visibleRegistrations = manager
      ? registrations
      : registrations.filter((registration) => registration.userId === user?.id);

    const [latestRevision, routeSyncState, attendanceRecords] = await Promise.all([
      loadLatestRevision(supabase, eventId),
      user ? loadRouteSync(supabase, eventId, user.id) : Promise.resolve(null),
      manager ? loadAttendanceRecords(supabase, eventId) : Promise.resolve([]),
    ]);

    const coHosts = event.coHostClubIds.length
      ? await supabase.from('clubs').select('*').in('id', event.coHostClubIds)
      : { data: [] as Row[], error: null };
    const coHostClubs: Club[] = [];
    for (const row of (coHosts.data ?? []) as Row[]) {
      const club = mapClubRowSafe(row);
      if (club) coHostClubs.push(club);
    }

    return json({
      data: {
        event,
        club: bundle.club,
        coHostClubs,
        registrations: visibleRegistrations,
        eventCounts,
        viewerMembership: bundle.viewerMembership,
        canManage: manager,
        latestRevision,
        routeSyncState,
        attendanceRecords,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/events/[eventId]', error);
  }
}

function mapClubRowSafe(row: Row): Club | null {
  try {
    return mapClubRow(row);
  } catch {
    return null;
  }
}

/** POST — inscription, annulation, tracé, présence, flyer ou organisation. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; eventId: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { id, eventId } = await context.params;
  if (!isUuid(id) || !isUuid(eventId)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const parsed = actionSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);
    const event = await loadEvent(supabase, eventId, id);
    if (!event) return errorJson('not_found', 404);
    const nowIso = new Date().toISOString();
    const action = parsed.data;

    if (action.action !== 'cancel' && !canViewClubEvent(event, bundle.club, bundle.viewerContext, bundle.members)) {
      return errorJson('not_found', 404);
    }

    if (action.action === 'flyer') {
      const coHosts = await supabase.from('clubs').select('*').in('id', action.coHostClubIds ?? event.coHostClubIds);
      const clubs: Club[] = [];
      for (const row of (coHosts.data ?? []) as Row[]) {
        const club = mapClubRowSafe(row);
        if (club) clubs.push(club);
      }
      const flyer = buildEventFlyer({
        event,
        hostClub: bundle.club,
        coHostClubs: clubs,
        shareUrl: action.shareUrl,
      });
      return respondClubResult(flyer);
    }

    if (action.action === 'register' || action.action === 'cancel') {
      const attending = action.action === 'register';
      const { data, error } = await supabase.rpc('transact_club_event_registration', {
        p_event_id: eventId,
        p_attending: attending,
        p_pace_group_id: attending ? action.paceGroupId ?? null : null,
      });
      if (error?.details === 'club_event_cancelled') return errorJson('event_cancelled', 409);
      if (error?.code === '23514') return errorJson('CAPACITY_FULL', 409);
      if (error?.code === '22023') return errorJson('invalid_body', 400);
      if (error) return dbFailure('POST registration', error);
      const transaction = data as { registration: Row | null; promoted_user_id?: string | null; event_cancelled?: boolean };
      if (transaction.event_cancelled) return errorJson('event_cancelled', 409);
      const registration = transaction.registration ? mapRegistrationRow(transaction.registration) : null;
      if (attending) return json({ data: registration }, 201);
      return json({ data: { registrations: registration ? [registration] : [], promotedUserId: transaction.promoted_user_id ?? null } });
    }

    if (action.action === 'publish_route') {
      const { data, error } = await supabase.rpc('publish_club_event_route', {
        p_event_id: eventId,
        p_expected_revision: action.expectedRevision,
        p_route_id: action.routeId,
        p_meeting_point: action.meetingPoint ?? null,
      });
      if (error?.code === '40001') {
        return json({ error: 'revision_conflict', message: 'Le parcours a changé. Actualise la fiche.' }, 409);
      }
      if (error?.code === '22023') {
        return json({ error: 'route_unavailable', message: 'Ce tracé n’est pas disponible dans le catalogue.' }, 422);
      }
      if (error) return dbFailure('POST publish route', error);
      const result = data as { event: Row; snapshot: Row };
      return json({ data: { event: mapEventRow(result.event), snapshot: mapRouteSnapshot(result.snapshot) } }, 201);
    }

    if (action.action === 'sync_route' || action.action === 'decide_route') {
      const { data, error } = await supabase.rpc('save_event_route_state', {
        p_event_id: eventId,
        p_revision: action.action === 'decide_route' ? action.revision : null,
        p_adopt: action.action === 'decide_route' ? action.adopt : null,
      });
      if (error?.code === '40001') {
        return json({ error: 'revision_conflict', message: 'Le parcours ou ta décision a changé. Actualise la fiche.' }, 409);
      }
      if (error) return dbFailure('POST save route state', error);
      return json({ data: mapRouteSyncRow(data as Row) });
    }

    const registrations = await loadEventRegistrations(supabase, eventId);

    if (action.action === 'attendance') {
      const records = await loadAttendanceRecords(supabase, eventId);
      const stats = computeEventAttendanceStats({
        event,
        actorMember: bundle.viewerMembership ?? undefined,
        registrations,
        attendanceRecords: records,
      });
      return respondClubResult(stats);
    }

    const updated = updateEventOrganization({
      event,
      actorMember: bundle.viewerMembership ?? undefined,
      paceGroups: action.paceGroups?.map((group) => ({
        id: group.id,
        label: group.label,
        targetPaceLabel: group.targetPaceLabel,
        minSpeedKmh: group.minSpeedKmh ?? null,
        maxSpeedKmh: group.maxSpeedKmh ?? null,
        leaderUserId: group.leaderUserId ?? null,
      })),
      coHostClubIds: action.coHostClubIds,
    });
    if (!updated.ok) return respondClubResult(updated);

    const { data, error } = await supabase
      .from('club_events')
      .update({
        pace_groups: updated.data.paceGroups,
        co_host_club_ids: updated.data.coHostClubIds,
      })
      .eq('id', eventId)
      .eq('club_id', id)
      .select('*')
      .maybeSingle();
    if (error) return dbFailure('POST update organization', error);
    return json({ data: data ? mapEventRow(data as Row) : updated.data });
  } catch (error) {
    return dbFailure('POST /api/clubs/[id]/events/[eventId]', error);
  }
}
