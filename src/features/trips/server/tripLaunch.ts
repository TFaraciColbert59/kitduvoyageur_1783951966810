import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Revendication atomique du lancement d'une activite de sentier.
 *
 * Enveloppe les trois RPC SECURITY DEFINER de
 * `20260926040000_trip_launch_atomicity.sql`. Le contrat :
 *
 *   claim     -> 'ready'      : l'activite existe deja, rien a creer
 *             -> 'claimed'    : reservation posee, l'appelant cree le voyage
 *             -> 'in_progress': une reservation concurrente est en cours
 *   complete  -> 'ready'      : route_id attache, reservation 'ready'
 *             -> 'lost'       : course perdue, l'activite gagnante est retournee
 *   fail      -> compensation atomique (suppression de l'orphelin + 'failed')
 *
 * Sans ces RPC, la sequence "creer le voyage puis ecrire metadata.route_id"
 * laissait une fenetre ou un voyage existe sans `route_id` : invisible de
 * `findExistingTrip`, donc duplique a chaque nouvelle tentative. La reservation
 * rend l'etat partiel representable et explicite plutot que silencieux.
 */

export type LaunchClaimStatus = 'ready' | 'claimed' | 'in_progress' | 'unavailable';
export type LaunchCompleteStatus = 'ready' | 'lost' | 'unavailable';

export interface LaunchTrip {
  tripId: string;
  slug: string;
  title: string;
}

export type LaunchClaim =
  | { status: 'ready'; trip: LaunchTrip }
  | { status: 'claimed' }
  | { status: 'in_progress' }
  | { status: 'unavailable' };

export type LaunchCompletion =
  | { status: 'ready'; trip: LaunchTrip }
  | { status: 'lost'; trip: LaunchTrip }
  | { status: 'unavailable' };

interface LaunchRpcRow {
  status: string | null;
  trip_id: string | null;
  slug: string | null;
  title: string | null;
}

function toTrip(row: LaunchRpcRow): LaunchTrip | null {
  if (!row.trip_id) return null;
  return {
    tripId: String(row.trip_id),
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
  };
}

function firstRow(data: unknown): LaunchRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object' ? (row as LaunchRpcRow) : null;
}

/**
 * Reserve le couple (userId, routeId) ou renvoie l'activite deja gagnante.
 *
 * Une reservation `in_progress` يعني qu'un autre appel prepare le meme
 * sentier : l'appelant doit attendre la winning trip plutot que d'ecrire.
 */
export async function claimTripLaunch(
  db: SupabaseClient,
  userId: string,
  routeId: number
): Promise<LaunchClaim> {
  const { data, error } = await db.rpc('claim_trip_launch', {
    p_user_id: userId,
    p_route_id: routeId,
  });

  if (error) {
    // 42P01/42883 : migration absente en base. On degrade vers le chemin
    // historique plutot que de casser la page, mais on journalise.
    console.error('[tripLaunch] claim indisponible:', error.code ?? 'unknown');
    return { status: 'unavailable' };
  }

  const row = firstRow(data);
  if (!row || typeof row.status !== 'string') return { status: 'unavailable' };

  if (row.status === 'ready') {
    const trip = toTrip(row);
    return trip ? { status: 'ready', trip } : { status: 'unavailable' };
  }
  if (row.status === 'in_progress') return { status: 'in_progress' };
  if (row.status === 'claimed') return { status: 'claimed' };
  return { status: 'unavailable' };
}

/**
 * Attache `route_id` et bascule la reservation en `ready` dans UNE transaction.
 * `lost` signale une course perdue : la winning trip est retournee, l'appelant
 * compense son propre orphelin via `failTripLaunch`.
 */
export async function completeTripLaunch(
  db: SupabaseClient,
  userId: string,
  routeId: number,
  tripId: string
): Promise<LaunchCompletion> {
  const { data, error } = await db.rpc('complete_trip_launch', {
    p_user_id: userId,
    p_route_id: routeId,
    p_trip_id: tripId,
  });

  if (error) {
    console.error('[tripLaunch] complete en echec:', error.code ?? 'unknown');
    return { status: 'unavailable' };
  }

  const row = firstRow(data);
  if (!row || (row.status !== 'ready' && row.status !== 'lost')) {
    return { status: 'unavailable' };
  }
  const trip = toTrip(row);
  if (!trip) return { status: 'unavailable' };
  return { status: row.status, trip };
}

/**
 * Compensation atomique : supprime le voyage orphelin (celui qui ne porte pas
 * encore `route_id`) et marque la reservation `failed` dans la meme
 * transaction. Une reservation deja `ready` n'est jamais compensee : la compensation concurrente est un no-op.
 */
export async function failTripLaunch(
  db: SupabaseClient,
  userId: string,
  routeId: number,
  tripId: string | null,
  reason: string
): Promise<'failed' | 'ready' | 'unavailable'> {
  const { data, error } = await db.rpc('fail_trip_launch', {
    p_user_id: userId,
    p_route_id: routeId,
    p_trip_id: tripId,
    p_reason: reason.slice(0, 200),
  });

  if (error) {
    console.error('[tripLaunch] compensation en echec:', error.code ?? 'unknown');
    return 'unavailable';
  }

  const row = firstRow(data);
  if (!row || typeof row.status !== 'string') return 'unavailable';
  if (row.status === 'ready' || row.status === 'failed') return row.status;
  return 'unavailable';
}