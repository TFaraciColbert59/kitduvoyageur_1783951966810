/**
 * Lecture de la révision de tracé courante d'une sortie de club, pour la fiche (`#parcours`).
 *
 * Une révision est affichable si elle porte une géométrie : révision du catalogue (`canonical_revision_id`) ou tracé
 * issu d'un espace d'itinéraire collaboratif (`trace`, migration 20261123130000, avec `source_revision_no`). La
 * géométrie elle-même n'est jamais lue ici (elle peut peser plusieurs Mo) : seul le test « non nul » l'est.
 *
 * Trois lectures de la plus complète à la plus ancienne, selon les migrations réellement appliquées :
 *   1. socle complet + espaces (route_name, canonical_revision_id, source_revision_no, trace) ;
 *   2. schéma de production seul + espaces (ni route_name ni canonical_revision_id) ;
 *   3. socle 20261119* sans les espaces (lecture historique, révision du catalogue seulement).
 */
export type ClubRouteProposal = {
  routeName: string | null;
  distanceM: number | null;
  elevationGainM: number | null;
  /** Version de l'espace d'itinéraire dont la révision est issue ; null pour une révision du catalogue. */
  sourceRevisionNo: number | null;
};

type Row = Record<string, unknown>;
type Result = PromiseLike<{ data: unknown; error: unknown }>;
type Query = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          or: (filter: string) => { maybeSingle: () => Result };
          not: (column: string, op: string, value: unknown) => { maybeSingle: () => Result };
        };
      };
    };
  };
};

const num = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
};

function toProposal(row: Row): ClubRouteProposal {
  return {
    routeName: typeof row.route_name === 'string' && row.route_name ? row.route_name : null,
    distanceM: num(row.distance_m),
    elevationGainM: num(row.elevation_gain_m),
    sourceRevisionNo: num(row.source_revision_no),
  };
}

export async function readClubRouteProposal(
  supabase: unknown,
  eventId: string,
  revision: number,
): Promise<ClubRouteProposal | null> {
  const db = supabase as Query;
  const base = (columns: string) => db.from('club_event_route_revisions').select(columns)
    .eq('event_id', eventId).eq('revision', revision);

  const full = await base('route_name,distance_m,elevation_gain_m,source_revision_no')
    .or('canonical_revision_id.not.is.null,trace.not.is.null').maybeSingle();
  if (!full.error) return full.data ? toProposal(full.data as Row) : null;

  const productionOnly = await base('distance_m,elevation_gain_m,source_revision_no')
    .not('trace', 'is', null).maybeSingle();
  if (!productionOnly.error) return productionOnly.data ? toProposal(productionOnly.data as Row) : null;

  const legacy = await base('route_name,distance_m,elevation_gain_m')
    .not('canonical_revision_id', 'is', null).maybeSingle();
  return !legacy.error && legacy.data ? toProposal(legacy.data as Row) : null;
}
