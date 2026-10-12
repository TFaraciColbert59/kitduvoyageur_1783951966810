/**
 * Droits d'un voyage, portés à la main de la base vers les tests.
 *
 * Le client en mémoire (`memorySupabase.ts`) ne rejoue PAS la RLS : ce module
 * lui fournit, pour la session courante,
 * - `rpc` : les fonctions `can_edit_trip` et `can_read_trip` ;
 * - `canSelect` : la politique `trips_select_policy` de la table `trips`.
 *
 * Source : `supabase/migrations/20260904050000_trips_core.sql` (fonctions
 * `can_read_trip`, `can_edit_trip` ; politique `trips_select_policy`), identique
 * à la base de production (`supabase/baseline/prod_schema_20260911.sql`). Le test
 * `requireEditorAuthorization.test.ts` vérifie que ces définitions n'ont pas
 * bougé : si le SQL change, le portage doit changer avec lui.
 *
 * Ce qui n'est PAS rejoué : les politiques des autres tables, celles d'écriture
 * (`trips_update_policy`…), le rôle PostgreSQL (`anon` / `authenticated`) autrement
 * que par le refus d'`EXECUTE` aux appels sans session, et l'isolation des
 * transactions. C'est la logique applicative réelle qui est éprouvée, contre
 * une copie fidèle des règles, pas la base elle-même (voir les tests pgTAP du
 * plan 2.4 pour la base).
 */
import type { Row } from './memorySupabase';

export interface TripRls {
  rpc: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown } | undefined;
  canSelect: (table: string, row: Row) => boolean;
  /** Appels `rpc` reçus (pour prouver qu'un refus précoce n'a rien interrogé). */
  rpcCalls: string[];
}

/**
 * @param rows lecture brute des tables en mémoire (les fonctions sont
 *   SECURITY DEFINER : elles lisent sans RLS).
 * @param uid `auth.uid()` de la session courante (null : aucune session).
 */
export function tripRls(rows: (table: string) => Row[], uid: () => string | null): TripRls {
  const rpcCalls: string[] = [];

  const tripOf = (tripId: unknown): Row | undefined => rows('trips').find((t) => t.id === tripId);

  /** `public.can_read_trip(p_trip_id)` */
  function canReadTrip(tripId: unknown): boolean {
    const userId = uid();
    if (tripId == null) return false;
    const trip = tripOf(tripId);
    if (!trip) return false;
    if (trip.visibility === 'public' || trip.visibility === 'unlisted') return true;
    if (userId === null) return false;
    if (trip.user_id === userId) return true;
    return rows('trip_collaborators').some((c) => c.trip_id === tripId && c.user_id === userId);
  }

  /** `public.can_edit_trip(p_trip_id)` */
  function canEditTrip(tripId: unknown): boolean {
    const userId = uid();
    if (tripId == null || userId === null) return false;
    const trip = tripOf(tripId);
    if (!trip) return false;
    if (trip.user_id === userId) return true;
    const collab = rows('trip_collaborators').find(
      (c) => c.trip_id === tripId && c.user_id === userId
    );
    return collab !== undefined && (collab.role === 'owner' || collab.role === 'editor');
  }

  return {
    rpcCalls,
    rpc: (fn, args) => {
      if (fn !== 'can_edit_trip' && fn !== 'can_read_trip') return undefined;
      rpcCalls.push(fn);
      // `REVOKE EXECUTE … FROM anon` (20260917010000) : sans session, la fonction est refusée.
      if (uid() === null)
        return {
          data: null,
          error: { code: '42501', message: `permission denied for function ${fn}` },
        };
      return {
        data: fn === 'can_edit_trip' ? canEditTrip(args.p_trip_id) : canReadTrip(args.p_trip_id),
        error: null,
      };
    },
    /** `trips_select_policy` : public/non répertorié, propriétaire, ou `can_read_trip(id)`. */
    canSelect: (table, row) => {
      if (table !== 'trips') return true;
      const userId = uid();
      return (
        row.visibility === 'public' ||
        row.visibility === 'unlisted' ||
        (userId !== null && row.user_id === userId) ||
        canReadTrip(row.id)
      );
    },
  };
}
