import 'server-only';

import { listBookings, type BookingStore } from '@/features/booking/server/bookingPersistence';
import { isOwnMediaUrl, parseMomentMeta } from '@/features/carnet/detail/momentTypes';
import { privateMomentMediaPath } from '@/features/carnet/detail/privateMomentMedia';
import { createClient } from '@/lib/supabase/server';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import type { HubAdventureData } from '../server/getHubAdventureData';
import { buildCockpitReservations } from './booking';
import { buildCockpit, type CockpitData } from './model';
import { momentClock } from './day';

type ClubRouteUpdateRow = {
  event_id: string;
  event_title: string;
  revision: number;
  adopted_revision: number | null;
  decision_pending: boolean;
};

const COLLECTIVE_ROLES: Record<string, string> = {
  organizer: 'Responsable',
  co_organizer: 'Co-organisateur',
  member: 'Membre',
  observer: 'Observateur',
};

async function loadCollectiveCockpit(
  data: HubAdventureData,
  cockpit: CockpitData,
  groupId: string,
): Promise<CockpitData> {
  const group = data.groups.find((entry) => entry.id === groupId);
  if (!group) return { ...cockpit, collective: false, title: 'Mes aventures' };

  const supabase = await createClient();
  const { data: rows, error } = await supabase.from('group_members')
    .select('user_id,role,status')
    .eq('group_id', group.id)
    .in('status', ['active', 'pending'])
    .order('joined_at', { ascending: true })
    .order('user_id');
  if (error) return { ...cockpit, peopleUnavailable: true };
  const active = (rows ?? []).filter((member) => member.status === 'active' && member.user_id);
  const profiles = await fetchPublicProfilesWith(supabase, active.map((member) => member.user_id));
  return {
    ...cockpit,
    people: active.map((member) => {
      const profile = profiles[member.user_id];
      return {
        id: member.user_id,
        name: profile?.full_name ?? profile?.handle ?? null,
        avatar: profile?.avatar_url,
        handle: profile?.handle,
        role: COLLECTIVE_ROLES[member.role] ?? 'Membre',
      };
    }),
    peopleCount: active.length,
    pending: (rows ?? []).filter((member) => member.status === 'pending').length,
  };
}

export async function loadCockpit(data: HubAdventureData): Promise<CockpitData> {
  const cockpit = buildCockpit(data);
  if (data.adventure.nature === 'collectif') return loadCollectiveCockpit(data, cockpit, data.adventure.id);
  const { trip } = data;
  if (!trip) return cockpit;

  const supabase = await createClient();
  const hasCachedViewer = data.viewer !== undefined;
  const [session, participants, bookings, carnets, kit, clubRouteUpdates] = await Promise.all([
    hasCachedViewer
      ? Promise.resolve({ data: { user: data.viewer } })
      : supabase.auth.getUser(),
    trip.user_role || trip.confirmed_participant
      ? supabase.from('trip_participants').select('user_id,role')
          .eq('trip_id', trip.id).eq('status', 'confirmed')
          .order('joined_at', { ascending: true }).order('user_id')
      : null,
    trip.permissions.canEdit
      ? listBookings(supabase as unknown as BookingStore, trip.id)
      : null,
    supabase.from('carnets').select('id,author_id').eq('trip_id', trip.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    trip.kit_id ? supabase.from('materiel_kits').select('name').eq('id', trip.kit_id).eq('is_trashed', false).maybeSingle() : null,
    supabase.rpc('get_trip_club_route_updates', { p_trip_id: trip.id }),
  ]);
  const viewer = session.data.user;
  const selectedCarnet = carnets.data;
  const people = new Map(cockpit.people.map((person) => [person.id, person]));
  for (const participant of participants?.data ?? []) {
    const existing = people.get(participant.user_id);
    const role = participant.role === 'owner' || participant.role === 'organizer' ? 'Responsable' : 'Participant';
    people.set(participant.user_id, { ...existing, id: participant.user_id,
      name: existing?.name ?? null, role: existing?.role ?? role, confirmed: true });
  }
  const [profiles, moments, collaboration] = await Promise.all([
    fetchPublicProfilesWith(supabase, [...people.keys()]),
    selectedCarnet ? readMoments(supabase, selectedCarnet.id) : null,
    selectedCarnet && viewer && viewer.id !== selectedCarnet.author_id
      ? supabase.rpc('is_carnet_editor', { p_carnet: selectedCarnet.id })
      : null,
  ]);

  const clubRouteUpdateRows: ClubRouteUpdateRow[] = Array.isArray(clubRouteUpdates.data)
    ? (clubRouteUpdates.data as ClubRouteUpdateRow[])
    : [];

  return {
    ...cockpit,
    clubRouteUpdates: clubRouteUpdateRows.map((row) => ({
      eventId: row.event_id,
      title: row.event_title,
      revision: row.revision,
      adoptedRevision: row.adopted_revision,
      decisionPending: row.decision_pending,
    })),
    peopleCount: cockpit.peopleCount == null ? null : Math.max(cockpit.peopleCount, people.size),
    people: [...people.values()].map((person) => {
      const profile = profiles[person.id];
      return {
        ...person,
        name: profile?.full_name ?? profile?.handle ?? person.name,
        avatar: profile?.avatar_url ?? person.avatar,
        handle: profile?.handle ?? person.handle,
      };
    }),
    reservations: bookings && !bookings.error ? buildCockpitReservations(data, bookings.data ?? []) : null,
    carnet: selectedCarnet ? {
      id: selectedCarnet.id,
      editable: Boolean(viewer && (viewer.id === selectedCarnet.author_id || collaboration?.data === true)),
      moments: (moments?.data ?? []).map((row) => ({
        id: row.id, title: row.citation || row.lieu || 'Moment', day: row.jour_numero, type: row.moment_type,
        time: momentClock(row.heure, row.moment_timestamp),
        audio: parseMomentMeta(row.moment_meta)?.audioUrl,
        media: isOwnMediaUrl(row.image_url, 'carnet-media') || isOwnMediaUrl(row.image_url, 'carnet-moments-media') ||
          privateMomentMediaPath(row.image_url, selectedCarnet.id) ? row.image_url : null,
      })),
    } : null,
    carnetUnavailable: Boolean(carnets.error || moments?.error),
    carnetKitItems: trip.items.map((item) => ({
      id: item.id, name: item.item_name, detail: item.notes ?? null, weightG: item.weight_grams, color: null,
    })),
    canCreateCarnet: Boolean(viewer?.id === trip.user_id && !carnets.error),
    kitName: kit?.data?.name,
  };
}

/** La roue compte les moments de chaque jour, y compris ceux des premières journées. */
async function readMoments(supabase: Awaited<ReturnType<typeof createClient>>, carnetId: string) {
  const size = 250;
  const fetchPage = (start: number) => supabase.from('carnet_moments')
    .select('id,citation,lieu,jour_numero,heure,moment_timestamp,image_url,moment_type,moment_meta')
    .eq('carnet_id', carnetId).order('created_at', { ascending: false }).order('id')
    .range(start, start + size - 1);
  const first = await fetchPage(0);
  if (first.error || !first.data) return first;
  const rows = first.data;
  let fetched = rows.length;
  while (fetched === size) {
    const next = await fetchPage(rows.length);
    if (next.error || !next.data) return next;
    fetched = next.data.length;
    rows.push(...next.data);
  }
  return { data: rows, error: null };
}
