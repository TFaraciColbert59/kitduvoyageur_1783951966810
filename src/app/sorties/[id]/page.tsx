import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getValidatedRaceRegistrationUrl } from '@/features/clubs';
import { resolveEventAdventure } from '@/features/hub/server/resolveEventAdventure';
import type { EventAdventureRef } from '@/features/hub/context/eventAdventureRef';
import { listOwnedTripLinkChoices } from '@/features/trips/server/discoverTrips';
import EventDetailClient, { type EventDetailData } from './EventDetailClient';
import EventHubLink from './EventHubLink';
import ClubEventRouteProposal from './ClubEventRouteProposal';
import './event-detail.css';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isoDate(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  return raw.slice(0, 10);
}

/**
 * Fiche sortie minimale au système `/compte` (`01-SPEC-PRODUIT.md` § 4.4).
 *
 * Aucune route de fiche n'existait : cette page affiche le billet daté, la méta,
 * le rendez-vous sur mini-carte, les participants, l'inscription et le fichier
 * `.ics`. L'organisateur peut y relier une aventure existante au HUB.
 */
export default async function SortiePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ source?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const requestedClubEvent = query?.source === 'club';
  const [{ data: eventRow, error }, { data: clubEventRow }, { data: { user } }] = await Promise.all([
    requestedClubEvent
      ? Promise.resolve({ data: null, error: null })
      : supabase.from('events').select('*').eq('id', id).maybeSingle(),
    supabase.from('club_events').select('*').eq('id', id).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const selected = requestedClubEvent ? clubEventRow : eventRow ?? clubEventRow;
  if (!selected || (error && !clubEventRow)) notFound();

  const event = selected as Row;
  const isClubEventOnly = requestedClubEvent || !eventRow;
  const organizerId = asString(event.organizer_id) ?? asString(event.created_by);
  const clubId = asString(event.club_id);
  const kitId = asString(event.kit_id);

  const eventRef: EventAdventureRef = { kind: isClubEventOnly ? 'club_event' : 'community_event', id };
  const cancelled = event.status === 'cancelled' || (isClubEventOnly && Boolean(asString(event.cancelled_at)));
  const isOrganizer = Boolean(user && user.id === event.organizer_id);
  const canLink = isOrganizer && !cancelled;
  const revision = asNumber(event.route_revision);
  const canLoadRoute = Boolean(user && isClubEventOnly && !cancelled && revision && revision > 0);
  const [
    { data: organizerRow }, { data: participantRows }, { data: clubRow }, { data: kitRow },
    linked, ownChoices, { data: proposal }, { data: routeDecision }, { data: routeState },
  ] =
    await Promise.all([
      organizerId
        ? supabase.from('public_profiles').select('id,full_name,handle,avatar_url').eq('id', organizerId).maybeSingle()
        : Promise.resolve({ data: null }),
      isClubEventOnly
        ? user
          ? supabase.from('club_event_registrations_effective').select('user_id,status').eq('event_id', id).neq('status', 'cancelled')
          : Promise.resolve({ data: [] })
        : supabase.from('event_participants').select('user_id,status').eq('event_id', id),
      clubId ? supabase.from('clubs').select('id,slug,name').eq('id', clubId).maybeSingle() : Promise.resolve({ data: null }),
      kitId
        ? supabase
            .from('materiel_kits')
            .select('id,name,total_weight_g,is_public')
            .eq('id', kitId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user ? resolveEventAdventure(eventRef) : null,
      canLink && user ? listOwnedTripLinkChoices(user.id) : null,
      canLoadRoute
        ? supabase.from('club_event_route_revisions').select('route_name,meeting_point,distance_m,elevation_gain_m')
          .eq('event_id', id).eq('revision', revision).not('canonical_revision_id', 'is', null).maybeSingle()
        : { data: null },
      canLoadRoute && user
        ? supabase.from('club_event_route_decisions').select('adopted')
          .eq('event_id', id).eq('user_id', user.id).eq('revision', revision).maybeSingle()
        : { data: null },
      canLoadRoute && user
        ? supabase.from('club_event_route_sync').select('adopted_revision')
          .eq('event_id', id).eq('user_id', user.id).maybeSingle()
        : { data: null },
    ]);

  const participantsRaw = (participantRows ?? []) as Row[];
  const participantIds = participantsRaw
    .map((row) => asString(row.user_id))
    .filter((value): value is string => Boolean(value));
  const { data: participantProfiles } =
    participantIds.length > 0
      ? await supabase.from('public_profiles').select('id,full_name,handle,avatar_url').in('id', participantIds)
      : { data: [] as Row[] };

  const profilesById = new Map<string, Row>();
  for (const profile of (participantProfiles ?? []) as Row[]) {
    const profileId = asString(profile.id);
    if (profileId) profilesById.set(profileId, profile);
  }

  let myStatus: 'none' | 'registered' | 'waitlist' = 'none';
  if (user?.id) {
    const mine = participantsRaw.find((row) => asString(row.user_id) === user.id);
    if (mine) myStatus = asString(mine.status) === 'waitlist' ? 'waitlist' : 'registered';
  }

  const participants = participantsRaw.map((row) => {
    const userId = asString(row.user_id) ?? '';
    const profile = profilesById.get(userId);
    return {
      id: userId,
      name: asString(profile?.full_name) ?? 'Voyageur',
      handle: asString(profile?.handle),
      avatarUrl: asString(profile?.avatar_url),
      role: profile ? 'member' : 'member',
      status: asString(row.status) === 'waitlist' ? ('waitlist' as const) : ('confirmed' as const),
    };
  });

  const startsAt = asString(event.starts_at);
  const eventDate = isoDate(startsAt) ?? isoDate(event.event_date) ?? '';
  const endsAt = asString(event.ends_at);
  const maxParticipants = asNumber(event.max_participants) ?? 0;
  const currentParticipants = isClubEventOnly
    ? asNumber(event.participants_count) ?? 0
    : participants.filter((p) => p.status === 'confirmed').length || (asNumber(event.current_participants) ?? 0);
  const startsAtMs = startsAt ? Date.parse(startsAt) : eventDate ? Date.parse(`${eventDate}T23:59:59+01:00`) : NaN;
  const past = Number.isFinite(startsAtMs) ? startsAtMs < Date.now() : false;
  const status = cancelled ? 'cancelled' : asString(event.status);

  const organizerProfile = organizerRow as Row | null;
  const coverImage = asString(event.cover_image);
  const coverAlt = asString(event.cover_alt) ?? asString(event.title) ?? 'Sortie';

  const data: EventDetailData = {
    id,
    title: asString(event.title) ?? 'Sortie',
    description: asString(event.description),
    activity: asString(event.activity) ?? asString(event.type) ?? asString(event.sport) ?? 'rando',
    emoji: asString(event.emoji),
    eventDate,
    startsAt,
    endsAt,
    duration: asString(event.duration),
    location: asString(event.location) ?? asString(event.location_label) ?? '',
    meetingPoint: asString(event.meeting_point),
    level: (asString(event.level) as EventDetailData['level']) ?? null,
    distanceKm: asNumber(event.distance_km),
    elevationGainM: asNumber(event.elevation_gain_m),
    lat: asNumber(event.meeting_lat) ?? asNumber(event.lat) ?? null,
    lng: asNumber(event.meeting_lng) ?? asNumber(event.lng) ?? null,
    meetingGeom: (event.meeting_geom as { type?: string; coordinates?: [number, number] } | null) ?? null,
    coverImage,
    coverAlt,
    maxParticipants,
    currentParticipants,
    waitlistEnabled: Boolean(event.waitlist_enabled),
    status: status ?? null,
    past: past || status === 'past',
    cancelled,
    canCancelClubEvent: isClubEventOnly && isOrganizer && !cancelled,
    recurrence: (asString(event.recurrence) as EventDetailData['recurrence']) ?? null,
    registrationUrl: getValidatedRaceRegistrationUrl(
      asString(event.registration_url),
    ),
    format: asString(event.format),
    safetyNotes: asString(event.safety_notes),
    safetyChecklist: asArray<string>(event.safety_checklist),
    organizer: organizerProfile
      ? {
          id: organizerId ?? '',
          name: asString(organizerProfile.full_name) ?? 'Organisateur',
          handle: asString(organizerProfile.handle),
          avatarUrl: asString(organizerProfile.avatar_url),
        }
      : organizerId
        ? { id: organizerId, name: 'Organisateur', handle: null, avatarUrl: null }
        : null,
    participants,
    myStatus,
    registrationClubId: isClubEventOnly ? clubId : undefined,
    club: clubRow
      ? {
          id: asString((clubRow as Row).id) ?? '',
          slug: asString((clubRow as Row).slug),
          name: asString((clubRow as Row).name) ?? 'Club',
        }
      : null,
    kit: kitRow
      ? {
          id: asString((kitRow as Row).id) ?? '',
          name: asString((kitRow as Row).name) ?? 'Kit',
          totalWeightG: asNumber((kitRow as Row).total_weight_g),
        }
      : null,
  };

  const choices = ownChoices ?? [];
  const linkedChoice = linked ? { id: linked.id, title: linked.title } : null;
  if (canLink && linkedChoice && !choices.some((trip) => trip.id === linkedChoice.id)) {
    choices.unshift(linkedChoice);
  }

  return (
    <EventDetailClient
      key={eventRef.kind + '/' + id}
      event={data}
      signedIn={Boolean(user)}
      routeProposal={proposal && revision != null ? (
        <ClubEventRouteProposal
          key={revision}
          eventId={id}
          revision={revision}
          routeName={asString(proposal.route_name)}
          meetingPoint={asString(proposal.meeting_point)}
          distanceM={asNumber(proposal.distance_m)}
          elevationGainM={asNumber(proposal.elevation_gain_m)}
          canDecide={myStatus === 'registered'}
          decision={typeof routeDecision?.adopted === 'boolean' ? routeDecision.adopted : null}
          adoptedRevision={asNumber(routeState?.adopted_revision)}
        />
      ) : null}
      hubLink={linkedChoice || choices.length > 0
        ? <EventHubLink eventRef={eventRef} linked={linkedChoice} choices={choices} />
        : null}
    />
  );
}
