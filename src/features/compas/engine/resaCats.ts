/**
 * Les six catégories de réservation de la maquette finale (Randos, Activités,
 * Nuits, Vols, Trajets, Extras), appliquées aux données réelles : réservations
 * du voyage (`vertical`) et offres partenaires (`category`). Fonctions pures.
 */

export type ResaCat = 'randos' | 'activites' | 'nuits' | 'vols' | 'trajets' | 'extras';

export const RESA_CATS: ReadonlyArray<{ id: ResaCat; label: string; title: string; icon: string }> =
  [
    { id: 'randos', label: 'Randos', title: 'Randonnées', icon: 'mountain' },
    { id: 'activites', label: 'Activités', title: 'Activités', icon: 'ticket' },
    { id: 'nuits', label: 'Nuits', title: 'Hébergement', icon: 'bed-double' },
    { id: 'vols', label: 'Vols', title: 'Vols', icon: 'plane' },
    { id: 'trajets', label: 'Trajets', title: 'Transports', icon: 'car' },
    { id: 'extras', label: 'Extras', title: 'Extras', icon: 'shield' },
  ];

/** Réservation du voyage → catégorie (un type inconnu est un trajet, comme avant). */
export function bookingCat(vertical: string): ResaCat {
  if (vertical === 'hotel') return 'nuits';
  if (vertical === 'flight') return 'vols';
  if (vertical === 'activity') return 'activites';
  return 'trajets';
}

/** Offre partenaire → catégorie (assurance, eSIM, matériel : extras). */
export function offerCat(category: string | null): ResaCat {
  switch (category) {
    case 'hotel':
      return 'nuits';
    case 'flight':
      return 'vols';
    case 'activity':
      return 'activites';
    case 'transport':
      return 'trajets';
    default:
      return 'extras';
  }
}
