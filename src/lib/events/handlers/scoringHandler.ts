import type { LkvEvent } from '../types';

export interface ScoringResult {
  pointsEarned: number;
  reason: string;
  badgeEarned?: string;
}

export function handleScoringEvent(event: LkvEvent): ScoringResult {
  const meta = event.metadata || {};

  switch (event.event_type) {
    case 'place.reviewed':
      if (meta.hasFieldProof) {
        return {
          pointsEarned: 50,
          reason: 'Avis certifié sur le terrain avec preuve GPS/photo',
          badgeEarned: 'Sentinelle des Refuges',
        };
      }
      return {
        pointsEarned: 15,
        reason: 'Avis sur un lieu communautaire',
      };

    case 'trip.completed':
      return {
        pointsEarned: 100,
        reason: 'Expédition complète menée à terme',
        badgeEarned: 'Grand Voyageur',
      };

    case 'carnet.published':
      return {
        pointsEarned: 35,
        reason: 'Publication d’un carnet d’aventure',
      };

    case 'gear.packed':
      return {
        pointsEarned: 2,
        reason: 'Équipement validé dans le sac',
      };

    default:
      return {
        pointsEarned: 5,
        reason: 'Participation active à la plateforme LKDV',
      };
  }
}
