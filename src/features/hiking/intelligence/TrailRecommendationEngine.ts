import { HikerProfileStats } from '../services/HikerProfileService';

export interface RecommendedTrail {
  routeId: string;
  name: string;
  distanceKm: number;
  elevationGainM?: number | null;
  difficulty?: string | null;
  matchScore: number; // 0 to 100
  reason: string;
  category: 'PROGRESSION' | 'DECOUVERTE' | 'CHALLENGE' | 'HABITUDE';
}

export class TrailRecommendationEngine {
  /**
   * Génère des recommandations de randonnées expliquées à partir du profil réel du randonneur.
   */
  public static recommendTrails(
    profile: HikerProfileStats,
    availableRoutes: Array<{
      id: string | number;
      name: string;
      distanceKm?: number | null;
      elevationGainM?: number | null;
      difficulty?: string | null;
    }>,
    completedRouteIds: Array<string | number> = []
  ): RecommendedTrail[] {
    if (!availableRoutes || availableRoutes.length === 0) return [];

    const completedSet = new Set(completedRouteIds.map(String));
    const userAvgDist = profile.totalSessions > 0 ? profile.avgDistanceKm : 6.0;

    const results: RecommendedTrail[] = [];

    for (const route of availableRoutes) {
      const idStr = String(route.id);
      const dist = Number(route.distanceKm || 0);
      if (dist <= 0) continue;

      const isCompleted = completedSet.has(idStr);
      let matchScore = 50;
      let reason = '';
      let category: RecommendedTrail['category'] = 'DECOUVERTE';

      // Calcul d'adéquation de distance
      const distRatio = dist / userAvgDist;

      if (!isCompleted && distRatio >= 0.9 && distRatio <= 1.25) {
        matchScore += 35;
        category = 'PROGRESSION';
        reason = `Correspond à ta distance habituelle (${userAvgDist.toFixed(1)} km) avec une légère progression.`;
      } else if (!isCompleted && distRatio > 1.25 && distRatio <= 1.6) {
        matchScore += 25;
        category = 'CHALLENGE';
        reason = `Propose un nouveau challenge de ${dist.toFixed(1)} km, supérieur à ton habitude.`;
      } else if (!isCompleted && distRatio < 0.9) {
        matchScore += 20;
        category = 'DECOUVERTE';
        reason = `Itinéraire court et accessible (${dist.toFixed(1)} km) pour une sortie détente.`;
      } else if (isCompleted) {
        matchScore += 10;
        category = 'HABITUDE';
        reason = `Itinéraire déjà exploré et validé par le passé.`;
      }

      // Bonus de score si le profil est plus expérimenté
      if (profile.levelTitle === 'Aventurier' || profile.levelTitle === 'Expert') {
        if (dist > 12) matchScore += 15;
      }

      results.push({
        routeId: idStr,
        name: route.name || `Itinéraire #${idStr}`,
        distanceKm: Number(dist.toFixed(1)),
        elevationGainM: route.elevationGainM ? Math.round(Number(route.elevationGainM)) : null,
        difficulty: route.difficulty || null,
        matchScore: Math.min(100, matchScore),
        reason,
        category,
      });
    }

    // Trier par score d'adéquation décroissant
    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
  }
}
