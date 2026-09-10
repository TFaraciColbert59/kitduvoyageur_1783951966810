import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug, getTripStats } from '@/lib/queries-trips';
import { getWeather, type WeatherDay } from '@/features/materiel/services/getWeather';
import { getActiveAdventure } from '../context/activeAdventureServer';
import type { HubCounters } from '../registry/hubSectionRegistry';
import type { ActiveAdventureData } from '../context/adventureSchema';
import type { HubAdventureInput, HubSectionId } from '../engine/hubProfileEngine';
import { deriveActivityType, aggregateHikeStats, estimateHikeDurationMin } from '../engine/activityTypes';
import type { TripFull } from '@/features/trips/types/trip.types';
import { getTripItemImages, type TripItemImage } from './getTripItemImages';

/**
 * H3.1 — Chargeur serveur unique de l'aventure du hub (partagé par le layout
 * /hub et l'API /api/hub/adventures — une seule source de requêtes).
 * Patterns copiés : groupes/page.tsx (groupes), getMaterielSummary.ts:135
 * (prêts actifs = en_cours + en_retard). RLS via le server client. Repli
 * possession si sortie introuvable (H-AUTO-15).
 */

export interface HubGroupLite {
  id: string;
  name: string;
  member_count: number;
  my_role: string | null;
}

export interface HubAdventureLists {
  groups: HubGroupLite[];
  pendingInvites: number;
  possession: { items: number; loans: number; alerts: number };
  trips: HubUserTripLite[];
}

export interface HubCrewMemberLite {
  userId: string;
  role: string;
  status: string;
  fullName: string | null;
  avatarUrl: string | null;
}

/** Voyage de l'utilisateur, résumé pour le rail ACTIVITÉS (aggregats trip_steps réels). */
export interface HubUserTripLite {
  id: string;
  slug: string;
  title: string;
  status: string;
  primary_activity: string;
  start_date: string | null;
  cover_image_url: string | null;
  distanceKm: number;
  dPlusM: number;
  stepsCount: number;
}

/** Item de checklist de préparation (table trip_checklist_items). */
export interface HubChecklistItem {
  id: string;
  label: string;
  dueOffsetDays: number;
  done: boolean;
  doneAt: string | null;
  position: number;
}

/** Bloc groupe universel (H-ACT §4) — membres, rôles, invitations. */
export interface HubCrewBlock {
  crewId: string;
  crewName: string | null;
  autoCreated: boolean;
  /** Membres actifs (propriétaire inclus). */
  memberCount: number;
  members: HubCrewMemberLite[];
  /** Invitations en attente (crew_members pending). */
  pendingInvites: number;
}

/** Contexte randonnée (H-ACT §3) — parcours, dénivelé, météo, eau. */
export interface HubHikingContext {
  routeId: string | null;
  routeName: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  durationMin: number | null;
  waterPointsCount: number;
  coords: { lat: number; lon: number } | null;
  weather: {
    current: { tempC: number; weathercode: number; precipPct: number };
    days: WeatherDay[];
    locationLabel: string | null;
  } | null;
}

export interface HubAdventureData extends HubAdventureLists {
  adventure: ActiveAdventureData;
  /** Entrée moteur (compteurs résolus, enabledSections = base serveur). */
  input: HubAdventureInput;
  trip: TripFull | null;
  groupLabel: string | null;
  linkedTripSlug: string | null;
  /** Couche groupe universelle — présente pour toute sortie avec équipage. */
  group: HubCrewBlock | null;
  /** Contexte randonnée — présent si l'activité active est une randonnée. */
  hiking: HubHikingContext | null;
  /** Checklist de préparation du voyage actif (trip_checklist_items, [] hors sortie). */
  checklist: HubChecklistItem[];
  /** Images du kit de la sortie (shop_products.image / product_ownership.photo_url, [] hors sortie). */
  itemImages: TripItemImage[];
}

const EMPTY_LISTS: HubAdventureLists = {
  groups: [],
  pendingInvites: 0,
  possession: { items: 0, loans: 0, alerts: 0 },
  trips: [],
};

