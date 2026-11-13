import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  canViewClubEvent,
  searchClubEvents,
  type ClubEvent,
  type EventFormat,
  type EventRegistration,
  type EventSearchQuery,
  type P01Visibility,
  type PaceGroup,
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
import { canReadClub, isManager, loadClubBundle, loadEvents } from '../../_lib/db';
import type { Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paceGroupSchema = z
  .object({
    id: z.string().trim().min(1).max(60).optional(),
    label: z.string().trim().min(1).max(60),
    targetPaceLabel: z.string().trim().min(1).max(60),
    minSpeedKmh: z.number().min(0).max(80).nullish(),
    maxSpeedKmh: z.number().min(0).max(80).nullish(),
    leaderUserId: z.string().uuid().nullish(),
  })
  .strict();

const createEventSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).nullish(),
    sport: z.string().trim().min(2).max(40),
    format: z.enum(['social_ride', 'training', 'race', 'trail_outing', 'indoor']),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullish(),
    locationLabel: z.string().trim().min(2).max(160),
    meetingPoint: z.string().trim().max(200).nullish(),
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
    visibility: z.enum(['public', 'friends', 'club_only', 'private']).default('club_only'),
    maxParticipants: z.number().int().min(1).max(10_000).nullish(),
    waitlistEnabled: z.boolean().default(true),
    paceGroups: z.array(paceGroupSchema).max(20).default([]),
    registrationUrl: z.string().url().max(2048).nullish(),
    routeId: z.string().trim().max(120).nullish(),
    coHostClubIds: z.array(z.string().uuid()).max(10).default([]),
  })
  .strict();

function parseQuery(request: NextRequest): EventSearchQuery {
  const params = request.nextUrl.searchParams;
  const format = params.get('format');
  const sport = params.get('sport');
  return {
    text: params.get('q')?.trim() || undefined,
    location: params.get('location')?.trim() || undefined,
    sport: sport?.trim() || undefined,
    format:
      format === 'social_ride' ||
      format === 'training' ||
      format === 'race' ||
      format === 'trail_outing' ||
      format === 'indoor'
        ? (format as EventFormat)
        : undefined,
    fromIso: params.get('from')?.trim() || undefined,
    toIso: params.get('to')?.trim() || undefined,
    racesOnly: params.get('racesOnly') === '1',
  };
}

/** GET — sorties visibles du club, filtrées par `searchClubEvents`. */
export async function GET(
  request: NextRequest,
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
    const visible = searchClubEvents({
      events,
      clubsById: new Map([[bundle.club.id, bundle.club]]),
      memberships: bundle.members,
      viewerContext: bundle.viewerContext,
      query: parseQuery(request),
    });

    let registrations: EventRegistration[] = [];
    const eventCounts: Record<string, { registered: number; waitlist: number }> = {};
    if (visible.length > 0) {
      const { data, error } = await supabase
        .from('club_event_registrations')
        .select('*')
        .in(
          'event_id',
          visible.map((event) => event.id),
        )
        .limit(2000);
      if (error) return dbFailure('GET events registrations', error);
      const allRegistrations = (data ?? []).map((row) => ({
        eventId: String((row as Row).event_id ?? ''),
        userId: String((row as Row).user_id ?? ''),
        status: ((row as Row).status === 'waitlist'
          ? 'waitlist'
          : (row as Row).status === 'cancelled'
            ? 'cancelled'
            : 'registered') as EventRegistration['status'],
        paceGroupId: ((row as Row).pace_group_id as string | null) ?? null,
        invitedByUserId: ((row as Row).invited_by_user_id as string | null) ?? null,
        inviteId: ((row as Row).invite_id as string | null) ?? null,
        registeredAt: String((row as Row).registered_at ?? ''),
        updatedAt: String((row as Row).updated_at ?? (row as Row).registered_at ?? ''),
      }));
      for (const registration of allRegistrations) {
        const counts = eventCounts[registration.eventId] ?? { registered: 0, waitlist: 0 };
        if (registration.status === 'registered') counts.registered += 1;
        if (registration.status === 'waitlist') counts.waitlist += 1;
        eventCounts[registration.eventId] = counts;
      }
      // Un lecteur non-manager ne reçoit que sa propre inscription ; les
      // agrégats suffisent à afficher la capacité sans exposer les identités.
      registrations = isManager(bundle)
        ? allRegistrations
        : allRegistrations.filter((registration) => registration.userId === user?.id);
    }

    // Fail-closed supplémentaire : la recherche applique déjà canViewClubEvent,
    // mais on revalide chaque ligne avant de la sérialiser.
    const safe = visible.filter((event) =>
      canViewClubEvent(event, bundle.club, bundle.viewerContext, bundle.members),
    );

    return json({
      data: {
        events: safe,
        registrations,
        eventCounts,
        canManage: isManager(bundle),
        viewerMembership: bundle.viewerMembership,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/events', error);
  }
}

/** POST — créer une sortie (admin/modérateur du club). */
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

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);
    if (!isManager(bundle)) return errorJson('forbidden', 403);

    const parsed = createEventSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());
    const input = parsed.data;
    if (input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      return errorJson('invalid_body', 400, { message: 'La fin doit être postérieure au début.' });
    }

    const nowIso = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const paceGroups = input.paceGroups.map((group) => ({
      id: group.id ?? crypto.randomUUID(),
      label: group.label,
      targetPaceLabel: group.targetPaceLabel,
      minSpeedKmh: group.minSpeedKmh ?? null,
      maxSpeedKmh: group.maxSpeedKmh ?? null,
      leaderUserId: group.leaderUserId ?? null,
    }));
    const { error } = await supabase.from('club_events').insert({
      id: eventId,
      club_id: id,
      organizer_id: user.id,
      title: input.title,
      description: input.description ?? '',
      event_date: input.startsAt,
      starts_at: input.startsAt,
      ends_at: input.endsAt ?? null,
      sport: input.sport,
      format: input.format,
      visibility: input.visibility,
      location: input.locationLabel,
      meeting_point: input.meetingPoint ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      max_participants: input.maxParticipants ?? null,
      waitlist_enabled: input.waitlistEnabled,
      pace_groups: paceGroups,
      registration_url: input.registrationUrl ?? null,
      route_id: input.routeId ?? null,
      route_revision: input.routeId ? 1 : 0,
      co_host_club_ids: input.coHostClubIds,
      participants_count: 0,
    });
    if (error) return dbFailure('POST create event', error);

    const event: ClubEvent = {
      id: eventId,
      clubId: id,
      coHostClubIds: input.coHostClubIds,
      title: input.title,
      description: input.description ?? null,
      sport: input.sport,
      format: input.format,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      locationLabel: input.locationLabel,
      meetingPoint: input.meetingPoint ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      visibility: input.visibility as P01Visibility,
      maxParticipants: input.maxParticipants ?? null,
      waitlistEnabled: input.waitlistEnabled,
      paceGroups: paceGroups as PaceGroup[],
      registrationUrl: input.registrationUrl ?? null,
      routeId: input.routeId ?? null,
      routeRevision: input.routeId ? 1 : 0,
      createdBy: user.id,
      createdAt: nowIso,
    };

    return json({ data: event }, 201);
  } catch (error) {
    return dbFailure('POST /api/clubs/[id]/events', error);
  }
}
