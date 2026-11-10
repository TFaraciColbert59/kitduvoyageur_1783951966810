import type { CarnetViewerRole } from './types';

/**
 * Participant = auteur, collaborateur ou présent d'une sortie du carnet. Le
 * serveur ne produit aujourd'hui que `participant` / `visitor`, mais le contrat
 * (`CarnetViewerRole`) prévoit `owner` et `co_author` : tous trois ont les mêmes
 * droits d'édition, budget et position exacte. Un rôle absent vaut visiteur.
 */
export function isParticipantRole(role: CarnetViewerRole | null | undefined): boolean {
  return role === 'participant' || role === 'owner' || role === 'co_author';
}