async function loadLists(userId: string | undefined): Promise<HubAdventureLists> {
  if (!userId) return EMPTY_LISTS;
  const supabase = await createClient();
  const out: HubAdventureLists = {
    groups: [],
    pendingInvites: 0,
    possession: { items: 0, loans: 0, alerts: 0 },
    trips: [],
  };

  try {
    const { data: memberData } = await supabase
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (memberData?.length) {
      const groupIds = memberData.map((m) => (m as { group_id: string }).group_id);
      const { data: rows } = await supabase
        .from('travel_groups')
        .select('id, name')
        .in('id', groupIds)
        .order('created_at', { ascending: false });
      out.groups = await Promise.all(
        ((rows ?? []) as Array<{ id: string; name: string }>).map(async (g) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id)
            .eq('status', 'active');
          return {
            ...g,
            member_count: count ?? 0,
            my_role:
              (memberData.find((m) => (m as { group_id: string }).group_id === g.id) as { role: string } | undefined)?.role ?? null,
          };
        }),
      );
    }
    const { count: invites } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');
    out.pendingInvites = invites ?? 0;
  } catch (err) {
    console.error('[LKDV hub] groups error:', err);
  }

  try {
    const [{ count: items }, { count: alerts }, { count: loans }] = await Promise.all([
      supabase.from('product_ownership').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_resolved', false),
      supabase.from('materiel_loans').select('*', { count: 'exact', head: true }).eq('lender_id', userId).in('status', ['en_cours', 'en_retard']),
    ]);
    out.possession = { items: items ?? 0, loans: loans ?? 0, alerts: alerts ?? 0 };
  } catch (err) {
    console.error('[LKDV hub] possession error:', err);
  }

  try {
    const { data: tripRows } = await supabase
      .from('trips')
      .select('id, slug, title, status, primary_activity, start_date, cover_image_url, trip_steps(distance_km, elevation_gain_m)')
      .eq('user_id', userId)
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(20);
    out.trips = ((tripRows ?? []) as Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
      primary_activity: string;
      start_date: string | null;
      cover_image_url: string | null;
      trip_steps?: Array<{ distance_km: number | null; elevation_gain_m: number | null }>;
    }>).map((row) => {
      const steps = row.trip_steps ?? [];
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        primary_activity: row.primary_activity,
        start_date: row.start_date,
        cover_image_url: row.cover_image_url,
        distanceKm: Math.round(steps.reduce((s, st) => s + Number(st.distance_km || 0), 0) * 10) / 10,
        dPlusM: Math.round(steps.reduce((s, st) => s + Number(st.elevation_gain_m || 0), 0)),
        stepsCount: steps.length,
      };
    });
  } catch (err) {
    console.error('[LKDV hub] trips error:', err);
  }

  return out;
}

function possessionInput(lists: HubAdventureLists, hasDepartEnCours = false): HubAdventureInput {
  return {
    kind: 'possession',
    itemsCount: lists.possession.items,
    loansCount: lists.possession.loans,
    alertsCount: lists.possession.alerts,
    hasDepartEnCours,
  };
}

/** Couche groupe universelle : équipage, membres, rôles, invitations. */
async function loadCrewBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<HubCrewBlock | null> {
  try {
    const { data: tripRow } = await supabase
      .from('trips')
      .select('crew_id')
      .eq('id', tripId)
      .maybeSingle();
    const crewId = (tripRow as { crew_id?: string | null } | null)?.crew_id;
    if (!crewId) return null;

    const [crewRes, membersRes] = await Promise.all([
      supabase.from('crews').select('id, name, auto_created').eq('id', crewId).maybeSingle(),
      supabase
        .from('crew_members')
        .select('user_id, role, status, profile:user_profiles!crew_members_user_id_fkey(full_name, username, avatar_url)')
        .eq('crew_id', crewId)
        .order('joined_at', { ascending: true }),
    ]);

    const crew = crewRes.data as { id: string; name: string; auto_created: boolean } | null;
    if (!crew) return null;

    const rows = (membersRes.data ?? []) as Array<{
      user_id: string;
      role: string;
      status: string;
      profile?: { full_name?: string | null; username?: string | null; avatar_url?: string | null } | null;
    }>;

    const members: HubCrewMemberLite[] = rows
      .filter((m) => m.status === 'active')
      .map((m) => ({
        userId: m.user_id,
        role: m.role,
        status: m.status,
        fullName: m.profile?.full_name ?? m.profile?.username ?? null,
        avatarUrl: m.profile?.avatar_url ?? null,
      }));
    const pendingInvites = rows.filter((m) => m.status === 'pending').length;

    return {
      crewId: crew.id,
      crewName: crew.name,
      autoCreated: Boolean(crew.auto_created),
      memberCount: members.length,
      members,
      pendingInvites,
    };
  } catch (err) {
    console.error('[LKDV hub] crew block error:', err);
    return null;
  }
}

