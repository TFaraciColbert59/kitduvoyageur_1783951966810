/**
 * C13 — Les trois paliers de budget, et le seul endroit ou ils sont nommes.
 *
 * Le vocabulaire est ici, pas dans le composant, pour une raison precise : les
 * identifiants (`economique` / `modere` / `confort`) sont FIGES par le contrat
 * de la base — `zod` les refuse tous les autres dans
 * `src/app/api/adventure/commit/route.ts`. On ne peut donc pas renommer les
 * colonnes, mais on peut nommer les paliers comme l'utilisateur les pense.
 *
 *   economique -> Rat      le strict minimum credible
 *   modere     -> Confort  l'equilibre, celui propose par defaut
 *   confort    -> Luxe     le confort achete
 *
 * L'ordre de la liste est donc l'ordre de la depense croissante, et
 * `DEFAULT_BUDGET_TIER` designe le palier que l'ecran propose quand la personne
 * n'a rien choisi. Il est consomme par `PreferencesSheet`, qui le marque
 * `data-default="true"` : le tiroir dit donc a l'ecran CE QU'IL PROPOSE, au
 * lieu de laisser croire qu'un choix a ete fait.
 *
 * Aucun montant ici. Un budget en euros n existe que si la base en renvoie un
 * (`draft.preferences.budgetPerPerson`), et il est affiche tel quel ailleurs.
 */

import type { BudgetLevel } from '../types';

export interface BudgetTier {
  /** Identifiant reellement ecrit en base. Ne pas renommer : le contrat est fige. */
  readonly id: BudgetLevel;
  /** Le nom du palier, tel qu'on le dirait a voix haute. */
  readonly label: string;
  /** Une ligne, pas un chiffre : ce que le palier achete, pas ce qu'il coute. */
  readonly detail: string;
}

export const BUDGET_TIERS: readonly BudgetTier[] = [
  { id: 'economique', label: 'Rat', detail: 'Le strict minimum pour que la sortie tienne.' },
  { id: 'modere', label: 'Confort', detail: 'L’équilibre : un gîte, des repas, une vraie marge.' },
  { id: 'confort', label: 'Luxe', detail: 'Le confort acheté : de bonnes nuits, de bonnes tables, des trajets simples.' },
];

/**
 * Le palier propose quand rien n'a ete choisi.
 *
 * Contrainte a dire ici plutot que dans le tiroir : `PreferencesBlock.budgetLevel`
 * est non nullable (`types.ts`, proprietaire du modele). « Rien de selectionne »
 * n'est donc pas representable en base ; la seule facon honnete de dire « on te
 * propose » est de nommer le palier par defaut et de le marquer comme tel a
 * l'ecran.
 *
 * ET CE PALIER EST CELUI QUE LA BASE POSE DEJA. `engine/emptyDraft.ts` ouvre un
 * brouillon neuf sur `modere` : annoncer « Rat » par defaut afficherait un
 * defaut que rien ne porte, et le tiroir mentirait sur l'etat reel du
 * brouillon. `DEFAULT_BUDGET_TIER` doit donc SUIVRE `emptyDraft.ts`, jamais
 * l'inverse. Le changer pour `economique` est un changement de modele
 * (proprietaire du fichier de types), pas un changement d'ecran.
 */
export const DEFAULT_BUDGET_TIER: BudgetLevel = 'modere';

/** Libelle du palier, ou `null` si l'identifiant n'est pas connu. */
export function budgetTierLabel(id: BudgetLevel): string | null {
  return BUDGET_TIERS.find((tier) => tier.id === id)?.label ?? null;
}