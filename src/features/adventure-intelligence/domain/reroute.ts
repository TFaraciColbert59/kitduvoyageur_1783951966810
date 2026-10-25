/**
 * Phase 6 — Politique de reroutage (pure), géométrie réelle uniquement.
 *
 * Un reroutage ne sélectionne JAMAIS une estimation : les candidats sont des
 * parcours `hiking_routes` dont la géométrie est non nulle, non vide, ≥ 2 points
 * et valide — c'est-à-dire le prédicat EXACT de `phase3_route_navigable`, qui
 * gouverne aussi `select_adventure_plan_route`. Ce module ne fait que choisir
 * un candidat ordonné parmi des lignes déjà filtrées par la RPC ; la RPC de
 * sélection revérifie le prédicat de façon atomique.
 */

/** Candidat de reroutage issu de `phase3_search_navigable_routes`. */
export interface RerouteCandidate {
  routeId: number;
  /** Distance réelle à la géométrie (mètres), `null` si non calculée. */
  distanceM: number | null;
  /** Nombre de termes de recherche matchés (0 si aucun terme fourni). */
  matchCount: number;
}

export interface SelectRerouteCandidateOptions {
  /** Parcours actuellement sélectionné, jamais reproposé. */
  excludeRouteId?: number | null;
}

function finiteDistance(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Ordonne puis choisit le meilleur candidat alternatif :
 *   1. distance réelle croissante (les non calculées en dernier) ;
 *   2. nombre de correspondances décroissant ;
 *   3. id croissant (déterminisme).
 * Retourne `null` si aucun candidat exploitable (jamais de fallback inventé).
 */
export function selectRerouteCandidate(
  candidates: readonly RerouteCandidate[],
  options: SelectRerouteCandidateOptions = {}
): RerouteCandidate | null {
  const excluded = options.excludeRouteId ?? null;
  const usable = candidates.filter(
    (candidate) =>
      Number.isInteger(candidate.routeId) &&
      candidate.routeId > 0 &&
      candidate.routeId !== excluded
  );
  if (usable.length === 0) return null;

  return [...usable].sort((left, right) => {
    const leftDistance = finiteDistance(left.distanceM);
    const rightDistance = finiteDistance(right.distanceM);
    if (leftDistance != null && rightDistance != null && leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    if (leftDistance == null && rightDistance != null) return 1;
    if (leftDistance != null && rightDistance == null) return -1;
    const matchDiff = (right.matchCount ?? 0) - (left.matchCount ?? 0);
    if (matchDiff !== 0) return matchDiff;
    return left.routeId - right.routeId;
  })[0];
}

/** Prédicat documenté : aucune estimation, uniquement une géométrie réelle. */
export const REROUTE_ONLY_REAL_GEOMETRY = true;
