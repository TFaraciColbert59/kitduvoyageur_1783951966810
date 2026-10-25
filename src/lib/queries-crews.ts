/**
 * LKDV — Requêtes Serveur & Agrégations pour Équipages (Phase 4.1)
 * Élimine le problème N+1 (D12) en agrégeant membres et voyages en temps O(1) requêtes.
 */

import { createClient } from '@/lib/supabase/server';
import type { Crew, CrewMember, CrewSummary, CrewWithDetails } from '@/features/crews/types/crew.types';
import { isCrewVisible } from '@/features/hub/engine/crewVisibility';
import { fetchPublicProfiles } from '@/lib/queries/publicProfiles';

export interface RawCrewTrip {
  id: string;
  crew_id?: string | null;
  title: string;
  slug: string;
  start_date: string | null;
  destination_name?: string | null;
  end_date?: string | null;
  status?: string;
}

/**
 * Fonction pure d'agrégation sans boucle N+1 :
 * Associe les décomptes de membres, le rôle utilisateur et le prochain voyage planifié.
 */
export function aggregateCrewsData(
  crews: Crew[],
  members: Array<Pick<CrewMember, 'crew_id' | 'user_id' | 'role' | 'status'>>,
  trips: RawCrewTrip[],
  currentUserId?: string | null
): CrewSummary[] {
  // 1. Indexation des membres par crew_id
  const membersByCrew = new Map<string, typeof members>();
  for (const m of members) {
    if (m.status !== 'active') continue;
    const existing = membersByCrew.get(m.crew_id) || [];
    existing.push(m);
    membersByCrew.set(m.crew_id, existing);
  }

  // 2. Indexation des voyages par crew_id (triés par start_date)
  const tripsByCrew = new Map<string, RawCrewTrip[]>();
  for (const t of trips) {
    if (!t.crew_id) continue;
    const existing = tripsByCrew.get(t.crew_id) || [];
    existing.push(t);
    tripsByCrew.set(t.crew_id, existing);
  }

  return crews.map(crew => {
    const crewMembers = membersByCrew.get(crew.id) || [];
    const crewTrips = tripsByCrew.get(crew.id) || [];

    // Mon rôle dans cet équipage
    let myRole: Crew['created_by'] extends string ? any : null = null;
    if (currentUserId) {
      if (crew.created_by === currentUserId) {
        myRole = 'owner';
      } else {
        const found = crewMembers.find(m => m.user_id === currentUserId);
        if (found) myRole = found.role;
      }
    }

    // Prochain voyage planifié
    const nextTrip = crewTrips.length > 0 ? {
      id: crewTrips[0].id,
      title: crewTrips[0].title,
      slug: crewTrips[0].slug,
      start_date: crewTrips[0].start_date,
    } : null;

    return {
      ...crew,
      member_count: crewMembers.length,
      my_role: myRole,
      active_trips_count: crewTrips.length,
      next_trip: nextTrip,
    };
  });
}

/**
 * Récupère les équipages d'un utilisateur connecté (Server-Side).
 * 2 requêtes au total, 0 boucle N+1.
 */
export async function fetchUserCrews(userId: string): Promise<CrewSummary[]> {
  const supabase = await createClient();

  // 1. Récupération des affiliations actives
  const { data: memberRows, error: memberErr } = await supabase
    .from('crew_members')
    .select('crew_id, user_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (memberErr || !memberRows) {
    return [];
  }

  const crewIds = memberRows.map(m => m.crew_id);
  if (crewIds.length === 0) return [];

  // 2. Récupération des équipages
  const { data: crews, error: crewsErr } = await supabase
    .from('crews')
    .select('*')
    .in('id', crewIds)
    .order('created_at', { ascending: false });

  if (crewsErr || !crews) return [];

  // 3. Batch membres pour tous ces équipages
  const { data: allMembers } = await supabase
    .from('crew_members')
    .select('crew_id, user_id, role, status')
    .in('crew_id', crewIds)
    .eq('status', 'active');

  // 4. Batch voyages
  const { data: allTrips } = await supabase
    .from('trips')
    .select('id, crew_id, title, slug, start_date')
    .in('crew_id', crewIds)
    .order('start_date', { ascending: true });

  // 5. Couche groupe universelle : un équipage auto-créé reste invisible
  //    tant qu'il est solo (H-ACT §4).
  return aggregateCrewsData(crews as Crew[], (allMembers || []) as any, (allTrips || []) as any, userId)
    .filter(isCrewVisible);
}

