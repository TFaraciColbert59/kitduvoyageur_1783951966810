/**
 * T36 — Ligues : règles pures, miroir du SQL `create_league_cohorts`.
 *   • population minimale de 20 éligibles RÉELS (hors démos, opt-in requis) ;
 *   • ordre déterministe (points de saison desc, puis user_id asc) : les
 *     cohortes gelées sont stables et reproductibles ;
 *   • aucune ligue fantôme : moins de 20 → aucune cohorte ;
 *   • la promotion ne change ni XP permanents ni permissions (aucun gain ici).
 */

export const MIN_LEAGUE_POPULATION = 20;

export interface LeagueCandidate {
  userId: string;
  seasonPoints: number;
  isDemo: boolean;
  competitionOptIn: boolean;
}

export function eligibleForLeagues(candidates: readonly LeagueCandidate[]): LeagueCandidate[] {
  return candidates
    .filter((candidate) => !candidate.isDemo && candidate.competitionOptIn)
    .sort((a, b) =>
      b.seasonPoints !== a.seasonPoints
        ? b.seasonPoints - a.seasonPoints
        : a.userId.localeCompare(b.userId)
    );
}

export function buildLeagueCohorts(
  candidates: readonly LeagueCandidate[],
  size = 30
): string[][] {
  const eligible = eligibleForLeagues(candidates);
  if (eligible.length < MIN_LEAGUE_POPULATION) return [];
  const chunk = Math.max(10, Math.min(size, 100));
  const cohorts: string[][] = [];
  for (let index = 0; index < eligible.length; index += chunk) {
    cohorts.push(eligible.slice(index, index + chunk).map((candidate) => candidate.userId));
  }
  return cohorts;
}