const WATER_PATTERN = /eau|water|source|riviere|rivière|lac|fontaine|ruisseau/i;

/** Checklist de préparation réelle du voyage (trip_checklist_items, RLS can_read_trip). */
async function loadChecklist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<HubChecklistItem[]> {
  try {
    const { data } = await supabase
      .from('trip_checklist_items')
      .select('id, label, due_offset_days, done, done_at, position')
      .eq('trip_id', tripId)
      .order('due_offset_days', { ascending: false })
      .order('position', { ascending: true });
    return ((data ?? []) as Array<{
      id: string;
      label: string;
      due_offset_days: number;
      done: boolean;
      done_at: string | null;
      position: number;
    }>).map((row) => ({
      id: row.id,
      label: row.label,
      dueOffsetDays: row.due_offset_days,
      done: row.done,
      doneAt: row.done_at,
      position: row.position,
    }));
  } catch (err) {
    console.error('[LKDV hub] checklist error:', err);
    return [];
  }
}

/** Contexte randonnée : parcours (route liée ou étapes), dénivelé, météo, eau. */
async function loadHikingContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trip: TripFull,
): Promise<HubHikingContext> {
  const meta = (trip.metadata ?? {}) as { route_id?: string | number | null };
  const routeId = meta.route_id != null ? String(meta.route_id) : null;

  const stats = aggregateHikeStats(trip.steps ?? []);
  let routeName: string | null = null;
  let distanceKm = stats.hasData ? stats.distanceKm : null;
  let elevationGainM = stats.hasData ? stats.elevationGainM : null;
  let elevationLossM = stats.hasData ? stats.elevationLossM : null;
  let durationMin: number | null = null;

  if (routeId) {
    const numericId = Number(routeId);
    if (Number.isFinite(numericId)) {
      try {
        const [routeRes, metaRes] = await Promise.all([
          supabase.from('hiking_routes').select('id, name, distance_km').eq('id', numericId).maybeSingle(),
          supabase
            .from('trail_metadata')
            .select('duration_hours, elevation_gain, elevation_loss')
            .eq('trail_id', numericId)
            .maybeSingle(),
        ]);
        const route = routeRes.data as { name?: string | null; distance_km?: number | null } | null;
        const tm = metaRes.data as { duration_hours?: number | null; elevation_gain?: number | null; elevation_loss?: number | null } | null;
        if (route) {
          routeName = route.name ?? null;
          if (route.distance_km != null) distanceKm = route.distance_km;
        }
        if (tm) {
          if (tm.elevation_gain != null) elevationGainM = tm.elevation_gain;
          if (tm.elevation_loss != null) elevationLossM = tm.elevation_loss;
          if (tm.duration_hours != null) durationMin = Math.round(tm.duration_hours * 60);
        }
      } catch {
        /* repli : statistiques des étapes */
      }
    }
  }

  if (durationMin === null && distanceKm != null && elevationGainM != null) {
    durationMin = estimateHikeDurationMin(distanceKm, elevationGainM);
  }

  const firstStep = (trip.steps ?? []).find((s) => s.latitude != null && s.longitude != null);
  const coords = firstStep
    ? { lat: firstStep.latitude as number, lon: firstStep.longitude as number }
    : null;

  const waterPointsCount = (trip.pois ?? []).filter((p) =>
    WATER_PATTERN.test(`${p.category ?? ''} ${p.name}`),
  ).length;

  let weather: HubHikingContext['weather'] = null;
  try {
    const forecast = await getWeather(coords?.lat ?? null, coords?.lon ?? null, trip.destination_name);
    if (forecast) {
      weather = {
        current: forecast.current,
        days: forecast.days,
        locationLabel: forecast.location.label || null,
      };
    }
  } catch (err) {
    console.error('[LKDV hub] weather error:', err);
  }

  return {
    routeId,
    routeName,
    distanceKm,
    elevationGainM,
    elevationLossM,
    durationMin,
    waterPointsCount,
    coords,
    weather,
  };
}

