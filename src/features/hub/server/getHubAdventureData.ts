import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug } from '@/lib/queries-trips';
import { fetchUserCrews } from '@/lib/queries-crews';
import { getActiveAdventure } from '../context/activeAdventureServer';
import type { HubCounters } from '../registry/hubSectionRegistry';
import type { ActiveAdventureData } from '../context/adventureSchema';
import type { HubAdventureInput, HubSectionId } from '../engine/hubProfileEngine';
import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * H3.1 — Chargeur serveur unique de l'aventure du hub (partagé par le layout
 * /hub et l'API /api/hub/adventures — une seule source de requêtes).
 * Patterns copiés : groupes/page.tsx (groupes), queries-crews (équipages),
 * getMaterielSummary.ts:135 (prêts actifs = en_cours + en_retard).
 * RLS via le server client. Repli possession si sortie introuvable (H-AUTO-15).
 */

export interface HubGroupLite {
  id: string;
  name: string;
  member_count: number;
  my_role: string | null;
}

export interface HubCrewLite {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  active_trips_count: number;
  next_trip: { slug: string; title: string } | null;
}

export interface HubAdventureLists {
  groups: HubGroupLite[];
  pendingInvites: number;
  crews: HubCrewLite[];
  possession: { items: number; loans: number; alerts: number };
}

export interface HubAdventureData extends HubAdventureLists {
  adventure: ActiveAdventureData;
  /** Entrée moteur (compteurs résolus, enabledSections = base serveur). */
  input: HubAdventureInput;
  trip: TripFull | null;
  groupLabel: string | null;
  linkedTripSlug: string | null;
}

const EMPTY_LISTS: HubAdventureLists = {
  groups: [],
  pendingInvites: 0,
  crews: [],
  possession: { items: 0, loans: 0, alerts: 0 },
};

async function loadLists(userId: string | undefined): Promise<HubAdventureLists> {
  if (!userId) return EMPTY_LISTS;
  const supabase = await createClient();
  const out: HubAdventureLists = {
    groups: [],
    pendingInvites: 0,
    crews: [],
    possession: { items: 0, loans: 0, alerts: 0 },
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
    out.crews = (await fetchUserCrews(userId)).map((c) => ({
      id: c.id,
      name: (c as { name: string }).name,
      slug: (c as { slug: string }).slug,
      member_count: c.member_count,
      active_trips_count: c.active_trips_count ?? 0,
      next_trip: c.next_trip ? { slug: c.next_trip.slug, title: c.next_trip.title } : null,
    }));
  } catch (err) {
    console.error('[LKDV hub] crews error:', err);
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
      };
    }
    // Repli possession (aventure périmée — jamais de cul-de-sac).
    return { ...lists, adventure: { nature: 'possession' }, input: possessionInput(lists), trip: null, groupLabel: null, linkedTripSlug: null };
  }

  if (adventure.nature === 'collectif') {
    if (adventure.kind === 'groupe') {
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
      };
    }
    const c = lists.crews.find((x) => x.id === adventure.id);
    return {
      ...lists,
      adventure,
      input: {
        kind: 'collectif',
        membersCount: c?.member_count ?? 1,
        pendingInvites: 0,
        linkedTripsCount: c?.active_trips_count ?? 0,
        hasLinkedTrip: (c?.next_trip?.slug ?? null) !== null,
      },
      trip: null,
      groupLabel: c?.name ?? adventure.title,
      linkedTripSlug: c?.next_trip?.slug ?? null,
    };
  }

  return { ...lists, adventure, input: possessionInput(lists), trip: null, groupLabel: null, linkedTripSlug: null };
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
    pendingSafety: trip?.safety_checkpoints?.filter((c) => c.status === 'pending').length ?? 0,
    notes: trip?.notes?.length ?? 0,
    members:
      data.input.kind === 'collectif'
        ? data.input.membersCount
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
