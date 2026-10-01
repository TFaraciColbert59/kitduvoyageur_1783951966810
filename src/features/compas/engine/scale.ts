/**
 * Compas — échelle d'un voyage : Sortie → Journée → Raid → Expédition → Monde.
 *
 * Convention de l'application (pas une norme) et uniquement fondée sur la durée
 * choisie ; sans durée, aucune échelle n'est affirmée.
 */

export type TripScaleId = 'sortie' | 'journee' | 'raid' | 'expedition' | 'monde';

export interface TripScale {
  id: TripScaleId;
  label: string;
  /** Pourquoi : la règle, lisible. */
  rule: string;
}

const H = 24;

export function classifyScale(hours: number | null): TripScale | null {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 8) return { id: 'sortie', label: 'Sortie', rule: 'moins de 8 h' };
  if (hours <= H) return { id: 'journee', label: 'Journée', rule: '8 h à 1 jour' };
  if (hours <= 4 * H) return { id: 'raid', label: 'Raid', rule: '2 à 4 jours' };
  if (hours <= 30 * H) return { id: 'expedition', label: 'Expédition', rule: '5 à 30 jours' };
  return { id: 'monde', label: 'Monde', rule: 'plus de 30 jours' };
}
