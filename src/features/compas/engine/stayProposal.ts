/**
 * « Hébergement à réserver · lieu » : le texte que le préremplissage proposait pour une nuit
 * sans refuge ni bivouac. C'est un à-faire du Compas, pas un hébergement noté par la personne :
 * il ne s'écrit plus sur l'étape, et celui d'une aventure préparée avant ce changement se lit
 * « nuit à trouver » (doctrine « rien d'inventé », constat O-03).
 */
export const STAY_TO_BOOK = 'Hébergement à réserver';

export function isStayProposal(name: string | null | undefined): boolean {
  return typeof name === 'string' && name.trim().startsWith(STAY_TO_BOOK);
}

/** Le nom d'hébergement vraiment choisi (jamais la proposition du Compas). */
export function notedStay(name: string | null | undefined): string | null {
  return name && !isStayProposal(name) ? name : null;
}
