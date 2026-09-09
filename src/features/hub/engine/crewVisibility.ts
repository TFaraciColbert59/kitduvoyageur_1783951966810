/**
 * H-ACT §4 — Visibilité d'un équipage (couche groupe universelle).
 *
 * Règle : un équipage auto-créé (`auto_created`) reste invisible tant qu'il
 * ne compte qu'une seule personne (son propriétaire). Dès qu'une deuxième
 * personne le rejoint, le fonctionnement collectif normal s'active et il
 * devient visible dans les listes (équipages, sélecteur d'aventure).
 *
 * Fonction PURE — testable sans base de données.
 */

export interface CrewVisibilityLite {
  auto_created?: boolean | null;
  member_count?: number;
}

/** Un équipage est-il visible dans les listes publiques/utilisateur ? */
export function isCrewVisible(crew: CrewVisibilityLite): boolean {
  if (!crew.auto_created) return true;
  return (crew.member_count ?? 0) > 1;
}

/** L'équipage est-il en mode solo (invisible) ? */
export function isCrewSolo(crew: CrewVisibilityLite): boolean {
  return Boolean(crew.auto_created) && (crew.member_count ?? 0) <= 1;
}