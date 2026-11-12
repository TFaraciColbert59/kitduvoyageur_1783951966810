import type { CarnetDetail } from './types';

export interface CarnetTraceEmptyState {
  title: string;
  hint: string;
}

/**
 * Texte d'état vide de la carte d'un carnet.
 *
 * Il ne doit jamais affirmer « aucune trace » quand la trace existe mais a été
 * masquée ou refusée. Source unique pour la V2, la carte historique et le
 * panneau Parcours, afin que l'écran et le texte `sr-only` racontent la même
 * chose.
 */
export function carnetTraceEmptyState(
  detail: Pick<CarnetDetail, 'traceFullyMasked' | 'traceError'>
): CarnetTraceEmptyState {
  if (detail.traceFullyMasked) {
    return {
      title: 'Trace non partageable pour les visiteurs.',
      hint: 'Cette sortie est privée : sa trace reste réservée à son propriétaire.',
    };
  }
  if (detail.traceError) {
    return {
      title: 'Trace non disponible.',
      hint:
        detail.traceError === 'unpublishable_geometry'
          ? 'La trace est trop courte ou trop proche des extrémités masquées pour être publiée.'
          : 'La géométrie enregistrée n’a pas pu être publiée en sécurité.',
    };
  }
  return {
    title: 'Aucun tracé enregistré pour ce carnet.',
    hint: 'L’auteur n’a pas joint de trace GPS : rien n’est dessiné plutôt qu’inventé.',
  };
}
