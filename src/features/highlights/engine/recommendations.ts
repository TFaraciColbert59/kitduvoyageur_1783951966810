import type {
  InspirationCandidate,
  InspirationHistory,
  InspirationRecommendation,
  Sport,
  Viewer,
} from '../types';
import { canViewAudience } from '../privacy';

const DAY_MS = 24 * 60 * 60 * 1000;

function topSport(history: InspirationHistory): Sport | null {
  let winner: Sport | null = null;
  let max = 0;
  for (const [sport, count] of Object.entries(history.sportCounts) as Array<
    [Sport, number | undefined]
  >) {
    if ((count ?? 0) > max) {
      max = count ?? 0;
      winner = sport;
    }
  }
  return winner;
}

function candidateRelation(
  candidate: InspirationCandidate,
  history: InspirationHistory,
  viewer: Viewer
): 'owner' | 'follower' | 'authenticated' | 'anonymous' {
  if (viewer.id != null && candidate.authorId === viewer.id) return 'owner';
  if (viewer.id == null) return 'anonymous';
  if (candidate.authorId && history.followedAuthorIds.includes(candidate.authorId))
    return 'follower';
  return 'authenticated';
}

function recency(updatedAt: string, now: string): number {
  const ageDays = Math.max(0, (new Date(now).getTime() - new Date(updatedAt).getTime()) / DAY_MS);
  return 1.5 * Math.exp(-ageDays / 30);
}

/**
 * K1.10 — recommandation explicable (sport, région, auteurs suivis,
 * historique, proximité, fraîcheur). Aucun candidat non autorisé n'entre.
 */
export function recommendInspiration(
  history: InspirationHistory,
  candidates: readonly InspirationCandidate[],
  viewer: Viewer,
  now: string,
  limit = 6
): InspirationRecommendation[] {
  const favorite = topSport(history);
  const recommendations: InspirationRecommendation[] = [];

  for (const candidate of candidates) {
    const relation = candidateRelation(candidate, history, viewer);
    if (!canViewAudience(candidate.audience, relation)) continue;

    let score = 0;
    let reason = 'À découvrir';
    if (favorite && candidate.sport === favorite) {
      score += 4;
      reason = 'Ton sport principal';
    } else if ((history.sportCounts[candidate.sport] ?? 0) > 0) {
      score += 1.5;
      reason = 'Un sport de ton historique';
    }

    if (candidate.region) {
      const count = history.regionCounts[candidate.region] ?? 0;
      if (count > 0) {
        score += 2 + Math.min(count, 3) * 0.5;
        reason = 'Dans une région que tu suis';
      }
    }

    if (candidate.authorId && history.followedAuthorIds.includes(candidate.authorId)) {
      score += 2.5;
      reason = 'Un auteur que tu suis';
    }

    if (
      history.savedCollectionIds.includes(candidate.id) ||
      history.savedHighlightIds.includes(candidate.id)
    ) {
      score += 1.5;
      reason = 'Déjà enregistré';
    }

    if (candidate.distanceKm != null && Number.isFinite(candidate.distanceKm)) {
      score += Math.max(0, 1.5 - Math.max(0, candidate.distanceKm) / 50);
      if (score < 2.5 && candidate.distanceKm <= 20) reason = 'Proche de toi';
    }

    score += recency(candidate.updatedAt, now);
    recommendations.push({ candidate, score: Math.round(score * 100) / 100, reason });
  }

  recommendations.sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
  return recommendations.slice(0, limit);
}
