import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  buildEventFlyer,
  canViewClubEvent,
  cancelEventRegistration,
  computeEventAttendanceStats,
  publishEventRouteRevision,
  registerForClubEvent,
  syncParticipantRouteRevision,
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
      routeId: z.string().trim().min(1).max(120),
      checksum: z.string().trim().min(1).max(160),
      distanceM: z.number().min(0).max(1_000_000),
      elevationGainM: z.number().min(0).max(30_000),
      requiresParticipantDecision: z.boolean().default(true),
    })
    .strict(),
  z.object({ action: z.literal('sync_route') }).strict(),
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

    const registrations = await loadEventRegistrations(supabase, eventId);
    const manager = isManager(bundle);
    const eventCounts = {
      registered: registrations.filter((registration) => registration.status === 'registered').length,
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

    if (!canViewClubEvent(event, bundle.club, bundle.viewerContext, bundle.members)) {
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

    const registrations = await loadEventRegistrations(supabase, eventId);

    if (action.action === 'register') {
      const result = registerForClubEvent({
        event,
        club: bundle.club,
        userId: user.id,
        memberships: bundle.members,
        registrations,
        paceGroupId: action.paceGroupId ?? null,
        nowIso,
      });
      if (!result.ok) return respondClubResult(result);

      const { error } = await supabase.from('club_event_registrations').upsert(
        {
          event_id: eventId,
          user_id: user.id,
          status: result.data.registration.status,
          pace_group_id: result.data.registration.paceGroupId,
          registered_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'event_id,user_id' },
      );
      if (error) return dbFailure('POST register', error);
      return json({ data: result.data.registration }, 201);
    }

    if (action.action === 'cancel') {
      const result = cancelEventRegistration({ event, userId: user.id, registrations, nowIso });
      if (!result.ok) return respondClubResult(result);

      const { error } = await supabase
        .from('club_event_registrations')
        .update({ status: 'cancelled', updated_at: nowIso })
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      if (error) return dbFailure('POST cancel', error);

      if (result.data.promotedUserId) {
        const { error: promoteError } = await supabase
          .from('club_event_registrations')
          .update({ status: 'registered', updated_at: nowIso })
          .eq('event_id', eventId)
          .eq('user_id', result.data.promotedUserId);
        if (promoteError) return dbFailure('POST cancel promote', promoteError);
      }
      return json({ data: result.data });
    }

    if (action.action === 'publish_route') {
      const published = publishEventRouteRevision({
        event,
        actorMember: bundle.viewerMembership ?? undefined,
        routeId: action.routeId,
        checksum: action.checksum,
        distanceM: action.distanceM,
        elevationGainM: action.elevationGainM,
        requiresParticipantDecision: action.requiresParticipantDecision,
        nowIso,
      });
      if (!published.ok) return respondClubResult(published);

      const { error: eventError } = await supabase
        .from('club_events')
        .update({
          route_id: published.data.event.routeId,
          route_revision: published.data.event.routeRevision,
        })
        .eq('id', eventId)
        .eq('club_id', id);
      if (eventError) return dbFailure('POST publish route event', eventError);

      const { error: snapshotError } = await supabase.from('club_event_route_revisions').insert({
        event_id: eventId,
        route_id: published.data.snapshot.routeId,
        revision: published.data.snapshot.revision,
        checksum: published.data.snapshot.checksum,
        distance_m: published.data.snapshot.distanceM,
        elevation_gain_m: published.data.snapshot.elevationGainM,
        updated_by: user.id,
        requires_participant_decision: published.data.snapshot.requiresParticipantDecision,
      });
      if (snapshotError) return dbFailure('POST publish route snapshot', snapshotError);
      return json({ data: published.data }, 201);
    }

    if (action.action === 'sync_route') {
      const snapshot = await loadLatestRevision(supabase, eventId);
      if (!snapshot) return errorJson('not_found', 404);
      const currentSync = await loadRouteSync(supabase, eventId, user.id);
      const synced = syncParticipantRouteRevision({
        event,
        club: bundle.club,
        snapshot,
        participantUserId: user.id,
        currentSync: currentSync ?? undefined,
        memberships: bundle.members,
        registrations,
        nowIso,
      });
      if (!synced.ok) return respondClubResult(synced);

      const { error } = await supabase.from('club_event_route_sync').upsert(
        {
          event_id: eventId,
          user_id: user.id,
          last_synced_revision: synced.data.lastSyncedRevision,
          pending_revision: synced.data.pendingRevision,
          decision_required: synced.data.decisionRequired,
          revoked: synced.data.revoked,
          synced_at: nowIso,
        },
        { onConflict: 'event_id,user_id' },
      );
      if (error) return dbFailure('POST sync route', error);
      return json({ data: synced.data });
    }

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
