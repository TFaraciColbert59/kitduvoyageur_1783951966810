// src/features/pays/recommendations/recommendationEngine.ts
// Recommandations contextuelles DÉTERMINISTES à partir de données réelles
// (spots, itinéraires, difficulté, sentiers, saison). Aucune donnée inventée :
// seuls les éléments fournis sont recommandés, avec une raison explicite.
import type {
  DifficulteItem,
  ItineraireItem,
  SpotItem,
} from '@/lib/ai/country-content/contentBlocksTypes';
import type {
  PaysTrail,
  Recommendation,
  RecommendationDuration,
  RecommendationLevel,
  RecommendationProfile,
} from '../types';

export interface RecommendationInputs {
  countryName: string;
  seasonLabel: string | null;
  spots: SpotItem[];
  itineraires: ItineraireItem[];
  difficulte: DifficulteItem[];
  trails: PaysTrail[];
}

const LEVEL_TOKENS: Record<RecommendationLevel, string[]> = {
  facile: ['facile', 'easy', 'débutant', 'debutant', 'accessible', 'familial'],
  modere: ['modérée', 'moderee', 'modéré', 'modere', 'moderate', 'moyen', 'facile', 'easy'],
  expert: ['difficile', 'hard', 'technique', 'expert', 'engagé', 'engage'],
};

const DURATION_LABEL: Record<RecommendationDuration, string> = {
  weekend: 'un week-end',
  semaine: 'une semaine',
  expedition: 'une expédition longue',
};

const LEVEL_LABEL: Record<RecommendationLevel, string> = {
  facile: 'débutant',
  modere: 'intermédiaire',
  expert: 'expérimenté',
};

function matchesDifficulty(text: string | null | undefined, level: RecommendationLevel): boolean {
  const value = (text ?? '').toLowerCase();
  if (!value) return false;
  return LEVEL_TOKENS[level].some((token) => value.includes(token));
}

function durationFits(days: number, duration: RecommendationDuration): boolean {
  if (duration === 'weekend') return days <= 2;
  if (duration === 'semaine') return days >= 2 && days <= 7;
  return days >= 4;
}

/** Construit des recommandations bornées (≤ 6) et toujours justifiées. */
export function buildRecommendations(
  inputs: RecommendationInputs,
  profile: RecommendationProfile
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 1. Saison (donnée réelle du pays)
  if (inputs.seasonLabel) {
    recommendations.push({
      kind: 'season',
      title: `Période conseillée : ${inputs.seasonLabel}`,
      reason: `Fenêtre optimale indiquée pour ${inputs.countryName}.`,
      meta: `Mois ${profile.month}`,
    });
  }

  // 2. Itinéraires adaptés (difficulté + durée)
  const itineraires = inputs.itineraires
    .filter((itineraire) => matchesDifficulty(itineraire.difficulte, profile.level))
    .filter((itineraire) => durationFits(Number(itineraire.duree_jours) || 0, profile.duration))
    .slice(0, 2);
  for (const itineraire of itineraires) {
    recommendations.push({
      kind: 'itineraire',
      title: itineraire.nom,
      reason: `Adapté à un profil ${LEVEL_LABEL[profile.level]} pour ${DURATION_LABEL[profile.duration]}.`,
      meta: [itineraire.duree_jours ? `${itineraire.duree_jours} j` : null, itineraire.difficulte]
        .filter(Boolean)
        .join(' · '),
    });
  }

  // 3. Sentiers réels (difficulté)
  const trails = inputs.trails
    .filter((trail) => matchesDifficulty(trail.difficulty, profile.level))
    .slice(0, 2);
  for (const trail of trails) {
    recommendations.push({
      kind: 'trail',
      title: trail.name,
      reason: `Sentier ${trail.difficulty ? trail.difficulty.toLowerCase() : 'réel'} situé dans l’emprise du pays.`,
      meta: trail.distanceKm ? `${trail.distanceKm} km` : undefined,
    });
  }

  // 4. Spots incontournables (toujours pertinents)
  for (const spot of inputs.spots.slice(0, 2)) {
    recommendations.push({
      kind: 'spot',
      title: spot.nom,
      reason: spot.localisation
        ? `Incontournable repéré (${spot.localisation}).`
        : 'Incontournable repéré dans les données LKDV.',
      meta: spot.type_outdoor || undefined,
    });
  }

  // 5. Repli neutre si aucune donnée exploitable
  if (recommendations.length === 0) {
    return [];
  }

  return recommendations.slice(0, 6);
}