/**
 * Récupère les équipages publics (Découverte) (Server-Side).
 */
export async function fetchPublicCrews(options?: {
  search?: string;
  theme?: string;
  limit?: number;
  currentUserId?: string | null;
}): Promise<CrewSummary[]> {
  const supabase = await createClient();
  const limit = options?.limit || 30;

  let query = supabase
    .from('crews')
    .select('*')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.theme && options.theme !== 'Tous') {
    query = query.eq('theme', options.theme);
  }

  if (options?.search) {
    query = query.ilike('name', `%${options.search}%`);
  }

  const { data: crews, error } = await query;
  if (error || !crews || crews.length === 0) return [];

  const crewIds = crews.map(c => c.id);

  // Batch membres
  const { data: allMembers } = await supabase
    .from('crew_members')
    .select('crew_id, user_id, role, status')
    .in('crew_id', crewIds)
    .eq('status', 'active');

  // Batch voyages
  const { data: allTrips } = await supabase
    .from('trips')
    .select('id, crew_id, title, slug, start_date')
    .in('crew_id', crewIds)
    .order('start_date', { ascending: true });

  return aggregateCrewsData(crews as Crew[], (allMembers || []) as any, (allTrips || []) as any, options?.currentUserId)
    .filter(isCrewVisible);
}

/**
 * Récupère les détails d'un équipage par slug (Server-Side).
 */
export async function fetchCrewBySlug(slug: string, currentUserId?: string | null): Promise<CrewWithDetails | null> {
  const supabase = await createClient();

  const { data: crew, error } = await supabase
    .from('crews')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !crew) return null;

  // Récupérer les membres (FK → vue publique deux étapes, cf. F1)
  const { data: members } = await supabase
    .from('crew_members')
    .select('crew_id, user_id, role, status, joined_at')
    .eq('crew_id', crew.id)
    .eq('status', 'active');

  // Récupérer les voyages rattachés
  const { data: trips } = await supabase
    .from('trips')
    .select('id, title, slug, destination_name, start_date, end_date, status')
    .eq('crew_id', crew.id)
    .order('start_date', { ascending: false });

  const memberRows = (members || []) as any[];
  const profiles = await fetchPublicProfiles(memberRows.map((m: any) => m.user_id as string));
  // `username` n'existe pas dans public_profiles : null explicite (jamais de
  // colonne sensible ajoutée à la vue).
  const activeMembers = memberRows.map((m: any) => ({
    ...m,
    profile: profiles[m.user_id]
      ? {
          full_name: profiles[m.user_id].full_name,
          username: null,
          avatar_url: profiles[m.user_id].avatar_url,
        }
      : null,
  }));
  const userMember = currentUserId ? activeMembers.find(m => m.user_id === currentUserId) : null;
  const isOwner = currentUserId ? crew.created_by === currentUserId : false;
  const isOrganizer = userMember ? userMember.role === 'owner' || userMember.role === 'organizer' : false;

  return {
    ...(crew as Crew),
    members: activeMembers,
    trips: (trips || []) as any[],
    permissions: {
      canEdit: isOwner || isOrganizer,
      canDelete: isOwner,
      canInvite: isOwner || isOrganizer,
      canManageMembers: isOwner || isOrganizer,
    },
  };
}
