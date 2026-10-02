/**
 * Exemples affichés quand un partenaire n'est pas encore activé (clés absentes).
 * Données d'illustration, toujours étiquetées « Exemple » à l'écran : aucun
 * prix ni lien ne passe pour une vraie offre, rien n'est réservable.
 */

/** Catégories cherchées en direct : Viator (activités), RouteStack (vols, trajets). */
export type CompasLiveVertical = 'activity' | 'flight' | 'car';

export interface ResaExample {
  title: string;
  detail: string;
}

export const RESA_EXAMPLES: Record<CompasLiveVertical, readonly ResaExample[]> = {
  activity: [
    { title: 'Sortie accompagnée avec un guide local', detail: 'Demi-journée · petit groupe' },
    { title: 'Initiation escalade en falaise', detail: '3 h · matériel fourni' },
    { title: 'Balade naturaliste au lever du jour', detail: '2 h · tous niveaux' },
  ],
  flight: [
    { title: 'Vol direct vers la destination', detail: 'Aller-retour · bagage cabine' },
    { title: 'Vol avec une escale', detail: 'Aller-retour · horaires souples' },
  ],
  car: [
    { title: 'Citadine, kilométrage illimité', detail: 'Prise et retour au même point' },
    { title: 'SUV pour pistes et parkings de départ', detail: 'Coffre pour sacs et bâtons' },
  ],
};
