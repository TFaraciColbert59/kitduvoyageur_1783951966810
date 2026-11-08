import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EventDetailClient, { type EventDetailData } from './EventDetailClient';
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
 * `.ics`. Elle lit la base sous RLS (lecture publique des `events`), ne crée rien
 * et ne modifie rien côté serveur.
 */
export default async function SortiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: eventRow, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error || !eventRow) notFound();

  const event = eventRow as Row;
  const organizerId = asString(event.organizer_id);
  const clubId = asString(event.club_id);
  const kitId = asString(event.kit_id);

  const [{ data: organizerRow }, { data: participantRows }, { data: clubRow }, { data: kitRow }] =
    await Promise.all([
      organizerId
        ? supabase.from('public_profiles').select('*').eq('id', organizerId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('event_participants').select('*').eq('event_id', id),
      clubId ? supabase.from('clubs').select('id,slug,name').eq('id', clubId).maybeSingle() : Promise.resolve({ data: null }),
      kitId
        ? supabase
            .from('materiel_kits')
            .select('id,name,total_weight_g,is_public')
            .eq('id', kitId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const participantsRaw = (participantRows ?? []) as Row[];
  const participantIds = participantsRaw
    .map((row) => asString(row.user_id))
    .filter((value): value is string => Boolean(value));
  const { data: participantProfiles } =
    participantIds.length > 0
      ? await supabase.from('public_profiles').select('*').in('id', participantIds)
      : { data: [] as Row[] };

  const profilesById = new Map<string, Row>();
  for (const profile of (participantProfiles ?? []) as Row[]) {
    const profileId = asString(profile.id);
    if (profileId) profilesById.set(profileId, profile);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const currentParticipants = participants.filter((p) => p.status === 'confirmed').length || (asNumber(event.current_participants) ?? 0);
  const startsAtMs = startsAt ? Date.parse(startsAt) : eventDate ? Date.parse(`${eventDate}T23:59:59+01:00`) : NaN;
  const past = Number.isFinite(startsAtMs) ? startsAtMs < Date.now() : false;
  const status = asString(event.status);

  const organizerProfile = organizerRow as Row | null;
  const coverImage = asString(event.cover_image);
  const coverAlt = asString(event.cover_alt) ?? asString(event.title) ?? 'Sortie';

  const data: EventDetailData = {
    id,
    title: asString(event.title) ?? 'Sortie',
    description: asString(event.description),
    activity: asString(event.activity) ?? asString(event.type) ?? 'rando',
    emoji: asString(event.emoji),
    eventDate,
    startsAt,
    endsAt,
    duration: asString(event.duration),
    location: asString(event.location) ?? '',
    meetingPoint: asString(event.meeting_point),
    level: (asString(event.level) as EventDetailData['level']) ?? null,
    distanceKm: asNumber(event.distance_km),
    elevationGainM: asNumber(event.elevation_gain_m),
    lat: asNumber(event.meeting_lat) ?? null,
    lng: asNumber(event.meeting_lng) ?? null,
    meetingGeom: (event.meeting_geom as { type?: string; coordinates?: [number, number] } | null) ?? null,
    coverImage,
    coverAlt,
    maxParticipants,
    currentParticipants,
    waitlistEnabled: Boolean(event.waitlist_enabled),
    status: status ?? null,
    past: past || status === 'past',
    cancelled: status === 'cancelled',
    recurrence: (asString(event.recurrence) as EventDetailData['recurrence']) ?? null,
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

  return <EventDetailClient event={data} signedIn={Boolean(user?.id)} />;
}