export async function getHubAdventureDataInner(): Promise<HubAdventureData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const lists = await loadLists(user?.id);
  const stored = await getActiveAdventure();
  const adventure: ActiveAdventureData = stored ?? { nature: 'possession' };

  if (adventure.nature === 'sortie') {
    const trip = await getTripBySlug(adventure.slug, user?.id).catch(() => null);
    if (trip) {
      const activityType = deriveActivityType(trip.primary_activity);
      // Météo/parcours dès qu'une étape est géolocalisée — pas seulement
      // en activité « randonnée » (tout voyage outdoor mérite la météo).
      const hasGeoSteps = (trip.steps ?? []).some(
        (s) => s.latitude != null && s.longitude != null,
      );
      const [group, hiking, checklist, itemImages] = await Promise.all([
        loadCrewBlock(supabase, trip.id),
        activityType === 'hiking' || hasGeoSteps
          ? loadHikingContext(supabase, trip)
          : Promise.resolve(null),
        loadChecklist(supabase, trip.id),
        getTripItemImages(trip.id),
      ]);
      return {
        ...lists,
        adventure,
        input: {
          kind: 'sortie',
          trip,
          enabledSections: Array.isArray(trip.metadata?.enabled_sections)
            ? (trip.metadata.enabled_sections as HubSectionId[])
            : undefined,
        },
        trip,
        groupLabel: null,
        linkedTripSlug: null,
        group,
        hiking,
        checklist,
        itemImages,
      };
    }
    // Repli possession (aventure périmée — jamais de cul-de-sac).
    return { ...lists, adventure: { nature: 'possession' }, input: possessionInput(lists), trip: null, groupLabel: null, linkedTripSlug: null, group: null, hiking: null, checklist: [], itemImages: [] };
  }

  if (adventure.nature === 'collectif') {
    const g = lists.groups.find((x) => x.id === adventure.id);
    const membersCount = g?.member_count ?? 1;
    let linkedTripsCount = 0;
    try {
      const { count } = await supabase.from('trips').select('*', { count: 'exact', head: true }).eq('group_id', adventure.id);
      linkedTripsCount = count ?? 0;
    } catch {
      /* ignoré */
    }
    let linkedTripSlug: string | null = null;
    try {
      const { data } = await supabase
        .from('trips')
        .select('slug')
        .eq('group_id', adventure.id)
        .order('start_date', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      linkedTripSlug = (data as { slug: string } | null)?.slug ?? null;
    } catch {
      /* ignoré */
    }
    return {
      ...lists,
      adventure,
      input: {
        kind: 'collectif',
        membersCount,
        pendingInvites: lists.pendingInvites,
        linkedTripsCount,
        hasLinkedTrip: linkedTripSlug !== null,
      },
      trip: null,
      groupLabel: g?.name ?? adventure.title,
      linkedTripSlug,
      group: null,
      hiking: null,
      checklist: [],
      itemImages: [],
    };
  }

  return { ...lists, adventure, input: possessionInput(lists), trip: null, groupLabel: null, linkedTripSlug: null, group: null, hiking: null, checklist: [], itemImages: [] };
}

/**
 * Compteurs de navigation construits UNE fois (layout + pages partagent via
 * React cache). Miroir exact des compteurs tripSectionRegistry + hub.
 */
export function buildHubCounts(data: HubAdventureData): HubCounters {
  const trip = data.trip;
  return {
    items: data.possession.items,
    loans: data.possession.loans,
    alerts: data.possession.alerts,
    steps: trip?.steps?.length ?? 0,
    tripItems: trip?.items?.length ?? 0,
    collaborators: trip?.collaborators ? trip.collaborators.length + 1 : 0,
    expenses: trip?.expenses?.length ?? 0,
    documents: trip?.documents?.length ?? 0,
    unpacked: trip?.items?.filter((i) => !i.is_packed).length ?? 0,
    checklistPending: data.checklist?.filter((i) => !i.done).length ?? 0,
    pendingSafety: trip?.safety_checkpoints?.filter((c) => c.status === 'pending').length ?? 0,
    notes: trip?.notes?.length ?? 0,
    pois: trip?.pois?.length ?? 0,
    reservations: trip?.steps?.filter((s) => Boolean(s.accommodation_name)).length ?? 0,
    members:
      data.input.kind === 'collectif'
        ? data.input.membersCount
        : data.group
          ? data.group.memberCount
          : trip?.collaborators
            ? trip.collaborators.length + 1
            : 0,
    invites: data.pendingInvites,
    linkedTrips: data.input.kind === 'collectif' ? data.input.linkedTripsCount : 0,
  };
}

/**
 * Chargeur unique par requête (layout + pages + API partagent le résultat
 * via React cache — une seule exécution des requêtes par rendu /hub).
 */
export const getHubAdventureData = cache(getHubAdventureDataInner);

/** Stats voyage déduites UNE fois par requête (layout + pages partagent le cache React). */
export const getHubTripStats = cache((tripId: string) => getTripStats(tripId));
