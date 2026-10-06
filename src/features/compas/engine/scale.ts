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

/**
 * Bornes de la maquette v8 (zones de la règle de durée), bornes hautes
 * exclues. La règle et l'en-tête « Où » lisent cette seule table.
 */
export function classifyScale(hours: number | null): TripScale | null {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 3) return { id: 'sortie', label: 'Sortie', rule: 'moins de 3 h' };
  if (hours < 12) return { id: 'journee', label: 'Journée', rule: '3 h à 12 h' };
  if (hours < 2 * H) return { id: 'raid', label: 'Raid', rule: '12 h à 2 jours' };
  if (hours < 10 * H) return { id: 'expedition', label: 'Expédition', rule: '2 à 10 jours' };
  return { id: 'monde', label: 'Monde', rule: '10 jours et plus' };
}

/**
 * Durée qui fixe l'échelle affichée. Une seule journée au calendrier (24 h)
 * n'est pas un raid : on prend le temps d'effort du tracé quand il est connu
 * (10 km de course ≈ 1 h → Sortie), sinon une journée d'activité (Journée).
 */
export function scaleHours(hours: number | null, routeMinutes: number | null | undefined): number | null {
  if (hours !== 24) return hours;
  if (routeMinutes != null && routeMinutes > 0 && routeMinutes < 24 * 60) return routeMinutes / 60;
  return 8;
}
